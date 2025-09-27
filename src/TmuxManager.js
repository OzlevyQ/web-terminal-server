const { spawn, execSync } = require('child_process');
const { EventEmitter } = require('events');

class TmuxManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
  }

  /**
   * Check if tmux is installed
   */
  isTmuxAvailable() {
    try {
      execSync('which tmux', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all tmux sessions
   */
  listSessions() {
    if (!this.isTmuxAvailable()) {
      return [];
    }

    try {
      const output = execSync('tmux list-sessions -F "#{session_name}:#{session_created}:#{session_attached}:#{session_windows}:#{pane_current_command}"', { encoding: 'utf8' });
      const sessions = [];
      
      output.split('\n').filter(Boolean).forEach(line => {
        const [name, created, attached, windows, command] = line.split(':');
        sessions.push({
          name,
          created: new Date(parseInt(created) * 1000),
          attached: attached === '1',
          windows: parseInt(windows),
          command,
          canAttach: true
        });
      });
      
      return sessions;
    } catch (error) {
      // No tmux sessions or tmux not running
      return [];
    }
  }

  /**
   * Create a new tmux session
   */
  createSession(sessionName, options = {}) {
    if (!this.isTmuxAvailable()) {
      throw new Error('tmux is not installed');
    }

    const {
      detached = true,
      shell = process.env.SHELL || '/bin/bash',
      cwd = process.cwd(),
      cols = 80,
      rows = 24
    } = options;

    try {
      // Check if session already exists
      try {
        execSync(`tmux has-session -t ${sessionName}`, { stdio: 'ignore' });
        throw new Error(`Tmux session ${sessionName} already exists`);
      } catch {
        // Session doesn't exist, we can create it
      }

      // Create new tmux session
      const args = [
        'new-session',
        '-s', sessionName,
        '-c', cwd,
        '-x', cols.toString(),
        '-y', rows.toString()
      ];

      if (detached) {
        args.push('-d');
      }

      args.push(shell);

      const tmuxProcess = spawn('tmux', args, {
        stdio: 'ignore',
        detached: true
      });

      tmuxProcess.unref();

      this.sessions.set(sessionName, {
        name: sessionName,
        created: Date.now(),
        process: tmuxProcess,
        attached: false
      });

      return sessionName;
    } catch (error) {
      throw new Error(`Failed to create tmux session: ${error.message}`);
    }
  }

  /**
   * Attach to an existing tmux session
   */
  attachToSession(sessionName, mode = 'shared') {
    if (!this.isTmuxAvailable()) {
      throw new Error('tmux is not installed');
    }

    try {
      // Check if session exists
      execSync(`tmux has-session -t ${sessionName}`, { stdio: 'ignore' });

      const args = ['attach-session', '-t', sessionName];
      
      if (mode === 'readonly') {
        // Create a read-only pipe
        args.push('-r');
      }

      const tmuxProcess = spawn('tmux', args);
      
      return {
        process: tmuxProcess,
        sessionName,
        mode
      };
    } catch (error) {
      throw new Error(`Cannot attach to tmux session ${sessionName}: ${error.message}`);
    }
  }

  /**
   * Send commands to a tmux session
   */
  sendToSession(sessionName, command) {
    if (!this.isTmuxAvailable()) {
      throw new Error('tmux is not installed');
    }

    try {
      execSync(`tmux send-keys -t ${sessionName} "${command}" Enter`, { encoding: 'utf8' });
      return true;
    } catch (error) {
      throw new Error(`Cannot send command to tmux session ${sessionName}: ${error.message}`);
    }
  }

  /**
   * Capture pane output from a tmux session
   */
  capturePaneOutput(sessionName, lines = 100) {
    if (!this.isTmuxAvailable()) {
      throw new Error('tmux is not installed');
    }

    try {
      const output = execSync(`tmux capture-pane -t ${sessionName} -p -S -${lines}`, { encoding: 'utf8' });
      return output;
    } catch (error) {
      throw new Error(`Cannot capture output from tmux session ${sessionName}: ${error.message}`);
    }
  }

  /**
   * Create a pipe to monitor tmux session output
   */
  monitorSession(sessionName, callback) {
    if (!this.isTmuxAvailable()) {
      throw new Error('tmux is not installed');
    }

    try {
      // Check if session exists
      execSync(`tmux has-session -t ${sessionName}`, { stdio: 'ignore' });

      // Use tmux pipe-pane to stream output
      const pipePath = `/tmp/tmux-${sessionName}-${Date.now()}.pipe`;
      
      // Start piping pane output to a file
      execSync(`tmux pipe-pane -t ${sessionName} -o "cat >> ${pipePath}"`);

      // Read from the pipe
      const fs = require('fs');
      const tail = spawn('tail', ['-f', pipePath]);
      
      tail.stdout.on('data', (data) => {
        callback(null, data.toString());
      });

      tail.stderr.on('data', (data) => {
        callback(new Error(data.toString()), null);
      });

      tail.on('close', () => {
        // Clean up pipe file
        try {
          fs.unlinkSync(pipePath);
        } catch {}
      });

      return {
        stop: () => {
          tail.kill();
          execSync(`tmux pipe-pane -t ${sessionName}`, { stdio: 'ignore' });
          try {
            fs.unlinkSync(pipePath);
          } catch {}
        }
      };
    } catch (error) {
      throw new Error(`Cannot monitor tmux session ${sessionName}: ${error.message}`);
    }
  }

  /**
   * Kill a tmux session
   */
  killSession(sessionName) {
    if (!this.isTmuxAvailable()) {
      return false;
    }

    try {
      execSync(`tmux kill-session -t ${sessionName}`, { stdio: 'ignore' });
      this.sessions.delete(sessionName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up all managed sessions
   */
  cleanup() {
    for (const [sessionName] of this.sessions) {
      this.killSession(sessionName);
    }
  }
}

module.exports = TmuxManager;