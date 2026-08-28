#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Yonder Graph — Stop All Services
# Gracefully terminates all managed background processes.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

PID_DIR="/tmp/yonder-graph"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

stop_process() {
    local name="$1"
    local pidfile="$PID_DIR/${name}.pid"
    
    if [ -f "$pidfile" ]; then
        local pid
        pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            echo -e "${GREEN}[STOP]${NC} $name (PID $pid) terminated"
        else
            echo -e "${YELLOW}[SKIP]${NC} $name (PID $pid) was not running"
        fi
        rm -f "$pidfile"
    else
        echo -e "${YELLOW}[SKIP]${NC} $name — no PID file found"
    fi
}

echo ""
echo -e "${RED}Stopping Yonder Graph services...${NC}"
echo ""

# Stop application processes
stop_process "frontend"
stop_process "poller"
stop_process "backend"

# Ensure ports 8000 and 3000 are freed
if command -v lsof >/dev/null 2>&1; then
    stale_pids=$(lsof -ti :8000 -ti :3000 2>/dev/null || true)
    if [ -n "$stale_pids" ]; then
        kill -9 $stale_pids 2>/dev/null || true
    fi
fi

# Stop Neo4j
echo -e "${GREEN}[STOP]${NC} Stopping Neo4j..."
neo4j stop 2>/dev/null || true

# Note: PostgreSQL is managed as a system service — not stopped here
echo -e "${YELLOW}[NOTE]${NC} PostgreSQL left running (system service). Stop manually if needed."

# Clean up PID directory
rm -rf "$PID_DIR"

echo ""
echo -e "${GREEN}All Yonder Graph application processes stopped.${NC}"
echo ""
