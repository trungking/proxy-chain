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

function isValidInstanceId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Returns the stable random ID for this extension instance.
 * Creates and persists one on first use.
 * Always returns a non-empty string.
 */
export async function getInstanceId() {
  try {
    const result = await chrome.storage.local.get(INSTANCE_ID_KEY);
    const existing = result?.[INSTANCE_ID_KEY];

    if (isValidInstanceId(existing)) {
      return existing.trim();
    }

    const instanceId = generateInstanceId();
    if (!isValidInstanceId(instanceId)) {
      // Extremely defensive; should never happen
      return `ext-fallback-${Date.now()}`;
    }

    await chrome.storage.local.set({ [INSTANCE_ID_KEY]: instanceId });
    console.log('Generated new extension instance ID:', instanceId);
    return instanceId;
  } catch (error) {
    console.error('Failed to load/store extension instance ID:', error);
    // Last-resort ephemeral ID so the request can still be scoped
    return generateInstanceId();
  }
}
