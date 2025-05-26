// proxy-chain/chrome-extension/handlers/messageHandlers.js

/**
 * Chrome Runtime Message Handlers
 */

import { getNodeAppStatus, configureNodeAppProxy, stopNodeAppProxy } from '../utils/nodeApi.js';
import { setChromeProxy, setSiteSpecificProxy, clearChromeProxy, getChromeProxyStatus, LOCAL_PROXY_ADDRESS } from '../utils/proxyManager.js';
import { saveProxyStatus } from '../utils/storage.js';
import { updateBadgeForCurrentTab } from '../utils/badgeManager.js';

export async function handleConnectProxy(data, sendResponse) {
  const { upstreamProxyUrl, siteSpecific, targetDomain } = data;
  
  if (!upstreamProxyUrl) {
    sendResponse({ success: false, message: 'Upstream proxy URL is required.' });
    return;
  }
  
  console.log("Connect proxy request:", data);
  
  // Node app configuration happens first
  const nodeAppConfigResult = await configureNodeAppProxy(upstreamProxyUrl);
  
  if (nodeAppConfigResult.success) {
    try {
      // If Node app is configured, then set Chrome's proxy settings
      if (siteSpecific && targetDomain) {
        // For site-specific proxy, we use a PAC script
        await setSiteSpecificProxy(targetDomain, LOCAL_PROXY_ADDRESS);
      } else {
        // Standard proxy configuration using the local proxy address
        await setChromeProxy(LOCAL_PROXY_ADDRESS);
      }
      
      let statusMessage = 'Proxy connected and Chrome settings applied.';
      if (siteSpecific && targetDomain) {
        statusMessage = `Proxy connected for ${targetDomain} only.`;
      }
      
      // Save connection status to sync storage
      await saveProxyStatus('connected', upstreamProxyUrl, siteSpecific, targetDomain);
      
      updateBadgeForCurrentTab();
      sendResponse({ success: true, message: statusMessage });
    } catch (error) {
      console.error('Error setting Chrome proxy:', error);
      sendResponse({ success: false, message: `Failed to configure Chrome proxy: ${error.message}` });
    }
  } else {
    sendResponse({ success: false, message: `Failed to configure Node.js app: ${nodeAppConfigResult.message}` });
  }
}

export async function handleDisconnectProxy(sendResponse) {
  try {
    await clearChromeProxy();
    // Optionally stop the Node.js proxy server or leave it running but unused.
    // For now, we'll just clear Chrome's settings and update status.
    await stopNodeAppProxy(); // Uncomment if Node.js proxy should be stopped.
    
    // Save disconnected status to sync storage
    await saveProxyStatus('disconnected', null, false, null);
    
    sendResponse({ success: true, message: 'Proxy disconnected.' });
  } catch (error) {
    console.error('Error disconnecting proxy:', error);
    sendResponse({ success: false, message: `Failed to disconnect proxy: ${error.message}` });
  }
}

export async function handleGetNodeAppStatus(sendResponse) {
  const status = await getNodeAppStatus();
  sendResponse(status);
}

export async function handleGetChromeProxyStatus(sendResponse) {
  const result = await getChromeProxyStatus();
  sendResponse(result);
}

// Main message listener
export function setupMessageHandlers() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      switch (request.action) {
        case "getNodeAppStatus":
          await handleGetNodeAppStatus(sendResponse);
          break;
        case "connectProxy":
          await handleConnectProxy(request.data, sendResponse);
          break;
        case "disconnectProxy":
          await handleDisconnectProxy(sendResponse);
          break;
        case "getChromeProxyStatus":
          await handleGetChromeProxyStatus(sendResponse);
          break;
        default:
          sendResponse({ success: false, message: `Unknown action: ${request.action}` });
      }
    })();
    return true; // Indicates that the response is sent asynchronously
  });
} 