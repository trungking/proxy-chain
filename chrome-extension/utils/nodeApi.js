/**
 * Node.js App Communication utilities
 */

export const NODE_APP_CONTROL_URL_BASE = 'http://127.0.0.1:9998';

export async function sendCommandToNodeApp(endpoint, method = 'GET', body = null) {
  try {
    const response = await fetch(`${NODE_APP_CONTROL_URL_BASE}${endpoint}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : null,
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`Error from Node.js app (${endpoint}): ${response.status}`, errorData);
      throw new Error(`Node.js app error: ${errorData.message || response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to communicate with Node.js app (${endpoint}):`, error);
    throw error;
  }
}

export async function getNodeAppStatus() {
  try {
    const status = await sendCommandToNodeApp('/status');
    return { success: true, ...status };
  } catch (error) {
    return { success: false, running: false, message: error.message };
  }
}

export async function configureNodeAppProxy(upstreamProxyUrl) {
  try {
    await sendCommandToNodeApp('/config', 'POST', { upstreamProxyUrl });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function stopNodeAppProxy() {
  try {
    await sendCommandToNodeApp('/stop', 'POST');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
} 