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
      
      const ttyName = ttyDevice.split('/').pop();
      let initialContent = '';
      
      // Try to get Terminal app content using AppleScript (macOS)
      try {
        const script = `
          tell application "Terminal"
            set allWindows to every window
            repeat with win in allWindows
              set allTabs to every tab of win
              repeat with t in allTabs
                if tty of t contains "${ttyName}" then
                  return contents of t
                end if
              end repeat
            end repeat
            return ""
          end tell
        `;
        
        const terminalContent = execSync(`osascript -e '${script.replace(/\n/g, ' ')}'`, { 
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        if (terminalContent && terminalContent.trim()) {
          initialContent = terminalContent;
          console.log(`Got Terminal content for ${ttyName}: ${initialContent.length} bytes`);
        }
      } catch (e) {
        console.log('Could not get Terminal app content:', e.message);
      }
      
      // Send initial content if we got any
      if (initialContent) {
        this.emit('data', sessionId, initialContent);
        this.emit('data', sessionId, '\r\n\r\n=== Live TTY Stream ===\r\n');
      } else {
        this.emit('data', sessionId, `[Connected to ${ttyDevice}]\r\n[Waiting for new output...]\r\n\r\n`);
      }
      
      // For macOS, use tail -f to follow the TTY
      const { spawn } = require('child_process');
      
      // Use tail -f to follow new content
      const tailProcess = spawn('tail', ['-f', ttyDevice], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      this.activeStreams.set(sessionId, { 
        process: tailProcess,
        device: ttyDevice,
        type: 'tail'
      });
      
      // Handle data from TTY
      tailProcess.stdout.on('data', (data) => {
        this.emit('data', sessionId, data.toString());
      });
      
      tailProcess.stderr.on('data', (data) => {
        // Ignore stderr for tail
      });
      
      tailProcess.on('error', (error) => {
        console.error(`TTY tail process error for ${ttyDevice}:`, error);
        this.emit('error', sessionId, error);
        this.detachFromTTY(sessionId);
      });
      
      tailProcess.on('close', () => {
        this.emit('close', sessionId);
        this.detachFromTTY(sessionId);
      });
      
      // Also start a periodic content refresh for Terminal app
      if (initialContent) {
        const refreshInterval = setInterval(() => {
          try {
            const script = `
              tell application "Terminal"
                set allWindows to every window
                repeat with win in allWindows
                  set allTabs to every tab of win
                  repeat with t in allTabs
                    if tty of t contains "${ttyName}" then
                      return contents of t
                    end if
                  end repeat
                end repeat
                return ""
              end tell
            `;
            
            const newContent = execSync(`osascript -e '${script.replace(/\n/g, ' ')}'`, { 
              encoding: 'utf8',
              maxBuffer: 10 * 1024 * 1024
            });
            
            if (newContent && newContent !== initialContent) {
              // Send only the new part
              if (newContent.startsWith(initialContent)) {
                const diff = newContent.substring(initialContent.length);
                if (diff.trim()) {
                  this.emit('data', sessionId, diff);
                }
              } else {
                // Full refresh if content changed completely
                this.emit('data', sessionId, '\x1b[2J\x1b[H'); // Clear screen
                this.emit('data', sessionId, newContent);
              }
              initialContent = newContent;
            }
          } catch (e) {
            // Stop refresh if error
            clearInterval(refreshInterval);
          }
        }, 2000); // Refresh every 2 seconds
        
        // Store interval for cleanup
        if (!this.activeStreams.has(sessionId)) {
          clearInterval(refreshInterval);
        } else {
          const stream = this.activeStreams.get(sessionId);
          stream.refreshInterval = refreshInterval;
        }
      }
      
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
      // Clear refresh interval if exists
      if (streamInfo.refreshInterval) {
        clearInterval(streamInfo.refreshInterval);
      }
      
      if ((streamInfo.type === 'mirror' || streamInfo.type === 'cat' || streamInfo.type === 'tail') && streamInfo.process) {
        // Kill the process
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