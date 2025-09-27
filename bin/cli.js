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
  
For more info: https://github.com/OzlevyQ/web-terminal-server
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
    const port = process.env.TERMINAL_PORT || 5000;
    let connected = false;
    
    // Try using ngrok module first
    try {
      let ngrok;
      
      // Check if ngrok module is available
      try {
        ngrok = require('ngrok');
      } catch (moduleError) {
        // Try to require from parent directories
        try {
          ngrok = require(path.join(process.cwd(), 'node_modules', 'ngrok'));
        } catch {
          // Module not found, try to install it
          console.log('📦 Ngrok module not found. Installing...');
          const { execSync } = require('child_process');
          try {
            execSync('npm install ngrok --no-save', { 
              stdio: 'inherit',
              cwd: process.cwd()
            });
            ngrok = require('ngrok');
          } catch (installError) {
            console.log('\n⚠️  Could not install ngrok module automatically.');
            throw new Error('Ngrok module not available');
          }
        }
      }
      
      // Set timeout for ngrok connection
      const connectOptions = {
        addr: port
      };
      
      // Only add authtoken if it exists
      if (process.env.NGROK_AUTH_TOKEN && process.env.NGROK_AUTH_TOKEN.trim()) {
        connectOptions.authtoken = process.env.NGROK_AUTH_TOKEN.trim();
      }
      
      const connectPromise = ngrok.connect(connectOptions);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Ngrok connection timeout')), 10000);
      });
      
      // Race between connection and timeout
      ngrokUrl = await Promise.race([connectPromise, timeoutPromise]);
      connected = true;
      
      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    🌐 NGROK TUNNEL ACTIVE                      ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log(`\n🔗 Public URL: ${ngrokUrl}`);
      console.log('📋 Share this URL to access your terminal from anywhere!');
      console.log('\n═══════════════════════════════════════════════════════════════');
      
      // Update BASE_URL environment variable for the server
      process.env.BASE_URL = ngrokUrl;
      
      // Open ngrok URL in browser
      if (!flags['no-browser']) {
        setTimeout(() => {
          console.log(`\n🌐 Opening browser at: ${ngrokUrl}`);
          const platform = process.platform;
          const opener = platform === 'darwin' ? 'open' : 
                        platform === 'win32' ? 'start' : 'xdg-open';
          spawn(opener, [ngrokUrl], { detached: true, stdio: 'ignore' });
        }, 1000);
      }
      
    } catch (error) {
      console.log('⚠️  Ngrok module failed:', error.message);
    }
    
    // If module didn't work, try CLI as fallback
    if (!connected) {
      console.log('📱 Trying ngrok CLI...');
      
      // Check if ngrok CLI exists
      const { execSync } = require('child_process');
      let hasNgrokCli = false;
      
      try {
        execSync('ngrok version', { stdio: 'ignore' });
        hasNgrokCli = true;
      } catch {
        console.log('\n⚠️  Ngrok CLI not found.');
        console.log('   Install with: brew install ngrok (Mac)');
        console.log('   Or download from: https://ngrok.com/download');
        console.log('\n📌 Tip: Add NGROK_AUTH_TOKEN to your .env file for better experience');
        return;
      }
      
      if (hasNgrokCli) {
        // Use exec to get URL from ngrok
        try {
          // Start ngrok in background
          const ngrokCmd = spawn('ngrok', ['http', port], {
            detached: true,
            stdio: 'ignore'
          });
          
          // Give ngrok time to start
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          // Try to get the URL using ngrok API
          try {
            const result = execSync('curl -s http://127.0.0.1:4040/api/tunnels', { encoding: 'utf8' });
            const data = JSON.parse(result);
            
            if (data.tunnels && data.tunnels.length > 0) {
              // Find the https tunnel
              const httpsTunnel = data.tunnels.find(t => t.proto === 'https') || data.tunnels[0];
              ngrokUrl = httpsTunnel.public_url;
              
              console.log('\n╔════════════════════════════════════════════════════════════════╗');
              console.log('║                    🌐 NGROK TUNNEL ACTIVE                      ║');
              console.log('╚════════════════════════════════════════════════════════════════╝');
              console.log(`\n🔗 Public URL: ${ngrokUrl}`);
              console.log('📋 Share this URL to access your terminal from anywhere!');
              console.log('\n📊 Ngrok Dashboard: http://127.0.0.1:4040');
              console.log('═══════════════════════════════════════════════════════════════\n');
              
              // Open URL in browser
              if (!flags['no-browser']) {
                setTimeout(() => {
                  console.log(`🌐 Opening browser at: ${ngrokUrl}`);
                  const platform = process.platform;
                  const opener = platform === 'darwin' ? 'open' : 
                                platform === 'win32' ? 'start' : 'xdg-open';
                  spawn(opener, [ngrokUrl], { detached: true, stdio: 'ignore' });
                }, 1000);
              }
            } else {
              throw new Error('No tunnels found');
            }
          } catch (apiError) {
            // If API doesn't work, show manual instructions
            console.log('\n╔════════════════════════════════════════════════════════════════╗');
            console.log('║                    🌐 NGROK TUNNEL STARTED                     ║');
            console.log('╚════════════════════════════════════════════════════════════════╝');
            console.log('\n📌 Ngrok is running! To see your public URL:');
            console.log('   1. Open new terminal');
            console.log('   2. Run: curl http://127.0.0.1:4040/api/tunnels | grep public_url');
            console.log('   OR');
            console.log('   3. Open browser: http://127.0.0.1:4040');
            console.log('\n💡 Tip: The URL format is usually:');
            console.log(`   https://[random].ngrok-free.app`);
            console.log('═══════════════════════════════════════════════════════════════\n');
          }
        } catch (error) {
          console.log('⚠️  Could not start ngrok. Error:', error.message);
        }
      }
    }
  }, 3000); // Give server time to start
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
  
  // Kill ngrok if running
  try {
    require('child_process').execSync('pkill ngrok', { stdio: 'ignore' });
  } catch {}
  
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