const { spawn, execSync } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');

/**
 * TTYSnoop - Advanced TTY monitoring for macOS
 * Uses various techniques to capture terminal content
 */
class TTYSnoop extends EventEmitter {
  constructor() {
    super();
    this.activeSnoops = new Map();
  }

  /**
   * Start snooping on a TTY using dtrace (requires sudo)
   */
  snoopWithDtrace(ttyDevice, sessionId) {
    try {
      // Create dtrace script to monitor TTY
      const dtraceScript = `
        syscall::write:entry
        /execname != "dtrace" && fds[arg0].fi_name == "${ttyDevice}"/
        {
          printf("%s", copyinstr(arg1, arg2));
        }
      `;
      
      const dtraceProcess = spawn('sudo', ['dtrace', '-q', '-n', dtraceScript], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      this.activeSnoops.set(sessionId, {
        process: dtraceProcess,
        type: 'dtrace',
        device: ttyDevice
      });
      
      dtraceProcess.stdout.on('data', (data) => {
        this.emit('data', sessionId, data.toString());
      });
      
      dtraceProcess.stderr.on('data', (data) => {
        console.error('Dtrace error:', data.toString());
      });
      
      dtraceProcess.on('close', () => {
        this.emit('close', sessionId);
        this.activeSnoops.delete(sessionId);
      });
      
      return true;
    } catch (error) {
      throw new Error(`Cannot snoop with dtrace: ${error.message}`);
    }
  }

  /**
   * Snoop using fs_usage (less intrusive)
   */
  snoopWithFsUsage(ttyDevice, sessionId) {
    try {
      // Use fs_usage to monitor file system calls
      const fsUsageProcess = spawn('sudo', ['fs_usage', '-w', '-f', 'filesys', ttyDevice], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      this.activeSnoops.set(sessionId, {
        process: fsUsageProcess,
        type: 'fs_usage',
        device: ttyDevice
      });
      
      fsUsageProcess.stdout.on('data', (data) => {
        // Parse fs_usage output to extract write data
        const output = data.toString();
        const writeMatch = output.match(/write.*\s+(\S+)$/);
        if (writeMatch) {
          this.emit('data', sessionId, writeMatch[1]);
        }
      });
      
      fsUsageProcess.on('close', () => {
        this.emit('close', sessionId);
        this.activeSnoops.delete(sessionId);
      });
      
      return true;
    } catch (error) {
      throw new Error(`Cannot snoop with fs_usage: ${error.message}`);
    }
  }

  /**
   * Use expect/unbuffer to interact with TTY
   */
  snoopWithExpect(ttyDevice, sessionId) {
    try {
      // Check if expect is available
      execSync('which expect', { stdio: 'ignore' });
      
      // Create expect script
      const expectScript = `
        #!/usr/bin/expect -f
        set tty "${ttyDevice}"
        spawn -noecho cat $tty
        expect {
          -re ".+" {
            send_user "$expect_out(buffer)"
            exp_continue
          }
          eof { exit }
        }
      `;
      
      // Write script to temp file
      const scriptPath = `/tmp/tty-snoop-${sessionId}.exp`;
      fs.writeFileSync(scriptPath, expectScript);
      fs.chmodSync(scriptPath, '755');
      
      // Run expect script
      const expectProcess = spawn('expect', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      this.activeSnoops.set(sessionId, {
        process: expectProcess,
        type: 'expect',
        device: ttyDevice,
        scriptPath
      });
      
      expectProcess.stdout.on('data', (data) => {
        this.emit('data', sessionId, data.toString());
      });
      
      expectProcess.on('close', () => {
        // Clean up script file
        try {
          fs.unlinkSync(scriptPath);
        } catch {}
        
        this.emit('close', sessionId);
        this.activeSnoops.delete(sessionId);
      });
      
      return true;
    } catch (error) {
      throw new Error(`Cannot snoop with expect: ${error.message}`);
    }
  }

  /**
   * Try screencapture + OCR approach for visual terminals
   */
  async captureScreen(ttyDevice, sessionId) {
    try {
      // Get window ID for the TTY
      const ttyName = ttyDevice.split('/').pop();
      
      // Use screencapture to get terminal window
      const screenshotPath = `/tmp/tty-screenshot-${sessionId}.png`;
      
      // Try to find Terminal window with this TTY
      const windowList = execSync('osascript -e "tell application \\"Terminal\\" to get id of every window"', { encoding: 'utf8' });
      
      // Take screenshot
      execSync(`screencapture -l $(osascript -e 'tell app "Terminal" to id of front window') ${screenshotPath}`);
      
      // You could use OCR here to extract text from image
      // For now, just indicate screenshot was taken
      this.emit('data', sessionId, `[Screenshot saved to ${screenshotPath}]\n`);
      
      return screenshotPath;
    } catch (error) {
      throw new Error(`Cannot capture screen: ${error.message}`);
    }
  }

  /**
   * Use AppleScript to get Terminal content (macOS specific)
   */
  getTerminalContent(ttyDevice, sessionId) {
    try {
      const ttyName = ttyDevice.split('/').pop();
      
      // AppleScript to get terminal content
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
        end tell
      `;
      
      const content = execSync(`osascript -e '${script.replace(/\n/g, ' ')}'`, { encoding: 'utf8' });
      
      if (content) {
        this.emit('data', sessionId, content);
        return content;
      }
      
      return null;
    } catch (error) {
      console.error('AppleScript error:', error);
      return null;
    }
  }

  /**
   * Stop snooping
   */
  stopSnoop(sessionId) {
    const snoopInfo = this.activeSnoops.get(sessionId);
    if (!snoopInfo) {
      return false;
    }
    
    try {
      if (snoopInfo.process) {
        snoopInfo.process.kill('SIGTERM');
      }
      
      if (snoopInfo.scriptPath) {
        fs.unlinkSync(snoopInfo.scriptPath);
      }
    } catch (error) {
      console.error('Error stopping snoop:', error);
    }
    
    this.activeSnoops.delete(sessionId);
    return true;
  }
  
  /**
   * Clean up all snoops
   */
  cleanup() {
    for (const sessionId of this.activeSnoops.keys()) {
      this.stopSnoop(sessionId);
    }
  }
}

module.exports = TTYSnoop;