"""
Yonder Graph — Multi-Agent Tool Definitions

Defines the function tools available to the multi-agent inference engine.
These tools bridge the agents to Neo4j, the governance layer, the audit
system, and the remediation policy engine.
"""

import json
import time
import logging
from typing import Any, Dict, List, Optional

from backend.database.neo4j_client import neo4j_client
from backend.governance.oracle_sql_validator import validate_with_neo4j_schema
from backend.governance.parameter_sanitizer import parameter_sanitizer
from backend.governance.remediation_policy import remediation_policy
from backend.governance.safety_rules import RiskLevel
from backend.audit.audit_logger import audit_logger, AuditTimer

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Tool 1: Knowledge Graph Query
# ──────────────────────────────────────────────────────────────

def query_knowledge_graph(
    cypher_query: str,
    session_id: str = "system",
) -> Dict[str, Any]:
    """
    Execute a read-only Cypher query against the Neo4j knowledge graph.
    
    Use this tool to retrieve SOP runbooks, table metadata, business flows,
    diagnostic SQL templates, and relationship paths from the knowledge graph.
    
    Args:
        cypher_query: A read-only Cypher MATCH/RETURN query.
        session_id: Current session identifier for audit logging.
    
    Returns:
        Dictionary with query results or error information.
    """
    with AuditTimer() as timer:
        try:
            results = neo4j_client.execute_read(cypher_query)
            audit_logger.log_cypher_query(
                session_id=session_id,
                agent_name="GraphRAGDiagnosticAgent",
                cypher=cypher_query,
                result_count=len(results),
                execution_time_ms=timer.elapsed_ms,
            )
            return {
                "status": "success",
                "result_count": len(results),
                "results": results[:50],  # Cap results for context window
            }
        except Exception as e:
            logger.error("Knowledge graph query failed: %s", e)
            return {
                "status": "error",
                "error": str(e),
                "cypher": cypher_query,
            }


# ──────────────────────────────────────────────────────────────
# Tool 2: Oracle SQL Validator (Tier 2 Gateway)
# ──────────────────────────────────────────────────────────────

def validate_oracle_sql(
    sql: str,
    session_id: str = "system",
) -> Dict[str, Any]:
    """
    Validate an Oracle diagnostic SQL query through the Tier 2 governance
    interceptor. Enforces read-only constraints, injects ROWNUM limits,
    validates table references against the Neo4j schema, and sanitizes
    bind parameters.
    
    This tool MUST be called on every SQL query before presenting it
    to the user. No SQL passes without Tier 2 validation.
    
    Args:
        sql: The Oracle SQL query to validate.
        session_id: Current session identifier for audit logging.
    
    Returns:
        Validation result with the safe SQL (if valid) or blocking errors.
    """
    with AuditTimer() as timer:
        result = validate_with_neo4j_schema(sql)

        audit_logger.log_governance_intercept(
            session_id=session_id,
            agent_name="Tier2_AST_Interceptor",
            tier="tier2",
            input_sql=sql,
            flags=result.to_dict(),
            blocked=not result.is_valid,
            explanation=(
                result.errors[0] if result.errors else "Validation passed"
            ),
        )

        return result.to_dict()


# ──────────────────────────────────────────────────────────────
# Tool 3: SQL Parameter Binding
# ──────────────────────────────────────────────────────────────

def bind_sql_parameters(
    sql_template: str,
    parameters: Dict[str, Any],
    session_id: str = "system",
) -> Dict[str, Any]:
    """
    Safely bind business key parameters to an Oracle SQL template.
    
    Validates parameter formats against known business key patterns
    (ORDNUM, LODNUM, WH_ID, etc.), sanitizes values, and generates
    both a display SQL and safe execution parameters.
    
    Args:
        sql_template: Oracle SQL with bind variables (e.g., :ordnum, :wh_id).
        parameters: Dictionary mapping parameter names to values.
        session_id: Current session identifier for audit logging.
    
    Returns:
        Dictionary with display SQL, sanitized parameters, and any errors.
    """
    with AuditTimer() as timer:
        display_sql, sanitized, errors = parameter_sanitizer.bind_parameters(
            sql_template, parameters
        )

        audit_logger.log_sql_binding(
            session_id=session_id,
            agent_name="SQLParameterBindingAgent",
            template_sql=sql_template,
            bound_sql=display_sql,
            parameters=parameters,
            execution_time_ms=timer.elapsed_ms,
        )

        return {
            "status": "success" if not errors else "validation_errors",
            "display_sql": display_sql,
            "sanitized_parameters": sanitized,
            "errors": errors,
            "bind_variables": parameter_sanitizer.extract_bind_params(
                sql_template
            ),
        }


# ──────────────────────────────────────────────────────────────
# Tool 4: Remediation Policy Lookup
# ──────────────────────────────────────────────────────────────

def get_remediation_policy(
    action_description: str,
    remediation_steps: str,
    domain: str = "general",
    session_id: str = "system",
) -> Dict[str, Any]:
    """
    Evaluate operational risk and retrieve the appropriate remediation
    recommendation from the Four-Tier Policy Engine.
    
    Analyzes the proposed action, classifies risk level, and returns the
    safest remediation approach (MOCA → UI → Governed Patch → Dual-Control).
    
    Args:
        action_description: Description of the issue or proposed action.
        remediation_steps: The remediation steps being considered.
        domain: WMS domain (Inbound, Outbound, Inventory, or general).
        session_id: Current session identifier for audit logging.
    
    Returns:
        Remediation recommendation with tier, justification, and preconditions.
    """
    risk_level = remediation_policy.evaluate_risk(
        action_description, remediation_steps
    )
    recommendation = remediation_policy.recommend(
        risk_level, action_description, domain
    )

    audit_logger.log(
        session_id=session_id,
        agent_name="GovernanceSafetyAgent",
        action_type="SAFETY_CHECK",
        input_payload={
            "action": action_description,
            "remediation": remediation_steps,
            "domain": domain,
        },
        output_payload=recommendation.to_dict(),
        status="SUCCESS",
        governance_tier1_eval={
            "risk_level": risk_level.value,
            "selected_tier": recommendation.tier.value,
            "requires_approval": recommendation.requires_sme_approval,
        },
    )

    return recommendation.to_dict()


# ──────────────────────────────────────────────────────────────
# Tool 5: Governance Decision Logger
# ──────────────────────────────────────────────────────────────

def log_governance_decision(
    session_id: str,
    decision: str,
    risk_level: str,
    tier_selected: str,
    justification: str,
    blocked: bool = False,
) -> Dict[str, Any]:
    """
    Log a governance decision made by the GovernanceSafetyAgent.
    
    Records the cognitive (Tier 1) governance evaluation for audit
    compliance and operational transparency.
    
    Args:
        session_id: Current session identifier.
        decision: The governance decision summary.
        risk_level: Classified risk level.
        tier_selected: Selected remediation tier.
        justification: Human-readable policy justification.
        blocked: Whether the action was blocked.
    
    Returns:
        Confirmation with the audit log entry ID.
    """
    log_id = audit_logger.log_governance_intercept(
        session_id=session_id,
        agent_name="GovernanceSafetyAgent",
        tier="tier1",
        flags={
            "decision": decision,
            "risk_level": risk_level,
            "tier_selected": tier_selected,
            "justification": justification,
        },
        blocked=blocked,
        explanation=justification,
    )

    return {
        "status": "logged",
        "audit_log_id": log_id,
        "decision": decision,
    }


# ──────────────────────────────────────────────────────────────
# Tool 6: Search SOP Runbooks
# ──────────────────────────────────────────────────────────────

def search_sop_runbooks(
    domain: str,
    issue_pattern: str,
    session_id: str = "system",
) -> Dict[str, Any]:
    """
    Search the Neo4j knowledge graph for matching SOP runbooks
    based on domain and issue pattern keywords.
    
    Args:
        domain: WMS domain (Inbound, Outbound, Inventory, or general).
        issue_pattern: Keywords describing the issue.
        session_id: Current session identifier.
    
    Returns:
        List of matching SOP runbooks with triage steps, diagnostic SQL, and titles.
    """
    import re
    cypher = """
    MATCH (sop:SOPRunbook)
    OPTIONAL MATCH (sop)-[:BELONGS_TO_DOMAIN]->(d:Domain)
    RETURN sop {
        .sop_id, .process_domain, .issue_pattern,
        .trigger_entity, .triage_steps, .db_targets,
        .diagnostic_sql, .root_cause_conditions,
        .resolution_steps, .risk_level, .prerequisites,
        .domain
    } AS runbook, coalesce(d.name, sop.domain, 'general') AS domain
    """
    try:
        results = neo4j_client.execute_read(cypher)
        if not results:
            return {"status": "success", "result_count": 0, "runbooks": []}

        stop_words = {
            "the", "a", "an", "is", "in", "at", "to", "for", "of", "and", "or", 
            "on", "with", "by", "from", "how", "what", "where", "show", "me", 
            "check", "please", "can", "you", "my", "this", "that", "these", 
            "those", "be", "it", "status", "issue", "ticket", "help"
        }

        # Extract search tokens
        raw_words = re.findall(r"\b[A-Za-z0-9_\-]+\b", issue_pattern or "")
        words = [w.lower() for w in raw_words if w.lower() not in stop_words and len(w) > 2]
        
        pattern_lower = (issue_pattern or "").lower()
        dom_lower = (domain or "").lower()

        scored = []
        for r in results:
            rb = r["runbook"]
            rb_dom = (r.get("domain") or "").lower()
            
            score = 0
            if dom_lower and dom_lower != "general":
                if dom_lower in rb_dom or rb_dom in dom_lower:
                    score += 15
                elif rb_dom != "general":
                    score -= 15

            # Direct SOP ID match (e.g. SOP-OUT-001)
            sop_id = (rb.get("sop_id") or "").lower()
            if sop_id and sop_id in pattern_lower:
                score += 100

            rb_pattern = (rb.get("issue_pattern") or "").lower()
            rb_pdomain = (rb.get("process_domain") or "").lower()
            rb_steps = str(rb.get("triage_steps") or "").lower()
            rb_causes = str(rb.get("root_cause_conditions") or "").lower()
            rb_targets = str(rb.get("db_targets") or "").lower()

            # Exact phrase match bonus
            if rb_pattern and (rb_pattern in pattern_lower or pattern_lower in rb_pattern):
                score += 50

            # Keyword matches
            for w in words:
                if w in rb_pattern:
                    score += 15
                if w in rb_pdomain:
                    score += 10
                if w in rb_causes:
                    score += 6
                if w in rb_steps:
                    score += 4
                if w in rb_targets:
                    score += 3

            # Supply chain intent heuristics
            if "planned" in pattern_lower and ("wave" in rb_pattern or "intake" in rb_pdomain):
                score += 25
            if "allocat" in pattern_lower and "allocat" in rb_pattern:
                score += 25
            if "hold" in pattern_lower and "hold" in rb_causes:
                score += 20
            if "pick" in pattern_lower and "pick" in rb_pattern:
                score += 20
            if "receiv" in pattern_lower and "receiv" in rb_pattern:
                score += 20
            if "ship" in pattern_lower and "ship" in rb_pattern:
                score += 20

            if score > 0:
                rb_copy = dict(rb)
                rb_copy["title"] = rb.get("issue_pattern") or rb.get("process_domain") or rb.get("sop_id")
                scored.append((score, rb_copy))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_runbooks = [item for score, item in scored[:5]]

        return {
            "status": "success",
            "result_count": len(top_runbooks),
            "runbooks": top_runbooks,
        }
    except Exception as e:
        logger.error("SOP search failed: %s", e)
        return {"status": "error", "error": str(e), "runbooks": []}


# ──────────────────────────────────────────────────────────────
# Tool 7: Get Table Schema Details
# ──────────────────────────────────────────────────────────────

def get_table_schema(
    table_name: str,
    session_id: str = "system",
) -> Dict[str, Any]:
    """
    Retrieve the full schema details for an Oracle WMS table from Neo4j.
    
    Returns columns, data types, primary keys, business definitions,
    and related tables.
    
    Args:
        table_name: Oracle table name (e.g., ORD, ORD_LINE, INVDTL).
        session_id: Current session identifier.
    
    Returns:
        Table schema with columns, keys, and relationships.
    """
    cypher = """
    MATCH (t:Table {oracle_table_name: $table_name})
    OPTIONAL MATCH (t)-[:HAS_COLUMN]->(c:Column)
    OPTIONAL MATCH (t)-[r]->(related:Table)
    RETURN t {.oracle_table_name, .graph_label, .business_purpose} AS table_info,
           collect(DISTINCT c {.column_name, .data_type, .is_primary_key, .graph_role, .business_definition}) AS columns,
           collect(DISTINCT {related_table: related.oracle_table_name, relationship: type(r)}) AS relationships
    """
    try:
        results = neo4j_client.execute_read(
            cypher, {"table_name": table_name.upper()}
        )
        if results:
            return {"status": "success", **results[0]}
        return {"status": "not_found", "table_name": table_name}
    except Exception as e:
        logger.error("Table schema query failed: %s", e)
        return {"status": "error", "error": str(e)}
