#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Yonder Graph — Start All Services
# Launches PostgreSQL, Neo4j, FastAPI, Raw Poller, and Vite
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_DIR="/tmp/yonder-graph"
mkdir -p "$PID_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[START]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }

# Load .env
if [ -f .env ]; then
    set -a; source .env; set +a
fi

PORT_BACKEND="${PORT_BACKEND:-8000}"
PORT_FRONTEND="${PORT_FRONTEND:-3000}"

# ──────────────────────────────────────────────────────────────
# 1. PostgreSQL
# ──────────────────────────────────────────────────────────────
info "Starting PostgreSQL..."
if [ "$(uname -s)" = "Darwin" ]; then
    brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
else
    sudo systemctl start postgresql 2>/dev/null || true
fi
success "PostgreSQL service started"

# ──────────────────────────────────────────────────────────────
# 2. Neo4j
# ──────────────────────────────────────────────────────────────
info "Starting Neo4j..."
neo4j start 2>/dev/null || true
success "Neo4j started (bolt://localhost:7687)"

# ──────────────────────────────────────────────────────────────
# 3. Activate Python venv
# ──────────────────────────────────────────────────────────────
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# ──────────────────────────────────────────────────────────────
# 4. FastAPI Backend
# ──────────────────────────────────────────────────────────────
info "Starting FastAPI backend on port $PORT_BACKEND..."
nohup python3 -m uvicorn backend.main:app \
    --host 0.0.0.0 \
    --port "$PORT_BACKEND" \
    --reload \
    > "$PID_DIR/backend.log" 2>&1 &
echo $! > "$PID_DIR/backend.pid"
success "FastAPI backend PID: $(cat "$PID_DIR/backend.pid")"

# ──────────────────────────────────────────────────────────────
# 5. Raw Poller Worker
# ──────────────────────────────────────────────────────────────
info "Starting raw knowledge poller..."
nohup python3 -m backend.ingestion.raw_poller \
    > "$PID_DIR/poller.log" 2>&1 &
echo $! > "$PID_DIR/poller.pid"
success "Raw poller PID: $(cat "$PID_DIR/poller.pid")"

# ──────────────────────────────────────────────────────────────
# 6. Vite Frontend Dev Server
# ──────────────────────────────────────────────────────────────
info "Starting Vite dev server on port $PORT_FRONTEND..."
cd frontend
nohup npx vite --port "$PORT_FRONTEND" --host \
    > "$PID_DIR/frontend.log" 2>&1 &
echo $! > "$PID_DIR/frontend.pid"
cd "$SCRIPT_DIR"
success "Vite frontend PID: $(cat "$PID_DIR/frontend.pid")"

# ──────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Yonder Graph — All Services Running${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Backend API:  http://localhost:$PORT_BACKEND/docs"
echo "  Frontend UI:  http://localhost:$PORT_FRONTEND"
echo "  Neo4j Browser: http://localhost:7474"
echo "  PID directory: $PID_DIR/"
echo ""
echo "  Stop all: ./stop_all.sh"
echo ""
