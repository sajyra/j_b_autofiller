import { FieldSemantic } from '../../types/autofill';

/**
 * Normalizes label text by stripping punctuation, extra spaces, and common decorative tags.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[*:\n\r\t]/g, ' ')
    .replace(/\s*\((optional|required)\)\s*/gi, '')
    .replace(/\b(optional|required)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the most probable human-readable label associated with a DOM input element.
 */
export function extractFieldLabel(element: HTMLElement): string {
  // 1. Check aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim().length > 0) {
    return normalizeText(ariaLabel);
  }

  // 2. Check aria-labelledby
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labellingEl = document.getElementById(ariaLabelledBy);
    if (labellingEl && labellingEl.textContent) {
      return normalizeText(labellingEl.textContent);
    }
  }

  // 3. Check <label for="...">
  const id = element.getAttribute('id');
  if (id) {
    const directLabel = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (directLabel && directLabel.textContent) {
      return normalizeText(directLabel.textContent);
    }
  }

  // 4. Check wrapping <label>
  const parentLabel = element.closest('label');
  if (parentLabel && parentLabel.textContent) {
    // Clone and remove inputs/selects to only get pure label text
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll('input, select, textarea, button');
    inputs.forEach((el) => el.remove());
    if (clone.textContent && clone.textContent.trim().length > 0) {
      return normalizeText(clone.textContent);
    }
  }

  // 5. Check container/parent field entry label (e.g., .ashby-application-form-field-entry, [data-testid*="field"])
  const container = element.closest(
    '.ashby-application-form-field-entry, [class*="form-field"], [class*="formField"], [class*="FieldEntry"], [class*="fieldContainer"], [class*="field_entry"], .form-group, fieldset'
  );
  if (container) {
    const labelInContainer = container.querySelector('label, [class*="label"], [class*="prompt"], [class*="title"], legend, h3, h4');
    if (labelInContainer && labelInContainer.textContent && !labelInContainer.querySelector('input, select, textarea')) {
      return normalizeText(labelInContainer.textContent);
    }
  }

  // 6. Check preceding sibling element
  let prev = element.previousElementSibling;
  while (prev) {
    if (prev.matches('label, span, div, p') && prev.textContent && prev.textContent.trim().length > 0) {
      return normalizeText(prev.textContent);
    }
    prev = prev.previousElementSibling;
  }

  // 7. Check placeholder attribute
  const placeholder = element.getAttribute('placeholder');
  if (placeholder && placeholder.trim().length > 0) {
    return normalizeText(placeholder);
  }

  // 8. Fallback to name or id attribute
  const name = element.getAttribute('name');
  if (name) {
    return normalizeText(name.replace(/[-_]/g, ' '));
  }

  return '';
}

/**
 * Classifies an element's semantic meaning based on its label, autocomplete attribute, type, and name.
 */
export function classifyField(element: HTMLElement, extractedLabel?: string): FieldSemantic {
  const rawLabel = extractedLabel !== undefined ? extractedLabel : extractFieldLabel(element);
  const label = normalizeText(rawLabel);
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
  const name = (element.getAttribute('name') || '').toLowerCase();
  const type = (element.getAttribute('type') || '').toLowerCase();

  // Autocomplete attribute fast-paths
  if (autocomplete === 'given-name') return 'first_name';
  if (autocomplete === 'family-name') return 'last_name';
  if (autocomplete === 'name') return 'full_name';
  if (autocomplete === 'email') return 'email';
  if (autocomplete === 'tel' || autocomplete === 'tel-national') return 'phone';
  if (autocomplete === 'address-line1' || autocomplete === 'street-address') return 'address';
  if (autocomplete === 'address-level2') return 'city';
  if (autocomplete === 'address-level1') return 'state';
  if (autocomplete === 'postal-code') return 'postal_code';
  if (autocomplete === 'country-name' || autocomplete === 'country') return 'country';

  // Specific input types
  if (type === 'email') return 'email';
  if (type === 'tel') return 'phone';

  // Multi-pass pattern matching on label and name
  const text = `${label} ${name}`;

  // Resume / CV
  if (/\b(resume|cv|curriculum vitae)\b/i.test(text)) {
    return 'resume';
  }
  if (type === 'file' && !/\b(cover letter|portfolio|transcript)\b/i.test(text)) {
    return 'resume';
  }

  // Work Authorization / Sponsorship (match before generic questions)
  if (
    /authorized to work|legal.*authoriz|authoriz.*(work|us|united states)|eligible to work|authorized.*lawfully/i.test(text)
  ) {
    return 'work_authorized';
  }
  if (/require.*sponsor|visa.*sponsor|sponsorship/i.test(text)) {
    return 'visa_sponsorship';
  }

  // Office Commitment / Anchor Days
  if (/anchor days|commit.*working.*from.*office|work.*from.*office/i.test(text)) {
    return 'office_commitment';
  }

  // Relocation
  if (/willing to relocate|relocate.*role|relocating to/i.test(text)) {
    return 'relocation';
  }

  // Education & School
  if (/\b(degree type|degree level|education level)\b/i.test(text)) {
    return 'degree_type';
  }
  if (/\b(graduat.*date|grad.*date|graduat.*year|year.*graduat)\b/i.test(text)) {
    return 'graduation_date';
  }
  if (/\b(school|university|college|alma mater|institution)\b/i.test(text)) {
    return 'school';
  }
  if (/\b(degree|major|field of study)\b/i.test(text)) {
    return 'degree';
  }

  // Personal Info
  if (/\b(first name|given name|forename|legal first name)\b/i.test(text)) {
    return 'first_name';
  }
  if (/\b(last name|family name|surname|legal last name)\b/i.test(text)) {
    return 'last_name';
  }
  if (/\b(full name|legal name|candidate name|your name)\b/i.test(text)) {
    return 'full_name';
  }
  if (text.includes('email') || text.includes('e-mail')) {
    return 'email';
  }
  // Phone Extension (must be matched before generic phone)
  if (
    /\b(phone extension|extension|extn|ext\.?)\b/i.test(text) ||
    /\b(extension|extn)\b/i.test(name) ||
    /\b(extension|extn)\b/i.test(element.id || '') ||
    /\b(extension|extn)\b/i.test(element.getAttribute('data-automation-id') || '')
  ) {
    return 'phone_extension';
  }

  // Phone Device Type
  if (/\b(phone device type|phone device|device type|phone type)\b/i.test(text)) {
    return 'phone_device_type';
  }

  // Country Phone Code
  if (/\b(country phone code|country code|dialing code|phone code)\b/i.test(text)) {
    return 'phone_country_code';
  }

  if (
    /\b(phone|mobile|cell|telephone|phone number|contact number)\b/i.test(text) ||
    /1-415-555|\+1\s*\d{3}|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/i.test(element.getAttribute('placeholder') || '')
  ) {
    return 'phone';
  }

  // Links & Socials
  if (text.includes('linkedin')) return 'linkedin';
  if (text.includes('github')) return 'github';
  if (text.includes('twitter') || text.includes(' x url') || text.includes('x profile')) return 'twitter';
  if (text.includes('portfolio') || text.includes('personal site') || text.includes('personal website')) return 'portfolio';
  if (/\b(website|other website|other link|url)\b/i.test(text)) return 'other_website';

  // Location
  if (/\b(current location|location)\b/i.test(text)) {
    return 'location';
  }
  if (/\b(city|current city|where are you located)\b/i.test(text)) {
    return 'city';
  }
  if (/\b(state|province|region)\b/i.test(text)) {
    return 'state';
  }
  if (/\b(postal code|zip code|zip)\b/i.test(text)) {
    return 'postal_code';
  }
  if (/\b(country)\b/i.test(text)) {
    return 'country';
  }
  if (/\b(street address|address line|home address|address)\b/i.test(text)) {
    return 'address';
  }

  // Notice Period & Availability
  if (/\b(notice period|earliest start date|start date|availability)\b/i.test(text)) {
    return 'notice_period';
  }

  // Work & Experience
  if (/\b(current company|current employer|employer)\b/i.test(text)) {
    return 'current_company';
  }
  if (/\b(current title|current job title|current role|job title)\b/i.test(text)) {
    return 'current_title';
  }
  if (/\b(years.*experience|total experience)\b/i.test(text)) {
    return 'years_experience';
  }

  // EEO Demographics & Pronouns
  if (/\b(gender|gender identity|sex|pronoun|pronouns)\b/i.test(text)) {
    return 'eeo_gender';
  }
  if (/\b(race|ethnicity|ethnic background)\b/i.test(text)) {
    return 'eeo_race';
  }
  if (/\b(veteran|military status|veteran status)\b/i.test(text)) {
    return 'eeo_veteran';
  }
  if (/\b(disability|handicap|disability status)\b/i.test(text)) {
    return 'eeo_disability';
  }

  // Generic fallback if text has "name" alone and nothing matched
  if (/\bname\b/i.test(label) && !/\b(company|school|user|file|emergency)\b/i.test(label)) {
    return 'full_name';
  }

  return 'unknown';
}
