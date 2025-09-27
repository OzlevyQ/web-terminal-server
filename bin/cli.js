#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {};

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const flag = args[i].substring(2);
    const nextArg = args[i + 1];
    
    if (nextArg && !nextArg.startsWith('--')) {
      flags[flag] = nextArg;
      i++;
    } else {
      flags[flag] = true;
    }
  }
}

// Display help
if (flags.help || flags.h) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Web Terminal Server - Professional Edition           ║
╚════════════════════════════════════════════════════════════════╝

Usage: npx web-terminal-server [options]

Options:
  --port <number>      Port to run the server (default: 5000)
  --security <level>   Security level: full, limited, restricted (default: full)
  --ngrok             Enable ngrok tunnel (requires NGROK_AUTH_TOKEN in .env)
  --no-browser        Don't open browser automatically
  --help              Show this help message

Examples:
  npx web-terminal-server
  npx web-terminal-server --port 3000
  npx web-terminal-server --security limited --ngrok
  npx web-terminal-server --port 8080 --no-browser

Security Levels:
  full       - Complete system access (cd / works)
  limited    - Access to home and temp directories
  restricted - Home directory only

Environment Variables (.env):
  PORT                Server port (default: 5000)
  TERMINAL_SECURITY   Security level (default: full)
  BASE_URL           Custom base URL for sharing
  NGROK_AUTH_TOKEN   Ngrok authentication token
  
For more info: https://github.com/yourusername/web-terminal-server
`);
  process.exit(0);
}

// Show startup banner
console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║     ██╗    ██╗███████╗██████╗     ████████╗███████╗██████╗   ║
║     ██║    ██║██╔════╝██╔══██╗    ╚══██╔══╝██╔════╝██╔══██╗  ║
║     ██║ █╗ ██║█████╗  ██████╔╝       ██║   █████╗  ██████╔╝  ║
║     ██║███╗██║██╔══╝  ██╔══██╗       ██║   ██╔══╝  ██╔══██╗  ║
║     ╚███╔███╔╝███████╗██████╔╝       ██║   ███████╗██║  ██║  ║
║      ╚══╝╚══╝ ╚══════╝╚═════╝        ╚═╝   ╚══════╝╚═╝  ╚═╝  ║
║                                                                ║
║           Web Terminal Server - Professional Edition           ║
║                  Persistent Sessions & Live Sharing            ║
╚════════════════════════════════════════════════════════════════╝
`);

// Set environment variables from flags
if (flags.port) process.env.TERMINAL_PORT = flags.port;
if (flags.security) process.env.TERMINAL_SECURITY = flags.security;

// Check for .env file in current directory
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('📁 Loading .env file from current directory...');
  require('dotenv').config({ path: envPath });
}

// Start the server
const serverPath = path.join(__dirname, '..', 'src', 'server.js');
const serverProcess = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: { ...process.env }
});

// Handle ngrok if requested
let ngrokUrl = null;
if (flags.ngrok) {
  setTimeout(async () => {
    console.log('\n🌐 Starting ngrok tunnel...');
    
    try {
      // Try using ngrok API to get the URL
      const ngrok = require('ngrok');
      const port = process.env.TERMINAL_PORT || 5000;
      
      ngrokUrl = await ngrok.connect({
        addr: port,
        authtoken: process.env.NGROK_AUTH_TOKEN
      });
      
      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    🌐 NGROK TUNNEL ACTIVE                      ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log(`\n🔗 Public URL: ${ngrokUrl}`);
      console.log('📋 Share this URL to access your terminal from anywhere!');
      console.log('\n═══════════════════════════════════════════════════════════════');
      
      // Open ngrok URL in browser
      if (!flags['no-browser']) {
        setTimeout(() => {
          console.log(`\n🌐 Opening ngrok URL in browser: ${ngrokUrl}`);
          const platform = process.platform;
          const opener = platform === 'darwin' ? 'open' : 
                        platform === 'win32' ? 'start' : 'xdg-open';
          spawn(opener, [ngrokUrl], { detached: true, stdio: 'ignore' });
        }, 1000);
      }
      
      // Update BASE_URL environment variable for the server
      process.env.BASE_URL = ngrokUrl;
      
    } catch (error) {
      // Fallback to CLI ngrok if module not available
      console.log('📦 Installing ngrok module...');
      const { execSync } = require('child_process');
      try {
        execSync('npm install ngrok', { stdio: 'inherit' });
        console.log('✅ Ngrok installed, please restart with --ngrok flag');
      } catch {
        console.log('\n⚠️  Please install ngrok manually:');
        console.log('   npm install ngrok');
        console.log('   Or globally: npm install -g ngrok');
        console.log('   Or visit: https://ngrok.com/download');
        
        // Try using CLI ngrok as fallback
        const ngrokProcess = spawn('ngrok', ['http', process.env.TERMINAL_PORT || '5000'], {
          stdio: 'pipe'
        });
        
        ngrokProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('url=')) {
            const match = output.match(/url=(https?:\/\/[^\s]+)/);
            if (match) {
              ngrokUrl = match[1];
              console.log(`\n🔗 Public URL: ${ngrokUrl}`);
              console.log('📋 Share this URL to access your terminal from anywhere!');
              
              // Open URL
              if (!flags['no-browser']) {
                const platform = process.platform;
                const opener = platform === 'darwin' ? 'open' : 
                              platform === 'win32' ? 'start' : 'xdg-open';
                spawn(opener, [ngrokUrl], { detached: true, stdio: 'ignore' });
              }
            }
          }
        });
      }
    }
  }, 2000);
}

// Open browser unless disabled (only if not using ngrok)
if (!flags['no-browser'] && !flags.ngrok) {
  setTimeout(() => {
    const port = process.env.TERMINAL_PORT || 5000;
    const url = `http://localhost:${port}`;
    console.log(`\n🌐 Opening browser at ${url}`);
    
    const platform = process.platform;
    const opener = platform === 'darwin' ? 'open' : 
                   platform === 'win32' ? 'start' : 'xdg-open';
    
    spawn(opener, [url], { detached: true, stdio: 'ignore' });
  }, 3000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down Web Terminal Server...');
  serverProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
  process.exit(0);
});

serverProcess.on('exit', (code) => {
  process.exit(code);
});