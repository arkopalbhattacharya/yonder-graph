"""
Yonder Graph — PostgreSQL Audit & Feedback ORM Models

Defines the two core audit tables:
  1. AgentAuditLog — Immutable log of all agent actions, tool calls, governance events
  2. ChatFeedbackLog — User feedback events (thumbs up/down) with correction tracking
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Float,
    Integer,
    Boolean,
    ForeignKey,
    DateTime,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
from backend.database.postgres_client import Base


class AgentAuditLog(Base):
    """
    Immutable audit record for every agent action in the system.
    
    Captures intent parsing, tool calls, Cypher queries, SQL bindings,
    safety checks, governance intercepts, and enrichment evaluations.
    """

    __tablename__ = "agent_audit_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    session_id = Column(String(64), nullable=False, index=True)
    agent_name = Column(String(64), nullable=False, index=True)
    llm_provider = Column(String(32), nullable=True)
    llm_model = Column(String(64), nullable=True)
    action_type = Column(String(64), nullable=False, index=True)
    input_payload = Column(JSONB, nullable=True)
    output_payload = Column(JSONB, nullable=True)
    tools_invoked = Column(JSONB, nullable=True)
    execution_time_ms = Column(Float, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="SUCCESS")
    governance_tier1_eval = Column(JSONB, nullable=True)
    governance_tier2_flags = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)

    # Composite indexes for common query patterns
    __table_args__ = (
        Index("idx_audit_session_action", "session_id", "action_type"),
        Index("idx_audit_agent_status", "agent_name", "status"),
        Index("idx_audit_timestamp_status", "timestamp", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<AgentAuditLog(id={self.id}, agent={self.agent_name}, "
            f"action={self.action_type}, status={self.status})>"
        )

    def to_dict(self) -> dict:
        """Serialize to a JSON-compatible dictionary."""
        return {
            "id": str(self.id),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "session_id": self.session_id,
            "agent_name": self.agent_name,
            "llm_provider": self.llm_provider,
            "llm_model": self.llm_model,
            "action_type": self.action_type,
            "input_payload": self.input_payload,
            "output_payload": self.output_payload,
            "tools_invoked": self.tools_invoked,
            "execution_time_ms": self.execution_time_ms,
            "tokens_used": self.tokens_used,
            "status": self.status,
            "governance_tier1_eval": self.governance_tier1_eval,
            "governance_tier2_flags": self.governance_tier2_flags,
            "error_message": self.error_message,
        }


class ChatFeedbackLog(Base):
    """
    Tracks user feedback on AI-generated responses.
    
    Captures thumbs up/down votes, SME corrections,
    confidence re-evaluations, and graph patch resolution status.
    """

    __tablename__ = "chat_feedback_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    session_id = Column(String(64), nullable=False, index=True)
    user_query = Column(Text, nullable=False)
    generated_response = Column(JSONB, nullable=True)
    matched_sop_id = Column(String(64), nullable=True, index=True)
    feedback_type = Column(String(20), nullable=False)
    corrected_triage_steps = Column(Text, nullable=True)
    corrected_sql = Column(Text, nullable=True)
    corrected_moca = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    validation_errors = Column(JSONB, nullable=True)
    resolution_status = Column(
        String(32), nullable=False, default="LOGGED"
    )

    __table_args__ = (
        Index("idx_feedback_session", "session_id"),
        Index("idx_feedback_type_status", "feedback_type", "resolution_status"),
        Index("idx_feedback_sop", "matched_sop_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<ChatFeedbackLog(id={self.id}, type={self.feedback_type}, "
            f"status={self.resolution_status})>"
        )

    def to_dict(self) -> dict:
        """Serialize to a JSON-compatible dictionary."""
        return {
            "id": str(self.id),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "session_id": self.session_id,
            "user_query": self.user_query,
            "generated_response": self.generated_response,
            "matched_sop_id": self.matched_sop_id,
            "feedback_type": self.feedback_type,
            "corrected_triage_steps": self.corrected_triage_steps,
            "corrected_sql": self.corrected_sql,
            "corrected_moca": self.corrected_moca,
            "confidence_score": self.confidence_score,
            "validation_errors": self.validation_errors,
            "resolution_status": self.resolution_status,
        }


class ChatSession(Base):
    """
    Represents an ongoing or past conversation session in Copilot Chat.
    
    Supports pinning, custom/LLM-generated titles (max 8 words),
    and 7-day retention management.
    """

    __tablename__ = "chat_sessions"

    session_id = Column(String(64), primary_key=True, nullable=False)
    title = Column(String(160), nullable=False, default="New Conversation")
    is_pinned = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True,
    )
    metadata_payload = Column(JSONB, nullable=True)

    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at.asc()",
    )

    __table_args__ = (
        Index("idx_session_pinned_updated", "is_pinned", "updated_at"),
    )

    def __repr__(self) -> str:
        return f"<ChatSession(session_id={self.session_id}, title={self.title}, is_pinned={self.is_pinned})>"

    def to_dict(self) -> dict:
        persona = (self.metadata_payload or {}).get("persona")
        if not persona and self.messages:
            for m in self.messages:
                if isinstance(m.content, dict) and m.content.get("persona"):
                    persona = m.content["persona"]
                    break
        return {
            "session_id": self.session_id,
            "title": self.title,
            "persona": persona or "ask",
            "is_pinned": self.is_pinned,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "metadata": self.metadata_payload,
            "message_count": len(self.messages) if self.messages else 0,
        }


class ChatMessage(Base):
    """
    Individual message record in a chat session.
    """

    __tablename__ = "chat_messages"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    session_id = Column(
        String(64),
        ForeignKey("chat_sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(20), nullable=False)  # "user", "assistant", "system"
    content = Column(JSONB, nullable=False)    # rich payload or text object
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    session = relationship("ChatSession", back_populates="messages")

    __table_args__ = (
        Index("idx_chat_msg_session_created", "session_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<ChatMessage(id={self.id}, session_id={self.session_id}, role={self.role})>"

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ExecutiveRoiMetric(Base):
    """
    Persisted telemetry of executive cost savings, MTTR acceleration,
    and SLA risk avoidance per incident triage for temporal reporting (day, month, year).
    """

    __tablename__ = "executive_roi_metrics"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    day = Column(Integer, nullable=False, index=True)
    session_id = Column(String(64), nullable=False, index=True)
    domain = Column(String(64), nullable=False, default="general", index=True)
    matched_sop_id = Column(String(64), nullable=True, index=True)
    issue_pattern = Column(String(255), nullable=True)
    root_cause_summary = Column(String(255), nullable=True)
    manual_mttr_sec = Column(Float, nullable=False, default=2700.0)  # 45 minutes
    automated_mttr_sec = Column(Float, nullable=False, default=1.8)
    mttr_reduction_pct = Column(Float, nullable=False, default=96.0)
    engineering_cost_saved_usd = Column(Float, nullable=False, default=120.0)
    carrier_sla_penalty_avoided_usd = Column(Float, nullable=False, default=2500.0)
    total_estimated_roi_usd = Column(Float, nullable=False, default=2620.0)
    details = Column(JSONB, nullable=True)

    __table_args__ = (
        Index("idx_roi_year_month_day", "year", "month", "day"),
        Index("idx_roi_domain_date", "domain", "year", "month"),
        Index("idx_roi_session", "session_id"),
    )

    def __repr__(self) -> str:
        return f"<ExecutiveRoiMetric(id={self.id}, session={self.session_id}, roi=${self.total_estimated_roi_usd}, date={self.year}-{self.month}-{self.day})>"

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "year": self.year,
            "month": self.month,
            "day": self.day,
            "session_id": self.session_id,
            "domain": self.domain,
            "matched_sop_id": self.matched_sop_id,
            "issue_pattern": self.issue_pattern,
            "root_cause_summary": self.root_cause_summary,
            "manual_mttr_sec": self.manual_mttr_sec,
            "automated_mttr_sec": self.automated_mttr_sec,
            "mttr_reduction_pct": self.mttr_reduction_pct,
            "engineering_cost_saved_usd": self.engineering_cost_saved_usd,
            "carrier_sla_penalty_avoided_usd": self.carrier_sla_penalty_avoided_usd,
            "total_estimated_roi_usd": self.total_estimated_roi_usd,
            "details": self.details,
        }


def record_roi_metric(
    session_id: str,
    domain: str,
    matched_sop_id: str = None,
    issue_pattern: str = None,
    root_cause_summary: str = None,
    manual_mttr_min: float = 45.0,
    automated_mttr_sec: float = 1.8,
    engineering_cost_saved: float = 120.0,
    carrier_sla_penalty_avoided: float = 2500.0,
    details: dict = None,
    db = None,
) -> ExecutiveRoiMetric:
    """Record an incident triage ROI metric into PostgreSQL."""
    now = datetime.now(timezone.utc)
    manual_mttr_sec = manual_mttr_min * 60.0
    mttr_reduction_pct = round(((manual_mttr_sec - automated_mttr_sec) / manual_mttr_sec) * 100.0, 1)
    total_roi = round(engineering_cost_saved + carrier_sla_penalty_avoided, 2)

    metric = ExecutiveRoiMetric(
        timestamp=now,
        year=now.year,
        month=now.month,
        day=now.day,
        session_id=session_id,
        domain=domain or "general",
        matched_sop_id=matched_sop_id,
        issue_pattern=issue_pattern,
        root_cause_summary=root_cause_summary,
        manual_mttr_sec=manual_mttr_sec,
        automated_mttr_sec=automated_mttr_sec,
        mttr_reduction_pct=mttr_reduction_pct,
        engineering_cost_saved_usd=engineering_cost_saved,
        carrier_sla_penalty_avoided_usd=carrier_sla_penalty_avoided,
        total_estimated_roi_usd=total_roi,
        details=details or {},
    )

    if db is not None:
        db.add(metric)
        db.commit()
        db.refresh(metric)
        db.expunge(metric)
    else:
        from backend.database.postgres_client import get_db_context
        with get_db_context() as session:
            session.add(metric)
            session.commit()
            session.refresh(metric)
            session.expunge(metric)

    return metric

