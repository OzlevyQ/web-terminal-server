const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { EventEmitter } = require('events');

/**
 * AutoProxy - Dynamic reverse proxy system for auto-discovered ports
 */
class AutoProxy extends EventEmitter {
  constructor(app, options = {}) {
    super();
    this.app = app || express();
    this.basePort = options.basePort || 5000;
    this.basePath = options.basePath || '/auto';
    this.proxies = new Map(); // port -> proxyInfo
    this.routes = new Map(); // routeName -> port
    this.wsUpgradeHandlers = new Map(); // For WebSocket support
  }

  /**
   * Create a proxy for a discovered port
   */
  createProxy(portInfo) {
    const { port, pid, processName, framework, appType } = portInfo;
    
    // Check if proxy already exists
    if (this.proxies.has(port)) {
      console.log(`Proxy already exists for port ${port}`);
      return this.proxies.get(port);
    }

    // Generate smart route name
    const routeName = this.generateRouteName(processName, port, framework, appType);
    const routePath = `${this.basePath}/${routeName}`;
    
    // Create proxy middleware options
    const proxyOptions = {
      target: `http://localhost:${port}`,
      changeOrigin: true,
      ws: true, // Enable WebSocket support
      logLevel: 'silent',
      
      // Path rewriting - remove the proxy prefix
      pathRewrite: (path) => {
        if (path.startsWith(routePath)) {
          const newPath = path.slice(routePath.length) || '/';
          return newPath;
        }
        return path;
      },
      
      // Dynamic target - in case port changes
      router: () => `http://localhost:${port}`,
      
      // Error handling
      onError: (err, req, res) => {
        console.error(`Proxy error for ${routeName}:`, err.message);
        if (res && !res.headersSent) {
          res.status(502).json({
            error: 'Proxy Error',
            message: `Failed to proxy request to port ${port}`,
            details: err.message
          });
        }
      },
      
      // Proxy response handler
      onProxyRes: (proxyRes, req, res) => {
        // Add custom headers
        proxyRes.headers['X-Proxied-By'] = 'web-terminal-server';
        proxyRes.headers['X-Original-Port'] = port.toString();
      },
      
      // Handle WebSocket upgrade
      onProxyReqWs: (proxyReq, req, socket, options, head) => {
        // Add WebSocket headers if needed
        proxyReq.setHeader('X-Forwarded-For', req.connection.remoteAddress);
      }
    };
    
    // Special handling for different frameworks
    if (framework === 'vite' || framework === 'webpack') {
      // Vite/Webpack HMR needs special handling
      proxyOptions.pathRewrite = (path) => {
        // Keep HMR paths intact
        if (path.includes('/@vite') || path.includes('/__vite') || 
            path.includes('/sockjs-node') || path.includes('/__webpack')) {
          return path;
        }
        if (path.startsWith(routePath)) {
          return path.slice(routePath.length) || '/';
        }
        return path;
      };
    }
    
    if (framework === 'nextjs') {
      // Next.js specific handling
      proxyOptions.pathRewrite = (path) => {
        // Keep Next.js specific paths
        if (path.includes('/_next') || path.includes('/__nextjs')) {
          return path;
        }
        if (path.startsWith(routePath)) {
          return path.slice(routePath.length) || '/';
        }
        return path;
      };
    }
    
    // Create the proxy middleware
    const proxyMiddleware = createProxyMiddleware(proxyOptions);
    
    // Mount the proxy to Express
    this.app.use(routePath, proxyMiddleware);
    
    // Store proxy info
    const proxyInfo = {
      port,
      pid,
      processName,
      framework,
      appType,
      routeName,
      routePath,
      baseUrl: `http://localhost:${this.basePort}${routePath}`,
      targetUrl: `http://localhost:${port}`,
      middleware: proxyMiddleware,
      created: new Date(),
      requests: 0,
      lastAccess: null
    };
    
    this.proxies.set(port, proxyInfo);
    this.routes.set(routeName, port);
    
    console.log(`✅ Proxy created: ${proxyInfo.baseUrl} → ${proxyInfo.targetUrl}`);
    this.emit('proxy:created', proxyInfo);
    
    return proxyInfo;
  }

  /**
   * Generate intelligent route name
   */
  generateRouteName(processName, port, framework, appType) {
    // Clean process name
    let baseName = processName.toLowerCase()
      .replace(/\.exe$/, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Use framework name if available
    if (framework && framework !== 'unknown') {
      baseName = framework;
    } else if (appType && appType !== 'unknown') {
      baseName = appType;
    }
    
    // Common name mappings
    const nameMap = {
      'node': 'app',
      'python': 'api',
      'java': 'service',
      'ruby': 'web',
      'php': 'site',
      'dotnet': 'app',
      'chrome': 'browser',
      'code': 'vscode'
    };
    
    if (nameMap[baseName]) {
      baseName = nameMap[baseName];
    }
    
    // Add port for uniqueness
    return `${baseName}-${port}`;
  }

  /**
   * Update proxy when port info changes
   */
  updateProxy(port, newInfo) {
    const existing = this.proxies.get(port);
    if (!existing) {
      return this.createProxy(newInfo);
    }
    
    // Update info
    Object.assign(existing, {
      pid: newInfo.pid,
      processName: newInfo.processName,
      framework: newInfo.framework,
      appType: newInfo.appType,
      lastUpdate: new Date()
    });
    
    this.emit('proxy:updated', existing);
    return existing;
  }

  /**
   * Remove proxy when port closes
   */
  removeProxy(port) {
    const proxyInfo = this.proxies.get(port);
    if (!proxyInfo) {
      return false;
    }
    
    // Remove route from Express
    // Note: Express doesn't have built-in route removal, 
    // so we'll mark it as inactive
    proxyInfo.active = false;
    proxyInfo.closedAt = new Date();
    
    // Remove from maps
    this.routes.delete(proxyInfo.routeName);
    this.proxies.delete(port);
    
    console.log(`❌ Proxy removed: ${proxyInfo.routeName} (port ${port})`);
    this.emit('proxy:removed', proxyInfo);
    
    return true;
  }

  /**
   * Get all active proxies
   */
  getProxies() {
    return Array.from(this.proxies.values());
  }

  /**
   * Get proxy by port
   */
  getProxyByPort(port) {
    return this.proxies.get(port);
  }

  /**
   * Get proxy by route name
   */
  getProxyByRoute(routeName) {
    const port = this.routes.get(routeName);
    return port ? this.proxies.get(port) : null;
  }

  /**
   * Check if port has proxy
   */
  hasProxy(port) {
    return this.proxies.has(port);
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    const proxies = this.getProxies();
    const byFramework = {};
    const byAppType = {};
    
    proxies.forEach(p => {
      byFramework[p.framework] = (byFramework[p.framework] || 0) + 1;
      byAppType[p.appType] = (byAppType[p.appType] || 0) + 1;
    });
    
    return {
      totalProxies: proxies.length,
      byFramework,
      byAppType,
      proxies: proxies.map(p => ({
        port: p.port,
        routeName: p.routeName,
        processName: p.processName,
        framework: p.framework,
        baseUrl: p.baseUrl,
        created: p.created,
        requests: p.requests
      }))
    };
  }

  /**
   * Handle WebSocket upgrade for all proxies
   */
  handleUpgrade(server) {
    server.on('upgrade', (request, socket, head) => {
      // Find matching proxy
      const pathname = request.url;
      
      for (const [port, proxyInfo] of this.proxies) {
        if (pathname.startsWith(proxyInfo.routePath)) {
          // Use the proxy middleware to handle WebSocket
          proxyInfo.middleware.upgrade(request, socket, head);
          return;
        }
      }
      
      // No matching proxy found
      socket.destroy();
    });
  }

  /**
   * Create manual proxy (user-specified)
   */
  createManualProxy(routeName, port, options = {}) {
    // Check if route already exists
    if (this.routes.has(routeName)) {
      throw new Error(`Route ${routeName} already exists`);
    }
    
    const proxyInfo = {
      port,
      pid: 0,
      processName: options.processName || 'manual',
      framework: options.framework || 'unknown',
      appType: options.appType || 'unknown'
    };
    
    // Override route name generation
    const originalGenerate = this.generateRouteName;
    this.generateRouteName = () => routeName;
    
    const result = this.createProxy(proxyInfo);
    
    // Restore original function
    this.generateRouteName = originalGenerate;
    
    return result;
  }

  /**
   * Middleware to track proxy requests
   */
  trackRequests() {
    return (req, res, next) => {
      const path = req.path;
      
      // Find matching proxy
      for (const [port, proxyInfo] of this.proxies) {
        if (path.startsWith(proxyInfo.routePath)) {
          proxyInfo.requests++;
          proxyInfo.lastAccess = new Date();
          break;
        }
      }
      
      next();
    };
  }
}

module.exports = AutoProxy;