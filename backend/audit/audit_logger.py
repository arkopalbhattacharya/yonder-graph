"""
Yonder Graph — Audit Logger

Asynchronous logging of all agent actions, tool calls, governance events,
and telemetry data to the PostgreSQL agent_audit_logs table.
"""

import uuid
import time
import logging
from typing import Any, Dict, List, Optional
from backend.audit.models import AgentAuditLog
from backend.database.postgres_client import get_session_factory
from backend.config import settings

logger = logging.getLogger(__name__)


class AuditLogger:
    """
    Centralized audit logger for all agent operations.
    
    All entries are immutable once written. Every agent action, tool invocation,
    Cypher query, SQL generation, and governance decision is recorded.
    """

    @staticmethod
    def log(
        session_id: str,
        agent_name: str,
        action_type: str,
        input_payload: Optional[Dict[str, Any]] = None,
        output_payload: Optional[Dict[str, Any]] = None,
        tools_invoked: Optional[List[str]] = None,
        execution_time_ms: Optional[float] = None,
        tokens_used: Optional[int] = None,
        status: str = "SUCCESS",
        governance_tier1_eval: Optional[Dict[str, Any]] = None,
        governance_tier2_flags: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> str:
        """
        Write an immutable audit log entry to PostgreSQL.
        
        Returns the generated UUID of the log entry.
        """
        log_id = uuid.uuid4()
        entry = AgentAuditLog(
            id=log_id,
            session_id=session_id,
            agent_name=agent_name,
            llm_provider=settings.llm_provider,
            llm_model=settings.llm_model_name,
            action_type=action_type,
            input_payload=input_payload,
            output_payload=output_payload,
            tools_invoked=tools_invoked,
            execution_time_ms=execution_time_ms,
            tokens_used=tokens_used,
            status=status,
            governance_tier1_eval=governance_tier1_eval,
            governance_tier2_flags=governance_tier2_flags,
            error_message=error_message,
        )

        try:
            SessionLocal = get_session_factory()
            with SessionLocal() as session:
                session.add(entry)
                session.commit()
                logger.debug(
                    "Audit log written: %s | %s | %s | %s",
                    log_id,
                    agent_name,
                    action_type,
                    status,
                )
        except Exception as e:
            logger.error("Failed to write audit log: %s", e)

        return str(log_id)

    @staticmethod
    def log_governance_intercept(
        session_id: str,
        agent_name: str,
        tier: str,
        input_sql: Optional[str] = None,
        flags: Optional[Dict[str, Any]] = None,
        blocked: bool = False,
        explanation: Optional[str] = None,
    ) -> str:
        """Convenience method for logging governance intercept events."""
        status = "BLOCKED_BY_GOVERNANCE" if blocked else "SUCCESS"
        return AuditLogger.log(
            session_id=session_id,
            agent_name=agent_name,
            action_type="GOVERNANCE_INTERCEPT",
            input_payload={"sql": input_sql, "tier": tier},
            output_payload={"flags": flags, "explanation": explanation},
            status=status,
            governance_tier1_eval=flags if tier == "tier1" else None,
            governance_tier2_flags=flags if tier == "tier2" else None,
        )

    @staticmethod
    def log_tool_call(
        session_id: str,
        agent_name: str,
        tool_name: str,
        tool_input: Optional[Dict[str, Any]] = None,
        tool_output: Optional[Dict[str, Any]] = None,
        execution_time_ms: Optional[float] = None,
        status: str = "SUCCESS",
    ) -> str:
        """Convenience method for logging tool invocations."""
        return AuditLogger.log(
            session_id=session_id,
            agent_name=agent_name,
            action_type="TOOL_CALL",
            input_payload=tool_input,
            output_payload=tool_output,
            tools_invoked=[tool_name],
            execution_time_ms=execution_time_ms,
            status=status,
        )

    @staticmethod
    def log_cypher_query(
        session_id: str,
        agent_name: str,
        cypher: str,
        result_count: int = 0,
        execution_time_ms: Optional[float] = None,
    ) -> str:
        """Convenience method for logging Cypher query executions."""
        return AuditLogger.log(
            session_id=session_id,
            agent_name=agent_name,
            action_type="CYPHER_QUERY",
            input_payload={"cypher": cypher},
            output_payload={"result_count": result_count},
            execution_time_ms=execution_time_ms,
        )

    @staticmethod
    def log_sql_binding(
        session_id: str,
        agent_name: str,
        template_sql: str,
        bound_sql: str,
        parameters: Dict[str, Any],
        execution_time_ms: Optional[float] = None,
    ) -> str:
        """Convenience method for logging Oracle SQL parameter binding."""
        return AuditLogger.log(
            session_id=session_id,
            agent_name=agent_name,
            action_type="SQL_BINDING",
            input_payload={
                "template_sql": template_sql,
                "parameters": parameters,
            },
            output_payload={"bound_sql": bound_sql},
            execution_time_ms=execution_time_ms,
        )


class AuditTimer:
    """Context manager for timing operations and logging execution duration."""

    def __init__(self):
        self.start_time: float = 0
        self.elapsed_ms: float = 0

    def __enter__(self):
        self.start_time = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.elapsed_ms = (time.perf_counter() - self.start_time) * 1000


# Module-level singleton
audit_logger = AuditLogger()
