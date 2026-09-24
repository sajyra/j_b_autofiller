import { CandidateProfile, WorkExperienceItem, EducationItem } from '../../types/profile';
import { AutofillReport, FieldSemantic } from '../../types/autofill';
import { classifyField, extractFieldLabel, normalizeText } from '../core/labelMatcher';
import { setInputValue, setSelectValue, setCheckboxOrRadio, simulateClick } from '../core/eventDispatcher';
import { findBestMatchingOption, scoreChoiceMatch, getProfileValueForSemantic, US_STATES } from '../core/semanticMatcher';
import { dataUrlToFile } from '../ashby/ashbyFiller';
import { selectWorkdayComboboxOption, selectWorkdaySearchPrompt, fireClick } from './workdayCombobox';

export type WorkdayStep =
  | 'information'
  | 'experience'
  | 'questions'
  | 'disclosures'
  | 'review'
  | 'unknown';

/**
 * Checks if current page or document is a Workday application page.
 */
export function isWorkdayForm(doc: Document = document): boolean {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('myworkdayjobs.com') || host.includes('myworkday.com')) {
      return true;
    }
  }

  // Check DOM markers
  if (
    doc.querySelector('[data-automation-id="workdayApplication"]') ||
    doc.querySelector('[data-automation-id="progressBar"]') ||
    doc.querySelector('[data-automation-id="pageHeader"]') ||
    doc.querySelector('[data-automation-id*="legalNameSection"]') ||
    doc.querySelector('div[id*="workday"]') ||
    doc.querySelector('[data-automation-id="bottom-navigation-next-button"]')
  ) {
    return true;
  }

  return false;
}

/**
 * Detects the active Workday application wizard step.
 */
export function detectWorkdayStep(root: Document | HTMLElement = document): WorkdayStep {
  // 1. Check all headings and progress bar indicators on the page
  const headings = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-automation-id="progressBar"] [aria-current="step"], [data-automation-id="progressBar"] [class*="active"], [data-automation-id="pageHeader"], h1, h2, h3, h4, legend'
    )
  )
    .map((el) => (el.textContent || '').trim().toLowerCase())
    .join(' ');

  if (headings.includes('review') || headings.includes('review and submit')) {
    return 'review';
  }
  if (
    headings.includes('voluntary disclosure') ||
    headings.includes('self-identification') ||
    headings.includes('disclosures') ||
    root.querySelector('[data-automation-id="applyFlowVoluntaryDisclosuresPage"]') ||
    root.querySelector('[id*="personalInfoUS"]') ||
    root.querySelector('[id*="termsAndConditions"]')
  ) {
    return 'disclosures';
  }
  if (headings.includes('work experience') || headings.includes('my experience') || headings.includes('education')) {
    return 'experience';
  }
  if (headings.includes('application question') || headings.includes('questions')) {
    return 'questions';
  }
  if (headings.includes('my information') || headings.includes('contact information') || headings.includes('personal information')) {
    return 'information';
  }

  // 2. Infer step from unique inputs present on the page
  if (
    root.querySelector('[data-automation-id="disabilityStatus"]') ||
    root.querySelector('[data-automation-id="veteranStatus"]') ||
    root.querySelector('[data-automation-id="hispanicOrLatino"]') ||
    root.querySelector('[data-automation-id="applyFlowVoluntaryDisclosuresPage"]') ||
    root.querySelector('[id*="personalInfoUS"]') ||
    root.querySelector('[id*="termsAndConditions"]')
  ) {
    return 'disclosures';
  }

  if (
    root.querySelector('[data-automation-id="legalNameSection_firstName"]') ||
    root.querySelector('[data-automation-id="addressSection_city"]') ||
    root.querySelector('[data-automation-id="phone-number"]')
  ) {
    return 'information';
  }

  if (
    root.querySelector('[data-automation-id="file-upload-drop-zone"]') ||
    root.querySelector('[data-automation-id="jobTitle"]') ||
    root.querySelector('[data-automation-id="school"]') ||
    root.querySelector('[data-automation-id*="school"]') ||
    root.querySelector('[data-automation-id*="workExperience"]') ||
    root.querySelector('[data-automation-id*="education"]') ||
    Array.from(root.querySelectorAll<HTMLElement>('label, legend, h2, h3')).some((el) =>
      /\b(school or university|work experience|education 1)\b/i.test(el.textContent || '')
    )
  ) {
    return 'experience';
  }

  return 'unknown';
}

/**
 * Uploads resume file into Workday's file dropzone / input.
 */
export async function handleWorkdayResumeUpload(
  root: Document | HTMLElement,
  profile: CandidateProfile,
  report: AutofillReport
): Promise<boolean> {
  if (!profile.resume || !profile.resume.dataUrl) {
    return false;
  }

  const fileInput = root.querySelector<HTMLInputElement>(
    'input[type="file"][data-automation-id*="file-upload"], input[type="file"][data-automation-id*="attachment"], input[type="file"]'
  );

  if (!fileInput) return false;

  // Check if file is already attached
  if (fileInput.files && fileInput.files.length > 0) {
    report.totalFieldsFound++;
    report.fieldsFilled++;
    report.details.push({ semantic: 'resume', label: 'Resume / CV (Already Attached)', success: true });
    return true;
  }

  const dropzone =
    root.querySelector<HTMLElement>('[data-automation-id="file-upload-drop-zone"], [class*="drop-zone"], [class*="dropzone"]') ||
    fileInput.parentElement;

  if (dropzone) {
    const text = (dropzone.textContent || '').toLowerCase();
    if (/\.(pdf|docx?|txt)\b/i.test(text) && !text.includes('drop files here') && !text.includes('upload')) {
      report.totalFieldsFound++;
      report.fieldsFilled++;
      report.details.push({ semantic: 'resume', label: 'Resume / CV (Already Attached)', success: true });
      return true;
    }
  }

  report.totalFieldsFound++;

  try {
    const file = dataUrlToFile(
      profile.resume.dataUrl,
      profile.resume.name || 'resume.pdf',
      profile.resume.type || 'application/pdf'
    );

    let dt: DataTransfer | null = null;
    try {
      if (typeof DataTransfer !== 'undefined') {
        dt = new DataTransfer();
        dt.items.add(file);
      }
    } catch {}

    if (dt) {
      try {
        fileInput.files = dt.files;
      } catch {
        try {
          const proto = window.HTMLInputElement.prototype;
          const desc = Object.getOwnPropertyDescriptor(proto, 'files');
          if (desc && desc.set) desc.set.call(fileInput, dt.files);
        } catch {}
      }
    }

    fileInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    // Drag and drop event simulation on dropzone
    if (dt && dropzone && typeof DragEvent !== 'undefined') {
      try {
        const dropEvt = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
        try { Object.defineProperty(dropEvt, 'dataTransfer', { value: dt }); } catch {}
        dropzone.dispatchEvent(dropEvt);
      } catch {}
    }

    report.fieldsFilled++;
    report.details.push({ semantic: 'resume', label: 'Resume / CV Upload', success: true });
    return true;
  } catch (err: any) {
    report.details.push({ semantic: 'resume', label: 'Resume / CV Upload', success: false, reason: err?.message });
    return false;
  }
}

function isNonTextInput(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement) {
    const t = (el.type || '').toLowerCase();
    return t === 'hidden' || t === 'radio' || t === 'checkbox' || t === 'file' || t === 'submit' || t === 'button';
  }
  return false;
}

/**
 * Helper to locate an input element in Workday by data-automation-id list or by label text.
 */
export function findWorkdayInput(
  root: Document | HTMLElement,
  options: { automationIds: string[]; labelPattern: RegExp }
): HTMLInputElement | null {
  // 1. Try exact automation ID first
  for (const id of options.automationIds) {
    const idLower = id.toLowerCase();
    const direct = root.querySelector<HTMLInputElement>(
      `input[data-automation-id="${idLower}" i], input[data-automation-id="${id}" i], input[id="${idLower}" i], input[name="${idLower}" i]`
    );
    if (direct && !isNonTextInput(direct)) return direct;

    const wrapper = root.querySelector<HTMLElement>(`[data-automation-id="${idLower}" i], [data-automation-id="${id}" i]`);
    if (wrapper) {
      const input = wrapper.querySelector<HTMLInputElement>(
        'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"])'
      );
      if (input) return input;
    }
  }

  // 2. Try by label text
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement | HTMLElement>('label, [id*="label" i], legend, span, p'));
  for (const lbl of labels) {
    const text = (lbl.textContent || '').trim();
    if (!options.labelPattern.test(text)) continue;

    // A. Check htmlFor
    if (lbl instanceof HTMLLabelElement && lbl.htmlFor) {
      const doc = root.ownerDocument || (root instanceof Document ? root : document);
      const target = doc.getElementById(lbl.htmlFor);
      if (target && target instanceof HTMLInputElement && !isNonTextInput(target)) return target;
      if (target) {
        const nestedInput = target.querySelector<HTMLInputElement>(
          'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"])'
        );
        if (nestedInput) return nestedInput;
      }
    }

    // B. Check aria-labelledby
    if (lbl.id) {
      const target = root.querySelector<HTMLInputElement>(`input[aria-labelledby~="${CSS.escape(lbl.id)}"]`);
      if (target && !isNonTextInput(target)) return target;
    }

    // C. Walk up parent hierarchy (without matching generic div in closest)
    let curr: HTMLElement | null = lbl.parentElement;
    let depth = 0;
    while (curr && curr !== root && depth < 6) {
      const autoId = curr.getAttribute('data-automation-id') || '';
      const cls = curr.className || '';
      const isFormField =
        /formField/i.test(autoId) ||
        /form-field|formField/i.test(cls) ||
        curr.tagName.toLowerCase() === 'fieldset';

      const input = curr.querySelector<HTMLInputElement>(
        'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"])'
      );
      if (input && (isFormField || depth >= 1)) {
        return input;
      }

      // Check next sibling wrapper only if it does not belong to another field
      if (curr.nextElementSibling && !curr.nextElementSibling.querySelector('label, legend')) {
        const siblingInput = curr.nextElementSibling.querySelector<HTMLInputElement>(
          'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"])'
        );
        if (siblingInput) return siblingInput;
        if (
          curr.nextElementSibling instanceof HTMLInputElement &&
          !isNonTextInput(curr.nextElementSibling)
        ) {
          return curr.nextElementSibling;
        }
      }

      curr = curr.parentElement;
      depth++;
    }
  }

  // 3. Fallback: partial automation ID match
  for (const id of options.automationIds) {
    if (id.length < 5) continue;
    const idLower = id.toLowerCase();
    const direct = root.querySelector<HTMLInputElement>(
      `input[data-automation-id*="${idLower}" i], input[id*="${idLower}" i], input[name*="${idLower}" i]`
    );
    if (direct && !isNonTextInput(direct)) return direct;

    const wrapper = root.querySelector<HTMLElement>(`[data-automation-id*="${idLower}" i]`);
    if (wrapper) {
      const input = wrapper.querySelector<HTMLInputElement>(
        'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"])'
      );
      if (input) return input;
    }
  }

  return null;
}

/**
 * Helper to locate a dropdown or combobox trigger in Workday by automation IDs or label text.
 */
export function findWorkdayDropdown(
  root: Document | HTMLElement,
  options: { automationIds: string[]; labelPattern: RegExp }
): HTMLElement | null {
  const interactiveSelector =
    'button, select, [role="combobox"], [role="button"], [aria-haspopup="listbox"], [data-automation-id*="prompt" i], [data-automation-id*="Dropdown" i], [data-automation-id*="select" i], [data-automation-id*="multiSelect" i], [data-uxi-widget-type*="multiselect" i], input[data-automation-id="searchBox"], input[placeholder*="Search" i]';

  // 1. Try exact automation ID first
  for (const id of options.automationIds) {
    const idLower = id.toLowerCase();
    const el = root.querySelector<HTMLElement>(`[data-automation-id="${idLower}" i], [data-automation-id="${id}" i]`);
    if (el) {
      if (el.matches(interactiveSelector)) return el;
      const child = el.querySelector<HTMLElement>(interactiveSelector);
      if (child) return child;
      return el;
    }
  }

  // 2. Try by label text
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement | HTMLElement>('label, [id*="label" i], legend, span, p'));
  for (const lbl of labels) {
    const text = (lbl.textContent || '').trim();
    if (!options.labelPattern.test(text)) continue;

    // A. Check htmlFor
    if (lbl instanceof HTMLLabelElement && lbl.htmlFor) {
      const doc = root.ownerDocument || (root instanceof Document ? root : document);
      const target = doc.getElementById(lbl.htmlFor);
      if (target) {
        if (target.matches(interactiveSelector)) return target;
        const child = target.querySelector<HTMLElement>(interactiveSelector);
        if (child) return child;
      }
    }

    // B. Check aria-labelledby
    if (lbl.id) {
      const target = root.querySelector<HTMLElement>(`[aria-labelledby~="${CSS.escape(lbl.id)}"]`);
      if (target) {
        if (target.matches(interactiveSelector)) return target;
        const child = target.querySelector<HTMLElement>(interactiveSelector);
        if (child) return child;
      }
    }

    // C. Walk up parent hierarchy (without matching generic div in closest)
    let curr: HTMLElement | null = lbl.parentElement;
    let depth = 0;
    while (curr && curr !== root && depth < 6) {
      const autoId = curr.getAttribute('data-automation-id') || '';
      const cls = curr.className || '';
      const isFormField =
        /formField/i.test(autoId) ||
        /form-field|formField/i.test(cls) ||
        curr.tagName.toLowerCase() === 'fieldset';

      const trigger = curr.querySelector<HTMLElement>(interactiveSelector);
      if (trigger && (isFormField || depth >= 1)) {
        return trigger;
      }

      if (curr.nextElementSibling && !curr.nextElementSibling.querySelector('label, legend')) {
        const siblingTrigger = curr.nextElementSibling.querySelector<HTMLElement>(interactiveSelector);
        if (siblingTrigger) return siblingTrigger;
        if (curr.nextElementSibling instanceof HTMLElement && curr.nextElementSibling.matches(interactiveSelector)) {
          return curr.nextElementSibling;
        }
      }

      curr = curr.parentElement;
      depth++;
    }
  }

  // 3. Fallback: partial automation ID match (excluding region when matching country)
  for (const id of options.automationIds) {
    if (id.length < 5) continue;
    const idLower = id.toLowerCase();
    const el = root.querySelector<HTMLElement>(`[data-automation-id*="${idLower}" i]`);
    if (el) {
      if (idLower === 'country' && el.getAttribute('data-automation-id')?.toLowerCase().includes('region')) {
        continue;
      }
      if (el.matches(interactiveSelector)) return el;
      const child = el.querySelector<HTMLElement>(interactiveSelector);
      if (child) return child;
      return el;
    }
  }

  return null;
}

/**
 * Extracts visible or semantic label text for a Workday form element (handles sibling/for labels, aria-labels, value).
 */
export function getWorkdayElementLabel(el: HTMLElement): string {
  if (el.id) {
    const doc = el.ownerDocument || document;
    try {
      const forLabel = doc.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`);
      if (forLabel?.textContent?.trim()) return forLabel.textContent.trim();
    } catch {}
  }
  const closestLabel = el.closest('label');
  if (closestLabel?.textContent?.trim()) return closestLabel.textContent.trim();

  const parentLabel = el.parentElement?.querySelector('label') || el.parentElement?.parentElement?.querySelector('label');
  if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  if (el instanceof HTMLInputElement && el.value) {
    if (el.value.toLowerCase() === 'true') return 'Yes';
    if (el.value.toLowerCase() === 'false') return 'No';
    return el.value;
  }

  return el.textContent?.trim() || '';
}

/**
 * Selects a Workday radio button reliably by setting checked state and clicking its associated label.
 */
export function selectWorkdayRadio(radio: HTMLElement): void {
  if (radio instanceof HTMLInputElement) {
    setCheckboxOrRadio(radio, true);
  }
  if (radio.id) {
    const doc = radio.ownerDocument || document;
    try {
      const label = doc.querySelector<HTMLElement>(`label[for="${CSS.escape(radio.id)}"]`);
      if (label) {
        simulateClick(label);
        return;
      }
    } catch {}
  }
  const closestLabel = radio.closest('label');
  if (closestLabel) {
    simulateClick(closestLabel);
    return;
  }
  simulateClick(radio);
}

/**
 * Helper to locate a radio group or boolean question in Workday by question pattern.
 */
export function findWorkdayRadioGroup(
  root: Document | HTMLElement,
  questionPattern: RegExp
): { container: HTMLElement; radios: HTMLElement[] } | null {
  // 1. Group radios by their name attribute
  const radioInputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  const groupedByName = new Map<string, HTMLInputElement[]>();
  for (const r of radioInputs) {
    const name = r.name || r.id;
    if (!name) continue;
    if (!groupedByName.has(name)) groupedByName.set(name, []);
    groupedByName.get(name)!.push(r);
  }

  for (const [name, radios] of groupedByName.entries()) {
    if (radios.length >= 2) {
      const container =
        radios[0].closest<HTMLElement>(
          'fieldset, [role="radiogroup"], [data-automation-id*="formField" i], [class*="form-field" i]'
        ) || (radios[0].parentElement?.parentElement as HTMLElement) || radios[0];

      const questionText = [
        name,
        container.querySelector('legend, label, h2, h3, h4, p, [id*="label" i]')?.textContent || '',
        container.getAttribute('aria-label') || '',
        container.getAttribute('data-automation-id') || '',
      ].join(' ');

      if (questionPattern.test(questionText)) {
        return { container, radios };
      }
    }
  }

  // 2. Fallback: inspect fieldsets and radiogroup containers
  const containers = Array.from(
    root.querySelectorAll<HTMLElement>(
      'fieldset, [role="radiogroup"], [data-automation-id*="formField" i], [class*="formField" i], [class*="form-field" i]'
    )
  );

  for (const container of containers) {
    const radios = Array.from(
      container.querySelectorAll<HTMLElement>('input[type="radio"], [role="radio"], button[role="radio"]')
    );
    if (radios.length >= 2) {
      const headerText =
        container.querySelector('legend, label, h2, h3, h4, p, [id*="label" i]')?.textContent ||
        container.textContent ||
        '';
      if (questionPattern.test(headerText)) {
        return { container, radios };
      }
    }
  }

  return null;
}

/**
 * Helper to locate a distinct section container (e.g. Work Experience or Education).
 */
export function findWorkdaySection(
  root: Document | HTMLElement,
  headingPattern: RegExp,
  automationKeyword: string
): HTMLElement {
  // 1. Direct automation ID matching
  const autoIdEl = root.querySelector<HTMLElement>(
    `[data-automation-id*="${automationKeyword}Section" i], [data-automation-id*="${automationKeyword}" i]`
  );
  if (autoIdEl && autoIdEl.querySelectorAll('input, button, [role="button"]').length > 0) {
    return autoIdEl;
  }

  // 2. Heading boundary matching
  const headings = Array.from(
    root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, legend, [class*="heading" i], [class*="title" i]')
  );
  for (const h of headings) {
    const text = (h.textContent || '').trim();
    if (headingPattern.test(text)) {
      let curr: HTMLElement | null = h.parentElement;
      while (curr && curr !== root && curr !== document.body) {
        const autoId = curr.getAttribute('data-automation-id') || '';
        if (autoId.toLowerCase().includes(automationKeyword.toLowerCase())) {
          return curr;
        }
        // If container encloses multiple major sections, stay at the more specific level
        const textLower = (curr.textContent || '').toLowerCase();
        if (textLower.includes('work experience') && textLower.includes('education') && curr !== h.parentElement) {
          return h.parentElement || h;
        }
        if (curr.tagName.toLowerCase() === 'section' || curr.tagName.toLowerCase() === 'fieldset') {
          return curr;
        }
        curr = curr.parentElement;
      }
      return h.parentElement || h;
    }
  }

  return (root instanceof HTMLElement ? root : (root.body || root)) as HTMLElement;
}

/**
 * Helper to find a container section matching a heading pattern.
 */
export function findSectionByHeading(
  root: Document | HTMLElement,
  headingPattern: RegExp
): HTMLElement | null {
  const headings = Array.from(
    root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, legend, [class*="heading"], [class*="title"]')
  );

  for (const h of headings) {
    const text = (h.textContent || '').trim();
    if (headingPattern.test(text)) {
      let container: HTMLElement | null = h.parentElement;
      while (container && container !== root && container !== document.body) {
        const autoId = container.getAttribute('data-automation-id') || '';
        const tagName = container.tagName.toLowerCase();
        if (
          tagName === 'section' ||
          tagName === 'fieldset' ||
          autoId.toLowerCase().includes('section') ||
          container.classList.contains('form-section')
        ) {
          return container;
        }
        if (container.parentElement && container.parentElement.querySelectorAll('h2, h3').length > 1) {
          return container;
        }
        container = container.parentElement;
      }
      return h.parentElement || h;
    }
  }

  return null;
}

/**
 * Parses date string into separate month, year, and formatted string.
 */
export function parseWorkdayMonthYear(val?: string): { month: string; year: string; formatted: string } {
  if (!val) return { month: '', year: '', formatted: '' };
  const trimmed = val.trim();
  if (!trimmed) return { month: '', year: '', formatted: '' };

  let month = '';
  let year = '';

  const mmyyyy = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmyyyy) {
    month = mmyyyy[1].padStart(2, '0');
    year = mmyyyy[2];
  }

  const yyyymm = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (yyyymm) {
    month = yyyymm[2].padStart(2, '0');
    year = yyyymm[1];
  }

  const mmyyyyDash = trimmed.match(/^(\d{1,2})-(\d{4})$/);
  if (mmyyyyDash) {
    month = mmyyyyDash[1].padStart(2, '0');
    year = mmyyyyDash[2];
  }

  if (/^\d{4}$/.test(trimmed)) {
    month = '01';
    year = trimmed;
  }

  const monthMap: Record<string, string> = {
    jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
    apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
    aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10', october: '10',
    nov: '11', november: '11', dec: '12', december: '12',
  };
  const namedMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (namedMatch) {
    const mKey = namedMatch[1].toLowerCase();
    if (monthMap[mKey]) {
      month = monthMap[mKey];
      year = namedMatch[2];
    }
  }

  const formatted = month && year ? `${month}/${year}` : trimmed;
  return { month, year, formatted };
}

/**
 * Formats date string into Workday-compatible MM/YYYY format (e.g., '06/2023').
 */
export function formatWorkdayMonthYear(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed) return '';

  // MM/YYYY (e.g. "06/2023" or "6/2023")
  const mmyyyy = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmyyyy) {
    const m = mmyyyy[1].padStart(2, '0');
    return `${m}/${mmyyyy[2]}`;
  }

  // YYYY-MM (e.g. "2023-06" or "2023-6")
  const yyyymm = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (yyyymm) {
    const m = yyyymm[2].padStart(2, '0');
    return `${m}/${yyyymm[1]}`;
  }

  // MM-YYYY
  const mmyyyyDash = trimmed.match(/^(\d{1,2})-(\d{4})$/);
  if (mmyyyyDash) {
    const m = mmyyyyDash[1].padStart(2, '0');
    return `${m}/${mmyyyyDash[2]}`;
  }

  // MM/YY
  const mmyy = trimmed.match(/^(\d{1,2})\/(\d{2})$/);
  if (mmyy) {
    const m = mmyy[1].padStart(2, '0');
    const yr = parseInt(mmyy[2], 10) > 50 ? `19${mmyy[2]}` : `20${mmyy[2]}`;
    return `${m}/${yr}`;
  }

  // 4-digit year (e.g. "2023") -> default to "01/2023"
  if (/^\d{4}$/.test(trimmed)) {
    return `01/${trimmed}`;
  }

  // Month name and year (e.g. "June 2023", "Sep 2022")
  const monthMap: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };
  const namedMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (namedMatch) {
    const mKey = namedMatch[1].toLowerCase();
    if (monthMap[mKey]) {
      return `${monthMap[mKey]}/${namedMatch[2]}`;
    }
  }

  return trimmed;
}

/**
 * Fills Step 1: My Information.
 */
async function fillInformationStep(
  root: Document | HTMLElement,
  profile: CandidateProfile,
  report: AutofillReport,
  processed: Set<HTMLElement>
): Promise<void> {
  // 1. Country Combobox
  const countryTrigger = findWorkdayDropdown(root, {
    automationIds: ['countryDropdown', 'countryPrompt', 'country'],
    labelPattern: /^country\b/i,
  });
  if (countryTrigger && !processed.has(countryTrigger)) {
    processed.add(countryTrigger);
    report.totalFieldsFound++;
    let targetCountry = profile.personal.country || 'United States of America';
    if (/united states|usa|u\.s\b|us\b/i.test(targetCountry) && !/minor outlying/i.test(targetCountry)) {
      targetCountry = 'United States of America';
    }
    const prevCountry = (countryTrigger.textContent || '').trim();
    const success = await selectWorkdayComboboxOption(countryTrigger, targetCountry, 'country');
    if (success) {
      report.fieldsFilled++;
      const newCountry = (countryTrigger.textContent || '').trim();
      if (prevCountry && newCountry !== prevCountry) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    report.details.push({ semantic: 'country', label: 'Country', success });
  }

  // 2. Legal Name
  const firstName = findWorkdayInput(root, {
    automationIds: ['legalNameSection_firstName', 'firstName', 'givenName'],
    labelPattern: /\b(legal first name|first name|given name)\b/i,
  });
  if (firstName && !processed.has(firstName)) {
    processed.add(firstName);
    report.totalFieldsFound++;
    setInputValue(firstName, profile.personal.firstName);
    report.fieldsFilled++;
    report.details.push({ semantic: 'first_name', label: 'Legal First Name', success: true });
  }

  const lastName = findWorkdayInput(root, {
    automationIds: ['legalNameSection_lastName', 'lastName', 'familyName', 'surname'],
    labelPattern: /\b(legal last name|last name|family name|surname)\b/i,
  });
  if (lastName && !processed.has(lastName)) {
    processed.add(lastName);
    report.totalFieldsFound++;
    setInputValue(lastName, profile.personal.lastName);
    report.fieldsFilled++;
    report.details.push({ semantic: 'last_name', label: 'Legal Last Name', success: true });
  }

  // 3. Preferred Name Checkbox & Input
  if (profile.personal.preferredName) {
    const prefCheckbox = root.querySelector<HTMLInputElement>('[data-automation-id="preferredNameCheckbox"]');
    if (prefCheckbox && !prefCheckbox.checked) {
      setCheckboxOrRadio(prefCheckbox, true);
      await new Promise((r) => setTimeout(r, 100));
    }

    const prefFirstName = findWorkdayInput(root, {
      automationIds: ['preferredNameSection_firstName', 'preferredFirstName'],
      labelPattern: /\b(preferred first name|preferred name)\b/i,
    });
    if (prefFirstName && !processed.has(prefFirstName)) {
      processed.add(prefFirstName);
      report.totalFieldsFound++;
      setInputValue(prefFirstName, profile.personal.preferredName);
      report.fieldsFilled++;
      report.details.push({ semantic: 'first_name', label: 'Preferred First Name', success: true });
    }
  }

  // 4. Address Details
  const addr1 = findWorkdayInput(root, {
    automationIds: ['addressSection_addressLine1', 'addressLine1', 'address'],
    labelPattern: /\b(address line 1|street address|address)\b/i,
  });
  if (addr1 && profile.personal.address && !processed.has(addr1)) {
    processed.add(addr1);
    report.totalFieldsFound++;
    setInputValue(addr1, profile.personal.address);
    report.fieldsFilled++;
    report.details.push({ semantic: 'address', label: 'Address Line 1', success: true });
  }

  const city = findWorkdayInput(root, {
    automationIds: ['addressSection_city', 'city'],
    labelPattern: /\bcity\b/i,
  });
  if (city && profile.personal.city && !processed.has(city)) {
    processed.add(city);
    report.totalFieldsFound++;
    setInputValue(city, profile.personal.city);
    report.fieldsFilled++;
    report.details.push({ semantic: 'city', label: 'City', success: true });
  }

  // State / Province (Combobox, Select, or Input)
  const stateTrigger =
    root.querySelector<HTMLElement>(
      '#address--countryRegion, button[name="countryRegion"], [data-automation-id*="countryRegion" i] button'
    ) ||
    findWorkdayDropdown(root, {
      automationIds: [
        'countryRegion',
        'countryRegionDropdown',
        'address--countryRegion',
        'addressSection_countryRegionDropdown',
        'addressSection_regionDropdown',
        'addressSection_region',
        'addressSection_stateProvince',
        'addressSection_state',
        'stateDropdown',
        'regionDropdown',
        'region',
      ],
      labelPattern: /\b(state|province|state \/ province|region)\b/i,
    });
  if (stateTrigger && profile.personal.state && !processed.has(stateTrigger)) {
    processed.add(stateTrigger);
    report.totalFieldsFound++;
    const actualStateEl =
      stateTrigger.matches('button')
        ? stateTrigger
        : stateTrigger.querySelector<HTMLElement>('button') || stateTrigger;
    if (actualStateEl.tagName.toLowerCase() === 'input') {
      setInputValue(actualStateEl as HTMLInputElement, profile.personal.state);
      report.fieldsFilled++;
      report.details.push({ semantic: 'state', label: 'State / Province', success: true });
    } else {
      const rawState = profile.personal.state.trim();
      const lowerState = rawState.toLowerCase();
      const fullState = US_STATES[lowerState]
        ? US_STATES[lowerState].charAt(0).toUpperCase() + US_STATES[lowerState].slice(1)
        : rawState;
      const success = await selectWorkdayComboboxOption(actualStateEl, fullState, 'state');
      if (success) report.fieldsFilled++;
      report.details.push({ semantic: 'state', label: 'State / Province', success });
    }
  }

  const postal = findWorkdayInput(root, {
    automationIds: ['addressSection_postalCode', 'postalCode', 'zipCode', 'postal'],
    labelPattern: /\b(postal code|zip code|zip)\b/i,
  });
  if (postal && profile.personal.postalCode && !processed.has(postal)) {
    processed.add(postal);
    report.totalFieldsFound++;
    setInputValue(postal, profile.personal.postalCode);
    report.fieldsFilled++;
    report.details.push({ semantic: 'postal_code', label: 'Postal Code', success: true });
  }

  // 5. Phone Details
  // Phone Device Type (Always defaults to Mobile)
  const phoneDeviceTrigger =
    root.querySelector<HTMLElement>(
      '#phoneNumber--phoneType, button[name="phoneType"], [data-automation-id*="phoneType" i] button'
    ) ||
    findWorkdayDropdown(root, {
      automationIds: [
        'phoneType',
        'phoneTypeDropdown',
        'phoneNumber--phoneType',
        'phone-device-type',
        'phoneDeviceType',
        'phoneDevice',
        'phone-device',
        'deviceType',
        'device-type',
      ],
      labelPattern: /\b(phone device type|phone device|device type|phone type)\b/i,
    });
  if (phoneDeviceTrigger && !processed.has(phoneDeviceTrigger)) {
    processed.add(phoneDeviceTrigger);
    report.totalFieldsFound++;
    const actualPhoneEl =
      phoneDeviceTrigger.matches('button')
        ? phoneDeviceTrigger
        : phoneDeviceTrigger.querySelector<HTMLElement>('button') || phoneDeviceTrigger;
    const targetDevice = profile.personal.phoneDeviceType || 'Mobile';
    const success = await selectWorkdayComboboxOption(actualPhoneEl, targetDevice, 'phone_device_type');
    if (success) report.fieldsFilled++;
    report.details.push({ semantic: 'phone_device_type', label: 'Phone Device Type', success });
  }

  // Country Phone Code
  const phoneCodeTrigger =
    root.querySelector<HTMLElement>(
      '#phoneNumber--countryPhoneCode, [data-automation-id*="countryPhoneCode" i], input[id*="countryPhoneCode" i]'
    ) ||
    findWorkdayDropdown(root, {
      automationIds: [
        'countryPhoneCode',
        'phoneNumber--countryPhoneCode',
        'phoneCountryCode',
        'countryCode',
        'phone-country-code',
      ],
      labelPattern: /\b(country phone code|country code|dialing code)\b/i,
    });
  if (phoneCodeTrigger && !processed.has(phoneCodeTrigger)) {
    processed.add(phoneCodeTrigger);
    report.totalFieldsFound++;
    const targetCode = profile.personal.phoneCountryCode || '+1';
    const success = await selectWorkdayComboboxOption(phoneCodeTrigger, targetCode, 'phone_country_code');
    if (success) report.fieldsFilled++;
    report.details.push({ semantic: 'phone_country_code', label: 'Country Phone Code', success });
  }

  // Phone Number
  const phoneInput = findWorkdayInput(root, {
    automationIds: ['phone-number', 'phoneNumber', 'phone'],
    labelPattern: /\b(phone number|contact number|phone)\b/i,
  });
  if (phoneInput && profile.personal.phone && !processed.has(phoneInput)) {
    processed.add(phoneInput);
    report.totalFieldsFound++;
    setInputValue(phoneInput, profile.personal.phone);
    report.fieldsFilled++;
    report.details.push({ semantic: 'phone', label: 'Phone Number', success: true });
  }

  // Phone Extension - MUST be left blank
  const extInput = findWorkdayInput(root, {
    automationIds: ['phone-extension', 'phoneExtension', 'extension', 'ext'],
    labelPattern: /\b(phone extension|extension|extn|ext)\b/i,
  });
  if (extInput) {
    processed.add(extInput);
    if (extInput.value) {
      setInputValue(extInput, '');
    }
  }

  // 6. Email Address
  const emailInput = findWorkdayInput(root, {
    automationIds: ['email', 'emailAddress'],
    labelPattern: /\b(email|email address)\b/i,
  });
  if (emailInput && profile.personal.email && !processed.has(emailInput)) {
    processed.add(emailInput);
    report.totalFieldsFound++;
    setInputValue(emailInput, profile.personal.email);
    report.fieldsFilled++;
    report.details.push({ semantic: 'email', label: 'Email Address', success: true });
  }

  // 7. Source ("How Did You Hear About Us?")
  const sourceTrigger =
    root.querySelector<HTMLElement>(
      'input[id*="source" i], [data-automation-id="formField-source"] input, [data-automation-id="formField-source"]'
    ) ||
    findWorkdayDropdown(root, {
      automationIds: [
        'source',
        'sourcePrompt',
        'sourceDropdown',
        'howDidYouHear',
        'referralSource',
      ],
      labelPattern: /\b(how did you hear about us|how did you hear|source)\b/i,
    });
  if (sourceTrigger && !processed.has(sourceTrigger)) {
    processed.add(sourceTrigger);
    report.totalFieldsFound++;
    const targetSource = profile.source || 'LinkedIn';
    const success = await selectWorkdayComboboxOption(sourceTrigger, targetSource, 'source');
    if (success) report.fieldsFilled++;
    report.details.push({ semantic: 'source', label: 'Source', success });
  }

  // 8. Prior Employment / Contractor Questions (e.g., "Have you previously worked for Q2 Software Inc. or any of it's affiliates?")
  const priorWorkerGroup = findWorkdayRadioGroup(
    root,
    /previously worked|former employee|prior employee|previously been employed|ever worked for|ever been employed|previousWorker/i
  );
  if (priorWorkerGroup) {
    const { container, radios } = priorWorkerGroup;
    processed.add(container);
    radios.forEach((r) => processed.add(r));
    report.totalFieldsFound++;

    let targetChoice = 'no';
    if (profile.customQA) {
      const matchedQA = profile.customQA.find((qa) =>
        /previously worked|former employee|prior employee|previously been employed/i.test(qa.questionPattern)
      );
      if (matchedQA?.answer) {
        targetChoice = matchedQA.answer.toLowerCase().includes('yes') ? 'yes' : 'no';
      }
    }

    const { best } = findBestMatchingOption(
      radios,
      (r) => getWorkdayElementLabel(r),
      targetChoice,
      'custom_question'
    );

    if (best) {
      selectWorkdayRadio(best);
      report.fieldsFilled++;
      report.details.push({ semantic: 'custom_question', label: 'Prior Employment / Contractor', success: true });
    }
  }
}

/**
 * Fills Step 2: My Experience.
 */
/**
 * Fills Step 2: My Experience.
 */
async function fillExperienceStep(
  root: Document | HTMLElement,
  profile: CandidateProfile,
  report: AutofillReport,
  processed: Set<HTMLElement>
): Promise<void> {
  // 1. Resume File Upload
  await handleWorkdayResumeUpload(root, profile, report);

  // 2. Work Experience Section
  const expSection = findWorkdaySection(root, /\bwork experience\b/i, 'workExperience');

  const rawWorkHistory = profile.experience.workHistory;
  const workList: WorkExperienceItem[] =
    rawWorkHistory && rawWorkHistory.length > 0
      ? rawWorkHistory
      : [
          {
            id: 'work-1',
            jobTitle: profile.experience.currentTitle || '',
            company: profile.experience.currentCompany || '',
            location: profile.personal.city ? (profile.personal.state ? `${profile.personal.city}, ${profile.personal.state}` : profile.personal.city) : '',
            currentlyWorkHere: true,
            from: '',
            to: '',
            description: '',
          },
        ];

  // If first card isn't open yet, check for initial "Add" button
  let firstJobTitle =
    expSection.querySelector<HTMLInputElement>(
      'input[name="jobTitle"], input[id*="jobTitle" i], input[data-automation-id*="jobTitle" i]'
    ) ||
    findWorkdayInput(expSection, {
      automationIds: ['jobTitle', 'job-title', 'position'],
      labelPattern: /\b(job title|title|role)\b/i,
    });

  if (!firstJobTitle) {
    const addBtn = Array.from(expSection.querySelectorAll<HTMLButtonElement | HTMLElement>('button, [role="button"]')).find((b) => {
      const t = (b.textContent || '').trim().toLowerCase();
      return t === 'add' || t === 'add experience' || t === 'add work experience';
    });

    if (addBtn) {
      simulateClick(addBtn);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  // 2a. Pre-mount all necessary work experience cards BEFORE filling any fields!
  // In Workday, clicking "Add Another" after cards have values causes React to re-render the list,
  // wiping out earlier card inputs. Mounting all needed cards upfront prevents this reconciliation wipe.
  for (let i = 1; i < workList.length; i++) {
    const item = workList[i];
    if (!item.jobTitle && !item.company) continue;

    let currentJobInputs = Array.from(
      expSection.querySelectorAll<HTMLInputElement>(
        'input[name="jobTitle"], input[id*="jobTitle" i], input[data-automation-id*="jobTitle" i], input[data-automation-id*="title" i]'
      )
    );

    if (currentJobInputs.length <= i) {
      const addAnotherBtn = Array.from(expSection.querySelectorAll<HTMLElement>('button, [role="button"]')).find((b) => {
        const t = (b.textContent || '').trim().toLowerCase();
        return t === 'add another' || t === 'add work experience' || t === 'add';
      });
      if (addAnotherBtn) {
        simulateClick(addAnotherBtn);
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }

  // Retrieve all job inputs once all required cards are mounted
  const currentJobInputs = Array.from(
    expSection.querySelectorAll<HTMLInputElement>(
      'input[name="jobTitle"], input[id*="jobTitle" i], input[data-automation-id*="jobTitle" i], input[data-automation-id*="title" i]'
    )
  );

  // Iterate over work experiences
  for (let i = 0; i < workList.length; i++) {
    const item = workList[i];
    if (!item.jobTitle && !item.company && i > 0) continue;

    // Identify card container for index i that contains ONLY this card's jobInput
    const jobInput = currentJobInputs[i];
    let cardScope: HTMLElement | null = null;
    if (jobInput) {
      let curr: HTMLElement | null = jobInput.parentElement;
      while (curr && curr !== expSection && curr !== document.body) {
        const jobInputsInCurr = curr.querySelectorAll(
          'input[name="jobTitle"], input[id*="jobTitle" i], [data-automation-id="jobTitle"], input[id*="job-title" i]'
        );
        if (jobInputsInCurr.length === 1) {
          cardScope = curr;
        } else if (jobInputsInCurr.length > 1) {
          break;
        }
        curr = curr.parentElement;
      }
    }

    // Company
    const allCompanies = Array.from(
      expSection.querySelectorAll<HTMLInputElement>(
        'input[name="companyName"], input[id*="company" i], input[data-automation-id*="company" i], input[data-automation-id*="employer" i]'
      )
    );
    const companyInput =
      cardScope?.querySelector<HTMLInputElement>(
        'input[name="companyName"], input[id*="company" i], input[data-automation-id*="company" i]'
      ) || allCompanies[i];

    // Location
    const allLocations = Array.from(
      expSection.querySelectorAll<HTMLInputElement>(
        'input[name="location"], input[id*="location" i], input[data-automation-id*="location" i]'
      )
    );
    const locationInput =
      cardScope?.querySelector<HTMLInputElement>(
        'input[name="location"], input[id*="location" i], input[data-automation-id*="location" i]'
      ) || allLocations[i];

    // Currently Work Here Checkbox
    const allCheckboxes = Array.from(
      expSection.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    );
    const currentlyWorkCheckbox =
      cardScope?.querySelector<HTMLInputElement>(
        'input[type="checkbox"][name="currentlyWorkHere"], input[type="checkbox"][id*="currentlyWorkHere" i]'
      ) ||
      cardScope?.querySelector<HTMLInputElement>('input[type="checkbox"]') ||
      allCheckboxes[i];

    // Date inputs (handles Workday's split Month & Year inputs or single date input)
    const fromMonthInput = cardScope?.querySelector<HTMLInputElement>(
      'input[id*="startDate-dateSectionMonth" i], [data-automation-id*="startDate" i] input[data-automation-id="dateSectionMonth-input"], [data-automation-id*="startDate" i] [data-automation-id="dateSectionMonth-input"] input'
    );
    const fromYearInput = cardScope?.querySelector<HTMLInputElement>(
      'input[id*="startDate-dateSectionYear" i], [data-automation-id*="startDate" i] input[data-automation-id="dateSectionYear-input"], [data-automation-id*="startDate" i] [data-automation-id="dateSectionYear-input"] input'
    );
    const toMonthInput = cardScope?.querySelector<HTMLInputElement>(
      'input[id*="endDate-dateSectionMonth" i], [data-automation-id*="endDate" i] input[data-automation-id="dateSectionMonth-input"], [data-automation-id*="endDate" i] [data-automation-id="dateSectionMonth-input"] input'
    );
    const toYearInput = cardScope?.querySelector<HTMLInputElement>(
      'input[id*="endDate-dateSectionYear" i], [data-automation-id*="endDate" i] input[data-automation-id="dateSectionYear-input"], [data-automation-id*="endDate" i] [data-automation-id="dateSectionYear-input"] input'
    );
    const singleFromInput =
      cardScope?.querySelector<HTMLInputElement>(
        'input[data-automation-id*="startDate" i], input[id*="startDate" i], input[name*="startDate" i]'
      ) ||
      (cardScope ? Array.from(cardScope.querySelectorAll<HTMLInputElement>('input[placeholder*="MM" i], input[placeholder*="YYYY" i]'))[0] : null);
    const singleToInput =
      cardScope?.querySelector<HTMLInputElement>(
        'input[data-automation-id*="endDate" i], input[id*="endDate" i], input[name*="endDate" i]'
      ) ||
      (cardScope ? Array.from(cardScope.querySelectorAll<HTMLInputElement>('input[placeholder*="MM" i], input[placeholder*="YYYY" i]'))[1] : null);

    // Textarea
    const allTextareas = Array.from(
      expSection.querySelectorAll<HTMLTextAreaElement>(
        'textarea[id*="roleDescription" i], textarea[data-automation-id*="description" i], textarea[data-automation-id*="role" i], textarea'
      )
    );
    const descTextarea =
      cardScope?.querySelector<HTMLTextAreaElement>(
        'textarea[id*="roleDescription" i], textarea[data-automation-id*="description" i], textarea'
      ) || allTextareas[i];

    // Fill Card i
    if (jobInput) {
      processed.add(jobInput);
      if (item.jobTitle) {
        report.totalFieldsFound++;
        setInputValue(jobInput, item.jobTitle);
        report.fieldsFilled++;
        report.details.push({ semantic: 'current_title', label: `Work Experience ${i + 1} Job Title`, success: true });
      }
    }

    if (companyInput) {
      processed.add(companyInput);
      if (item.company) {
        report.totalFieldsFound++;
        setInputValue(companyInput, item.company);
        report.fieldsFilled++;
        report.details.push({ semantic: 'current_company', label: `Work Experience ${i + 1} Company`, success: true });
      }
    }

    const locVal = item.location || (profile.personal.city ? (profile.personal.state ? `${profile.personal.city}, ${profile.personal.state}` : profile.personal.city) : '');
    if (locationInput) {
      processed.add(locationInput);
      if (locVal) {
        report.totalFieldsFound++;
        setInputValue(locationInput, locVal);
        report.fieldsFilled++;
        report.details.push({ semantic: 'location', label: `Work Experience ${i + 1} Location`, success: true });
      }
    }

    if (currentlyWorkCheckbox) {
      processed.add(currentlyWorkCheckbox);
      report.totalFieldsFound++;
      setCheckboxOrRadio(currentlyWorkCheckbox, !!item.currentlyWorkHere);
      report.fieldsFilled++;
      report.details.push({ semantic: 'custom_question', label: `Work Experience ${i + 1} Currently Work Here`, success: true });
    }

    // Dates
    const parsedFrom = parseWorkdayMonthYear(item.from);
    if (fromMonthInput && fromYearInput) {
      processed.add(fromMonthInput);
      processed.add(fromYearInput);
      report.totalFieldsFound++;
      if (parsedFrom.month) setInputValue(fromMonthInput, parsedFrom.month);
      if (parsedFrom.year) setInputValue(fromYearInput, parsedFrom.year);
      report.fieldsFilled++;
      report.details.push({ semantic: 'custom_question', label: `Work Experience ${i + 1} From Date`, success: true });
    } else if (singleFromInput && parsedFrom.formatted) {
      processed.add(singleFromInput);
      report.totalFieldsFound++;
      setInputValue(singleFromInput, parsedFrom.formatted);
      report.fieldsFilled++;
      report.details.push({ semantic: 'custom_question', label: `Work Experience ${i + 1} From Date`, success: true });
    }

    if (!item.currentlyWorkHere && item.to) {
      const parsedTo = parseWorkdayMonthYear(item.to);
      if (toMonthInput && toYearInput) {
        processed.add(toMonthInput);
        processed.add(toYearInput);
        report.totalFieldsFound++;
        if (parsedTo.month) setInputValue(toMonthInput, parsedTo.month);
        if (parsedTo.year) setInputValue(toYearInput, parsedTo.year);
        report.fieldsFilled++;
        report.details.push({ semantic: 'custom_question', label: `Work Experience ${i + 1} To Date`, success: true });
      } else if (singleToInput && parsedTo.formatted) {
        processed.add(singleToInput);
        report.totalFieldsFound++;
        setInputValue(singleToInput, parsedTo.formatted);
        report.fieldsFilled++;
        report.details.push({ semantic: 'custom_question', label: `Work Experience ${i + 1} To Date`, success: true });
      }
    }

    if (descTextarea) {
      processed.add(descTextarea);
      if (item.description) {
        report.totalFieldsFound++;
        setInputValue(descTextarea, item.description);
        report.fieldsFilled++;
        report.details.push({ semantic: 'custom_question', label: `Work Experience ${i + 1} Role Description`, success: true });
      }
    }
  }

  // 3. Education Section
  const eduSection = findWorkdaySection(root, /\beducation\b/i, 'education');

  const rawEduHistory = profile.experience.educationHistory;
  const primaryEdu =
    rawEduHistory && rawEduHistory.length > 0
      ? rawEduHistory[0]
      : {
          id: 'edu-1',
          school: profile.experience.school || '',
          degree: profile.experience.degree || profile.experience.highestDegree || 'Bachelor of Science',
          discipline: profile.experience.discipline || 'Computer Science',
          gpa: profile.experience.gpa || '',
          from: '',
          to: profile.experience.graduationYear || '2028',
        };

  // Pre-check if first Education card is open; if not, click "Add"
  let firstSchoolEl =
    eduSection.querySelector<HTMLInputElement>(
      'input[id*="schoolName" i], input[name="schoolName"], input[data-automation-id*="school" i]'
    ) ||
    root.querySelector<HTMLInputElement>(
      'input[id*="schoolName" i], input[name="schoolName"], input[data-automation-id*="school" i]'
    ) ||
    findWorkdayInput(eduSection, {
      automationIds: ['school', 'schoolName', 'school-name', 'formField-school'],
      labelPattern: /\b(school or university|school|university|institution)\b/i,
    });

  if (!firstSchoolEl) {
    const eduHeading = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, legend, [class*="heading" i]')).find((h) =>
      /\beducation\b/i.test(h.textContent || '')
    );
    let addBtn: HTMLElement | null = null;
    if (eduHeading) {
      const allButtons = Array.from(root.querySelectorAll<HTMLElement>('[data-automation-id="add-button"], button'));
      addBtn = allButtons.find((b) => {
        const t = (b.textContent || '').trim().toLowerCase();
        if (t !== 'add' && t !== 'add education') return false;
        return !!(eduHeading.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      }) || null;
    }
    if (!addBtn) {
      addBtn = Array.from(eduSection.querySelectorAll<HTMLButtonElement | HTMLElement>('button, [role="button"]')).find((b) => {
        const t = (b.textContent || '').trim().toLowerCase();
        return t === 'add' || t === 'add education';
      }) || null;
    }

    if (addBtn) {
      simulateClick(addBtn);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // School / University
  const schoolEl =
    eduSection.querySelector<HTMLInputElement>('input[id*="schoolName" i], input[name="schoolName"]') ||
    root.querySelector<HTMLInputElement>('input[id*="schoolName" i], input[name="schoolName"]') ||
    findWorkdayInput(eduSection, {
      automationIds: ['school', 'schoolName', 'school-name', 'formField-school'],
      labelPattern: /\b(school or university|school|university|institution)\b/i,
    });

  if (schoolEl && primaryEdu.school && !processed.has(schoolEl)) {
    processed.add(schoolEl);
    report.totalFieldsFound++;
    setInputValue(schoolEl as HTMLInputElement, primaryEdu.school);
    report.fieldsFilled++;
    report.details.push({ semantic: 'school', label: 'School / University', success: true });
  }

  // Degree
  const degreeTrigger =
    eduSection.querySelector<HTMLElement>(
      'button[name="degree"], button[id*="--degree" i], [data-automation-id="formField-degree"] button, button[id*="degree" i], [data-automation-id*="degree" i] button'
    ) ||
    root.querySelector<HTMLElement>(
      'button[name="degree"], button[id*="--degree" i]'
    ) ||
    findWorkdayDropdown(eduSection, {
      automationIds: ['degree', 'degreeDropdown', 'formField-degree'],
      labelPattern: /\bdegree\b/i,
    }) ||
    findWorkdayInput(eduSection, {
      automationIds: ['degree', 'degreeInput', 'formField-degree'],
      labelPattern: /\bdegree\b/i,
    });

  if (degreeTrigger && (primaryEdu.degree || profile.experience.highestDegree) && !processed.has(degreeTrigger)) {
    processed.add(degreeTrigger);
    report.totalFieldsFound++;
    const targetDegree = primaryEdu.degree || profile.experience.highestDegree || 'Bachelor of Science';
    const actualDegreeEl = degreeTrigger.matches('button')
      ? degreeTrigger
      : degreeTrigger.querySelector<HTMLElement>('button') || degreeTrigger;
    const success = await selectWorkdayComboboxOption(actualDegreeEl, targetDegree, 'degree');
    if (success) report.fieldsFilled++;
    report.details.push({ semantic: 'degree', label: 'Degree', success });
  }

  // Field of Study (multiselect container with search input and prompt options)
  const fosContainer =
    eduSection.querySelector<HTMLElement>(
      '[data-automation-id="formField-fieldOfStudy"], [data-fkit-id*="fieldOfStudy" i]'
    ) ||
    root.querySelector<HTMLElement>('[data-automation-id="formField-fieldOfStudy"]') ||
    eduSection;

  const targetDiscipline = primaryEdu.discipline || profile.experience.discipline || 'Computer Science';
  const existingPill = (fosContainer !== eduSection ? fosContainer : root).querySelector('[data-automation-id="selectedItem"], [id*="pill-"]');

  if (existingPill) {
    report.totalFieldsFound++;
    report.fieldsFilled++;
    report.details.push({ semantic: 'custom_question', label: 'Field of Study (Already Selected)', success: true });
  } else if (targetDiscipline) {
    const fosInput =
      eduSection.querySelector<HTMLInputElement>(
        'input[id*="fieldOfStudy" i], input[data-automation-id="searchBox"], input[placeholder*="Search" i]'
      ) ||
      root.querySelector<HTMLInputElement>(
        'input[id*="fieldOfStudy" i]'
      ) ||
      findWorkdayInput(fosContainer, {
        automationIds: ['fieldOfStudy', 'field-of-study', 'discipline', 'major'],
        labelPattern: /\b(field of study|major|discipline|program)\b/i,
      });

    const fosTrigger =
      eduSection.querySelector<HTMLElement>(
        'button[data-automation-id*="field" i], [data-automation-id*="field-of-study" i], button[id*="fieldOfStudy" i], button[name*="fieldOfStudy" i]'
      ) ||
      root.querySelector<HTMLElement>(
        'button[data-automation-id*="field" i], [data-automation-id*="field-of-study" i]'
      ) ||
      findWorkdayDropdown(eduSection, {
        automationIds: ['fieldOfStudy', 'field-of-study', 'formField-fieldOfStudy'],
        labelPattern: /\b(field of study|major|discipline)\b/i,
      });

    if (fosInput && !processed.has(fosInput)) {
      processed.add(fosInput);
      report.totalFieldsFound++;
      let success = await selectWorkdaySearchPrompt(fosInput, targetDiscipline, 'discipline');
      if (!success) {
        setInputValue(fosInput, targetDiscipline);
        success = true;
      }
      if (success) report.fieldsFilled++;
      report.details.push({ semantic: 'custom_question', label: 'Field of Study', success });
    } else if (fosTrigger && !processed.has(fosTrigger)) {
      processed.add(fosTrigger);
      report.totalFieldsFound++;
      const success = await selectWorkdayComboboxOption(fosTrigger, targetDiscipline, 'discipline');
      if (success) report.fieldsFilled++;
      report.details.push({ semantic: 'custom_question', label: 'Field of Study', success });
    }
  }

  // Overall Result (GPA)
  const gpaInput =
    eduSection.querySelector<HTMLInputElement>('input[id*="gradeAverage" i], input[data-automation-id*="gpa" i], input[name="gradeAverage"]') ||
    root.querySelector<HTMLInputElement>('input[id*="gradeAverage" i], input[name="gradeAverage"]') ||
    findWorkdayInput(eduSection, {
      automationIds: ['gpa', 'overallResult', 'gradePointAverage', 'gradeAverage', 'formField-gpa'],
      labelPattern: /\b(overall result|gpa|grade point average)\b/i,
    });

  if (gpaInput && (primaryEdu.gpa || profile.experience.gpa) && !processed.has(gpaInput)) {
    processed.add(gpaInput);
    report.totalFieldsFound++;
    setInputValue(gpaInput, primaryEdu.gpa || profile.experience.gpa || '');
    report.fieldsFilled++;
    report.details.push({ semantic: 'custom_question', label: 'Overall Result (GPA)', success: true });
  }

  // Education Dates (From & To)
  const gradYear = parseInt(primaryEdu.to || profile.experience.graduationYear || '2028', 10);
  const fromYearStr = primaryEdu.from || (isNaN(gradYear) ? '2024' : (gradYear - 4).toString());
  const toYearStr = primaryEdu.to || profile.experience.graduationYear || '2028';

  const eduFromInput =
    eduSection.querySelector<HTMLInputElement>('input[id*="firstYearAttended" i], [data-automation-id*="firstYearAttended" i] input, input[data-automation-id*="firstYearAttended" i]') ||
    root.querySelector<HTMLInputElement>('input[id*="firstYearAttended" i]') ||
    findWorkdayInput(eduSection, {
      automationIds: ['firstYearAttended', 'attendedFrom', 'educationStartDate', 'startDate'],
      labelPattern: /^(from|first year|start year)\b/i,
    });

  const eduToInput =
    eduSection.querySelector<HTMLInputElement>('input[id*="lastYearAttended" i], [data-automation-id*="lastYearAttended" i] input, input[data-automation-id*="lastYearAttended" i]') ||
    root.querySelector<HTMLInputElement>('input[id*="lastYearAttended" i]') ||
    findWorkdayInput(eduSection, {
      automationIds: ['lastYearAttended', 'attendedTo', 'educationEndDate', 'expectedGraduation', 'endDate'],
      labelPattern: /\b(to \(actual or expected\)|actual or expected|expected graduation|last year|to)\b/i,
    });

  if (eduFromInput && !processed.has(eduFromInput)) {
    processed.add(eduFromInput);
    report.totalFieldsFound++;
    setInputValue(eduFromInput, fromYearStr);
    report.fieldsFilled++;
    report.details.push({ semantic: 'graduation_date', label: 'Education From Year', success: true });
  }

  if (eduToInput && !processed.has(eduToInput)) {
    processed.add(eduToInput);
    report.totalFieldsFound++;
    setInputValue(eduToInput, toYearStr);
    report.fieldsFilled++;
    report.details.push({ semantic: 'graduation_date', label: 'Education To Year', success: true });
  }

  // 4. Websites & Links
  const linkedinInput =
    root.querySelector<HTMLInputElement>('input[id*="linkedInAccount" i], input[name="linkedInAccount"]') ||
    findWorkdayInput(root, {
      automationIds: ['linkedin', 'linkedIn', 'linkedinUrl', 'socialNetworkAccounts--linkedInAccount'],
      labelPattern: /\blinkedin\b/i,
    });

  if (linkedinInput && profile.links.linkedin && !processed.has(linkedinInput)) {
    processed.add(linkedinInput);
    report.totalFieldsFound++;
    setInputValue(linkedinInput, profile.links.linkedin);
    report.fieldsFilled++;
    report.details.push({ semantic: 'linkedin', label: 'LinkedIn Profile', success: true });
  }

  const websiteInput = findWorkdayInput(root, {
    automationIds: ['website', 'portfolio', 'personalWebsite'],
    labelPattern: /\b(website|portfolio)\b/i,
  });
  if (websiteInput && (profile.links.portfolio || profile.links.github) && !processed.has(websiteInput)) {
    processed.add(websiteInput);
    report.totalFieldsFound++;
    setInputValue(websiteInput, profile.links.portfolio || profile.links.github);
    report.fieldsFilled++;
    report.details.push({ semantic: 'portfolio', label: 'Website / Portfolio', success: true });
  }

  // Shield all inputs inside expSection and eduSection so Universal Fallback never touches them
  if (expSection !== root) {
    expSection.querySelectorAll('input, select, textarea').forEach((el) => processed.add(el as HTMLElement));
  }
  if (eduSection !== root) {
    eduSection.querySelectorAll('input, select, textarea').forEach((el) => processed.add(el as HTMLElement));
  }
}

/**
 * Helper to select an option in a Workday questionnaire button dropdown.
 */
async function selectWorkdayQuestionnaireButton(btn: HTMLElement, targetText: string): Promise<boolean> {
  const currentVal = (btn.textContent || '').trim().toLowerCase();
  const targetLower = targetText.toLowerCase();
  if (currentVal === targetLower) return true;

  btn.focus();
  fireClick(btn);
  await new Promise((r) => setTimeout(r, 350));

  const ariaControls = btn.getAttribute('aria-controls');
  let listbox: HTMLElement | null = ariaControls ? document.getElementById(ariaControls) : null;
  if (!listbox) {
    const listboxes = Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"], ul[role="listbox"]'));
    listbox = listboxes[listboxes.length - 1] || null;
  }

  if (listbox) {
    const options = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"], li'));
    const matchOpt = options.find((opt) => (opt.textContent || '').trim().toLowerCase() === targetLower);
    if (matchOpt) {
      fireClick(matchOpt);
      await new Promise((r) => setTimeout(r, 200));
      return true;
    }
  }
  return false;
}

/**
 * Fills Step 3: Application Questions.
 */
async function fillQuestionsStep(
  root: Document | HTMLElement,
  profile: CandidateProfile,
  report: AutofillReport,
  processed: Set<HTMLElement>
): Promise<void> {
  // 1. Scan questionnaire dropdown buttons
  const questionButtons = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button[id*="Questionnaire" i], button[aria-haspopup="listbox"], [data-automation-id*="formField"] button'
    )
  );

  for (const btn of questionButtons) {
    if (processed.has(btn)) continue;
    const btnAutoId = btn.getAttribute('data-automation-id') || '';
    if (btnAutoId.includes('pageFooter') || btnAutoId.includes('utilityMenu') || btnAutoId.includes('hammyMenu')) continue;

    const container =
      btn.closest<HTMLElement>('[data-automation-id*="formField" i], fieldset') ||
      btn.parentElement?.parentElement?.parentElement ||
      btn.parentElement;

    const labelText = [
      btn.getAttribute('aria-label') || '',
      container?.querySelector('label, legend, h2, h3, h4, p, [id*="rich-label" i]')?.textContent || '',
      container?.textContent || '',
    ].join(' ').toLowerCase();

    let targetAnswer: string | null = null;
    let semantic: FieldSemantic = 'custom_question';

    if (
      labelText.includes('authorized to work') ||
      labelText.includes('lawfully authorized') ||
      labelText.includes('lawful permanent resident')
    ) {
      targetAnswer = profile.workAuth.authorizedInUS === 'no' ? 'No' : 'Yes';
      semantic = 'work_authorized';
    } else if (
      labelText.includes('require visa sponsorship') ||
      labelText.includes('visa sponsorship') ||
      labelText.includes('sponsorship for employment') ||
      labelText.includes('require sponsorship')
    ) {
      targetAnswer = profile.workAuth.requiresSponsorship === 'yes' ? 'Yes' : 'No';
      semantic = 'visa_sponsorship';
    } else if (
      labelText.includes('18 years of age') ||
      labelText.includes('at least 18') ||
      labelText.includes('are you 18')
    ) {
      targetAnswer = 'Yes';
      semantic = 'custom_question';
    } else if (
      labelText.includes('referred to this position') ||
      labelText.includes('referred by a') ||
      labelText.includes('referred by an employee')
    ) {
      targetAnswer = 'No';
      semantic = 'custom_question';
    } else if (
      labelText.includes('anti-nepotism') ||
      labelText.includes('family or close personal relationship')
    ) {
      targetAnswer = 'No';
      semantic = 'custom_question';
    } else if (
      labelText.includes('customer or partner') ||
      labelText.includes('employed by a')
    ) {
      targetAnswer = 'No';
      semantic = 'custom_question';
    } else if (
      labelText.includes('ernst & young') ||
      labelText.includes('partner level') ||
      labelText.includes('accounting firm')
    ) {
      targetAnswer = 'No';
      semantic = 'custom_question';
    } else if (
      labelText.includes('restrictive covenants') ||
      labelText.includes('non-compete')
    ) {
      targetAnswer = 'No';
      semantic = 'custom_question';
    } else if (
      labelText.includes('felony') ||
      labelText.includes('convicted') ||
      labelText.includes('criminal record')
    ) {
      targetAnswer = 'No';
      semantic = 'custom_question';
    } else if (
      labelText.includes('relocate') ||
      labelText.includes('relocation') ||
      labelText.includes('willing to relocate')
    ) {
      targetAnswer = 'Yes';
      semantic = 'relocation';
    } else if (
      labelText.includes('work from the office') ||
      labelText.includes('in-office') ||
      labelText.includes('on-site') ||
      labelText.includes('onsite') ||
      labelText.includes('hybrid')
    ) {
      targetAnswer = 'Yes';
      semantic = 'office_commitment';
    } else if (
      labelText.includes('drug screen') ||
      labelText.includes('drug test') ||
      labelText.includes('substance abuse')
    ) {
      targetAnswer = 'Yes';
      semantic = 'custom_question';
    } else if (
      labelText.includes('background check') ||
      labelText.includes('background investigation')
    ) {
      targetAnswer = 'Yes';
      semantic = 'custom_question';
    } else if (
      labelText.includes('willing to travel') ||
      labelText.includes('travel requirement')
    ) {
      targetAnswer = 'Yes';
      semantic = 'custom_question';
    } else {
      const matchedQA = profile.customQA?.find((qa) => {
        try {
          return new RegExp(qa.questionPattern, 'i').test(labelText);
        } catch {
          return labelText.includes(qa.questionPattern.toLowerCase());
        }
      });
      if (matchedQA?.answer) {
        targetAnswer = matchedQA.answer;
      }
    }

    if (targetAnswer) {
      processed.add(btn);
      report.totalFieldsFound++;
      const success = await selectWorkdayQuestionnaireButton(btn, targetAnswer);
      if (success) {
        report.fieldsFilled++;
        report.details.push({ semantic, label: labelText.slice(0, 50), success: true });
      }
    }
  }

  // 2. Scan text inputs & textareas (Salary, notice period/start date, custom QA)
  const textEntries = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="file"]):not([type="radio"]):not([type="checkbox"]):not([disabled]), textarea'
    )
  );

  for (const input of textEntries) {
    if (processed.has(input)) continue;
    const container =
      input.closest<HTMLElement>('[data-automation-id*="formField" i], fieldset') ||
      input.parentElement?.parentElement ||
      input.parentElement;

    const labelText = [
      input.getAttribute('aria-label') || '',
      input.placeholder || '',
      container?.querySelector('label, legend, h2, h3, h4, p, [id*="rich-label" i]')?.textContent || '',
      document.querySelector(`label[for="${input.id}"]`)?.textContent || '',
    ].join(' ').toLowerCase();

    // Desired salary
    if (
      labelText.includes('desired annual salary') ||
      labelText.includes('desired salary') ||
      labelText.includes('compensation expectations')
    ) {
      processed.add(input);
      report.totalFieldsFound++;
      const val = profile.customQA?.find((q) => /salary|compensation/i.test(q.questionPattern))?.answer || '100000';
      setInputValue(input, val);
      report.fieldsFilled++;
      report.details.push({ semantic: 'salary', label: 'Desired Salary', success: true });
      continue;
    }

    // Start date / notice period
    if (
      labelText.includes('time would you need before you’re able to start') ||
      labelText.includes('notice period') ||
      labelText.includes('how soon can you start') ||
      labelText.includes('earliest start date')
    ) {
      processed.add(input);
      report.totalFieldsFound++;
      const val = profile.workAuth.earliestStartDate || profile.workAuth.noticePeriod || '2 weeks';
      setInputValue(input, val);
      report.fieldsFilled++;
      report.details.push({ semantic: 'start_date', label: 'Start Date / Notice Period', success: true });
      continue;
    }

    // Custom QA
    if (profile.customQA && profile.customQA.length > 0) {
      const matchedQA = profile.customQA.find((qa) => {
        try {
          return new RegExp(qa.questionPattern, 'i').test(labelText);
        } catch {
          return labelText.includes(qa.questionPattern.toLowerCase());
        }
      });
      if (matchedQA?.answer) {
        processed.add(input);
        report.totalFieldsFound++;
        setInputValue(input, matchedQA.answer);
        report.fieldsFilled++;
        report.details.push({ semantic: 'custom_question', label: labelText.slice(0, 50), success: true });
        continue;
      }
    }
  }

  // 3. Scan radio questions (for forms using native radio groups)
  const fieldEntries = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-automation-id*="formField"], [class*="form-field"], fieldset, [role="radiogroup"]'
    )
  );

  for (const entry of fieldEntries) {
    if (processed.has(entry)) continue;
    const text = (entry.textContent || '').toLowerCase();

    if (
      text.includes('legally authorized to work') ||
      text.includes('authorized to work in the united states') ||
      text.includes('lawful permanent resident')
    ) {
      processed.add(entry);
      report.totalFieldsFound++;
      const targetVal = profile.workAuth.authorizedInUS === 'yes' ? 'yes' : 'no';
      const radios = Array.from(entry.querySelectorAll<HTMLElement>('input[type="radio"], button, [role="radio"]'));
      const { best } = findBestMatchingOption(radios, (r) => getWorkdayElementLabel(r), targetVal, 'work_authorized');
      if (best) {
        selectWorkdayRadio(best);
        report.fieldsFilled++;
        report.details.push({ semantic: 'work_authorized', label: 'Work Authorization', success: true });
      }
      continue;
    }

    if (text.includes('require sponsorship') || text.includes('visa sponsorship') || text.includes('employment visa status')) {
      processed.add(entry);
      report.totalFieldsFound++;
      const targetVal = profile.workAuth.requiresSponsorship === 'yes' ? 'yes' : 'no';
      const radios = Array.from(entry.querySelectorAll<HTMLElement>('input[type="radio"], button, [role="radio"]'));
      const { best } = findBestMatchingOption(radios, (r) => getWorkdayElementLabel(r), targetVal, 'visa_sponsorship');
      if (best) {
        selectWorkdayRadio(best);
        report.fieldsFilled++;
        report.details.push({ semantic: 'visa_sponsorship', label: 'Visa Sponsorship', success: true });
      }
      continue;
    }
  }
}

/**
 * Fills Step 4: Voluntary Disclosures (EEO & Disability).
 */
async function fillDisclosuresStep(
  root: Document | HTMLElement,
  profile: CandidateProfile,
  report: AutofillReport,
  processed: Set<HTMLElement>
): Promise<void> {
  // 1. Gender Selection
  const genderTrigger = root.querySelector<HTMLElement>(
    '[data-automation-id="gender"], [data-automation-id*="genderPrompt"], [id*="--gender" i], [name="gender"]'
  );
  if (genderTrigger && !processed.has(genderTrigger)) {
    processed.add(genderTrigger);
    report.totalFieldsFound++;
    const targetVal = profile.eeo.gender || 'decline';
    const success = await selectWorkdayComboboxOption(genderTrigger, targetVal, 'eeo_gender');
    if (success) report.fieldsFilled++;
    report.details.push({ semantic: 'eeo_gender', label: 'Gender', success });
  }

  // 2. Hispanic or Latino Question
  const hispanicTrigger = root.querySelector<HTMLElement>(
    '[data-automation-id="hispanicOrLatino"], [data-automation-id*="hispanicPrompt"], [id*="--hispanicOrLatino" i], [name="hispanicOrLatino"]'
  );
  if (hispanicTrigger && !processed.has(hispanicTrigger)) {
    processed.add(hispanicTrigger);
    report.totalFieldsFound++;
    const targetVal = profile.eeo.hispanicOrLatino || 'no';
    const success = await selectWorkdayComboboxOption(hispanicTrigger, targetVal, 'eeo_hispanic');
    if (success) report.fieldsFilled++;
    report.details.push({ semantic: 'eeo_hispanic', label: 'Hispanic or Latino', success });
  }

  // 3. Race / Ethnicity
  const raceTrigger = root.querySelector<HTMLElement>(
    '[data-automation-id="raceEthnicity"], [data-automation-id*="racePrompt"], [data-automation-id*="ethnicity"], [id*="--ethnicity" i], [name="ethnicity"]'
  );
  if (raceTrigger && !processed.has(raceTrigger)) {
    processed.add(raceTrigger);
    report.totalFieldsFound++;
    const targetVal = profile.eeo.race || 'asian';
    const success = await selectWorkdayComboboxOption(raceTrigger, targetVal, 'eeo_race');
    if (success) report.fieldsFilled++;
    report.details.push({ semantic: 'eeo_race', label: 'Race / Ethnicity', success });
  }

  // 4. Veteran Status
  const veteranTrigger = root.querySelector<HTMLElement>(
    '[data-automation-id="veteranStatus"], [data-automation-id*="veteranPrompt"], [id*="--veteranStatus" i], [name="veteranStatus"]'
  );
  if (veteranTrigger && !processed.has(veteranTrigger)) {
    processed.add(veteranTrigger);
    report.totalFieldsFound++;
    const targetVal = profile.eeo.veteran || 'no';
    const success = await selectWorkdayComboboxOption(veteranTrigger, targetVal, 'eeo_veteran');
    if (success) report.fieldsFilled++;
    report.details.push({ semantic: 'eeo_veteran', label: 'Veteran Status', success });
  }

  // 5. Terms and Conditions / Agreement Checkbox (e.g. Q2 Voluntary Disclosures page)
  const termsCheckbox = root.querySelector<HTMLInputElement>(
    'input[type="checkbox"][id*="acceptTerms" i], input[type="checkbox"][name*="acceptTerms" i], input[type="checkbox"][id*="termsAndConditions" i], input[type="checkbox"][data-automation-id*="terms" i]'
  );
  if (termsCheckbox && !processed.has(termsCheckbox)) {
    processed.add(termsCheckbox);
    report.totalFieldsFound++;
    if (!termsCheckbox.checked) {
      setCheckboxOrRadio(termsCheckbox, true);
      if (!termsCheckbox.checked) {
        fireClick(termsCheckbox);
      }
    }
    report.fieldsFilled++;
    report.details.push({ semantic: 'terms_agreement' as any, label: 'Terms and Conditions Agreement', success: true });
  }

  // 6. Disability Status (Combobox button or Form CC-305 Checkbox/Radio options)
  const disabilityTrigger = root.querySelector<HTMLElement>(
    '[data-automation-id="disabilityStatus"], [data-automation-id*="disabilityPrompt"]'
  );
  if (disabilityTrigger && !processed.has(disabilityTrigger)) {
    processed.add(disabilityTrigger);
    report.totalFieldsFound++;
    const targetVal = profile.eeo.disability || 'no';
    const success = await selectWorkdayComboboxOption(disabilityTrigger, targetVal, 'eeo_disability');
    if (success) report.fieldsFilled++;
    report.details.push({ semantic: 'eeo_disability', label: 'Disability Status', success });
  } else {
    // Form CC-305 checkboxes / radios (e.g. Q2 Step 6 Self Identify)
    const disabilityCheckboxes = Array.from(
      root.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][id*="disabilityStatus" i], input[type="radio"][id*="disabilityStatus" i], input[name*="disabilityStatus" i]'
      )
    );
    if (disabilityCheckboxes.length > 0) {
      const targetVal = (profile.eeo.disability || 'no').toLowerCase();
      let chosenCb: HTMLInputElement | null = null;
      for (const cb of disabilityCheckboxes) {
        processed.add(cb);
        const labelText = getWorkdayElementLabel(cb).toLowerCase();
        if (targetVal === 'no' && (labelText.includes('no, i do not') || labelText.includes('do not have a disability') || labelText.includes('no disability'))) {
          chosenCb = cb;
          break;
        }
        if (targetVal === 'yes' && (labelText.includes('yes, i have') || (labelText.includes('have a disability') && !labelText.includes('no')))) {
          chosenCb = cb;
          break;
        }
        if ((targetVal === 'decline' || targetVal === 'opt-out') && (labelText.includes('do not want') || labelText.includes('decline'))) {
          chosenCb = cb;
          break;
        }
      }

      if (!chosenCb && disabilityCheckboxes.length >= 2) {
        chosenCb = targetVal === 'no' ? disabilityCheckboxes[1] : disabilityCheckboxes[disabilityCheckboxes.length - 1];
      }

      if (chosenCb) {
        report.totalFieldsFound++;
        setCheckboxOrRadio(chosenCb, true);
        if (!chosenCb.checked) {
          fireClick(chosenCb);
        }
        report.fieldsFilled++;
        report.details.push({ semantic: 'eeo_disability', label: 'Disability Status', success: true });
      }
    }
  }

  // 7. Disability Agreement Checkbox
  const agreementCheckbox = root.querySelector<HTMLInputElement>(
    'input[type="checkbox"][data-automation-id*="agreement"], input[type="checkbox"][data-automation-id*="acknowledge"], [data-automation-id="disabilitySection"] input[type="checkbox"]'
  );
  if (agreementCheckbox && !processed.has(agreementCheckbox)) {
    processed.add(agreementCheckbox);
    report.totalFieldsFound++;
    setCheckboxOrRadio(agreementCheckbox, true);
    report.fieldsFilled++;
    report.details.push({ semantic: 'eeo_disability', label: 'Disability Acknowledgment', success: true });
  }

  // 8. Signature Legal Name
  const signatureInput = root.querySelector<HTMLInputElement>(
    '#selfIdentifiedDisabilityData--name, input[data-automation-id="name"], input[data-automation-id*="signature"], [data-automation-id="disabilitySection"] input[type="text"], input[id*="disability" i][id*="name" i]'
  );
  if (signatureInput && !processed.has(signatureInput)) {
    processed.add(signatureInput);
    report.totalFieldsFound++;
    const fullName = `${profile.personal.firstName} ${profile.personal.lastName}`.trim();
    setInputValue(signatureInput, fullName);
    report.fieldsFilled++;
    report.details.push({ semantic: 'disability_signature', label: 'Disability Signature', success: true });
  }

  // 9. Signature Date (supports split Month/Day/Year inputs and unified MM/DD/YYYY input)
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = String(d.getFullYear());

  const monthInput = root.querySelector<HTMLInputElement>(
    '[data-automation-id="dateSectionMonth-input"], input[id*="dateSignedOn"][id*="Month"], input[id*="dateSectionMonth"]'
  );
  const dayInput = root.querySelector<HTMLInputElement>(
    '[data-automation-id="dateSectionDay-input"], input[id*="dateSignedOn"][id*="Day"], input[id*="dateSectionDay"]'
  );
  const yearInput = root.querySelector<HTMLInputElement>(
    '[data-automation-id="dateSectionYear-input"], input[id*="dateSignedOn"][id*="Year"], input[id*="dateSectionYear"]'
  );

  if (monthInput && dayInput && yearInput) {
    if (!processed.has(monthInput)) {
      processed.add(monthInput);
      processed.add(dayInput);
      processed.add(yearInput);
      report.totalFieldsFound++;
      setInputValue(monthInput, mm);
      setInputValue(dayInput, dd);
      setInputValue(yearInput, yyyy);

      const dateWrapper = monthInput.closest<HTMLElement>(
        '[data-automation-id="dateInputWrapper"], [id*="dateSignedOn"], [role="group"]'
      );
      if (dateWrapper) {
        try {
          dateWrapper.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
          dateWrapper.dispatchEvent(new FocusEvent('blur', { bubbles: false, relatedTarget: document.body }));
        } catch {}
      }

      report.fieldsFilled++;
      report.details.push({ semantic: 'disability_date', label: 'Disability Date', success: true });
    }
  } else {
    const dateInput = root.querySelector<HTMLInputElement>(
      'input[data-automation-id="date"], input[data-automation-id*="signatureDate"], [data-automation-id="disabilitySection"] input[placeholder*="YYYY"], [data-automation-id="disabilitySection"] input[placeholder*="MM"], input[id*="dateSignedOn"]'
    );
    if (dateInput && !processed.has(dateInput)) {
      processed.add(dateInput);
      report.totalFieldsFound++;
      setInputValue(dateInput, `${mm}/${dd}/${yyyy}`);
      report.fieldsFilled++;
      report.details.push({ semantic: 'disability_date', label: 'Disability Date', success: true });
    }
  }
}

/**
 * Main autofill function for Workday job applications.
 * Automatically identifies the active wizard step, fills all relevant controls,
 * and falls back to universal DOM matching for any unhandled fields.
 */
export async function autofillWorkday(
  profile: CandidateProfile,
  rootElement: Document | HTMLElement = document
): Promise<AutofillReport> {
  const report: AutofillReport = {
    timestamp: Date.now(),
    platform: 'workday',
    url: typeof window !== 'undefined' ? window.location.href : '',
    totalFieldsFound: 0,
    fieldsFilled: 0,
    details: [],
  };

  const processed = new Set<HTMLElement>();
  const step = detectWorkdayStep(rootElement);

  console.log(`[Instapp] Autofilling Workday application - Detected Step: ${step}`);

  switch (step) {
    case 'information':
      await fillInformationStep(rootElement, profile, report, processed);
      break;
    case 'experience':
      await fillExperienceStep(rootElement, profile, report, processed);
      break;
    case 'questions':
      await fillQuestionsStep(rootElement, profile, report, processed);
      break;
    case 'disclosures':
      await fillDisclosuresStep(rootElement, profile, report, processed);
      break;
    default:
      // If step is unknown or multi-section page, attempt each step sequentially
      await fillInformationStep(rootElement, profile, report, processed);
      await fillExperienceStep(rootElement, profile, report, processed);
      await fillQuestionsStep(rootElement, profile, report, processed);
      await fillDisclosuresStep(rootElement, profile, report, processed);
      break;
  }

  // Universal Fallback: Scan remaining unhandled standard text inputs
  const remainingInputs = Array.from(
    rootElement.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea'
    )
  );

  for (const input of remainingInputs) {
    if (processed.has(input)) continue;
    processed.add(input);

    const label = extractFieldLabel(input);
    const semantic = classifyField(input, label);
    if (semantic === 'phone_extension') {
      if (input.value) {
        setInputValue(input, '');
      }
      continue;
    }
    const val = getProfileValueForSemantic(profile, semantic);

    if (val && !input.value) {
      report.totalFieldsFound++;
      setInputValue(input, val);
      report.fieldsFilled++;
      report.details.push({ semantic, label, success: true });
    }
  }

  return report;
}
