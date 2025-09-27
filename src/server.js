const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs').promises;
const config = require('./config');
const TerminalManager = require('./TerminalManager');
const TTYReader = require('./TTYReader');
const TmuxManager = require('./TmuxManager');

const app = express();
const httpServer = createServer(app);

// Trust proxy headers (important for ngrok)
app.set('trust proxy', true);

// Middleware
app.use(cors(config.server.cors));
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

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

// Serve main terminal interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Serve monitor interface
app.get('/monitor', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'monitor.html'));
});

// TTY and Tmux API endpoints
const ttyReader = new TTYReader();
const tmuxManager = new TmuxManager();

// List available TTYs on the system
app.get('/api/system/ttys', (req, res) => {
  try {
    const ttys = ttyReader.listActiveTTYs();
    res.json({
      success: true,
      ttys,
      currentUser: process.env.USER || process.env.USERNAME
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List tmux sessions
app.get('/api/tmux/sessions', (req, res) => {
  try {
    const available = tmuxManager.isTmuxAvailable();
    const sessions = available ? tmuxManager.listSessions() : [];
    res.json({
      success: true,
      tmuxAvailable: available,
      sessions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create tmux session
app.post('/api/tmux/create', (req, res) => {
  try {
    const { name, detached = true } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Session name is required'
      });
    }
    
    const sessionName = tmuxManager.createSession(name, { detached });
    res.json({
      success: true,
      sessionName
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
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
  
  // Handle TTY attachment
  socket.on('tty:attach', ({ device, mode = 'readonly' }) => {
    try {
      const sessionId = `tty-${Date.now()}`;
      
      if (mode === 'mirror') {
        ttyReader.mirrorTTY(device, sessionId);
      } else {
        ttyReader.attachToTTY(device, sessionId);
      }
      
      // Listen for TTY data
      ttyReader.on('data', (sid, data) => {
        if (sid === sessionId) {
          socket.emit('tty:data', { sessionId, data });
        }
      });
      
      ttyReader.on('error', (sid, error) => {
        if (sid === sessionId) {
          socket.emit('tty:error', { sessionId, error: error.message });
        }
      });
      
      ttyReader.on('close', (sid) => {
        if (sid === sessionId) {
          socket.emit('tty:closed', { sessionId });
        }
      });
      
      socket.emit('tty:attached', { sessionId, device, mode });
    } catch (error) {
      socket.emit('tty:error', { error: error.message });
    }
  });
  
  // Handle TTY detachment
  socket.on('tty:detach', ({ sessionId }) => {
    try {
      ttyReader.detachFromTTY(sessionId);
      socket.emit('tty:detached', { sessionId });
    } catch (error) {
      socket.emit('tty:error', { sessionId, error: error.message });
    }
  });
  
  // Handle tmux attachment
  socket.on('tmux:attach', ({ sessionName, mode = 'shared' }) => {
    try {
      const result = tmuxManager.attachToSession(sessionName, mode);
      const sessionId = `tmux-${sessionName}-${Date.now()}`;
      
      // Set up monitoring
      const monitor = tmuxManager.monitorSession(sessionName, (error, data) => {
        if (error) {
          socket.emit('tmux:error', { sessionId, error: error.message });
        } else {
          socket.emit('tmux:data', { sessionId, data });
        }
      });
      
      // Store monitor for cleanup
      socket.tmuxMonitor = monitor;
      
      socket.emit('tmux:attached', { sessionId, sessionName, mode });
    } catch (error) {
      socket.emit('tmux:error', { error: error.message });
    }
  });
  
  // Handle tmux command sending
  socket.on('tmux:send', ({ sessionName, command }) => {
    try {
      tmuxManager.sendToSession(sessionName, command);
      socket.emit('tmux:sent', { sessionName });
    } catch (error) {
      socket.emit('tmux:error', { sessionName, error: error.message });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    terminalManager.handleDisconnect(socket.id);
    
    // Clean up tmux monitor if exists
    if (socket.tmuxMonitor) {
      socket.tmuxMonitor.stop();
    }
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

// Start server - listen on all interfaces for ngrok
const PORT = config.server.port;
const HOST = '0.0.0.0'; // Listen on all interfaces
httpServer.listen(PORT, HOST, () => {
  const securityConfig = require('./security-config');
  const secConfig = securityConfig.getCurrentConfig();
  
  console.log(`🚀 Terminal server running on ${HOST}:${PORT}`);
  console.log(`📁 Starting directory: ${config.terminal.cwd}`);
  console.log(`🔒 Security level: ${secConfig.level.toUpperCase()}`);
  console.log(`📊 Max buffer size: ${config.performance.maxBufferSize / 1024 / 1024}MB`);
  console.log(`📦 Chunk size: ${config.performance.chunkSize / 1024}KB`);
  console.log(`🔗 Share URLs: http://localhost:${PORT}/terminal/[shareId]`);
  console.log(`🌐 For ngrok: ngrok http ${PORT}`);
  
  if (secConfig.level === 'full') {
    console.log(`⚠️  FULL SYSTEM ACCESS ENABLED - cd / should work`);
  } else {
    console.log(`🛡️  Security restrictions active - limited access`);
  }
});