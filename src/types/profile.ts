export interface PersonalInfo {
  firstName: string;
  lastName: string;
  preferredName?: string;
  pronouns?: string;
  email: string;
  phoneCountryCode: string;
  phone: string;
  phoneDeviceType?: 'Mobile' | 'Landline' | string;
  address?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface Links {
  linkedin: string;
  github: string;
  portfolio: string;
  twitter: string;
  otherWebsite: string;
}

export interface WorkAuthorization {
  authorizedInUS: 'yes' | 'no' | 'unspecified';
  requiresSponsorship: 'yes' | 'no' | 'unspecified';
  noticePeriod: string; // e.g. "Immediate", "2 weeks", "1 month"
  earliestStartDate?: string;
}

export type GenderChoice = 'male' | 'female' | 'non-binary' | 'decline' | '';
export type RaceChoice = 
  | 'white' 
  | 'black' 
  | 'hispanic' 
  | 'asian' 
  | 'south-asian'
  | 'native' 
  | 'pacific' 
  | 'two-or-more' 
  | 'decline' 
  | '';
export type VeteranChoice = 'yes' | 'no' | 'decline' | '';
export type DisabilityChoice = 'yes' | 'no' | 'decline' | '';

export interface EEOInfo {
  gender: GenderChoice;
  race: RaceChoice;
  hispanicOrLatino?: 'yes' | 'no' | 'decline';
  veteran: VeteranChoice;
  disability: DisabilityChoice;
}

export interface WorkExperienceItem {
  id: string;
  jobTitle: string;
  company: string;
  location?: string;
  currentlyWorkHere?: boolean;
  from?: string; // MM/YYYY
  to?: string;   // MM/YYYY
  description?: string;
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  discipline: string;
  gpa?: string;
  from?: string; // YYYY
  to?: string;   // YYYY
}

export interface EducationExperience {
  currentTitle: string;
  currentCompany: string;
  yearsOfExperience: string;
  highestDegree: string;
  school: string;
  degree: string;
  discipline: string;
  graduationYear: string;
  gpa?: string;
  workHistory?: WorkExperienceItem[];
  educationHistory?: EducationItem[];
}

export interface CustomQuestionAnswer {
  id: string;
  questionPattern: string; // fuzzy match or regex
  answer: string;
}

export interface ResumeFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  updatedAt: string;
}

export interface CandidateProfile {
  id: string;
  profileName: string;
  isDefault: boolean;
  updatedAt: string;
  personal: PersonalInfo;
  links: Links;
  workAuth: WorkAuthorization;
  eeo: EEOInfo;
  experience: EducationExperience;
  customQA: CustomQuestionAnswer[];
  resume?: ResumeFile | null;
  source?: string;
}

export const DEFAULT_PROFILE: CandidateProfile = {
  id: 'default-profile',
  profileName: 'Primary Profile',
  isDefault: true,
  updatedAt: new Date().toISOString(),
  resume: null,
  source: 'LinkedIn',
  personal: {
    firstName: '',
    lastName: '',
    preferredName: '',
    pronouns: '',
    email: '',
    phoneCountryCode: '+1',
    phone: '',
    phoneDeviceType: 'Mobile',
    address: '',
    city: '',
    state: '',
    country: 'United States',
    postalCode: '',
  },
  links: {
    linkedin: '',
    github: '',
    portfolio: '',
    twitter: '',
    otherWebsite: '',
  },
  workAuth: {
    authorizedInUS: 'yes',
    requiresSponsorship: 'no',
    noticePeriod: '2 weeks',
    earliestStartDate: '',
  },
  eeo: {
    gender: 'decline',
    race: 'decline',
    hispanicOrLatino: 'no',
    veteran: 'no',
    disability: 'no',
  },
  experience: {
    currentTitle: '',
    currentCompany: '',
    yearsOfExperience: '',
    highestDegree: 'Bachelor\'s Degree',
    school: '',
    degree: 'B.S.',
    discipline: 'Computer Science',
    graduationYear: '',
    gpa: '',
    workHistory: [
      {
        id: 'work-1',
        jobTitle: '',
        company: '',
        location: '',
        currentlyWorkHere: true,
        from: '',
        to: '',
        description: '',
      },
    ],
    educationHistory: [
      {
        id: 'edu-1',
        school: '',
        degree: 'B.S.',
        discipline: 'Computer Science',
        gpa: '',
        from: '',
        to: '',
      },
    ],
  },
  customQA: [],
};
