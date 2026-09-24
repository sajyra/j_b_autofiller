import React, { useRef, useState } from 'react';
import { CandidateProfile } from '../../types/profile';
import { autofillAshby } from '../../content/ashby/ashbyFiller';
import { AutofillReport } from '../../types/autofill';
import { Play, RotateCcw, CheckCircle2, Sparkles } from 'lucide-react';

interface Props {
  profile: CandidateProfile;
}

export default function Playground({ profile }: Props) {
  const formRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<AutofillReport | null>(null);
  const [isFilling, setIsFilling] = useState(false);

  const handleTestAutofill = async () => {
    if (!formRef.current) return;
    setIsFilling(true);

    try {
      const res = await autofillAshby(profile, formRef.current);
      setReport(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsFilling(false);
    }
  };

  const handleClear = () => {
    if (!formRef.current) return;
    const inputs = formRef.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select'
    );
    inputs.forEach((input) => {
      if (input.type === 'radio' || input.type === 'checkbox') {
        (input as HTMLInputElement).checked = false;
      } else if (input.type === 'file') {
        (input as HTMLInputElement).value = '';
      } else {
        input.value = '';
      }
    });
    setReport(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Ashby Interactive Test Playground
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Test your profile autofill right here against authentic Ashby form components without needing to visit an external website.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Form
          </button>

          <button
            onClick={handleTestAutofill}
            disabled={isFilling}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isFilling ? 'Filling...' : 'Test Autofill Now'}
          </button>
        </div>
      </div>

      {/* Results banner if autofill was run */}
      {report && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-900">
                Autofill Complete: Filled {report.fieldsFilled} of {report.totalFieldsFound} fields!
              </span>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full font-medium">
              Platform: Ashby
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {report.details.map((d, idx) => (
              <div
                key={idx}
                className="bg-white/90 border border-emerald-100 p-2 rounded-lg flex items-center justify-between"
              >
                <span className="font-mono text-[11px] text-slate-700 truncate mr-1">{d.semantic}</span>
                {d.success ? (
                  <span className="text-emerald-600 font-bold">✓</span>
                ) : (
                  <span className="text-rose-500 font-bold">✕</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simulated Ashby Form Container */}
      <div
        ref={formRef}
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs max-w-2xl mx-auto space-y-6"
      >
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-xl font-bold text-slate-900">Apply for Senior Software Engineer</h3>
          <p className="text-xs text-slate-500 mt-0.5">Ashby HQ • San Francisco, CA (Hybrid)</p>
        </div>

        {/* Section: Candidate Information */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Information</h4>

          {/* Ashby Field Entry: First Name */}
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-first-name">
              First Name *
            </label>
            <input
              id="ashby-first-name"
              name="firstName"
              type="text"
              autoComplete="given-name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Ashby Field Entry: Last Name */}
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-last-name">
              Last Name *
            </label>
            <input
              id="ashby-last-name"
              name="lastName"
              type="text"
              autoComplete="family-name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Ashby Field Entry: Email */}
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-email">
              Email *
            </label>
            <input
              id="ashby-email"
              name="email"
              type="email"
              autoComplete="email"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Ashby Field Entry: Phone */}
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-phone">
              Phone Number *
            </label>
            <input
              id="ashby-phone"
              name="phoneNumber"
              type="tel"
              autoComplete="tel"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Ashby Field Entry: Location */}
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-location">
              Current Location (City, State)
            </label>
            <input
              id="ashby-location"
              name="location"
              type="text"
              placeholder="e.g. San Francisco, CA"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Section: Resume Upload */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Resume / CV</h4>
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-resume">
              Resume / CV *
            </label>
            <input
              id="ashby-resume"
              name="resume"
              type="file"
              accept=".pdf,.doc,.docx"
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>
        </div>

        {/* Section: Links */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Links</h4>

          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-linkedin">
              LinkedIn Profile
            </label>
            <input
              id="ashby-linkedin"
              name="linkedinUrl"
              type="url"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-github">
              GitHub URL
            </label>
            <input
              id="ashby-github"
              name="githubUrl"
              type="url"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-portfolio">
              Portfolio or Personal Website
            </label>
            <input
              id="ashby-portfolio"
              name="portfolioUrl"
              type="url"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Section: Questions */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Additional Questions</h4>

          {/* Work Auth Radio Group */}
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Are you legally authorized to work in the United States? *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="radio" name="auth-question" value="yes" className="w-4 h-4 text-indigo-600" />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="radio" name="auth-question" value="no" className="w-4 h-4 text-indigo-600" />
                No
              </label>
            </div>
          </div>

          {/* Visa Sponsorship Radio Group */}
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Will you now or in the future require visa sponsorship? *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="radio" name="sponsorship-question" value="yes" className="w-4 h-4 text-indigo-600" />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="radio" name="sponsorship-question" value="no" className="w-4 h-4 text-indigo-600" />
                No
              </label>
            </div>
          </div>

          {/* Notice Period */}
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-notice">
              What is your notice period or earliest start date?
            </label>
            <input
              id="ashby-notice"
              name="noticePeriod"
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Custom Salary Question */}
          <div className="ashby-application-form-field-entry">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ashby-salary">
              What are your salary expectations?
            </label>
            <input
              id="ashby-salary"
              name="salaryExpectations"
              type="text"
              placeholder="e.g. $160,000 - $190,000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
