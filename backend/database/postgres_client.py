"""
Yonder Graph — PostgreSQL Client

Provides SQLAlchemy engine, session management, and DDL initialization
for the audit and feedback logging tables.
"""

from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from backend.config import settings
import logging

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Declarative base for all SQLAlchemy ORM models."""
    pass


# Engine singleton — created lazily
_engine = None
_SessionLocal = None


def get_engine():
    """Get or create the SQLAlchemy engine singleton."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.postgres_url,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            echo=False,
        )
        logger.info("PostgreSQL engine created: %s", settings.postgres_host)
    return _engine


def get_session_factory() -> sessionmaker:
    """Get or create the session factory singleton."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine(),
        )
    return _SessionLocal


from contextlib import contextmanager

def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a database session and ensures cleanup."""
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
    finally:
        session.close()

@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager for standalone database sessions."""
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """
    Initialize the PostgreSQL database schema.
    
    Creates all tables defined in the ORM models if they don't exist.
    Called during setup_local.sh and application startup.
    """
    # Import models to register them with Base.metadata
    from backend.audit.models import (  # noqa: F401
        AgentAuditLog,
        ChatFeedbackLog,
        ChatSession,
        ChatMessage,
        ExecutiveRoiMetric,
    )

    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    logger.info(
        "PostgreSQL schema initialized — tables: %s",
        list(Base.metadata.tables.keys()),
    )


def check_connection() -> bool:
    """Verify PostgreSQL connectivity."""
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("PostgreSQL connection check failed: %s", e)
        return False
