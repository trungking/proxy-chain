/**
 * Extension Startup and Periodic Task Handlers
 */

import { getProxyStatus, saveProxyStatus } from '../utils/storage.js';
import { getNodeAppStatus } from '../utils/nodeApi.js';
import { setChromeProxy, clearChromeProxy, LOCAL_PROXY_ADDRESS } from '../utils/proxyManager.js';

export async function handleStartup() {
  console.log("Extension started up.");
  try {
    const data = await getProxyStatus();
    
    if (data.currentProxyStatus === 'connected' && data.currentUpstream) {
      console.log('Attempting to restore proxy connection on startup.');
      // Potentially re-verify Node app and Chrome proxy settings
      // Re-apply Chrome proxy settings to ensure bypass list is current if it changed while extension was off
      await setChromeProxy(LOCAL_PROXY_ADDRESS); // This will use the latest bypass list
      // Set badge if was connected (already done by setChromeProxy)
    } else {
      // Ensure proxy is cleared if not supposed to be connected
      clearChromeProxy(); 
      await saveProxyStatus('disconnected', null, false, null);
      // Badge clearing is handled by clearChromeProxy
    }
  } catch (error) {
    console.error('Error during startup processing:', error);
    // Failsafe: clear proxy settings on error
    clearChromeProxy();
  }
}

export async function handleNodeAppStatusCheck() {
  const status = await getNodeAppStatus();
  // console.log('Periodic Node.js App Status:', status);
  // Optionally update UI or take action based on status
  // This is tricky to communicate back to popup if not open.
  // Notifications could be used for critical status changes.
  if (!status.success || !status.running) {
    // If node app is not running but chrome is configured to use it, show notification
    chrome.storage.sync.get(['currentProxyStatus'], (data) => {
      if (data.currentProxyStatus === 'connected') {
        chrome.notifications.create('nodeAppDown', {
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: 'Proxy Manager Alert',
          message: 'The Node.js proxy helper app appears to be down. Proxying may not work.'
        });
      }
    });
  }
}

export function setupStartupHandlers() {
  // Initial State & Alarms (Example for periodic status check)
  chrome.runtime.onStartup.addListener(handleStartup);

  chrome.alarms.create('checkNodeAppStatus', { periodInMinutes: 1 });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkNodeAppStatus') {
      await handleNodeAppStatusCheck();
    }
  });
} 