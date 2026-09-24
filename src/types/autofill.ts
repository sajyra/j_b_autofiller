export type ATSPlatform = 'ashby' | 'workday' | 'unknown';

export type FieldSemantic =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'phone_country_code'
  | 'address'
  | 'city'
  | 'state'
  | 'country'
  | 'postal_code'
  | 'location'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'twitter'
  | 'other_website'
  | 'work_authorized'
  | 'visa_sponsorship'
  | 'relocation'
  | 'office_commitment'
  | 'notice_period'
  | 'start_date'
  | 'current_company'
  | 'current_title'
  | 'years_experience'
  | 'highest_degree'
  | 'school'
  | 'graduation_date'
  | 'degree_type'
  | 'degree'
  | 'discipline'
  | 'field_of_study'
  | 'eeo_gender'
  | 'eeo_race'
  | 'eeo_veteran'
  | 'eeo_disability'
  | 'eeo_hispanic'
  | 'phone_device_type'
  | 'phone_extension'
  | 'source'
  | 'disability_signature'
  | 'disability_date'
  | 'resume'
  | 'salary'
  | 'custom_question'
  | 'unknown';

export interface FieldMatch {
  element: HTMLElement;
  semantic: FieldSemantic;
  confidence: number;
  label: string;
  fieldType: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file';
  matchedValue?: any;
}

export interface AutofillReport {
  timestamp: number;
  platform: ATSPlatform;
  url: string;
  totalFieldsFound: number;
  fieldsFilled: number;
  details: {
    semantic: FieldSemantic;
    label: string;
    success: boolean;
    reason?: string;
  }[];
}
