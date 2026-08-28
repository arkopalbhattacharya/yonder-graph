# Yonder Graph

**Enterprise-Grade Supply Chain IT Operations GraphRAG Platform**

Yonder Graph provides automated, deterministic triage, GraphRAG process flow modeling, and multi-agent incident diagnosis for Blue Yonder WMS operations backed by Oracle Database.

---

## ⚡ Quick Start

```bash
# 1. Run diagnostic doctor to verify local prerequisites
make doctor

# 2. Ingest canonical knowledge into Neo4j
make ingest

# 3. Start all services (PostgreSQL, Neo4j, Backend, Poller, Frontend)
make dev
```

### Access URLs
- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Neo4j Browser**: [http://localhost:7474](http://localhost:7474)

---

## 🛠️ Management CLI Commands

| Command | Action |
| :--- | :--- |
| `make doctor` | Validates ports 5432, 7687, 8000, 3000, Python venv, and `.env` config |
| `make start` | Starts all background services with health validation |
| `make stop` | Cleanly stops all running services |
| `make restart` | Full synchronized restart of all services |
| `make ingest` | Loads Inbound, Outbound, and Inventory schemas into Neo4j |
| `make test` | Executes automated pytest test suite |
| `make build` | Builds production frontend bundle in `frontend/dist/` |
| `make logs` | Tails live backend logs (`make logs SERVICE=poller` for poller) |
| `make clean` | Removes `__pycache__` and temporary PID files |

For detailed documentation, see [docs/cli_and_run_guide.md](docs/cli_and_run_guide.md).

---

## 🏗️ Architecture Overview

- **Google ADK Intent Classification**: Dual-track dispatch between General Process Guides and Governed Incident Triage.
- **Two-Tier Governance Gatekeeper**:
  - **Tier 1 (Cognitive)**: Graduated four-tier remediation policy engine (MOCA → UI → Governed Patch → Dual Control).
  - **Tier 2 (Deterministic)**: AST Oracle SQL Validator with forced `ROWNUM <= 100` read-only enforcement.
- **Pluggable LLM Provider Layer**: Unified abstraction supporting LiteLLM, OpenAI, and local backends with zero code changes.
- **Multi-Modal UI**: Interactive knowledge graph explorer, live agent telemetry dashboard, and mermaid process flowcharts.
