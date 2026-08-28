#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Yonder Graph — Local Environment Setup Script
# Installs and configures all dependencies for native execution.
# Supported: macOS (Homebrew) and Linux (apt / dnf)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()    { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ──────────────────────────────────────────────────────────────
# 1. OS Detection
# ──────────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
    Darwin) PLATFORM="macos" ;;
    Linux)  PLATFORM="linux" ;;
    *)      fail "Unsupported OS: $OS. Only macOS and Linux are supported." ;;
esac
info "Detected platform: $PLATFORM ($OS)"

# ──────────────────────────────────────────────────────────────
# 2. Prerequisite Checks
# ──────────────────────────────────────────────────────────────

# Java 17+
if command -v java &>/dev/null; then
    JAVA_VER=$(java -version 2>&1 | head -1 | awk -F '"' '{print $2}' | cut -d. -f1)
    if [ "$JAVA_VER" -ge 17 ] 2>/dev/null; then
        success "Java $JAVA_VER detected"
    else
        warn "Java $JAVA_VER detected — Neo4j requires Java 17+. Attempting install..."
        if [ "$PLATFORM" = "macos" ]; then
            brew install openjdk@21
            sudo ln -sfn "$(brew --prefix openjdk@21)/libexec/openjdk.jdk" /Library/Java/JavaVirtualMachines/openjdk-21.jdk 2>/dev/null || true
        else
            sudo apt-get install -y openjdk-21-jdk 2>/dev/null || sudo dnf install -y java-21-openjdk 2>/dev/null || fail "Could not install Java 21"
        fi
    fi
else
    info "Java not found. Installing OpenJDK 21..."
    if [ "$PLATFORM" = "macos" ]; then
        brew install openjdk@21
        sudo ln -sfn "$(brew --prefix openjdk@21)/libexec/openjdk.jdk" /Library/Java/JavaVirtualMachines/openjdk-21.jdk 2>/dev/null || true
    else
        sudo apt-get install -y openjdk-21-jdk 2>/dev/null || sudo dnf install -y java-21-openjdk 2>/dev/null || fail "Could not install Java 21"
    fi
fi

# Python 3.10+
if command -v python3 &>/dev/null; then
    PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
    if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 10 ]; then
        success "Python $PY_VER detected"
    else
        fail "Python 3.10+ required, found $PY_VER"
    fi
else
    fail "Python 3 not found. Install Python 3.10+ and re-run."
fi

# Node.js 18+
if command -v node &>/dev/null; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 18 ]; then
        success "Node.js v$NODE_VER detected"
    else
        fail "Node.js 18+ required, found v$NODE_VER"
    fi
else
    fail "Node.js not found. Install Node.js 18+ and re-run."
fi

# ──────────────────────────────────────────────────────────────
# 3. Neo4j Community Edition
# ──────────────────────────────────────────────────────────────
info "Checking Neo4j installation..."

if command -v neo4j &>/dev/null; then
    success "Neo4j already installed: $(neo4j --version 2>/dev/null || echo 'version unknown')"
else
    info "Installing Neo4j Community Edition..."
    if [ "$PLATFORM" = "macos" ]; then
        brew install neo4j
    else
        # Linux: Add Neo4j apt repo
        wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/neotechnology.gpg 2>/dev/null || true
        echo 'deb [signed-by=/etc/apt/keyrings/neotechnology.gpg] https://debian.neo4j.com stable latest' | sudo tee /etc/apt/sources.list.d/neo4j.list
        sudo apt-get update && sudo apt-get install -y neo4j
    fi
    success "Neo4j installed"
fi

# Enable APOC in neo4j.conf
NEO4J_CONF=""
if [ "$PLATFORM" = "macos" ]; then
    NEO4J_CONF="$(brew --prefix neo4j)/libexec/conf/neo4j.conf"
    if [ ! -f "$NEO4J_CONF" ]; then
        NEO4J_CONF="/usr/local/etc/neo4j/neo4j.conf"
    fi
else
    NEO4J_CONF="/etc/neo4j/neo4j.conf"
fi

if [ -f "$NEO4J_CONF" ]; then
    info "Configuring APOC in neo4j.conf..."
    grep -q "dbms.security.procedures.unrestricted=apoc.*" "$NEO4J_CONF" 2>/dev/null || \
        echo "dbms.security.procedures.unrestricted=apoc.*" | sudo tee -a "$NEO4J_CONF" >/dev/null
    grep -q "dbms.security.procedures.allowlist=apoc.*" "$NEO4J_CONF" 2>/dev/null || \
        echo "dbms.security.procedures.allowlist=apoc.*" | sudo tee -a "$NEO4J_CONF" >/dev/null
    success "APOC procedures enabled in neo4j.conf"
else
    warn "Could not locate neo4j.conf — please enable APOC manually."
fi

# ──────────────────────────────────────────────────────────────
# 4. PostgreSQL 16
# ──────────────────────────────────────────────────────────────
info "Checking PostgreSQL installation..."

if command -v psql &>/dev/null; then
    PG_VER=$(psql --version | awk '{print $3}' | cut -d. -f1)
    success "PostgreSQL $PG_VER detected"
else
    info "Installing PostgreSQL 16..."
    if [ "$PLATFORM" = "macos" ]; then
        brew install postgresql@16
        brew services start postgresql@16
    else
        sudo apt-get install -y postgresql-16 2>/dev/null || sudo dnf install -y postgresql16-server 2>/dev/null || fail "Could not install PostgreSQL"
        sudo systemctl enable --now postgresql
    fi
    success "PostgreSQL installed and started"
fi

# Ensure PostgreSQL service is running
if [ "$PLATFORM" = "macos" ]; then
    brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
fi

# Create audit database
info "Creating PostgreSQL database: yonder_graph_audit..."
if psql -U postgres -lqt 2>/dev/null | cut -d\| -f1 | grep -qw yonder_graph_audit; then
    success "Database yonder_graph_audit already exists"
else
    createdb -U postgres yonder_graph_audit 2>/dev/null || \
    psql -U postgres -c "CREATE DATABASE yonder_graph_audit;" 2>/dev/null || \
    warn "Could not create database automatically. Create it manually: CREATE DATABASE yonder_graph_audit;"
fi

# ──────────────────────────────────────────────────────────────
# 5. Python Virtual Environment & Dependencies
# ──────────────────────────────────────────────────────────────
info "Setting up Python virtual environment..."

if [ ! -d "venv" ]; then
    python3 -m venv venv
    success "Virtual environment created at ./venv"
else
    success "Virtual environment already exists"
fi

source venv/bin/activate
info "Installing Python dependencies from backend/requirements.txt..."
pip install --upgrade pip -q
pip install -r backend/requirements.txt -q
success "Python dependencies installed"

# ──────────────────────────────────────────────────────────────
# 6. Initialize PostgreSQL Schema (SQLAlchemy DDL)
# ──────────────────────────────────────────────────────────────
info "Initializing PostgreSQL audit schema..."
python3 -c "
from backend.database.postgres_client import init_db
init_db()
print('Schema initialized successfully')
" 2>/dev/null || warn "Schema initialization deferred — start PostgreSQL and re-run."

# ──────────────────────────────────────────────────────────────
# 7. Frontend Dependencies
# ──────────────────────────────────────────────────────────────
info "Installing frontend dependencies..."
cd frontend
npm install
cd "$SCRIPT_DIR"
success "Frontend dependencies installed"

# ──────────────────────────────────────────────────────────────
# 8. Ingest Canonical Knowledge Models
# ──────────────────────────────────────────────────────────────
info "Ingesting canonical knowledge models into Neo4j..."
python3 -m backend.ingestion.canonical_loader 2>/dev/null || \
    warn "Canonical ingestion deferred — ensure Neo4j is running and re-run: python3 -m backend.ingestion.canonical_loader"

# ──────────────────────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Yonder Graph — Local Setup Complete${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Next steps:"
echo "    1. Review .env configuration"
echo "    2. Start Neo4j:     neo4j start"
echo "    3. Run all services: ./start_all.sh"
echo ""
