/**
 * Chrome Extension MV3 Background Service Worker
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Instapp] Extension installed. Opening dashboard onboarding...');
    chrome.runtime.openOptionsPage();
  }
});

// Relay messages between popup and active content tabs
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'OPEN_OPTIONS_PAGE') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
});
