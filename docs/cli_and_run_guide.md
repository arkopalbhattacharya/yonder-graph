# Yonder Graph — Build & Run CLI Guide

This guide details how to develop, test, build, diagnose, and run the complete Yonder Graph platform using the unified `Makefile` and `manage.py` CLI.

---

## 🚀 Quick Start (One-Liner)

To start the entire application stack (PostgreSQL, Neo4j, FastAPI Backend, Raw Poller, and Vite Frontend):

```bash
make dev
```
*(or `./manage.py start`)*

Once started, access the interfaces:
- **Frontend Web UI**: [http://localhost:3000](http://localhost:3000)
- **FastAPI OpenAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Neo4j Browser**: [http://localhost:7474](http://localhost:7474)

---

## 📋 Complete Command Reference

### 1. System Health & Diagnostics

Before running or troubleshooting, verify all dependencies, ports, and databases with `doctor`:

```bash
make doctor
# or
./manage.py doctor
```

**Checks Performed:**
- Python 3.10+ Virtual Environment (`venv/bin/python3`)
- Node.js runtime & npm
- `.env` configuration file & API keys
- PostgreSQL service on port `5432`
- Neo4j Bolt connection on port `7687`
- FastAPI Backend on port `8000` (`/api/health`)
- Vite Frontend Dev Server on port `3000`

---

### 2. Runtime & Service Lifecycle

| Command | Description |
| :--- | :--- |
| **`make start`** (or `make dev`) | Starts all background services with dependency ordering and health check validation. |
| **`make restart`** | Gracefully stops all components, restarts PostgreSQL, Neo4j, backend, poller, and frontend, and polls `/api/health` until ready. |
| **`make stop`** | Terminates all running application processes and cleans up PID files. |
| **`make logs`** | Streams live backend logs (`/tmp/yonder-graph/backend.log`). |
| **`make logs SERVICE=poller`** | Streams live background knowledge poller logs (`/tmp/yonder-graph/poller.log`). |

---

### 3. Knowledge Ingestion & Graph Seeding

To populate or refresh the Neo4j Knowledge Graph with canonical WMS domain models (Inbound, Outbound, Inventory) and Standard Operating Procedures:

```bash
make ingest
# or
./manage.py ingest
```

This parses canonical JSON definitions in `knowledge/canonical_sops/` and builds the relational graph in Neo4j without LLM hallucination.

---

### 4. Testing & Verification

Run the automated unit, integration, and governance rule test suite:

```bash
make test
# or
./manage.py test
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
./manage.py build
```

Compiled static assets are generated in `frontend/dist/`.

---

### 6. Maintenance & Cleanup

To remove compiled Python bytecode (`__pycache__`), `.pyc` files, and stale runtime PIDs:

```bash
make clean
```
