import React, { useEffect, useState } from 'react';
import { Zap, Settings, CheckCircle2, AlertCircle, ExternalLink, Sparkles } from 'lucide-react';
import { CandidateProfile } from '../types/profile';
import { getActiveProfile } from '../storage/profileStorage';

export default function Popup() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isAshby, setIsAshby] = useState<boolean>(false);
  const [isWorkday, setIsWorkday] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'filling' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    // Load profile
    getActiveProfile().then((p) => setProfile(p));

    // Detect if current active tab is Ashby or Workday
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url) {
          const url = activeTab.url.toLowerCase();
          if (url.includes('jobs.ashbyhq.com') || url.includes('ashby')) {
            setIsAshby(true);
          }
          if (url.includes('myworkdayjobs.com') || url.includes('myworkday.com')) {
            setIsWorkday(true);
          }
        }

        if (activeTab && activeTab.id) {
          chrome.tabs.sendMessage(activeTab.id, { action: 'CHECK_STATUS' }, (response) => {
            if (chrome.runtime.lastError) {
              // Try dynamic injection if content script isn't loaded on this pre-existing tab
              if (chrome.scripting && activeTab.id) {
                chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  files: ['content.js'],
                }).catch(() => {});
              }
            } else if (response) {
              if (response.isAshby) setIsAshby(true);
              if (response.isWorkday) setIsWorkday(true);
            }
          });
        }
      });
    }
  }, []);

  const handleAutofill = async () => {
    setStatus('filling');
    setStatusMessage('Scanning and populating fields...');

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id) {
          setStatus('error');
          setStatusMessage('No active tab found.');
          return;
        }

        const triggerMessage = () => {
          chrome.tabs.sendMessage(activeTab.id!, { action: 'AUTOFILL' }, (response) => {
            if (chrome.runtime.lastError) {
              // Attempt dynamic injection if tab was open before extension reload
              if (chrome.scripting && activeTab.id) {
                chrome.scripting
                  .executeScript({
                    target: { tabId: activeTab.id },
                    files: ['content.js'],
                  })
                  .then(() => {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(activeTab.id!, { action: 'AUTOFILL' }, (retryRes) => {
                        if (retryRes && retryRes.success && retryRes.report) {
                          setStatus('success');
                          setStatusMessage(`Successfully filled ${retryRes.report.fieldsFilled} fields!`);
                        } else {
                          setStatus('error');
                          setStatusMessage(retryRes?.error || 'Could not autofill fields.');
                        }
                      });
                    }, 200);
                  })
                  .catch(() => {
                    setStatus('error');
                    setStatusMessage('Please refresh the job page or click the floating badge.');
                  });
                return;
              }

              setStatus('error');
              setStatusMessage('Please refresh the job page or click the floating badge.');
              return;
            }

            if (response && response.success && response.report) {
              setStatus('success');
              setStatusMessage(`Successfully filled ${response.report.fieldsFilled} fields!`);
            } else {
              setStatus('error');
              setStatusMessage(response?.error || 'Could not autofill fields.');
            }
          });
        };

        triggerMessage();
      });
    } else {
      setStatus('error');
      setStatusMessage('Chrome API unavailable in standalone preview.');
    }
  };

  const openDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html', '_blank');
    }
  };

  const candidateName = profile
    ? `${profile.personal.firstName} ${profile.personal.lastName}`.trim() || 'No name set'
    : 'Loading...';

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight tracking-tight">Instapp</h1>
            <p className="text-[11px] text-slate-500 font-medium">Ashby & Workday Autofiller</p>
          </div>
        </div>
        <button
          onClick={openDashboard}
          title="Open Dashboard"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Active Profile Pill */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
            Active Profile
          </span>
          <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px]">
            {profile?.profileName || 'Default'}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-800 truncate">{candidateName}</p>
        <p className="text-xs text-slate-500 truncate">{profile?.personal.email || 'No email set'}</p>
      </div>

      {/* ATS Status Banner */}
      <div className="mb-4">
        {isWorkday ? (
          <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/60 p-2.5 rounded-lg">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Workday job application detected on this page!</span>
          </div>
        ) : isAshby ? (
          <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/60 p-2.5 rounded-lg">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Ashby job application detected on this page!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs bg-slate-100 text-slate-600 border border-slate-200/80 p-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 text-slate-400" />
            <span>Navigate to an Ashby or Workday job post.</span>
          </div>
        )}
      </div>

      {/* Main Action Button */}
      <button
        onClick={handleAutofill}
        disabled={status === 'filling'}
        className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
          status === 'filling'
            ? 'bg-indigo-400 text-white cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-[0.99]'
        }`}
      >
        <Zap className="w-4 h-4 fill-current" />
        {status === 'filling' ? 'Autofilling...' : 'Autofill Application'}
      </button>

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`mt-3 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
            status === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : status === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          ) : status === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          ) : null}
          <span className="leading-tight">{statusMessage}</span>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="mt-auto pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <button
          onClick={openDashboard}
          className="flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Full Dashboard
        </button>
        <span className="text-[10px] text-slate-400">v1.0.0</span>
      </div>
    </div>
  );
}
