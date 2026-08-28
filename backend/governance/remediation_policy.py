"""
Yonder Graph — Four-Tier Remediation Policy Engine

Implements the graduated remediation policy for Blue Yonder WMS operations:
  Level 1 (Preferred): Standard MOCA commands
  Level 2 (DDA/UI):    Web UI navigation guidance
  Level 3 (Governed):  PL/SQL dry-run blocks with pre-conditions
  Level 4 (Dual-Control): Secondary SME approval gate

Provides policy selection logic, human-readable justification templates,
and risk-appropriate remediation recommendations.
"""

import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

from backend.governance.safety_rules import (
    RiskLevel,
    RemediationTier,
    RISK_REMEDIATION_MAP,
    MUTATION_RISK_KEYWORDS,
    READONLY_RISK_KEYWORDS,
)

logger = logging.getLogger(__name__)


@dataclass
class RemediationRecommendation:
    """A structured remediation recommendation with policy justification."""

    tier: RemediationTier
    risk_level: RiskLevel
    recommended_action: str
    policy_justification: str
    preconditions: List[str] = field(default_factory=list)
    rollback_steps: List[str] = field(default_factory=list)
    requires_sme_approval: bool = False
    moca_command: Optional[str] = None
    ui_navigation: Optional[str] = None
    plsql_block: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tier": self.tier.value,
            "risk_level": self.risk_level.value,
            "recommended_action": self.recommended_action,
            "policy_justification": self.policy_justification,
            "preconditions": self.preconditions,
            "rollback_steps": self.rollback_steps,
            "requires_sme_approval": self.requires_sme_approval,
            "moca_command": self.moca_command,
            "ui_navigation": self.ui_navigation,
            "plsql_block": self.plsql_block,
        }


class RemediationPolicy:
    """
    Four-Tier Remediation Policy Engine.
    
    Evaluates the risk level of a proposed action and recommends the
    safest appropriate remediation approach, always preferring
    MOCA commands over direct database mutations.
    """

    # ── Level 1: MOCA Command Templates ──
    MOCA_TEMPLATES: Dict[str, Dict[str, str]] = {
        "wave_override": {
            "command": "allocate wave override",
            "description": "Override wave allocation for a specific order",
            "use_case": "Order not waving due to configuration mismatch",
        },
        "reprocess_integrator": {
            "command": "reprocess integrator message",
            "description": "Reprocess a failed integrator message",
            "use_case": "Stuck or failed inbound/outbound integrator transaction",
        },
        "release_inventory_hold": {
            "command": "release inventory hold",
            "description": "Release a hold on inventory detail lines",
            "use_case": "Inventory blocked by stale or resolved hold condition",
        },
        "cancel_pick": {
            "command": "cancel pick",
            "description": "Cancel an active pick assignment",
            "use_case": "Pick needs to be cancelled and requeued",
        },
        "allocate_work": {
            "command": "allocate work",
            "description": "Trigger allocation for pending work",
            "use_case": "Pending allocation after hold release or config fix",
        },
        "create_movement": {
            "command": "create inventory move",
            "description": "Create an inventory movement between locations",
            "use_case": "Inventory needs relocation for fulfillment",
        },
        "reopen_receipt": {
            "command": "reopen receipt line",
            "description": "Reopen a prematurely closed receipt line",
            "use_case": "Receipt line closed before full quantity received",
        },
    }

    # ── Level 2: UI Navigation Templates ──
    UI_TEMPLATES: Dict[str, Dict[str, str]] = {
        "inventory_holds": {
            "navigation": "Inventory > Holds > Search by LODNUM/PRTNUM > Review & Release",
            "description": "Review and release inventory holds via the web UI",
        },
        "order_maintenance": {
            "navigation": "Outbound > Orders > Search by ORDNUM > Order Maintenance",
            "description": "Modify order attributes via the authorized UI workflow",
        },
        "wave_planning": {
            "navigation": "Outbound > Wave Planning > Wave Templates > Edit Selection Criteria",
            "description": "Adjust wave selection criteria and parameters",
        },
        "receiving": {
            "navigation": "Inbound > Receiving > Open Receipts > Process Receipt",
            "description": "Process or correct receiving transactions",
        },
        "cycle_count": {
            "navigation": "Inventory > Cycle Count > Initiate Count > Resolve Discrepancy",
            "description": "Initiate a cycle count to resolve location discrepancies",
        },
        "appointment_scheduling": {
            "navigation": "Inbound > Appointments > Dock Scheduler > Create/Edit Appointment",
            "description": "Schedule or modify dock appointments",
        },
    }

    # ── Level 3: PL/SQL Dry-Run Block Templates ──
    PLSQL_TEMPLATE = """
-- ═══════════════════════════════════════════════════════════
-- GOVERNED DATA PATCH — REQUIRES PRE-CONDITION VALIDATION
-- Generated by Yonder Graph Governance Engine
-- Risk Level: {risk_level}
-- ═══════════════════════════════════════════════════════════

-- STEP 1: PRE-CONDITION ASSERTIONS (MUST ALL PASS)
{precondition_checks}

-- STEP 2: DRY-RUN PREVIEW (VERIFY BEFORE COMMIT)
{dry_run_select}

-- STEP 3: PATCH STATEMENT (EXECUTE ONLY AFTER DRY-RUN REVIEW)
-- ⚠️ UNCOMMENT ONLY AFTER SME REVIEW AND PRE-CONDITION PASS
-- BEGIN
--   {patch_statement}
--   COMMIT;
-- EXCEPTION
--   WHEN OTHERS THEN
--     ROLLBACK;
--     RAISE;
-- END;
-- /

-- STEP 4: POST-CONDITION VERIFICATION
{postcondition_check}
"""

    @classmethod
    def evaluate_risk(
        cls, action_description: str, remediation_steps: str
    ) -> RiskLevel:
        """
        Evaluate the risk level of a proposed action based on keyword analysis.
        
        This is a deterministic classification used alongside the Tier 1
        cognitive evaluation from the GovernanceSafetyAgent.
        """
        combined_text = (
            f"{action_description} {remediation_steps}"
        ).lower()

        # Check for structural risk indicators
        structural_keywords = {"drop", "alter", "truncate", "schema", "index"}
        if any(kw in combined_text for kw in structural_keywords):
            return RiskLevel.CRITICAL_RISK_STRUCTURAL

        # Check for mutation risk
        mutation_count = sum(
            1 for kw in MUTATION_RISK_KEYWORDS if kw in combined_text
        )
        readonly_count = sum(
            1 for kw in READONLY_RISK_KEYWORDS if kw in combined_text
        )

        if mutation_count >= 3:
            return RiskLevel.HIGH_RISK_MUTATION
        elif mutation_count >= 1:
            return RiskLevel.MEDIUM_RISK_IDEMPOTENT
        else:
            return RiskLevel.LOW_RISK_READONLY

    @classmethod
    def get_allowed_tiers(cls, risk_level: RiskLevel) -> List[RemediationTier]:
        """Return the remediation tiers permitted for a given risk level."""
        return RISK_REMEDIATION_MAP.get(risk_level, [])

    @classmethod
    def recommend(
        cls,
        risk_level: RiskLevel,
        issue_description: str,
        domain: str = "general",
    ) -> RemediationRecommendation:
        """
        Generate a remediation recommendation based on risk level and domain.
        
        Always prefers the lowest-tier (safest) approach available.
        """
        allowed_tiers = cls.get_allowed_tiers(risk_level)

        if not allowed_tiers:
            return RemediationRecommendation(
                tier=RemediationTier.LEVEL_4_DUAL_CONTROL,
                risk_level=risk_level,
                recommended_action="Escalate to senior SME for manual resolution",
                policy_justification=(
                    "This action has been classified at the highest risk level. "
                    "No automated remediation is available. A dual-control gate "
                    "requires two authorized personnel to review and approve "
                    "any changes before execution."
                ),
                requires_sme_approval=True,
            )

        preferred_tier = allowed_tiers[0]

        if preferred_tier == RemediationTier.LEVEL_1_MOCA:
            return cls._build_moca_recommendation(
                risk_level, issue_description, domain
            )
        elif preferred_tier == RemediationTier.LEVEL_2_UI_GUIDANCE:
            return cls._build_ui_recommendation(
                risk_level, issue_description, domain
            )
        elif preferred_tier == RemediationTier.LEVEL_3_GOVERNED_PATCH:
            return cls._build_governed_patch_recommendation(
                risk_level, issue_description
            )
        else:
            return cls._build_dual_control_recommendation(
                risk_level, issue_description
            )

    @classmethod
    def _build_moca_recommendation(
        cls, risk_level: RiskLevel, issue: str, domain: str
    ) -> RemediationRecommendation:
        """Build a Level 1 MOCA command recommendation."""
        # Find the best matching MOCA template
        best_match = None
        issue_lower = (issue or "").lower()
        for key, template in cls.MOCA_TEMPLATES.items():
            if any(
                word in issue_lower
                for word in template["use_case"].lower().split()
            ):
                best_match = (key, template)
                break

        if best_match:
            key, template = best_match
            return RemediationRecommendation(
                tier=RemediationTier.LEVEL_1_MOCA,
                risk_level=risk_level,
                recommended_action=template["description"],
                policy_justification=(
                    f"Level 1 (Preferred): The recommended resolution uses the "
                    f"standard Blue Yonder MOCA service call '{template['command']}'. "
                    f"MOCA commands are the safest remediation path because they "
                    f"execute through the application's validated business logic layer, "
                    f"which enforces all referential integrity, audit trails, and "
                    f"rollback safeguards automatically."
                ),
                moca_command=template["command"],
                preconditions=[
                    "Verify the current state of the affected entity before executing",
                    "Confirm the MOCA command environment is connected to the correct warehouse",
                ],
            )

        return RemediationRecommendation(
            tier=RemediationTier.LEVEL_1_MOCA,
            risk_level=risk_level,
            recommended_action=(
                "Execute the appropriate MOCA service call for this scenario"
            ),
            policy_justification=(
                "Level 1 (Preferred): MOCA commands execute through Blue Yonder's "
                "validated business logic layer, ensuring referential integrity "
                "and audit compliance."
            ),
        )

    @classmethod
    def _build_ui_recommendation(
        cls, risk_level: RiskLevel, issue: str, domain: str
    ) -> RemediationRecommendation:
        """Build a Level 2 UI navigation recommendation."""
        best_match = None
        issue_lower = (issue or "").lower()
        for key, template in cls.UI_TEMPLATES.items():
            if any(
                word in issue_lower
                for word in template["description"].lower().split()
            ):
                best_match = (key, template)
                break

        if best_match:
            key, template = best_match
            return RemediationRecommendation(
                tier=RemediationTier.LEVEL_2_UI_GUIDANCE,
                risk_level=risk_level,
                recommended_action=template["description"],
                policy_justification=(
                    f"Level 2 (DDA/UI Guidance): Navigate to "
                    f"'{template['navigation']}' in the Blue Yonder Web UI. "
                    f"The UI workflow includes built-in validation, "
                    f"authorization checks, and audit logging."
                ),
                ui_navigation=template["navigation"],
            )

        return RemediationRecommendation(
            tier=RemediationTier.LEVEL_2_UI_GUIDANCE,
            risk_level=risk_level,
            recommended_action=(
                "Use the Blue Yonder Web UI workflow for this modification"
            ),
            policy_justification=(
                "Level 2 (DDA/UI): The Blue Yonder Web UI enforces "
                "authorization, validation, and audit logging."
            ),
        )

    @classmethod
    def _build_governed_patch_recommendation(
        cls, risk_level: RiskLevel, issue: str
    ) -> RemediationRecommendation:
        """Build a Level 3 governed data patch recommendation."""
        return RemediationRecommendation(
            tier=RemediationTier.LEVEL_3_GOVERNED_PATCH,
            risk_level=risk_level,
            recommended_action=(
                "Execute a governed PL/SQL data patch with mandatory "
                "pre-condition checks and rollback handlers"
            ),
            policy_justification=(
                "Level 3 (Governed Data Patch): Direct database modification "
                "is required because no MOCA command or UI workflow exists for "
                "this specific correction. The patch MUST include: "
                "(1) Pre-condition assertions to verify current state, "
                "(2) A dry-run SELECT preview, "
                "(3) The actual UPDATE wrapped in a BEGIN/EXCEPTION/ROLLBACK block, "
                "(4) Post-condition verification. "
                "This patch must be reviewed by an authorized DBA or senior SME "
                "before execution."
            ),
            requires_sme_approval=True,
            preconditions=[
                "Verify the affected record exists and matches expected state",
                "Confirm no concurrent transactions are modifying the same data",
                "Take a pre-patch snapshot (SELECT) for audit comparison",
            ],
            rollback_steps=[
                "ROLLBACK is automatic within the PL/SQL EXCEPTION block",
                "If committed, restore from the pre-patch snapshot values",
                "Re-run the diagnostic query to verify restoration",
            ],
        )

    @classmethod
    def _build_dual_control_recommendation(
        cls, risk_level: RiskLevel, issue: str
    ) -> RemediationRecommendation:
        """Build a Level 4 dual-control gate recommendation."""
        return RemediationRecommendation(
            tier=RemediationTier.LEVEL_4_DUAL_CONTROL,
            risk_level=risk_level,
            recommended_action=(
                "Escalate to dual-control gate: requires two authorized "
                "personnel to independently review and approve before execution"
            ),
            policy_justification=(
                "Level 4 (Dual-Control Gate): This action has been classified "
                "as HIGH or CRITICAL risk. The Yonder Graph governance policy "
                "requires secondary SME approval for any action that could: "
                "(1) Modify structural database objects, "
                "(2) Affect multiple orders/inventory simultaneously, "
                "(3) Bypass standard application validation controls. "
                "Both the requesting engineer and an independent approver must "
                "sign off before any execution proceeds."
            ),
            requires_sme_approval=True,
            preconditions=[
                "Primary SME has documented the root cause analysis",
                "Independent secondary SME has reviewed the proposed fix",
                "Both approvers have signed off on the change ticket",
                "A rollback plan has been documented and tested",
            ],
        )

    @classmethod
    def get_full_policy_document(cls) -> Dict[str, Any]:
        """Return the complete governance policy for in-app rendering."""
        return {
            "title": "Yonder Graph — Zero-Error Governance & Remediation Policy",
            "version": "1.0.0",
            "tiers": [
                {
                    "level": 1,
                    "name": "MOCA Service Call (Preferred)",
                    "description": (
                        "Standard Blue Yonder MOCA commands that execute "
                        "through the application's validated business logic "
                        "layer. Safest option — enforces referential integrity, "
                        "audit trails, and automatic rollback."
                    ),
                    "risk_levels": ["LOW_RISK_READONLY", "MEDIUM_RISK_IDEMPOTENT"],
                    "examples": list(cls.MOCA_TEMPLATES.values()),
                },
                {
                    "level": 2,
                    "name": "DDA / Web UI Guidance",
                    "description": (
                        "Step-by-step navigation through the Blue Yonder Web UI. "
                        "The UI enforces authorization, validation rules, and "
                        "maintains complete audit logging."
                    ),
                    "risk_levels": ["LOW_RISK_READONLY", "MEDIUM_RISK_IDEMPOTENT"],
                    "examples": list(cls.UI_TEMPLATES.values()),
                },
                {
                    "level": 3,
                    "name": "Governed Data Patch (PL/SQL)",
                    "description": (
                        "Direct database modification via PL/SQL with mandatory "
                        "pre-condition checks, dry-run preview, exception/rollback "
                        "handling, and post-condition verification."
                    ),
                    "risk_levels": ["MEDIUM_RISK_IDEMPOTENT", "HIGH_RISK_MUTATION"],
                    "requires_approval": True,
                },
                {
                    "level": 4,
                    "name": "Dual-Control Gate",
                    "description": (
                        "Highest security tier requiring two independent authorized "
                        "personnel to review and approve before execution. Used for "
                        "structural changes and multi-entity mutations."
                    ),
                    "risk_levels": ["HIGH_RISK_MUTATION", "CRITICAL_RISK_STRUCTURAL"],
                    "requires_approval": True,
                },
            ],
            "oracle_safety": {
                "read_only_enforcement": (
                    "All diagnostic SQL queries are strictly read-only. "
                    "The Tier 2 AST interceptor blocks INSERT, UPDATE, DELETE, "
                    "DROP, ALTER, TRUNCATE, MERGE, GRANT, REVOKE, EXEC."
                ),
                "row_limit": (
                    "ROWNUM <= 100 is automatically injected into all queries "
                    "without an existing row cap to prevent unbounded scans."
                ),
                "schema_validation": (
                    "All referenced tables must exist as registered nodes in "
                    "the Neo4j knowledge graph."
                ),
                "parameter_sanitization": (
                    "Oracle bind parameters are validated against regex patterns "
                    "for known business keys (ORDNUM, LODNUM, WH_ID, etc.)."
                ),
            },
        }


# Module-level singleton
remediation_policy = RemediationPolicy()
