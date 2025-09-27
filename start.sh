#!/bin/bash

# Web Terminal Server - Quick Start Script

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           Web Terminal Server - Quick Start                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Starting server..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
npm start