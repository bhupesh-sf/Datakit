// CORS Proxy Handler for DataKit
// This provides multiple strategies to handle CORS issues with AI APIs

export interface ProxyConfig {
  strategy: 'local-proxy' | 'cors-anywhere' | 'browser-extension' | 'electron';
  proxyUrl?: string;
  port?: number;
}

export class CORSProxyHandler {
  private config: ProxyConfig;

  constructor(config: ProxyConfig = { strategy: 'local-proxy' }) {
    this.config = config;
  }

  async makeRequest(url: string, options: RequestInit): Promise<Response> {
    switch (this.config.strategy) {
      case 'local-proxy':
        return this.makeLocalProxyRequest(url, options);
      case 'cors-anywhere':
        return this.makeCORSAnywhereRequest(url, options);
      case 'browser-extension':
        return this.makeBrowserExtensionRequest(url, options);
      case 'electron':
        return this.makeElectronRequest(url, options);
      default:
        throw new Error(`Unsupported proxy strategy: ${this.config.strategy}`);
    }
  }

  private async makeLocalProxyRequest(url: string, options: RequestInit): Promise<Response> {
    // Strategy 1: Use a local proxy server
    const proxyUrl = this.config.proxyUrl || 'http://localhost:3001/api/proxy';
    
    const proxyOptions = {
      ...options,
      headers: {
        ...options.headers,
        'X-Target-URL': url,
        'Content-Type': 'application/json',
      },
    };

    try {
      return await fetch(proxyUrl, proxyOptions);
    } catch (error) {
      throw new Error(`Proxy request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async makeCORSAnywhereRequest(url: string, options: RequestInit): Promise<Response> {
    // Strategy 2: Use CORS-anywhere service (not recommended for production)
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';
    return fetch(corsProxy + url, options);
  }

  private async makeBrowserExtensionRequest(url: string, options: RequestInit): Promise<Response> {
    // Strategy 3: Use browser extension APIs (if available)
    if ('chrome' in window && (window as any).chrome?.runtime) {
      // Send message to extension
      return new Promise((resolve, reject) => {
        (window as any).chrome.runtime.sendMessage({
          action: 'fetch',
          url,
          options
        }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(new Response(response.body, {
              status: response.status,
              headers: response.headers
            }));
          }
        });
      });
    }
    
    throw new Error('Browser extension not available');
  }

  private async makeElectronRequest(url: string, options: RequestInit): Promise<Response> {
    // Strategy 4: Use Electron main process (if running in Electron)
    if ('electronAPI' in window) {
      const response = await (window as any).electronAPI.fetch(url, options);
      return new Response(response.body, {
        status: response.status,
        headers: response.headers
      });
    }
    
    throw new Error('Electron API not available');
  }

  // Check if a proxy strategy is available
  async isAvailable(): Promise<boolean> {
    switch (this.config.strategy) {
      case 'local-proxy':
        return this.checkLocalProxy();
      case 'cors-anywhere':
        return this.checkCORSAnywhere();
      case 'browser-extension':
        return this.checkBrowserExtension();
      case 'electron':
        return this.checkElectron();
      default:
        return false;
    }
  }

  private async checkLocalProxy(): Promise<boolean> {
    try {
      const proxyUrl = this.config.proxyUrl || 'http://localhost:3001/health';
      const response = await fetch(proxyUrl, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkCORSAnywhere(): Promise<boolean> {
    try {
      const response = await fetch('https://cors-anywhere.herokuapp.com/', { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private checkBrowserExtension(): boolean {
    return 'chrome' in window && !!(window as any).chrome?.runtime;
  }

  private checkElectron(): boolean {
    return 'electronAPI' in window;
  }

  // Get user-friendly error message for CORS issues
  getSetupInstructions(): string {
    switch (this.config.strategy) {
      case 'local-proxy':
        return `
**Local Proxy Setup Required**

To use cloud AI providers, you need to run the DataKit proxy server:

1. In a new terminal, run:
   \`\`\`bash
   npm run proxy-server
   \`\`\`

2. Or start the development server with proxy:
   \`\`\`bash
   npm run dev:with-proxy
   \`\`\`

**Alternative: Use Local Models**
- Switch to "Local Models" in the AI settings
- Download a model to run AI entirely in your browser
- No proxy required, complete privacy!
`;

      case 'browser-extension':
        return `
**Browser Extension Required**

Install the DataKit browser extension to enable cloud AI APIs:

1. Go to Chrome Web Store
2. Search for "DataKit AI Extension"
3. Click "Add to Chrome"
4. Restart DataKit

**Alternative: Use Local Models**
- No extension required for local models
- Complete privacy and offline capability
`;

      case 'electron':
        return `
**Desktop App Recommended**

For the best experience with cloud AI APIs, use the DataKit desktop app:

1. Download DataKit Desktop from our website
2. No CORS limitations
3. Better performance and integration

**Alternative: Use Local Models**
- Works perfectly in web version
- No installation required
`;

      default:
        return `
**CORS Issue Detected**

Cloud AI APIs can't be called directly from the browser due to security restrictions.

**Recommended Solutions:**
1. **Use Local Models** (easiest)
   - Switch to "Local Models" in AI settings
   - Download a model for complete privacy
   
2. **Run DataKit Desktop**
   - No CORS limitations
   - Better performance

3. **Development Mode**
   - Start Chrome with: --disable-web-security --user-data-dir=/tmp/chrome
   - Only for testing, not recommended for regular use
`;
    }
  }
}

// Default proxy handler
export const corsProxy = new CORSProxyHandler({
  strategy: 'local-proxy'
});