/**
 * Robust React-safe DOM event dispatching and value setting.
 * Guarantees synthetic event listeners (React 16, 17, 18, 19) pick up the change.
 */

export function setInputValue(element: HTMLElement, value: string): void {
  if (!element) return;

  const actualInput =
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? element
      : element.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea') || element;

  try {
    if (typeof actualInput.focus === 'function') actualInput.focus();
  } catch {}

  const isTextArea = actualInput.tagName?.toLowerCase() === 'textarea';
  const isInput = actualInput.tagName?.toLowerCase() === 'input';

  // 1. Try document.execCommand('insertText') for native browser simulation
  let execSuccess = false;
  if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    try {
      if (typeof (actualInput as HTMLInputElement).select === 'function') {
        (actualInput as HTMLInputElement).select();
      }
      document.execCommand('selectAll', false);
      document.execCommand('delete', false);
      execSuccess = document.execCommand('insertText', false, value);
    } catch {}
  }

  // 2. Prototype setter fallback / guarantee
  let setSuccess = false;
  if (isInput) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(actualInput, value);
        setSuccess = true;
      }
    } catch {}
  } else if (isTextArea) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(actualInput, value);
        setSuccess = true;
      }
    } catch {}
  }

  if (!setSuccess && !execSuccess) {
    try {
      (actualInput as any).value = value;
    } catch {}
  }

  // 3. Reset React valueTracker if present
  try {
    const tracker = (actualInput as any)._valueTracker;
    if (tracker && typeof tracker.setValue === 'function') {
      tracker.setValue('');
    }
  } catch {}

  // 4. Dispatch standard synthetic input and change events
  try {
    actualInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    actualInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    actualInput.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true }));
  } catch {}
}

export function setCheckboxOrRadio(element: HTMLElement, checked: boolean): void {
  if (!element) return;

  const actualInput =
    element instanceof HTMLInputElement
      ? element
      : element.querySelector<HTMLInputElement>('input[type="checkbox"], input[type="radio"]') || (element as HTMLInputElement);

  if ((actualInput as HTMLInputElement).checked === checked) return;

  try {
    if (typeof actualInput.focus === 'function') actualInput.focus();
    if (typeof actualInput.click === 'function') actualInput.click();
  } catch {}

  if ((actualInput as HTMLInputElement).checked !== checked) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked');
      if (descriptor && descriptor.set) {
        descriptor.set.call(actualInput, checked);
      } else {
        (actualInput as HTMLInputElement).checked = checked;
      }
    } catch {
      try {
        (actualInput as HTMLInputElement).checked = checked;
      } catch {}
    }
    try {
      actualInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    } catch {}

    // In React / custom framework designs, clicking the associated label is required to trigger state change
    if ((actualInput as HTMLInputElement).checked !== checked) {
      if (actualInput.id) {
        try {
          const doc = actualInput.ownerDocument || document;
          const forLabel = doc.querySelector<HTMLElement>(`label[for="${CSS.escape(actualInput.id)}"]`);
          if (forLabel) forLabel.click();
        } catch {}
      }
      const closestLabel = actualInput.closest('label');
      if (closestLabel && (actualInput as HTMLInputElement).checked !== checked) {
        try { closestLabel.click(); } catch {}
      }
    }
  }

  try {
    actualInput.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true }));
  } catch {}
}

import { FieldSemantic } from '../../types/autofill';
import { findBestMatchingOption } from './semanticMatcher';

export function setSelectValue(
  element: HTMLElement,
  valueOrText: string,
  semantic?: FieldSemantic
): boolean {
  if (!element) return false;
  const actualSelect =
    element instanceof HTMLSelectElement
      ? element
      : element.querySelector<HTMLSelectElement>('select');

  if (!actualSelect || !actualSelect.options || actualSelect.options.length === 0) return false;

  try {
    actualSelect.focus();
  } catch {}

  const options = Array.from(actualSelect.options);
  const { best: matchedOption } = findBestMatchingOption(
    options,
    (opt) => `${opt.value} ${opt.text}`,
    valueOrText,
    semantic,
    30
  );
  if (matchedOption) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(actualSelect, matchedOption.value);
      } else {
        actualSelect.value = matchedOption.value;
      }
    } catch {
      actualSelect.value = matchedOption.value;
    }
    try {
      actualSelect.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      actualSelect.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      actualSelect.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true }));
    } catch {}
    return true;
  }
  return false;
}

export function simulateClick(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  element.click();
}
