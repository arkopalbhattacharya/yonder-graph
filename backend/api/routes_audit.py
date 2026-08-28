"""
Yonder Graph — Audit API Routes

GET /api/audit/logs — Returns paginated audit logs from PostgreSQL.
GET /api/audit/stats — Returns aggregated telemetry and governance stats.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from sqlalchemy.orm import Session
from backend.database.postgres_client import get_db
from backend.audit.models import AgentAuditLog
from backend.audit.feedback_logger import feedback_logger
from backend.inference.telemetry import telemetry
from backend.inference.llm_provider import LLMProviderFactory
from backend.inference.agents import get_agent_registry

router = APIRouter()


@router.get("/logs")
def get_audit_logs(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=50, ge=1, le=200, description="Items per page"),
    agent_name: Optional[str] = Query(default=None, description="Filter by agent"),
    action_type: Optional[str] = Query(default=None, description="Filter by action type"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    session_id: Optional[str] = Query(default=None, description="Filter by session"),
    db: Session = Depends(get_db),
):
    """Return paginated audit logs with optional filters."""
    try:
        query = db.query(AgentAuditLog)

        if agent_name:
            query = query.filter(AgentAuditLog.agent_name == agent_name)
        if action_type:
            query = query.filter(AgentAuditLog.action_type == action_type)
        if status:
            query = query.filter(AgentAuditLog.status == status)
        if session_id:
            query = query.filter(AgentAuditLog.session_id == session_id)

        total = query.count()
        logs = (
            query.order_by(AgentAuditLog.timestamp.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        return {
            "logs": [log.to_dict() for log in logs],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
def get_audit_stats(db: Session = Depends(get_db)):
    """Return aggregated telemetry, LLM provider info, and governance stats."""
    try:
        from sqlalchemy import func, or_

        # Agent telemetry metrics
        metrics = telemetry.get_all_metrics()

        # Feedback statistics
        feedback_stats = feedback_logger.get_feedback_stats()

        # Lifetime total tokens from PostgreSQL DB
        db_total_tokens = db.query(func.sum(AgentAuditLog.tokens_used)).scalar() or 0
        db_prompt_tokens = int(db_total_tokens * 0.70) if db_total_tokens > 0 else 0
        db_completion_tokens = db_total_tokens - db_prompt_tokens

        # Lifetime per-agent tokens from PostgreSQL DB
        agent_token_rows = db.query(
            AgentAuditLog.agent_name,
            func.sum(AgentAuditLog.tokens_used)
        ).group_by(AgentAuditLog.agent_name).all()
        db_agent_tokens = {row[0]: int(row[1] or 0) for row in agent_token_rows}

        if db_total_tokens > 0:
            metrics["total_tokens"] = max(metrics.get("total_tokens", 0), int(db_total_tokens))
            metrics["total_prompt_tokens"] = max(metrics.get("total_prompt_tokens", 0), db_prompt_tokens)
            metrics["total_completion_tokens"] = max(metrics.get("total_completion_tokens", 0), db_completion_tokens)

        # Initialize all registered agents in metrics dict
        reg_agents = get_agent_registry()
        for ag_name in reg_agents.keys():
            if ag_name not in metrics["agents"]:
                metrics["agents"][ag_name] = {
                    "invocation_count": 0,
                    "success_count": 0,
                    "error_count": 0,
                    "total_tokens": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "session_invocation_count": 0,
                    "session_total_tokens": 0,
                    "session_prompt_tokens": 0,
                    "session_completion_tokens": 0,
                    "avg_latency_ms": 0,
                    "p95_latency_ms": 0,
                    "governance_intercepts": 0,
                    "session_governance_intercepts": 0,
                    "error_rate": 0,
                    "last_invocation": None,
                }

        for agent_name, token_count in db_agent_tokens.items():
            if agent_name not in metrics["agents"]:
                metrics["agents"][agent_name] = {
                    "invocation_count": 0,
                    "success_count": 0,
                    "error_count": 0,
                    "total_tokens": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "session_invocation_count": 0,
                    "session_total_tokens": 0,
                    "session_prompt_tokens": 0,
                    "session_completion_tokens": 0,
                    "avg_latency_ms": 0,
                    "p95_latency_ms": 0,
                    "governance_intercepts": 0,
                    "session_governance_intercepts": 0,
                    "error_rate": 0,
                    "last_invocation": None,
                }
            metrics["agents"][agent_name]["total_tokens"] = max(
                metrics["agents"][agent_name].get("total_tokens", 0),
                token_count
            )
            ag_p = int(token_count * 0.70)
            metrics["agents"][agent_name]["prompt_tokens"] = max(
                metrics["agents"][agent_name].get("prompt_tokens", 0),
                ag_p
            )
            metrics["agents"][agent_name]["completion_tokens"] = max(
                metrics["agents"][agent_name].get("completion_tokens", 0),
                token_count - ag_p
            )

        # Governance intercept count from persistent PostgreSQL audit logs
        governance_count = db.query(AgentAuditLog).filter(
            or_(
                AgentAuditLog.status.in_(["BLOCKED_BY_GOVERNANCE", "REQUIRES_APPROVAL", "INTERCEPTED", "POLICY_RESTRICTED"]),
                AgentAuditLog.action_type.in_(["GOVERNANCE_INTERCEPT", "GOVERNANCE_DECISION", "AST_VALIDATION_FAILED", "SAFETY_CHECK"]),
                AgentAuditLog.governance_tier1_eval["requires_approval"].as_boolean() == True,
            )
        ).count()

        # Total intercepts combines runtime telemetry intercepts and persistent DB logs
        total_intercepts = max(metrics.get("total_governance_intercepts", 0), governance_count)
        metrics["total_governance_intercepts"] = total_intercepts

        # Total audit entries
        total_entries = db.query(AgentAuditLog).count()

        # Action type distribution
        action_dist = dict(
            db.query(
                AgentAuditLog.action_type,
                func.count(AgentAuditLog.id),
            )
            .group_by(AgentAuditLog.action_type)
            .all()
        )

        return {
            "telemetry": metrics,
            "feedback": feedback_stats,
            "governance_intercepts": total_intercepts,
            "total_audit_entries": total_entries,
            "action_type_distribution": action_dist,
            "llm_provider": LLMProviderFactory.get_provider_info(),
            "registered_agents": get_agent_registry(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
