"""
Yonder Graph — Application Configuration

Loads all environment variables from .env using Pydantic BaseSettings
with type validation and sensible defaults.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field

# Resolve project root (parent of backend/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = PROJECT_ROOT / "knowledge"
CANONICAL_DIR = KNOWLEDGE_DIR / "canonical"
RAW_DIR = KNOWLEDGE_DIR / "raw"
STAGING_DIR = KNOWLEDGE_DIR / "staging"
PENDING_REVIEW_DIR = STAGING_DIR / "pending_review"
ARCHIVE_DIR = KNOWLEDGE_DIR / "archive"


class Settings(BaseSettings):
    """Central configuration loaded from .env at project root."""

    # ── Application ──
    app_name: str = Field(default="Yonder Graph")
    env: str = Field(default="development")

    # ── Pluggable LLM Configuration ──
    llm_provider: str = Field(default="poolside")
    llm_model_name: str = Field(default="poolside/laguna-s-2.1")
    poolside_api_key: str = Field(default="")
    poolside_base_url: str = Field(default="https://inference.poolside.ai/v1")
    gemini_api_key: str = Field(default="")
    gemini_base_url: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta/openai/"
    )
    openai_api_key: str = Field(default="")
    openai_base_url: str = Field(default="https://api.openai.com/v1")
    anthropic_api_key: str = Field(default="")
    local_llm_base_url: str = Field(default="http://localhost:11434/v1")
    generic_llm_api_key: str = Field(default="")
    generic_llm_base_url: str = Field(default="")

    # ── Neo4j ──
    neo4j_uri: str = Field(default="bolt://localhost:7687")
    neo4j_user: str = Field(default="neo4j")
    neo4j_password: str = Field(default="password123")

    # ── PostgreSQL ──
    postgres_host: str = Field(default="localhost")
    postgres_port: int = Field(default=5432)
    postgres_db: str = Field(default="yonder_graph_audit")
    postgres_user: str = Field(default="postgres")
    postgres_password: str = Field(default="postgres")
    postgres_schema: str = Field(default="public")

    # ── Target Database Metadata ──
    target_db_type: str = Field(
        default="Oracle Database 19c/21c (Blue Yonder WMS)"
    )

    # ── Networking & Ingestion ──
    port_backend: int = Field(default=8000)
    port_frontend: int = Field(default=3000)
    poll_interval_seconds: int = Field(default=60)
    auto_ingest_confidence_threshold: float = Field(default=90.0)
    max_query_row_limit: int = Field(default=100)

    @property
    def postgres_url(self) -> str:
        """SQLAlchemy-compatible PostgreSQL connection URL."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def postgres_async_url(self) -> str:
        """Async SQLAlchemy PostgreSQL connection URL."""
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    model_config = {
        "env_file": str(PROJECT_ROOT / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


# Singleton settings instance
settings = Settings()
