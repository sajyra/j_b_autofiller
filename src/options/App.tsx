import React, { useEffect, useState, useRef } from 'react';
import {
  CandidateProfile,
  DEFAULT_PROFILE,
  PersonalInfo,
  WorkAuthorization,
  Links,
  EEOInfo,
  EducationExperience,
  CustomQuestionAnswer,
  ResumeFile,
} from '../types/profile';
import {
  getActiveProfile,
  saveActiveProfile,
  exportProfileJSON,
  importProfileJSON,
} from '../storage/profileStorage';
import PersonalInfoForm from './components/PersonalInfoForm';
import WorkAuthForm from './components/WorkAuthForm';
import LinksForm from './components/LinksForm';
import ResumeUpload from './components/ResumeUpload';
import EEOForm from './components/EEOForm';
import ExperienceForm from './components/ExperienceForm';
import CustomQAForm from './components/CustomQAForm';
import Playground from './components/Playground';
import {
  User,
  ShieldCheck,
  Link2,
  FileText,
  HeartHandshake,
  Briefcase,
  HelpCircle,
  Sparkles,
  Zap,
  Download,
  Upload,
  Check,
  Clock,
} from 'lucide-react';

type Tab = 'personal' | 'workAuth' | 'links' | 'resume' | 'eeo' | 'experience' | 'customQA' | 'playground';

export default function App() {
  const [profile, setProfile] = useState<CandidateProfile>(DEFAULT_PROFILE);
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [notification, setNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile on mount
  useEffect(() => {
    getActiveProfile().then((p) => {
      setProfile(p);
      setSaveStatus('saved');
    });
  }, []);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Save profile helper
  const handleSave = async (updated: CandidateProfile) => {
    setSaveStatus('saving');
    try {
      await saveActiveProfile(updated);
      setProfile(updated);
      setSaveStatus('saved');
      notify('Profile saved successfully!');
    } catch (e) {
      console.error(e);
      setSaveStatus('dirty');
    }
  };

  // Section updaters
  const updatePersonal = (val: PersonalInfo) => {
    const updated = { ...profile, personal: val };
    setProfile(updated);
    handleSave(updated);
  };

  const updateWorkAuth = (val: WorkAuthorization) => {
    const updated = { ...profile, workAuth: val };
    setProfile(updated);
    handleSave(updated);
  };

  const updateLinks = (val: Links) => {
    const updated = { ...profile, links: val };
    setProfile(updated);
    handleSave(updated);
  };

  const updateResume = (val: ResumeFile | null) => {
    const updated = { ...profile, resume: val };
    setProfile(updated);
    handleSave(updated);
  };

  const updateEEO = (val: EEOInfo) => {
    const updated = { ...profile, eeo: val };
    setProfile(updated);
    handleSave(updated);
  };

  const updateExperience = (val: EducationExperience) => {
    const updated = { ...profile, experience: val };
    setProfile(updated);
    handleSave(updated);
  };

  const updateCustomQA = (val: CustomQuestionAnswer[]) => {
    const updated = { ...profile, customQA: val };
    setProfile(updated);
    handleSave(updated);
  };

  // Export JSON
  const handleExport = () => {
    const jsonStr = exportProfileJSON(profile);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instapp-profile-${profile.profileName.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Profile exported to JSON!');
  };

  // Import JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const imported = await importProfileJSON(text);
        setProfile(imported);
        setSaveStatus('saved');
        notify('Profile imported successfully!');
      } catch (err: any) {
        alert(`Error importing profile: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Calculate completeness percentage
  const calculateCompleteness = (): number => {
    const fields = [
      profile.personal.firstName,
      profile.personal.lastName,
      profile.personal.email,
      profile.personal.phone,
      profile.personal.city,
      profile.personal.state,
      profile.links.linkedin,
      profile.workAuth.authorizedInUS,
      profile.workAuth.requiresSponsorship,
      profile.resume?.dataUrl,
    ];
    const filled = fields.filter((f) => f && f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  };

  const completeness = calculateCompleteness();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">Instapp</h1>
              <p className="text-xs text-slate-500 font-medium">Candidate Profile Hub & Ashby Autofiller</p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            {/* Auto-save badge */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {saveStatus === 'saving' ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>All changes saved</span>
                </>
              )}
            </div>

            {/* Export JSON */}
            <button
              onClick={handleExport}
              title="Export profile JSON backup"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Import JSON */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import profile JSON backup"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-medium z-50 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          {notification}
        </div>
      )}

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full flex flex-col md:flex-row gap-8">
        {/* Left Sidebar Tabs */}
        <aside className="w-full md:w-64 shrink-0 space-y-6">
          {/* Profile Overview Card */}
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                Profile Completeness
              </span>
              <span className="text-xs font-bold text-slate-700">{completeness}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-3">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {completeness === 100
                ? 'Your profile is fully configured and ready to autofill!'
                : 'Complete key personal, link, and work auth fields for maximum autofill accuracy.'}
            </p>
          </div>

          {/* Navigation Tab Links */}
          <nav className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs space-y-1">
            <button
              onClick={() => setActiveTab('personal')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                activeTab === 'personal'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              Personal Info
            </button>

            <button
              onClick={() => setActiveTab('workAuth')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                activeTab === 'workAuth'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Work Authorization
            </button>

            <button
              onClick={() => setActiveTab('links')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                activeTab === 'links'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Link2 className="w-4 h-4" />
              Websites & Links
            </button>

            <button
              onClick={() => setActiveTab('resume')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                activeTab === 'resume'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4" />
                <span>Resume & CV</span>
              </div>
              {profile.resume && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Resume active" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('eeo')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                activeTab === 'eeo'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <HeartHandshake className="w-4 h-4" />
              EEO & Demographics
            </button>

            <button
              onClick={() => setActiveTab('experience')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                activeTab === 'experience'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Experience & Education
            </button>

            <button
              onClick={() => setActiveTab('customQA')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                activeTab === 'customQA'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              Custom Q&A Rules
            </button>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveTab('playground')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                  activeTab === 'playground'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm'
                    : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Ashby Playground</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    activeTab === 'playground'
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  Test
                </span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs min-w-0">
          {activeTab === 'personal' && (
            <PersonalInfoForm data={profile.personal} onChange={updatePersonal} />
          )}

          {activeTab === 'workAuth' && (
            <WorkAuthForm data={profile.workAuth} onChange={updateWorkAuth} />
          )}

          {activeTab === 'links' && <LinksForm data={profile.links} onChange={updateLinks} />}

          {activeTab === 'resume' && (
            <ResumeUpload data={profile.resume} onChange={updateResume} />
          )}

          {activeTab === 'eeo' && <EEOForm data={profile.eeo} onChange={updateEEO} />}

          {activeTab === 'experience' && (
            <ExperienceForm data={profile.experience} onChange={updateExperience} />
          )}

          {activeTab === 'customQA' && (
            <CustomQAForm data={profile.customQA} onChange={updateCustomQA} />
          )}

          {activeTab === 'playground' && <Playground profile={profile} />}
        </main>
      </div>
    </div>
  );
}
