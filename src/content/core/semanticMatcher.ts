import { FieldSemantic } from '../../types/autofill';
import { CandidateProfile } from '../../types/profile';
import { normalizeText } from './labelMatcher';

export interface SemanticMatchResult<T> {
  best: T | null;
  score: number;
}

/**
 * Stop words and negative filters for precise regional/ethnic matching.
 */
const EAST_ASIAN_KEYWORDS = [
  'east asian',
  'chinese',
  'japanese',
  'korean',
  'taiwanese',
  'mongolian',
];

const SOUTHEAST_ASIAN_KEYWORDS = [
  'southeast asian',
  'filipino',
  'vietnamese',
  'thai',
  'cambodian',
  'hmong',
  'laotian',
  'indonesian',
  'malaysian',
];

const SOUTH_ASIAN_SPECIFIC_KEYWORDS = [
  'south asian',
  'asian indian',
  'indian subcontinent',
  'pakistani',
  'bangladeshi',
  'sri lankan',
  'nepali',
  'afghan',
];

const DECLINE_KEYWORDS = [
  'decline',
  'prefer not',
  'do not wish',
  'choose not',
  'undisclosed',
  'withhold',
  'not disclose',
  'opt out',
  'skip',
];

export const US_STATES: Record<string, string> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
  co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia',
  hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa',
  ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
  ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi', mo: 'missouri',
  mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire', nj: 'new jersey',
  nm: 'new mexico', ny: 'new york', nc: 'north carolina', nd: 'north dakota', oh: 'ohio',
  ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina',
  sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont',
  va: 'virginia', wa: 'washington', wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming',
  dc: 'district of columbia',
};

/**
 * Scores an option string against candidate's profile choice and field semantic.
 * Returns a score between -100 and 100.
 */
export function scoreChoiceMatch(
  optionText: string,
  targetValue: string,
  semantic?: FieldSemantic
): number {
  if (!optionText || !targetValue) return 0;

  const opt = normalizeText(optionText);
  const target = normalizeText(targetValue);

  // Exact match
  if (opt === target) return 100;

  // 1. Decline / Prefer not to say (Applies across all EEO questions)
  if (target === 'decline' || target.includes('decline')) {
    if (DECLINE_KEYWORDS.some((kw) => opt.includes(kw))) {
      return 95;
    }
  }

  // If candidate did NOT choose decline, heavily penalize decline options
  if (target !== 'decline' && DECLINE_KEYWORDS.some((kw) => opt.includes(kw))) {
    return -50;
  }

  // 2. Race / Ethnicity semantics
  if (semantic === 'eeo_race') {
    // Handling South Asian
    if (target === 'south-asian' || target === 'south asian' || target === 'asian') {
      // Rule 1: NEVER match East Asian or Chinese if candidate is South Asian
      if (EAST_ASIAN_KEYWORDS.some((kw) => opt.includes(kw))) {
        return -100;
      }
      if (SOUTHEAST_ASIAN_KEYWORDS.some((kw) => opt.includes(kw))) {
        return -100;
      }

      // Rule 2: High priority for specific South Asian choices
      if (SOUTH_ASIAN_SPECIFIC_KEYWORDS.some((kw) => opt.includes(kw))) {
        return 98;
      }

      // Rule 3: High priority for generic "Asian" or "Asian (Not Hispanic or Latino)"
      if (opt === 'asian' || opt.startsWith('asian ') || opt.includes('asian (not hispanic')) {
        return 85;
      }
    }

    // White / Caucasian
    if (target === 'white') {
      if (opt.includes('white') || opt.includes('caucasian') || opt.includes('european')) {
        return 95;
      }
    }

    // Black / African American
    if (target === 'black') {
      if (opt.includes('black') || opt.includes('african american')) {
        return 95;
      }
    }

    // Hispanic / Latino
    if (target === 'hispanic') {
      if (opt.includes('hispanic') || opt.includes('latino') || opt.includes('latina') || opt.includes('spanish origin')) {
        return 95;
      }
    }

    // Native American
    if (target === 'native') {
      if (opt.includes('american indian') || opt.includes('alaska native') || opt.includes('indigenous')) {
        return 95;
      }
    }

    // Pacific Islander
    if (target === 'pacific') {
      if (opt.includes('pacific islander') || opt.includes('native hawaiian')) {
        return 95;
      }
    }

    // Two or more
    if (target === 'two-or-more') {
      if (opt.includes('two or more') || opt.includes('multiracial') || opt.includes('multiple')) {
        return 95;
      }
    }
  }

  // 3. Gender & Pronoun Semantics
  if (semantic === 'eeo_gender') {
    if (target === 'male' || target === 'he/him' || target === 'he') {
      if (/\b(male|man|cisgender male|he\/him)\b/i.test(opt) && !opt.includes('female') && !opt.includes('woman') && !opt.includes('she')) {
        return 95;
      }
    }
    if (target === 'female' || target === 'she/her' || target === 'she') {
      if (/\b(female|woman|cisgender female|she\/her)\b/i.test(opt)) {
        return 95;
      }
    }
    if (target === 'non-binary' || target === 'they/them' || target === 'they') {
      if (/\b(non-binary|nonbinary|genderqueer|gender non-conforming|they\/them)\b/i.test(opt)) {
        return 95;
      }
    }
  }

  // 4. Veteran Semantics
  if (semantic === 'eeo_veteran') {
    if (target === 'yes') {
      if (
        opt.includes('identify as one or more') ||
        (opt.includes('veteran') && !opt.includes('not a') && !opt.includes('non-veteran')) ||
        opt === 'yes'
      ) {
        return 95;
      }
    }
    if (target === 'no') {
      if (opt.includes('not a protected veteran') || opt.includes('not a veteran') || opt.includes('non-veteran') || opt === 'no') {
        return 95;
      }
    }
  }

  // 5. Disability Semantics
  if (semantic === 'eeo_disability') {
    if (target === 'yes') {
      if ((opt.includes('have a disability') && !opt.includes('no')) || opt === 'yes') {
        return 95;
      }
    }
    if (target === 'no') {
      if (opt.includes('do not have a disability') || opt.includes('dont have a disability') || opt.includes('no disability') || opt === 'no') {
        return 95;
      }
    }
  }

  // 6. Work Authorization Semantics
  if (semantic === 'work_authorized') {
    if (target === 'yes') {
      if (
        opt === 'yes' ||
        opt.includes('authorized to work') ||
        opt.includes('legally authorized') ||
        opt.includes('eligible to work') ||
        opt.includes('citizen') ||
        opt.includes('permanent resident')
      ) {
        return 95;
      }
    }
    if (target === 'no') {
      if (opt === 'no' || opt.includes('not authorized') || opt.includes('unauthorized') || opt.includes('ineligible')) {
        return 95;
      }
    }
  }

  // 7. Visa Sponsorship Semantics
  if (semantic === 'visa_sponsorship') {
    if (target === 'yes') {
      if (
        opt === 'yes' ||
        opt.includes('will require') ||
        opt.includes('require sponsorship') ||
        opt.includes('need sponsorship') ||
        opt.includes('visa sponsorship')
      ) {
        return 95;
      }
    }
    if (target === 'no') {
      if (
        opt === 'no' ||
        opt === 'none' ||
        opt.includes('none') ||
        opt.includes('will not require') ||
        opt.includes('do not require') ||
        opt.includes('no sponsorship') ||
        opt.includes('not require')
      ) {
        return 95;
      }
    }
  }

  // 8. Hispanic / Latino Semantics
  if (semantic === 'eeo_hispanic') {
    if (target === 'no') {
      if (
        opt === 'no' ||
        opt.includes('not hispanic') ||
        opt.includes('no, not hispanic') ||
        opt.includes('non-hispanic')
      ) {
        return 95;
      }
    }
    if (target === 'yes') {
      if (
        (opt.includes('hispanic') || opt.includes('latino')) &&
        !opt.includes('not hispanic') &&
        !opt.includes('non-hispanic')
      ) {
        return 95;
      }
      if (opt === 'yes') return 95;
    }
  }

  // 9. Phone Device Type Semantics
  if (semantic === 'phone_device_type') {
    const targetLower = target.toLowerCase();
    const optLower = opt.toLowerCase();

    // Heavy penalty for placeholders
    if (optLower.includes('select one') || optLower.includes('select...') || optLower === 'select') {
      return -50;
    }

    if (targetLower === 'mobile' || targetLower === 'cell' || targetLower === 'cellular') {
      if (optLower === 'mobile') return 100;
      if (optLower.includes('mobile')) return 95;
      // Per user preference: if only Home or Home Cellular are available, pick Home!
      if (optLower === 'home') return 90;
      if (optLower.includes('home cellular')) return 85;
      if (optLower.includes('cellular') || optLower.includes('cell')) return 80;
      if (optLower.includes('landline') || optLower.includes('primary')) return 75;
      // Fallback: choose anything valid over nothing / placeholder
      if (optLower.trim().length > 0) return 50;
    }
    if (targetLower === 'landline' || targetLower === 'home') {
      if (optLower === 'home') return 100;
      if (optLower.includes('landline') || optLower.includes('home')) return 95;
      if (optLower.includes('mobile') || optLower.includes('cell')) return 80;
      if (optLower.trim().length > 0) return 50;
    }
  }

  // 10. Source / How Did You Hear About Us Semantics
  if (semantic === 'source') {
    if (target.toLowerCase().includes('linkedin')) {
      if (opt.includes('linkedin')) return 98;
      if (opt.includes('job board') || opt.includes('job boards')) return 80;
      if (opt.includes('social media') || opt.includes('internet')) return 75;
    }
  }

  // 11. State Semantics (handles full names and abbreviations like Texas <-> TX)
  if (semantic === 'state') {
    const targetState = target.toLowerCase();
    let targetFull = targetState;
    let targetAbbr = '';
    for (const [abbr, full] of Object.entries(US_STATES)) {
      if (abbr === targetState || full === targetState) {
        targetFull = full;
        targetAbbr = abbr;
        break;
      }
    }

    const optLower = opt.toLowerCase();
    if (
      optLower === targetFull ||
      optLower === targetAbbr ||
      optLower.startsWith(targetFull + ' ') ||
      optLower.includes(`(${targetAbbr.toUpperCase()})`) ||
      optLower.includes(`(${targetAbbr})`) ||
      optLower.includes(` - ${targetAbbr.toUpperCase()}`) ||
      optLower.includes(`${targetAbbr.toUpperCase()} - `) ||
      new RegExp(`\\b${targetFull}\\b`, 'i').test(optLower)
    ) {
      return 98;
    }

    if (targetAbbr && new RegExp(`\\b${targetAbbr}\\b`, 'i').test(optLower)) {
      return 95;
    }
  }

  // 12. Degree Semantics (matches Bachelor's, B.S., Master's, etc.)
  if (semantic === 'degree' || semantic === 'degree_type' || semantic === 'highest_degree') {
    const targetLower = target.toLowerCase();
    const optLower = opt.toLowerCase();

    const isBachelors = /bachelor|bs\b|b\.s|undergrad/i.test(targetLower);
    const isMasters = /master|ms\b|m\.s|mba|grad/i.test(targetLower);
    const isDoctorate = /phd|doctorate/i.test(targetLower);

    if (isBachelors) {
      if (/\b(bachelors?|b\.?s\.?|b\.?a\.?|undergraduate)\b/i.test(optLower)) {
        if (targetLower.includes('science') || targetLower.includes('b.s') || targetLower === 'bs') {
          if (/science|b\.?s\.?/i.test(optLower)) return 99;
        }
        return 95;
      }
    }
    if (isMasters) {
      if (/\b(masters?|m\.?s\.?|m\.?a\.?|graduate|mba)\b/i.test(optLower)) {
        return 95;
      }
    }
    if (isDoctorate) {
      if (/\b(doctorates?|ph\.?d)\b/i.test(optLower)) {
        return 95;
      }
    }
  }

  // 13. Discipline / Field of Study Semantics
  if (semantic === 'discipline' || semantic === 'field_of_study' || semantic === 'custom_question') {
    const isCS = /computer\s*science|\bcs\b/i.test(target);
    if (isCS && /computer.*science/i.test(opt)) {
      return 98;
    }
  }

  // 14. Country Semantics
  if (semantic === 'country') {
    const isTargetUS =
      /\b(united states|usa|u\.s\.a|u\.s\b|us\b|america)\b/i.test(target) &&
      !target.includes('minor outlying') &&
      !target.includes('virgin islands');

    if (isTargetUS) {
      // NEVER match Minor Outlying Islands or Virgin Islands when target is United States
      if (opt.includes('minor outlying') || opt.includes('outlying island')) {
        return -100;
      }
      if (opt.includes('virgin islands')) {
        return -50;
      }
      // Exact full matches
      if (
        opt === 'united states of america' ||
        opt === 'united states' ||
        opt === 'usa' ||
        opt === 'u.s.a.' ||
        opt === 'united states (us)' ||
        opt === 'us - united states'
      ) {
        return 100;
      }
      if (opt.includes('united states of america')) {
        return 99;
      }
      if (opt.startsWith('united states') && !opt.includes('minor') && !opt.includes('island')) {
        return 98;
      }
    }
  }

  // 15. Phone Country Code Semantics (e.g. +1 / US)
  if (semantic === 'phone_country_code') {
    const isTargetUS =
      target === '+1' ||
      target === '1' ||
      /\b(united states|usa|us)\b/i.test(target);

    if (isTargetUS) {
      if (opt.includes('minor outlying') || opt.includes('outlying island')) {
        return -100;
      }
      if (opt.includes('virgin islands')) {
        return -50;
      }
      if (opt.includes('united states of america (+1)') || opt.includes('united states (+1)')) {
        return 100;
      }
      if (opt.includes('united states of america') || opt.includes('united states')) {
        return 98;
      }
      if (opt.includes('+1')) {
        if (opt.includes('canada')) return 70;
        return 85;
      }
    }
  }

  // Universal rule: If target does not specify "minor outlying", NEVER match "minor outlying islands"
  if (!target.includes('minor outlying') && (opt.includes('minor outlying') || opt.includes('outlying island'))) {
    return -100;
  }

  // 8. General Substring & Token Overlap Fallback
  if (opt.includes(target) || target.includes(opt)) {
    return 70;
  }

  const optTokens = new Set(opt.split(/\s+/));
  const targetTokens = target.split(/\s+/);
  const common = targetTokens.filter((t) => optTokens.has(t));
  if (common.length > 0) {
    if (targetTokens.length > 1 && common.length === targetTokens.length) {
      return 85;
    }
    return Math.round((common.length / Math.max(optTokens.size, targetTokens.length)) * 60);
  }

  return 0;
}

/**
 * Finds the highest-scoring candidate option from an array.
 */
export function findBestMatchingOption<T>(
  options: T[],
  getLabel: (opt: T) => string,
  targetValue: string,
  semantic?: FieldSemantic,
  minThreshold = 50
): SemanticMatchResult<T> {
  let best: T | null = null;
  let bestScore = -Infinity;

  for (const opt of options) {
    const label = getLabel(opt);
    const score = scoreChoiceMatch(label, targetValue, semantic);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }

  if (bestScore >= minThreshold) {
    return { best, score: bestScore };
  }

  return { best: null, score: bestScore };
}

/**
 * Value mapping helper that returns the appropriate value from candidate profile for a given semantic.
 * Supports both Ashby and Workday semantics.
 */
export function getProfileValueForSemantic(profile: CandidateProfile, semantic: FieldSemantic): string | null {
  switch (semantic) {
    case 'first_name':
      return profile.personal.firstName;
    case 'last_name':
      return profile.personal.lastName;
    case 'full_name': {
      const first = (profile.personal.firstName || '').trim();
      const last = (profile.personal.lastName || '').trim();
      const full = `${first} ${last}`.trim();
      return full
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
    case 'email':
      return profile.personal.email;
    case 'phone':
      return profile.personal.phone;
    case 'phone_country_code':
      return profile.personal.phoneCountryCode || '+1';
    case 'phone_device_type':
      return profile.personal.phoneDeviceType || 'Mobile';
    case 'phone_extension':
      return '';
    case 'address':
      return profile.personal.address || '';
    case 'city':
      return profile.personal.city;
    case 'state':
      return profile.personal.state;
    case 'country':
      return profile.personal.country;
    case 'postal_code':
      return profile.personal.postalCode;
    case 'location':
      return profile.personal.city
        ? `${profile.personal.city}${profile.personal.state ? `, ${profile.personal.state}` : ''}`
        : profile.personal.state || profile.personal.country;
    case 'linkedin':
      return profile.links.linkedin;
    case 'github':
      return profile.links.github;
    case 'portfolio':
      return profile.links.portfolio;
    case 'twitter':
      return profile.links.twitter;
    case 'other_website':
      return profile.links.otherWebsite;
    case 'work_authorized':
      return profile.workAuth.authorizedInUS;
    case 'visa_sponsorship':
      return profile.workAuth.requiresSponsorship;
    case 'office_commitment':
      return 'yes';
    case 'relocation':
      return 'yes';
    case 'notice_period':
      return profile.workAuth.noticePeriod;
    case 'start_date':
      return profile.workAuth.earliestStartDate || profile.workAuth.noticePeriod;
    case 'current_company':
      return profile.experience.currentCompany;
    case 'current_title':
      return profile.experience.currentTitle;
    case 'years_experience':
      return profile.experience.yearsOfExperience;
    case 'highest_degree':
      return profile.experience.highestDegree;
    case 'school':
      return profile.experience.school;
    case 'graduation_date':
      return profile.experience.graduationYear
        ? profile.experience.graduationYear.length === 4
          ? `05/15/${profile.experience.graduationYear}`
          : profile.experience.graduationYear
        : '05/15/2026';
    case 'degree':
      return profile.experience.degree;
    case 'degree_type':
      return profile.experience.highestDegree;
    case 'eeo_gender':
      return profile.personal.pronouns || profile.eeo.gender;
    case 'eeo_race':
      return profile.eeo.race;
    case 'eeo_hispanic':
      return profile.eeo.hispanicOrLatino || 'no';
    case 'eeo_veteran':
      return profile.eeo.veteran;
    case 'eeo_disability':
      return profile.eeo.disability;
    case 'source':
      return profile.source || 'LinkedIn';
    case 'disability_signature':
      return `${profile.personal.firstName} ${profile.personal.lastName}`.trim();
    case 'disability_date': {
      const d = new Date();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    }
    default:
      return null;
  }
}
