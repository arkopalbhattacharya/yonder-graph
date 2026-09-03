#!/usr/bin/env python3
"""
Yonder Graph — Enterprise Cross-Platform Management CLI

Provides unified, single-command control across macOS, Linux, Unix, and Windows for:
  - System Health & Diagnostics (doctor / check)
  - Full Stack Startup & Lifecycle (start / stop / restart / dev)
  - Knowledge Ingestion & Graph Seeding (ingest)
  - Automated Governance & Unit Testing (test)
  - Frontend Production Build (build)
  - Live Log Streaming (logs)
  - Cache & PID Cleanup (clean)
"""

import sys
import os
import platform
import subprocess
import time
import socket
import argparse
import urllib.request
import json
import shutil
import tempfile
import signal
from pathlib import Path

# OS Identification
IS_WINDOWS = os.name == "nt"
IS_MACOS = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"

# Enable ANSI escape sequences in Windows Command Prompt if needed
if IS_WINDOWS:
    os.system("")

ROOT_DIR = Path(__file__).resolve().parent

# Cross-platform runtime directories
if IS_WINDOWS:
    PID_DIR = Path(tempfile.gettempdir()) / "yonder-graph"
else:
    PID_DIR = Path("/tmp/yonder-graph")
PID_DIR.mkdir(parents=True, exist_ok=True)

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


def get_python_bin() -> str:
    """Resolve virtual environment Python executable with fallback to system Python."""
    if IS_WINDOWS:
        for candidate in [
            ROOT_DIR / "venv" / "Scripts" / "python.exe",
            ROOT_DIR / "venv" / "python.exe",
        ]:
            if candidate.exists():
                return str(candidate)
    else:
        for candidate in [
            ROOT_DIR / "venv" / "bin" / "python3",
            ROOT_DIR / "venv" / "bin" / "python",
        ]:
            if candidate.exists():
                return str(candidate)
    return sys.executable


def get_npm_cmd() -> list:
    """Resolve npm executable across Unix and Windows."""
    if IS_WINDOWS:
        npm_path = shutil.which("npm.cmd") or shutil.which("npm")
        return [npm_path or "npm"]
    return ["npm"]


def get_npx_cmd() -> list:
    """Resolve npx executable across Unix and Windows."""
    if IS_WINDOWS:
        npx_path = shutil.which("npx.cmd") or shutil.which("npx")
        return [npx_path or "npx"]
    return ["npx"]


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Check whether a TCP port is currently occupied."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def free_port(port: int):
    """Attempt to terminate any process holding a specific port."""
    if IS_WINDOWS:
        try:
            out = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True,
                text=True,
                check=False,
            ).stdout
            for line in out.splitlines():
                if f":{port}" in line and "LISTENING" in line:
                    parts = line.strip().split()
                    pid = parts[-1]
                    if pid and pid != "0":
                        subprocess.run(
                            ["taskkill", "/F", "/PID", pid],
                            capture_output=True,
                            check=False,
                        )
        except Exception:
            pass
    else:
        if shutil.which("lsof"):
            try:
                out = subprocess.run(
                    ["lsof", "-ti", f":{port}"],
                    capture_output=True,
                    text=True,
                    check=False,
                ).stdout.strip()
                if out:
                    for pid in out.split():
                        subprocess.run(["kill", "-9", pid], capture_output=True, check=False)
            except Exception:
                pass


def run_cmd(cmd: list, cwd: Path = ROOT_DIR, check: bool = True, capture: bool = False, env: dict = None):
    """Execute a subprocess command with cross-platform shell resolution."""
    use_shell = IS_WINDOWS and (
        cmd[0] in ("npm", "npx", "neo4j")
        or cmd[0].endswith(".cmd")
        or cmd[0].endswith(".bat")
    )
    run_env = os.environ.copy()
    if env:
        run_env.update(env)
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        check=check,
        capture_output=capture,
        text=True,
        shell=use_shell,
        env=run_env,
    )


def cmd_doctor():
    """Verify system prerequisites, database connectivity, and environment."""
    os_name = "Windows" if IS_WINDOWS else ("macOS" if IS_MACOS else ("Linux" if IS_LINUX else "Unix"))
    print(f"{BOLD}[CHECKING PREREQUISITES & SERVICES — {os_name.upper()}]{RESET}\n")
    all_ok = True

    # 0. Display OS
    print(f"  {BLUE}ℹ{RESET} OS Environment: {platform.system()} ({platform.release()}) [{platform.machine()}]")

    # 1. Check Python virtualenv
    py_bin = get_python_bin()
    if Path(py_bin).exists() and "venv" in py_bin:
        print(f"  {GREEN}✔{RESET} Python virtualenv: {py_bin}")
    else:
        print(f"  {YELLOW}⚠{RESET} Using system Python: {py_bin} (recommended: ./setup_local.sh or python -m venv venv)")

    # 2. Check Node & npm
    try:
        node_ver = run_cmd(["node", "--version"], capture=True).stdout.strip()
        print(f"  {GREEN}✔{RESET} Node.js: {node_ver}")
    except Exception:
        print(f"  {RED}✘{RESET} Node.js not found in PATH")
        all_ok = False

    try:
        npm_ver = run_cmd(get_npm_cmd() + ["--version"], capture=True).stdout.strip()
        print(f"  {GREEN}✔{RESET} npm: v{npm_ver}")
    except Exception:
        print(f"  {RED}✘{RESET} npm not found in PATH")
        all_ok = False

    # 3. Check .env
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        print(f"  {GREEN}✔{RESET} Environment file (.env) present")
    else:
        print(f"  {YELLOW}⚠{RESET} .env file missing (using defaults or .env.example)")

    # 4. Check PostgreSQL
    pg_running = is_port_in_use(5432)
    if pg_running:
        print(f"  {GREEN}✔{RESET} PostgreSQL: Online (port 5432)")
    else:
        if IS_MACOS:
            hint = "run: brew services start postgresql"
        elif IS_WINDOWS:
            hint = "start service in services.msc or: net start postgresql-x64-16"
        else:
            hint = "run: sudo systemctl start postgresql"
        print(f"  {RED}✘{RESET} PostgreSQL: Offline on port 5432 ({hint})")
        all_ok = False

    # 5. Check Neo4j
    neo4j_running = is_port_in_use(7687)
    if neo4j_running:
        print(f"  {GREEN}✔{RESET} Neo4j Bolt: Online (port 7687)")
    else:
        if IS_WINDOWS:
            hint = "run: neo4j.bat console or launch Neo4j Desktop"
        else:
            hint = "run: neo4j start"
        print(f"  {RED}✘{RESET} Neo4j: Offline on port 7687 ({hint})")
        all_ok = False

    # 6. Check Backend API
    backend_running = is_port_in_use(8000)
    if backend_running:
        try:
            req = urllib.request.Request("http://127.0.0.1:8000/api/health")
            with urllib.request.urlopen(req, timeout=1.5) as res:
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
            shutil.rmtree(p, ignore_errors=True)
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
            shutil.rmtree(vite_cache, ignore_errors=True)
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


def _start_windows_services(port_backend: int = 8000, port_frontend: int = 3000):
    """Native Python background launcher for Windows environments."""
    python_bin = get_python_bin()

    # 1. Check PostgreSQL
    if not is_port_in_use(5432):
        print(f"  {YELLOW}⚠{RESET} PostgreSQL not detected on port 5432. Attempting service startup...")
        subprocess.run(["net", "start", "postgresql-x64-16"], capture_output=True, check=False)

    # 2. Check Neo4j
    if not is_port_in_use(7687):
        print(f"  {YELLOW}⚠{RESET} Neo4j not detected on port 7687. Attempting neo4j start...")
        subprocess.run(["neo4j.bat", "start"], capture_output=True, shell=True, check=False)

    # 3. Launch FastAPI Backend
    print(f"  {BLUE}▶{RESET} Starting FastAPI backend on port {port_backend}...")
    backend_log = (PID_DIR / "backend.log").open("a", encoding="utf-8")
    backend_proc = subprocess.Popen(
        [python_bin, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", str(port_backend), "--reload"],
        cwd=str(ROOT_DIR),
        stdout=backend_log,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )
    (PID_DIR / "backend.pid").write_text(str(backend_proc.pid))
    print(f"    {GREEN}✔{RESET} Backend launched (PID: {backend_proc.pid})")

    # 4. Launch Raw Poller
    print(f"  {BLUE}▶{RESET} Starting raw knowledge poller...")
    poller_log = (PID_DIR / "poller.log").open("a", encoding="utf-8")
    poller_proc = subprocess.Popen(
        [python_bin, "-m", "backend.ingestion.raw_poller"],
        cwd=str(ROOT_DIR),
        stdout=poller_log,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )
    (PID_DIR / "poller.pid").write_text(str(poller_proc.pid))
    print(f"    {GREEN}✔{RESET} Raw Poller launched (PID: {poller_proc.pid})")

    # 5. Launch Vite Frontend
    print(f"  {BLUE}▶{RESET} Starting Vite frontend dev server on port {port_frontend}...")
    frontend_log = (PID_DIR / "frontend.log").open("a", encoding="utf-8")
    npm_cmd = get_npm_cmd()
    frontend_proc = subprocess.Popen(
        npm_cmd + ["run", "dev"],
        cwd=str(ROOT_DIR / "frontend"),
        stdout=frontend_log,
        stderr=subprocess.STDOUT,
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )
    (PID_DIR / "frontend.pid").write_text(str(frontend_proc.pid))
    print(f"    {GREEN}✔{RESET} Frontend launched (PID: {frontend_proc.pid})")


def cmd_start():
    """Start all background services across all platforms."""
    cmd_clean()
    print(f"{BLUE}[STARTING YONDER GRAPH SYSTEM]{RESET}\n")

    # If on POSIX and start_all.sh exists, use native bash script
    if not IS_WINDOWS and (ROOT_DIR / "start_all.sh").exists() and shutil.which("bash"):
        run_cmd(["bash", "./start_all.sh"])
    else:
        # Load environment variables
        env_file = ROOT_DIR / ".env"
        port_backend = 8000
        port_frontend = 3000
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("PORT_BACKEND="):
                    try:
                        port_backend = int(line.split("=", 1)[1].strip().strip('"').strip("'"))
                    except Exception:
                        pass
                elif line.startswith("PORT_FRONTEND="):
                    try:
                        port_frontend = int(line.split("=", 1)[1].strip().strip('"').strip("'"))
                    except Exception:
                        pass

        _start_windows_services(port_backend, port_frontend)
        print(f"\n{GREEN}══════════════════════════════════════════════════════════════{RESET}")
        print(f"{GREEN}  Yonder Graph — All Services Running{RESET}")
        print(f"{GREEN}══════════════════════════════════════════════════════════════{RESET}\n")
        print(f"  Backend API:   http://localhost:{port_backend}/docs")
        print(f"  Frontend UI:   http://localhost:{port_frontend}")
        print(f"  Neo4j Browser: http://localhost:7474")
        print(f"  PID Directory: {PID_DIR}\n")


def cmd_stop():
    """Stop all managed background services."""
    print(f"{YELLOW}[STOPPING ALL SERVICES]{RESET}\n")

    if not IS_WINDOWS and (ROOT_DIR / "stop_all.sh").exists() and shutil.which("bash"):
        run_cmd(["bash", "./stop_all.sh"])
    else:
        for service in ["frontend", "poller", "backend"]:
            pidfile = PID_DIR / f"{service}.pid"
            if pidfile.exists():
                try:
                    pid = int(pidfile.read_text().strip())
                    if IS_WINDOWS:
                        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, check=False)
                    else:
                        os.kill(pid, signal.SIGTERM)
                    print(f"  {GREEN}[STOP]{RESET} {service} (PID {pid}) terminated")
                except Exception as e:
                    print(f"  {YELLOW}[SKIP]{RESET} {service} was not active ({e})")
                try:
                    pidfile.unlink()
                except Exception:
                    pass

        # Free ports 8000 and 3000
        free_port(8000)
        free_port(3000)

        # Stop Neo4j
        if IS_WINDOWS:
            subprocess.run(["neo4j.bat", "stop"], capture_output=True, shell=True, check=False)
        else:
            subprocess.run(["neo4j", "stop"], capture_output=True, check=False)

        print(f"\n{GREEN}✔ All Yonder Graph services stopped successfully.{RESET}\n")


def cmd_restart():
    """Perform a clean system-wide restart with health verification."""
    if not IS_WINDOWS and (ROOT_DIR / "restart_all.sh").exists() and shutil.which("bash"):
        cmd_clean()
        print(f"{BLUE}[RESTARTING ALL SERVICES]{RESET}\n")
        run_cmd(["bash", "./restart_all.sh"])
    else:
        cmd_stop()
        time.sleep(1.5)
        cmd_start()

        # Health check validation
        print(f"\n{BLUE}[CHECK]{RESET} Waiting for backend to become healthy on http://127.0.0.1:8000/api/health...")
        healthy = False
        for _ in range(30):
            try:
                req = urllib.request.Request("http://127.0.0.1:8000/api/health")
                with urllib.request.urlopen(req, timeout=1.0) as res:
                    if res.status == 200:
                        healthy = True
                        break
            except Exception:
                pass
            time.sleep(0.5)

        if healthy:
            print(f"  {GREEN}[OK]{RESET} All services synchronized, healthy, and ready!\n")
        else:
            print(f"  {YELLOW}[WARN]{RESET} Backend pending response. Check {PID_DIR}/backend.log\n")


def cmd_ingest():
    """Run canonical WMS schema and SOP knowledge ingestion into Neo4j."""
    print(f"{BLUE}[RUNNING CANONICAL KNOWLEDGE INGESTION]{RESET}\n")
    python_bin = get_python_bin()
    run_cmd([python_bin, "-m", "backend.ingestion.canonical_loader"])
    print(f"\n{GREEN}✔ Canonical knowledge successfully ingested into Neo4j!{RESET}\n")


def cmd_test():
    """Run automated unit and governance test suite."""
    print(f"{BLUE}[RUNNING AUTOMATED TEST SUITE]{RESET}\n")
    python_bin = get_python_bin()
    try:
        # Check if pytest is available; if not, use standard library unittest discover
        pytest_check = subprocess.run(
            [python_bin, "-m", "pytest", "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
        if pytest_check.returncode == 0:
            run_cmd([python_bin, "-m", "pytest", "-v"])
        else:
            run_cmd([python_bin, "-m", "unittest", "discover", "-s", "backend/tests", "-v"])
        print(f"\n{GREEN}✔ All tests executed successfully!{RESET}\n")
    except Exception as e:
        print(f"\n{RED}✘ Tests exited with errors: {e}{RESET}\n")


def cmd_build():
    """Compile frontend production bundle with pre-cleaned cache."""
    cmd_clean()
    print(f"{BLUE}[BUILDING PRODUCTION FRONTEND BUNDLE]{RESET}\n")
    run_cmd(get_npm_cmd() + ["run", "build"], cwd=ROOT_DIR / "frontend")
    print(f"\n{GREEN}✔ Production build complete in frontend/dist!{RESET}\n")


def cmd_logs(service: str = "backend"):
    """Tail logs for backend, poller, or frontend cross-platform."""
    log_file = PID_DIR / f"{service}.log"
    if not log_file.exists():
        print(f"{YELLOW}Log file {log_file} does not exist yet.{RESET}")
        return

    print(f"{BLUE}[TAILING {service.upper()} LOGS — Ctrl+C to exit]{RESET}\n")

    if not IS_WINDOWS and shutil.which("tail"):
        try:
            subprocess.run(["tail", "-f", str(log_file)])
        except KeyboardInterrupt:
            print(f"\n{YELLOW}Stopped tailing logs.{RESET}\n")
    else:
        # Cross-platform continuous Python log tailer
        try:
            with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                # Seek to end of file
                f.seek(0, os.SEEK_END)
                while True:
                    line = f.readline()
                    if line:
                        sys.stdout.write(line)
                        sys.stdout.flush()
                    else:
                        time.sleep(0.5)
        except KeyboardInterrupt:
            print(f"\n{YELLOW}Stopped tailing logs.{RESET}\n")


def print_help():
    """Display standardized, beautifully formatted command reference."""
    print_banner()
    print(f"{GREEN}Available Commands (Run via 'make <command>' or 'python manage.py <command>'):{RESET}\n")
    commands = [
        ("doctor / check", "Run full diagnostic check on ports, databases, Python venv, and .env config"),
        ("start / dev",    "Start all background services (PostgreSQL, Neo4j, FastAPI, Poller, Vite)"),
        ("stop",           "Gracefully terminate all running services and free bound ports"),
        ("restart",        "Synchronized stop, restart, and health check validation of all services"),
        ("ingest",         "Seed canonical Inbound, Outbound, Inventory schemas & SOPs into Neo4j"),
        ("test",           "Execute automated unit, integration, and governance test suite"),
        ("build",          "Compile production frontend bundle into frontend/dist/"),
        ("logs [SERVICE]", "Stream live logs (e.g., make logs or make logs SERVICE=poller)"),
        ("clean",          "Remove temporary files, bytecode cache, Vite cache, and stale PID files"),
    ]
    for cmd, desc in commands:
        print(f"  {BLUE}{cmd:<18}{RESET} - {desc}")
    print("\nSupported Environments: macOS, Linux, Unix, and Windows\n")


def main():
    parser = argparse.ArgumentParser(
        description="Yonder Graph — Enterprise GraphRAG Platform Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,
    )
    parser.add_argument("command", nargs="?", default="help", help="Command to execute")
    parser.add_argument("service", nargs="?", default="backend", help="Service name for logs")
    parser.add_argument("-h", "--help", action="store_true", help="Show help message")

    args, unknown = parser.parse_known_args()

    if args.help or args.command in ("help", "--help", "-h"):
        print_help()
        return

    print_banner()

    cmd = args.command.lower()
    if cmd in ("doctor", "check"):
        cmd_doctor()
    elif cmd in ("start", "dev"):
        cmd_start()
    elif cmd == "stop":
        cmd_stop()
    elif cmd == "restart":
        cmd_restart()
    elif cmd == "ingest":
        cmd_ingest()
    elif cmd == "test":
        cmd_test()
    elif cmd == "build":
        cmd_build()
    elif cmd == "logs":
        cmd_logs(args.service)
    elif cmd == "clean":
        cmd_clean()
    else:
        print(f"{RED}Unknown command: '{cmd}'{RESET}\n")
        print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
