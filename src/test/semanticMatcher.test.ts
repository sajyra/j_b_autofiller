import { describe, it, expect } from 'vitest';
import { scoreChoiceMatch, findBestMatchingOption } from '../content/core/semanticMatcher';

describe('semanticMatcher', () => {
  describe('Race / Ethnicity with South Asian logic', () => {
    it('picks South Asian specific option when available', () => {
      const options = [
        'White (Not Hispanic or Latino)',
        'East Asian (Chinese, Japanese, Korean, Taiwanese)',
        'South Asian (Asian Indian, Pakistani, Bangladeshi, etc.)',
        'Black or African American',
      ];

      const { best } = findBestMatchingOption(
        options,
        (opt) => opt,
        'south-asian',
        'eeo_race'
      );

      expect(best).toBe('South Asian (Asian Indian, Pakistani, Bangladeshi, etc.)');
    });

    it('falls back to generic Asian when specific South Asian option is not present', () => {
      const options = [
        'White',
        'Black or African American',
        'Asian',
        'Hispanic or Latino',
        'I do not wish to answer',
      ];

      const { best } = findBestMatchingOption(
        options,
        (opt) => opt,
        'south-asian',
        'eeo_race'
      );

      expect(best).toBe('Asian');
    });

    it('strictly does NOT pick East Asian or Chinese for a South Asian candidate', () => {
      const eastScore = scoreChoiceMatch(
        'East Asian (Chinese, Japanese, Korean)',
        'south-asian',
        'eeo_race'
      );
      expect(eastScore).toBe(-100);

      const chineseScore = scoreChoiceMatch('Chinese', 'south-asian', 'eeo_race');
      expect(chineseScore).toBe(-100);

      // If only East Asian exists alongside decline, it should not pick East Asian
      const options = [
        'East Asian',
        'I do not wish to answer',
      ];
      const { best } = findBestMatchingOption(
        options,
        (opt) => opt,
        'south-asian',
        'eeo_race',
        50
      );
      expect(best).not.toBe('East Asian');
    });
  });

  describe('Gender semantic variations', () => {
    it('matches "Man" or "Cisgender Male" to male', () => {
      const options = ['Woman', 'Man', 'Non-binary', 'I choose not to disclose'];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'male', 'eeo_gender');
      expect(best).toBe('Man');
    });

    it('matches "Cisgender Female" to female', () => {
      const options = ['Cisgender Male', 'Cisgender Female', 'Prefer not to say'];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'female', 'eeo_gender');
      expect(best).toBe('Cisgender Female');
    });
  });

  describe('Decline variations', () => {
    it('matches various ATS decline phrasing', () => {
      const variations = [
        'I choose not to disclose',
        'Prefer not to answer',
        'I do not wish to self-identify',
        'Opt out / decline',
      ];

      for (const phrase of variations) {
        const score = scoreChoiceMatch(phrase, 'decline', 'eeo_race');
        expect(score).toBeGreaterThanOrEqual(90);
      }
    });
  });

  describe('Work authorization & sponsorship long-form choices', () => {
    it('matches unrestricted legal authorization phrasing', () => {
      const options = [
        'I am legally authorized to work in the United States without restriction',
        'I am not authorized to work in the United States',
      ];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'yes', 'work_authorized');
      expect(best).toBe(
        'I am legally authorized to work in the United States without restriction'
      );
    });

    it('matches negative sponsorship phrasing', () => {
      const options = [
        'I will require visa sponsorship now or in the future',
        'I will not require visa sponsorship now or in the future',
      ];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'no', 'visa_sponsorship');
      expect(best).toBe(
        'I will not require visa sponsorship now or in the future'
      );
    });
  });

  describe('Veteran and Disability long-form phrasing', () => {
    it('matches protected veteran statement', () => {
      const options = [
        'I identify as one or more of the classifications of protected veteran',
        'I am not a protected veteran',
        'I do not wish to answer',
      ];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'yes', 'eeo_veteran');
      expect(best).toBe(
        'I identify as one or more of the classifications of protected veteran'
      );
    });

    it('matches no disability statement', () => {
      const options = [
        'Yes, I have a disability (or previously had a disability)',
        'No, I do not have a disability',
        'I do not wish to answer',
      ];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'no', 'eeo_disability');
      expect(best).toBe('No, I do not have a disability');
    });
  });

  describe('State abbreviation and name matching', () => {
    it('matches "Texas" to full name or abbreviation variations', () => {
      const options = ['California', 'New York', 'Texas', 'Washington'];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'Texas', 'state');
      expect(best).toBe('Texas');

      const abbrOptions = ['CA', 'NY', 'TX', 'WA'];
      const resAbbr = findBestMatchingOption(abbrOptions, (opt) => opt, 'Texas', 'state');
      expect(resAbbr.best).toBe('TX');

      const combinedOptions = ['CA - California', 'TX - Texas', 'WA - Washington'];
      const resCombined = findBestMatchingOption(combinedOptions, (opt) => opt, 'Texas', 'state');
      expect(resCombined.best).toBe('TX - Texas');
    });
  });

  describe('Phone device type matching', () => {
    it('matches "Mobile" to Mobile/Cell choices', () => {
      const options = ['Landline', 'Mobile', 'Fax'];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'Mobile', 'phone_device_type');
      expect(best).toBe('Mobile');
    });

    it('prefers Home when only Home and Home Cellular are available (NVIDIA Workday style)', () => {
      const options = ['Select One', 'Home', 'Home Cellular'];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'Mobile', 'phone_device_type');
      expect(best).toBe('Home');
    });

    it('chooses anything valid over Select One placeholder', () => {
      const options = ['Select One', 'Work', 'Other'];
      const { best } = findBestMatchingOption(options, (opt) => opt, 'Mobile', 'phone_device_type');
      expect(best).not.toBe('Select One');
      expect(best).toBe('Work');
    });
  });

  describe('Country and Phone Country Code matching (Anti-Minor-Outlying-Islands)', () => {
    it('always selects United States of America over United States Minor Outlying Islands', () => {
      // In Workday and Ashby, Minor Outlying Islands comes before United States of America alphabetically!
      const options = [
        'United Kingdom',
        'United States Minor Outlying Islands',
        'United States of America',
        'Uruguay',
      ];

      const resUnitedStates = findBestMatchingOption(options, (opt) => opt, 'United States', 'country');
      expect(resUnitedStates.best).toBe('United States of America');

      const resUSA = findBestMatchingOption(options, (opt) => opt, 'United States of America', 'country');
      expect(resUSA.best).toBe('United States of America');
    });

    it('always selects United States (+1) over United States Minor Outlying Islands (+1) for phone code', () => {
      const options = [
        'United Kingdom (+44)',
        'United States Minor Outlying Islands (+1)',
        'United States of America (+1)',
        'Uruguay (+598)',
      ];

      const resPhoneCode = findBestMatchingOption(options, (opt) => opt, '+1', 'phone_country_code');
      expect(resPhoneCode.best).toBe('United States of America (+1)');
    });

    it('never matches Minor Outlying Islands in general fallback if target is United States', () => {
      const scoreMinor = scoreChoiceMatch('United States Minor Outlying Islands', 'United States');
      const scoreUSA = scoreChoiceMatch('United States of America', 'United States');
      expect(scoreMinor).toBeLessThan(0);
      expect(scoreUSA).toBeGreaterThan(0);
    });
  });
});

