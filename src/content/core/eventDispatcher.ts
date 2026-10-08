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

  if ((actualInput as HTMLInputElement).checked === checked) return;

  try {
    if (typeof actualInput.focus === 'function') actualInput.focus();
  } catch {}

  // Reset React _valueTracker if present on checkbox/radio
  try {
    const tracker = (actualInput as any)._valueTracker;
    if (tracker && typeof tracker.setValue === 'function') {
      tracker.setValue(!checked);
    }
  } catch {}

  // 1. Determine interactive target: label or input itself
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

  // 2. Click the interactive label if available, otherwise the input
  if (labelTarget) {
    firePointerClick(labelTarget);
  } else {
    firePointerClick(actualInput);
  }

  // 3. If checked state did not update, try clicking actualInput directly
  if ((actualInput as HTMLInputElement).checked !== checked && labelTarget) {
    firePointerClick(actualInput);
  }

  // 4. If still not matching target state, force via prototype setter
  if ((actualInput as HTMLInputElement).checked !== checked) {
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

    try {
      actualInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
      actualInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
    } catch {}
  }

  // 5. Direct invocation of React synthetic handlers on input if attached
  try {
    const keys = Object.keys(actualInput);
    const reactKey = keys.find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
    if (reactKey) {
      const props = (actualInput as any)[reactKey];
      if (props && typeof props.onChange === 'function') {
        props.onChange({
          target: actualInput,
          currentTarget: actualInput,
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
