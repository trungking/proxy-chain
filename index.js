const ProxyChain = require('proxy-chain');
const http = require('http');

const localProxyPort = 9999;
const localProxyHost = '127.0.0.1';
const controlPort = 9998;
const controlHost = '127.0.0.1';

let currentProxyServer = null;
let currentUpstreamProxyUrl = null;

function stopProxyServer(callback) {
    if (currentProxyServer) {
        console.log('Attempting to stop existing proxy server...');
        const serverToClose = currentProxyServer;
        currentProxyServer = null;
        currentUpstreamProxyUrl = null;

        serverToClose.close(true, () => {
            console.log('Proxy server close callback executed.');
            if (callback) callback();
        });
    } else {
        console.log('No proxy server running to stop.');
        currentUpstreamProxyUrl = null;
        if (callback) callback();
    }
}

function startProxyServer(upstreamUrl, callback) {
    stopProxyServer(() => {
        if (!upstreamUrl) {
            console.log('No upstream URL provided. Proxy will not start.');
            currentUpstreamProxyUrl = null;
            if (callback) callback(new Error('Upstream URL is required.'));
            return;
        }

        currentUpstreamProxyUrl = upstreamUrl;
        console.log(`Starting proxy server on ${localProxyHost}:${localProxyPort} to ${currentUpstreamProxyUrl}`);

        currentProxyServer = new ProxyChain.Server({
            port: localProxyPort,
            host: localProxyHost,
            verbose: false, // Can be enabled for more logs if needed
            prepareRequestFunction: ({ request, hostname, port }) => {
                const method = request.method || 'UNKNOWN';
                const fullUrl = request.url || `${hostname}:${port}`;
                console.log(`[PROXY] ${method} ${fullUrl} via ${currentUpstreamProxyUrl}`);
                return {
                    upstreamProxyUrl: currentUpstreamProxyUrl,
                };
            },
        });

        currentProxyServer.listen(() => {
            console.log(`HTTP Proxy server listening on ${localProxyHost}:${localProxyPort}`);
            console.log(`Forwarding to: ${currentUpstreamProxyUrl}`);
            if (callback) callback(null, currentProxyServer);
        });

        currentProxyServer.on('connectionClosed', ({ connectionId, stats }) => {
            // console.log(`Connection ${connectionId} closed`);
            // if (stats) console.dir(stats);
        });

        currentProxyServer.on('requestFailed', ({ request, error }) => {
            const clientIp = request && request.socket ? `${request.socket.remoteAddress}:${request.socket.remotePort}` : 'unknown client';
            const targetUrlDetail = request ? request.url : 'unknown URL';
            console.error(`Request from ${clientIp} for ${targetUrlDetail} via ${currentUpstreamProxyUrl} failed:`);
            console.error(error.message);
        });
    });
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

        if (req.url === '/config' && req.method === 'POST') {
            try {
                const { upstreamProxyUrl: newUpstreamUrl } = JSON.parse(body);
                if (newUpstreamUrl) {
                    console.log(`Received config request to set upstream proxy to: ${newUpstreamUrl}`);
                    startProxyServer(newUpstreamUrl, (err) => {
                        if (err) {
                            res.writeHead(500);
                            res.end(JSON.stringify({ success: false, message: err.message }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true, message: 'Proxy configured.', upstreamProxyUrl: newUpstreamUrl }));
                        }
                    });
                } else {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, message: 'upstreamProxyUrl is required in body.' }));
                }
            } catch (error) {
                console.error("Error processing /config request:", error);
                res.writeHead(400);
                res.end(JSON.stringify({ success: false, message: 'Invalid JSON body or error processing request.' }));
            }
        } else if (req.url === '/stop' && req.method === 'POST') {
            console.log('Received request to stop proxy server.');
            stopProxyServer(() => {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, message: 'Proxy server stopped.' }));
            });
        } else if (req.url === '/status' && req.method === 'GET') {
            res.writeHead(200);
            res.end(JSON.stringify({
                running: !!currentProxyServer,
                listeningAddress: currentProxyServer ? `${localProxyHost}:${localProxyPort}` : null,
                upstreamProxyUrl: currentUpstreamProxyUrl,
            }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, message: 'Not Found' }));
        }
    });
});

controlServer.listen(controlPort, controlHost, () => {
    console.log(`Control server listening on http://${controlHost}:${controlPort}`);
    console.log('Endpoints:');
    console.log(`  POST /config   - Body: { "upstreamProxyUrl": "socks5://user:pass@host:port" }`);
    console.log(`  POST /stop`);
    console.log(`  GET  /status`);
    // Do not start the proxy by default. It will be started by the extension.
    // If you want to start with a default proxy for testing, you can call startProxyServer here.
    // e.g., startProxyServer('socks5://your_default_proxy_if_any@example.com:1080');
});

// Initial proxy URL from the original request (optional, can be removed if not needed at startup)
// const initialUpstreamProxyUrl = 'socks5://57a44be3ad9a27e78a17__cr.co:fa1291fdc0425179@gw.dataimpulse.com:10000';
// startProxyServer(initialUpstreamProxyUrl);

console.log('Node.js proxy manager started.'); 