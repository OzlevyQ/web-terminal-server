# 🖥️ Web Terminal Server

[![npm version](https://badge.fury.io/js/web-terminal-server.svg)](https://www.npmjs.com/package/web-terminal-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/web-terminal-server.svg)](https://nodejs.org)

> Professional web-based terminal server with persistent sessions, live sharing, and full CLI support. Perfect for AI CLI tools like Claude Code, Codex, and Gemini CLI.

![Web Terminal Server Demo](https://via.placeholder.com/800x400/0D1117/58A6FF?text=Web+Terminal+Server)

## ✨ Features

- 🔄 **Persistent Sessions** - Terminal processes keep running even when disconnected
- 🔗 **Live Sharing** - Share terminal sessions with unique URLs
- 💾 **Session History** - Full output history preserved across reconnections
- 🎮 **Mobile Support** - Touch-friendly controls for mobile devices
- 🔒 **Security Levels** - Configurable access control (full/limited/restricted)
- 🌐 **Ngrok Support** - Built-in support for public tunneling
- 📊 **Session Monitor** - Real-time monitoring of all active sessions
- ⚡ **Zero Delay** - Optimized for real-time performance
- 🎨 **Professional UI** - GitHub-inspired dark theme

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
```

## 📦 Installation

### Global Installation

```bash
npm install -g web-terminal-server
web-terminal-server
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
TERMINAL_SECURITY=full

# External Access (Important for sharing!)
BASE_URL=https://your-domain.com

# Ngrok (optional)
NGROK_AUTH_TOKEN=your_auth_token_here

# Session Settings
MAX_SESSIONS=10
SESSION_TIMEOUT=3600000
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
- All active sessions
- Session statistics
- Resource usage
- Quick access links

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

- 📧 Email: support@web-terminal-server.org
- 🐛 Issues: [GitHub Issues](https://github.com/OzlevyQ/web-terminal-server/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/OzlevyQ/web-terminal-server/discussions)

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=OzlevyQ/web-terminal-server&type=Date)](https://star-history.com/#OzlevyQ/web-terminal-server&Date)

---

<p align="center">
  Made with ❤️ by developers, for developers
</p>

<p align="center">
  <a href="https://github.com/OzlevyQ/web-terminal-server">
    <img src="https://img.shields.io/github/stars/OzlevyQ/web-terminal-server?style=social" alt="GitHub stars">
  </a>
</p>