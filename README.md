# 🖥️ Web Terminal Server

[![npm version](https://badge.fury.io/js/web-terminal-server.svg)](https://www.npmjs.com/package/web-terminal-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/web-terminal-server.svg)](https://nodejs.org)

> Professional web-based terminal server with persistent sessions, live sharing, port monitoring, and full CLI support. Perfect for AI CLI tools like Claude Code, Codex, and Gemini CLI.

## ✨ Features

- 🔄 **Persistent Sessions** - Terminal processes keep running even when disconnected
- 🔗 **Live Sharing** - Share terminal sessions with unique URLs
- 💾 **Session History** - Full output history preserved across reconnections
- 🔍 **Smart Port Detection** - Automatic discovery of ports opened from your terminal
- 🌐 **Cloudflare Tunnels** - One-click public URLs with cloudflared integration
- 🚀 **Live Port Notifications** - Pop-up alerts when new ports are detected in terminal
- 📡 **Live Button** - Quick access to active tunnel URLs directly in terminal header
- 📁 **Quick Navigation** - Copy `cd` commands to process directories
- 🎮 **Mobile Support** - Touch-friendly controls for mobile devices
- 🔒 **Security Levels** - Configurable access control (full/limited/restricted)
- 📊 **Session Monitor** - Real-time monitoring with bulk management
- ✅ **Batch Operations** - Select and delete multiple sessions at once
- ⚡ **Optimized Performance** - Smart caching and efficient port tracking
- 🎨 **Modern UI** - Consistent design with glass-morphism effects and smooth animations
- 📱 **Help Modals** - Built-in interactive guides for all features

## 🚀 Quick Start

### Using npx (Recommended)

```bash
npx web-terminal-server
```

That's it! Your terminal server is now running at http://localhost:5000

### With custom options:

```bash
# Run on different port
npx web-terminal-server --port 3000

# Enable ngrok tunnel
npx web-terminal-server --ngrok

# Set security level
npx web-terminal-server --security limited

# Don't open browser automatically
npx web-terminal-server --no-browser
```

## 📦 Installation

### Global Installation

```bash
npm install -g web-terminal-server
web-terminal-server
```

Or use the short alias:
```bash
wts
```

### Local Installation

```bash
npm install web-terminal-server
npx web-terminal-server
```

### From Source

```bash
git clone https://github.com/OzlevyQ/web-terminal-server.git
cd web-terminal-server
npm install
npm start
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
# Server Configuration
PORT=5000
HOST=0.0.0.0

# Security Settings
# Options: full, limited, restricted
TERMINAL_SECURITY=full

# Session Management
MAX_SESSIONS=10
SESSION_TIMEOUT=3600000
DETACHED_SESSION_TIMEOUT=86400000

# External Access (Important for sharing!)
BASE_URL=http://localhost:5000

# Ngrok (optional)
NGROK_AUTH_TOKEN=your_auth_token_here

# Terminal Configuration
TERMINAL_SHELL=/bin/bash
TERMINAL_COLS=80
TERMINAL_ROWS=24

# Performance
MAX_BUFFER_SIZE=52428800
CHUNK_SIZE=32768

# Data Storage
DATA_DIR=./data
```

### Security Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `full` | Complete system access | Development, trusted environments |
| `limited` | Home + temp directories | Shared servers |
| `restricted` | Home directory only | Public deployments |

## 🌐 External Access with Ngrok

### Method 1: Built-in Integration

```bash
# Set your auth token in .env
NGROK_AUTH_TOKEN=your_token_here

# Run with --ngrok flag
npx web-terminal-server --ngrok
```

### Method 2: Manual Ngrok

```bash
# Terminal 1: Start the server
npx web-terminal-server

# Terminal 2: Start ngrok
ngrok http 5000
```

Copy the public URL (e.g., `https://abc123.ngrok.io`) and set it in your `.env`:

```env
BASE_URL=https://abc123.ngrok.io
```

## 📊 Available Pages

Access these pages while the server is running:

- **`/`** - Main dashboard with web terminal
- **`/ports`** - Port monitoring page with open ports list
- **`/monitor`** - Session monitoring dashboard

## 🔍 Smart Port Detection & Cloudflare Tunnels

### Automatic Port Discovery

The `/ports` page automatically detects open ports (1-9000) on your system and provides:

- **Port Number** - The port where the service is running
- **Process Name** - Name of the process using the port
- **🔗 Open Button** - Direct link to `http://localhost:PORT`
- **📁 Copy cd Button** - Copies `cd` command to process working directory
- **🌐 Create Tunnel** - One-click Cloudflare tunnel creation for public access

### Live Port Notifications (New! 🎉)

When you run a server in the terminal, a beautiful notification pops up:

1. **Automatic Detection** - Detects when ports are opened from your terminal session
2. **Smart Filtering** - Only shows ports from YOUR terminal (not system ports)
3. **One-Click Tunnels** - Create public URLs instantly with Cloudflare
4. **Live Button** - Active tunnel shows in terminal header with port number
5. **Works Everywhere** - Functions in normal, shared, and connected sessions

### Cloudflare Tunnel Setup

Install cloudflared to enable public tunnels:

```bash
# macOS
brew install cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

Once installed:
- Click "Create Tunnel" on any port
- Get instant public URL (e.g., `https://abc-xyz-123.trycloudflare.com`)
- Share with anyone, anywhere
- Click "LIVE :8080" button in terminal header to open

### Example Use Cases:

- Share local dev server with clients instantly
- Test mobile apps against local backend
- Demo work-in-progress without deployment
- Remote debugging with team members
- Quick API endpoint sharing

## 🎯 Use Cases

### AI CLI Tools
Perfect for running interactive AI tools:
- **Claude Code** - Anthropic's coding assistant
- **Codex CLI** - OpenAI's code generation
- **Gemini CLI** - Google's AI interface
- **Any interactive CLI** that needs persistent sessions

### Development Workflows
- Remote pair programming
- Live debugging sessions
- Server monitoring
- Build process watching
- Port monitoring for multiple services

### Education
- Live coding demonstrations
- Student terminal access
- Interactive tutorials

## 📱 Mobile Support

The terminal works perfectly on mobile devices with:
- Touch-optimized controls
- Virtual keyboard integration
- Gesture support
- Responsive layout

Access the controls panel with the ⚙️ button for:
- Arrow keys navigation
- Special keys (Tab, Esc, Ctrl+C)
- Copy/paste functionality

## 🔗 Session Sharing

1. Start any terminal session
2. Click the **Share** button
3. Copy the generated URL
4. Share with anyone!

The shared session will:
- Show all previous output
- Continue from exactly where you left off
- Allow real-time collaboration

## 📊 Session Monitoring

Access the monitor at `http://localhost:5000/monitor` to see:
- All active and saved sessions
- Session statistics and resource usage
- Quick access links to any session
- **Bulk management** - Select multiple sessions with checkboxes
- **Batch deletion** - Delete multiple sessions at once with a single confirmation
- Beautiful visual feedback for selected sessions

## 🛡️ Security Best Practices

1. **Always use environment variables** for production URLs
2. **Set appropriate security levels** based on your use case
3. **Use HTTPS** in production (via ngrok or reverse proxy)
4. **Limit session numbers** to prevent resource exhaustion
5. **Configure timeouts** for inactive sessions

## 🐛 Troubleshooting

### "cd /" doesn't work
- Check security level: needs `TERMINAL_SECURITY=full`
- Verify in server logs on startup

### Session not persisting
- Ensure `data/` directory is writable
- Check session timeout settings
- Verify BASE_URL is correctly set

### Ngrok not working
- Install globally: `npm install -g ngrok`
- Set auth token: `ngrok authtoken YOUR_TOKEN`
- Check firewall settings

### Mobile keyboard issues
- Use the Controls panel (⚙️ button)
- Try the Keyboard button first
- Ensure browser has input focus

### Port monitoring shows no ports
- Make sure you have other services running
- `lsof` command must be available (macOS/Linux)
- Check if ports are actually open: `lsof -i -P | grep LISTEN`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [xterm.js](https://github.com/xtermjs/xterm.js) - Terminal rendering
- [node-pty](https://github.com/microsoft/node-pty) - Pseudo terminal support
- [Socket.io](https://socket.io/) - Real-time communication
- [Express](https://expressjs.com/) - Web framework

## 📞 Support

- 🐛 Issues: [GitHub Issues](https://github.com/OzlevyQ/web-terminal-server/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/OzlevyQ/web-terminal-server/discussions)

---

<p align="center">
  Made with ❤️ by developers, for developers
</p>
