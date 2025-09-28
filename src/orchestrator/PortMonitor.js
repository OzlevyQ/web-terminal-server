const { EventEmitter } = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * PortMonitor - Universal port monitoring system
 * Detects all processes opening ports on the system
 */
class PortMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.scanInterval = options.scanInterval || 2000; // 2 seconds default
    this.knownPorts = new Map(); // port -> processInfo
    this.intervalId = null;
    this.platform = process.platform;
    this.isMonitoring = false;
  }

  /**
   * Start monitoring for port changes
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('Port monitoring already active');
      return;
    }

    console.log(`Starting port monitor (${this.platform}) - scanning every ${this.scanInterval}ms`);
    this.isMonitoring = true;
    
    // Initial scan
    this.scanPorts();
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.scanPorts();
    }, this.scanInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
    console.log('Port monitoring stopped');
  }

  /**
   * Scan for open ports
   */
  async scanPorts() {
    try {
      const currentPorts = await this.getAllOpenPorts();
      
      // Check for new ports
      for (const portInfo of currentPorts) {
        const key = `${portInfo.port}:${portInfo.protocol}`;
        const existing = this.knownPorts.get(key);
        
        if (!existing) {
          // New port discovered
          console.log(`New port discovered: ${portInfo.port} (${portInfo.processName})`);
          this.knownPorts.set(key, portInfo);
          this.emit('port:discovered', portInfo);
        } else if (existing.pid !== portInfo.pid) {
          // Port changed process
          console.log(`Port ${portInfo.port} changed process: ${existing.processName} -> ${portInfo.processName}`);
          this.knownPorts.set(key, portInfo);
          this.emit('port:changed', portInfo);
        }
      }
      
      // Check for closed ports
      for (const [key, portInfo] of this.knownPorts.entries()) {
        const stillOpen = currentPorts.find(p => 
          `${p.port}:${p.protocol}` === key
        );
        
        if (!stillOpen) {
          console.log(`Port closed: ${portInfo.port} (${portInfo.processName})`);
          this.knownPorts.delete(key);
          this.emit('port:closed', portInfo);
        }
      }
    } catch (error) {
      console.error('Port scan error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get all open ports based on platform
   */
  async getAllOpenPorts() {
    switch (this.platform) {
      case 'darwin':
        return await this.scanPortsMacOS();
      case 'linux':
        return await this.scanPortsLinux();
      case 'win32':
        return await this.scanPortsWindows();
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  /**
   * Scan ports on macOS using lsof
   */
  async scanPortsMacOS() {
    try {
      // lsof -i -P -n | grep LISTEN
      const { stdout } = await execAsync('lsof -i -P -n | grep LISTEN');
      const ports = [];
      
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;
        
        const processName = parts[0];
        const pid = parseInt(parts[1]);
        const user = parts[2];
        const fd = parts[3];
        const type = parts[4];
        const device = parts[5];
        const size = parts[6];
        const protocol = parts[7];
        const name = parts[8];
        
        // Parse address:port
        const match = name.match(/([^:]+):(\d+)$/);
        if (match) {
          const address = match[1];
          const port = parseInt(match[2]);
          
          // Skip localhost-only services if needed
          const isLocalOnly = address === '127.0.0.1' || address === 'localhost';
          
          ports.push({
            port,
            pid,
            processName,
            user,
            protocol: protocol.toLowerCase(),
            address,
            isLocalOnly,
            platform: 'darwin',
            raw: line
          });
        }
      }
      
      return ports;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('lsof command not found. Please install lsof.');
      }
      return [];
    }
  }

  /**
   * Scan ports on Linux using netstat or ss
   */
  async scanPortsLinux() {
    try {
      // Try ss first (newer), fall back to netstat
      let stdout;
      let command;
      
      try {
        const result = await execAsync('ss -tlnp 2>/dev/null');
        stdout = result.stdout;
        command = 'ss';
      } catch {
        const result = await execAsync('netstat -tlnp 2>/dev/null');
        stdout = result.stdout;
        command = 'netstat';
      }
      
      const ports = [];
      const lines = stdout.split('\n').filter(line => line.trim());
      
      // Skip header
      const dataLines = lines.slice(1);
      
      for (const line of dataLines) {
        if (command === 'ss') {
          // Parse ss output
          // State  Recv-Q Send-Q Local Address:Port   Peer Address:Port  Process
          const match = line.match(/LISTEN\s+\d+\s+\d+\s+([^:]+):(\d+)\s+[^:]+:\*\s*(.*)?/);
          if (match) {
            const address = match[1];
            const port = parseInt(match[2]);
            const processInfo = match[3] || '';
            
            // Extract process name and pid
            const processMatch = processInfo.match(/users:\(\("([^"]+)",pid=(\d+)/);
            const processName = processMatch ? processMatch[1] : 'unknown';
            const pid = processMatch ? parseInt(processMatch[2]) : 0;
            
            ports.push({
              port,
              pid,
              processName,
              protocol: 'tcp',
              address,
              isLocalOnly: address === '127.0.0.1',
              platform: 'linux',
              raw: line
            });
          }
        } else {
          // Parse netstat output
          const parts = line.split(/\s+/);
          if (parts.length >= 7 && parts[5] === 'LISTEN') {
            const localAddress = parts[3];
            const match = localAddress.match(/([^:]+):(\d+)$/);
            
            if (match) {
              const address = match[1];
              const port = parseInt(match[2]);
              const processInfo = parts[6] || '-';
              
              // Extract process name and pid
              const processMatch = processInfo.match(/(\d+)\/(.+)/);
              const pid = processMatch ? parseInt(processMatch[1]) : 0;
              const processName = processMatch ? processMatch[2] : 'unknown';
              
              ports.push({
                port,
                pid,
                processName,
                protocol: parts[0].toLowerCase(),
                address,
                isLocalOnly: address === '127.0.0.1',
                platform: 'linux',
                raw: line
              });
            }
          }
        }
      }
      
      return ports;
    } catch (error) {
      return [];
    }
  }

  /**
   * Scan ports on Windows using netstat
   */
  async scanPortsWindows() {
    try {
      // netstat -ano | findstr LISTENING
      const { stdout } = await execAsync('netstat -ano | findstr LISTENING');
      const ports = [];
      
      const lines = stdout.split('\r\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const protocol = parts[0].toLowerCase();
          const localAddress = parts[1];
          const state = parts[3];
          const pid = parseInt(parts[4]);
          
          // Parse address:port
          const match = localAddress.match(/([^:]+):(\d+)$/);
          if (match) {
            const address = match[1];
            const port = parseInt(match[2]);
            
            // Get process name from PID
            let processName = 'unknown';
            try {
              const { stdout: tasklistOut } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV | findstr "${pid}"`);
              const taskParts = tasklistOut.split(',');
              if (taskParts.length > 0) {
                processName = taskParts[0].replace(/"/g, '');
              }
            } catch {}
            
            ports.push({
              port,
              pid,
              processName,
              protocol,
              address,
              isLocalOnly: address === '127.0.0.1',
              platform: 'win32',
              raw: line
            });
          }
        }
      }
      
      return ports;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get current known ports
   */
  getKnownPorts() {
    return Array.from(this.knownPorts.values());
  }

  /**
   * Check if a specific port is open
   */
  isPortOpen(port) {
    for (const [key] of this.knownPorts) {
      if (key.startsWith(`${port}:`)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get process info for a specific port
   */
  getPortInfo(port) {
    for (const [key, value] of this.knownPorts) {
      if (key.startsWith(`${port}:`)) {
        return value;
      }
    }
    return null;
  }

  /**
   * Filter ports by process name
   */
  getPortsByProcess(processName) {
    return Array.from(this.knownPorts.values()).filter(p => 
      p.processName.toLowerCase().includes(processName.toLowerCase())
    );
  }

  /**
   * Get statistics
   */
  getStats() {
    const ports = Array.from(this.knownPorts.values());
    const processCounts = {};
    
    ports.forEach(p => {
      processCounts[p.processName] = (processCounts[p.processName] || 0) + 1;
    });
    
    return {
      totalPorts: ports.length,
      localPorts: ports.filter(p => p.isLocalOnly).length,
      publicPorts: ports.filter(p => !p.isLocalOnly).length,
      byProcess: processCounts,
      platform: this.platform
    };
  }
}

module.exports = PortMonitor;