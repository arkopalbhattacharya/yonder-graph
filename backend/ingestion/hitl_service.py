"""
Yonder Graph — Human-in-the-Loop (HITL) Service

Handles SME corrections from thumbs-down feedback events and staged file reviews.
Enforces quality guardrails:
  - Corrected input must be more comprehensive than generated output
  - Must pass Tier 2 Oracle AST validation
  - Re-evaluates in an automated loop until confidence >= 90%
  - Patches Neo4j only when threshold is met
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.config import PENDING_REVIEW_DIR, settings
from backend.governance.oracle_sql_validator import validate_with_neo4j_schema
from backend.ingestion.enrichment_agent import enrichment_agent
from backend.audit.feedback_logger import feedback_logger
from backend.audit.audit_logger import audit_logger
from backend.database.neo4j_client import neo4j_client

logger = logging.getLogger(__name__)

MAX_REEVALUATION_ITERATIONS = 5


class HITLService:
    """
    Human-in-the-Loop Service for managing SME corrections and staged reviews.
    
    Provides:
      - Feedback correction processing (thumbs-down → SME fix → re-evaluate)
      - Staged file review queue management
      - Quality guardrail enforcement
      - Neo4j graph patching on approval
    """

    def process_correction(
        self,
        feedback_id: str,
        corrected_triage_steps: Optional[str] = None,
        corrected_sql: Optional[str] = None,
        corrected_moca: Optional[str] = None,
        root_cause_criteria: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process an SME correction submitted via thumbs-down feedback.
        
        Enforces quality guardrails and runs a re-evaluation loop
        until confidence >= 90% before patching the graph.
        
        Args:
            feedback_id: The UUID of the original feedback entry.
            corrected_triage_steps: Improved triage steps from SME.
            corrected_sql: Authoritative read-only Oracle SQL.
            corrected_moca: Corrected MOCA commands.
            root_cause_criteria: Root cause analysis criteria.
        
        Returns:
            Processing result with confidence scores and patch status.
        """
        result = {
            "feedback_id": feedback_id,
            "iterations": [],
            "final_confidence": 0,
            "status": "processing",
        }

        # Retrieve original feedback
        original = feedback_logger.get_feedback(feedback_id)
        if not original:
            return {
                "feedback_id": feedback_id,
                "status": "error",
                "error": "Feedback entry not found",
            }

        # ── Quality Guardrail 1: Comprehensiveness Check ──
        guardrail_errors = self._check_comprehensiveness(
            original=original.get("generated_response", {}),
            corrected_triage=corrected_triage_steps,
            corrected_sql=corrected_sql,
        )
        if guardrail_errors:
            feedback_logger.update_correction(
                feedback_id=feedback_id,
                validation_errors={"guardrail_errors": guardrail_errors},
                resolution_status="CONFIDENCE_REJECTED",
            )
            return {
                "feedback_id": feedback_id,
                "status": "rejected",
                "errors": guardrail_errors,
            }

        # ── Quality Guardrail 2: Tier 2 SQL Validation ──
        if corrected_sql:
            sql_validation = validate_with_neo4j_schema(corrected_sql)
            if not sql_validation.is_valid:
                feedback_logger.update_correction(
                    feedback_id=feedback_id,
                    corrected_sql=corrected_sql,
                    validation_errors={
                        "sql_errors": sql_validation.errors,
                        "sql_flags": sql_validation.flags,
                    },
                    resolution_status="CONFIDENCE_REJECTED",
                )
                return {
                    "feedback_id": feedback_id,
                    "status": "sql_validation_failed",
                    "sql_errors": sql_validation.errors,
                    "sql_flags": sql_validation.flags,
                }

        # ── Re-evaluation Loop ──
        threshold = settings.auto_ingest_confidence_threshold
        combined_content = self._build_correction_content(
            corrected_triage_steps, corrected_sql,
            corrected_moca, root_cause_criteria,
        )

        for iteration in range(1, MAX_REEVALUATION_ITERATIONS + 1):
            eval_result = enrichment_agent.evaluate(
                filename=f"correction_{feedback_id}",
                content=combined_content,
                file_type=".md",
            )

            confidence = eval_result.get("confidence_score", 0)
            result["iterations"].append({
                "iteration": iteration,
                "confidence": confidence,
                "breakdown": eval_result.get("score_breakdown", {}),
            })

            if confidence >= threshold:
                # Confidence met — patch the graph
                result["final_confidence"] = confidence
                result["status"] = "approved"

                self._patch_graph(
                    feedback_id=feedback_id,
                    original=original,
                    corrected_triage=corrected_triage_steps,
                    corrected_sql=corrected_sql,
                    corrected_moca=corrected_moca,
                    root_cause=root_cause_criteria,
                    confidence=confidence,
                )

                feedback_logger.update_correction(
                    feedback_id=feedback_id,
                    corrected_triage_steps=corrected_triage_steps,
                    corrected_sql=corrected_sql,
                    corrected_moca=corrected_moca,
                    confidence_score=confidence,
                    resolution_status="APPLIED_TO_GRAPH",
                )

                logger.info(
                    "Correction approved and applied: %s (confidence: %.1f%%)",
                    feedback_id,
                    confidence,
                )
                return result

            logger.info(
                "Re-evaluation iteration %d: confidence %.1f%% < %.1f%%",
                iteration,
                confidence,
                threshold,
            )

        # Max iterations reached without meeting threshold
        result["final_confidence"] = result["iterations"][-1]["confidence"]
        result["status"] = "confidence_rejected"

        feedback_logger.update_correction(
            feedback_id=feedback_id,
            corrected_triage_steps=corrected_triage_steps,
            corrected_sql=corrected_sql,
            corrected_moca=corrected_moca,
            confidence_score=result["final_confidence"],
            resolution_status="CONFIDENCE_REJECTED",
        )

        return result

    def get_pending_reviews(self) -> List[Dict[str, Any]]:
        """Return all files in the staging/pending_review directory."""
        pending = []
        if not PENDING_REVIEW_DIR.exists():
            return pending

        for filepath in sorted(PENDING_REVIEW_DIR.glob("*_review.json")):
            try:
                data = json.loads(filepath.read_text(encoding="utf-8"))
                data["review_file"] = filepath.name
                pending.append(data)
            except Exception as e:
                logger.warning("Could not read review file %s: %s", filepath.name, e)

        return pending

    def process_review(
        self,
        review_filename: str,
        approved: bool,
        sme_edits: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Process an SME review of a staged file.
        
        Args:
            review_filename: Name of the review JSON file.
            approved: Whether the SME approves the ingestion.
            sme_edits: Optional edits from the SME.
        
        Returns:
            Processing result with final status.
        """
        review_path = PENDING_REVIEW_DIR / review_filename
        if not review_path.exists():
            return {"status": "error", "error": "Review file not found"}

        try:
            data = json.loads(review_path.read_text(encoding="utf-8"))
        except Exception as e:
            return {"status": "error", "error": f"Could not read review file: {e}"}

        if approved:
            # Re-evaluate with SME edits if provided
            if sme_edits:
                content = json.dumps(sme_edits, indent=2)
                eval_result = enrichment_agent.evaluate(
                    filename=data.get("source_file", review_filename),
                    content=content,
                    file_type=".json",
                )
                confidence = eval_result.get("confidence_score", 0)
                threshold = settings.auto_ingest_confidence_threshold

                if confidence < threshold:
                    return {
                        "status": "confidence_rejected",
                        "confidence": confidence,
                        "threshold": threshold,
                        "breakdown": eval_result.get("score_breakdown", {}),
                    }

            # Remove review file on approval
            review_path.unlink()
            return {"status": "approved", "action": "ingested_to_graph"}
        else:
            # Rejected — archive the review file
            review_path.unlink()
            return {"status": "rejected"}

    def _check_comprehensiveness(
        self,
        original: Dict[str, Any],
        corrected_triage: Optional[str],
        corrected_sql: Optional[str],
    ) -> List[str]:
        """Check that corrected content is more comprehensive than the original."""
        errors = []

        if not corrected_triage and not corrected_sql:
            errors.append(
                "At least one correction field (triage steps or SQL) is required"
            )

        if corrected_triage:
            original_steps = str(original.get("triage_steps", ""))
            if len(corrected_triage.strip()) < len(original_steps) * 0.5:
                errors.append(
                    "Corrected triage steps appear less comprehensive than "
                    "the original. Corrections should be more detailed."
                )

        return errors

    def _build_correction_content(
        self,
        triage: Optional[str],
        sql: Optional[str],
        moca: Optional[str],
        root_cause: Optional[str],
    ) -> str:
        """Build combined content string for re-evaluation."""
        parts = []
        if triage:
            parts.append(f"## Triage Steps\n{triage}")
        if sql:
            parts.append(f"## Diagnostic SQL\n```sql\n{sql}\n```")
        if moca:
            parts.append(f"## MOCA Commands\n{moca}")
        if root_cause:
            parts.append(f"## Root Cause Criteria\n{root_cause}")
        return "\n\n".join(parts)

    def _patch_graph(
        self,
        feedback_id: str,
        original: Dict[str, Any],
        corrected_triage: Optional[str],
        corrected_sql: Optional[str],
        corrected_moca: Optional[str],
        root_cause: Optional[str],
        confidence: float,
    ) -> None:
        """Patch the Neo4j graph with approved corrections."""
        sop_id = original.get("matched_sop_id")
        if not sop_id:
            logger.info(
                "No matched SOP ID for feedback %s — creating new knowledge node",
                feedback_id,
            )
            neo4j_client.execute_write(
                """
                CREATE (sop:SOPRunbook {
                    sop_id: $sop_id,
                    triage_steps: $triage,
                    diagnostic_sql: $sql,
                    moca_commands: $moca,
                    root_cause_conditions: $root_cause,
                    source: 'sme_correction',
                    feedback_id: $feedback_id,
                    confidence_score: $confidence,
                    lastLoadedAt: datetime()
                })
                """,
                {
                    "sop_id": f"SME-{feedback_id[:8]}",
                    "triage": corrected_triage or "",
                    "sql": corrected_sql or "",
                    "moca": corrected_moca or "",
                    "root_cause": root_cause or "",
                    "feedback_id": feedback_id,
                    "confidence": confidence,
                },
            )
            return

        # Update existing SOP
        update_parts = []
        params: Dict[str, Any] = {"sop_id": sop_id}

        if corrected_triage:
            update_parts.append("sop.triage_steps = $triage")
            params["triage"] = corrected_triage
        if corrected_sql:
            update_parts.append("sop.diagnostic_sql = $sql")
            params["sql"] = corrected_sql
        if corrected_moca:
            update_parts.append("sop.moca_commands = $moca")
            params["moca"] = corrected_moca
        if root_cause:
            update_parts.append("sop.root_cause_conditions = $root_cause")
            params["root_cause"] = root_cause

        update_parts.append("sop.last_corrected_by = 'sme'")
        update_parts.append("sop.correction_feedback_id = $feedback_id")
        update_parts.append("sop.correction_confidence = $confidence")
        update_parts.append("sop.lastLoadedAt = datetime()")
        params["feedback_id"] = feedback_id
        params["confidence"] = confidence

        cypher = (
            f"MATCH (sop:SOPRunbook {{sop_id: $sop_id}}) "
            f"SET {', '.join(update_parts)}"
        )
        neo4j_client.execute_write(cypher, params)
        logger.info("Graph patched for SOP %s via feedback %s", sop_id, feedback_id)


# Module-level singleton
hitl_service = HITLService()
