"""
Yonder Graph — FastAPI Application

Main entry point for the Yonder Graph backend API server.
Configures CORS, lifespan management, and router mounting.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database.neo4j_client import neo4j_client
from backend.database.postgres_client import init_db, check_connection
from backend.api.routes_triage import router as triage_router
from backend.api.routes_graph import router as graph_router
from backend.api.routes_audit import router as audit_router
from backend.api.routes_hitl import router as hitl_router
from backend.api.routes_feedback import router as feedback_router
from backend.api.routes_governance import router as governance_router
from backend.api.routes_chat import router as chat_router
from backend.api.routes_ingest import router as ingest_router
from backend.api.routes_sentinel import router as sentinel_router
from backend.api.routes_reports import router as reports_router
from backend.database.retention import purge_expired_sessions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: startup and shutdown."""
    # ── Startup ──
    logger.info("=" * 60)
    logger.info("Yonder Graph — Starting up")
    logger.info("LLM Provider: %s | Model: %s", settings.llm_provider, settings.llm_model_name)
    logger.info("=" * 60)

    # Initialize PostgreSQL schema
    try:
        init_db()
        logger.info("PostgreSQL audit schema initialized")
        # Run 7-day retention purge
        purge_result = purge_expired_sessions(days=7)
        logger.info("Chat retention status: %s", purge_result)
    except Exception as e:
        logger.warning("PostgreSQL initialization deferred: %s", e)

    # Connect to Neo4j
    try:
        neo4j_client.connect()
        logger.info("Neo4j connected: %s", settings.neo4j_uri)
    except Exception as e:
        logger.warning("Neo4j connection deferred: %s", e)

    yield

    # ── Shutdown ──
    logger.info("Yonder Graph — Shutting down")
    neo4j_client.close()


# ── Application Factory ──
app = FastAPI(
    title="Yonder Graph API",
    description=(
        "Enterprise Supply Chain IT Operations GraphRAG Platform. "
        "Powered by Blue Yonder WMS Knowledge Graph, Pluggable Multi-LLM "
        "Inference, and Two-Tier Zero-Error Governance."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS Configuration ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://localhost:{settings.port_frontend}",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Router Mounting ──
app.include_router(triage_router, prefix="/api", tags=["Triage"])
app.include_router(chat_router, tags=["Chat History"])
app.include_router(graph_router, prefix="/api/graph", tags=["Graph"])
app.include_router(audit_router, prefix="/api/audit", tags=["Audit"])
app.include_router(hitl_router, prefix="/api/hitl", tags=["HITL"])
app.include_router(feedback_router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(governance_router, prefix="/api/governance", tags=["Governance"])
app.include_router(ingest_router, prefix="/api/ingest", tags=["Ingest & Enrichment"])
app.include_router(sentinel_router, prefix="/api/sentinel", tags=["Sentinel"])
app.include_router(reports_router, prefix="/api", tags=["Reports & Executive ROI"])


@app.get("/api/health", tags=["Health"])
def health_check():
    """System health check endpoint."""
    pg_ok = False
    try:
        pg_ok = check_connection()
    except Exception:
        pass

    neo4j_ok = False
    try:
        neo4j_client.execute_read("RETURN 1 AS ok")
        neo4j_ok = True
    except Exception:
        pass

    from backend.inference.llm_provider import LLMProviderFactory

    return {
        "status": "healthy" if (pg_ok and neo4j_ok) else "degraded",
        "services": {
            "postgresql": "connected" if pg_ok else "disconnected",
            "neo4j": "connected" if neo4j_ok else "disconnected",
        },
        "llm_provider": LLMProviderFactory.get_provider_info(),
        "app_name": settings.app_name,
        "environment": settings.env,
    }
