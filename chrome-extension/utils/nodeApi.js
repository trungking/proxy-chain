/**
 * Node.js App Communication utilities
 * All control requests are scoped by extension instance ID so multiple
 * extension instances can share one Node control server safely.
 */

import { getInstanceId } from './instanceId.js';

export const NODE_APP_CONTROL_URL_BASE = 'http://127.0.0.1:9998';

function assertInstanceId(instanceId) {
  if (typeof instanceId !== 'string' || !instanceId.trim()) {
    throw new Error('Extension instanceId is missing or invalid.');
  }
  return instanceId.trim();
}

export async function sendCommandToNodeApp(endpoint, method = 'GET', body = null) {
  try {
    const response = await fetch(`${NODE_APP_CONTROL_URL_BASE}${endpoint}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body == null ? undefined : JSON.stringify(body),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const errorMessage = errorData?.message || response.statusText || 'Unknown error';
      console.error(
        `Error from Node.js app (${endpoint}): ${response.status}`,
        errorMessage,
        errorData
      );
      throw new Error(`Node.js app error: ${errorMessage}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to communicate with Node.js app (${endpoint}):`, error);
    throw error;
  }
}

export async function getNodeAppStatus() {
  try {
    const instanceId = assertInstanceId(await getInstanceId());
    const status = await sendCommandToNodeApp(
      `/status?instanceId=${encodeURIComponent(instanceId)}`
    );
    return { success: true, instanceId, ...status };
  } catch (error) {
    return { success: false, running: false, message: error.message };
  }
}

export async function configureNodeAppProxy(upstreamProxyUrl) {
  try {
    const instanceId = assertInstanceId(await getInstanceId());
    // Send instanceId in both query and body so it cannot be dropped by body parsing edge cases.
    const result = await sendCommandToNodeApp(
      `/config?instanceId=${encodeURIComponent(instanceId)}`,
      'POST',
      {
        instanceId,
        upstreamProxyUrl,
      }
    );

    if (!result?.listeningAddress) {
      return {
        success: false,
        message: result?.message || 'Node.js app did not return a listening address.',
        instanceId,
      };
    }

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
    const instanceId = assertInstanceId(await getInstanceId());
    await sendCommandToNodeApp(
      `/stop?instanceId=${encodeURIComponent(instanceId)}`,
      'POST',
      { instanceId }
    );
    return { success: true, instanceId };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
