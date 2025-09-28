const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execAsync = promisify(exec);

/**
 * ProcessTracker - Cross-platform process information tracker
 */
class ProcessTracker {
  constructor() {
    this.platform = process.platform;
    this.processCache = new Map(); // pid -> processInfo cache
    this.cacheTimeout = 5000; // 5 seconds cache
  }

  /**
   * Get detailed process information
   */
  async getProcessInfo(pid) {
    if (!pid || pid === 0) {
      return null;
    }

    // Check cache
    const cached = this.processCache.get(pid);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      let info;
      
      switch (this.platform) {
        case 'darwin':
          info = await this.getProcessInfoMacOS(pid);
          break;
        case 'linux':
          info = await this.getProcessInfoLinux(pid);
          break;
        case 'win32':
          info = await this.getProcessInfoWindows(pid);
          break;
        default:
          throw new Error(`Unsupported platform: ${this.platform}`);
      }

      // Cache the result
      this.processCache.set(pid, {
        data: info,
        timestamp: Date.now()
      });

      return info;
    } catch (error) {
      console.error(`Failed to get process info for PID ${pid}:`, error.message);
      return null;
    }
  }

  /**
   * Get process info on macOS
   */
  async getProcessInfoMacOS(pid) {
    try {
      // Get basic process info
      const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o pid,ppid,user,comm,args`);
      const lines = psOutput.trim().split('\n');
      
      if (lines.length < 2) {
        return null;
      }

      // Parse ps output
      const dataLine = lines[1];
      const parts = dataLine.trim().split(/\s+/);
      
      // Get working directory
      let cwd = '';
      try {
        const { stdout: lsofOutput } = await execAsync(`lsof -p ${pid} | grep cwd | head -1`);
        const cwdMatch = lsofOutput.match(/\s+(\/.*)$/);
        if (cwdMatch) {
          cwd = cwdMatch[1];
        }
      } catch {}

      // Get memory and CPU usage
      let memoryMB = 0;
      let cpu = 0;
      try {
        const { stdout: topOutput } = await execAsync(`ps -p ${pid} -o %mem,%cpu | tail -1`);
        const topParts = topOutput.trim().split(/\s+/);
        if (topParts.length >= 2) {
          memoryMB = parseFloat(topParts[0]);
          cpu = parseFloat(topParts[1]);
        }
      } catch {}

      // Get command line arguments
      let commandLine = parts.slice(4).join(' ');
      
      // Detect application type
      const appType = this.detectAppType(commandLine);
      const framework = this.detectFramework(commandLine, cwd);

      return {
        pid: parseInt(pid),
        ppid: parseInt(parts[1]),
        user: parts[2],
        name: parts[3],
        commandLine,
        cwd,
        memoryMB,
        cpu,
        appType,
        framework,
        platform: 'darwin'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get process info on Linux
   */
  async getProcessInfoLinux(pid) {
    try {
      // Read from /proc filesystem
      const fs = require('fs').promises;
      
      // Get command line
      let commandLine = '';
      try {
        const cmdlineBuffer = await fs.readFile(`/proc/${pid}/cmdline`);
        commandLine = cmdlineBuffer.toString().replace(/\0/g, ' ').trim();
      } catch {}

      // Get working directory
      let cwd = '';
      try {
        cwd = await fs.readlink(`/proc/${pid}/cwd`);
      } catch {}

      // Get process status
      let status = {};
      try {
        const statusContent = await fs.readFile(`/proc/${pid}/status`, 'utf8');
        const lines = statusContent.split('\n');
        for (const line of lines) {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            status[key] = value;
          }
        }
      } catch {}

      // Get memory and CPU from stat
      let memoryMB = 0;
      let cpu = 0;
      try {
        const { stdout } = await execAsync(`ps -p ${pid} -o %mem,%cpu | tail -1`);
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 2) {
          memoryMB = parseFloat(parts[0]);
          cpu = parseFloat(parts[1]);
        }
      } catch {}

      // Detect application type
      const appType = this.detectAppType(commandLine);
      const framework = this.detectFramework(commandLine, cwd);

      return {
        pid: parseInt(pid),
        ppid: parseInt(status.PPid || 0),
        user: status.Uid || 'unknown',
        name: status.Name || 'unknown',
        commandLine,
        cwd,
        memoryMB,
        cpu,
        appType,
        framework,
        platform: 'linux'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get process info on Windows
   */
  async getProcessInfoWindows(pid) {
    try {
      // Use wmic to get process info
      const { stdout } = await execAsync(
        `wmic process where ProcessId=${pid} get Name,ParentProcessId,CommandLine,WorkingSetSize,PageFileUsage /format:csv`
      );
      
      const lines = stdout.trim().split('\r\n').filter(line => line.trim());
      if (lines.length < 2) {
        return null;
      }

      // Parse CSV output
      const headers = lines[lines.length - 2].split(',');
      const values = lines[lines.length - 1].split(',');
      
      const data = {};
      headers.forEach((header, index) => {
        data[header] = values[index];
      });

      // Get additional info using tasklist
      let cpu = 0;
      try {
        const { stdout: taskOutput } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /V`);
        // Parse CPU time from tasklist output
        // This is approximate since Windows doesn't easily provide CPU percentage
      } catch {}

      const commandLine = data.CommandLine || '';
      const appType = this.detectAppType(commandLine);
      const framework = this.detectFramework(commandLine, '');

      return {
        pid: parseInt(pid),
        ppid: parseInt(data.ParentProcessId || 0),
        user: 'N/A', // Would need additional WMI query
        name: data.Name || 'unknown',
        commandLine,
        cwd: '', // Not easily available on Windows
        memoryMB: data.WorkingSetSize ? parseInt(data.WorkingSetSize) / 1048576 : 0,
        cpu,
        appType,
        framework,
        platform: 'win32'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Detect application type from command line
   */
  detectAppType(commandLine) {
    const cmd = commandLine.toLowerCase();
    
    // Programming languages and runtimes
    if (cmd.includes('node') || cmd.includes('npm') || cmd.includes('yarn') || cmd.includes('pnpm')) {
      return 'nodejs';
    }
    if (cmd.includes('python') || cmd.includes('py.exe')) {
      return 'python';
    }
    if (cmd.includes('java') || cmd.includes('javaw')) {
      return 'java';
    }
    if (cmd.includes('ruby')) {
      return 'ruby';
    }
    if (cmd.includes('php')) {
      return 'php';
    }
    if (cmd.includes('dotnet') || cmd.includes('.dll')) {
      return 'dotnet';
    }
    if (cmd.includes('go run') || cmd.includes('golang')) {
      return 'golang';
    }
    if (cmd.includes('cargo') || cmd.includes('rustc')) {
      return 'rust';
    }
    
    // Databases
    if (cmd.includes('mysql') || cmd.includes('mysqld')) {
      return 'mysql';
    }
    if (cmd.includes('postgres') || cmd.includes('postgresql')) {
      return 'postgresql';
    }
    if (cmd.includes('mongod') || cmd.includes('mongodb')) {
      return 'mongodb';
    }
    if (cmd.includes('redis')) {
      return 'redis';
    }
    
    // Web servers
    if (cmd.includes('nginx')) {
      return 'nginx';
    }
    if (cmd.includes('apache') || cmd.includes('httpd')) {
      return 'apache';
    }
    
    // Containers
    if (cmd.includes('docker')) {
      return 'docker';
    }
    if (cmd.includes('containerd')) {
      return 'container';
    }
    
    return 'unknown';
  }

  /**
   * Detect framework from command line and working directory
   */
  detectFramework(commandLine, cwd) {
    const cmd = commandLine.toLowerCase();
    
    // Node.js frameworks
    if (cmd.includes('next')) {
      return 'nextjs';
    }
    if (cmd.includes('vite')) {
      return 'vite';
    }
    if (cmd.includes('react-scripts')) {
      return 'create-react-app';
    }
    if (cmd.includes('vue-cli')) {
      return 'vue-cli';
    }
    if (cmd.includes('ng serve') || cmd.includes('angular')) {
      return 'angular';
    }
    if (cmd.includes('gatsby')) {
      return 'gatsby';
    }
    if (cmd.includes('nuxt')) {
      return 'nuxt';
    }
    if (cmd.includes('webpack-dev-server')) {
      return 'webpack';
    }
    if (cmd.includes('parcel')) {
      return 'parcel';
    }
    if (cmd.includes('express')) {
      return 'express';
    }
    if (cmd.includes('fastify')) {
      return 'fastify';
    }
    if (cmd.includes('nest')) {
      return 'nestjs';
    }
    
    // Python frameworks
    if (cmd.includes('django') || cmd.includes('manage.py runserver')) {
      return 'django';
    }
    if (cmd.includes('flask')) {
      return 'flask';
    }
    if (cmd.includes('fastapi') || cmd.includes('uvicorn')) {
      return 'fastapi';
    }
    if (cmd.includes('streamlit')) {
      return 'streamlit';
    }
    if (cmd.includes('jupyter')) {
      return 'jupyter';
    }
    
    // Ruby frameworks
    if (cmd.includes('rails')) {
      return 'rails';
    }
    if (cmd.includes('sinatra')) {
      return 'sinatra';
    }
    
    // PHP frameworks
    if (cmd.includes('laravel') || cmd.includes('artisan')) {
      return 'laravel';
    }
    if (cmd.includes('symfony')) {
      return 'symfony';
    }
    
    // Java frameworks
    if (cmd.includes('spring')) {
      return 'spring';
    }
    if (cmd.includes('tomcat')) {
      return 'tomcat';
    }
    
    return 'unknown';
  }

  /**
   * Get framework-specific port detection regex
   */
  getFrameworkPortRegex(framework) {
    const patterns = {
      // Node.js frameworks
      'vite': /Local:.*:(\d+)/,
      'nextjs': /started server on.*:(\d+)|ready on.*:(\d+)/i,
      'create-react-app': /On Your Network:.*:(\d+)|Local:.*:(\d+)/,
      'angular': /Angular Live Development Server.*:(\d+)/,
      'express': /listening on port (\d+)|server.*:(\d+)/i,
      'fastify': /Server listening at.*:(\d+)/,
      
      // Python frameworks
      'django': /Starting development server at.*:(\d+)/,
      'flask': /Running on.*:(\d+)/,
      'fastapi': /Uvicorn running on.*:(\d+)/,
      'streamlit': /Network URL:.*:(\d+)|Local URL:.*:(\d+)/,
      
      // Ruby
      'rails': /Listening on.*:(\d+)/,
      
      // PHP
      'laravel': /Laravel development server started.*:(\d+)/,
      
      // Default
      'default': /(?:port|listening|server|running on|started at).*?(\d{4,5})/i
    };
    
    return patterns[framework] || patterns.default;
  }

  /**
   * Clear process cache
   */
  clearCache() {
    this.processCache.clear();
  }

  /**
   * Get all cached processes
   */
  getCachedProcesses() {
    const processes = [];
    for (const [pid, cache] of this.processCache) {
      if (Date.now() - cache.timestamp < this.cacheTimeout) {
        processes.push(cache.data);
      }
    }
    return processes;
  }
}

module.exports = ProcessTracker;