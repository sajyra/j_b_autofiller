import { describe, it, expect, vi } from 'vitest';
import { setInputValue, setCheckboxOrRadio, setSelectValue, firePointerClick } from '../content/core/eventDispatcher';

describe('eventDispatcher', () => {
  it('dispatches input, change, and blur events on text input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const inputListener = vi.fn();
    const changeListener = vi.fn();
    const blurListener = vi.fn();

    input.addEventListener('input', inputListener);
    input.addEventListener('change', changeListener);
    input.addEventListener('blur', blurListener);

    setInputValue(input, 'Alex');

    expect(input.value).toBe('Alex');
    expect(inputListener).toHaveBeenCalled();
    expect(changeListener).toHaveBeenCalled();
    expect(blurListener).toHaveBeenCalled();

    input.remove();
  });

  it('sets radio checked state and fires events', () => {
    const radio = document.createElement('input');
    radio.type = 'radio';
    document.body.appendChild(radio);

    const changeListener = vi.fn();
    radio.addEventListener('change', changeListener);

    setCheckboxOrRadio(radio, true);

    expect(radio.checked).toBe(true);
    expect(changeListener).toHaveBeenCalled();

    radio.remove();
  });

  it('selects option by visible text or value', () => {
    const select = document.createElement('select');
    select.innerHTML = `
      <option value="">Select an option</option>
      <option value="opt-yes">Yes, I am authorized</option>
      <option value="opt-no">No, I am not</option>
    `;
    document.body.appendChild(select);

    const success = setSelectValue(select, 'Yes, I am authorized');
    expect(success).toBe(true);
    expect(select.value).toBe('opt-yes');

    select.remove();
  });

  it('correctly resets React _valueTracker so React Hook Form detects changes', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    let trackerValue = '';
    (input as any)._valueTracker = {
      getValue: () => trackerValue,
      setValue: (v: string) => {
        trackerValue = v;
      },
    };

    let reactState = '';
    (input as any)['__reactProps$test'] = {
      onChange: (e: any) => {
        reactState = e.target.value;
      },
    };

    setInputValue(input, 'Alex Mercer');

    expect(input.value).toBe('Alex Mercer');
    expect(reactState).toBe('Alex Mercer');

    input.remove();
  });

  it('dispatches pointer events and invokes Radix UI / React props in firePointerClick', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);

    const pointerDownSpy = vi.fn();
    const clickSpy = vi.fn();
    button.addEventListener('pointerdown', pointerDownSpy);
    button.addEventListener('click', clickSpy);

    let reactClicked = false;
    (button as any)['__reactProps$test'] = {
      onClick: () => {
        reactClicked = true;
      },
    };

    setInputValue(button as any, ''); // safe no-op
    button.focus();

    // Verify pointer click
    firePointerClick(button);

    expect(clickSpy).toHaveBeenCalled();
    expect(reactClicked).toBe(true);

    button.remove();
  });
});
