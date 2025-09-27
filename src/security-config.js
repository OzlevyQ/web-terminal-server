// Security configuration for terminal server
module.exports = {
  // Security levels: 'restricted', 'limited', 'full'
  securityLevel: process.env.TERMINAL_SECURITY || 'full',
  
  // Allowed starting directories by security level
  allowedStartingDirs: {
    restricted: [process.env.HOME], // Only home directory
    limited: [process.env.HOME, '/tmp', '/var/tmp'], // Home + temp dirs
    full: ['/'] // Full system access
  },
  
  // Blocked commands by security level
  blockedCommands: {
    restricted: ['sudo', 'su', 'rm -rf', 'chmod 777', 'chown'],
    limited: ['sudo', 'su'],
    full: [] // No restrictions
  },
  
  // Environment variables restrictions
  allowedEnvVars: {
    restricted: ['PATH', 'HOME', 'USER', 'TERM', 'COLORTERM'],
    limited: ['PATH', 'HOME', 'USER', 'TERM', 'COLORTERM', 'PWD', 'OLDPWD'],
    full: null // All environment variables
  },
  
  // File system access
  fileSystemAccess: {
    restricted: {
      canAccessRoot: false,
      canAccessSystem: false,
      canModifySystem: false
    },
    limited: {
      canAccessRoot: true,
      canAccessSystem: false,
      canModifySystem: false
    },
    full: {
      canAccessRoot: true,
      canAccessSystem: true,
      canModifySystem: true
    }
  },
  
  // Get security configuration for current level
  getCurrentConfig() {
    const level = this.securityLevel;
    return {
      level,
      startingDirs: this.allowedStartingDirs[level],
      blockedCommands: this.blockedCommands[level],
      envVars: this.allowedEnvVars[level],
      fileAccess: this.fileSystemAccess[level]
    };
  },
  
  // Check if command is allowed
  isCommandAllowed(command) {
    const blocked = this.blockedCommands[this.securityLevel];
    return !blocked.some(cmd => command.toLowerCase().includes(cmd.toLowerCase()));
  },
  
  // Get appropriate starting directory
  getStartingDirectory() {
    const config = this.getCurrentConfig();
    
    switch (this.securityLevel) {
      case 'restricted':
        return process.env.HOME;
      case 'limited':
        return process.env.HOME;
      case 'full':
      default:
        return process.platform === 'win32' ? 'C:\\' : '/';
    }
  }
};