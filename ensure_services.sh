#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Yonder Graph — Ensure Background Services
# Automatically invoked before `npm run dev` (via predev script)
# Ensures PostgreSQL, Neo4j, FastAPI, and Poller are active & healthy.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_DIR="/tmp/yonder-graph"
mkdir -p "$PID_DIR"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PORT_BACKEND="${PORT_BACKEND:-8000}"

# 1. Check & start PostgreSQL
if [ "$(uname -s)" = "Darwin" ]; then
    brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
else
    sudo systemctl start postgresql 2>/dev/null || true
fi

# 2. Check & start Neo4j
if ! curl -s http://localhost:7474 > /dev/null 2>&1; then
    echo -e "${CYAN}[SYNC]${NC} Starting Neo4j..."
    neo4j start 2>/dev/null || true
fi

# 3. Check & start Backend
if ! curl -s -f "http://127.0.0.1:$PORT_BACKEND/api/health" > /dev/null 2>&1; then
    echo -e "${CYAN}[SYNC]${NC} Starting FastAPI Backend on port $PORT_BACKEND..."
    
    # Kill any stale backend PID
    if [ -f "$PID_DIR/backend.pid" ]; then
        kill -9 "$(cat "$PID_DIR/backend.pid")" 2>/dev/null || true
        rm -f "$PID_DIR/backend.pid"
    fi

    # Activate Python venv if present
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi

    nohup python3 -m uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port "$PORT_BACKEND" \
        --reload \
        > "$PID_DIR/backend.log" 2>&1 &
    echo $! > "$PID_DIR/backend.pid"

    # Wait for backend readiness
    echo -e "${CYAN}[SYNC]${NC} Waiting for backend health check..."
    for i in {1..30}; do
        if curl -s -f "http://127.0.0.1:$PORT_BACKEND/api/health" > /dev/null 2>&1; then
            break
        fi
        sleep 0.5
    done
fi

# 4. Check & start Raw Poller
if [ ! -f "$PID_DIR/poller.pid" ] || ! kill -0 "$(cat "$PID_DIR/poller.pid" 2>/dev/null)" 2>/dev/null; then
    echo -e "${CYAN}[SYNC]${NC} Starting Raw Knowledge Poller..."
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    nohup python3 -m backend.ingestion.raw_poller \
        > "$PID_DIR/poller.log" 2>&1 &
    echo $! > "$PID_DIR/poller.pid"
fi

echo -e "${GREEN}[OK]${NC}   Full stack synced and backend healthy (http://127.0.0.1:$PORT_BACKEND)"
