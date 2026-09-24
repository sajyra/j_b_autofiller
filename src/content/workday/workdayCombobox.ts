import { FieldSemantic } from '../../types/autofill';
import { findBestMatchingOption, scoreChoiceMatch } from '../core/semanticMatcher';
import { simulateClick, setInputValue, setSelectValue } from '../core/eventDispatcher';

const OPTION_SELECTORS = [
  '[data-automation-id="menuItem"]',
  '[data-automation-id="select-item"]',
  '[data-automation-id="promptOption"]',
  '[data-automation-id*="menuItem" i]',
  '[data-automation-id*="MenuItem" i]',
  '[data-automation-id*="select-item" i]',
  '[data-automation-id*="promptOption" i]',
  '[data-automation-id*="option" i]',
  '[data-automation-id*="treeItem" i]',
  '[role="option"]',
  'li[role="option"]',
  'div[role="option"]',
  '[role="treeitem"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[data-automation-label]',
  'li[id*="promptOption"]',
  'div[id*="promptOption"]',
  'ul[role="listbox"] > li',
  '[role="listbox"] li',
  '[role="listbox"] div[tabindex]',
].join(', ');

/**
 * Dispatches a full synthetic pointer and mouse click sequence for Canvas/Workday components.
 */
export function fireClick(elem: HTMLElement): void {
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
    try {
      const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
      elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
    } catch {}
  });
  if (typeof elem.click === 'function') {
    try { elem.click(); } catch {}
  }
}

/**
 * Interacts with Workday's search/multiselect prompts (e.g. Source, Field of Study).
 * Types the target keyword into the search box, submits Enter, and clicks the best matching item.
 */
export async function selectWorkdaySearchPrompt(
  containerOrInput: HTMLElement,
  targetValue: string,
  semantic?: FieldSemantic,
  timeoutMs = 1500
): Promise<boolean> {
  if (!containerOrInput || !targetValue) return false;

  const container = containerOrInput instanceof HTMLInputElement
    ? containerOrInput.closest<HTMLElement>(
        '[data-automation-id*="formField" i], [data-automation-id*="multiSelect" i], [data-uxi-widget-type="multiselect" i]'
      ) || containerOrInput.parentElement || containerOrInput
    : containerOrInput;

  // 1. Check if already selected with matching value
  const existingPills = Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-automation-id="selectedItem"], [id*="pill-"], [data-automation-id="promptSelectionLabel"], [data-automation-id="promptOption"]'
    )
  );
  for (const pill of existingPills) {
    const text = (pill.textContent || '').trim();
    if (text && scoreChoiceMatch(text, targetValue, semantic) >= 70) {
      return true;
    }
  }

  // 2. Locate search input
  const searchInput =
    containerOrInput instanceof HTMLInputElement
      ? containerOrInput
      : container.querySelector<HTMLInputElement>(
          'input[data-automation-id="searchBox"], input[placeholder*="Search" i], input[type="text"], input:not([type="hidden"])'
        );

  if (!searchInput) return false;

  try {
    searchInput.focus();
    setInputValue(searchInput, targetValue);
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

    const startTime = Date.now();
    let options: HTMLElement[] = [];
    let bestOption: HTMLElement | null = null;
    await new Promise((r) => setTimeout(r, 350));

    while (Date.now() - startTime < timeoutMs) {
      options = Array.from(document.querySelectorAll<HTMLElement>(OPTION_SELECTORS)).filter(
        (el) =>
          (el.offsetParent !== null || !!el.textContent?.trim()) &&
          !el.closest('header, nav, [data-automation-id*="header" i], [data-automation-id*="nav" i], [data-automation-id="selectedItemList"], [data-automation-id="selectedItem"]')
      );

      if (options.length > 0) {
        const match = findBestMatchingOption(
          options,
          (opt) => opt.getAttribute('data-automation-label') || opt.getAttribute('aria-label') || opt.textContent || '',
          targetValue,
          semantic,
          30
        );
        if (match.best) {
          bestOption = match.best;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    if (bestOption) {
        const radioTarget = bestOption.querySelector<HTMLElement>('input[type="radio"], [data-automation-id="radioBtn"]');
        const leafTarget = bestOption.querySelector<HTMLElement>('[data-automation-id="promptLeafNode"]');
        const clickTarget = radioTarget || leafTarget || bestOption;

        clickTarget.scrollIntoView?.({ block: 'nearest' });
        fireClick(clickTarget);
        if (leafTarget && clickTarget !== leafTarget) fireClick(leafTarget);
        if (bestOption !== clickTarget && bestOption !== leafTarget) fireClick(bestOption);

        await new Promise((r) => setTimeout(r, 300));
        try { searchInput.blur(); } catch {}
        return true;
      }
  } catch {}

  return false;
}

/**
 * Interacts with Workday's custom popup comboboxes, dropdowns, and search prompts.
 * Workday uses buttons with [data-automation-id*="prompt"], [data-automation-id*="Dropdown"],
 * or [role="combobox"] that open an overlay containing search inputs and listbox options.
 */
export async function selectWorkdayComboboxOption(
  trigger: HTMLElement,
  targetValue: string,
  semantic?: FieldSemantic,
  timeoutMs = 1500
): Promise<boolean> {
  if (!trigger || !targetValue) return false;

  // If trigger is or contains a multiselect search prompt input
  const isSearchPrompt =
    (trigger instanceof HTMLInputElement && trigger.type !== 'button' && trigger.type !== 'submit') ||
    !!trigger.querySelector('input[data-automation-id="searchBox"], input[placeholder*="Search" i]') ||
    trigger.getAttribute('data-automation-id')?.toLowerCase().includes('multiselect') ||
    trigger.getAttribute('data-uxi-widget-type')?.toLowerCase().includes('multiselect');

  if (isSearchPrompt) {
    const searchSuccess = await selectWorkdaySearchPrompt(trigger, targetValue, semantic, timeoutMs);
    if (searchSuccess) return true;
    if (trigger instanceof HTMLInputElement && trigger.type !== 'button' && trigger.type !== 'submit') {
      setInputValue(trigger, targetValue);
      return true;
    }
  }

  // 1. If trigger is or contains a native <select>
  const selectEl =
    trigger.tagName.toLowerCase() === 'select'
      ? (trigger as HTMLSelectElement)
      : trigger.querySelector<HTMLSelectElement>('select');
  if (selectEl) {
    return setSelectValue(selectEl, targetValue, semantic);
  }

  // 2. Resolve interactive clickable element (button, combobox, or role=button)
  const clickable = trigger.matches('button, [role="button"], [role="combobox"]')
    ? trigger
    : trigger.querySelector<HTMLElement>('button, [role="button"], [role="combobox"]') || trigger;

  // 3. Check if the combobox already displays the desired value (ignore placeholders like "Select One")
  const currentText = (clickable.textContent || trigger.textContent || '').trim();
  const currentTextLower = currentText.toLowerCase();
  if (
    currentText &&
    !currentTextLower.includes('select one') &&
    !currentTextLower.includes('select...') &&
    scoreChoiceMatch(currentText, targetValue, semantic) >= 80
  ) {
    return true;
  }

  // 4. Open the prompt / dropdown popup using synthetic pointer and mouse click sequence
  clickable.focus();
  fireClick(clickable);

  // 5. Wait for the popup menu / options to mount in the DOM
  const startTime = Date.now();
  let options: HTMLElement[] = [];

  while (Date.now() - startTime < timeoutMs) {
    const ariaControls = clickable.getAttribute('aria-controls') || clickable.getAttribute('aria-owns');
    let targetListbox = ariaControls ? (clickable.ownerDocument || document).getElementById(ariaControls) : null;
    if (!targetListbox) {
      const doc = clickable.ownerDocument || document;
      const openListboxes = Array.from(doc.querySelectorAll<HTMLElement>('[role="listbox"], ul[role="listbox"]')).filter(
        (lb) => lb.offsetParent !== null || (typeof window !== 'undefined' && window.getComputedStyle(lb).display !== 'none')
      );
      if (openListboxes.length > 0) {
        targetListbox = openListboxes[openListboxes.length - 1];
      }
    }

    const searchRoot = targetListbox || clickable.ownerDocument || document;
    options = Array.from(searchRoot.querySelectorAll<HTMLElement>(OPTION_SELECTORS)).filter(
      (el) =>
        (el.offsetParent !== null || !!el.textContent?.trim()) &&
        !el.closest('header, nav, [data-automation-id*="header" i], [data-automation-id*="nav" i], [data-automation-id="selectedItemList"]')
    );

    if (options.length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // 6. Check for an internal search input strictly inside the active popup
  const popupContainer = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="listbox"], [data-automation-id="select-menu"], [data-automation-id*="popup" i], [data-automation-id*="dialog" i], [data-automation-id*="menu" i]'
    )
  ).find((el) => el.offsetParent !== null && !clickable.contains(el));

  const searchInput = popupContainer?.querySelector<HTMLInputElement>(
    'input[data-automation-id="searchBox"], input[type="search"], input[role="searchbox"]'
  );

  if (searchInput) {
    setInputValue(searchInput, targetValue);
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Re-query options after search filter
    options = Array.from(document.querySelectorAll<HTMLElement>(OPTION_SELECTORS)).filter(
      (el) =>
        (el.offsetParent !== null || !!el.textContent?.trim()) &&
        !el.closest('header, nav, [data-automation-id*="header" i], [data-automation-id*="nav" i]')
    );
  }

  // 7. Match and select the best option
  if (options.length > 0) {
    let bestOption: HTMLElement | null = null;
    let matchScore = 0;

    if (semantic === 'degree') {
      const isBach = /bachelor/i.test(targetValue);
      const isMast = /master/i.test(targetValue);
      const isDoc = /doctor|phd/i.test(targetValue);
      const isAssoc = /assoc/i.test(targetValue);

      const degreeMatch = options.find((opt) => {
        const text = (opt.getAttribute('data-automation-label') || opt.textContent || '').trim();
        if (isBach && /bachelors?|bachelor of/i.test(text)) return true;
        if (isMast && /masters?|master of/i.test(text)) return true;
        if (isDoc && /doctorate|phd|doctor/i.test(text)) return true;
        if (isAssoc && /associates?/i.test(text)) return true;
        return false;
      });

      if (degreeMatch) {
        bestOption = degreeMatch;
        matchScore = 100;
      }
    }

    if (!bestOption) {
      const match = findBestMatchingOption(
        options,
        (opt) => opt.getAttribute('data-automation-label') || opt.textContent || '',
        targetValue,
        semantic,
        30
      );
      bestOption = match.best;
      matchScore = match.score;
    }

    if (!bestOption && semantic === 'phone_device_type') {
      const validOpt = options.find((opt) => {
        const text = (opt.getAttribute('data-automation-label') || opt.textContent || '').trim().toLowerCase();
        return text && !text.includes('select one') && !text.includes('select...');
      });
      if (validOpt) {
        bestOption = validOpt;
        matchScore = 50;
      }
    }

    if (bestOption) {
      const radioTarget = bestOption.querySelector<HTMLElement>('input[type="radio"], [data-automation-id="radioBtn"]');
      const clickEl = radioTarget || bestOption.querySelector<HTMLElement>('[data-automation-id="promptLeafNode"]') || bestOption;
      clickEl.scrollIntoView?.({ block: 'nearest' });
      clickEl.focus?.();
      fireClick(clickEl);
      if (bestOption !== clickEl) fireClick(bestOption);

      // If clicked item was an intermediate category (e.g. "Job Board" when looking for "LinkedIn"),
      // check if child options appeared
      if (matchScore < 90) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const subOptions = Array.from(document.querySelectorAll<HTMLElement>(OPTION_SELECTORS)).filter(
          (el) => !el.closest('header, nav, [data-automation-id*="header" i], [data-automation-id*="nav" i]')
        );
        if (subOptions.length > 0) {
          const subMatch = findBestMatchingOption(
            subOptions,
            (opt) => opt.getAttribute('data-automation-label') || opt.textContent || '',
            targetValue,
            semantic,
            30
          );
          if (subMatch.best && subMatch.best !== bestOption) {
            const subRadio = subMatch.best.querySelector<HTMLElement>('input[type="radio"], [data-automation-id="radioBtn"]');
            const subClick = subRadio || subMatch.best.querySelector<HTMLElement>('[data-automation-id="promptLeafNode"]') || subMatch.best;
            subClick.scrollIntoView?.({ block: 'nearest' });
            fireClick(subClick);
            if (subMatch.best !== subClick) fireClick(subMatch.best);
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      return true;
    }
  }

  // If no option matched, close the prompt safely
  try {
    clickable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  } catch {}

  return false;
}
