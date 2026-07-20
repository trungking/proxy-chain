const ProxyChain = require('proxy-chain');
const http = require('http');
const { URL } = require('url');

const localProxyHost = process.env.LOCAL_PROXY_HOST || '127.0.0.1';
const controlPort = parseInt(process.env.CONTROL_PORT || '9998', 10);
const controlHost = process.env.CONTROL_HOST || '127.0.0.1';

/**
 * Active proxy sessions keyed by Chrome extension instance ID.
 * Each extension instance gets its own ProxyChain server and free port so
 * one instance disconnecting cannot stop another instance's relay.
 *
 * Map<string, { server, port, host, upstreamProxyUrl }>
 */
const sessions = new Map();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode);
  res.end(JSON.stringify(payload));
}

function getSessionSnapshot(instanceId) {
  const session = sessions.get(instanceId);
  if (!session) {
    return {
      instanceId,
      running: false,
      listeningAddress: null,
      upstreamProxyUrl: null,
    };
  }

  return {
    instanceId,
    running: true,
    listeningAddress: `${session.host}:${session.port}`,
    upstreamProxyUrl: session.upstreamProxyUrl,
  };
}

function stopSession(instanceId, callback) {
  const session = sessions.get(instanceId);
  if (!session) {
    console.log(`No proxy session for instance ${instanceId} to stop.`);
    if (callback) callback();
    return;
  }

  console.log(`Stopping proxy session for instance ${instanceId} on ${session.host}:${session.port}...`);
  sessions.delete(instanceId);

  const serverToClose = session.server;
  serverToClose.close(true, () => {
    console.log(`Proxy session for instance ${instanceId} stopped.`);
    if (callback) callback();
  });
}

function startSession(instanceId, upstreamUrl, callback) {
  if (!instanceId) {
    if (callback) callback(new Error('instanceId is required.'));
    return;
  }

  stopSession(instanceId, () => {
    if (!upstreamUrl) {
      console.log(`No upstream URL for instance ${instanceId}. Proxy will not start.`);
      if (callback) callback(new Error('Upstream URL is required.'));
      return;
    }

    console.log(`Starting proxy session for instance ${instanceId} on ${localProxyHost} (auto port) -> ${upstreamUrl}`);

    const server = new ProxyChain.Server({
      // Always auto-assign a free port so multiple extension instances can coexist.
      port: 0,
      host: localProxyHost,
      verbose: false,
      prepareRequestFunction: ({ request, hostname, port }) => {
        const method = request.method || 'UNKNOWN';
        const fullUrl = request.url || `${hostname}:${port}`;
        console.log(`[PROXY ${instanceId.slice(0, 8)}] ${method} ${fullUrl} via ${upstreamUrl}`);
        return {
          upstreamProxyUrl: upstreamUrl,
        };
      },
    });

    server.listen(() => {
      const port = server.port;
      sessions.set(instanceId, {
        server,
        port,
        host: localProxyHost,
        upstreamProxyUrl: upstreamUrl,
      });

      console.log(`HTTP proxy for instance ${instanceId} listening on ${localProxyHost}:${port}`);
      console.log(`Forwarding to: ${upstreamUrl}`);

      if (callback) {
        callback(null, {
          instanceId,
          host: localProxyHost,
          port,
          listeningAddress: `${localProxyHost}:${port}`,
          upstreamProxyUrl: upstreamUrl,
        });
      }
    });

    server.on('requestFailed', ({ request, error }) => {
      const clientIp = request && request.socket
        ? `${request.socket.remoteAddress}:${request.socket.remotePort}`
        : 'unknown client';
      const targetUrlDetail = request ? request.url : 'unknown URL';
      console.error(
        `Request from ${clientIp} for ${targetUrlDetail} via ${upstreamUrl} (instance ${instanceId}) failed:`
      );
      console.error(error.message);
    });
  });
}

function parseRequestBody(body) {
  if (!body || !body.trim()) {
    return {};
  }
  return JSON.parse(body);
}

function getInstanceIdFromRequest(req, bodyObj) {
  if (bodyObj && bodyObj.instanceId) {
    return String(bodyObj.instanceId);
  }

  try {
    const requestUrl = new URL(req.url, `http://${controlHost}:${controlPort}`);
    return requestUrl.searchParams.get('instanceId');
  } catch (error) {
    return null;
  }
}

function getPathname(req) {
  try {
    return new URL(req.url, `http://${controlHost}:${controlPort}`).pathname;
  } catch (error) {
    return req.url;
  }
}

// Control HTTP Server
const controlServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*'); // For Chrome extension access
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const pathname = getPathname(req);

    if (pathname === '/config' && req.method === 'POST') {
      try {
        const payload = parseRequestBody(body);
        const instanceId = getInstanceIdFromRequest(req, payload);
        const newUpstreamUrl = payload.upstreamProxyUrl;

        if (!instanceId) {
          sendJson(res, 400, { success: false, message: 'instanceId is required.' });
          return;
        }

        if (!newUpstreamUrl) {
          sendJson(res, 400, { success: false, message: 'upstreamProxyUrl is required in body.' });
          return;
        }

        console.log(`Config request for instance ${instanceId}: ${newUpstreamUrl}`);
        startSession(instanceId, newUpstreamUrl, (err, sessionInfo) => {
          if (err) {
            sendJson(res, 500, { success: false, message: err.message, instanceId });
            return;
          }

          sendJson(res, 200, {
            success: true,
            message: 'Proxy configured.',
            instanceId: sessionInfo.instanceId,
            listeningAddress: sessionInfo.listeningAddress,
            upstreamProxyUrl: sessionInfo.upstreamProxyUrl,
          });
        });
      } catch (error) {
        console.error('Error processing /config request:', error);
        sendJson(res, 400, {
          success: false,
          message: 'Invalid JSON body or error processing request.',
        });
      }
      return;
    }

    if (pathname === '/stop' && req.method === 'POST') {
      try {
        const payload = parseRequestBody(body);
        const instanceId = getInstanceIdFromRequest(req, payload);

        if (!instanceId) {
          sendJson(res, 400, { success: false, message: 'instanceId is required.' });
          return;
        }

        console.log(`Stop request for instance ${instanceId}`);
        stopSession(instanceId, () => {
          sendJson(res, 200, {
            success: true,
            message: 'Proxy session stopped.',
            instanceId,
          });
        });
      } catch (error) {
        console.error('Error processing /stop request:', error);
        sendJson(res, 400, {
          success: false,
          message: 'Invalid JSON body or error processing request.',
        });
      }
      return;
    }

    if (pathname === '/status' && req.method === 'GET') {
      const instanceId = getInstanceIdFromRequest(req, null);

      if (instanceId) {
        sendJson(res, 200, {
          success: true,
          ...getSessionSnapshot(instanceId),
          activeSessions: sessions.size,
        });
        return;
      }

      // Without instanceId, return aggregate status for debugging / ops.
      const allSessions = Array.from(sessions.keys()).map(getSessionSnapshot);
      sendJson(res, 200, {
        success: true,
        running: sessions.size > 0,
        activeSessions: sessions.size,
        sessions: allSessions,
        // Backward-compatible fields when exactly one session exists
        listeningAddress: allSessions.length === 1 ? allSessions[0].listeningAddress : null,
        upstreamProxyUrl: allSessions.length === 1 ? allSessions[0].upstreamProxyUrl : null,
      });
      return;
    }

    sendJson(res, 404, { success: false, message: 'Not Found' });
  });
});

controlServer.listen(controlPort, controlHost, () => {
  console.log(`Control server listening on http://${controlHost}:${controlPort}`);
  console.log('Multi-instance mode: each Chrome extension instance gets an isolated proxy session.');
  console.log('Endpoints:');
  console.log('  POST /config  - Body: { "instanceId": "...", "upstreamProxyUrl": "socks5://user:pass@host:port" }');
  console.log('  POST /stop    - Body: { "instanceId": "..." }');
  console.log('  GET  /status?instanceId=...');
  console.log('  GET  /status  - lists all active sessions');
});

function shutdownAll() {
  console.log('Shutting down all proxy sessions...');
  const ids = Array.from(sessions.keys());
  let remaining = ids.length;

  if (remaining === 0) {
    process.exit(0);
    return;
  }

  ids.forEach((id) => {
    stopSession(id, () => {
      remaining -= 1;
      if (remaining <= 0) {
        process.exit(0);
      }
    });
  });
}

process.on('SIGINT', shutdownAll);
process.on('SIGTERM', shutdownAll);
