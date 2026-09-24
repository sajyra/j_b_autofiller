import React from 'react';
import { Links } from '../../types/profile';
import { Link2, Linkedin, Github, Globe, Twitter } from 'lucide-react';

interface Props {
  data: Links;
  onChange: (data: Links) => void;
}

export default function LinksForm({ data, onChange }: Props) {
  const update = (field: keyof Links, val: string) => {
    onChange({ ...data, [field]: val });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-indigo-600" />
          Websites & Social Profiles
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Provide your professional links. Ashby forms frequently match LinkedIn, GitHub, and Portfolio URLs.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Linkedin className="w-4 h-4 text-blue-600" />
            LinkedIn Profile URL
          </label>
          <input
            type="url"
            value={data.linkedin}
            onChange={(e) => update('linkedin', e.target.value)}
            placeholder="https://linkedin.com/in/username"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Github className="w-4 h-4 text-slate-800" />
            GitHub Profile URL
          </label>
          <input
            type="url"
            value={data.github}
            onChange={(e) => update('github', e.target.value)}
            placeholder="https://github.com/username"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-indigo-600" />
            Personal Portfolio / Website
          </label>
          <input
            type="url"
            value={data.portfolio}
            onChange={(e) => update('portfolio', e.target.value)}
            placeholder="https://alexmercer.dev"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Twitter className="w-4 h-4 text-sky-500" />
            Twitter / X Profile
          </label>
          <input
            type="url"
            value={data.twitter}
            onChange={(e) => update('twitter', e.target.value)}
            placeholder="https://x.com/username"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-slate-400" />
            Other Website / Blog
          </label>
          <input
            type="url"
            value={data.otherWebsite}
            onChange={(e) => update('otherWebsite', e.target.value)}
            placeholder="https://blog.alexmercer.dev"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}
