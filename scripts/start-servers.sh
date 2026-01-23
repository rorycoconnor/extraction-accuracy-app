#!/bin/bash

# Start Frontend and Backend Servers
# This script starts the Next.js development server

cd "$(dirname "$0")/.." || exit 1

echo "Starting servers..."

# First, ensure ports are free
if lsof -ti :9002 > /dev/null 2>&1; then
    echo "Port 9002 is in use. Killing existing process..."
    lsof -ti :9002 | xargs kill -9 2>/dev/null
    sleep 1
fi

echo "Starting Next.js dev server on port 9002..."
npm run dev
