# ──────────────────────────────────────────────────────────────
# Yonder Graph — Enterprise Build & Runtime Automation Makefile
# ──────────────────────────────────────────────────────────────

.PHONY: help dev start stop restart doctor check ingest test build logs clean

# Default Target
all: help

help:
	@echo "\033[1;34m╔════════════════════════════════════════════════════════════════════════╗\033[0m"
	@echo "\033[1;34m║                  Yonder Graph — Platform Management CLI                ║\033[0m"
	@echo "\033[1;34m╚════════════════════════════════════════════════════════════════════════╝\033[0m"
	@echo ""
	@echo "\033[1;32mRuntime & Lifecycle Commands:\033[0m"
	@echo "  \033[1;36mmake start\033[0m     - Launch all background services (Postgres, Neo4j, FastAPI, Poller, Vite)"
	@echo "  \033[1;36mmake stop\033[0m      - Gracefully terminate all running services"
	@echo "  \033[1;36mmake restart\033[0m   - Fully cycle and synchronize all services with health verification"
	@echo "  \033[1;36mmake doctor\033[0m    - Run full diagnostic check on ports, DBs, Python virtualenv, and config"
	@echo ""
	@echo "\033[1;32mData & Ingestion Commands:\033[0m"
	@echo "  \033[1;36mmake ingest\033[0m    - Load canonical Inbound, Outbound, Inventory schemas & SOPs into Neo4j"
	@echo ""
	@echo "\033[1;32mDevelopment & Quality Commands:\033[0m"
	@echo "  \033[1;36mmake test\033[0m      - Execute pytest automated unit & governance tests"
	@echo "  \033[1;36mmake build\033[0m     - Compile production bundle for React / Vite frontend"
	@echo "  \033[1;36mmake logs\033[0m      - Stream live backend logs (or use: make logs SERVICE=poller)"
	@echo "  \033[1;36mmake clean\033[0m     - Remove temporary files, bytecode cache, and stale PID files"
	@echo ""

start:
	@./manage.py start

dev: start

stop:
	@./manage.py stop

restart:
	@./manage.py restart

doctor:
	@./manage.py doctor

check: doctor

ingest:
	@./manage.py ingest

test:
	@./manage.py test

build:
	@./manage.py build

logs:
	@./manage.py logs $(SERVICE)

clean:
	@echo "\033[1;33m[CLEANING TEMPORARY ASSETS]\033[0m"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@rm -rf /tmp/yonder-graph/*.pid 2>/dev/null || true
	@echo "\033[1;32m✔ Temporary cache and PID files cleaned.\033[0m"
