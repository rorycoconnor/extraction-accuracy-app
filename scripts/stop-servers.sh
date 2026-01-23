#!/bin/bash

# Stop Frontend and Backend Servers
# This script kills any processes running on the app ports

echo "Stopping servers..."

# Kill Next.js dev server (port 9002)
if lsof -ti :9002 > /dev/null 2>&1; then
    echo "Killing process on port 9002 (Next.js)..."
    lsof -ti :9002 | xargs kill -9 2>/dev/null
    echo "✓ Next.js server stopped"
else
    echo "✓ No process running on port 9002"
fi

# Kill any node processes related to this project (optional cleanup)
# Uncomment if needed:
# pkill -f "next dev" 2>/dev/null

echo ""
echo "All servers stopped."
