/**
 * Per-extension-instance identity
 *
 * Stored in chrome.storage.local so each browser profile / unpacked load
 * gets its own ID and never shares connection control with other instances.
 */

const INSTANCE_ID_KEY = 'extensionInstanceId';

function generateInstanceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `ext-${timePart}-${randomPart}`;
}

/**
 * Returns the stable random ID for this extension instance.
 * Creates and persists one on first use.
 */
export async function getInstanceId() {
  try {
    const result = await chrome.storage.local.get([INSTANCE_ID_KEY]);
    if (result[INSTANCE_ID_KEY]) {
      return result[INSTANCE_ID_KEY];
    }

    const instanceId = generateInstanceId();
    await chrome.storage.local.set({ [INSTANCE_ID_KEY]: instanceId });
    console.log('Generated new extension instance ID:', instanceId);
    return instanceId;
  } catch (error) {
    console.error('Failed to load/store extension instance ID:', error);
    // Last-resort ephemeral ID so the request can still be scoped
    return generateInstanceId();
  }
}
