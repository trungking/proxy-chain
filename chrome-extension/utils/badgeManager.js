/**
 * Chrome Extension Badge Management
 */

import { getProxyStatus } from './storage.js';
import { isUrlInBypassList } from './bypassList.js';

// Add new function to update badge based on current tab
export async function updateBadgeForCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const data = await getProxyStatus();

    if (data.currentProxyStatus === 'connected') {
      // Site-specific mode handling
      if (data.siteSpecificMode && data.siteSpecificDomain) {
        const url = new URL(tab.url);
        const hostname = url.hostname.replace(/^www\./, '');
        
        // Check if the current tab's domain matches the site-specific domain
        if (hostname === data.siteSpecificDomain || hostname.endsWith('.' + data.siteSpecificDomain)) {
          chrome.action.setBadgeText({ text: 'SITE' });
          chrome.action.setBadgeBackgroundColor({ color: '#6610f2' }); // Purple to match the site-action button
        } else {
          chrome.action.setBadgeText({ text: 'OFF' });
          chrome.action.setBadgeBackgroundColor({ color: '#6c757d' }); // Gray for sites not being proxied
        }
      } 
      // Standard proxy mode with bypass list
      else if (isUrlInBypassList(tab.url, data.bypassList)) {
        chrome.action.setBadgeText({ text: 'BYPASS' });
        chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
      } else {
        chrome.action.setBadgeText({ text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ color: [76, 175, 80, 255] });
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) {
    console.error('Error updating badge:', e);
  }
}

// Setup badge update listeners
export function setupBadgeListeners() {
  // Add tab change listeners
  chrome.tabs.onActivated.addListener(() => {
    updateBadgeForCurrentTab();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id === tabId) {
          updateBadgeForCurrentTab();
        }
      });
    }
  });
} 