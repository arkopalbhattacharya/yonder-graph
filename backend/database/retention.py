"""
Yonder Graph — Chat Retention & Purge Utility

Purges unpinned chat sessions and messages older than the retention threshold
(default: 7 days) to prevent database bloat while strictly preserving pinned sessions.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from backend.database.postgres_client import get_session_factory
import logging

logger = logging.getLogger(__name__)

RETENTION_DAYS_DEFAULT = 7


def purge_expired_sessions(days: int = RETENTION_DAYS_DEFAULT) -> dict:
    """
    Purge unpinned chat sessions and orphaned messages older than specified days.
    
    Pinned chats (is_pinned = TRUE) are permanently preserved until explicitly deleted.
    
    Returns:
        dict with counts of purged sessions and messages.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    session_factory = get_session_factory()
    session = session_factory()

    try:
        # 1. Delete unpinned chat sessions older than cutoff (cascade deletes messages)
        result = session.execute(
            text(
                """
                DELETE FROM chat_sessions 
                WHERE is_pinned = FALSE 
                  AND updated_at < :cutoff
                """
            ),
            {"cutoff": cutoff},
        )
        purged_sessions = result.rowcount

        # 2. Delete any orphaned messages whose session_id might be stale
        msg_result = session.execute(
            text(
                """
                DELETE FROM chat_messages 
                WHERE session_id NOT IN (SELECT session_id FROM chat_sessions)
                """
            )
        )
        purged_messages = msg_result.rowcount

        session.commit()
        
        if purged_sessions > 0 or purged_messages > 0:
            logger.info(
                "Retention purge completed (cutoff: >%d days): %d sessions, %d messages purged",
                days,
                purged_sessions,
                purged_messages,
            )

        return {
            "status": "success",
            "purged_sessions": purged_sessions,
            "purged_messages": purged_messages,
            "retention_days": days,
            "cutoff_timestamp": cutoff.isoformat(),
        }
    except Exception as e:
        session.rollback()
        logger.error("Error running chat retention purge: %s", e, exc_info=True)
        return {
            "status": "error",
            "error": str(e),
        }
    finally:
        session.close()
