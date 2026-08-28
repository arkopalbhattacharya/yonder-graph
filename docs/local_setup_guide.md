# Local Setup Guide

Yonder Graph is designed to run natively on your machine without Docker, maximizing local performance and access to host network resources.

## Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Neo4j Desktop or Server (running locally on port 7687)
- PostgreSQL (running locally on port 5432)

## 1. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your specific credentials:
```bash
# LLM Provider Configuration
LLM_PROVIDER=poolside
LLM_MODEL_NAME=poolside-laguna-s-2.1
POOLSIDE_API_KEY=your_key_here

# Database Configurations
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

POSTGRES_URL=postgresql://user:password@localhost:5432/yonder_audit
```

## 2. Automated Setup

Run the automated setup script to create virtual environments, install dependencies, and initialize directories:

```bash
chmod +x setup_local.sh
./setup_local.sh
```

## 3. Starting the Services

You can start the entire platform (PostgreSQL, Neo4j, FastAPI, Raw Poller, and Vite Frontend) using a single command:

```bash
make dev
# or make start
```

This will automatically:
- Verify PostgreSQL and Neo4j connectivity
- Launch FastAPI Backend on `http://localhost:8000`
- Launch React Frontend on `http://localhost:3000`
- Launch the Raw Knowledge Poller background worker
- Confirm service health

## 4. Stopping & Restarting Services

```bash
# Clean stop of all components
make stop

# Full synchronized restart
make restart
```

## 5. Ingesting Initial Data

To populate Neo4j with authoritative Blue Yonder WMS domain models (Inbound, Outbound, Inventory) and standard operating procedures:

```bash
make ingest
```

## 6. System Diagnostics & Health Check

To verify your environment, ports, and database services at any time:

```bash
make doctor
```

