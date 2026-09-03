# ──────────────────────────────────────────────────────────────
# Yonder Graph — Enterprise Cross-Platform Makefile
# Supported Platforms: macOS, Linux, Unix (FreeBSD/Solaris), Windows
# ──────────────────────────────────────────────────────────────

.PHONY: help dev start stop restart doctor check ingest test build logs clean all

# ── Platform & Python Executable Detection ──
ifeq ($(OS),Windows_NT)
    PLATFORM := windows
    ifneq ($(wildcard venv/Scripts/python.exe),)
        PYTHON ?= venv/Scripts/python.exe
    else
        PYTHON ?= python
    endif
else
    UNAME_S := $(shell uname -s 2>/dev/null || echo Unix)
    ifeq ($(UNAME_S),Darwin)
        PLATFORM := macos
    else ifeq ($(UNAME_S),Linux)
        PLATFORM := linux
    else
        PLATFORM := unix
    endif
    ifneq ($(wildcard venv/bin/python3),)
        PYTHON ?= venv/bin/python3
    else ifneq ($(wildcard venv/bin/python),)
        PYTHON ?= venv/bin/python
    else
        PYTHON ?= python3
    endif
endif

# Default Target
all: help

help:
	@$(PYTHON) manage.py help

start:
	@$(PYTHON) manage.py start

dev: start

stop:
	@$(PYTHON) manage.py stop

restart:
	@$(PYTHON) manage.py restart

doctor:
	@$(PYTHON) manage.py doctor

check: doctor

ingest:
	@$(PYTHON) manage.py ingest

test:
	@$(PYTHON) manage.py test

build:
	@$(PYTHON) manage.py build

logs:
	@$(PYTHON) manage.py logs $(SERVICE)

clean:
	@$(PYTHON) manage.py clean
