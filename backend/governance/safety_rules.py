"""
Yonder Graph — Safety Rules & Risk Definitions

Defines risk levels, blocked token registries, allowed statement types,
and fail-closed governance constants used across both governance tiers.
"""

from enum import Enum
from typing import Dict, FrozenSet, List, Set


class RiskLevel(str, Enum):
    """Operational risk classification for agent-generated actions."""

    LOW_RISK_READONLY = "LOW_RISK_READONLY"
    MEDIUM_RISK_IDEMPOTENT = "MEDIUM_RISK_IDEMPOTENT"
    HIGH_RISK_MUTATION = "HIGH_RISK_MUTATION"
    CRITICAL_RISK_STRUCTURAL = "CRITICAL_RISK_STRUCTURAL"


class RemediationTier(str, Enum):
    """Four-tier remediation policy levels."""

    LEVEL_1_MOCA = "LEVEL_1_MOCA"
    LEVEL_2_UI_GUIDANCE = "LEVEL_2_UI_GUIDANCE"
    LEVEL_3_GOVERNED_PATCH = "LEVEL_3_GOVERNED_PATCH"
    LEVEL_4_DUAL_CONTROL = "LEVEL_4_DUAL_CONTROL"


# ──────────────────────────────────────────────────────────────
# Blocked SQL Tokens (Tier 2 Hard Guard)
# ──────────────────────────────────────────────────────────────

MUTATION_TOKENS: FrozenSet[str] = frozenset({
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "TRUNCATE",
    "MERGE",
    "GRANT",
    "REVOKE",
    "EXEC",
    "EXECUTE",
    "CREATE",
    "REPLACE",
    "CALL",
})

# Subset that represents structural DDL changes (highest risk)
STRUCTURAL_DDL_TOKENS: FrozenSet[str] = frozenset({
    "DROP",
    "ALTER",
    "TRUNCATE",
    "CREATE",
    "REPLACE",
})

# Tokens that indicate data mutation (not structural)
DATA_MUTATION_TOKENS: FrozenSet[str] = frozenset({
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
})

# ──────────────────────────────────────────────────────────────
# Allowed Diagnostic SQL Statement Types
# ──────────────────────────────────────────────────────────────

ALLOWED_STATEMENT_TYPES: FrozenSet[str] = frozenset({
    "SELECT",
    "WITH",  # CTE / Common Table Expressions
})

# ──────────────────────────────────────────────────────────────
# Oracle-Specific Constants
# ──────────────────────────────────────────────────────────────

DEFAULT_ROW_LIMIT: int = 100
ROWNUM_CLAUSE: str = "ROWNUM <= 100"
FETCH_FIRST_CLAUSE: str = "FETCH FIRST 100 ROWS ONLY"

# Oracle bind parameter pattern: :param_name
ORACLE_BIND_PARAM_PATTERN: str = r":[a-zA-Z_][a-zA-Z0-9_]*"

# ──────────────────────────────────────────────────────────────
# Risk → Remediation Routing Matrix
# ──────────────────────────────────────────────────────────────

RISK_REMEDIATION_MAP: Dict[RiskLevel, List[RemediationTier]] = {
    RiskLevel.LOW_RISK_READONLY: [
        RemediationTier.LEVEL_1_MOCA,
        RemediationTier.LEVEL_2_UI_GUIDANCE,
    ],
    RiskLevel.MEDIUM_RISK_IDEMPOTENT: [
        RemediationTier.LEVEL_1_MOCA,
        RemediationTier.LEVEL_2_UI_GUIDANCE,
        RemediationTier.LEVEL_3_GOVERNED_PATCH,
    ],
    RiskLevel.HIGH_RISK_MUTATION: [
        RemediationTier.LEVEL_3_GOVERNED_PATCH,
        RemediationTier.LEVEL_4_DUAL_CONTROL,
    ],
    RiskLevel.CRITICAL_RISK_STRUCTURAL: [
        RemediationTier.LEVEL_4_DUAL_CONTROL,
    ],
}

# ──────────────────────────────────────────────────────────────
# Risk Classification Keywords
# ──────────────────────────────────────────────────────────────

# Keywords in remediation steps that indicate mutation risk
MUTATION_RISK_KEYWORDS: FrozenSet[str] = frozenset({
    "update",
    "modify",
    "change",
    "set",
    "override",
    "correct",
    "patch",
    "fix",
    "adjust",
    "reset",
    "clear",
    "remove",
    "reassign",
    "release hold",
    "cancel",
})

READONLY_RISK_KEYWORDS: FrozenSet[str] = frozenset({
    "query",
    "check",
    "verify",
    "confirm",
    "inspect",
    "view",
    "list",
    "diagnostic",
    "read",
    "select",
    "report",
    "monitor",
})

# ──────────────────────────────────────────────────────────────
# Governance Policy Text Constants
# ──────────────────────────────────────────────────────────────

GOVERNANCE_POLICY_HEADER = """
╔══════════════════════════════════════════════════════════════╗
║  YONDER GRAPH — ZERO-ERROR GOVERNANCE POLICY               ║
║  Two-Tier Safety Architecture for Oracle WMS Operations     ║
╚══════════════════════════════════════════════════════════════╝
"""

TIER1_DESCRIPTION = (
    "Tier 1 (Cognitive Advisor): Google ADK GovernanceSafetyAgent evaluates "
    "operational risk, selects the appropriate remediation tier (MOCA → UI → "
    "Governed Patch → Dual-Control), and provides human-readable policy "
    "justifications for all safety restrictions."
)

TIER2_DESCRIPTION = (
    "Tier 2 (Deterministic Hard Guard): Python AST interceptor using sqlparse "
    "that strictly enforces read-only constraints on all diagnostic queries. "
    "Hard-blocks mutation tokens (UPDATE, DELETE, DROP, ALTER, TRUNCATE, MERGE, "
    "EXEC), injects Oracle ROWNUM ≤ 100 bounds, regex-sanitizes bind variables, "
    "and validates all referenced tables against the active Neo4j schema."
)
