/**
 * Extension Startup and Periodic Task Handlers
 */

import { getProxyStatus, saveProxyStatus } from '../utils/storage.js';
import { getNodeAppStatus, configureNodeAppProxy } from '../utils/nodeApi.js';
import { setChromeProxy, setSiteSpecificProxy, clearChromeProxy } from '../utils/proxyManager.js';
import { getInstanceId } from '../utils/instanceId.js';

export async function handleStartup() {
  console.log('Extension started up.');
  try {
    const instanceId = await getInstanceId();
    console.log('Extension instance ID:', instanceId);

    const data = await getProxyStatus();
    
    if (data.currentProxyStatus === 'connected' && data.currentUpstream) {
      console.log('Attempting to restore proxy connection on startup for this instance.');

      // Re-create this instance's Node session. Port may change after Node restart.
      const configResult = await configureNodeAppProxy(data.currentUpstream);
      if (!configResult.success || !configResult.listeningAddress) {
        console.warn('Failed to restore Node session on startup:', configResult.message);
        await clearChromeProxy();
        await saveProxyStatus('disconnected', null, false, null, null);
        return;
      }

      if (data.siteSpecificMode && data.siteSpecificDomain) {
        await setSiteSpecificProxy(data.siteSpecificDomain, configResult.listeningAddress);
      } else {
        await setChromeProxy(configResult.listeningAddress);
      }

      await saveProxyStatus(
        'connected',
        data.currentUpstream,
        !!data.siteSpecificMode,
        data.siteSpecificDomain || null,
        configResult.listeningAddress
      );
    } else {
      // Ensure proxy is cleared if not supposed to be connected
      clearChromeProxy();
      await saveProxyStatus('disconnected', null, false, null, null);
    }
  } catch (error) {
    console.error('Error during startup processing:', error);
    // Failsafe: clear proxy settings on error
    clearChromeProxy();
  }
}

export async function handleNodeAppStatusCheck() {
  const status = await getNodeAppStatus();
  if (!status.success || !status.running) {
    // Use local instance status, not synced status
    chrome.storage.local.get(['currentProxyStatus'], (data) => {
      if (data.currentProxyStatus === 'connected') {
        chrome.notifications.create('nodeAppDown', {
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: 'Proxy Manager Alert',
          message: 'The Node.js proxy helper app appears to be down for this extension instance. Proxying may not work.'
        });
      }
    });
  }
}

export function setupStartupHandlers() {
  // Ensure instance ID exists as soon as the service worker boots
  getInstanceId().then((instanceId) => {
    console.log('Proxy Manager instance ready:', instanceId);
  });

  // Initial State & Alarms
  chrome.runtime.onStartup.addListener(handleStartup);
  chrome.runtime.onInstalled.addListener(handleStartup);

  chrome.alarms.create('checkNodeAppStatus', { periodInMinutes: 1 });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkNodeAppStatus') {
      await handleNodeAppStatusCheck();
    }
  });
}
