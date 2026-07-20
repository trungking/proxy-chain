// proxy-chain/chrome-extension/handlers/messageHandlers.js

/**
 * Chrome Runtime Message Handlers
 */

import { getNodeAppStatus, configureNodeAppProxy, stopNodeAppProxy } from '../utils/nodeApi.js';
import { setChromeProxy, setSiteSpecificProxy, clearChromeProxy, getChromeProxyStatus } from '../utils/proxyManager.js';
import { saveProxyStatus } from '../utils/storage.js';
import { updateBadgeForCurrentTab } from '../utils/badgeManager.js';
import { getInstanceId } from '../utils/instanceId.js';

export async function handleConnectProxy(data, sendResponse) {
  const { upstreamProxyUrl, siteSpecific, targetDomain } = data;
  
  if (!upstreamProxyUrl) {
    sendResponse({ success: false, message: 'Upstream proxy URL is required.' });
    return;
  }
  
  console.log("Connect proxy request:", data);
  
  // Node app configuration happens first (scoped to this extension instance)
  const nodeAppConfigResult = await configureNodeAppProxy(upstreamProxyUrl);
  
  if (nodeAppConfigResult.success) {
    try {
      const localProxyAddress = nodeAppConfigResult.listeningAddress;
      if (!localProxyAddress) {
        throw new Error('Node.js app did not return a listening address for this instance.');
      }

      // If Node app is configured, then set Chrome's proxy settings
      if (siteSpecific && targetDomain) {
        // For site-specific proxy, we use a PAC script
        await setSiteSpecificProxy(targetDomain, localProxyAddress);
      } else {
        // Standard proxy configuration using this instance's local proxy address
        await setChromeProxy(localProxyAddress);
      }
      
      let statusMessage = 'Proxy connected and Chrome settings applied.';
      if (siteSpecific && targetDomain) {
        statusMessage = `Proxy connected for ${targetDomain} only.`;
      }
      
      // Save connection status to sync storage
      await saveProxyStatus(
        'connected',
        upstreamProxyUrl,
        siteSpecific,
        targetDomain,
        localProxyAddress
      );
      
      updateBadgeForCurrentTab();
      sendResponse({
        success: true,
        message: statusMessage,
        instanceId: nodeAppConfigResult.instanceId,
        localProxyAddress,
      });
    } catch (error) {
      console.error('Error setting Chrome proxy:', error);
      // Roll back this instance's node session if Chrome config failed
      await stopNodeAppProxy();
      sendResponse({ success: false, message: `Failed to configure Chrome proxy: ${error.message}` });
    }
  } else {
    sendResponse({ success: false, message: `Failed to configure Node.js app: ${nodeAppConfigResult.message}` });
  }
}

export async function handleDisconnectProxy(sendResponse) {
  try {
    await clearChromeProxy();
    // Stop only this extension instance's Node.js proxy session.
    // Other extension instances keep their sessions running.
    await stopNodeAppProxy();
    
    // Save disconnected status to sync storage
    await saveProxyStatus('disconnected', null, false, null, null);
    
    sendResponse({ success: true, message: 'Proxy disconnected for this extension instance.' });
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

export async function handleGetInstanceId(sendResponse) {
  try {
    const instanceId = await getInstanceId();
    sendResponse({ success: true, instanceId });
  } catch (error) {
    sendResponse({ success: false, message: error.message });
  }
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
        case "getInstanceId":
          await handleGetInstanceId(sendResponse);
          break;
        default:
          sendResponse({ success: false, message: `Unknown action: ${request.action}` });
      }
    })();
    return true; // Indicates that the response is sent asynchronously
  });
}
