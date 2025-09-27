#!/usr/bin/env node

const { spawn, execSync } = require('child_process');

const port = process.argv[2] || 5000;

// Kill any existing ngrok processes
try {
  execSync('pkill ngrok', { stdio: 'ignore' });
  console.log('Killed existing ngrok processes');
} catch {}

// Wait a bit for cleanup
setTimeout(() => {
  console.log(`Starting ngrok on port ${port}...`);
  
  // Start ngrok with explicit output
  const ngrok = spawn('ngrok', ['http', port.toString(), '--log=stdout'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  let output = '';
  let urlFound = false;
  
  ngrok.stdout.on('data', (data) => {
    output += data.toString();
    
    // Look for the URL pattern in ngrok output
    const urlMatch = output.match(/url=(https:\/\/[^\s]+)/);
    if (urlMatch && !urlFound) {
      urlFound = true;
      const url = urlMatch[1];
      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    🌐 NGROK TUNNEL ACTIVE                      ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log(`\n🔗 Public URL: ${url}`);
      console.log('📋 Share this URL to access your terminal from anywhere!');
      console.log('\n📊 Ngrok Dashboard: http://127.0.0.1:4040');
      console.log('═══════════════════════════════════════════════════════════════\n');
      
      // Write URL to file for parent process to read
      require('fs').writeFileSync('/tmp/ngrok-url.txt', url);
    }
  });
  
  ngrok.stderr.on('data', (data) => {
    const error = data.toString();
    if (error.includes('ERROR')) {
      console.error('Ngrok error:', error);
    }
  });
  
  // Also try to get URL from API after a delay
  setTimeout(async () => {
    if (!urlFound) {
      try {
        const result = execSync('curl -s http://127.0.0.1:4040/api/tunnels', { encoding: 'utf8' });
        const data = JSON.parse(result);
        
        if (data.tunnels && data.tunnels.length > 0) {
          const httpsTunnel = data.tunnels.find(t => t.proto === 'https') || data.tunnels[0];
          const url = httpsTunnel.public_url;
          
          console.log('\n╔════════════════════════════════════════════════════════════════╗');
          console.log('║                    🌐 NGROK TUNNEL ACTIVE                      ║');
          console.log('╚════════════════════════════════════════════════════════════════╝');
          console.log(`\n🔗 Public URL: ${url}`);
          console.log('📋 Share this URL to access your terminal from anywhere!');
          console.log('\n📊 Ngrok Dashboard: http://127.0.0.1:4040');
          console.log('═══════════════════════════════════════════════════════════════\n');
          
          // Write URL to file
          require('fs').writeFileSync('/tmp/ngrok-url.txt', url);
        }
      } catch (e) {
        console.log('⏳ Waiting for ngrok to establish tunnel...');
      }
    }
  }, 3000);
  
}, 1000);

// Keep process alive
process.stdin.resume();