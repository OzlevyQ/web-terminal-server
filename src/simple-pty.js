const os = require('os');
const pty = require('node-pty');
const { EventEmitter } = require('events');

class SimplePTYService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.ptyProcess = null;
    this.startPtyProcess();
  }
  
  startPtyProcess() {
    const shell = this.config.terminal.shell;
    const args = this.config.terminal.shellArgs || [];
    
    // Set starting directory based on platform
    const startingDir = this.config.terminal.cwd || 
                       (process.platform === 'win32' ? 'C:\\' : '/');
    
    this.ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: this.config.terminal.cols || 80,
      rows: this.config.terminal.rows || 24,
      cwd: startingDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        // Allow full system access
        PATH: process.env.PATH
      }
    });

    // Store PID for port monitoring
    this.pid = this.ptyProcess.pid;

    // Simply forward data without any buffering
    this.ptyProcess.onData((data) => {
      this.emit('data', { 
        data: data,
        token: Date.now() // Simple token
      });
    });
    
    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', { exitCode, signal });
      this.cleanup();
    });
  }
  
  write(data) {
    if (this.ptyProcess) {
      this.ptyProcess.write(data);
    }
  }
  
  resize(cols, rows) {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows);
    }
  }
  
  // Simple ACK - just ignore it
  handleAck(tokens) {
    // Do nothing - we don't need flow control for simple terminals
  }
  
  getStats() {
    return {
      isPaused: false,
      bufferSize: 0,
      queueLength: 0
    };
  }
  
  cleanup() {
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch (e) {
        // Already killed
      }
      this.ptyProcess = null;
    }
    this.removeAllListeners();
  }
  
  destroy() {
    this.cleanup();
  }
}

module.exports = SimplePTYService;