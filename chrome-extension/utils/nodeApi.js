/**
 * Node.js App Communication utilities
 * All control requests are scoped by extension instance ID so multiple
 * extension instances can share one Node control server safely.
 */

import { getInstanceId } from './instanceId.js';

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
    const instanceId = await getInstanceId();
    const status = await sendCommandToNodeApp(`/status?instanceId=${encodeURIComponent(instanceId)}`);
    return { success: true, instanceId, ...status };
  } catch (error) {
    return { success: false, running: false, message: error.message };
  }
}

export async function configureNodeAppProxy(upstreamProxyUrl) {
  try {
    const instanceId = await getInstanceId();
    const result = await sendCommandToNodeApp('/config', 'POST', {
      instanceId,
      upstreamProxyUrl,
    });
    return {
      success: true,
      instanceId,
      listeningAddress: result.listeningAddress,
      upstreamProxyUrl: result.upstreamProxyUrl || upstreamProxyUrl,
      message: result.message,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Stops only this extension instance's proxy session on the Node app.
 * Other extension instances keep running.
 */
export async function stopNodeAppProxy() {
  try {
    const instanceId = await getInstanceId();
    await sendCommandToNodeApp('/stop', 'POST', { instanceId });
    return { success: true, instanceId };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
