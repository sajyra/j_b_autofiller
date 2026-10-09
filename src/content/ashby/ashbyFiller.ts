import { CandidateProfile } from '../../types/profile';
import { AutofillReport, FieldSemantic } from '../../types/autofill';
import { classifyField, extractFieldLabel, normalizeText } from '../core/labelMatcher';
import { setInputValue, setSelectValue, setCheckboxOrRadio, simulateClick, firePointerClick } from '../core/eventDispatcher';
import { findBestMatchingOption, scoreChoiceMatch, getProfileValueForSemantic } from '../core/semanticMatcher';

/**
 * Checks if the current page or document is an Ashby application form.
 */
export function isAshbyForm(): boolean {
  if (typeof window !== 'undefined' && window.location.hostname.includes('ashbyhq.com')) {
    return true;
  }
  if (
    document.querySelector('#ashby_embed') ||
    document.querySelector('.ashby-application-form-field-entry') ||
    document.querySelector('[data-ashby]') ||
    document.querySelector('[class*="ashby"]')
  ) {
    return true;
  }
  return false;
}

export { getProfileValueForSemantic } from '../core/semanticMatcher';

/**
 * Searches upward and preceding siblings to find the question title or heading for any element or group.
 */
export function getQuestionHeading(element: HTMLElement): string {
  // 1. Look inside the immediate field container
  const container = element.closest(
    '.ashby-application-form-field-entry, [class*="form-field"], [class*="formField"], [class*="FieldEntry"], [class*="fieldContainer"], [class*="field_entry"], fieldset'
  );

  if (container) {
    const headingEl = Array.from(
      container.querySelectorAll<HTMLElement>(
        'h1, h2, h3, h4, h5, h6, legend, label, p, [class*="title"], [class*="header"], [class*="prompt"], [class*="label"], [class*="question"]'
      )
    ).find(
      (c) =>
        !element.contains(c) &&
        !c.contains(element) &&
        !c.querySelector('input, select, textarea, button') &&
        c.textContent &&
        c.textContent.trim().length > 3
    );

    if (headingEl && headingEl.textContent) {
      return normalizeText(headingEl.textContent);
    }
  }

  // 2. Look at preceding siblings of element or ancestors (up to 4 levels)
  let curr: HTMLElement | null = element;
  let depth = 0;

  while (curr && depth < 4 && curr !== document.body) {
    let prev = curr.previousElementSibling;
    while (prev) {
      if (
        prev.matches('label, legend, h1, h2, h3, h4, h5, h6, p, [class*="label"], [class*="prompt"], [class*="title"]') &&
        !prev.querySelector('input, select, textarea, button') &&
        prev.textContent &&
        prev.textContent.trim().length > 3
      ) {
        return normalizeText(prev.textContent);
      }
      prev = prev.previousElementSibling;
    }
    curr = curr.parentElement;
    depth++;
  }

  return extractFieldLabel(element);
}

/**
 * Checks if a clickable control/button is currently selected/active.
 */
export function isControlActive(el: HTMLElement): boolean {
  if (!el) return false;
  if (el.getAttribute('aria-pressed') === 'true') return true;
  if (el.getAttribute('aria-checked') === 'true') return true;
  if (
    el.getAttribute('data-state') === 'on' ||
    el.getAttribute('data-state') === 'checked' ||
    el.getAttribute('data-state') === 'active'
  ) return true;
  if (el.getAttribute('data-selected') === 'true' || el.getAttribute('data-active') === 'true') return true;
  if (el.classList.contains('active') || el.classList.contains('selected') || el.classList.contains('checked')) return true;

  // Check parent button or wrapper if el is an inner element
  const parentBtn = el.closest('button, [role="button"], [role="radio"]');
  if (parentBtn && parentBtn !== el) {
    if (parentBtn.getAttribute('aria-pressed') === 'true') return true;
    if (parentBtn.getAttribute('aria-checked') === 'true') return true;
    if (
      parentBtn.getAttribute('data-state') === 'on' ||
      parentBtn.getAttribute('data-state') === 'checked' ||
      parentBtn.getAttribute('data-state') === 'active'
    ) return true;
    if (parentBtn.classList.contains('active') || parentBtn.classList.contains('selected') || parentBtn.classList.contains('checked')) return true;
  }

  const radio = el.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
  if (radio && radio.checked) return true;
  return false;
}

// Track buttons already chosen by Instapp to prevent accidental un-toggling during reconciliation
const instappActivatedButtons = new WeakSet<HTMLElement>();

/**
 * Handles segmented [ Yes | No ] buttons widely used in Ashby for Boolean questions,
 * traversing up to 4 container levels to find matching sibling buttons across wrapper divs.
 */
export function handleSegmentedButtons(
  rootElement: Document | HTMLElement,
  profile: CandidateProfile,
  report: AutofillReport
): void {
  const clickableElements = Array.from(
    rootElement.querySelectorAll<HTMLElement>('button, [role="button"], [role="radio"], label')
  );

  const processedButtons = new Set<HTMLElement>();

  for (const el of clickableElements) {
    if (processedButtons.has(el)) continue;

    const text = (el.textContent || '').trim().toLowerCase();
    if (text === 'yes') {
      // Find the common container containing "No" (up to 4 container levels up)
      let container: HTMLElement | null = el.parentElement;
      let noEl: HTMLElement | null = null;
      let depth = 0;

      while (container && depth < 5 && container !== rootElement && container !== document.body) {
        const candidates = Array.from(
          container.querySelectorAll<HTMLElement>('button, [role="button"], [role="radio"], label')
        );
        const match = candidates.find(
          (c) => c !== el && !el.contains(c) && (c.textContent || '').trim().toLowerCase() === 'no'
        );
        if (match) {
          noEl = match;
          break;
        }
        container = container.parentElement;
      }

      if (noEl && container) {
        processedButtons.add(el);
        processedButtons.add(noEl);
        report.totalFieldsFound++;

        const questionText = getQuestionHeading(container);
        const semantic = classifyField(container, questionText);

        let targetChoice: 'yes' | 'no' | null = null;
        if (semantic === 'work_authorized') {
          targetChoice = profile.workAuth.authorizedInUS === 'yes' ? 'yes' : 'no';
        } else if (semantic === 'visa_sponsorship') {
          targetChoice = profile.workAuth.requiresSponsorship === 'yes' ? 'yes' : 'no';
        } else if (semantic === 'relocation') {
          targetChoice = 'yes';
        } else if (semantic === 'office_commitment') {
          targetChoice = 'yes';
        } else {
          // Check custom Q&A
          if (profile.customQA && profile.customQA.length > 0) {
            const matched = profile.customQA.find((qa) => {
              try {
                return new RegExp(qa.questionPattern, 'i').test(questionText);
              } catch {
                return normalizeText(questionText).includes(normalizeText(qa.questionPattern));
              }
            });
            if (matched && /yes/i.test(matched.answer)) targetChoice = 'yes';
            else if (matched && /no/i.test(matched.answer)) targetChoice = 'no';
          }
        }

        const chosenEl = targetChoice === 'yes' ? el : targetChoice === 'no' ? noEl : null;
        if (chosenEl) {
          if (!isControlActive(chosenEl) && !instappActivatedButtons.has(chosenEl)) {
            chosenEl.focus();
            firePointerClick(chosenEl);
            instappActivatedButtons.add(chosenEl);

            // Also check if chosenEl contains an inner radio
            const innerRadio = chosenEl.querySelector<HTMLInputElement>('input[type="radio"]');
            if (innerRadio) {
              setCheckboxOrRadio(innerRadio, true);
            } else if (container) {
              // Find matching radio in container if present by value or label
              const containerRadios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
              const targetRadio = containerRadios.find((r) => {
                const val = (r.value || '').toLowerCase();
                const rLabel = extractFieldLabel(r).toLowerCase();
                return val === targetChoice || rLabel === targetChoice;
              });
              if (targetRadio) {
                setCheckboxOrRadio(targetRadio, true);
              }
            }

            const otherEl = chosenEl === el ? noEl : el;
            if (chosenEl.getAttribute('role') === 'radio' || chosenEl.tagName.toLowerCase() === 'button') {
              chosenEl.setAttribute('aria-checked', 'true');
              chosenEl.setAttribute('data-state', 'checked');
              if (otherEl) {
                otherEl.setAttribute('aria-checked', 'false');
                otherEl.setAttribute('data-state', 'unchecked');
              }
            }

            // Unconditionally dispatch input and change on chosenEl
            try {
              chosenEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
              chosenEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
            } catch {}

            // Notify Radix UI / custom RadioGroup / ToggleGroup onValueChange on container
            let group = chosenEl.closest('[role="radiogroup"], [role="group"]') || chosenEl.parentElement;
            while (group && group !== document.body) {
              try {
                const keys = Object.keys(group);
                const reactKey = keys.find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
                if (reactKey) {
                  const props = (group as any)[reactKey];
                  if (props && typeof props.onValueChange === 'function') {
                    props.onValueChange(targetChoice);
                    break;
                  }
                }
              } catch {}
              group = group.parentElement;
            }
          }
          report.fieldsFilled++;
          report.details.push({ semantic, label: questionText, success: true });
        }
      }
    }
  }
}

/**
 * Handles all radio button groups on the page, grouped by name attribute or parent container.
 */
export function handleAllRadioGroups(
  rootElement: Document | HTMLElement,
  profile: CandidateProfile,
  report: AutofillReport,
  processedElements: Set<HTMLElement>
): void {
  const allRadios = Array.from(rootElement.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  const standaloneRoleRadios = Array.from(rootElement.querySelectorAll<HTMLElement>('[role="radio"]')).filter(
    (el) => !el.querySelector('input[type="radio"]') && !el.closest('label')?.querySelector('input[type="radio"]')
  );

  const allRadioCandidates: HTMLElement[] = [...allRadios, ...standaloneRoleRadios];
  if (allRadioCandidates.length === 0) return;

  // Group radios by name attribute, or by distinct question container
  const groups: HTMLElement[][] = [];
  const nameMap = new Map<string, HTMLElement[]>();
  const containerMap = new Map<HTMLElement, HTMLElement[]>();

  for (const radio of allRadioCandidates) {
    const name = radio.getAttribute('name');
    if (name) {
      if (!nameMap.has(name)) {
        const arr: HTMLElement[] = [];
        nameMap.set(name, arr);
        groups.push(arr);
      }
      nameMap.get(name)!.push(radio);
    } else {
      const container = (radio.closest(
        '[role="radiogroup"], fieldset, .ashby-application-form-field-entry, [class*="form-field"], [class*="formField"], [class*="FieldEntry"], [class*="fieldContainer"], [class*="field_entry"]'
      ) || radio.parentElement || radio) as HTMLElement;

      if (!containerMap.has(container)) {
        const arr: HTMLElement[] = [];
        containerMap.set(container, arr);
        groups.push(arr);
      }
      containerMap.get(container)!.push(radio);
    }
  }

  for (const radios of groups) {
    // Check if already processed
    if (radios.some((r) => processedElements.has(r))) continue;
    radios.forEach((r) => processedElements.add(r));
    report.totalFieldsFound++;

    const firstRadio = radios[0];
    const questionText = getQuestionHeading(firstRadio);
    const semantic = classifyField(firstRadio, questionText);

    let targetValue = getProfileValueForSemantic(profile, semantic);
    if (!targetValue && profile.customQA) {
      const matched = profile.customQA.find((qa) => {
        try {
          return new RegExp(qa.questionPattern, 'i').test(questionText);
        } catch {
          return normalizeText(questionText).includes(normalizeText(qa.questionPattern));
        }
      });
      if (matched) targetValue = matched.answer;
    }

    if (targetValue) {
      const { best } = findBestMatchingOption(
        radios,
        (radio) => {
          const label = extractFieldLabel(radio);
          const val = radio.getAttribute('value') || (radio as HTMLInputElement).value || '';
          return `${label} ${val}`;
        },
        targetValue,
        semantic,
        35
      );

      if (best) {
        setCheckboxOrRadio(best, true);
        report.fieldsFilled++;
        report.details.push({ semantic, label: questionText, success: true });
      } else {
        report.details.push({ semantic, label: questionText, success: false, reason: 'No matching radio option' });
      }
    }
  }
}

/**
 * Handles autocomplete Location inputs (types location and clicks matching suggestion from popover).
 */
export async function handleLocationField(
  input: HTMLInputElement,
  locationText: string
): Promise<boolean> {
  setInputValue(input, locationText);

  // Poll for Ashby's location search popover (up to 1200ms)
  const startTime = Date.now();
  let matched: HTMLElement | null = null;
  const target = normalizeText(locationText);

  while (Date.now() - startTime < 1200) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const items = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="option"], [data-radix-collection-item], ul[role="listbox"] > li, [class*="option"], [class*="menuItem"], [class*="suggestion"]'
      )
    ).filter((item) => {
      if (typeof item.getBoundingClientRect === 'function') {
        const rect = item.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
      }
      return true;
    });

    if (items.length > 0) {
      matched = items.find((item) => normalizeText(item.textContent || '').includes(target)) || items[0];
      break;
    }
  }

  if (matched) {
    firePointerClick(matched);
    return true;
  }

  return false;
}

/**
 * Handles Degree Type and other Checkbox Groups.
 */
export function handleCheckboxGroups(
  rootElement: Document | HTMLElement,
  profile: CandidateProfile,
  report: AutofillReport,
  processedElements: Set<HTMLElement>
): void {
  const checkboxes = Array.from(rootElement.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

  for (const box of checkboxes) {
    if (processedElements.has(box)) continue;
    processedElements.add(box);

    const questionText = getQuestionHeading(box);
    const label = extractFieldLabel(box);
    const semantic = classifyField(box, questionText);
    const combinedContext = `${questionText} ${label} ${box.name || ''} ${box.id || ''}`.toLowerCase();

    // 1. Degree Type checkboxes
    if (
      semantic === 'degree_type' ||
      /degree type|degree level|education level/i.test(questionText) ||
      /\b(undergraduate|bachelor|master's|phd|mba)\b/i.test(label)
    ) {
      report.totalFieldsFound++;
      const targetDegree = profile.experience.highestDegree || 'Bachelor';
      const score = scoreChoiceMatch(label, targetDegree);
      if (
        score >= 60 ||
        (/undergrad|bachelor/i.test(label) && /bachelor|b\.s|undergrad/i.test(targetDegree)) ||
        (/master/i.test(label) && /master/i.test(targetDegree)) ||
        (/phd|doctor/i.test(label) && /phd|doctor/i.test(targetDegree))
      ) {
        setCheckboxOrRadio(box, true);
        report.fieldsFilled++;
        report.details.push({ semantic: 'degree_type', label: `${questionText} - ${label}`, success: true });
      }
      continue;
    }

    // 2. Relocation Locations checkboxes (e.g. San Francisco, New York)
    if (
      /relocat.*(location|interest|role|position)|location.*relocat|interested in relocating/i.test(combinedContext) ||
      (/\b(new york|san francisco|austin|seattle|remote)\b/i.test(label) && /relocat/i.test(combinedContext))
    ) {
      report.totalFieldsFound++;
      setCheckboxOrRadio(box, true);
      report.fieldsFilled++;
      report.details.push({ semantic: 'relocation', label: `${questionText} - ${label}`, success: true });
    }
  }
}

/**
 * Converts a base64 Data URL to a native File object.
 */
export function dataUrlToFile(dataUrl: string, filename: string, mimeType?: string): File {
  const parts = dataUrl.split(',');
  const mime = mimeType || (parts[0].match(/:(.*?);/)?.[1] ?? 'application/pdf');
  const bstr = atob(parts[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Helper to identify if a file input is Ashby's top "Autofill from resume" teaser box
 * rather than the actual application resume attachment input.
 */
export function isAutofillFromResumeTeaser(input: HTMLInputElement): boolean {
  // If input name, id, or aria-label explicitly indicates autofill teaser
  const idOrName = `${input.id} ${input.name} ${input.getAttribute('aria-label') || ''}`.toLowerCase();
  if (idOrName.includes('autofill') || idOrName.includes('teaser')) {
    return true;
  }

  // Check heading and label
  const heading = getQuestionHeading(input).toLowerCase();
  const label = extractFieldLabel(input).toLowerCase();

  // If heading or label explicitly contains 'autofill', it's the teaser
  if (heading.includes('autofill') || label.includes('autofill')) {
    return true;
  }

  // If heading or label is cleanly "Resume" / "Resume*" / "Resume / CV", it is the genuine application field
  if (
    /^resume\b|^cv\b|^curriculum\b/i.test(label.trim()) ||
    /^resume\b|^cv\b|^curriculum\b/i.test(heading.trim())
  ) {
    return false;
  }

  // Check immediate container only (stop before reaching the full form / document)
  const container =
    input.closest(
      '[class*="field-entry"], [class*="field-container"], [class*="form-field"], [class*="autofill"], [class*="teaser"]'
    ) || input.parentElement;

  if (container && container.tagName.toLowerCase() !== 'form' && container.id !== 'application-form') {
    const text = (container.textContent || '').toLowerCase();
    if (
      text.includes('autofill from resume') ||
      text.includes('autofill key application') ||
      text.includes('save time by importing your resume') ||
      text.includes('upload your resume here to autofill')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a resume file is already uploaded/attached in the input or dropzone container.
 * Specifically avoids false-positives on unattached "Upload File" buttons with SVG icons.
 */
export function isResumeAlreadyAttached(
  resumeInput: HTMLInputElement,
  dropzoneContainer?: HTMLElement | null
): boolean {
  // 1. Direct check on the input's files list
  if (resumeInput.files && resumeInput.files.length > 0) {
    return true;
  }

  const container = dropzoneContainer || resumeInput.parentElement;
  if (!container) return false;

  const containerText = (container.textContent || '').trim();

  // If container explicitly prompts to upload or drop, it is empty
  if (
    /upload file|drag and drop|select file|choose file/i.test(containerText) &&
    !/\.(pdf|docx?|txt)\b/i.test(containerText)
  ) {
    return false;
  }

  // Check for genuine remove/delete/replace buttons (specifically excluding upload/browse buttons)
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button, [role="button"], a'));
  const hasRemoveButton = buttons.some((btn) => {
    const text = (btn.textContent || '').trim().toLowerCase();
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const title = (btn.getAttribute('title') || '').toLowerCase();
    const btnInfo = `${text} ${ariaLabel} ${title}`;

    if (btnInfo.includes('upload') || btnInfo.includes('browse') || btnInfo.includes('drop')) {
      return false;
    }

    return (
      ariaLabel.includes('remove') ||
      ariaLabel.includes('delete') ||
      title.includes('remove') ||
      title.includes('delete') ||
      text === 'remove' ||
      text === 'delete' ||
      text === 'replace'
    );
  });

  if (hasRemoveButton) {
    return true;
  }

  // Check for uploaded filename presence (e.g. "alex_resume.pdf") in container
  if (/\.(pdf|docx?|txt)\b/i.test(containerText) && !/accepts?\s*(\.pdf|pdf)/i.test(containerText)) {
    return true;
  }

  return false;
}

/**
 * Handles uploading the stored candidate resume into Ashby's resume file input.
 * Excludes Ashby's top "Autofill from resume" parser teaser so it doesn't wipe fields.
 * Uses a multi-layer injection approach for React Dropzone compatibility:
 * 1. Native DataTransfer & input.files assignment
 * 2. Native change & input event dispatch
 * 3. React synthetic onChange prop invocation
 * 4. Native dragenter, dragover, drop DragEvents on dropzone container
 * 5. React synthetic onDrop prop invocation
 */
export async function handleResumeUpload(
  rootElement: Document | HTMLElement,
  profile: CandidateProfile,
  report: AutofillReport
): Promise<boolean> {
  if (!profile.resume || !profile.resume.dataUrl) {
    console.log('[Instapp] No resume file found in candidate profile. Skipping resume upload.');
    return false;
  }

  // Find all file inputs on the page
  const allFileInputs = Array.from(rootElement.querySelectorAll<HTMLInputElement>('input[type="file"]'));
  if (allFileInputs.length === 0) {
    return false;
  }

  // CRITICAL: Filter OUT any "Autofill from resume" top teaser boxes!
  // We ONLY want to attach to the actual application resume submission box.
  const applicationFileInputs = allFileInputs.filter((input) => !isAutofillFromResumeTeaser(input));
  if (applicationFileInputs.length === 0) {
    return false;
  }

  // Identify the target resume file input (excluding cover letter / transcript)
  const resumeInput =
    applicationFileInputs.find((input) => {
      const heading = getQuestionHeading(input);
      const label = extractFieldLabel(input);
      const name = input.name || input.id || input.getAttribute('aria-label') || '';
      const text = `${heading} ${label} ${name}`.toLowerCase();
      return (
        (text.includes('resume') || text.includes('cv') || text.includes('curriculum')) &&
        !text.includes('cover')
      );
    }) ||
    applicationFileInputs.find((input) => {
      const heading = getQuestionHeading(input);
      const label = extractFieldLabel(input);
      const text = `${heading} ${label}`.toLowerCase();
      return !text.includes('cover') && !text.includes('transcript');
    }) ||
    applicationFileInputs[0];

  if (!resumeInput) {
    return false;
  }

  // Locate the dropzone container
  const dropzoneContainer =
    resumeInput.closest<HTMLElement>(
      '[class*="dropzone" i], [class*="dropZone" i], [class*="upload" i], [class*="dropArea" i], [role="presentation"], label'
    ) ||
    resumeInput.parentElement?.closest<HTMLElement>('[class*="field-entry"], [class*="form-field"], div') ||
    resumeInput.parentElement;

  // Check if a resume is already attached in this input or dropzone
  if (isResumeAlreadyAttached(resumeInput, dropzoneContainer)) {
    report.totalFieldsFound++;
    report.fieldsFilled++;
    report.details.push({
      semantic: 'resume',
      label: 'Resume / CV (Already Attached)',
      success: true,
    });
    return true;
  }

  report.totalFieldsFound++;

  try {
    const file = dataUrlToFile(
      profile.resume.dataUrl,
      profile.resume.name || 'resume.pdf',
      profile.resume.type || 'application/pdf'
    );

    // Create DataTransfer
    let dt: DataTransfer | null = null;
    try {
      if (typeof DataTransfer !== 'undefined') {
        dt = new DataTransfer();
        dt.items.add(file);
      }
    } catch (e) {
      console.warn('[Instapp] DataTransfer creation failed', e);
    }

    // Set files on resumeInput
    let setFilesSuccess = false;
    if (dt) {
      try {
        resumeInput.files = dt.files;
        setFilesSuccess = true;
      } catch {
        // Direct assignment failed
      }
    }

    if (!setFilesSuccess) {
      try {
        const proto = window.HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'files');
        if (descriptor && descriptor.set && dt) {
          descriptor.set.call(resumeInput, dt.files);
          setFilesSuccess = true;
        }
      } catch {}
    }

    if (!setFilesSuccess) {
      try {
        Object.defineProperty(resumeInput, 'files', {
          value: dt ? dt.files : [file],
          writable: true,
          configurable: true,
        });
        setFilesSuccess = true;
      } catch {}
    }

    // Dispatch standard change and input events
    resumeInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
    resumeInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));

    // Helper to invoke React synthetic handlers if attached
    const invokeReactHandler = (el: HTMLElement, eventName: string, synthEvent: any) => {
      try {
        const keys = Object.keys(el);
        const reactKey = keys.find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
        if (reactKey) {
          const props = (el as any)[reactKey];
          if (props && typeof props[eventName] === 'function') {
            props[eventName](synthEvent);
            return true;
          }
        }
      } catch {}
      return false;
    };

    // Try React onChange directly on the file input
    invokeReactHandler(resumeInput, 'onChange', {
      target: resumeInput,
      currentTarget: resumeInput,
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      persist: () => {},
      preventDefault: () => {},
      stopPropagation: () => {},
      nativeEvent: new Event('change'),
    });

    // Target dropzone elements for Drag & Drop simulation
    const targetsToDrop: HTMLElement[] = [];
    if (dropzoneContainer) targetsToDrop.push(dropzoneContainer);
    if (resumeInput.parentElement && !targetsToDrop.includes(resumeInput.parentElement)) {
      targetsToDrop.push(resumeInput.parentElement);
    }

    const dropArea = dropzoneContainer?.querySelector<HTMLElement>('[role="button"], button, div') || null;
    if (dropArea && !targetsToDrop.includes(dropArea)) {
      targetsToDrop.push(dropArea);
    }

    if (dt && typeof DragEvent !== 'undefined') {
      for (const targetEl of targetsToDrop) {
        try {
          const dragEnter = new DragEvent('dragenter', {
            bubbles: true,
            cancelable: true,
            composed: true,
            dataTransfer: dt,
          });
          try { Object.defineProperty(dragEnter, 'dataTransfer', { value: dt }); } catch {}
          targetEl.dispatchEvent(dragEnter);

          const dragOver = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            composed: true,
            dataTransfer: dt,
          });
          try { Object.defineProperty(dragOver, 'dataTransfer', { value: dt }); } catch {}
          targetEl.dispatchEvent(dragOver);

          const drop = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            composed: true,
            dataTransfer: dt,
          });
          try { Object.defineProperty(drop, 'dataTransfer', { value: dt }); } catch {}
          targetEl.dispatchEvent(drop);

          // Direct React onDrop invocation if available
          invokeReactHandler(targetEl, 'onDrop', {
            dataTransfer: dt,
            target: targetEl,
            currentTarget: targetEl,
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            persist: () => {},
            preventDefault: () => {},
            stopPropagation: () => {},
            nativeEvent: drop,
          });
        } catch {}
      }
    }

    report.fieldsFilled++;
    report.details.push({
      semantic: 'resume',
      label: 'Resume / CV Upload',
      success: true,
    });
    return true;
  } catch (err: any) {
    report.details.push({
      semantic: 'resume',
      label: 'Resume / CV Upload',
      success: false,
      reason: err?.message || 'Failed to attach resume file',
    });
    return false;
  }
}

/**
 * Audits every input on the form, verifies values against candidate profile,
 * and actively re-applies any fields that were empty, all-caps, or cleared.
 */
export function verifyAndReconcileAshby(
  rootElement: Document | HTMLElement,
  profile: CandidateProfile
): void {
  // 1. Audit Text Inputs & Textareas
  const inputs = Array.from(
    rootElement.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea'
    )
  );

  for (const input of inputs) {
    const label = extractFieldLabel(input);
    const heading = getQuestionHeading(input);
    const effectiveLabel = /type here|pick date|select|choose|enter/i.test(label) && heading.length > label.length
      ? heading
      : label;
    const semantic = classifyField(input, effectiveLabel);
    const expectedVal = getProfileValueForSemantic(profile, semantic);

    if (expectedVal && expectedVal.trim().length > 0) {
      const currentVal = input.value || '';
      const isAllUpperName =
        semantic === 'full_name' &&
        currentVal.length > 2 &&
        currentVal === currentVal.toUpperCase() &&
        currentVal !== expectedVal;
      const isPlaceholderPhone =
        semantic === 'phone' && (currentVal === '' || currentVal.includes('1-415-555'));
      const isPlaceholderDate =
        semantic === 'graduation_date' && (currentVal === '' || currentVal.includes('Pick date'));

      if (!currentVal.trim() || isAllUpperName || isPlaceholderPhone || isPlaceholderDate) {
        setInputValue(input, expectedVal);
      }
    }
  }

  // 2. Audit Segmented [ Yes | No ] Buttons
  const dummyReport: AutofillReport = {
    timestamp: Date.now(),
    platform: 'ashby',
    url: '',
    totalFieldsFound: 0,
    fieldsFilled: 0,
    details: [],
  };
  handleSegmentedButtons(rootElement, profile, dummyReport);

  // 3. Audit Checkbox Groups (Degree Type, Relocation)
  const processedBoxes = new Set<HTMLElement>();
  handleCheckboxGroups(rootElement, profile, dummyReport, processedBoxes);

  // 4. Audit Radio Groups (Sponsorship, Pronouns, EEO)
  const processedRadios = new Set<HTMLElement>();
  handleAllRadioGroups(rootElement, profile, dummyReport, processedRadios);
}

/**
 * Main autofill engine for Ashby forms.
 */
export async function autofillAshby(
  profile: CandidateProfile,
  rootElement: Document | HTMLElement = document
): Promise<AutofillReport> {
  const report: AutofillReport = {
    timestamp: Date.now(),
    platform: 'ashby',
    url: typeof window !== 'undefined' ? window.location.href : '',
    totalFieldsFound: 0,
    fieldsFilled: 0,
    details: [],
  };

  const processedElements = new Set<HTMLElement>();

  // 1. Handle Resume File Upload (Excludes top "Autofill from resume" teaser box)
  await handleResumeUpload(rootElement, profile, report);

  // 2. Handle Segmented [ Yes | No ] Boolean Buttons
  handleSegmentedButtons(rootElement, profile, report);

  // 3. Handle Radio Groups (Pronouns, Sponsorship, Gender, Race, Veteran, Disability)
  handleAllRadioGroups(rootElement, profile, report, processedElements);

  // 4. Handle Checkbox Groups (Degree Type, Relocation Locations)
  handleCheckboxGroups(rootElement, profile, report, processedElements);

  // 5. Handle Standard Text Inputs, Textareas, and Dropdowns
  const inputs = Array.from(
    rootElement.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select'
    )
  );

  for (const input of inputs) {
    if (processedElements.has(input)) continue;
    processedElements.add(input);
    report.totalFieldsFound++;

    const label = extractFieldLabel(input);
    const questionHeading = getQuestionHeading(input);
    // Prefer more detailed question heading if label was generic
    const effectiveLabel =
      /type here|pick date|select|choose|enter/i.test(label) && questionHeading.length > label.length
        ? questionHeading
        : label;

    const semantic = classifyField(input, effectiveLabel);

    // Location autocomplete special handling
    if (semantic === 'location' || semantic === 'city') {
      const locVal = getProfileValueForSemantic(profile, 'location') || profile.personal.city;
      if (locVal && input instanceof HTMLInputElement) {
        const ok = await handleLocationField(input, locVal);
        if (ok) {
          report.fieldsFilled++;
          report.details.push({ semantic, label: effectiveLabel, success: true });
          continue;
        }
      }
    }

    // Standard profile values
    const val = getProfileValueForSemantic(profile, semantic);
    if (val && val.trim().length > 0) {
      if (input instanceof HTMLSelectElement) {
        const success = setSelectValue(input, val, semantic);
        if (success) {
          report.fieldsFilled++;
          report.details.push({ semantic, label: effectiveLabel, success: true });
        }
      } else {
        setInputValue(input, val);
        report.fieldsFilled++;
        report.details.push({ semantic, label: effectiveLabel, success: true });
      }
      continue;
    }

    // Custom Q&A matches
    if (profile.customQA && profile.customQA.length > 0) {
      const matchedQA = profile.customQA.find((qa) => {
        try {
          return new RegExp(qa.questionPattern, 'i').test(effectiveLabel);
        } catch {
          return normalizeText(effectiveLabel).includes(normalizeText(qa.questionPattern));
        }
      });

      if (matchedQA && matchedQA.answer) {
        if (input instanceof HTMLSelectElement) {
          setSelectValue(input, matchedQA.answer, semantic);
        } else {
          setInputValue(input, matchedQA.answer);
        }
        report.fieldsFilled++;
        report.details.push({ semantic: 'custom_question', label: effectiveLabel, success: true });
        continue;
      }
    }

    report.details.push({ semantic, label: effectiveLabel, success: false, reason: 'No profile value available' });
  }

  // 6. Check for custom combobox triggers (role="combobox") & date buttons
  const comboboxes = Array.from(
    rootElement.querySelectorAll<HTMLElement>('[role="combobox"]:not([disabled]), button[aria-haspopup="dialog"]')
  );

  for (const combo of comboboxes) {
    if (processedElements.has(combo)) continue;
    const label = extractFieldLabel(combo);
    const semantic = classifyField(combo, label);
    const targetVal = getProfileValueForSemantic(profile, semantic);

    if (targetVal) {
      report.totalFieldsFound++;
      firePointerClick(combo);
      await new Promise((r) => setTimeout(r, 120));
      const options = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="option"], [data-radix-collection-item], li[role="treeitem"]'
        )
      );
      const { best } = findBestMatchingOption(options, (opt) => opt.textContent || '', targetVal, semantic, 35);
      if (best) {
        firePointerClick(best);
        report.fieldsFilled++;
        report.details.push({ semantic, label, success: true });
      } else {
        firePointerClick(document.body);
      }
    }
  }

  // 7. Immediate Verification & Reconcile Pass
  verifyAndReconcileAshby(rootElement, profile);

  // 8. Background MutationObserver Guard Window (3.5 seconds)
  if (typeof MutationObserver !== 'undefined') {
    let timer: any = null;
    let runsRemaining = 5;
    const targetNode = rootElement instanceof Document ? rootElement.body : rootElement;
    if (targetNode) {
      const observer = new MutationObserver(() => {
        if (runsRemaining <= 0) {
          observer.disconnect();
          return;
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          if (runsRemaining > 0) {
            runsRemaining--;
            verifyAndReconcileAshby(rootElement, profile);
          }
        }, 200);
      });

      observer.observe(targetNode, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
      }, 3500);
    }
  }

  return report;
}
