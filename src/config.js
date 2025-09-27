const securityConfig = require('./security-config');

module.exports = {
  server: {
    port: process.env.TERMINAL_PORT || 5000,
    cors: {
      origin: true, // Allow all origins for ngrok support
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-forwarded-proto', 'x-forwarded-for']
    }
  },
  
  terminal: {
    shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
    shellArgs: process.platform === 'win32' ? [] : ['-l'],
    cols: 80,
    rows: 24,
    cwd: securityConfig.getStartingDirectory(),
    env: process.env,
    security: securityConfig.getCurrentConfig()
  },
  
  performance: {
    maxBufferSize: 50 * 1024 * 1024, // 50MB max buffer
    chunkSize: 32 * 1024, // 32KB optimal chunk size
    queueThreshold: 10 * 1024 * 1024, // 10MB queue threshold
    ackTimeout: 5000, // 5 seconds ACK timeout
    compressionThreshold: 1024, // Compress if > 1KB
    maxSessions: 10 // Max concurrent terminal sessions
  },
  
  socket: {
    transports: ['websocket'],
    perMessageDeflate: {
      threshold: 1024
    },
    pingTimeout: 60000,
    pingInterval: 25000
  }
};