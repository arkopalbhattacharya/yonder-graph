# Yonder Graph — Build & Run CLI Guide

This guide details how to develop, test, build, diagnose, and run the complete Yonder Graph platform across **macOS**, **Linux**, **Unix**, and **Windows** using the unified `Makefile` and `manage.py` CLI.

---

## 🚀 Quick Start (One-Liner)

To start the entire application stack (PostgreSQL, Neo4j, FastAPI Backend, Raw Poller, and Vite Frontend):

```bash
make dev
```
*(or `python manage.py dev`)*

Once started, access the interfaces:
- **Frontend Web UI**: [http://localhost:3000](http://localhost:3000)
- **FastAPI OpenAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Neo4j Browser**: [http://localhost:7474](http://localhost:7474)

---

## 💻 Cross-Platform Compatibility

The CLI is designed to run interchangeably across:
- **macOS** (Darwin / Homebrew)
- **Linux & Unix** (Ubuntu, Debian, RHEL, CentOS, FreeBSD)
- **Windows** (PowerShell, Command Prompt, Git Bash, WSL2)

On any platform with GNU `make`, type `make <target>`. If `make` is not available (such as a standard Windows installation), simply invoke `python manage.py <target>` with the exact same functionality.

---

## 📋 Complete Command Reference

### 1. System Health & Diagnostics

Before running or troubleshooting, verify all dependencies, ports, and databases with `doctor`:

```bash
make doctor
# or
python manage.py doctor
```

**Checks Performed:**
- Python 3.10+ Virtual Environment (`venv/bin/python3` or `venv\Scripts\python.exe`)
- Node.js runtime & npm
- `.env` configuration file & API keys
- PostgreSQL service on port `5432` (with OS-specific startup tips)
- Neo4j Bolt connection on port `7687` (with OS-specific startup tips)
- FastAPI Backend on port `8000` (`/api/health`)
- Vite Frontend Dev Server on port `3000`

---

### 2. Runtime & Service Lifecycle

| Command | Python Direct Command | Description |
| :--- | :--- | :--- |
| **`make start`** *(or `make dev`)* | `python manage.py dev` | Starts all background services with dependency ordering and health check validation. |
| **`make restart`** | `python manage.py restart` | Gracefully stops all components, cycles services, and polls `/api/health` until ready. |
| **`make stop`** | `python manage.py stop` | Terminates all running application processes and cleans up PID files. |
| **`make logs`** | `python manage.py logs` | Streams live backend logs (`backend.log`). |
| **`make logs SERVICE=poller`** | `python manage.py logs poller` | Streams live background knowledge poller logs (`poller.log`). |

---

### 3. Knowledge Ingestion & Graph Seeding

To populate or refresh the Neo4j Knowledge Graph with canonical WMS domain models (Inbound, Outbound, Inventory) and Standard Operating Procedures:

```bash
make ingest
# or
python manage.py ingest
```

This parses canonical JSON definitions in `knowledge/canonical_sops/` and builds the relational graph in Neo4j without LLM hallucination.

---

### 4. Testing & Verification

Run the automated unit, integration, and governance rule test suite:

```bash
make test
# or
python manage.py test
```

**Test Coverage Includes:**
- Intent classification and dual-track routing
- Tier 2 AST read-only Oracle SQL validation
- Parameter sanitization & SQL injection defense
- Tier 1 governance remediation policy engine
- Neo4j Cypher query drivers and graph schema integrity

---

### 5. Production Build

To compile the React / Vite frontend production bundle:

```bash
make build
# or
python manage.py build
```

Compiled static assets are generated in `frontend/dist/`.

---

### 6. Maintenance & Cleanup

To remove compiled Python bytecode (`__pycache__`), `.pyc` files, Vite cache, and stale runtime PIDs:

```bash
make clean
# or
python manage.py clean
```
