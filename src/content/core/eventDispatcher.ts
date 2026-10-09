/**
 * Robust React-safe DOM event dispatching and value setting.
 * Guarantees synthetic event listeners (React 16, 17, 18, 19, Radix UI, React Hook Form)
 * pick up the changes and pass form validation.
 */

/**
 * Dispatches a full pointer and mouse event sequence (pointerdown, mousedown, pointerup, mouseup, click)
 * to ensure Radix UI, Headless UI, and React controlled components register user clicks.
 */
export function firePointerClick(element: HTMLElement): void {
  if (!element) return;

  try {
    if (typeof element.focus === 'function') element.focus();
  } catch {}

  const pointerInit: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
  };

  try {
    if (typeof PointerEvent !== 'undefined') {
      element.dispatchEvent(new PointerEvent('pointerover', { ...pointerInit, buttons: 0 }));
      element.dispatchEvent(new PointerEvent('pointerenter', { ...pointerInit, buttons: 0 }));
      element.dispatchEvent(new PointerEvent('pointerdown', pointerInit));
    }
  } catch {}

  try {
    element.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        button: 0,
        buttons: 1,
      })
    );
  } catch {}

  try {
    if (typeof PointerEvent !== 'undefined') {
      element.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit, buttons: 0 }));
    }
  } catch {}

  try {
    element.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        button: 0,
        buttons: 0,
      })
    );
  } catch {}

  try {
    if (typeof element.click === 'function') {
      element.click();
    } else {
      element.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          button: 0,
        })
      );
    }
  } catch {}

  // React synthetic click / pointer handler invocation (if attached via fiber/props)
  try {
    const keys = Object.keys(element);
    const reactKey = keys.find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
    if (reactKey) {
      const props = (element as any)[reactKey];
      if (props) {
        const dummyClick = {
          bubbles: true,
          cancelable: true,
          defaultPrevented: false,
          currentTarget: element,
          target: element,
          persist: () => {},
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
        };
        if (typeof props.onPointerDown === 'function') props.onPointerDown(dummyClick);
        if (typeof props.onPointerUp === 'function') props.onPointerUp(dummyClick);
        if (typeof props.onClick === 'function') props.onClick(dummyClick);
      }
    }
  } catch {}
}

export function simulateClick(element: HTMLElement): void {
  firePointerClick(element);
}

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

  // 1. Prime React _valueTracker BEFORE changing value
  // React 16-19 updateValueIfChanged compares tracker.getValue() with node.value.
  // Setting tracker to a differing sentinel (e.g. ' ' if value is '', else '')
  // guarantees React detects the change when the native setter is called.
  try {
    const tracker = (actualInput as any)._valueTracker;
    if (tracker && typeof tracker.setValue === 'function') {
      tracker.setValue(value === '' ? ' ' : '');
    }
  } catch {}

  // 2. Call the native prototype setter (bypassing any custom/React wrapper property)
  let setSuccess = false;
  try {
    const proto = isTextArea ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
    if (proto) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(actualInput, value);
        setSuccess = true;
      }
    }
  } catch {}

  if (!setSuccess) {
    try {
      (actualInput as any).value = value;
    } catch {}
  }

  // 3. Dispatch beforeinput (InputEvent)
  try {
    if (typeof InputEvent !== 'undefined') {
      actualInput.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          composed: true,
          data: value,
          inputType: 'insertReplacementText',
          view: window,
        })
      );
    } else {
      actualInput.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true, composed: true }));
    }
  } catch {}

  // 4. Dispatch input (InputEvent)
  try {
    if (typeof InputEvent !== 'undefined') {
      actualInput.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          composed: true,
          data: value,
          inputType: 'insertReplacementText',
          view: window,
        })
      );
    } else {
      actualInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
    }
  } catch {
    try {
      actualInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
    } catch {}
  }

  // 5. Dispatch change event
  try {
    actualInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
  } catch {}

  // 6. Direct React synthetic handler invocation via __reactProps$ / __reactEventHandlers$
  try {
    const keys = Object.keys(actualInput);
    const reactKey = keys.find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
    if (reactKey) {
      const props = (actualInput as any)[reactKey];
      if (props) {
        const dummyInputEvent = {
          target: actualInput,
          currentTarget: actualInput,
          bubbles: true,
          cancelable: true,
          defaultPrevented: false,
          persist: () => {},
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new Event('input', { bubbles: true, cancelable: true, composed: true }),
        };
        if (typeof props.onInput === 'function') props.onInput(dummyInputEvent);
        if (typeof props.onChange === 'function') props.onChange({ ...dummyInputEvent, nativeEvent: new Event('change') });
      }
    }
  } catch {}

  // 7. Dispatch focusout and blur
  try {
    actualInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true, cancelable: true, composed: true, view: window }));
    actualInput.dispatchEvent(new FocusEvent('blur', { bubbles: false, cancelable: false, composed: true, view: window }));
  } catch {
    try {
      actualInput.dispatchEvent(new Event('blur', { bubbles: false, cancelable: false }));
    } catch {}
  }
}

export function setCheckboxOrRadio(element: HTMLElement, checked: boolean): void {
  if (!element) return;

  const actualInput =
    element instanceof HTMLInputElement
      ? element
      : element.querySelector<HTMLInputElement>('input[type="checkbox"], input[type="radio"]') || (element as HTMLInputElement);

  try {
    if (typeof actualInput.focus === 'function') actualInput.focus();
  } catch {}

  // 1. Reset React _valueTracker if present on checkbox/radio
  try {
    const tracker = (actualInput as any)._valueTracker;
    if (tracker && typeof tracker.setValue === 'function') {
      tracker.setValue(!checked);
    }
  } catch {}

  // 2. Determine interactive target: label or input itself
  let labelTarget: HTMLElement | null = null;
  if (actualInput.id) {
    try {
      const doc = actualInput.ownerDocument || document;
      labelTarget = doc.querySelector<HTMLElement>(`label[for="${CSS.escape(actualInput.id)}"]`);
    } catch {}
  }
  if (!labelTarget) {
    labelTarget = actualInput.closest('label');
  }

  const isCheckbox = actualInput instanceof HTMLInputElement && actualInput.type === 'checkbox';

  if (isCheckbox) {
    if (actualInput.checked !== checked) {
      if (labelTarget) {
        firePointerClick(labelTarget);
      } else {
        firePointerClick(actualInput);
      }
    }
    if (actualInput.checked !== checked) {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked');
        if (descriptor && descriptor.set) {
          descriptor.set.call(actualInput, checked);
        } else {
          actualInput.checked = checked;
        }
      } catch {
        actualInput.checked = checked;
      }
    }
  } else {
    // Radio button or custom control
    if (labelTarget) {
      firePointerClick(labelTarget);
    } else {
      firePointerClick(actualInput);
    }
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked');
      if (descriptor && descriptor.set) {
        descriptor.set.call(actualInput, checked);
      } else {
        (actualInput as HTMLInputElement).checked = checked;
      }
    } catch {
      (actualInput as HTMLInputElement).checked = checked;
    }
  }

  // If element is a button or custom role="radio" / role="checkbox", set ARIA attributes
  if (element && element !== actualInput) {
    try {
      element.setAttribute('aria-checked', String(checked));
      element.setAttribute('data-state', checked ? 'checked' : 'unchecked');
    } catch {}
  }

  // 6. UNCONDITIONALLY dispatch bubbling input and change events on actualInput
  try {
    actualInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
    actualInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
  } catch {}

  if (labelTarget) {
    try {
      labelTarget.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
    } catch {}
  }

  // 7. Direct invocation of React synthetic handlers on input & label if attached
  for (const targetEl of [actualInput, labelTarget]) {
    if (!targetEl) continue;
    try {
      const keys = Object.keys(targetEl);
      const reactKey = keys.find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
      if (reactKey) {
        const props = (targetEl as any)[reactKey];
        if (props) {
          const synthEvent = {
            target: actualInput,
            currentTarget: targetEl,
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            persist: () => {},
            preventDefault: () => {},
            stopPropagation: () => {},
            nativeEvent: new Event('change', { bubbles: true, cancelable: true, composed: true }),
          };
          if (typeof props.onChange === 'function') props.onChange(synthEvent);
        }
      }
    } catch {}
  }

  // 8. Invoke Radix UI / custom RadioGroup onValueChange on parent containers
  let parent = actualInput.closest('[role="radiogroup"], fieldset, [data-radix-collection-item]') || actualInput.parentElement;
  while (parent && parent !== document.body) {
    try {
      const keys = Object.keys(parent);
      const reactKey = keys.find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
      if (reactKey) {
        const props = (parent as any)[reactKey];
        if (props) {
          if (typeof props.onValueChange === 'function') {
            props.onValueChange(actualInput.value || (checked ? 'true' : 'false'));
          }
          if (typeof props.onChange === 'function') {
            props.onChange({
              target: actualInput,
              currentTarget: parent,
              bubbles: true,
              cancelable: true,
              defaultPrevented: false,
              persist: () => {},
              preventDefault: () => {},
              stopPropagation: () => {},
              nativeEvent: new Event('change', { bubbles: true, cancelable: true, composed: true }),
            });
          }
        }
      }
    } catch {}
    parent = parent.parentElement;
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
      actualSelect.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
      actualSelect.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
      actualSelect.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true }));
    } catch {}

    // Direct invocation of React synthetic handlers if attached
    try {
      const keys = Object.keys(actualSelect);
      const reactKey = keys.find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
      if (reactKey) {
        const props = (actualSelect as any)[reactKey];
        if (props && typeof props.onChange === 'function') {
          props.onChange({
            target: actualSelect,
            currentTarget: actualSelect,
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            persist: () => {},
            preventDefault: () => {},
            stopPropagation: () => {},
            nativeEvent: new Event('change'),
          });
        }
      }
    } catch {}

    return true;
  }
  return false;
}
