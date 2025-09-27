#!/bin/bash

echo "🔍 Checking ngrok status..."

# Check if ngrok is running
if pgrep -x "ngrok" > /dev/null
then
    echo "✅ Ngrok is running"
    echo ""
    echo "📊 Getting tunnel URL..."
    
    # Get the URL from ngrok API
    URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*' | head -1)
    
    if [ -z "$URL" ]; then
        echo "⚠️  Could not get URL automatically"
        echo ""
        echo "Try these methods:"
        echo "1. Open browser: http://127.0.0.1:4040"
        echo "2. Check ngrok output in the terminal where you started it"
    else
        echo ""
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║                    🌐 NGROK PUBLIC URL                         ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
        echo ""
        echo "🔗 URL: $URL"
        echo ""
        echo "📋 Copy this URL to share your terminal!"
        echo "📊 Dashboard: http://127.0.0.1:4040"
    fi
else
    echo "❌ Ngrok is not running"
    echo ""
    echo "Start the server with:"
    echo "npx web-terminal-server --ngrok"
fi