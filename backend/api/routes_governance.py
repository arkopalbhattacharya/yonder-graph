"""
Yonder Graph — Governance API Routes

GET /api/governance/policy — Returns the complete governance specification
for in-app rendering in the Governance & Guardrails Viewer.
"""

from fastapi import APIRouter
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
