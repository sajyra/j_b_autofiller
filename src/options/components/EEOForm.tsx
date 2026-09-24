import React from 'react';
import { EEOInfo, GenderChoice, RaceChoice, VeteranChoice, DisabilityChoice } from '../../types/profile';
import { HeartHandshake } from 'lucide-react';

interface Props {
  data: EEOInfo;
  onChange: (data: EEOInfo) => void;
}

export default function EEOForm({ data, onChange }: Props) {
  const update = (field: keyof EEOInfo, val: any) => {
    onChange({ ...data, [field]: val });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-indigo-600" />
          Equal Opportunity & Voluntary Demographic Disclosures
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Employers are often required by federal law to ask voluntary demographic questions. Configure your preferred choices once.
        </p>
      </div>

      <div className="space-y-4">
        {/* Gender */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Gender Identity
          </label>
          <select
            value={data.gender}
            onChange={(e) => update('gender', e.target.value as GenderChoice)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="decline">I do not wish to answer / Decline to self-identify</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-Binary</option>
          </select>
        </div>

        {/* Race / Ethnicity */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Race / Ethnicity
          </label>
          <select
            value={data.race}
            onChange={(e) => update('race', e.target.value as RaceChoice)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="decline">I do not wish to answer / Decline to self-identify</option>
            <option value="south-asian">South Asian (e.g. Indian, Pakistani, Bangladeshi, etc.)</option>
            <option value="asian">Asian (General / East / Southeast)</option>
            <option value="white">White</option>
            <option value="black">Black or African American</option>
            <option value="hispanic">Hispanic or Latino</option>
            <option value="native">American Indian or Alaska Native</option>
            <option value="pacific">Native Hawaiian or Other Pacific Islander</option>
            <option value="two-or-more">Two or More Races</option>
          </select>
        </div>

        {/* Veteran Status */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Veteran Status
          </label>
          <select
            value={data.veteran}
            onChange={(e) => update('veteran', e.target.value as VeteranChoice)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="no">I am not a protected veteran</option>
            <option value="yes">I identify as one or more classifications of protected veteran</option>
            <option value="decline">I do not wish to answer / Decline to self-identify</option>
          </select>
        </div>

        {/* Disability */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Disability Status
          </label>
          <select
            value={data.disability}
            onChange={(e) => update('disability', e.target.value as DisabilityChoice)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="no">No, I do not have a disability</option>
            <option value="yes">Yes, I have a disability (or previously had a disability)</option>
            <option value="decline">I do not wish to answer / Decline to self-identify</option>
          </select>
        </div>
      </div>
    </div>
  );
}
