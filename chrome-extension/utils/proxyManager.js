/**
 * Chrome Proxy Settings Management
 */

import { getStoredBypassList } from './storage.js';
import { formatBypassListForChrome } from './bypassList.js';

export const LOCAL_PROXY_ADDRESS = '127.0.0.1:9999';

export async function setChromeProxy(proxyUrl) {
  const userBypassList = await getStoredBypassList();
  console.log("Using bypass list:", userBypassList);

  // Parse the proxy URL
  const [host, portStr] = proxyUrl.split(':');
  const port = parseInt(portStr, 10);

  if (!host || isNaN(port)) {
    console.error(`Invalid proxy URL format: ${proxyUrl}`);
    return;
  }

  const formattedBypassList = formatBypassListForChrome(userBypassList);
  console.log("Formatted bypass list for Chrome:", formattedBypassList);

  // No need to expand the bypass list anymore since we're using wildcards
  const config = {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: "http", // The local proxy server is HTTP
        host: host,
        port: port,
      },
      bypassList: formattedBypassList
    }
  };
  
  try {
    await new Promise((resolve, reject) => {
      chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error setting Chrome proxy:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log(`Chrome proxy set to: ${proxyUrl}`);
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('Failed to set Chrome proxy:', error);
    throw error;
  }
}

export async function setSiteSpecificProxy(targetDomain, proxyAddress) {
  const pacScript = `function FindProxyForURL(url, host) {
    // Convert hostname to lowercase
    host = host.toLowerCase();
    
    // Remove any www. prefix
    host = host.replace(/^www\\./, '');
    
    // Check if the host matches the target domain or is a subdomain
    if (host === "${targetDomain}" || host.endsWith(".${targetDomain}")) {
      return "PROXY ${proxyAddress}";
    }
    
    // For all other hosts, use direct connection
    return "DIRECT";
  }`;
  
  console.log("Using PAC script for site-specific proxy:", pacScript);
  
  // Use PAC script configuration
  const config = {
    mode: "pac_script",
    pacScript: {
      data: pacScript
    }
  };
  
  await new Promise((resolve, reject) => {
    chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error setting Chrome proxy with PAC script:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log(`Chrome proxy set with PAC script for ${targetDomain} only`);
        resolve();
      }
    });
  });
}

export async function clearChromeProxy() {
  try {
    await new Promise((resolve, reject) => {
      chrome.proxy.settings.clear({ scope: 'regular' }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing Chrome proxy:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Chrome proxy cleared (using system settings).');
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('Failed to clear Chrome proxy:', error);
    throw error;
  }
}

export function getChromeProxyStatus() {
  return new Promise((resolve) => {
    chrome.proxy.settings.get({incognito: false}, (config) => {
      if (chrome.runtime.lastError) {
        resolve({ status: 'error', message: chrome.runtime.lastError.message });
        return;
      }
      let statusText = 'System Settings';
      if (config.value.mode === 'fixed_servers' && 
          config.value.rules && 
          config.value.rules.singleProxy &&
          `${config.value.rules.singleProxy.host}:${config.value.rules.singleProxy.port}` === LOCAL_PROXY_ADDRESS) {
          statusText = `Active (${LOCAL_PROXY_ADDRESS})`;
      } else if (config.value.mode !== 'system') {
          statusText = `Other (${config.value.mode})`;
      }
      resolve({ status: 'success', proxyStatus: statusText, config: config.value });
    });
  });
} 