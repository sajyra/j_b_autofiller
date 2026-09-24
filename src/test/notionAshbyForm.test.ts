import { describe, it, expect, beforeEach } from 'vitest';
import { autofillAshby } from '../content/ashby/ashbyFiller';
import { CandidateProfile, DEFAULT_PROFILE } from '../types/profile';

describe('Notion Ashby Form Real-World Test', () => {
  const notionFormHtml = `
    <div id="application-form">
      <!-- Top Ashby Autofill from Resume Teaser Box (Should be ignored by Instapp) -->
      <div class="autofill-from-resume-box">
        <h4>✨ Autofill from resume</h4>
        <p>Upload your resume here to autofill key application fields.</p>
        <input id="teaser-resume-input" type="file" name="autofill_resume" />
      </div>

      <!-- Full Name -->
      <div class="field-container">
        <label for="name-input">Full Name*</label>
        <input id="name-input" type="text" value="SANJAY RAJJAN" />
      </div>

      <!-- Email -->
      <div class="field-container">
        <label for="email-input">Email*</label>
        <input id="email-input" type="email" value="" />
      </div>

      <!-- Phone with placeholder -->
      <div class="field-container">
        <label for="phone-input">Phone*</label>
        <input id="phone-input" type="tel" placeholder="1-415-555-1234..." value="" />
      </div>

      <!-- Actual Resume Upload Field -->
      <div class="field-container">
        <label for="actual-resume-input">Resume*</label>
        <input id="actual-resume-input" type="file" name="resume" accept=".pdf,.doc,.docx" />
      </div>

      <!-- Location with autocomplete -->
      <div class="field-container">
        <label for="location-input">Current Location*</label>
        <input id="location-input" type="text" placeholder="Austin" value="" />
      </div>

      <!-- Pronouns Radio Group -->
      <div class="field-container">
        <p>What pronouns would you like our team to use when addressing you?*</p>
        <div>
          <label><input type="radio" name="pronouns" value="He/Him" id="pro-he" /> He/Him</label>
          <label><input type="radio" name="pronouns" value="She/Her" id="pro-she" /> She/Her</label>
          <label><input type="radio" name="pronouns" value="They/Them" id="pro-they" /> They/Them</label>
          <label><input type="radio" name="pronouns" value="Prefer not to say" id="pro-decline" /> Prefer not to say</label>
        </div>
      </div>

      <!-- Anchor Days Boolean Button Group -->
      <div class="field-container">
        <p>We work from our offices on Mondays, Tuesdays, and Thursdays (Anchor Days). If you need an accommodation, we'll partner with you and explore reasonable options consistent with applicable law. Are you able to commit to working from one of our offices on Anchor Days each week?*</p>
        <div class="button-group">
          <div class="btn-wrap"><button type="button" id="anchor-yes">Yes</button></div>
          <div class="btn-wrap"><button type="button" id="anchor-no">No</button></div>
        </div>
      </div>

      <!-- Relocation Boolean Button Group -->
      <div class="field-container">
        <p>This role requires that you are willing to relocate to one of the following locations New York, NY, USA or San Francisco, CA, USA. Please confirm that you are willing to relocate for this role?*</p>
        <div class="button-group">
          <div class="btn-wrap"><button type="button" id="reloc-yes">Yes</button></div>
          <div class="btn-wrap"><button type="button" id="reloc-no">No</button></div>
        </div>
      </div>

      <!-- Relocation Locations Checkboxes -->
      <div class="field-container">
        <p>Please indicate all of the locations that you would be interested in relocating to for this position.*</p>
        <label><input type="checkbox" id="loc-ny" value="New York, NY" /> New York, NY</label>
        <label><input type="checkbox" id="loc-sf" value="San Francisco, CA" /> San Francisco, CA</label>
      </div>

      <!-- Authorized to work lawfully Button Group -->
      <div class="field-container">
        <p>Are you authorized to work lawfully in the United States?*</p>
        <div class="button-group">
          <div class="btn-wrap"><button type="button" id="auth-yes-btn">Yes</button></div>
          <div class="btn-wrap"><button type="button" id="auth-no-btn">No</button></div>
        </div>
      </div>

      <!-- Sponsorship Radio Group -->
      <div class="field-container">
        <p>Will you now or at any time in the future require sponsorship for employment visa status (e.g. H1B, OPT)?*</p>
        <div role="radiogroup">
          <label><input type="radio" name="sponsorship" value="OPT" id="sponsor-opt" /> OPT</label>
          <label><input type="radio" name="sponsorship" value="H1B" id="sponsor-h1b" /> H1B</label>
          <label><input type="radio" name="sponsorship" value="TN" id="sponsor-tn" /> TN</label>
          <label><input type="radio" name="sponsorship" value="None" id="sponsor-none" /> None</label>
          <label><input type="radio" name="sponsorship" value="Other" id="sponsor-other" /> Other</label>
        </div>
      </div>

      <!-- Education Section -->
      <div class="field-container">
        <label for="school-input">School*</label>
        <input id="school-input" type="text" placeholder="Type here..." />
      </div>

      <div class="field-container">
        <label for="grad-date-input">Graduation Date*</label>
        <input id="grad-date-input" type="text" placeholder="Pick date..." />
      </div>

      <div class="field-container">
        <p>Degree Type*</p>
        <label><input type="checkbox" id="deg-bach" value="Undergraduate/Bachelors" /> Undergraduate/Bachelors</label>
        <label><input type="checkbox" id="deg-mast" value="Master's" /> Master's</label>
        <label><input type="checkbox" id="deg-phd" value="PhD" /> PhD</label>
        <label><input type="checkbox" id="deg-mba" value="MBA" /> MBA</label>
      </div>

      <!-- EEO Gender -->
      <div class="field-container">
        <h3>Gender</h3>
        <p>Input gender</p>
        <div>
          <label><input type="radio" name="gender-group" value="Male" id="gender-male" /> Male</label>
          <label><input type="radio" name="gender-group" value="Female" id="gender-female" /> Female</label>
          <label><input type="radio" name="gender-group" value="Decline" id="gender-decline" /> Decline to self-identify</label>
        </div>
      </div>

      <!-- EEO Race -->
      <div class="field-container">
        <h3>Race</h3>
        <ul>
          <li>Hispanic or Latino - A person of Cuban...</li>
          <li>White - A person having origins...</li>
          <li>Asian - A person having origins in the Far East, Southeast Asia, or Indian Subcontinent...</li>
        </ul>
        <div>
          <label><input type="radio" name="race-group" value="Hispanic" id="race-hispanic" /> Hispanic or Latino</label>
          <label><input type="radio" name="race-group" value="White" id="race-white" /> White (Not Hispanic or Latino)</label>
          <label><input type="radio" name="race-group" value="Black" id="race-black" /> Black or African American</label>
          <label><input type="radio" name="race-group" value="Asian" id="race-asian" /> Asian (Not Hispanic or Latino)</label>
          <label><input type="radio" name="race-group" value="Decline" id="race-decline" /> Decline to self-identify</label>
        </div>
      </div>

      <!-- EEO Veteran -->
      <div class="field-container">
        <h3>SELF-IDENTIFICATION OF VETERAN STATUS</h3>
        <div>
          <label><input type="radio" name="veteran-group" value="Protected" id="vet-yes" /> I identify as one or more classifications of protected veteran</label>
          <label><input type="radio" name="veteran-group" value="Non-Veteran" id="vet-no" /> I am not a protected veteran</label>
          <label><input type="radio" name="veteran-group" value="Decline" id="vet-decline" /> Decline to self-identify</label>
        </div>
      </div>
    </div>
  `;

  const candidate: CandidateProfile = {
    ...DEFAULT_PROFILE,
    personal: {
      ...DEFAULT_PROFILE.personal,
      firstName: 'Alex',
      lastName: 'Mercer',
      city: 'Austin',
      state: 'TX',
      email: 'alex@example.com',
      phone: '5125551234',
    },
    resume: {
      name: 'Alex_Mercer_Resume.pdf',
      type: 'application/pdf',
      size: 64,
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2Jq',
      updatedAt: new Date().toISOString(),
    },
    workAuth: {
      authorizedInUS: 'yes',
      requiresSponsorship: 'no',
      noticePeriod: '2 weeks',
      earliestStartDate: 'Immediate',
    },
    experience: {
      ...DEFAULT_PROFILE.experience,
      school: 'University of Texas at Austin',
      highestDegree: "Bachelor's Degree",
      graduationYear: '2026',
    },
    eeo: {
      gender: 'male',
      race: 'south-asian',
      veteran: 'no',
      disability: 'no',
    },
  };

  beforeEach(() => {
    document.body.innerHTML = notionFormHtml;
  });

  it('autofills all Notion Ashby form fields from the screenshots', async () => {
    const report = await autofillAshby(candidate, document.body);

    // 1. Full Name: Formats Title Case "Alex Mercer"
    const nameInput = document.getElementById('name-input') as HTMLInputElement;
    expect(nameInput.value).toBe('Alex Mercer');

    // 2. Email and Phone
    const emailInput = document.getElementById('email-input') as HTMLInputElement;
    const phoneInput = document.getElementById('phone-input') as HTMLInputElement;
    expect(emailInput.value).toBe('alex@example.com');
    expect(phoneInput.value).toBe('5125551234');

    // 3. Resume Upload: Teaser must be IGNORED, Actual file input populated
    const teaserInput = document.getElementById('teaser-resume-input') as HTMLInputElement;
    const actualResume = document.getElementById('actual-resume-input') as HTMLInputElement;
    expect(teaserInput.files?.length || 0).toBe(0);
    expect(actualResume.files?.length).toBe(1);
    expect(actualResume.files?.[0].name).toBe('Alex_Mercer_Resume.pdf');

    // 4. Pronouns Radio: Auto-detected He/Him from male gender
    const proHe = document.getElementById('pro-he') as HTMLInputElement;
    const proShe = document.getElementById('pro-she') as HTMLInputElement;
    expect(proHe.checked).toBe(true);
    expect(proShe.checked).toBe(false);

    // 5. Boolean Segmented Buttons in separate div wrappers (Anchor Days, Relocation, Authorized to work)
    const filledSemantics = report.details.map((d) => d.semantic);
    expect(filledSemantics).toContain('office_commitment');
    expect(filledSemantics).toContain('relocation');
    expect(filledSemantics).toContain('work_authorized');

    // 6. Relocation Location Checkboxes (both New York and San Francisco)
    const locNy = document.getElementById('loc-ny') as HTMLInputElement;
    const locSf = document.getElementById('loc-sf') as HTMLInputElement;
    expect(locNy.checked).toBe(true);
    expect(locSf.checked).toBe(true);

    // 7. Sponsorship Radio: Should select "None"
    const sponsorNone = document.getElementById('sponsor-none') as HTMLInputElement;
    const sponsorH1b = document.getElementById('sponsor-h1b') as HTMLInputElement;
    expect(sponsorNone.checked).toBe(true);
    expect(sponsorH1b.checked).toBe(false);

    // 8. School and Graduation Date
    const schoolInput = document.getElementById('school-input') as HTMLInputElement;
    const gradDateInput = document.getElementById('grad-date-input') as HTMLInputElement;
    expect(schoolInput.value).toBe('University of Texas at Austin');
    expect(gradDateInput.value).toBe('05/15/2026');

    // 9. Degree Type Checkbox
    const degBach = document.getElementById('deg-bach') as HTMLInputElement;
    const degMast = document.getElementById('deg-mast') as HTMLInputElement;
    expect(degBach.checked).toBe(true);
    expect(degMast.checked).toBe(false);

    // 10. EEO Demographics
    const genderMale = document.getElementById('gender-male') as HTMLInputElement;
    expect(genderMale.checked).toBe(true);

    const raceAsian = document.getElementById('race-asian') as HTMLInputElement;
    const raceWhite = document.getElementById('race-white') as HTMLInputElement;
    expect(raceAsian.checked).toBe(true);
    expect(raceWhite.checked).toBe(false);

    const vetNo = document.getElementById('vet-no') as HTMLInputElement;
    expect(vetNo.checked).toBe(true);

    expect(report.fieldsFilled).toBeGreaterThanOrEqual(13);
  });
});
