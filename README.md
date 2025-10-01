# 🖥️ Web Terminal Server

[![npm version](https://badge.fury.io/js/web-terminal-server.svg)](https://www.npmjs.com/package/web-terminal-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/web-terminal-server.svg)](https://nodejs.org)

> Professional web-based terminal server with persistent sessions, live sharing, port monitoring, and full CLI support. Perfect for AI CLI tools like Claude Code, Codex, and Gemini CLI.

## ✨ Features

- 🔄 **Persistent Sessions** - Terminal processes keep running even when disconnected
- 🔗 **Live Sharing** - Share terminal sessions with unique URLs
- 💾 **Session History** - Full output history preserved across reconnections
- 🔍 **Port Monitoring** - Automatic detection of open ports with direct links
- 📁 **Quick Navigation** - Copy `cd` commands to process directories
- 🎮 **Mobile Support** - Touch-friendly controls for mobile devices
- 🔒 **Security Levels** - Configurable access control (full/limited/restricted)
- 🌐 **Ngrok Support** - Built-in support for public tunneling
- 📊 **Session Monitor** - Real-time monitoring with bulk management
- ✅ **Batch Operations** - Select and delete multiple sessions at once
- ⚡ **Zero Delay** - Optimized for real-time performance
- 🎨 **Professional UI** - GitHub-inspired dark theme with smooth animations

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

## 🔍 Port Monitoring

The `/ports` page automatically detects open ports on your system and provides:

- **Port Number** - The port where the service is running
- **Process Name** - Name of the process using the port
- **🔗 Open Button** - Direct link to `http://localhost:PORT`
- **📁 Copy cd Button** - Copies `cd` command to process working directory

### Example Use Cases:

- Monitor dev servers (React, Vue, Angular on port 3000, 5173, etc.)
- Check API servers (Express, FastAPI on port 8000, 4000, etc.)
- Track database ports (PostgreSQL 5432, MongoDB 27017, etc.)
- Quick access to any local service

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
