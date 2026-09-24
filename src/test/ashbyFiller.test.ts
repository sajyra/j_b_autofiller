import { describe, it, expect, beforeEach, vi } from 'vitest';
import { autofillAshby, dataUrlToFile, handleResumeUpload } from '../content/ashby/ashbyFiller';
import { CandidateProfile, DEFAULT_PROFILE, ResumeFile } from '../types/profile';
import { AutofillReport } from '../types/autofill';
import fs from 'fs';
import path from 'path';

describe('ashbyFiller integration tests', () => {
  const fixtureHtml = fs.readFileSync(
    path.resolve(__dirname, 'fixtures/ashbyFormFixture.html'),
    'utf-8'
  );

  // Sample base64 text for "Resume content"
  const samplePdfDataUrl = 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2Jq';

  const sampleResume: ResumeFile = {
    name: 'Alex_Mercer_Resume.pdf',
    type: 'application/pdf',
    size: 64,
    dataUrl: samplePdfDataUrl,
    updatedAt: new Date().toISOString(),
  };

  const testProfile: CandidateProfile = {
    ...DEFAULT_PROFILE,
    personal: {
      firstName: 'Alex',
      lastName: 'Mercer',
      email: 'alex.mercer@example.com',
      phoneCountryCode: '+1',
      phone: '4155551234',
      city: 'San Francisco',
      state: 'CA',
      country: 'United States',
      postalCode: '94105',
    },
    links: {
      linkedin: 'https://linkedin.com/in/alexmercer',
      github: 'https://github.com/alexmercer',
      portfolio: 'https://alexmercer.dev',
      twitter: 'https://x.com/alexmercer',
      otherWebsite: '',
    },
    workAuth: {
      authorizedInUS: 'yes',
      requiresSponsorship: 'no',
      noticePeriod: '2 weeks',
      earliestStartDate: 'Immediate',
    },
    resume: sampleResume,
    customQA: [
      {
        id: 'qa-salary',
        questionPattern: 'salary expectation',
        answer: '$175,000 - $190,000',
      },
    ],
  };

  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
  });

  it('converts base64 DataURL to a native File object correctly', () => {
    const file = dataUrlToFile(samplePdfDataUrl, 'test.pdf', 'application/pdf');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('test.pdf');
    expect(file.type).toBe('application/pdf');
    expect(file.size).toBeGreaterThan(0);
  });

  it('handleResumeUpload attaches file and triggers change event', async () => {
    const resumeInput = document.getElementById('resume-input') as HTMLInputElement;
    const changeHandler = vi.fn();
    resumeInput.addEventListener('change', changeHandler);

    const report: AutofillReport = {
      timestamp: Date.now(),
      platform: 'ashby',
      url: '',
      totalFieldsFound: 0,
      fieldsFilled: 0,
      details: [],
    };

    const uploaded = await handleResumeUpload(document.body, testProfile, report);
    expect(uploaded).toBe(true);
    expect(changeHandler).toHaveBeenCalledTimes(1);
    expect(resumeInput.files).toBeDefined();
    expect(resumeInput.files?.length).toBe(1);
    expect(resumeInput.files?.[0].name).toBe('Alex_Mercer_Resume.pdf');
    expect(report.fieldsFilled).toBe(1);
  });

  it('populates all standard and custom Ashby fields accurately including resume', async () => {
    const report = await autofillAshby(testProfile, document.body);

    // Assert inputs populated
    const firstName = document.getElementById('first-name-input') as HTMLInputElement;
    const lastName = document.getElementById('last-name-input') as HTMLInputElement;
    const email = document.getElementById('email-input') as HTMLInputElement;
    const phone = document.getElementById('phone-input') as HTMLInputElement;
    const location = document.getElementById('location-input') as HTMLInputElement;
    const linkedin = document.getElementById('linkedin-input') as HTMLInputElement;
    const github = document.getElementById('github-input') as HTMLInputElement;
    const portfolio = document.getElementById('portfolio-input') as HTMLInputElement;
    const notice = document.getElementById('notice-input') as HTMLInputElement;
    const salary = document.getElementById('salary-input') as HTMLInputElement;
    const resume = document.getElementById('resume-input') as HTMLInputElement;

    expect(firstName.value).toBe('Alex');
    expect(lastName.value).toBe('Mercer');
    expect(email.value).toBe('alex.mercer@example.com');
    expect(phone.value).toBe('4155551234');
    expect(location.value).toBe('San Francisco, CA');
    expect(linkedin.value).toBe('https://linkedin.com/in/alexmercer');
    expect(github.value).toBe('https://github.com/alexmercer');
    expect(portfolio.value).toBe('https://alexmercer.dev');
    expect(notice.value).toBe('2 weeks');
    expect(salary.value).toBe('$175,000 - $190,000');

    // Assert resume file attached
    expect(resume.files).toBeDefined();
    expect(resume.files?.length).toBe(1);
    expect(resume.files?.[0].name).toBe('Alex_Mercer_Resume.pdf');

    // Assert radio buttons
    const authYes = document.getElementById('auth-yes') as HTMLInputElement;
    const authNo = document.getElementById('auth-no') as HTMLInputElement;
    expect(authYes.checked).toBe(true);
    expect(authNo.checked).toBe(false);

    const sponsorYes = document.getElementById('sponsor-yes') as HTMLInputElement;
    const sponsorNo = document.getElementById('sponsor-no') as HTMLInputElement;
    expect(sponsorYes.checked).toBe(false);
    expect(sponsorNo.checked).toBe(true);

    // Assert report metrics
    expect(report.totalFieldsFound).toBeGreaterThanOrEqual(12);
    expect(report.fieldsFilled).toBeGreaterThanOrEqual(12);
    expect(report.details.some((d) => d.semantic === 'resume' && d.success)).toBe(true);
  });

  it('correctly identifies empty Ashby dropzone with SVG button and does NOT skip upload', async () => {
    // Exact DOM structure from Ashby with SVG paperclip upload button
    document.body.innerHTML = `
      <div class="ashby-field-entry">
        <label>Resume*</label>
        <div class="dropzone-container" role="presentation">
          <input id="ashby-resume-file" type="file" name="resume" accept=".pdf,.docx,.doc,.txt" />
          <button type="button" class="upload-btn">
            <svg width="16" height="16"><path d="M0 0h16v16H0z"/></svg>
            Upload File
          </button>
          <span>or drag and drop here</span>
        </div>
      </div>
    `;

    const fileInput = document.getElementById('ashby-resume-file') as HTMLInputElement;
    const dropzone = document.querySelector('.dropzone-container') as HTMLElement;

    // Attach React internal props mock to test React Dropzone integration
    let reactDropCalled = false;
    (dropzone as any)['__reactProps$test'] = {
      onDrop: vi.fn(() => {
        reactDropCalled = true;
      }),
    };

    let reactChangeCalled = false;
    (fileInput as any)['__reactProps$test'] = {
      onChange: vi.fn(() => {
        reactChangeCalled = true;
      }),
    };

    const report: AutofillReport = {
      timestamp: Date.now(),
      platform: 'ashby',
      url: '',
      totalFieldsFound: 0,
      fieldsFilled: 0,
      details: [],
    };

    const uploaded = await handleResumeUpload(document.body, testProfile, report);
    expect(uploaded).toBe(true);
    expect(fileInput.files?.length).toBe(1);
    expect(fileInput.files?.[0].name).toBe('Alex_Mercer_Resume.pdf');
    expect(reactChangeCalled).toBe(true);
    expect(reactDropCalled).toBe(true);
    expect(report.details[0].label).toBe('Resume / CV Upload');
  });
});

