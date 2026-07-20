/**
 * Storage utility functions
 *
 * Runtime connection state is stored in chrome.storage.local so each
 * extension instance is isolated. Shared preferences (e.g. bypass list)
 * remain in chrome.storage.sync.
 */

async function safeStorage(area, operation, data = null, defaultValue = null) {
  try {
    return await new Promise((resolve, reject) => {
      if (operation === 'get' && data) {
        area.get(data, (result) => {
          if (chrome.runtime.lastError) {
            console.error(`Error getting ${JSON.stringify(data)} from storage:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      } else if (operation === 'set' && data) {
        area.set(data, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving to storage:', chrome.runtime.lastError);
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

export async function safeSyncStorage(operation, data = null, defaultValue = null) {
  return safeStorage(chrome.storage.sync, operation, data, defaultValue);
}

export async function safeLocalStorage(operation, data = null, defaultValue = null) {
  return safeStorage(chrome.storage.local, operation, data, defaultValue);
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

/**
 * Save this extension instance's connection status.
 * Uses local storage so disconnect/connect does not affect other instances
 * that share the same Google account sync.
 */
export async function saveProxyStatus(
  status,
  upstream = null,
  siteSpecific = false,
  domain = null,
  localProxyAddress = null
) {
  const data = {
    currentProxyStatus: status,
    currentUpstream: upstream,
    siteSpecificMode: siteSpecific,
    siteSpecificDomain: domain,
    localProxyAddress: localProxyAddress,
  };
  return await safeLocalStorage('set', data, null);
}

export async function getProxyStatus() {
  // Prefer local (instance-isolated) state; fall back to sync once for migration.
  const local = await safeLocalStorage(
    'get',
    [
      'currentProxyStatus',
      'currentUpstream',
      'siteSpecificMode',
      'siteSpecificDomain',
      'localProxyAddress',
    ],
    null
  );

  if (local && local.currentProxyStatus) {
    const bypass = await getStoredBypassList();
    return {
      currentProxyStatus: local.currentProxyStatus,
      currentUpstream: local.currentUpstream || null,
      siteSpecificMode: !!local.siteSpecificMode,
      siteSpecificDomain: local.siteSpecificDomain || null,
      localProxyAddress: local.localProxyAddress || null,
      bypassList: bypass,
    };
  }

  const synced = await safeSyncStorage(
    'get',
    [
      'currentProxyStatus',
      'currentUpstream',
      'siteSpecificMode',
      'siteSpecificDomain',
      'bypassList',
      'localProxyAddress',
    ],
    {
      currentProxyStatus: 'disconnected',
      currentUpstream: null,
      siteSpecificMode: false,
      siteSpecificDomain: null,
      bypassList: [],
      localProxyAddress: null,
    }
  );

  // Migrate runtime connection fields into local storage
  if (synced.currentProxyStatus && synced.currentProxyStatus !== 'disconnected') {
    await saveProxyStatus(
      synced.currentProxyStatus,
      synced.currentUpstream,
      synced.siteSpecificMode,
      synced.siteSpecificDomain,
      synced.localProxyAddress
    );
  }

  return synced;
}
