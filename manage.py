#!/usr/bin/env python3
"""
Yonder Graph — Unified Management CLI

Provides single-command control for:
  - System Health & Diagnostics (doctor / check)
  - Full Stack Startup & Lifecycle (start / stop / restart / dev)
  - Knowledge Ingestion & Graph Seeding (ingest)
  - Automated Governance & Unit Testing (test)
  - Frontend Production Build (build)
  - Live Log Streaming (logs)
"""

import sys
import os
import subprocess
import time
import socket
import argparse
import urllib.request
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
PID_DIR = Path("/tmp/yonder-graph")
VENV_PYTHON = ROOT_DIR / "venv" / "bin" / "python3"
VENV_PIP = ROOT_DIR / "venv" / "bin" / "pip"

# Colors
GREEN = "\033[92m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_banner():
    print(f"\n{BLUE}{BOLD}══════════════════════════════════════════════════════════════{RESET}")
    print(f"{BLUE}{BOLD}  Yonder Graph — Enterprise GraphRAG Platform Manager{RESET}")
    print(f"{BLUE}{BOLD}══════════════════════════════════════════════════════════════{RESET}\n")


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def run_cmd(cmd: list, cwd: Path = ROOT_DIR, check: bool = True, capture: bool = False):
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        check=check,
        capture_output=capture,
        text=True,
    )


def cmd_doctor():
    """Verify system prerequisites, database connectivity, and environment."""
    print(f"{BOLD}[CHECKING PREREQUISITES & SERVICES]{RESET}\n")
    all_ok = True

    # 1. Check Python virtualenv
    if VENV_PYTHON.exists():
        print(f"  {GREEN}✔{RESET} Python virtualenv: {VENV_PYTHON}")
    else:
        print(f"  {RED}✘{RESET} Python virtualenv missing at {VENV_PYTHON}")
        all_ok = False

    # 2. Check Node & npm
    try:
        node_ver = run_cmd(["node", "--version"], capture=True).stdout.strip()
        print(f"  {GREEN}✔{RESET} Node.js: {node_ver}")
    except Exception:
        print(f"  {RED}✘{RESET} Node.js not found in PATH")
        all_ok = False

    # 3. Check .env
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        print(f"  {GREEN}✔{RESET} Environment file (.env) present")
    else:
        print(f"  {YELLOW}⚠{RESET} .env file missing (using defaults)")

    # 4. Check PostgreSQL
    pg_running = is_port_in_use(5432)
    if pg_running:
        print(f"  {GREEN}✔{RESET} PostgreSQL: Online (port 5432)")
    else:
        print(f"  {RED}✘{RESET} PostgreSQL: Offline on port 5432 (run: brew services start postgresql)")
        all_ok = False

    # 5. Check Neo4j
    neo4j_running = is_port_in_use(7687)
    if neo4j_running:
        print(f"  {GREEN}✔{RESET} Neo4j Bolt: Online (port 7687)")
    else:
        print(f"  {RED}✘{RESET} Neo4j: Offline on port 7687 (run: neo4j start)")
        all_ok = False

    # 6. Check Backend API
    backend_running = is_port_in_use(8000)
    if backend_running:
        try:
            req = urllib.request.Request("http://127.0.0.1:8000/api/health")
            with urllib.request.urlopen(req, timeout=1.0) as res:
                data = json.loads(res.read().decode())
                print(f"  {GREEN}✔{RESET} FastAPI Backend: Online & Healthy (Status: {data.get('status')})")
        except Exception:
            print(f"  {YELLOW}⚠{RESET} FastAPI Backend: Port 8000 open but health check pending")
    else:
        print(f"  {YELLOW}○{RESET} FastAPI Backend: Stopped (port 8000)")

    # 7. Check Frontend Dev Server
    frontend_running = is_port_in_use(3000)
    if frontend_running:
        print(f"  {GREEN}✔{RESET} Vite Frontend: Online (http://localhost:3000)")
    else:
        print(f"  {YELLOW}○{RESET} Vite Frontend: Stopped (port 3000)")

    print("")
    if all_ok:
        print(f"{GREEN}{BOLD}All foundational prerequisites satisfied!{RESET}\n")
    else:
        print(f"{YELLOW}{BOLD}Please address the items marked with ✘ above.{RESET}\n")


def cmd_clean():
    """Clean all caches, bytecode, temporary assets, and stale PID files."""
    print(f"{YELLOW}[CLEANING SYSTEM CACHES & TEMP ASSETS]{RESET}")
    
    # Clean Python __pycache__ and *.pyc
    for p in ROOT_DIR.rglob("__pycache__"):
        try:
            import shutil
            shutil.rmtree(p)
        except Exception:
            pass
            
    for f in ROOT_DIR.rglob("*.pyc"):
        try:
            f.unlink()
        except Exception:
            pass

    # Clean Vite cache
    vite_cache = ROOT_DIR / "frontend" / "node_modules" / ".vite"
    if vite_cache.exists():
        try:
            import shutil
            shutil.rmtree(vite_cache)
        except Exception:
            pass

    # Clean stale PID files
    if PID_DIR.exists():
        for pidfile in PID_DIR.glob("*.pid"):
            try:
                pidfile.unlink()
            except Exception:
                pass

    print(f"{GREEN}✔ Cache & temporary files purged successfully.{RESET}\n")


def cmd_start():
    """Start all background services with pre-cleaned cache."""
    cmd_clean()
    print(f"{BLUE}[STARTING YONDER GRAPH SYSTEM]{RESET}\n")
    run_cmd(["bash", "./start_all.sh"])


def cmd_stop():
    """Stop all managed background services."""
    print(f"{YELLOW}[STOPPING ALL SERVICES]{RESET}\n")
    run_cmd(["bash", "./stop_all.sh"])


def cmd_restart():
    """Perform a clean system-wide restart with pre-cleaned cache."""
    cmd_clean()
    print(f"{BLUE}[RESTARTING ALL SERVICES]{RESET}\n")
    run_cmd(["bash", "./restart_all.sh"])


def cmd_ingest():
    """Run canonical WMS schema and SOP knowledge ingestion into Neo4j."""
    print(f"{BLUE}[RUNNING CANONICAL KNOWLEDGE INGESTION]{RESET}\n")
    python_bin = str(VENV_PYTHON) if VENV_PYTHON.exists() else "python3"
    run_cmd([python_bin, "-m", "backend.ingestion.canonical_loader"])
    print(f"\n{GREEN}✔ Canonical knowledge successfully ingested into Neo4j!{RESET}\n")


def cmd_test():
    """Run automated unit and governance test suite."""
    print(f"{BLUE}[RUNNING AUTOMATED TEST SUITE]{RESET}\n")
    python_bin = str(VENV_PYTHON) if VENV_PYTHON.exists() else "python3"
    try:
        run_cmd([python_bin, "-m", "pytest", "-v"])
        print(f"\n{GREEN}✔ All tests passed successfully!{RESET}\n")
    except Exception as e:
        print(f"\n{RED}✘ Tests exited with errors: {e}{RESET}\n")


def cmd_build():
    """Compile frontend production bundle with pre-cleaned cache."""
    cmd_clean()
    print(f"{BLUE}[BUILDING PRODUCTION FRONTEND BUNDLE]{RESET}\n")
    run_cmd(["npm", "run", "build"], cwd=ROOT_DIR / "frontend")
    print(f"\n{GREEN}✔ Production build complete in frontend/dist!{RESET}\n")


def cmd_logs(service: str = "backend"):
    """Tail logs for backend, poller, or frontend."""
    log_file = PID_DIR / f"{service}.log"
    if not log_file.exists():
        print(f"{YELLOW}Log file {log_file} does not exist yet.{RESET}")
        return
    print(f"{BLUE}[TAILING {service.upper()} LOGS — Ctrl+C to exit]{RESET}\n")
    try:
        subprocess.run(["tail", "-f", str(log_file)])
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Stopped tailing logs.{RESET}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Yonder Graph — Enterprise GraphRAG Platform Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="Available Commands")

    subparsers.add_parser("doctor", help="Run system diagnostics & verify dependencies")
    subparsers.add_parser("check", help="Alias for doctor")
    subparsers.add_parser("start", help="Start all background services (PostgreSQL, Neo4j, Backend, Poller, Frontend)")
    subparsers.add_parser("stop", help="Stop all background services")
    subparsers.add_parser("restart", help="Cleanly cycle and verify all services")
    subparsers.add_parser("ingest", help="Ingest canonical schemas and SOPs into Neo4j")
    subparsers.add_parser("test", help="Execute automated test suite")
    subparsers.add_parser("build", help="Build frontend production bundle")

    logs_parser = subparsers.add_parser("logs", help="Stream service logs")
    logs_parser.add_argument(
        "service",
        nargs="?",
        default="backend",
        choices=["backend", "poller", "frontend"],
        help="Service log to stream (default: backend)",
    )

    args = parser.parse_args()

    print_banner()

    if args.command in ("doctor", "check"):
        cmd_doctor()
    elif args.command == "start":
        cmd_start()
    elif args.command == "stop":
        cmd_stop()
    elif args.command == "restart":
        cmd_restart()
    elif args.command == "ingest":
        cmd_ingest()
    elif args.command == "test":
        cmd_test()
    elif args.command == "build":
        cmd_build()
    elif args.command == "logs":
        cmd_logs(args.service)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
