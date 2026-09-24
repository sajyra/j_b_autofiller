import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isWorkdayForm,
  detectWorkdayStep,
  autofillWorkday,
  handleWorkdayResumeUpload,
  formatWorkdayMonthYear,
} from '../content/workday/workdayFiller';
import { selectWorkdayComboboxOption } from '../content/workday/workdayCombobox';
import { CandidateProfile, DEFAULT_PROFILE } from '../types/profile';
import { AutofillReport } from '../types/autofill';

describe('Workday Autofill Integration Tests', () => {
  const sampleResumeDataUrl =
    'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2Jq';

  const testCandidate: CandidateProfile = {
    ...DEFAULT_PROFILE,
    source: 'LinkedIn',
    personal: {
      firstName: 'Sanjay',
      lastName: 'Rajjan',
      preferredName: 'Sanju',
      email: 'sanjay.rajjan@example.com',
      phoneCountryCode: '+1',
      phone: '4697157358',
      phoneDeviceType: 'Mobile',
      address: '100 Main St Apt 4B',
      city: 'Austin',
      state: 'Texas',
      country: 'United States of America',
      postalCode: '78701',
    },
    links: {
      linkedin: 'https://www.linkedin.com/in/sanjayrajjan/',
      github: 'https://github.com/sanjayrajjan',
      portfolio: 'https://sanjayrajjan.dev',
      twitter: '',
      otherWebsite: '',
    },
    workAuth: {
      authorizedInUS: 'yes',
      requiresSponsorship: 'no',
      noticePeriod: '2 weeks',
      earliestStartDate: 'Immediate',
    },
    experience: {
      currentTitle: 'Software Engineer',
      currentCompany: 'Tech Corp',
      yearsOfExperience: '4',
      highestDegree: "Bachelor's Degree",
      school: 'University of Texas at Austin',
      degree: 'B.S.',
      discipline: 'Computer Science',
      graduationYear: '2026',
      gpa: '3.85',
    },
    eeo: {
      gender: 'male',
      race: 'south-asian',
      hispanicOrLatino: 'no',
      veteran: 'no',
      disability: 'no',
    },
    resume: {
      name: 'Sanjay_Rajjan_Resume.pdf',
      type: 'application/pdf',
      size: 1024,
      dataUrl: sampleResumeDataUrl,
      updatedAt: new Date().toISOString(),
    },
    customQA: [
      {
        id: 'salary',
        questionPattern: 'desired compensation|salary',
        answer: '$150,000',
      },
    ],
  };

  describe('Workday Detection & Step Identification', () => {
    it('detects Workday from DOM markers', () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <div data-automation-id="progressBar">
            <span aria-current="step">My Information</span>
          </div>
        </div>
      `;

      expect(isWorkdayForm(document)).toBe(true);
      expect(detectWorkdayStep(document)).toBe('information');
    });

    it('identifies each step accurately', () => {
      // Experience step
      document.body.innerHTML = `
        <div data-automation-id="pageHeader">My Experience</div>
        <div data-automation-id="file-upload-drop-zone"></div>
      `;
      expect(detectWorkdayStep(document)).toBe('experience');

      // Questions step
      document.body.innerHTML = `
        <div data-automation-id="pageHeader">Application Questions</div>
      `;
      expect(detectWorkdayStep(document)).toBe('questions');

      // Disclosures step
      document.body.innerHTML = `
        <div data-automation-id="pageHeader">Voluntary Disclosures</div>
        <div data-automation-id="disabilityStatus"></div>
      `;
      expect(detectWorkdayStep(document)).toBe('disclosures');
    });
  });

  describe('Workday Combobox Prompt Interaction', () => {
    it('selects option from prompt popup', async () => {
      document.body.innerHTML = `
        <button id="device-type-prompt" data-automation-id="phone-device-type" role="combobox">
          Select Device Type
        </button>
        <div data-automation-id="select-menu" style="display: none;">
          <div data-automation-id="menuItem">Landline</div>
          <div data-automation-id="menuItem">Mobile</div>
          <div data-automation-id="menuItem">Fax</div>
        </div>
      `;

      const prompt = document.getElementById('device-type-prompt') as HTMLElement;
      const menu = document.querySelector('[data-automation-id="select-menu"]') as HTMLElement;

      // Mock menu opening when prompt is clicked
      prompt.addEventListener('click', () => {
        menu.style.display = 'block';
      });

      const selected = await selectWorkdayComboboxOption(prompt, 'Mobile', 'phone_device_type');
      expect(selected).toBe(true);
    });
  });

  describe('Step 1: My Information Autofill', () => {
    it('fills contact and identity inputs accurately', async () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <h2 data-automation-id="pageHeader">My Information</h2>
          <button data-automation-id="countryDropdown" role="combobox">United States of America</button>
          <input data-automation-id="legalNameSection_firstName" type="text" />
          <input data-automation-id="legalNameSection_lastName" type="text" />
          <input data-automation-id="preferredNameCheckbox" type="checkbox" />
          <input data-automation-id="preferredNameSection_firstName" type="text" />
          <input data-automation-id="addressSection_addressLine1" type="text" />
          <input data-automation-id="addressSection_city" type="text" />
          <input data-automation-id="addressSection_region" type="text" />
          <input data-automation-id="addressSection_postalCode" type="text" />
          <button data-automation-id="phone-device-type" role="combobox">Mobile</button>
          <input data-automation-id="phone-number" type="tel" />
          <input data-automation-id="email" type="email" />
          <button data-automation-id="source" role="combobox">LinkedIn</button>
        </div>
      `;

      const report = await autofillWorkday(testCandidate, document);

      expect((document.querySelector('[data-automation-id="legalNameSection_firstName"]') as HTMLInputElement).value).toBe('Sanjay');
      expect((document.querySelector('[data-automation-id="legalNameSection_lastName"]') as HTMLInputElement).value).toBe('Rajjan');
      expect((document.querySelector('[data-automation-id="preferredNameSection_firstName"]') as HTMLInputElement).value).toBe('Sanju');
      expect((document.querySelector('[data-automation-id="addressSection_addressLine1"]') as HTMLInputElement).value).toBe('100 Main St Apt 4B');
      expect((document.querySelector('[data-automation-id="addressSection_city"]') as HTMLInputElement).value).toBe('Austin');
      expect((document.querySelector('[data-automation-id="addressSection_region"]') as HTMLInputElement).value).toBe('Texas');
      expect((document.querySelector('[data-automation-id="addressSection_postalCode"]') as HTMLInputElement).value).toBe('78701');
      expect((document.querySelector('[data-automation-id="phone-number"]') as HTMLInputElement).value).toBe('4697157358');
      expect((document.querySelector('[data-automation-id="email"]') as HTMLInputElement).value).toBe('sanjay.rajjan@example.com');
      expect(report.fieldsFilled).toBeGreaterThanOrEqual(9);
    });

    it('handles real-world Workday Step 1: selects State, Mobile device, answers Prior Worker No, and keeps Extension blank', async () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <h2 data-automation-id="pageHeader">My Information</h2>
          
          <!-- Source prompt -->
          <div data-automation-id="formField-source">
            <label>How Did You Hear About Us? *</label>
            <button data-automation-id="source" role="combobox">Select One</button>
          </div>

          <!-- Prior worker question (e.g. NVIDIA) -->
          <fieldset data-automation-id="formField-priorWorker">
            <legend>Have you previously worked for NVIDIA as an employee or contractor? *</legend>
            <label><input type="radio" name="priorWorker" value="yes" id="prior-yes" /> Yes</label>
            <label><input type="radio" name="priorWorker" value="no" id="prior-no" /> No</label>
          </fieldset>

          <!-- Address -->
          <div data-automation-id="formField-address">
            <label>Address Line 1</label>
            <input data-automation-id="addressSection_addressLine1" type="text" />
            <label>City</label>
            <input data-automation-id="addressSection_city" type="text" />
            
            <label>State</label>
            <select data-automation-id="addressSection_countryRegionDropdown">
              <option value="">Select One</option>
              <option value="CA">California</option>
              <option value="NY">New York</option>
              <option value="TX">Texas</option>
            </select>

            <label>Postal Code</label>
            <input data-automation-id="addressSection_postalCode" type="text" />
          </div>

          <!-- Phone -->
          <div data-automation-id="formField-phone">
            <label>Phone Device Type *</label>
            <select data-automation-id="phone-device-type">
              <option value="">Select One</option>
              <option value="Landline">Landline</option>
              <option value="Mobile">Mobile</option>
              <option value="Fax">Fax</option>
            </select>

            <label>Phone Number *</label>
            <input data-automation-id="phone-number" type="tel" />

            <label>Phone Extension</label>
            <input data-automation-id="phone-extension" type="text" value="4697157358" />
          </div>
        </div>
      `;

      const report = await autofillWorkday(testCandidate, document);

      // 1. Phone Extension must be blank (cleared if previously filled with phone number)
      const extInput = document.querySelector('[data-automation-id="phone-extension"]') as HTMLInputElement;
      expect(extInput.value).toBe('');

      // 2. Phone Device Type must be Mobile
      const deviceSelect = document.querySelector('[data-automation-id="phone-device-type"]') as HTMLSelectElement;
      expect(deviceSelect.value).toBe('Mobile');

      // 3. State must be Texas / TX
      const stateSelect = document.querySelector('[data-automation-id="addressSection_countryRegionDropdown"]') as HTMLSelectElement;
      expect(stateSelect.value).toBe('TX');

      // 4. Prior Employment question must be "No"
      const priorYes = document.getElementById('prior-yes') as HTMLInputElement;
      const priorNo = document.getElementById('prior-no') as HTMLInputElement;
      expect(priorYes.checked).toBe(false);
      expect(priorNo.checked).toBe(true);

      // 5. Phone number filled
      const phoneInput = document.querySelector('[data-automation-id="phone-number"]') as HTMLInputElement;
      expect(phoneInput.value).toBe('4697157358');
    });

    it('handles custom popup button dropdowns for State and Phone Device Type', async () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <h2 data-automation-id="pageHeader">My Information</h2>
          <div data-automation-id="formField-addressSection_countryRegionDropdown">
            <label>State</label>
            <button data-automation-id="addressSection_countryRegionDropdown" role="combobox" aria-haspopup="listbox">
              Select One
            </button>
          </div>
          <div data-automation-id="formField-phoneDeviceType">
            <label>Phone Device Type *</label>
            <button data-automation-id="phone-device-type" role="combobox" aria-haspopup="listbox">
              Select One
            </button>
          </div>
        </div>
      `;

      const stateBtn = document.querySelector('[data-automation-id="addressSection_countryRegionDropdown"]') as HTMLElement;
      stateBtn.addEventListener('click', () => {
        const popup = document.createElement('div');
        popup.setAttribute('data-automation-id', 'select-menu');
        popup.innerHTML = `
          <div data-automation-id="select-item">California</div>
          <div data-automation-id="select-item">New York</div>
          <div data-automation-id="select-item">Texas</div>
        `;
        document.body.appendChild(popup);
      });

      const deviceBtn = document.querySelector('[data-automation-id="phone-device-type"]') as HTMLElement;
      deviceBtn.addEventListener('click', () => {
        const popup = document.createElement('div');
        popup.setAttribute('data-automation-id', 'select-menu');
        popup.innerHTML = `
          <div data-automation-id="menuItem">Landline</div>
          <div data-automation-id="menuItem">Mobile</div>
          <div data-automation-id="menuItem">Fax</div>
        `;
        document.body.appendChild(popup);
      });

      const report = await autofillWorkday(testCandidate, document);
      expect(report.details.find((d) => d.semantic === 'state')?.success).toBe(true);
      expect(report.details.find((d) => d.semantic === 'phone_device_type')?.success).toBe(true);
    });
  });

  describe('Step 2: My Experience & Resume Upload', () => {
    it('attaches resume file and fills job and education entries', async () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <h2 data-automation-id="pageHeader">My Experience</h2>
          <div data-automation-id="file-upload-drop-zone">
            <input data-automation-id="file-upload-input-ref" type="file" />
            <span>Drop files here or browse</span>
          </div>
          <input data-automation-id="jobTitle" type="text" />
          <input data-automation-id="company" type="text" />
          <input data-automation-id="location" type="text" />
          <input data-automation-id="school" type="text" />
          <input data-automation-id="degree" type="text" />
          <input data-automation-id="field-of-study" type="text" />
          <input data-automation-id="gpa" type="text" />
          <input data-automation-id="linkedin" type="text" />
        </div>
      `;

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const changeHandler = vi.fn();
      fileInput.addEventListener('change', changeHandler);

      const report = await autofillWorkday(testCandidate, document);

      expect(fileInput.files).toBeDefined();
      expect(fileInput.files?.length).toBe(1);
      expect(fileInput.files?.[0].name).toBe('Sanjay_Rajjan_Resume.pdf');
      expect(changeHandler).toHaveBeenCalled();

      expect((document.querySelector('[data-automation-id="jobTitle"]') as HTMLInputElement).value).toBe('Software Engineer');
      expect((document.querySelector('[data-automation-id="company"]') as HTMLInputElement).value).toBe('Tech Corp');
      expect((document.querySelector('[data-automation-id="school"]') as HTMLInputElement).value).toBe('University of Texas at Austin');
      expect((document.querySelector('[data-automation-id="degree"]') as HTMLInputElement).value).toBe('B.S.');
      expect((document.querySelector('[data-automation-id="field-of-study"]') as HTMLInputElement).value).toBe('Computer Science');
      expect((document.querySelector('[data-automation-id="gpa"]') as HTMLInputElement).value).toBe('3.85');
      expect((document.querySelector('[data-automation-id="linkedin"]') as HTMLInputElement).value).toBe('https://www.linkedin.com/in/sanjayrajjan/');
      expect(report.fieldsFilled).toBeGreaterThanOrEqual(8);
    });

    it('handles real-world Workday Step 2: clicks Add for Work Experience, fills School, Degree, Field of Study, GPA, and Dates', async () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <h2 data-automation-id="pageHeader">My Experience</h2>

          <!-- Work Experience section initially with only Add button -->
          <div data-automation-id="workExperienceSection">
            <h3>Work Experience</h3>
            <button id="add-exp-btn" type="button">Add</button>
            <div id="exp-fields-container" style="display: none;">
              <label>Job Title *</label>
              <input data-automation-id="jobTitle" type="text" />
              <label>Company *</label>
              <input data-automation-id="company" type="text" />
              <label>Location</label>
              <input data-automation-id="location" type="text" />
              <label><input data-automation-id="currentlyWorkHere" type="checkbox" /> I currently work here</label>
            </div>
          </div>

          <!-- Education Section matching screenshot -->
          <div data-automation-id="educationSection">
            <h3>Education</h3>
            <h4>Education 1</h4>

            <label>School or University *</label>
            <input data-automation-id="school" type="text" />

            <label>Degree *</label>
            <select data-automation-id="degree">
              <option value="">Select One</option>
              <option value="BS">Bachelor of Science (BS / BSc)</option>
              <option value="MS">Master of Science (MS)</option>
            </select>

            <label>Field of Study *</label>
            <button data-automation-id="field-of-study" role="combobox">Select Field of Study</button>

            <label>Overall Result (GPA)</label>
            <input data-automation-id="gpa" type="text" />

            <label>From *</label>
            <input data-automation-id="educationStartDate" type="text" placeholder="YYYY" />

            <label>To (Actual or Expected) *</label>
            <input data-automation-id="educationEndDate" type="text" placeholder="YYYY" />

            <button type="button">Add Another</button>
          </div>
        </div>
      `;

      // Mock Add button mounting the fields
      const addBtn = document.getElementById('add-exp-btn') as HTMLButtonElement;
      addBtn.addEventListener('click', () => {
        const container = document.getElementById('exp-fields-container')!;
        container.style.display = 'block';
      });

      // Mock Field of Study prompt opening
      const fieldOfStudyPrompt = document.querySelector('[data-automation-id="field-of-study"]') as HTMLElement;
      fieldOfStudyPrompt.addEventListener('click', () => {
        const popup = document.createElement('div');
        popup.setAttribute('data-automation-id', 'select-menu');
        popup.innerHTML = `
          <div data-automation-id="menuItem">Business Administration</div>
          <div data-automation-id="menuItem">Computer Science</div>
          <div data-automation-id="menuItem">Economics</div>
        `;
        document.body.appendChild(popup);
      });

      const report = await autofillWorkday(testCandidate, document);

      // Work Experience assertions
      expect((document.querySelector('[data-automation-id="jobTitle"]') as HTMLInputElement).value).toBe('Software Engineer');
      expect((document.querySelector('[data-automation-id="company"]') as HTMLInputElement).value).toBe('Tech Corp');
      expect((document.querySelector('[data-automation-id="currentlyWorkHere"]') as HTMLInputElement).checked).toBe(true);

      // Education assertions
      expect((document.querySelector('[data-automation-id="school"]') as HTMLInputElement).value).toBe('University of Texas at Austin');
      expect((document.querySelector('[data-automation-id="degree"]') as HTMLSelectElement).value).toBe('BS');
      expect((document.querySelector('[data-automation-id="gpa"]') as HTMLInputElement).value).toBe('3.85');
      expect((document.querySelector('[data-automation-id="educationStartDate"]') as HTMLInputElement).value).toBe('2022');
      expect((document.querySelector('[data-automation-id="educationEndDate"]') as HTMLInputElement).value).toBe('2026');

      expect(report.details.find((d) => d.semantic === 'school')?.success).toBe(true);
      expect(report.details.find((d) => d.semantic === 'degree')?.success).toBe(true);
      expect(report.details.find((d) => d.semantic === 'custom_question' && d.label.includes('Field of Study'))?.success).toBe(true);
    });

    it('formats date strings strictly into Workday MM/YYYY format', () => {
      expect(formatWorkdayMonthYear('06/2023')).toBe('06/2023');
      expect(formatWorkdayMonthYear('6/2023')).toBe('06/2023');
      expect(formatWorkdayMonthYear('2023-06')).toBe('06/2023');
      expect(formatWorkdayMonthYear('2023-6')).toBe('06/2023');
      expect(formatWorkdayMonthYear('05-2022')).toBe('05/2022');
      expect(formatWorkdayMonthYear('2023')).toBe('01/2023');
      expect(formatWorkdayMonthYear('June 2023')).toBe('06/2023');
      expect(formatWorkdayMonthYear('May 2022')).toBe('05/2022');
      expect(formatWorkdayMonthYear('September 2021')).toBe('09/2021');
      expect(formatWorkdayMonthYear('')).toBe('');
    });

    it('populates multiple work experience cards with all 7 fields and clicks Add Another', async () => {
      const multiCandidate: CandidateProfile = {
        ...testCandidate,
        experience: {
          ...testCandidate.experience,
          workHistory: [
            {
              id: 'work-1',
              jobTitle: 'Software Engineer',
              company: 'NVIDIA',
              location: 'Austin, TX',
              currentlyWorkHere: true,
              from: '06/2023',
              to: '',
              description: 'AI platform and distributed systems development.',
            },
            {
              id: 'work-2',
              jobTitle: 'Software Engineering Intern',
              company: 'AMD',
              location: 'Austin, TX',
              currentlyWorkHere: false,
              from: '05/2022',
              to: '08/2022',
              description: 'GPU compiler optimization and kernel profiling.',
            },
          ],
        },
      };

      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <h2 data-automation-id="pageHeader">My Experience</h2>

          <div data-automation-id="workExperienceSection">
            <h3>Work Experience</h3>

            <!-- Card 1 (matching real-world Workday screenshot) -->
            <div data-automation-id="workExperience-1" class="work-card">
              <h4>Work Experience 1</h4>
              <label>Job Title *</label>
              <input data-automation-id="jobTitle" type="text" id="job-1" />
              <label>Company *</label>
              <input data-automation-id="company" type="text" id="comp-1" />
              <label>Location</label>
              <input data-automation-id="location" type="text" id="loc-1" />
              <label><input data-automation-id="currentlyWorkHere" type="checkbox" id="curr-1" /> I currently work here</label>
              <label>From *</label>
              <input data-automation-id="startDate" placeholder="MM/2012" type="text" id="from-1" />
              <label>To *</label>
              <input data-automation-id="endDate" placeholder="MM/2012" type="text" id="to-1" />
              <label>Role Description</label>
              <textarea data-automation-id="roleDescription" id="desc-1"></textarea>
            </div>

            <div id="add-another-container">
              <button id="add-another-exp-btn" type="button">Add Another</button>
            </div>
          </div>
        </div>
      `;

      // Simulate clicking "Add Another" to append Card 2 into DOM
      const addAnotherBtn = document.getElementById('add-another-exp-btn') as HTMLButtonElement;
      addAnotherBtn.addEventListener('click', () => {
        const card2 = document.createElement('div');
        card2.setAttribute('data-automation-id', 'workExperience-2');
        card2.className = 'work-card';
        card2.innerHTML = `
          <h4>Work Experience 2</h4>
          <label>Job Title *</label>
          <input data-automation-id="jobTitle" type="text" id="job-2" />
          <label>Company *</label>
          <input data-automation-id="company" type="text" id="comp-2" />
          <label>Location</label>
          <input data-automation-id="location" type="text" id="loc-2" />
          <label><input data-automation-id="currentlyWorkHere" type="checkbox" id="curr-2" /> I currently work here</label>
          <label>From *</label>
          <input data-automation-id="startDate" placeholder="MM/2012" type="text" id="from-2" />
          <label>To *</label>
          <input data-automation-id="endDate" placeholder="MM/2012" type="text" id="to-2" />
          <label>Role Description</label>
          <textarea data-automation-id="roleDescription" id="desc-2"></textarea>
        `;
        document.getElementById('add-another-container')?.before(card2);
      });

      const report = await autofillWorkday(multiCandidate, document);

      // Card 1 assertions
      expect((document.getElementById('job-1') as HTMLInputElement).value).toBe('Software Engineer');
      expect((document.getElementById('comp-1') as HTMLInputElement).value).toBe('NVIDIA');
      expect((document.getElementById('loc-1') as HTMLInputElement).value).toBe('Austin, TX');
      expect((document.getElementById('curr-1') as HTMLInputElement).checked).toBe(true);
      expect((document.getElementById('from-1') as HTMLInputElement).value).toBe('06/2023');
      expect((document.getElementById('desc-1') as HTMLTextAreaElement).value).toBe('AI platform and distributed systems development.');

      // Card 2 assertions
      expect((document.getElementById('job-2') as HTMLInputElement).value).toBe('Software Engineering Intern');
      expect((document.getElementById('comp-2') as HTMLInputElement).value).toBe('AMD');
      expect((document.getElementById('loc-2') as HTMLInputElement).value).toBe('Austin, TX');
      expect((document.getElementById('curr-2') as HTMLInputElement).checked).toBe(false);
      expect((document.getElementById('from-2') as HTMLInputElement).value).toBe('05/2022');
      expect((document.getElementById('to-2') as HTMLInputElement).value).toBe('08/2022');
      expect((document.getElementById('desc-2') as HTMLTextAreaElement).value).toBe('GPU compiler optimization and kernel profiling.');

      expect(report.fieldsFilled).toBeGreaterThanOrEqual(10);
    });

    it('matches user screenshots: fills multiple cards (IBM + 501c3Me), isolates education dates without 12/ errors', async () => {
      const candidateWithHistory: CandidateProfile = {
        ...testCandidate,
        experience: {
          ...testCandidate.experience,
          workHistory: [
            {
              id: 'w-1',
              jobTitle: 'Data Engineer Intern',
              company: 'IBM',
              location: 'Monroe, LA',
              currentlyWorkHere: false,
              from: '05/2026',
              to: '08/2026',
              description: 'Developed a FastAPI endpoint and ETL pipelines.',
            },
            {
              id: 'w-2',
              jobTitle: 'Software Engineer Intern',
              company: '501c3Me',
              location: 'Remote, USA',
              currentlyWorkHere: false,
              from: '06/2025',
              to: '08/2025',
              description: 'Engineered a 4-agent LangGraph orchestration system.',
            },
          ],
          educationHistory: [
            {
              id: 'e-1',
              school: 'The University of Texas at Austin',
              degree: 'Bachelor of Science',
              discipline: 'Computer Science',
              gpa: '3.58',
              from: '2024',
              to: '2028',
            },
          ],
        },
      };

      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <div data-automation-id="workExperienceSection">
            <h2>Work Experience</h2>
            <!-- Card 1 -->
            <div data-automation-id="panel-1">
              <h3>Work Experience 1</h3>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>Job Title *</label></div>
                <div class="input-wrapper"><input data-automation-id="jobTitle" type="text" id="card1-title" /></div>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>Company *</label></div>
                <div class="input-wrapper"><input data-automation-id="company" type="text" id="card1-company" /></div>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>Location</label></div>
                <div class="input-wrapper"><input data-automation-id="location" type="text" id="card1-location" /></div>
              </div>
              <div class="field-wrapper">
                <label><input data-automation-id="currentlyWorkHere" type="checkbox" id="card1-curr" /> I currently work here</label>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>From *</label></div>
                <div class="input-wrapper"><input data-automation-id="startDate" placeholder="MM/YYYY" id="card1-from" /></div>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>To *</label></div>
                <div class="input-wrapper"><input data-automation-id="endDate" placeholder="MM/YYYY" id="card1-to" /></div>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>Role Description</label></div>
                <div class="input-wrapper"><textarea data-automation-id="description" id="card1-desc"></textarea></div>
              </div>
            </div>

            <!-- Card 2 -->
            <div data-automation-id="panel-2">
              <h3>Work Experience 2</h3>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>Job Title *</label></div>
                <div class="input-wrapper"><input data-automation-id="jobTitle" type="text" id="card2-title" /></div>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>Company *</label></div>
                <div class="input-wrapper"><input data-automation-id="company" type="text" id="card2-company" /></div>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>Location</label></div>
                <div class="input-wrapper"><input data-automation-id="location" type="text" id="card2-location" /></div>
              </div>
              <div class="field-wrapper">
                <label><input data-automation-id="currentlyWorkHere" type="checkbox" id="card2-curr" /> I currently work here</label>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>From *</label></div>
                <div class="input-wrapper"><input data-automation-id="startDate" placeholder="MM/YYYY" id="card2-from" /></div>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>To *</label></div>
                <div class="input-wrapper"><input data-automation-id="endDate" placeholder="MM/YYYY" id="card2-to" /></div>
              </div>
              <div class="field-wrapper">
                <div class="label-wrapper"><label>Role Description</label></div>
                <div class="input-wrapper"><textarea data-automation-id="description" id="card2-desc"></textarea></div>
              </div>
            </div>
          </div>

          <!-- Education Section -->
          <div data-automation-id="educationSection">
            <h2>Education</h2>
            <div class="field-wrapper">
              <div class="label-wrapper"><label>School or University *</label></div>
              <div class="input-wrapper"><input data-automation-id="school" type="text" id="edu-school" /></div>
            </div>
            <div class="field-wrapper">
              <div class="label-wrapper"><label>Degree *</label></div>
              <div class="input-wrapper">
                <button data-automation-id="degree" role="combobox" id="edu-degree">Select One ▼</button>
              </div>
            </div>
            <div class="field-wrapper">
              <div class="label-wrapper"><label>Field of Study *</label></div>
              <div class="input-wrapper">
                <button data-automation-id="fieldOfStudy" role="combobox" id="edu-field">:=</button>
              </div>
            </div>
            <div class="field-wrapper">
              <div class="label-wrapper"><label>Overall Result (GPA)</label></div>
              <div class="input-wrapper"><input data-automation-id="gpa" type="text" id="edu-gpa" /></div>
            </div>
            <div class="field-wrapper">
              <div class="label-wrapper"><label>From *</label></div>
              <div class="input-wrapper"><input placeholder="YYYY" id="edu-from" /></div>
            </div>
            <div class="field-wrapper">
              <div class="label-wrapper"><label>To (Actual or Expected) *</label></div>
              <div class="input-wrapper"><input placeholder="YYYY" id="edu-to" /></div>
            </div>
          </div>
        </div>
      `;

      // Wire up Degree popup
      const degBtn = document.getElementById('edu-degree') as HTMLElement;
      degBtn.addEventListener('click', () => {
        const popup = document.createElement('div');
        popup.setAttribute('data-automation-id', 'select-menu');
        popup.innerHTML = `
          <div data-automation-id="select-item">High School Diploma</div>
          <div data-automation-id="select-item">Associate of Arts</div>
          <div data-automation-id="select-item">Bachelor of Science</div>
          <div data-automation-id="select-item">Master of Science</div>
        `;
        document.body.appendChild(popup);
      });

      // Wire up Field of Study popup
      const fieldBtn = document.getElementById('edu-field') as HTMLElement;
      fieldBtn.addEventListener('click', () => {
        const popup = document.createElement('div');
        popup.setAttribute('data-automation-id', 'select-menu');
        popup.innerHTML = `
          <input data-automation-id="searchBox" type="text" />
          <div data-automation-id="promptOption">Accounting</div>
          <div data-automation-id="promptOption">Computer Science</div>
          <div data-automation-id="promptOption">Physics</div>
        `;
        document.body.appendChild(popup);
      });

      const report = await autofillWorkday(candidateWithHistory, document);

      // Verify Card 1 (IBM)
      expect((document.getElementById('card1-title') as HTMLInputElement).value).toBe('Data Engineer Intern');
      expect((document.getElementById('card1-company') as HTMLInputElement).value).toBe('IBM');
      expect((document.getElementById('card1-location') as HTMLInputElement).value).toBe('Monroe, LA');
      expect((document.getElementById('card1-curr') as HTMLInputElement).checked).toBe(false);
      expect((document.getElementById('card1-from') as HTMLInputElement).value).toBe('05/2026');
      expect((document.getElementById('card1-to') as HTMLInputElement).value).toBe('08/2026');
      expect((document.getElementById('card1-desc') as HTMLTextAreaElement).value).toContain('FastAPI');

      // Verify Card 2 (501c3Me - MUST NOT be Data Engineer Intern or Austin, TX!)
      expect((document.getElementById('card2-title') as HTMLInputElement).value).toBe('Software Engineer Intern');
      expect((document.getElementById('card2-company') as HTMLInputElement).value).toBe('501c3Me');
      expect((document.getElementById('card2-location') as HTMLInputElement).value).toBe('Remote, USA');
      expect((document.getElementById('card2-curr') as HTMLInputElement).checked).toBe(false);
      expect((document.getElementById('card2-from') as HTMLInputElement).value).toBe('06/2025');
      expect((document.getElementById('card2-to') as HTMLInputElement).value).toBe('08/2025');
      expect((document.getElementById('card2-desc') as HTMLTextAreaElement).value).toContain('LangGraph');

      // Verify Education (School, Degree, Field of Study, GPA, Dates)
      expect((document.getElementById('edu-school') as HTMLInputElement).value).toBe('The University of Texas at Austin');
      expect(report.details.find((d) => d.semantic === 'degree')?.success).toBe(true);
      expect(report.details.find((d) => d.label === 'Field of Study')?.success).toBe(true);
      expect((document.getElementById('edu-gpa') as HTMLInputElement).value).toBe('3.58');
      expect((document.getElementById('edu-from') as HTMLInputElement).value).toBe('2024');
      expect((document.getElementById('edu-to') as HTMLInputElement).value).toBe('2028');

      // Crucial: Card 1 and Card 2 From/To are MM/YYYY, NOT clamped 12/ from education!
      expect((document.getElementById('card1-from') as HTMLInputElement).value).not.toBe('12/');
      expect((document.getElementById('card1-to') as HTMLInputElement).value).not.toBe('12/');
    });
  });

  describe('Step 3: Application Questions', () => {
    it('answers work authorization, visa sponsorship, and custom QA', async () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <h2 data-automation-id="pageHeader">Application Questions</h2>
          <div data-automation-id="formField-workAuth">
            <p>Are you legally authorized to work in the United States?</p>
            <label><input type="radio" name="auth" value="yes" id="auth-yes" /> Yes</label>
            <label><input type="radio" name="auth" value="no" id="auth-no" /> No</label>
          </div>
          <div data-automation-id="formField-sponsorship">
            <p>Will you now or in the future require visa sponsorship?</p>
            <label><input type="radio" name="sponsor" value="yes" id="sponsor-yes" /> Yes</label>
            <label><input type="radio" name="sponsor" value="no" id="sponsor-no" /> No</label>
          </div>
          <div data-automation-id="formField-salary">
            <label for="salary-field">What is your desired compensation?</label>
            <input id="salary-field" type="text" />
          </div>
        </div>
      `;

      const report = await autofillWorkday(testCandidate, document);

      expect((document.getElementById('auth-yes') as HTMLInputElement).checked).toBe(true);
      expect((document.getElementById('auth-no') as HTMLInputElement).checked).toBe(false);
      expect((document.getElementById('sponsor-yes') as HTMLInputElement).checked).toBe(false);
      expect((document.getElementById('sponsor-no') as HTMLInputElement).checked).toBe(true);
      expect((document.getElementById('salary-field') as HTMLInputElement).value).toBe('$150,000');
      expect(report.fieldsFilled).toBeGreaterThanOrEqual(3);
    });

    it('handles real-world Workday Step 3 questionnaire buttons and inputs (Q2 style)', async () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <h2 data-automation-id="pageHeader">Application Questions 1 of 2</h2>

          <!-- Q1: Referred -->
          <div data-automation-id="formField-q1">
            <fieldset>
              <legend>Were you referred to this position by a Q2 employee?*</legend>
              <button id="primaryQuestionnaire--q1" aria-controls="lb-q1" type="button">Select One</button>
              <ul id="lb-q1" role="listbox" style="display:none">
                <li role="option">Select One</li>
                <li role="option">Yes</li>
                <li role="option">No</li>
              </ul>
            </fieldset>
          </div>

          <!-- Q2: Work Auth -->
          <div data-automation-id="formField-q2">
            <fieldset>
              <legend>Are you authorized to work for any employer in the United States?*</legend>
              <button id="primaryQuestionnaire--q2" aria-controls="lb-q2" type="button">Select One</button>
              <ul id="lb-q2" role="listbox" style="display:none">
                <li role="option">Select One</li>
                <li role="option">Yes</li>
                <li role="option">No</li>
              </ul>
            </fieldset>
          </div>

          <!-- Q3: Visa Sponsorship -->
          <div data-automation-id="formField-q3">
            <fieldset>
              <legend>Will you now or in the future require Visa sponsorship for employment?*</legend>
              <button id="primaryQuestionnaire--q3" aria-controls="lb-q3" type="button">Select One</button>
              <ul id="lb-q3" role="listbox" style="display:none">
                <li role="option">Select One</li>
                <li role="option">Yes</li>
                <li role="option">No</li>
              </ul>
            </fieldset>
          </div>

          <!-- Q4: 18 years of age -->
          <div data-automation-id="formField-q4">
            <fieldset>
              <legend>Are you at least 18 years of age?*</legend>
              <button id="primaryQuestionnaire--q4" aria-controls="lb-q4" type="button">Select One</button>
              <ul id="lb-q4" role="listbox" style="display:none">
                <li role="option">Select One</li>
                <li role="option">Yes</li>
                <li role="option">No</li>
              </ul>
            </fieldset>
          </div>

          <!-- Q5: Felony -->
          <div data-automation-id="formField-q5">
            <fieldset>
              <legend>Have you ever been convicted of a felony?*</legend>
              <button id="primaryQuestionnaire--q5" aria-controls="lb-q5" type="button">Select One</button>
              <ul id="lb-q5" role="listbox" style="display:none">
                <li role="option">Select One</li>
                <li role="option">Yes</li>
                <li role="option">No</li>
              </ul>
            </fieldset>
          </div>

          <!-- Q6: Salary -->
          <div data-automation-id="formField-q6">
            <fieldset>
              <legend>What is your desired annual salary?*</legend>
              <input id="primaryQuestionnaire--salary" type="text" />
            </fieldset>
          </div>

          <!-- Q7: Notice period -->
          <div data-automation-id="formField-q7">
            <fieldset>
              <legend>From the point of an offer, how much time would you need before you’re able to start?*</legend>
              <textarea id="primaryQuestionnaire--start"></textarea>
            </fieldset>
          </div>
        </div>
      `;

      ['q1', 'q2', 'q3', 'q4', 'q5'].forEach((id) => {
        const btn = document.getElementById(`primaryQuestionnaire--${id}`)!;
        const lb = document.getElementById(`lb-${id}`)!;
        btn.addEventListener('click', () => {
          lb.style.display = 'block';
        });
        lb.querySelectorAll('li').forEach((li) => {
          li.addEventListener('click', () => {
            btn.textContent = li.textContent?.trim() || '';
            lb.style.display = 'none';
          });
        });
      });

      const report = await autofillWorkday(testCandidate, document);

      expect(document.getElementById('primaryQuestionnaire--q1')?.textContent?.trim()).toBe('No');
      expect(document.getElementById('primaryQuestionnaire--q2')?.textContent?.trim()).toBe('Yes');
      expect(document.getElementById('primaryQuestionnaire--q3')?.textContent?.trim()).toBe('No');
      expect(document.getElementById('primaryQuestionnaire--q4')?.textContent?.trim()).toBe('Yes');
      expect(document.getElementById('primaryQuestionnaire--q5')?.textContent?.trim()).toBe('No');
      expect((document.getElementById('primaryQuestionnaire--salary') as HTMLInputElement).value).toBe('$150,000');
      expect((document.getElementById('primaryQuestionnaire--start') as HTMLTextAreaElement).value).toBe(testCandidate.workAuth.earliestStartDate);
      expect(report.fieldsFilled).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Step 4: Voluntary Disclosures & EEO', () => {
    it('populates demographic prompts, signs legal name and sets current date', async () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <h2 data-automation-id="pageHeader">Voluntary Disclosures</h2>
          <button data-automation-id="gender" role="combobox">Male</button>
          <button data-automation-id="hispanicOrLatino" role="combobox">No</button>
          <button data-automation-id="raceEthnicity" role="combobox">Asian (Not Hispanic or Latino)</button>
          <button data-automation-id="veteranStatus" role="combobox">No</button>
          <button data-automation-id="disabilityStatus" role="combobox">No</button>
          <div data-automation-id="disabilitySection">
            <label><input data-automation-id="agreementCheckbox" type="checkbox" /> I acknowledge</label>
            <input data-automation-id="name" type="text" placeholder="Your Name" />
            <input data-automation-id="date" type="text" placeholder="MM/DD/YYYY" />
          </div>
        </div>
      `;

      const report = await autofillWorkday(testCandidate, document);

      const checkbox = document.querySelector('[data-automation-id="agreementCheckbox"]') as HTMLInputElement;
      const signature = document.querySelector('[data-automation-id="name"]') as HTMLInputElement;
      const date = document.querySelector('[data-automation-id="date"]') as HTMLInputElement;

      expect(checkbox.checked).toBe(true);
      expect(signature.value).toBe('Sanjay Rajjan');

      // Date format MM/DD/YYYY
      expect(date.value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(report.fieldsFilled).toBeGreaterThanOrEqual(3);
    });

    it('handles real-world Workday Step 5 (Q2 style): selects Gender, Ethnicity, Hispanic/Latino, Veteran, and accepts Terms', async () => {
      document.body.innerHTML = `
        <div data-automation-id="workdayApplication">
          <div data-automation-id="applyFlowVoluntaryDisclosuresPage">
            <h3>Voluntary Disclosures</h3>
            <div role="group" aria-labelledby="Personal-Information-section">
              <h4 id="Personal-Information-section">Personal Information</h4>
              
              <!-- Gender -->
              <div>
                <button aria-haspopup="listbox" type="button" name="gender" id="personalInfoUS--gender" aria-controls="lb-gender">Select One</button>
                <ul id="lb-gender" role="listbox" style="display:none;">
                  <li role="option">Select One</li>
                  <li role="option">Female</li>
                  <li role="option">Male</li>
                  <li role="option">Not declared</li>
                </ul>
              </div>

              <!-- Ethnicity -->
              <div>
                <button aria-haspopup="listbox" type="button" name="ethnicity" id="personalInfoUS--ethnicity" aria-controls="lb-ethnicity">Select One</button>
                <ul id="lb-ethnicity" role="listbox" style="display:none;">
                  <li role="option">Select One</li>
                  <li role="option">American Indian or Alaska Native (Not Hispanic or Latino) (United States of America)</li>
                  <li role="option">Asian (Not Hispanic or Latino) (United States of America)</li>
                  <li role="option">Black or African American (Not Hispanic or Latino) (United States of America)</li>
                  <li role="option">Decline to State (United States of America)</li>
                  <li role="option">White (Not Hispanic or Latino) (United States of America)</li>
                </ul>
              </div>

              <!-- Hispanic or Latino -->
              <div>
                <button aria-haspopup="listbox" type="button" name="hispanicOrLatino" id="personalInfoUS--hispanicOrLatino" aria-controls="lb-hispanic">Select One</button>
                <ul id="lb-hispanic" role="listbox" style="display:none;">
                  <li role="option">Select One</li>
                  <li role="option">Yes</li>
                  <li role="option">No</li>
                </ul>
              </div>

              <!-- Veteran Status -->
              <div>
                <button aria-haspopup="listbox" type="button" name="veteranStatus" id="personalInfoUS--veteranStatus" aria-controls="lb-veteran">Select One</button>
                <ul id="lb-veteran" role="listbox" style="display:none;">
                  <li role="option">Select One</li>
                  <li role="option">I identify as a Veteran</li>
                  <li role="option">I decline to self-identify</li>
                  <li role="option">I am not a Veteran</li>
                </ul>
              </div>
            </div>

            <!-- Terms and Conditions -->
            <div role="group" aria-labelledby="Terms-and-Conditions-section">
              <h4 id="Terms-and-Conditions-section">Terms and Conditions</h4>
              <input id="termsAndConditions--acceptTermsAndAgreements" type="checkbox" name="acceptTermsAndAgreements" />
            </div>
          </div>
        </div>
      `;

      [
        { btnId: 'personalInfoUS--gender', lbId: 'lb-gender' },
        { btnId: 'personalInfoUS--ethnicity', lbId: 'lb-ethnicity' },
        { btnId: 'personalInfoUS--hispanicOrLatino', lbId: 'lb-hispanic' },
        { btnId: 'personalInfoUS--veteranStatus', lbId: 'lb-veteran' },
      ].forEach(({ btnId, lbId }) => {
        const btn = document.getElementById(btnId)!;
        const lb = document.getElementById(lbId)!;
        btn.addEventListener('click', () => {
          lb.style.display = 'block';
        });
        lb.querySelectorAll('li').forEach((li) => {
          li.addEventListener('click', () => {
            btn.textContent = li.textContent?.trim() || '';
            lb.style.display = 'none';
          });
        });
      });

      const report = await autofillWorkday(testCandidate, document);

      expect(document.getElementById('personalInfoUS--gender')?.textContent?.trim()).toBe('Male');
      expect(document.getElementById('personalInfoUS--ethnicity')?.textContent?.trim()).toBe('Asian (Not Hispanic or Latino) (United States of America)');
      expect(document.getElementById('personalInfoUS--hispanicOrLatino')?.textContent?.trim()).toBe('No');
      expect(document.getElementById('personalInfoUS--veteranStatus')?.textContent?.trim()).toBe('I am not a Veteran');
      const termsCheckbox = document.getElementById('termsAndConditions--acceptTermsAndAgreements') as HTMLInputElement;
      expect(termsCheckbox.checked).toBe(true);
      expect(report.fieldsFilled).toBeGreaterThanOrEqual(5);
    });
  });
});
