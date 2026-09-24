import { isAshbyForm, autofillAshby } from './ashby/ashbyFiller';
import { isWorkdayForm, autofillWorkday } from './workday/workdayFiller';
import { injectFloatingBadge } from './ui/floatingBadge';
import { getActiveProfile } from '../storage/profileStorage';

function detectATS(): 'ashby' | 'workday' | null {
  if (isAshbyForm()) return 'ashby';
  if (isWorkdayForm()) return 'workday';
  return null;
}

function initialize(): void {
  console.log('[Instapp] Content script initialized on:', window.location.href);

  const initialATS = detectATS();
  if (initialATS) {
    console.log(`[Instapp] ${initialATS.toUpperCase()} application page detected.`);
    injectFloatingBadge();
  } else {
    // Check if application form mounts later dynamically (SPAs)
    const observer = new MutationObserver(() => {
      const dynamicATS = detectATS();
      if (dynamicATS) {
        observer.disconnect();
        console.log(`[Instapp] Dynamic ${dynamicATS.toUpperCase()} form detected.`);
        injectFloatingBadge();
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Listen for trigger messages from Extension Popup or background worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'AUTOFILL' || message.action === 'AUTOFILL_V2') {
        const ats = detectATS();
        getActiveProfile()
          .then((profile) => {
            if (ats === 'workday') {
              return autofillWorkday(profile);
            }
            return autofillAshby(profile);
          })
          .then((report) => sendResponse({ success: true, report }))
          .catch((err) => sendResponse({ success: false, error: err.message, stack: err.stack }));
        return true; // Keep message channel open for async response
      }

      if (message.action === 'CHECK_STATUS') {
        const currentATS = detectATS();
        sendResponse({
          isAshby: currentATS === 'ashby',
          isWorkday: currentATS === 'workday',
          platform: currentATS,
        });
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}


