import { describe, it, expect } from 'vitest';
import { normalizeText, extractFieldLabel, classifyField } from '../content/core/labelMatcher';

describe('labelMatcher', () => {
  describe('normalizeText', () => {
    it('cleans asterisks, colons, and optional/required badges', () => {
      expect(normalizeText('First Name *')).toBe('first name');
      expect(normalizeText('Email Address: (Required)')).toBe('email address');
      expect(normalizeText('  LinkedIn URL (optional)  ')).toBe('linkedin url');
    });
  });

  describe('extractFieldLabel', () => {
    it('extracts label from <label for="...">', () => {
      document.body.innerHTML = `
        <label for="fname">Legal First Name *</label>
        <input id="fname" type="text" />
      `;
      const input = document.getElementById('fname')!;
      expect(extractFieldLabel(input)).toBe('legal first name');
    });

    it('extracts label from wrapping <label>', () => {
      document.body.innerHTML = `
        <label>
          Your Phone Number (Cell)
          <input id="phone-test" type="tel" />
        </label>
      `;
      const input = document.getElementById('phone-test')!;
      expect(extractFieldLabel(input)).toBe('your phone number (cell)');
    });

    it('extracts label from aria-label', () => {
      document.body.innerHTML = `
        <input id="email-test" aria-label="Candidate Email" type="text" />
      `;
      const input = document.getElementById('email-test')!;
      expect(extractFieldLabel(input)).toBe('candidate email');
    });

    it('extracts label from Ashby field container', () => {
      document.body.innerHTML = `
        <div class="ashby-application-form-field-entry">
          <label>Portfolio / Personal Website</label>
          <div>
            <input id="portfolio-test" type="text" />
          </div>
        </div>
      `;
      const input = document.getElementById('portfolio-test')!;
      expect(extractFieldLabel(input)).toBe('portfolio / personal website');
    });
  });

  describe('classifyField', () => {
    it('accurately classifies names', () => {
      const input1 = document.createElement('input');
      expect(classifyField(input1, 'first name')).toBe('first_name');
      expect(classifyField(input1, 'given name')).toBe('first_name');
      expect(classifyField(input1, 'last name')).toBe('last_name');
      expect(classifyField(input1, 'family name')).toBe('last_name');
      expect(classifyField(input1, 'full name')).toBe('full_name');
    });

    it('accurately classifies contact info', () => {
      const emailInput = document.createElement('input');
      emailInput.type = 'email';
      expect(classifyField(emailInput)).toBe('email');

      const phoneInput = document.createElement('input');
      expect(classifyField(phoneInput, 'Mobile Phone')).toBe('phone');
      expect(classifyField(phoneInput, 'Phone Number *')).toBe('phone');

      const extInput = document.createElement('input');
      expect(classifyField(extInput, 'Phone Extension')).toBe('phone_extension');
      expect(classifyField(extInput, 'Ext.')).toBe('phone_extension');

      const deviceInput = document.createElement('input');
      expect(classifyField(deviceInput, 'Phone Device Type *')).toBe('phone_device_type');

      const codeInput = document.createElement('input');
      expect(classifyField(codeInput, 'Country Phone Code *')).toBe('phone_country_code');
    });

    it('accurately classifies links', () => {
      const input = document.createElement('input');
      expect(classifyField(input, 'LinkedIn Profile')).toBe('linkedin');
      expect(classifyField(input, 'GitHub Profile URL')).toBe('github');
      expect(classifyField(input, 'Personal Website / Portfolio')).toBe('portfolio');
      expect(classifyField(input, 'Twitter / X')).toBe('twitter');
    });

    it('accurately classifies work authorization and sponsorship', () => {
      const input = document.createElement('input');
      expect(
        classifyField(input, 'Are you legally authorized to work in the United States?')
      ).toBe('work_authorized');
      expect(
        classifyField(input, 'Will you now or in the future require employment visa sponsorship?')
      ).toBe('visa_sponsorship');
    });
  });
});
