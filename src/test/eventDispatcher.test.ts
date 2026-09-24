import { describe, it, expect, vi } from 'vitest';
import { setInputValue, setCheckboxOrRadio, setSelectValue } from '../content/core/eventDispatcher';

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
});
