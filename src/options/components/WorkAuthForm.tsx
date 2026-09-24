import React from 'react';
import { WorkAuthorization } from '../../types/profile';
import { ShieldCheck, Calendar, Clock } from 'lucide-react';

interface Props {
  data: WorkAuthorization;
  onChange: (data: WorkAuthorization) => void;
}

export default function WorkAuthForm({ data, onChange }: Props) {
  const update = (field: keyof WorkAuthorization, val: any) => {
    onChange({ ...data, [field]: val });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          Work Authorization & Sponsorship
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Nearly every Ashby application asks whether you are legally authorized to work and if you need visa sponsorship.
        </p>
      </div>

      <div className="space-y-4">
        {/* Question 1: Authorized in US */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Are you legally authorized to work in the country of the role (e.g. United States)?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="authorizedInUS"
                value="yes"
                checked={data.authorizedInUS === 'yes'}
                onChange={() => update('authorizedInUS', 'yes')}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="authorizedInUS"
                value="no"
                checked={data.authorizedInUS === 'no'}
                onChange={() => update('authorizedInUS', 'no')}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">No</span>
            </label>
          </div>
        </div>

        {/* Question 2: Requires Sponsorship */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Will you now or in the future require employment visa sponsorship (e.g. H-1B, TN, O-1, etc.)?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="requiresSponsorship"
                value="yes"
                checked={data.requiresSponsorship === 'yes'}
                onChange={() => update('requiresSponsorship', 'yes')}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="requiresSponsorship"
                value="no"
                checked={data.requiresSponsorship === 'no'}
                onChange={() => update('requiresSponsorship', 'no')}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">No</span>
            </label>
          </div>
        </div>

        {/* Question 3: Notice Period */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Notice Period / Availability
          </label>
          <input
            type="text"
            value={data.noticePeriod}
            onChange={(e) => update('noticePeriod', e.target.value)}
            placeholder="e.g. 2 weeks, Immediate, 1 month"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Question 4: Earliest Start Date */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Earliest Start Date (Optional)
          </label>
          <input
            type="text"
            value={data.earliestStartDate || ''}
            onChange={(e) => update('earliestStartDate', e.target.value)}
            placeholder="e.g. Next Monday, Immediately, or MM/DD/YYYY"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}
