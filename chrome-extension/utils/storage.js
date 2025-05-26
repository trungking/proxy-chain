/**
 * Storage utility functions for Chrome sync storage
 */

// Helper function for safer storage operations
export async function safeSyncStorage(operation, data = null, defaultValue = null) {
  try {
    return await new Promise((resolve, reject) => {
      if (operation === 'get' && data) {
        chrome.storage.sync.get(data, (result) => {
          if (chrome.runtime.lastError) {
            console.error(`Error getting ${JSON.stringify(data)} from sync storage:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      } else if (operation === 'set' && data) {
        chrome.storage.sync.set(data, () => {
          if (chrome.runtime.lastError) {
            console.error(`Error saving to sync storage:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(true);
          }
        });
      } else {
        reject(new Error(`Invalid storage operation: ${operation}`));
      }
    });
  } catch (error) {
    console.warn(`Storage operation failed (${operation}):`, error);
    return defaultValue;
  }
}

export async function getStoredBypassList() {
  const defaultList = ["localhost", "127.0.0.1", "<local>"];
  const result = await safeSyncStorage('get', { bypassList: defaultList }, { bypassList: defaultList });
  
  // Ensure default localhost/127.0.0.1/<local> are there if list is empty or not well-formed
  let list = Array.isArray(result.bypassList) ? result.bypassList : [];
  if (!list.includes("localhost")) list.unshift("localhost");
  if (!list.includes("127.0.0.1")) list.unshift("127.0.0.1");
  if (!list.includes("<local>")) list.unshift("<local>");
  
  // Remove duplicates that might have been added if they existed before unshift
  return [...new Set(list)];
}

export async function saveProxyStatus(status, upstream = null, siteSpecific = false, domain = null) {
  const data = { 
    currentProxyStatus: status, 
    currentUpstream: upstream,
    siteSpecificMode: siteSpecific,
    siteSpecificDomain: domain
  };
  return await safeSyncStorage('set', data, null);
}

export async function getProxyStatus() {
  return await safeSyncStorage(
    'get',
    ['currentProxyStatus', 'currentUpstream', 'siteSpecificMode', 'siteSpecificDomain', 'bypassList'],
    { 
      currentProxyStatus: 'disconnected', 
      currentUpstream: null,
      siteSpecificMode: false,
      siteSpecificDomain: null,
      bypassList: []
    }
  );
} 