const { v4: uuidv4 } = require('uuid');
// Use simple PTY for better responsiveness
const PTYService = require('./simple-pty');
const BufferOptimizer = require('./BufferOptimizer');

class TerminalManager {
  constructor(io, config) {
    this.io = io;
    this.config = config;
    this.sessions = new Map();
    this.socketToSession = new Map();
    this.bufferOptimizer = new BufferOptimizer(config);
    
    // Cleanup inactive sessions periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Every minute
  }
  
  createSession(socket, options = {}) {
    // Check session limit
    if (this.sessions.size >= this.config.performance.maxSessions) {
      throw new Error('Maximum number of terminal sessions reached');
    }
    
    // Check if socket already has a session
    if (this.socketToSession.has(socket.id)) {
      throw new Error('Socket already has an active session');
    }
    
    const sessionId = options.sessionId || uuidv4();
    const sessionConfig = {
      ...this.config,
      terminal: {
        ...this.config.terminal,
        ...options
      }
    };
    
    // Create PTY service
    const ptyService = new PTYService(sessionConfig);
    
    // Create session object
    const session = {
      id: sessionId,
      socket,
      ptyService,
      created: Date.now(),
      lastActivity: Date.now(),
      outputHistory: [], // Store terminal output history
      maxHistorySize: 100000, // Max characters to store (100KB)
      stats: {
        bytesReceived: 0,
        bytesSent: 0,
        packetsAcked: 0
      }
    };
    
    // Setup PTY event handlers
    this.setupPtyHandlers(session);
    
    // Store session
    this.sessions.set(sessionId, session);
    this.socketToSession.set(socket.id, sessionId);
    
    console.log(`Created terminal session: ${sessionId}`);
    return sessionId;
  }
  
  setupPtyHandlers(session) {
    const { ptyService } = session;
    
    // Handle data from PTY
    ptyService.on('data', (packet) => {
      session.lastActivity = Date.now();
      session.stats.bytesSent += packet.data.length;
      
      // Store output in history - ALWAYS, even when detached
      this.addToHistory(session, packet.data);
      
      // Only send to client if socket is connected
      if (session.socket) {
        // Optimize data before sending
        const optimized = this.bufferOptimizer.optimize(packet);
        
        // Send to client with binary frame for better performance
        session.socket.emit('terminal:data', {
          sessionId: session.id,
          data: optimized.data,
          token: optimized.token,
          compressed: optimized.compressed
        });
      }
      // If detached, data is still being captured in history
    });
    
    // Handle PTY exit
    ptyService.on('exit', ({ exitCode, signal }) => {
      if (session.socket) {
        session.socket.emit('terminal:exit', {
          sessionId: session.id,
          exitCode,
          signal
        });
      }
      this.closeSession(session.id);
    });
  }
  
  handleInput(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    session.lastActivity = Date.now();
    session.stats.bytesReceived += data.length;
    session.ptyService.write(data);
  }
  
  handleAck(sessionId, tokens) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    session.lastActivity = Date.now();
    session.stats.packetsAcked += Array.isArray(tokens) ? tokens.length : 1;
    session.ptyService.handleAck(tokens);
  }
  
  resizeSession(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Validate dimensions
    if (cols < 10 || cols > 500 || rows < 5 || rows > 200) {
      throw new Error('Invalid terminal dimensions');
    }
    
    session.lastActivity = Date.now();
    session.ptyService.resize(cols, rows);
  }
  
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    console.log(`Closing terminal session: ${sessionId}`);
    console.log(`Session stats:`, session.stats);
    
    // Cleanup PTY
    session.ptyService.destroy();
    
    // Remove from maps
    this.sessions.delete(sessionId);
    
    // Only delete socket mapping if socket exists (not detached)
    if (session.socket && session.socket.id) {
      this.socketToSession.delete(session.socket.id);
      // Notify client
      session.socket.emit('terminal:closed', { sessionId });
    }
  }
  
  handleDisconnect(socketId) {
    const sessionId = this.socketToSession.get(socketId);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        // Don't close the PTY process, just mark as detached
        console.log(`Socket ${socketId} disconnected from session ${sessionId}, keeping PTY alive`);
        session.socket = null; // Mark as detached
        session.detached = true;
        session.detachedAt = Date.now();
        this.socketToSession.delete(socketId);
        
        // Don't close the session - keep PTY running!
        // this.closeSession(sessionId);
      }
    }
  }
  
  getActiveSessions() {
    const sessions = [];
    for (const [id, session] of this.sessions) {
      sessions.push({
        id,
        created: session.created,
        lastActivity: session.lastActivity,
        detached: session.detached || false,
        detachedAt: session.detachedAt,
        stats: {
          ...session.stats,
          ...session.ptyService.getStats()
        }
      });
    }
    return sessions;
  }
  
  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    return {
      id: session.id,
      created: session.created,
      lastActivity: session.lastActivity,
      uptime: Date.now() - session.created,
      stats: {
        ...session.stats,
        pty: session.ptyService.getStats()
      }
    };
  }
  
  cleanupInactiveSessions() {
    const now = Date.now();
    const inactiveTimeout = 60 * 60 * 1000; // 60 minutes for inactive sessions
    const detachedTimeout = 24 * 60 * 60 * 1000; // 24 hours for detached sessions
    
    for (const [id, session] of this.sessions) {
      // For detached sessions, give them much more time
      if (session.detached && session.detachedAt) {
        if (now - session.detachedAt > detachedTimeout) {
          console.log(`Cleaning up long-detached session: ${id}`);
          this.closeSession(id);
        }
      } 
      // For inactive but connected sessions
      else if (!session.detached && (now - session.lastActivity > inactiveTimeout)) {
        console.log(`Cleaning up inactive session: ${id}`);
        this.closeSession(id);
      }
    }
  }
  
  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }
  
  addToHistory(session, data) {
    // Add data to history
    session.outputHistory.push(data);
    
    // Calculate total size
    let totalSize = session.outputHistory.reduce((sum, chunk) => sum + chunk.length, 0);
    
    // Trim history if it exceeds max size
    while (totalSize > session.maxHistorySize && session.outputHistory.length > 0) {
      const removed = session.outputHistory.shift();
      totalSize -= removed.length;
    }
  }
  
  getSessionHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    return session.outputHistory ? session.outputHistory.join('') : '';
  }
  
  attachToSession(socket, sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Clear detached status
    session.detached = false;
    session.detachedAt = null;
    
    // Update socket reference
    session.socket = socket;
    this.socketToSession.set(socket.id, sessionId);
    
    // Send the entire output history to the reconnecting client
    if (session.outputHistory && session.outputHistory.length > 0) {
      const history = session.outputHistory.join('');
      socket.emit('terminal:history', {
        sessionId: session.id,
        data: history
      });
    }
    
    // Important: Do NOT re-setup PTY handlers as they're already active!
    // Just reconnect the socket to receive future data
    // The PTY is still running and will continue sending data
    
    console.log(`Socket ${socket.id} reattached to running session ${sessionId}`);
  }
  
  destroy() {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close all sessions
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }
    
    // Clear maps
    this.sessions.clear();
    this.socketToSession.clear();
  }
}

module.exports = TerminalManager;