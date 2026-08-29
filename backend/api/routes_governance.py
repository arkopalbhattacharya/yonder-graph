"""
Yonder Graph — Governance API Routes

GET /api/governance/policy — Returns the complete governance specification
for in-app rendering in the Governance & Guardrails Viewer.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import Optional, List, Dict, Any
from backend.database.postgres_client import get_db
from backend.audit.models import AgentAuditLog, ChatSession
from backend.governance.remediation_policy import RemediationPolicy
from backend.governance.safety_rules import (
    GOVERNANCE_POLICY_HEADER,
    TIER1_DESCRIPTION,
    TIER2_DESCRIPTION,
    MUTATION_TOKENS,
    ALLOWED_STATEMENT_TYPES,
    DEFAULT_ROW_LIMIT,
)
from backend.inference.llm_provider import LLMProviderFactory

router = APIRouter()


@router.get("/policy")
def get_governance_policy():
    """
    Return the complete human-readable Governance & Guardrails specification.
    
    Used by the GovernanceViewer frontend component to render the
    in-app governance documentation with visual explanation cards.
    """
    policy = RemediationPolicy.get_full_policy_document()

    # Augment with Tier descriptions and technical details
    policy["governance_tiers"] = {
        "tier1": {
            "name": "Cognitive Governance (ADK GovernanceSafetyAgent)",
            "description": TIER1_DESCRIPTION,
            "capabilities": [
                "Risk level evaluation (LOW → CRITICAL)",
                "Remediation tier selection (MOCA → UI → Patch → Dual-Control)",
                "Human-readable policy justification generation",
                "Pre-condition assertion drafting",
            ],
        },
        "tier2": {
            "name": "Deterministic Hard Guard (Oracle SQL AST Interceptor)",
            "description": TIER2_DESCRIPTION,
            "blocked_tokens": sorted(MUTATION_TOKENS),
            "allowed_statements": sorted(ALLOWED_STATEMENT_TYPES),
            "row_limit": DEFAULT_ROW_LIMIT,
            "capabilities": [
                "sqlparse AST token scanning",
                "Mutation keyword hard-blocking",
                "ROWNUM ≤ 100 automatic injection",
                "Oracle bind parameter regex validation",
                "Neo4j schema match guard",
                "Multi-statement injection prevention",
            ],
        },
    }

    # Add LLM safety information
    policy["llm_safety"] = {
        "current_provider": LLMProviderFactory.get_provider_info(),
        "grounding_rules": [
            "All agent outputs are grounded in Neo4j knowledge graph data",
            "No SQL is generated from LLM training data — templates come from SOPs",
            "Fail-closed: if no SOP match found, agents return 'no_match'",
            "All SQL passes through Tier 2 before user presentation",
        ],
        "hot_swap_safety": (
            "Switching LLM providers via .env does not affect governance. "
            "Tier 2 (deterministic) is completely provider-independent. "
            "Tier 1 (cognitive) adapts its prompts to any provider."
        ),
    }

    return policy


@router.get("/interceptions")
def get_governance_interceptions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Return chronological live governance interceptions and cognitive safety checks
    made across live chats and incident triages.
    """
    try:
        query = db.query(AgentAuditLog).filter(
            or_(
                AgentAuditLog.agent_name == "GovernanceSafetyAgent",
                AgentAuditLog.action_type.in_([
                    "GOVERNANCE_INTERCEPT",
                    "GOVERNANCE_DECISION",
                    "SAFETY_CHECK",
                    "AST_VALIDATION_FAILED",
                ]),
                AgentAuditLog.status.in_([
                    "BLOCKED_BY_GOVERNANCE",
                    "REQUIRES_APPROVAL",
                    "INTERCEPTED",
                    "POLICY_RESTRICTED",
                ]),
                AgentAuditLog.governance_tier1_eval.isnot(None),
                AgentAuditLog.governance_tier2_flags.isnot(None),
            )
        )

        if status:
            query = query.filter(AgentAuditLog.status == status)

        total = query.count()
        logs = (
            query.order_by(desc(AgentAuditLog.timestamp))
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        # Fetch session metadata to enrich logs with user conversation titles
        session_ids = list({log.session_id for log in logs if log.session_id})
        sessions_map = {}
        if session_ids:
            sessions = db.query(ChatSession).filter(ChatSession.session_id.in_(session_ids)).all()
            sessions_map = {s.session_id: s for s in sessions}

        items = []
        for log in logs:
            session = sessions_map.get(log.session_id)
            session_title = session.title if session else None

            input_p = log.input_payload or {}
            output_p = log.output_payload or {}
            tier1 = log.governance_tier1_eval or {}
            tier2 = log.governance_tier2_flags or {}

            r_level = tier1.get("risk_level") or output_p.get("risk_level") or "LOW_RISK_READONLY"
            if risk_level and risk_level.upper() not in str(r_level).upper():
                continue

            is_blocked = log.status in ["BLOCKED_BY_GOVERNANCE", "INTERCEPTED", "POLICY_RESTRICTED"]
            requires_approval = (
                tier1.get("requires_approval") is True
                or output_p.get("requires_sme_approval") is True
                or log.status == "REQUIRES_APPROVAL"
            )

            domain = input_p.get("domain") or (
                session.metadata_payload.get("domain")
                if session and session.metadata_payload
                else "General"
            )
            action = input_p.get("action") or input_p.get("topic") or session_title or "Incident Investigation"

            items.append({
                "id": str(log.id),
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "session_id": log.session_id,
                "session_title": session_title,
                "domain": domain,
                "action_or_topic": action,
                "agent_name": log.agent_name,
                "action_type": log.action_type,
                "status": log.status,
                "is_blocked": is_blocked,
                "requires_approval": requires_approval,
                "risk_level": r_level,
                "tier_selected": tier1.get("selected_tier") or output_p.get("tier") or "LEVEL_1_MOCA",
                "recommended_action": output_p.get("recommended_action") or "Enforce read-only SQL & MOCA execution",
                "policy_justification": (
                    output_p.get("policy_justification")
                    or tier1.get("justification")
                    or "Enforces dual-tier read-only safety guardrails."
                ),
                "moca_command": output_p.get("moca_command"),
                "preconditions": output_p.get("preconditions") or [],
                "rollback_steps": output_p.get("rollback_steps") or [],
                "tier2_flags": tier2,
                "execution_time_ms": log.execution_time_ms,
                "tokens_used": log.tokens_used,
            })

        return {
            "interceptions": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 1,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

