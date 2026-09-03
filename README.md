# Yonder Graph

**Enterprise-Grade Supply Chain IT Operations GraphRAG Platform**

Yonder Graph provides automated, deterministic triage, GraphRAG process flow modeling, and multi-agent incident diagnosis for Blue Yonder WMS operations backed by Oracle Database.

---

## ⚡ Quick Start

The platform management commands are **identical across all operating systems** (macOS, Linux, Unix, and Windows). You can use either GNU `make` or the unified Python manager (`python manage.py`):

```bash
# 1. Run diagnostic doctor to verify local prerequisites & database ports
make doctor
# (or: python manage.py doctor)

# 2. Ingest canonical knowledge models and SOP runbooks into Neo4j
make ingest
# (or: python manage.py ingest)

# 3. Start all background services (PostgreSQL, Neo4j, FastAPI Backend, Poller, Frontend)
make dev
# (or: python manage.py dev)
```

### Access URLs
- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Neo4j Browser**: [http://localhost:7474](http://localhost:7474)

---

## 💻 Environment-Specific Setup & Running

Yonder Graph dynamically detects your operating system and automatically adapts Python interpreter paths, background process launchers, service tailers, and directory conventions.

### 🍏 macOS
- **Prerequisites**:
  ```bash
  brew install openjdk@21 neo4j postgresql@16 node python@3.11
  brew services start postgresql@16
  neo4j start
  ```
- **Execution**:
  ```bash
  make doctor
  make dev
  make stop
  ```

### 🐧 Linux & Unix (Ubuntu / Debian / RHEL / FreeBSD)
- **Prerequisites** (Ubuntu / Debian):
  ```bash
  sudo apt-get update && sudo apt-get install -y \
      openjdk-21-jdk neo4j postgresql-16 python3 python3-venv python3-pip nodejs npm make
  sudo systemctl start postgresql
  neo4j start
  ```
- **Execution**:
  ```bash
  make doctor
  make dev
  make stop
  ```

### 🪟 Windows (PowerShell, Command Prompt, Git Bash, or WSL2)
- **Prerequisites**:
  - Install **Python 3.10+** (ensure `python` is added to your `PATH`).
  - Install **Node.js 18+** & npm.
  - Install **PostgreSQL 16 for Windows** (start via Windows Services or `net start postgresql-x64-16`).
  - Install **Neo4j Desktop** or Neo4j Community (start via Neo4j Desktop or `neo4j.bat start`).
  - *(Optional)* Install `make` via Winget (`winget install ezwinports.make`), Chocolatey (`choco install make`), or Scoop (`scoop install make`).
- **Execution via `make`** (PowerShell / CMD / Git Bash):
  ```powershell
  make doctor
  make dev
  make stop
  ```
- **Execution via Native Python** (No `make` required):
  If `make` is not installed on your Windows machine, all commands run with identical functionality via `python manage.py`:
  ```powershell
  python manage.py doctor
  python manage.py dev
  python manage.py ingest
  python manage.py test
  python manage.py build
  python manage.py stop
  ```

---

## 🛠️ Universal Management CLI Commands

Every command below functions identically across **macOS**, **Linux**, **Unix**, and **Windows**:

| `make` Command | Python Direct Command | Action / Description |
| :--- | :--- | :--- |
| `make doctor` | `python manage.py doctor` | Validates ports 5432, 7687, 8000, 3000, Python venv, and `.env` config with OS-tailored resolution hints. |
| `make start` *(or `make dev`)* | `python manage.py dev` | Launches all background services (Postgres, Neo4j, FastAPI, Poller, Vite) with health validation. |
| `make stop` | `python manage.py stop` | Gracefully terminates all background services and frees ports 8000/3000. |
| `make restart` | `python manage.py restart` | Fully cycles all services, purges stale cache/PIDs, and polls `/api/health` until ready. |
| `make ingest` | `python manage.py ingest` | Seeds Inbound, Outbound, and Inventory schemas & canonical SOPs into Neo4j. |
| `make test` | `python manage.py test` | Executes automated unit, integration, and governance test suite (pytest / unittest). |
| `make build` | `python manage.py build` | Compiles production React / Vite frontend bundle into `frontend/dist/`. |
| `make logs` | `python manage.py logs [SERVICE]` | Live streams service logs (`make logs` for backend, `make logs SERVICE=poller` for poller). |
| `make clean` | `python manage.py clean` | Cross-platform cleanup of `__pycache__`, `*.pyc`, `.vite` cache, and runtime PID files. |
| `make help` | `python manage.py help` | Displays the interactive CLI command reference and options. |

For detailed architectural and runtime documentation, see [docs/cli_and_run_guide.md](docs/cli_and_run_guide.md).

---

## 🏗️ Architecture Overview

- **Google ADK Intent Classification**: Dual-track dispatch between General Process Guides and Governed Incident Triage.
- **Two-Tier Governance Gatekeeper**:
  - **Tier 1 (Cognitive)**: Graduated four-tier remediation policy engine (MOCA → UI → Governed Patch → Dual Control).
  - **Tier 2 (Deterministic)**: AST Oracle SQL Validator with forced `ROWNUM <= 100` read-only enforcement.
- **Pluggable LLM Provider Layer**: Unified abstraction supporting LiteLLM, OpenAI, and local backends with zero code changes.
- **Multi-Modal UI**: Interactive knowledge graph explorer, live agent telemetry dashboard, and mermaid process flowcharts.
