#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Yonder Graph — Clean Restart All Services
# Safely terminates and restarts backend, poller, frontend, and databases,
# then waits for health check before completing.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}[RESTART]${NC} Cycling all Yonder Graph services..."
echo ""

# 1. Stop existing app processes
./stop_all.sh

# 2. Start all services
./start_all.sh

# 3. Wait for Backend Readiness
echo ""
echo -e "${CYAN}[CHECK]${NC}   Waiting for backend to be healthy on http://127.0.0.1:8000/api/health..."
MAX_RETRIES=30
RETRY_COUNT=0
HEALTHY=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
        HEALTHY=1
        break
    fi
    sleep 0.5
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $HEALTHY -eq 1 ]; then
    echo -e "${GREEN}[OK]${NC}      All services synced, healthy, and ready!"
    echo ""
else
    echo -e "${RED}[WARN]${NC}    Backend did not respond to /api/health within 15 seconds. Check /tmp/yonder-graph/backend.log"
    echo ""
fi
