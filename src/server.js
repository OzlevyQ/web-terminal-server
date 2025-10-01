const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs').promises;
const config = require('./config');
const TerminalManager = require('./TerminalManager');

// Import orchestrator components
const PortMonitor = require('./orchestrator/PortMonitor');
const ProcessTracker = require('./orchestrator/ProcessTracker');

const app = express();
const httpServer = createServer(app);

// Trust proxy headers (important for ngrok)
app.set('trust proxy', true);

// Middleware
app.use(cors(config.server.cors));
app.use(compression());
app.use(express.json());



// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
if (!require('fs').existsSync(dataDir)) {
  require('fs').mkdirSync(dataDir, { recursive: true });
}

// Database file for persistent sessions
const SESSIONS_DB = path.join(__dirname, '..', 'data', 'sessions.json');

// Load saved sessions on startup
async function loadSessions() {
  try {
    const data = await fs.readFile(SESSIONS_DB, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Save sessions to file
async function saveSessions(sessions) {
  try {
    await fs.writeFile(SESSIONS_DB, JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error('Error saving sessions:', error);
  }
}

// In-memory session store (backed by file)
let persistentSessions = {};
loadSessions().then(sessions => {
  persistentSessions = sessions;
  console.log(`Loaded ${Object.keys(sessions).length} saved sessions`);
});

// Configuration endpoint for dynamic base URL
app.get('/api/config', (req, res) => {
  // Check if request came through HTTPS proxy (like ngrok)
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  
  // Build the base URL with correct protocol
  const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;
  
  res.json({
    baseUrl,
    socketUrl: baseUrl,
    apiUrl: baseUrl,
    wsProtocol: protocol === 'https' ? 'wss' : 'ws'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    sessions: terminalManager.getActiveSessions(),
    savedSessions: Object.keys(persistentSessions).length,
    uptime: process.uptime()
  });
});

// Get session by shareable ID
app.get('/api/session/:shareId', (req, res) => {
  const { shareId } = req.params;
  const session = persistentSessions[shareId];
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Get dynamic host from request headers
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  
  res.json({
    shareId,
    name: session.name,
    created: session.created,
    lastAccess: session.lastAccess,
    isActive: terminalManager.hasSession(session.sessionId),
    url: `${baseUrl}/terminal/${shareId}`
  });
});

// Get all saved sessions
app.get('/api/sessions', (req, res) => {
  const sessions = Object.entries(persistentSessions).map(([shareId, session]) => ({
    shareId,
    sessionId: session.sessionId, // Include sessionId for proper matching
    name: session.name,
    created: session.created,
    lastAccess: session.lastAccess,
    isActive: terminalManager.hasSession(session.sessionId)
  }));
  
  res.json(sessions);
});

// Delete saved session
app.delete('/api/session/:shareId', async (req, res) => {
  const { shareId } = req.params;
  
  if (persistentSessions[shareId]) {
    // Close active session if exists
    const session = persistentSessions[shareId];
    if (terminalManager.hasSession(session.sessionId)) {
      terminalManager.closeSession(session.sessionId);
    }
    
    delete persistentSessions[shareId];
    await saveSessions(persistentSessions);
    
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Serve terminal with specific ID
app.get('/terminal/:shareId', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'shared.html'));
});

// Serve monitor interface
app.get('/monitor', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'monitor.html'));
});

// Serve ports dashboard
app.get('/ports', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'ports.html'));
});

// Static files for non-proxy paths
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve main terminal interface ONLY for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 handler for /auto/* paths that don't have a proxy
app.use('/auto/*', (req, res) => {
  // Use proxyInstance which is defined early
  const proxies = proxyInstance ? proxyInstance.getProxies() : [];
  
  res.status(404).json({
    error: 'Proxy route not found',
    path: req.path,
    message: 'No proxy configured for this path. Available proxies:',
    proxies: proxies.map(p => ({
      name: p.routeName,
      url: p.baseUrl
    }))
  });
});



// Initialize Orchestrator components
const portMonitor = new PortMonitor({ scanInterval: 3000 }); // Scan every 3 seconds
const processTracker = new ProcessTracker();

// Start port monitoring - no proxy, just discovery
portMonitor.on('port:discovered', async (portInfo) => {
  console.log(`🔍 New port discovered: ${portInfo.port} (${portInfo.processName})`);

  // Skip the server's own port and nginx
  if (portInfo.port === PORT || portInfo.port === 5000) {
    console.log(`⏭️  Skipping port ${portInfo.port} (system port)`);
    return;
  }

  // Get detailed process info
  const processInfo = await processTracker.getProcessInfo(portInfo.pid);
  if (processInfo) {
    portInfo.framework = processInfo.framework;
    portInfo.appType = processInfo.appType;
    portInfo.cwd = processInfo.cwd;
  }

  // Direct URL only
  const directUrl = `http://localhost:${portInfo.port}`;

  console.log(`✅ Port ${portInfo.port}: ${directUrl}`);

  // Emit to all connected clients
  io.emit('port:discovered', {
    ...portInfo,
    directUrl
  });
});

portMonitor.on('port:closed', async (portInfo) => {
  console.log(`🔒 Port closed: ${portInfo.port}`);
  io.emit('port:closed', { port: portInfo.port });
});

// Start monitoring after server starts
setTimeout(() => {
  portMonitor.startMonitoring();
  console.log('🚀 Port monitoring started');
}, 1000);

// Orchestrator API endpoints

// Get all discovered ports
app.get('/api/ports', (req, res) => {
  const ports = portMonitor.getKnownPorts();

  // Add both proxy and direct URLs
  const result = ports.map(port => {
    return {
      ...port,
      hasProxy: true,
      proxyUrl: `http://localhost:${PORT}/proxy/${port.port}/`,
      directUrl: `http://localhost:${port.port}`,
      routeName: `port-${port.port}`
    };
  });
  
  res.json({
    success: true,
    ports: result,
    stats: portMonitor.getStats()
  });
});

// Get process information
app.get('/api/process/:pid', async (req, res) => {
  try {
    const pid = parseInt(req.params.pid);
    const info = await processTracker.getProcessInfo(pid);
    
    if (!info) {
      return res.status(404).json({
        success: false,
        error: 'Process not found'
      });
    }
    
    res.json({
      success: true,
      process: info
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get proxy information
app.get('/api/proxies', (req, res) => {
  // With DockerPortRouter, proxies are dynamic via ?port= parameter
  // Return empty list for backward compatibility
  res.json({
    success: true,
    total: 0,
    proxies: [],
    message: 'Using dynamic port routing via ?port= parameter'
  });
});

// Create manual proxy
app.post('/api/proxy/create', (req, res) => {
  try {
    const { port, routeName, processName, framework } = req.body;
    
    if (!port) {
      return res.status(400).json({
        success: false,
        error: 'Port is required'
      });
    }
    
    const proxy = routeName 
      ? autoProxy.createManualProxy(routeName, port, { processName, framework })
      : autoProxy.createProxy({ port, processName, framework });
    
    res.json({
      success: true,
      proxy: {
        port: proxy.port,
        routeName: proxy.routeName,
        baseUrl: proxy.baseUrl,
        targetUrl: proxy.targetUrl
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Remove proxy
app.delete('/api/proxy/:port', (req, res) => {
  try {
    const port = parseInt(req.params.port);
    const removed = autoProxy.removeProxy(port);
    
    res.json({
      success: removed,
      message: removed ? 'Proxy removed' : 'Proxy not found'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Toggle port monitoring
app.post('/api/monitor/:action', (req, res) => {
  const action = req.params.action;
  
  if (action === 'start') {
    portMonitor.startMonitoring();
    res.json({ success: true, message: 'Monitoring started' });
  } else if (action === 'stop') {
    portMonitor.stopMonitoring();
    res.json({ success: true, message: 'Monitoring stopped' });
  } else {
    res.status(400).json({ success: false, error: 'Invalid action' });
  }
});

// Initialize Socket.io with optimizations
const io = new Server(httpServer, {
  cors: {
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: config.socket.transports,
  perMessageDeflate: config.socket.perMessageDeflate,
  pingTimeout: config.socket.pingTimeout,
  pingInterval: config.socket.pingInterval,
  maxHttpBufferSize: config.performance.maxBufferSize,
  allowEIO3: true // Support older clients
});

// Initialize Terminal Manager
const terminalManager = new TerminalManager(io, config);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  // Create new terminal session - ALWAYS with sharing support for persistence
  socket.on('terminal:create', async (options = {}) => {
    try {
      const sessionId = terminalManager.createSession(socket, options);
      
      // ALWAYS generate shareable ID for persistence
      const shareId = options.shareId || generateShareId();
      persistentSessions[shareId] = {
        sessionId,
        shareId,
        name: options.name || `Terminal ${Object.keys(persistentSessions).length + 1}`,
        created: Date.now(),
        lastAccess: Date.now(),
        owner: options.owner || 'anonymous',
        persistent: true, // Mark as persistent
        history: '' // Initialize empty history
      };
      await saveSessions(persistentSessions);
      
      // Get dynamic URL from socket handshake headers
      const protocol = socket.handshake.headers['x-forwarded-proto'] || 'http';
      const host = socket.handshake.headers.host || 'localhost:5000';
      const baseUrl = `${protocol}://${host}`;
      
      socket.emit('terminal:created', { 
        sessionId, 
        shareId,
        url: `${baseUrl}/terminal/${shareId}`,
        persistent: true
      });
    } catch (error) {
      socket.emit('terminal:error', { 
        message: error.message,
        code: 'CREATE_FAILED'
      });
    }
  });
  
  // Connect to existing session by share ID
  socket.on('terminal:connect', async (data) => {
    const { shareId } = data;
    const savedSession = persistentSessions[shareId];
    
    if (!savedSession) {
      socket.emit('terminal:error', {
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
      return;
    }
    
    // Update last access
    savedSession.lastAccess = Date.now();
    await saveSessions(persistentSessions);
    
    // Check if session is active
    if (terminalManager.hasSession(savedSession.sessionId)) {
      // Attach to existing session
      terminalManager.attachToSession(socket, savedSession.sessionId);
      // Get dynamic URL from socket handshake headers
      const protocol = socket.handshake.headers['x-forwarded-proto'] || 'http';
      const host = socket.handshake.headers.host || 'localhost:5000';
      const baseUrl = `${protocol}://${host}`;
      
      socket.emit('terminal:connected', {
        sessionId: savedSession.sessionId,
        shareId,
        name: savedSession.name,
        url: `${baseUrl}/terminal/${shareId}`
      });
    } else {
      // Recreate session with same ID
      try {
        const sessionId = terminalManager.createSession(socket, {
          sessionId: savedSession.sessionId,
          name: savedSession.name
        });
        
        // Restore saved history if available
        if (savedSession.history) {
          socket.emit('terminal:history', {
            sessionId,
            data: savedSession.history
          });
        }
        
        // Get dynamic URL from socket handshake headers
        const protocol = socket.handshake.headers['x-forwarded-proto'] || 'http';
        const host = socket.handshake.headers.host || 'localhost:5000';
        const baseUrl = `${protocol}://${host}`;
        
        socket.emit('terminal:connected', {
          sessionId,
          shareId,
          name: savedSession.name,
          url: `${baseUrl}/terminal/${shareId}`,
          recreated: true
        });
      } catch (error) {
        socket.emit('terminal:error', {
          message: 'Failed to recreate session',
          code: 'RECREATE_FAILED'
        });
      }
    }
  });
  
  // Handle terminal input
  socket.on('terminal:input', ({ sessionId, data }) => {
    try {
      // Security check for blocked commands (optional)
      const securityConfig = require('./security-config');
      if (!securityConfig.isCommandAllowed(data)) {
        socket.emit('terminal:error', { 
          message: 'Command not allowed by security policy',
          code: 'COMMAND_BLOCKED'
        });
        return;
      }
      
      terminalManager.handleInput(sessionId, data);
    } catch (error) {
      socket.emit('terminal:error', { 
        message: error.message,
        code: 'INPUT_FAILED'
      });
    }
  });
  
  // Handle terminal resize
  socket.on('terminal:resize', ({ sessionId, cols, rows }) => {
    try {
      terminalManager.resizeSession(sessionId, cols, rows);
    } catch (error) {
      socket.emit('terminal:error', { 
        message: error.message,
        code: 'RESIZE_FAILED'
      });
    }
  });
  
  // Handle ACK for flow control
  socket.on('terminal:ack', ({ sessionId, tokens }) => {
    try {
      terminalManager.handleAck(sessionId, tokens);
    } catch (error) {
      console.error('ACK error:', error);
    }
  });
  
  // Close terminal session
  socket.on('terminal:close', ({ sessionId }) => {
    try {
      terminalManager.closeSession(sessionId);
    } catch (error) {
      console.error('Close error:', error);
    }
  });
  

  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    terminalManager.handleDisconnect(socket.id);
  });
});

// Helper function to generate share ID
function generateShareId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Periodically save terminal history to persistent storage
setInterval(async () => {
  for (const [shareId, sessionData] of Object.entries(persistentSessions)) {
    if (terminalManager.hasSession(sessionData.sessionId)) {
      const history = terminalManager.getSessionHistory(sessionData.sessionId);
      if (history) {
        persistentSessions[shareId].history = history;
        persistentSessions[shareId].lastAccess = Date.now();
      }
    }
  }
  await saveSessions(persistentSessions);
}, 10000); // Save every 10 seconds

// Start server with Caddy or fallback to direct
const PORT = 5000; // Direct access on port 5000
const HOST = '0.0.0.0'; // Listen on all interfaces

// Setup proxy BEFORE static files
(async () => {
  // DISABLE CADDY - USE NODE.JS PROXY ONLY
  const caddyStarted = false;
  
  if (caddyStarted) {
    useCaddy = true;
    console.log('✅ Using Caddy for proxying');
    
    // Terminal server runs on next port when using Caddy
    const TERMINAL_PORT = PORT + 1;
    httpServer.listen(TERMINAL_PORT, HOST, () => {
      console.log(`🚀 Terminal server (backend) on port ${TERMINAL_PORT}`);
      console.log(`🌐 Caddy proxy server on port ${PORT}`);
    });
  } else {
    useCaddy = false;

    // Run server directly
    httpServer.listen(PORT, HOST, async () => {
  const securityConfig = require('./security-config');
  const secConfig = securityConfig.getCurrentConfig();

  console.log(`🚀 Terminal server on ${HOST}:${PORT}`);
  console.log(`📁 Starting directory: ${config.terminal.cwd}`);
  console.log(`🔒 Security level: ${secConfig.level.toUpperCase()}`);
  console.log(`📊 Max buffer size: ${config.performance.maxBufferSize / 1024 / 1024}MB`);
  console.log(`📦 Chunk size: ${config.performance.chunkSize / 1024}KB`);
  console.log(``);
  console.log(`🌐 Access:`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   Ports:     http://localhost:${PORT}/ports`);
  console.log(``);

  if (secConfig.level === 'full') {
    console.log(`⚠️  FULL SYSTEM ACCESS ENABLED - cd / should work`);
  } else {
    console.log(`🛡️  Security restrictions active - limited access`);
  }
    });
  }
})();