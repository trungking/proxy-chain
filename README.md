# HTTP to SOCKS5 Proxy Chain

🤖 **Powered by AI** | Built with [Cursor](https://cursor.sh/) - *The future of coding is here!*

## Languages / Ngôn ngữ

- [English](README.md) (Current)
- [Tiếng Việt](README-vi.md) (Vietnamese)

A powerful proxy management solution that bridges HTTP and SOCKS5 protocols, featuring a Chrome extension for seamless configuration and control.

![Proxy Chain](chrome-extension/images/icon128.png)

## Overview

This project enables you to use SOCKS5 proxies with applications that only support HTTP proxies. It consists of two components:

1. **Node.js Proxy Server**: Creates an HTTP proxy server that forwards requests to a configurable SOCKS5 proxy
2. **Chrome Extension**: Provides a user-friendly interface for managing proxy configurations and controlling the proxy server

## Features

- 🔄 **Protocol Conversion**: Convert between HTTP and SOCKS5 proxy protocols
- 🔒 **Authentication Support**: Use proxies requiring username/password authentication
- 📋 **Proxy Management**: Save and organize multiple proxy configurations
- 🌐 **Site-Specific Proxying**: Apply proxy only to specific domains
- ⏭️ **Bypass Rules**: Configure domains to bypass the proxy
- 🔄 **Chrome Integration**: Automatically configure Chrome's proxy settings
- ☁️ **Browser Sync**: Synchronize proxy settings across browsers with the same Google account
- 🚦 **Status Indicators**: Visual indicators for proxy connection status

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later)
- [Google Chrome](https://www.google.com/chrome/) browser

### Node.js Proxy Server

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/http-to-socks-proxy.git
   cd http-to-socks-proxy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the proxy server:
   ```bash
   npm start
   ```

### Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right corner)
3. Click "Load unpacked" and select the `chrome-extension` directory from this project
4. The Proxy Manager extension icon should appear in your browser toolbar

## Usage

### Basic Operation

1. Click the Proxy Manager icon in your Chrome toolbar
2. Configure your proxy:
   - Select a saved proxy from the list, or
   - Create a new proxy configuration by entering the details:
     - Type (SOCKS5, HTTP, or HTTPS)
     - Name (for easy identification)
     - Host and Port
     - Username and Password (if required)
3. Click "Connect" to activate the proxy
4. The extension icon will show the current proxy status

### Full Proxy URL Format

You can directly paste a full proxy URL in the following format:
```
socks5://username:password@host:port
```

### Site-Specific Proxy Mode

To apply the proxy only for a specific website:

1. Navigate to the website you want to proxy
2. Click the Proxy Manager extension icon
3. Click "Connect for [current site] only"
4. The proxy will only be active for that domain and its subdomains

### Bypass Rules

To configure domains that should bypass the proxy:

1. Click the settings (gear) icon in the extension popup
2. Add domain patterns to bypass, one per line (e.g., `*.example.com`, `domain.net`)
3. The settings will be saved automatically

## API Documentation

### Node.js Proxy Server API

The Node.js server provides a control API on `http://127.0.0.1:9998` with the following endpoints:

#### GET /status

Returns the current status of the proxy server.

**Response:**
```json
{
  "running": true,
  "listeningAddress": "127.0.0.1:9999",
  "upstreamProxyUrl": "socks5://user:pass@host:port"
}
```

#### POST /config

Configures the proxy server to use a specific upstream proxy.

**Request Body:**
```json
{
  "upstreamProxyUrl": "socks5://user:pass@host:port"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Proxy configured.",
  "upstreamProxyUrl": "socks5://user:pass@host:port"
}
```

#### POST /stop

Stops the proxy server.

**Response:**
```json
{
  "success": true,
  "message": "Proxy server stopped."
}
```

### Chrome Extension Storage

The extension uses Chrome's storage API to save:

- Proxy configurations
- Bypass lists
- Connection status
- Site-specific proxy settings

## Configuration

### Node.js Server Configuration

The following environment variables can be set before starting the server:

- `LOCAL_PROXY_PORT`: Port for the HTTP proxy server (default: 9999)
- `CONTROL_PORT`: Port for the control API (default: 9998)

Example:
```bash
LOCAL_PROXY_PORT=8080 CONTROL_PORT=8081 npm start
```

## Architecture

### System Components

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  Chrome Browser │◄────►│   Node.js App   │◄────►│  SOCKS5 Proxy   │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        ▲                       ▲
        │                       │
        │                       │
        ▼                       │
┌─────────────────┐             │
│                 │             │
│ Chrome Extension│─────────────┘
│                 │  Control API
└─────────────────┘
```

### Data Flow

1. Chrome Extension configures Node.js App via Control API
2. Chrome Browser connects to Node.js App's HTTP proxy
3. Node.js App forwards requests to configured SOCKS5 proxy
4. SOCKS5 proxy connects to target servers

## Testing

To test the proxy setup:

1. Start the Node.js server:
   ```bash
   npm start
   ```

2. Configure a proxy via the Chrome extension

3. Visit [https://www.whatismyip.com](https://www.whatismyip.com) to verify your IP has changed

## Troubleshooting

### Common Issues

#### Proxy Connection Failed

- Check if the SOCKS5 proxy is online and accessible
- Verify username and password are correct
- Ensure the proxy server supports the authentication method you're using

#### Chrome Extension Cannot Connect to Node.js App

- Verify the Node.js app is running (`npm start`)
- Check if the control port (9998) is accessible
- Look for any error messages in the browser console or Node.js console

#### Proxy Works But Some Websites Don't Load

- Some websites block proxy connections
- Try using site-specific proxy mode for sites that work with the proxy
- Add problematic domains to the bypass list

## Roadmap

Future development plans include:

- Firefox extension support
- Rotating proxy support
- Connection speed testing
- Traffic statistics and monitoring
- Proxy chain capability (multiple proxies in sequence)
- IP geolocation display

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Acknowledgments

- [proxy-chain](https://www.npmjs.com/package/proxy-chain) library for handling the proxy server functionality
- Chrome Extensions documentation for the browser integration