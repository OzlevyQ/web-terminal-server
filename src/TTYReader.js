const fs = require('fs');
const { EventEmitter } = require('events');
const { execSync } = require('child_process');

class TTYReader extends EventEmitter {
  constructor() {
    super();
    this.activeStreams = new Map();
  }

  /**
   * List all active TTY sessions on the system
   */
  listActiveTTYs() {
    try {
      // Get list of TTYs with user information
      const whoOutput = execSync('who', { encoding: 'utf8' });
      const ttys = [];
      
      whoOutput.split('\n').filter(Boolean).forEach(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const user = parts[0];
          const tty = parts[1];
          
          // Get more info about the TTY
          let devicePath = '';
          if (tty === 'console') {
            devicePath = '/dev/console';
          } else if (tty.startsWith('ttys')) {
            devicePath = `/dev/${tty}`;
          }
          
          if (devicePath) {
            // Check if we can access this TTY
            let accessible = false;
            let processInfo = '';
            
            try {
              // Check file permissions
              fs.accessSync(devicePath, fs.constants.R_OK);
              accessible = true;
              
              // Try to get process info
              const psOutput = execSync(`ps -t ${tty} -o pid,command | tail -n +2 | head -1`, { encoding: 'utf8' });
              if (psOutput) {
                processInfo = psOutput.trim();
              }
            } catch (e) {
              // Can't access or get process info
            }
            
            ttys.push({
              user,
              tty,
              device: devicePath,
              accessible,
              process: processInfo,
              timestamp: parts.slice(2).join(' ')
            });
          }
        }
      });
      
      // Also check for any TTYs we own
      const myUser = execSync('whoami', { encoding: 'utf8' }).trim();
      const ttyDevices = fs.readdirSync('/dev').filter(d => d.startsWith('ttys'));
      
      ttyDevices.forEach(tty => {
        const devicePath = `/dev/${tty}`;
        try {
          const stat = fs.statSync(devicePath);
          const uid = stat.uid;
          
          // Check if we own this TTY
          if (process.getuid() === uid) {
            // Check if not already in list
            if (!ttys.find(t => t.device === devicePath)) {
              let processInfo = '';
              try {
                const psOutput = execSync(`ps -t ${tty} -o pid,command | tail -n +2 | head -1`, { encoding: 'utf8' });
                if (psOutput) {
                  processInfo = psOutput.trim();
                }
              } catch (e) {}
              
              ttys.push({
                user: myUser,
                tty,
                device: devicePath,
                accessible: true,
                process: processInfo,
                timestamp: 'inactive'
              });
            }
          }
        } catch (e) {
          // Can't stat device
        }
      });
      
      return ttys;
    } catch (error) {
      console.error('Error listing TTYs:', error);
      return [];
    }
  }

  /**
   * Attach to a TTY in read-only mode
   */
  attachToTTY(ttyDevice, sessionId) {
    if (this.activeStreams.has(sessionId)) {
      throw new Error('Session already has an active TTY stream');
    }

    try {
      // Check if we can read the TTY
      fs.accessSync(ttyDevice, fs.constants.R_OK);
      
      // Open the TTY for reading
      const fd = fs.openSync(ttyDevice, 'r');
      const stream = fs.createReadStream(null, { 
        fd,
        encoding: 'utf8',
        highWaterMark: 64 * 1024 // 64KB chunks
      });
      
      this.activeStreams.set(sessionId, { stream, fd, device: ttyDevice });
      
      // Handle data from TTY
      stream.on('data', (data) => {
        this.emit('data', sessionId, data);
      });
      
      stream.on('error', (error) => {
        console.error(`TTY stream error for ${ttyDevice}:`, error);
        this.emit('error', sessionId, error);
        this.detachFromTTY(sessionId);
      });
      
      stream.on('close', () => {
        this.emit('close', sessionId);
        this.detachFromTTY(sessionId);
      });
      
      return true;
    } catch (error) {
      throw new Error(`Cannot attach to TTY ${ttyDevice}: ${error.message}`);
    }
  }

  /**
   * Mirror TTY using script command (more reliable for active sessions)
   */
  mirrorTTY(ttyDevice, sessionId) {
    if (this.activeStreams.has(sessionId)) {
      throw new Error('Session already has an active TTY stream');
    }

    try {
      const { spawn } = require('child_process');
      
      // Use script command to mirror the TTY
      // This is more reliable for capturing active terminal output
      const scriptProcess = spawn('script', [
        '-q',  // Quiet mode
        '-f',  // Flush output after each write
        `/dev/null`,  // Don't save to file
        '-c', `cat ${ttyDevice}`  // Command to run
      ]);
      
      this.activeStreams.set(sessionId, { 
        process: scriptProcess,
        device: ttyDevice,
        type: 'mirror'
      });
      
      scriptProcess.stdout.on('data', (data) => {
        this.emit('data', sessionId, data.toString());
      });
      
      scriptProcess.stderr.on('data', (data) => {
        console.error(`Script error for ${ttyDevice}:`, data.toString());
      });
      
      scriptProcess.on('error', (error) => {
        console.error(`Script process error for ${ttyDevice}:`, error);
        this.emit('error', sessionId, error);
        this.detachFromTTY(sessionId);
      });
      
      scriptProcess.on('close', (code) => {
        this.emit('close', sessionId, code);
        this.detachFromTTY(sessionId);
      });
      
      return true;
    } catch (error) {
      throw new Error(`Cannot mirror TTY ${ttyDevice}: ${error.message}`);
    }
  }

  /**
   * Detach from a TTY
   */
  detachFromTTY(sessionId) {
    const streamInfo = this.activeStreams.get(sessionId);
    if (!streamInfo) {
      return false;
    }

    try {
      if (streamInfo.type === 'mirror' && streamInfo.process) {
        // Kill the script process
        streamInfo.process.kill('SIGTERM');
      } else if (streamInfo.stream) {
        // Close the read stream
        streamInfo.stream.destroy();
      }
      
      if (streamInfo.fd !== undefined) {
        fs.closeSync(streamInfo.fd);
      }
    } catch (error) {
      console.error('Error closing TTY stream:', error);
    }

    this.activeStreams.delete(sessionId);
    return true;
  }

  /**
   * Clean up all active streams
   */
  cleanup() {
    for (const sessionId of this.activeStreams.keys()) {
      this.detachFromTTY(sessionId);
    }
  }
}

module.exports = TTYReader;