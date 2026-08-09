#!/bin/bash

# EcoTrack SRS Mockup - Quick Start Script

echo "🌱 EcoTrack SRS Mockup - Quick Start"
echo "===================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm"
    exit 1
fi

echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Start development server
echo "🚀 Starting development server..."
echo ""
echo "The app will be available at: http://127.0.0.1:5173"
echo ""
echo "To generate screenshots in another terminal, run:"
echo "  npm run test:screenshot"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
