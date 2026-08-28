"""
Yonder Graph — Feedback Logger

Handles persistence and lifecycle management of user feedback events
(thumbs up/down, SME corrections, re-evaluations, and graph patches).
"""

import uuid
import logging
from typing import Any, Dict, List, Optional
from backend.audit.models import ChatFeedbackLog
from backend.database.postgres_client import get_session_factory

logger = logging.getLogger(__name__)


class FeedbackLogger:
    """
    Manages the feedback lifecycle from initial vote through
    SME correction, confidence re-evaluation, and graph patching.
    """

    @staticmethod
    def log_feedback(
        session_id: str,
        user_query: str,
        generated_response: Optional[Dict[str, Any]],
        feedback_type: str,
        matched_sop_id: Optional[str] = None,
    ) -> str:
        """
        Log a thumbs up/down feedback event.
        
        Returns the generated feedback UUID for subsequent correction tracking.
        """
        feedback_id = uuid.uuid4()
        entry = ChatFeedbackLog(
            id=feedback_id,
            session_id=session_id,
            user_query=user_query,
            generated_response=generated_response,
            matched_sop_id=matched_sop_id,
            feedback_type=feedback_type,
            resolution_status="LOGGED",
        )

        try:
            SessionLocal = get_session_factory()
            with SessionLocal() as session:
                session.add(entry)
                session.commit()
                logger.info(
                    "Feedback logged: %s | type=%s | sop=%s",
                    feedback_id,
                    feedback_type,
                    matched_sop_id,
                )
        except Exception as e:
            logger.error("Failed to log feedback: %s", e)

        return str(feedback_id)

    @staticmethod
    def update_correction(
        feedback_id: str,
        corrected_triage_steps: Optional[str] = None,
        corrected_sql: Optional[str] = None,
        corrected_moca: Optional[str] = None,
        confidence_score: Optional[float] = None,
        validation_errors: Optional[Dict[str, Any]] = None,
        resolution_status: str = "PENDING_REVIEW",
    ) -> bool:
        """
        Update a feedback entry with SME corrections and re-evaluation results.
        
        Called iteratively during the confidence scoring loop until ≥90% is reached.
        """
        try:
            SessionLocal = get_session_factory()
            with SessionLocal() as session:
                entry = session.query(ChatFeedbackLog).filter(
                    ChatFeedbackLog.id == uuid.UUID(feedback_id)
                ).first()

                if not entry:
                    logger.warning("Feedback entry not found: %s", feedback_id)
                    return False

                if corrected_triage_steps is not None:
                    entry.corrected_triage_steps = corrected_triage_steps
                if corrected_sql is not None:
                    entry.corrected_sql = corrected_sql
                if corrected_moca is not None:
                    entry.corrected_moca = corrected_moca
                if confidence_score is not None:
                    entry.confidence_score = confidence_score
                if validation_errors is not None:
                    entry.validation_errors = validation_errors
                entry.resolution_status = resolution_status

                session.commit()
                logger.info(
                    "Feedback updated: %s | score=%.1f | status=%s",
                    feedback_id,
                    confidence_score or 0,
                    resolution_status,
                )
                return True
        except Exception as e:
            logger.error("Failed to update feedback: %s", e)
            return False

    @staticmethod
    def get_feedback(feedback_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a single feedback entry by ID."""
        try:
            SessionLocal = get_session_factory()
            with SessionLocal() as session:
                entry = session.query(ChatFeedbackLog).filter(
                    ChatFeedbackLog.id == uuid.UUID(feedback_id)
                ).first()
                return entry.to_dict() if entry else None
        except Exception as e:
            logger.error("Failed to retrieve feedback: %s", e)
            return None

    @staticmethod
    def get_pending_corrections() -> List[Dict[str, Any]]:
        """Return all feedback entries awaiting review or re-evaluation."""
        try:
            SessionLocal = get_session_factory()
            with SessionLocal() as session:
                entries = session.query(ChatFeedbackLog).filter(
                    ChatFeedbackLog.resolution_status.in_(
                        ["PENDING_REVIEW", "CONFIDENCE_REJECTED"]
                    )
                ).order_by(ChatFeedbackLog.timestamp.desc()).all()
                return [e.to_dict() for e in entries]
        except Exception as e:
            logger.error("Failed to retrieve pending corrections: %s", e)
            return []

    @staticmethod
    def get_feedback_stats() -> Dict[str, Any]:
        """Return aggregated feedback statistics."""
        try:
            SessionLocal = get_session_factory()
            with SessionLocal() as session:
                total = session.query(ChatFeedbackLog).count()
                thumbs_up = session.query(ChatFeedbackLog).filter(
                    ChatFeedbackLog.feedback_type == "THUMBS_UP"
                ).count()
                thumbs_down = session.query(ChatFeedbackLog).filter(
                    ChatFeedbackLog.feedback_type == "THUMBS_DOWN"
                ).count()
                applied = session.query(ChatFeedbackLog).filter(
                    ChatFeedbackLog.resolution_status == "APPLIED_TO_GRAPH"
                ).count()
                pending = session.query(ChatFeedbackLog).filter(
                    ChatFeedbackLog.resolution_status.in_(
                        ["PENDING_REVIEW", "CONFIDENCE_REJECTED"]
                    )
                ).count()

                return {
                    "total_feedback": total,
                    "thumbs_up": thumbs_up,
                    "thumbs_down": thumbs_down,
                    "applied_to_graph": applied,
                    "pending_review": pending,
                    "satisfaction_rate": (
                        round(thumbs_up / total * 100, 1) if total > 0 else 0
                    ),
                }
        except Exception as e:
            logger.error("Failed to compute feedback stats: %s", e)
            return {}


# Module-level singleton
feedback_logger = FeedbackLogger()
