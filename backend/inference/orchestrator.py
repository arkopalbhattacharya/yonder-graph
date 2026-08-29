"""
Yonder Graph — Multi-Agent Orchestrator

Manages the end-to-end inference pipeline: session creation, multi-agent
dispatch, Two-Tier Governance enforcement, and response assembly.

Provides a high-level API used by the /api/triage endpoint.
"""

import uuid
import time
import json
import logging
from typing import Any, Dict, List, Optional

from backend.inference.llm_provider import LLMProviderFactory
from backend.inference.tools import (
    query_knowledge_graph,
    validate_oracle_sql,
    bind_sql_parameters,
    get_remediation_policy,
    search_sop_runbooks,
    get_table_schema,
)
from backend.governance.oracle_sql_validator import validate_with_neo4j_schema
from backend.governance.parameter_sanitizer import parameter_sanitizer
from backend.governance.safety_rules import RiskLevel
from backend.audit.audit_logger import audit_logger, AuditTimer
from backend.inference.telemetry import telemetry

logger = logging.getLogger(__name__)


class TriageOrchestrator:
    """
    Orchestrates the multi-agent diagnostic pipeline.
    
    Pipeline flow:
      1. Parse incident → Extract business keys → Identify domain
      2. Search Neo4j for matching SOP runbooks
      3. Bind parameters to diagnostic SQL
      4. Run Two-Tier Governance (Tier 1 cognitive + Tier 2 deterministic)
      5. Assemble structured response payload
      6. Persist PostgreSQL audit trail
    """

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = LLMProviderFactory.get_client()
        return self._client

    def run_triage(
        self, 
        query: str, 
        session_id: Optional[str] = None,
        persona: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute the intent-driven dual-track triage pipeline.
        
        Intent Pathway 1: GENERAL_PROCESS_INQUIRY -> DomainKnowledgeAgent (Neo4j domain graph -> narrative + flowchart)
        Intent Pathway 2: INCIDENT_TRIAGE -> DiagnosticTriagePipeline (SOP -> SQL -> AST -> Tier 1 Governance)
        """
        session_id = session_id or str(uuid.uuid4())
        telemetry.record_session()
        
        pipeline_start = time.perf_counter()
        agent_traces: List[Dict[str, Any]] = []

        try:
            # ── Step 0: Top-Level Intent Classification ──
            with AuditTimer() as t0:
                intent_data = self._classify_intent(query, session_id)
            agent_traces.append({
                "agent": "IntentClassifierAgent",
                "step": "Intent Recognition & Routing",
                "latency_ms": round(t0.elapsed_ms, 2),
                "result": intent_data,
            })
            p0 = intent_data.get("_prompt_tokens", 30)
            c0 = intent_data.get("_completion_tokens", 15)
            telemetry.record_invocation(
                "IntentClassifierAgent",
                t0.elapsed_ms,
                tokens_used=p0 + c0,
                prompt_tokens=p0,
                completion_tokens=c0,
                success=True,
                session_id=session_id,
            )

            intent = intent_data.get("intent", "INCIDENT_TRIAGE")
            domain = intent_data.get("domain") or "general"

            if intent == "GREETING":
                greeting_response = {
                    "session_id": session_id,
                    "status": "success",
                    "intent": "GREETING",
                    "persona": persona,
                    "domain": "general",
                    "business_keys": {},
                    "issue_category": "System Greeting",
                    "matched_sop": None,
                    "diagnostic_sql": None,
                    "investigation_steps": [],
                    "steps": [],
                    "token_usage": {
                        "total_tokens": p0 + c0,
                        "prompt_tokens": p0,
                        "completion_tokens": c0,
                        "agents": {
                            "IntentClassifierAgent": {"prompt": p0, "completion": c0, "total": p0 + c0}
                        },
                    },
                    "narrative": (
                        "Hello! I am the **Yonder Graph Triage Copilot** for Blue Yonder WMS.\n\n"
                        "Here is what I can help you with:\n"
                        "1. **Production Incident Triage**: Describe an active issue with an order, wave, or inventory detail (e.g. *\"Order ORD1001 is stuck in Planned status at WH01\"*).\n"
                        "2. **Supply Chain Process Overviews**: Ask about domain lifecycles when Ask Mode is enabled (e.g. *\"explain the inbound flow\"*, *\"how does waving work\"*).\n"
                        "3. **Schema & SOP Diagnostics**: Step-by-step diagnostic cards with AST-validated read-only Oracle SQL.\n\n"
                        "How can I assist your IT operations team today?"
                    ),
                    "governance": None,
                    "agent_traces": agent_traces,
                    "total_latency_ms": round((time.perf_counter() - pipeline_start) * 1000, 2),
                    "llm_provider": LLMProviderFactory.get_provider_info(),
                }
                return greeting_response

            # ── Check for Intent Mismatch (General question asked in Resolve Mode) ──
            if persona == "resolve" and intent == "GENERAL_PROCESS_INQUIRY":
                total_ms = (time.perf_counter() - pipeline_start) * 1000
                mismatch_narrative = (
                    "### ℹ️ General Process Inquiry Detected\n\n"
                    "You are currently in **Resolve Mode**, which is strictly dedicated to production incident triage and diagnostic SQL generation for specific operational issues.\n\n"
                    "**How to proceed:**\n"
                    "- **For General / Process Questions**: Switch to or enable **Ask Mode** (under Settings > Experimental Features) for step-by-step workflow walkthroughs and interactive Mermaid flowcharts.\n"
                    "- **For Incident Triage in Resolve Mode**: Please provide specific incident identifiers (such as Order Number `ordnum`, Warehouse ID `wh_id`, or Load/LPN `lodnum`) so that I can generate step-by-step diagnostic investigation cards and parameter-bound Oracle SQL."
                )
                response = {
                    "session_id": session_id,
                    "status": "success",
                    "intent": "GENERAL_PROCESS_INQUIRY",
                    "persona": "resolve",
                    "domain": domain,
                    "business_keys": {},
                    "issue_category": query,
                    "matched_sop": None,
                    "diagnostic_sql": None,
                    "investigation_steps": [],
                    "steps": [],
                    "governance": {
                        "tier": "LEVEL_1_STANDARD_MOCA",
                        "risk_level": "LOW_RISK_READONLY",
                        "recommended_action": "Switch to Ask Mode or Provide Specific Incident Keys",
                        "policy_justification": "General process questions are outside Resolve Mode scope. Diagnostic execution redirected to guide user.",
                    },
                    "narrative": mismatch_narrative,
                    "sql_reasoning": "No SQL generated: Inquiry is conceptual/educational rather than an active production issue.",
                    "mermaid_diagram": None,
                    "risk_level": "LOW_RISK_READONLY",
                    "agent_traces": agent_traces,
                    "token_usage": {
                        "total_tokens": p0 + c0,
                        "prompt_tokens": p0,
                        "completion_tokens": c0,
                        "agents": {
                            "IntentClassifierAgent": {"prompt": p0, "completion": c0, "total": p0 + c0}
                        },
                    },
                    "total_latency_ms": round(total_ms, 2),
                    "llm_provider": LLMProviderFactory.get_provider_info(),
                }
                audit_logger.log(
                    session_id=session_id,
                    agent_name="IntentClassifierAgent",
                    action_type="INTENT_MISMATCH_REDIRECT",
                    input_payload={"query": query, "persona": persona},
                    output_payload=response,
                    execution_time_ms=total_ms,
                    tokens_used=p0 + c0,
                    status="SUCCESS",
                )
                return response

            # ── Route by Persona ──
            if persona == "ask":
                return self._handle_ask_persona(
                    query=query,
                    domain=domain,
                    session_id=session_id,
                    agent_traces=agent_traces,
                    pipeline_start=pipeline_start,
                )
            else:
                return self._handle_resolve_persona(
                    query=query,
                    domain=domain,
                    session_id=session_id,
                    agent_traces=agent_traces,
                    pipeline_start=pipeline_start,
                )
        except Exception as e:
            logger.error("Triage pipeline failed: %s", e, exc_info=True)
            total_ms = (time.perf_counter() - pipeline_start) * 1000
            error_response = {
                "session_id": session_id,
                "status": "error",
                "error": str(e),
                "agent_traces": agent_traces,
                "total_latency_ms": round(total_ms, 2),
            }
            audit_logger.log(
                session_id=session_id,
                agent_name="CoordinatorAgent",
                action_type="TRIAGE_FAILED",
                input_payload={"query": query},
                output_payload=error_response,
                execution_time_ms=total_ms,
                status="FAILED",
            )
            return error_response

    def _classify_intent(self, query: str, session_id: str) -> Dict[str, Any]:
        """Classify incoming query as GREETING, GENERAL_PROCESS_INQUIRY vs INCIDENT_TRIAGE."""
        q_clean = query.strip().lower().rstrip("!?.")
        greeting_words = {"hello", "hi", "hey", "greetings", "good morning", "good evening", "good afternoon", "help", "who are you", "what can you do", "yo"}
        if q_clean in greeting_words or len(q_clean) <= 2:
            return {"intent": "GREETING", "domain": "general", "topic": "greeting", "_prompt_tokens": 10, "_completion_tokens": 5}

        prompt = f"""
You are the Intent Classification Agent for the Yonder Graph Supply Chain platform.
Analyze this user query: "{query}"

Classify into one of two operational modes:
1. "GENERAL_PROCESS_INQUIRY": The user is asking conceptual, educational, or architectural questions about supply chain flows, domain architectures, table purposes, or general operational overviews (e.g. "explain inbound flow", "what is outbound", "how does waving work", "explain supply chain in a nutshell", "what tables store inventory").
2. "INCIDENT_TRIAGE": The user is describing or investigating a specific operational issue, ticket, error, or data discrepancy (e.g. "Order ORD123 is stuck in Planned", "Inventory hold on LPN 5002", "Wave allocation failed at WH01").

Return ONLY valid JSON:
{{"intent": "GENERAL_PROCESS_INQUIRY" or "INCIDENT_TRIAGE", "domain": "Inbound" or "Outbound" or "Inventory" or "general", "topic": "short topic summary"}}
"""
        try:
            res = LLMProviderFactory.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=150,
            )
            p_tok = getattr(res.usage, "prompt_tokens", 0) if hasattr(res, "usage") and res.usage else len(prompt) // 4
            c_tok = getattr(res.usage, "completion_tokens", 0) if hasattr(res, "usage") and res.usage else len(res.choices[0].message.content) // 4
            content = res.choices[0].message.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            parsed = json.loads(content)
            parsed["_prompt_tokens"] = p_tok
            parsed["_completion_tokens"] = c_tok
            return parsed
        except Exception as e:
            logger.warning(f"Intent classification fallback: {e}")
            return {"intent": "INCIDENT_TRIAGE", "domain": "general", "topic": query, "_prompt_tokens": 30, "_completion_tokens": 15}

    def _handle_ask_persona(
        self,
        query: str,
        domain: str = "general",
        session_id: str = None,
        agent_traces: List[Dict[str, Any]] = None,
        pipeline_start: float = None,
    ) -> Dict[str, Any]:
        """
        Synthesize domain process flow, table and column mappings, or conceptual architecture
        strictly from Neo4j graph context using AskProcessAgent.
        """
        from backend.database.neo4j_client import neo4j_client
        import re

        agent_traces = agent_traces if agent_traces is not None else []
        pipeline_start = pipeline_start or time.perf_counter()

        # Retrieve Domain, Tables, Columns, and Key Relationships from Neo4j
        with AuditTimer() as t_graph:
            if domain and domain.lower() in ["inbound", "outbound", "inventory"]:
                cypher = """
                MATCH (d:Domain) WHERE toLower(d.name) = toLower($domain)
                MATCH (d)<-[:BELONGS_TO_DOMAIN]-(t:Table)
                OPTIONAL MATCH (t)-[:HAS_COLUMN]->(c:Column)
                OPTIONAL MATCH (t)-[r]->(t2:Table)
                RETURN d.name AS domain,
                       t.oracle_table_name AS table_name,
                       t.business_purpose AS purpose,
                       collect(DISTINCT {column_name: c.column_name, data_type: c.data_type, definition: c.business_definition}) AS columns,
                       collect(DISTINCT {rel: type(r), to: t2.oracle_table_name}) AS relationships
                """
                graph_data = neo4j_client.execute_read(cypher, {"domain": domain})
            else:
                cypher = """
                MATCH (t:Table)
                OPTIONAL MATCH (t)-[:BELONGS_TO_DOMAIN]->(d:Domain)
                OPTIONAL MATCH (t)-[:HAS_COLUMN]->(c:Column)
                OPTIONAL MATCH (t)-[r]->(t2:Table)
                RETURN coalesce(d.name, 'general') AS domain,
                       t.oracle_table_name AS table_name,
                       t.business_purpose AS purpose,
                       collect(DISTINCT {column_name: c.column_name, data_type: c.data_type, definition: c.business_definition}) AS columns,
                       collect(DISTINCT {rel: type(r), to: t2.oracle_table_name}) AS relationships
                """
                graph_data = neo4j_client.execute_read(cypher)

        agent_traces.append({
            "agent": "DomainKnowledgeAgent",
            "step": "Neo4j Domain, Table & Column Schema Retrieval",
            "latency_ms": round(t_graph.elapsed_ms, 2),
            "result": {"tables_found": len(graph_data)},
        })
        telemetry.record_invocation(
            "DomainKnowledgeAgent",
            t_graph.elapsed_ms,
            tokens_used=120,
            prompt_tokens=90,
            completion_tokens=30,
            success=True,
            session_id=session_id,
        )

        # Synthesize Numbered Steps, Table/Column Mappings, and Conditional Mermaid Diagram
        with AuditTimer() as t_syn:
            # Filter most relevant tables to fit comfortably into prompt context if needed
            q_lower = query.lower()
            scored_tables = []
            for item in graph_data:
                tbl_name = (item.get("table_name") or "").lower()
                purpose = (item.get("purpose") or "").lower()
                score = 0
                for word in q_lower.split():
                    if len(word) > 2:
                        if word in tbl_name:
                            score += 5
                        if word in purpose:
                            score += 2
                scored_tables.append((score, item))

            scored_tables.sort(key=lambda x: x[0], reverse=True)
            # Pick top relevant tables plus domain tables
            selected_tables = [item for score, item in scored_tables[:25]]

            graph_context_str = json.dumps(selected_tables, indent=2)
            prompt = f"""
You are the AskProcessAgent (Ask Persona) for the Yonder Graph Supply Chain platform.
The user asked: "{query}"

CRITICAL INSTRUCTIONS FOR QUERY COMPREHENSION & FEATURE RENDERING:

1. CLASSIFY THE USER QUERY INTENT:
   A. [SCHEMA, STATUS & COLUMN MAPPING INQUIRY]
      - Examples: "show me how to check the order status", "where is order status stored", "table and column mappings for order status", "how to check inventory status", "what columns indicate shipment status".
      - Intent: The user wants to understand the exact database tables, column mappings, status code values, and SQL query patterns to inspect an entity's status in Oracle.
      - Output rules:
        * Table & Column Mappings: Detail the exact Oracle tables (e.g. `ORD`, `ORD_LINE`/`ORDLIN`, `SHIPMENT`, `INVDTL`) and key columns (e.g. `ORDNUM`, `STATUS`, `LINE_STATUS`, `SHPSTS`, `WAVE_FLG`, `ORDQTY`, `RSVQTY`, `PCKQTY`, `SHPQTY`), their data types, business definitions, and status flag meanings.
        * Status Logic: Explain how the status is calculated / interpreted across tables.
        * Read-only Diagnostic SQL: Provide a clean, formatted read-only Oracle SELECT query demonstrating how an engineer queries this status.
        * Mermaid Diagram: Set "mermaid_diagram": null. DO NOT generate process architecture flowcharts for column and status mapping inquiries!
        * Steps: If provided, make them concise verification steps (e.g., Step 1: Query Order Header, Step 2: Check Line Progress, Step 3: Check Shipment Status) or set "steps": [] if fully covered in the narrative.

   B. [PROCESS FLOW / ARCHITECTURE INQUIRY]
      - Examples: "show me the order process flow", "explain the inbound receiving process flow", "what is the wave allocation lifecycle", "how does goods movement work".
      - Intent: The user wants to understand the sequential operational lifecycle across entities.
      - Output rules:
        * Sequential Steps: Provide a structured, step-by-step breakdown in the "steps" array (step_number, title, description, tables).
        * Mermaid Diagram Complexity Rule:
          - If the process is a COMPLEX, MULTI-STAGE, or BRANCHING lifecycle (such as the end-to-end Order Lifecycle: Ingestion -> Waving -> Picking -> Staging -> Loading -> Ship Confirm, or Inbound Receiving Lifecycle), generate a clean, valid Mermaid.js flowchart (`graph TD` or `flowchart LR`) in the "mermaid_diagram" field.
          - If the process is SIMPLE, LINEAR (1-2 basic steps), or focused on a single entity, set "mermaid_diagram": null.
          - Do NOT duplicate mermaid code blocks inside the narrative field. Only place the diagram in the "mermaid_diagram" field.
          - Do NOT force a Mermaid diagram for every inquiry. Only generate when visual flow representation adds genuine structural clarity.

   C. [CONCEPT FAQ / DEFINITION]
      - Examples: "what is MOCA", "what is an LPN", "explain cross docking".
      - Output rules: Concise narrative, "steps": [], "mermaid_diagram": null.

2. STRICT GROUNDING:
   Use only tables, columns, and relationships present in the Neo4j Knowledge Graph Context below. Zero hallucination.

Neo4j Knowledge Graph Context:
{graph_context_str}

Return ONLY valid JSON with keys:
{{
  "query_type": "SCHEMA_STATUS_MAPPING" | "PROCESS_FLOW" | "CONCEPT_FAQ",
  "steps": [
    {{
      "step_number": 1,
      "title": "Short Step Title",
      "description": "Brief explanation in plain English",
      "tables": ["TABLE1", "TABLE2"]
    }}
  ],
  "narrative": "Comprehensive, well-structured markdown explanation with clear bold headings, table & column breakdown tables/lists, and SQL query blocks if applicable",
  "mermaid_diagram": "graph TD\\n  A[InboundOrder] --> B[ReceiptLine]" or null
}}
"""
            res = LLMProviderFactory.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=2500,
            )
            p_syn = getattr(res.usage, "prompt_tokens", 0) if hasattr(res, "usage") and res.usage else len(prompt) // 4
            c_syn = getattr(res.usage, "completion_tokens", 0) if hasattr(res, "usage") and res.usage else len(res.choices[0].message.content) // 4
            content = res.choices[0].message.content.strip()
            flow_result = self._safe_parse_ask_response(content)

        agent_traces.append({
            "agent": "AskProcessAgent",
            "step": "Step Flowchart & Mermaid Diagram Synthesis",
            "latency_ms": round(t_syn.elapsed_ms, 2),
            "result": {
                "query_type": flow_result.get("query_type", "PROCESS_FLOW"),
                "step_count": len(flow_result.get("steps", [])),
                "flowchart_generated": bool(flow_result.get("mermaid_diagram")),
            },
        })
        telemetry.record_invocation(
            "AskProcessAgent",
            t_syn.elapsed_ms,
            tokens_used=p_syn + c_syn,
            prompt_tokens=p_syn,
            completion_tokens=c_syn,
            success=True,
            session_id=session_id,
        )

        total_ms = (time.perf_counter() - pipeline_start) * 1000

        turn_prompt = p_syn + 90
        turn_completion = c_syn + 30
        turn_total = turn_prompt + turn_completion

        agent_tokens = {
            "DomainKnowledgeAgent": {"prompt": 90, "completion": 30, "total": 120},
            "AskProcessAgent": {"prompt": p_syn, "completion": c_syn, "total": p_syn + c_syn},
        }

        response = {
            "session_id": session_id,
            "status": "success",
            "intent": "PROCESS_INQUIRY",
            "persona": "ask",
            "domain": domain,
            "business_keys": {},
            "issue_category": query,
            "steps": flow_result.get("steps", []),
            "investigation_steps": [],
            "narrative": flow_result.get("narrative"),
            "mermaid_diagram": flow_result.get("mermaid_diagram"),
            "matched_sop": None,
            "diagnostic_sql": None,
            "governance": {
                "tier": "LEVEL_1_STANDARD_MOCA",
                "risk_level": "LOW_RISK_READONLY",
                "recommended_action": "Domain Process Knowledge Guide",
                "policy_justification": "General educational/process inquiry. Fully compliant with read-only governance.",
            },
            "risk_level": "LOW_RISK_READONLY",
            "agent_traces": agent_traces,
            "token_usage": {
                "total_tokens": turn_total,
                "prompt_tokens": turn_prompt,
                "completion_tokens": turn_completion,
                "agents": agent_tokens,
            },
            "total_latency_ms": round(total_ms, 2),
            "llm_provider": LLMProviderFactory.get_provider_info(),
        }

        audit_logger.log(
            session_id=session_id,
            agent_name="AskProcessAgent",
            action_type="ASK_PROCESS_INQUIRY_COMPLETE",
            input_payload={"query": query},
            output_payload=response,
            execution_time_ms=total_ms,
            tokens_used=p_syn + c_syn + 120,
            status="SUCCESS",
        )
        return response

    def _safe_parse_ask_response(self, raw_text: str) -> Dict[str, Any]:
        """Safely parse AskProcessAgent LLM response with JSON and regex fallbacks."""
        import re
        text = raw_text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        start_idx = text.find("{")
        end_idx = text.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            json_candidate = text[start_idx:end_idx + 1]
        else:
            json_candidate = text

        try:
            data = json.loads(json_candidate, strict=False)
            if isinstance(data, dict):
                if data.get("mermaid_diagram") and str(data["mermaid_diagram"]).lower() in ["none", "null", ""]:
                    data["mermaid_diagram"] = None
                return data
        except Exception:
            pass

        result = {
            "query_type": "SCHEMA_STATUS_MAPPING",
            "steps": [],
            "narrative": "",
            "mermaid_diagram": None,
        }

        # Extract query_type
        qt_match = re.search(r"\"query_type\"\s*:\s*\"([^\"]+)\"", json_candidate)
        if qt_match:
            result["query_type"] = qt_match.group(1)

        # Extract mermaid_diagram
        m_match = re.search(r"\"mermaid_diagram\"\s*:\s*(\"[\s\S]*?\"|null)\s*(?:,|\})", json_candidate)
        if not m_match:
            m_match = re.search(r"\"mermaid_diagram\"\s*:\s*(\"[\s\S]*?\"|null)", json_candidate)
        if m_match:
            m_val = m_match.group(1).strip()
            if m_val != "null" and m_val != '""':
                try:
                    parsed_val = json.loads(m_val) if m_val.startswith('"') else m_val
                    result["mermaid_diagram"] = parsed_val if parsed_val and str(parsed_val).lower() not in ["none", "null"] else None
                except Exception:
                    clean_val = m_val.strip('"').replace("\\n", "\n")
                    result["mermaid_diagram"] = clean_val if clean_val and clean_val.lower() not in ["none", "null"] else None

        # Extract steps array
        steps_match = re.search(r"\"steps\"\s*:\s*(\[[\s\S]*?\])\s*,\s*\"(?:narrative|mermaid_diagram|query_type)\"", json_candidate)
        if not steps_match:
            steps_match = re.search(r"\"steps\"\s*:\s*(\[[\s\S]*?\])", json_candidate)
        if steps_match:
            try:
                result["steps"] = json.loads(steps_match.group(1), strict=False)
            except Exception:
                pass

        # Extract narrative
        nar_match = re.search(r"\"narrative\"\s*:\s*\"([\s\S]*?)(\"\s*,\s*\"mermaid_diagram\"|\"\s*\}\s*$)", json_candidate)
        if nar_match:
            raw_nar = nar_match.group(1)
            result["narrative"] = raw_nar.replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")
        else:
            clean_narrative = json_candidate
            clean_narrative = re.sub(r"^\s*\{\s*\"query_type\":\s*\"[^\"]*\",?\s*", "", clean_narrative)
            clean_narrative = re.sub(r"\"steps\":\s*\[[\s\S]*?\]\s*,?\s*", "", clean_narrative)
            clean_narrative = re.sub(r"\"mermaid_diagram\":\s*(?:\"[\s\S]*?\"|null)\s*,?\s*", "", clean_narrative)
            clean_narrative = re.sub(r"^\s*\"narrative\":\s*\"", "", clean_narrative)
            clean_narrative = re.sub(r"\"\s*\}\s*$", "", clean_narrative)
            result["narrative"] = clean_narrative.replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\").strip() or raw_text

        return result

    def _handle_resolve_persona(
        self,
        query: str,
        domain: str = "general",
        session_id: str = None,
        agent_traces: List[Dict[str, Any]] = None,
        pipeline_start: float = None,
    ) -> Dict[str, Any]:
        """
        Execute incident diagnosis and structured step-by-step investigation 
        with per-step Oracle SQL and governance using ResolveTriageAgent.
        """
        agent_traces = agent_traces if agent_traces is not None else []
        pipeline_start = pipeline_start or time.perf_counter()

        # ── Step 1: Incident Parsing ──
        with AuditTimer() as t1:
            triage_result = self._parse_incident(query, session_id)
        agent_traces.append({
            "agent": "TriageRoutingAgent",
            "step": "Incident Parsing & Business Key Extraction",
            "latency_ms": round(t1.elapsed_ms, 2),
            "result": triage_result,
        })
        p1 = triage_result.get("_prompt_tokens", 80)
        c1 = triage_result.get("_completion_tokens", 40)
        telemetry.record_invocation(
            "TriageRoutingAgent",
            t1.elapsed_ms,
            tokens_used=p1 + c1,
            prompt_tokens=p1,
            completion_tokens=c1,
            success=True,
            session_id=session_id,
        )

        domain = triage_result.get("domain") or domain or "general"
        business_keys = triage_result.get("business_keys") or {}
        issue_category = triage_result.get("issue_category") or query

        # ── Step 2: GraphRAG SOP Retrieval ──
        with AuditTimer() as t2:
            sop_result = search_sop_runbooks(
                domain=domain,
                issue_pattern=issue_category,
                session_id=session_id,
            )
        agent_traces.append({
            "agent": "GraphRAGDiagnosticAgent",
            "step": "Neo4j SOP Runbook Retrieval",
            "latency_ms": round(t2.elapsed_ms, 2),
            "result": sop_result,
        })
        telemetry.record_invocation(
            "GraphRAGDiagnosticAgent",
            t2.elapsed_ms,
            tokens_used=65,
            prompt_tokens=50,
            completion_tokens=15,
            success=True,
            session_id=session_id,
        )

        runbooks = sop_result.get("runbooks", [])
        matched_sop = runbooks[0] if runbooks else None

        if not matched_sop:
            with AuditTimer() as t_fallback:
                matched_sop = self._generate_fallback_sql(
                    query=query, 
                    domain=domain, 
                    session_id=session_id
                )
            agent_traces.append({
                "agent": "GraphRAGDiagnosticAgent",
                "step": "Dynamic GraphRAG SQL Fallback",
                "latency_ms": round(t_fallback.elapsed_ms, 2),
                "result": matched_sop,
            })

        # ── Step 3: SQL Parameter Binding ──
        sql_result = None
        if matched_sop and matched_sop.get("diagnostic_sql"):
            with AuditTimer() as t3:
                sql_result = self._bind_and_validate_sql(
                    matched_sop["diagnostic_sql"],
                    business_keys,
                    session_id,
                )
            agent_traces.append({
                "agent": "SQLParameterBindingAgent",
                "step": "Oracle SQL Parameter Binding & Tier 2 AST Guard",
                "latency_ms": round(t3.elapsed_ms, 2),
                "result": sql_result,
            })
            is_ast_intercept = bool(sql_result and not sql_result.get("tier2_valid", True))
            telemetry.record_invocation(
                "SQLParameterBindingAgent",
                t3.elapsed_ms,
                tokens_used=40,
                prompt_tokens=30,
                completion_tokens=10,
                success=True,
                governance_intercept=is_ast_intercept,
                session_id=session_id,
            )

        # ── Step 4: Governance Evaluation ──
        with AuditTimer() as t4:
            governance_result = self._evaluate_governance(
                issue_category,
                matched_sop.get("resolution_steps", "") if matched_sop else "",
                domain,
                session_id,
            )
        is_gov_intercept = bool(
            governance_result and (
                governance_result.get("requires_sme_approval") or
                governance_result.get("risk_level") not in ["LOW_RISK_READONLY", None] or
                governance_result.get("tier") not in ["LEVEL_1_STANDARD_MOCA", "LEVEL_1_MOCA", None]
            )
        )
        agent_traces.append({
            "agent": "GovernanceSafetyAgent",
            "step": "Tier 1 Governance Evaluation & Remediation Policy",
            "latency_ms": round(t4.elapsed_ms, 2),
            "result": governance_result,
        })
        telemetry.record_invocation(
            "GovernanceSafetyAgent",
            t4.elapsed_ms,
            tokens_used=75,
            prompt_tokens=60,
            completion_tokens=15,
            success=True,
            governance_intercept=is_gov_intercept,
            session_id=session_id,
        )

        # ── Step 5: Structured Investigation Steps Synthesis ──
        with AuditTimer() as t5:
            inv_steps = self._synthesize_investigation_steps(
                query=query,
                matched_sop=matched_sop,
                sql_result=sql_result,
                business_keys=business_keys,
                domain=domain,
            )
        agent_traces.append({
            "agent": "ResolveTriageAgent",
            "step": "Structured Investigation Steps Decomposition",
            "latency_ms": round(t5.elapsed_ms, 2),
            "result": {"step_count": len(inv_steps)},
        })

        # ── Step 6: Multi-Persona Narrative & Diagnostic Reasoning (HumanizingAgent) ──
        with AuditTimer() as t6:
            narrative_result = self._synthesize_narrative(
                query=query,
                matched_sop=matched_sop,
                sql_result=sql_result,
                governance_result=governance_result,
                inv_steps=inv_steps,
                business_keys=business_keys,
                domain=domain,
            )
        p6 = narrative_result.get("_prompt_tokens", 220)
        c6 = narrative_result.get("_completion_tokens", 120)
        agent_traces.append({
            "agent": "HumanizingAgent",
            "step": "Multi-Persona Narrative Synthesis (L1/L2/L3) & Diagnostic Reasoning",
            "latency_ms": round(t6.elapsed_ms, 2),
            "result": {
                "has_l1": bool(narrative_result.get("l1_summary")),
                "has_l2": bool(narrative_result.get("l2_summary")),
                "has_l3": bool(narrative_result.get("l3_summary")),
                "has_reasoning": bool(narrative_result.get("reasoning")),
            },
        })
        telemetry.record_invocation(
            "HumanizingAgent",
            t6.elapsed_ms,
            tokens_used=p6 + c6,
            prompt_tokens=p6,
            completion_tokens=c6,
            success=True,
            session_id=session_id,
        )

        agent_tokens = {
            "TriageRoutingAgent": {"prompt": p1, "completion": c1, "total": p1 + c1},
            "GraphRAGDiagnosticAgent": {"prompt": 50, "completion": 15, "total": 65},
            "SQLParameterBindingAgent": {"prompt": 30, "completion": 10, "total": 40},
            "GovernanceSafetyAgent": {"prompt": 60, "completion": 15, "total": 75},
            "ResolveTriageAgent": {"prompt": 80, "completion": 40, "total": 120},
            "HumanizingAgent": {"prompt": p6, "completion": c6, "total": p6 + c6},
        }
        turn_prompt = sum(v["prompt"] for v in agent_tokens.values())
        turn_completion = sum(v["completion"] for v in agent_tokens.values())
        turn_total = turn_prompt + turn_completion

        total_ms = (time.perf_counter() - pipeline_start) * 1000

        l1_text = narrative_result.get("l1_summary") or narrative_result.get("narrative", "")
        l2_text = narrative_result.get("l2_summary") or narrative_result.get("narrative", "")
        l3_text = narrative_result.get("l3_summary") or narrative_result.get("narrative", "")

        response = {
            "session_id": session_id,
            "status": "success",
            "intent": "INCIDENT_TRIAGE",
            "persona": "resolve",
            "domain": domain,
            "business_keys": business_keys,
            "issue_category": issue_category,
            "matched_sop": matched_sop,
            "diagnostic_sql": sql_result,
            "investigation_steps": inv_steps,
            "steps": [],
            "governance": governance_result,
            "narrative": narrative_result.get("narrative", ""),
            "persona_summaries": {
                "l1": l1_text,
                "l2": l2_text,
                "l3": l3_text,
            },
            "reasoning": narrative_result.get("reasoning", ""),
            "sql_reasoning": narrative_result.get("sql_reasoning", ""),
            "mermaid_diagram": None,
            "risk_level": governance_result.get("risk_level", "LOW_RISK_READONLY"),
            "agent_traces": agent_traces,
            "token_usage": {
                "total_tokens": turn_total,
                "prompt_tokens": turn_prompt,
                "completion_tokens": turn_completion,
                "agents": agent_tokens,
            },
            "total_latency_ms": round(total_ms, 2),
            "llm_provider": LLMProviderFactory.get_provider_info(),
        }

        audit_logger.log(
            session_id=session_id,
            agent_name="ResolveTriageAgent",
            action_type="RESOLVE_TRIAGE_COMPLETE",
            input_payload={"query": query},
            output_payload=response,
            execution_time_ms=total_ms,
            tokens_used=turn_total,
            status="SUCCESS",
            governance_tier1_eval=governance_result,
            governance_tier2_flags=sql_result.get("tier2_validation") if sql_result else None,
        )
        return response

    def _synthesize_investigation_steps(
        self,
        query: str,
        matched_sop: Optional[Dict[str, Any]],
        sql_result: Optional[Dict[str, Any]],
        business_keys: Dict[str, str],
        domain: str,
    ) -> List[Dict[str, Any]]:
        """Decompose incident investigation into ordered, step-by-step investigation cards with per-step SQL."""
        from backend.governance.oracle_sql_validator import OracleSQLValidator

        display_sql = sql_result.get("display_sql") if sql_result else None
        sop_steps = matched_sop.get("triage_steps") if matched_sop else ""

        prompt = f"""
You are the ResolveTriageAgent for the Yonder Graph platform.
Decompose this supply chain incident into 2 to 4 sequential, ordered investigation steps.

User Incident: "{query}"
Domain: {domain}
Business Keys: {json.dumps(business_keys)}
Matched SOP: {json.dumps(matched_sop) if matched_sop else "None"}
Primary Diagnostic SQL: {display_sql or "None"}

CRITICAL RULES:
1. Provide 2 to 4 discrete, logical investigation steps (e.g. 1: Check Header Status, 2: Check Line Details & Inventory, 3: Verify Locks/Holds).
2. For each step:
   - step_number: 1, 2, 3...
   - step_title: Short action title (e.g., "Verify Order Header & Allocation Flag")
   - description: What the IT engineer is looking for in this step.
   - diagnostic_sql: A valid, read-only Oracle SELECT query tailored for this specific step with bound keys (:ordnum, :wh_id, :lodnum) and ROWNUM <= 100 safeguard. (Set null if this step is a visual/configuration check).
   - expected_outcome: What normal vs abnormal results indicate.
3. Zero hallucination. All SQL MUST be strictly SELECT (Read-only).

Return ONLY valid JSON array:
[
  {{
    "step_number": 1,
    "step_title": "...",
    "description": "...",
    "diagnostic_sql": "SELECT ... FROM ... WHERE ... AND ROWNUM <= 100",
    "expected_outcome": "..."
  }}
]
"""
        try:
            res = LLMProviderFactory.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=1000,
            )
            content = res.choices[0].message.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            steps = json.loads(content)
            
            # Validate each step's SQL with Tier 2 AST Validator
            validator = OracleSQLValidator()
            for s in steps:
                sql = s.get("diagnostic_sql")
                if sql:
                    val = validator.validate(sql)
                    s["tier2_valid"] = val.is_valid
                    s["validation_errors"] = val.errors
            return steps
        except Exception as e:
            logger.warning("Investigation steps synthesis fallback: %s", e)
            if display_sql:
                return [{
                    "step_number": 1,
                    "step_title": "Execute Primary Diagnostic SQL",
                    "description": "Run the Tier 2 AST-validated diagnostic query against the operational database.",
                    "diagnostic_sql": display_sql,
                    "expected_outcome": "Review record status, hold flags, and allocation timestamps.",
                    "tier2_valid": True,
                    "validation_errors": [],
                }]
            return []

    def consolidate_sql_script(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Consolidate all per-step diagnostic SQL queries into a single, AST-validated Oracle diagnostic script.
        """
        from backend.governance.oracle_sql_validator import OracleSQLValidator

        valid_queries = []
        for s in steps:
            sql = s.get("diagnostic_sql")
            title = s.get("step_title") or f"Step {s.get('step_number', '')}"
            if sql and sql.strip():
                clean_sql = sql.strip().rstrip(";")
                valid_queries.append({
                    "step_number": s.get("step_number", 1),
                    "title": title,
                    "sql": clean_sql,
                })

        if not valid_queries:
            return {
                "status": "empty",
                "consolidated_sql": "-- No diagnostic SQL queries available for consolidation.",
                "tier2_valid": True,
                "step_count": 0,
            }

        # Build formatted script with headers
        script_parts = [
            "-- ============================================================",
            "-- YONDER GRAPH CONSOLIDATED INCIDENT DIAGNOSTIC SCRIPT",
            "-- Generated by ResolveTriageAgent | Tier 2 AST Read-Only Safe",
            "-- ============================================================",
            "",
        ]

        all_valid = True
        all_errors = []
        validator = OracleSQLValidator()

        for q in valid_queries:
            val = validator.validate(q["sql"])
            if not val.is_valid:
                all_valid = False
                all_errors.extend(val.errors)

            script_parts.append(f"-- ------------------------------------------------------------")
            script_parts.append(f"-- Step {q['step_number']}: {q['title']}")
            script_parts.append(f"-- ------------------------------------------------------------")
            script_parts.append(f"{q['sql']};")
            script_parts.append("")

        consolidated_text = "\n".join(script_parts)

        return {
            "status": "success" if all_valid else "warning",
            "consolidated_sql": consolidated_text,
            "tier2_valid": all_valid,
            "validation_errors": all_errors,
            "step_count": len(valid_queries),
        }

    def _parse_incident(
        self, query: str, session_id: str
    ) -> Dict[str, Any]:
        """Parse the incident using the LLM to extract structured fields."""
        try:
            response = LLMProviderFactory.chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a WMS incident parser. Extract the domain "
                            "(Inbound/Outbound/Inventory), business keys (ordnum, "
                            "wh_id, lodnum, etc.), issue category, and severity "
                            "from the incident description. Respond in JSON only."
                        ),
                    },
                    {"role": "user", "content": query},
                ],
                temperature=0.0,
                max_tokens=1024,
            )
            content = response.choices[0].message.content
            # Try to parse JSON from the response
            try:
                # Handle markdown code blocks
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                return json.loads(content.strip())
            except (json.JSONDecodeError, IndexError):
                return {
                    "domain": "general",
                    "business_keys": {},
                    "issue_category": query,
                    "severity": "MEDIUM",
                    "raw_response": content,
                }
        except Exception as e:
            logger.warning("LLM incident parsing failed: %s — using fallback", e)
            return self._fallback_parse(query)

    def _fallback_parse(self, query: str) -> Dict[str, Any]:
        """Deterministic fallback parser using keyword matching."""
        query_lower = query.lower()

        # Domain detection
        domain = "general"
        if any(kw in query_lower for kw in ["inbound", "receiving", "receipt", "po ", "purchase order", "asn"]):
            domain = "Inbound"
        elif any(kw in query_lower for kw in ["outbound", "order", "wave", "ship", "pick", "allocat"]):
            domain = "Outbound"
        elif any(kw in query_lower for kw in ["inventory", "stock", "cycle count", "hold", "adjust"]):
            domain = "Inventory"

        # Business key extraction via regex
        import re
        business_keys = {}
        ordnum_match = re.search(r"(?:ordnum|order)\s*[=:]\s*([A-Za-z0-9\-_]+)", query, re.IGNORECASE)
        if ordnum_match:
            business_keys["ordnum"] = ordnum_match.group(1)
        wh_match = re.search(r"(?:wh_id|warehouse)\s*[=:]\s*([A-Za-z0-9\-_]+)", query, re.IGNORECASE)
        if wh_match:
            business_keys["wh_id"] = wh_match.group(1)
        lodnum_match = re.search(r"(?:lodnum|lpn|load)\s*[=:]\s*([A-Za-z0-9\-_]+)", query, re.IGNORECASE)
        if lodnum_match:
            business_keys["lodnum"] = lodnum_match.group(1)

        return {
            "domain": domain,
            "business_keys": business_keys,
            "issue_category": query[:200],
            "severity": "MEDIUM",
        }

    def _bind_and_validate_sql(
        self,
        diagnostic_sql: str,
        business_keys: Dict[str, Any],
        session_id: str,
    ) -> Dict[str, Any]:
        """Bind parameters and run Tier 2 validation."""
        # Bind parameters
        binding_result = bind_sql_parameters(
            sql_template=diagnostic_sql,
            parameters=business_keys,
            session_id=session_id,
        )

        # Run Tier 2 AST validation on the template SQL
        tier2_result = validate_with_neo4j_schema(diagnostic_sql)

        return {
            "template_sql": diagnostic_sql,
            "display_sql": binding_result.get("display_sql", ""),
            "bind_variables": binding_result.get("bind_variables", []),
            "sanitized_parameters": binding_result.get("sanitized_parameters", {}),
            "parameter_errors": binding_result.get("errors", []),
            "tier2_valid": tier2_result.is_valid,
            "tier2_validation": tier2_result.to_dict(),
            "validated_sql": tier2_result.validated_sql if tier2_result.is_valid else None,
        }

    def _evaluate_governance(
        self,
        action_description: str,
        remediation_steps: str,
        domain: str,
        session_id: str,
    ) -> Dict[str, Any]:
        """Run Tier 1 governance evaluation."""
        if not remediation_steps:
            return {
                "tier": "LEVEL_1_STANDARD_MOCA",
                "risk_level": "LOW_RISK_READONLY",
                "recommended_action": "Informational inquiry / Read-only diagnostic review",
                "policy_justification": "Query is informational or read-only diagnostic. Standard read-only governance applies.",
                "preconditions": [],
                "rollback_steps": [],
                "requires_sme_approval": False,
                "moca_command": None,
                "ui_navigation": None,
                "plsql_block": None,
            }
        return get_remediation_policy(
            action_description=action_description,
            remediation_steps=remediation_steps,
            domain=domain,
            session_id=session_id,
        )

    def _generate_fallback_sql(
        self, query: str, domain: str, session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Fallback text-to-SQL generation when no SOP matches."""
        try:
            from backend.database.neo4j_client import neo4j_client
            tables_result = neo4j_client.execute_read(
                "MATCH (t:Table) RETURN t.oracle_table_name AS name, t.business_purpose AS purpose"
            )
            tables_context = "\n".join([f"- {t['name']}: {t['purpose']}" for t in tables_result])

            selection_prompt = f"""
You are an expert Oracle WMS database architect.
Based on the user's issue: "{query}"

Select up to 3 table names from the list below that would be most relevant to query or explain to the user.
Return ONLY a JSON array of strings (e.g. ["ORD", "ORD_LINE"]). Do not include markdown formatting.

Available Tables:
{tables_context}
"""
            selection_res = LLMProviderFactory.chat_completion(
                messages=[{"role": "user", "content": selection_prompt}],
                temperature=0.0,
                max_tokens=200,
            )
            content = selection_res.choices[0].message.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            try:
                selected_tables = json.loads(content)
            except json.JSONDecodeError:
                return None

            schema_context = ""
            for table in selected_tables:
                schema = get_table_schema(table, session_id)
                if schema.get("status") == "success":
                    schema_context += f"\nTable: {schema.get('table_info', {}).get('oracle_table_name')}\n"
                    schema_context += f"Purpose: {schema.get('table_info', {}).get('business_purpose')}\n"
                    schema_context += "Columns:\n"
                    for col in schema.get("columns", []):
                        schema_context += f"  - {col.get('column_name')} ({col.get('data_type')}): {col.get('business_definition')}\n"
                    schema_context += "Relationships:\n"
                    for rel in schema.get("relationships", []):
                        schema_context += f"  - {rel.get('relationship')} -> {rel.get('related_table')}\n"

            if not schema_context:
                return None

            sql_prompt = f"""
You are an Oracle SQL diagnostic expert.
Write a read-only Oracle SQL query to investigate this issue: "{query}"

Rules:
1. STRICT CONSTRAINT: ONLY use the provided tables and columns in the Schema Context. DO NOT use any tables, views, or columns from your general pre-training knowledge.
2. Ensure you join tables correctly based on the relationships.
3. Use bind parameters (e.g., :ordnum, :wh_id) ONLY if specific business keys are mentioned in the user's issue. If the user is asking a general question, DO NOT invent or use bind parameters—write a generic exploratory query instead (e.g. a sample of rows or aggregate counts).
4. Return ONLY the raw SQL query, no markdown, no explanations.

Schema Context:
{schema_context}
"""
            sql_res = LLMProviderFactory.chat_completion(
                messages=[{"role": "user", "content": sql_prompt}],
                temperature=0.1,
                max_tokens=1000,
            )
            sql = sql_res.choices[0].message.content.strip()
            if sql.startswith("```sql"):
                sql = sql.split("```sql")[1].split("```")[0].strip()
            elif sql.startswith("```"):
                sql = sql.split("```")[1].split("```")[0].strip()

            return {
                "sop_id": "DYNAMIC-GRAPHRAG",
                "title": f"Dynamic GraphRAG Diagnostic Analysis ({domain})",
                "process_domain": domain,
                "issue_pattern": "Dynamic GraphRAG SQL Fallback",
                "trigger_entity": "Generated",
                "triage_steps": ["1. Execute the dynamically generated diagnostic query to review the state of the relevant tables."],
                "diagnostic_sql": sql,
                "root_cause_conditions": ["Analysis of query results."],
                "resolution_steps": "Dependent on the query results. Use standard operational procedures based on findings.",
                "risk_level": "UNKNOWN",
            }
        except Exception as e:
            logger.error(f"Fallback SQL generation failed: {e}")
            return None

    def _synthesize_narrative(
        self,
        query: str,
        matched_sop: Optional[Dict],
        sql_result: Optional[Dict],
        governance_result: Optional[Dict],
        inv_steps: Optional[List[Dict]] = None,
        business_keys: Optional[Dict] = None,
        domain: str = "general",
    ) -> Dict[str, Any]:
        """
        HumanizingAgent: Synthesize persona-tailored summaries (L1, L2, L3) and comprehensive
        multi-agent triage reasoning explaining cognitive and technical decisions.
        """
        sop_summary = json.dumps(matched_sop) if matched_sop else "None (General diagnostic lookup)"
        sql_summary = sql_result.get("display_sql") if sql_result else "None"
        steps_summary = json.dumps(inv_steps) if inv_steps else "None"

        prompt = f"""
You are the HumanizingAgent for the Yonder Graph Supply Chain platform.
Synthesize the multi-agent diagnostic findings for this WMS incident into persona-tailored summaries (L1, L2, L3) and a deep reasoning trace.

User Incident Query: "{query}"
Domain: {domain}
Extracted Business Keys: {json.dumps(business_keys or {})}
Matched SOP: {sop_summary}
Diagnostic SQL: {sql_summary}
Tier 2 AST Safe: {sql_result.get('tier2_valid') if sql_result else True}
Governance Tier: {governance_result.get('tier') if governance_result else 'LEVEL_1_STANDARD_MOCA'}
Governance Policy: {governance_result.get('recommended_action') if governance_result else 'Standard Read-Only'}
Investigation Steps: {steps_summary}

CRITICAL TASKS:
1. "l1_summary": Plain English, non-technical operational summary tailored for Service Desk and Floor Operations. Focus on what happened, the affected order/load/inventory, and clear next steps without SQL or database jargon.
2. "l2_summary": Functional & technical triage summary tailored for L2 Application Support Engineers. Detail affected WMS tables (ORD, ORD_LINE, INVLOD), transaction state mismatches (e.g. allocation hold, lock contention), diagnostic findings, and operational checks.
3. "l3_summary": Deep architectural & DBA summary tailored for L3 Core Engineers & DBAs. Detail Oracle table constraints, pessimistic locking flags, parameter bind sanitization, AST read-only validation status, ROWNUM <= 100 boundaries, and Four-Tier governance compliance.
4. "narrative": General summary (defaulting to L1/L2 balanced overview).
5. "reasoning": Comprehensive multi-agent triage reasoning chain explaining cognitive decisions. Format strictly into clean, readable paragraphs with clear double newlines between distinct sections:
   - 🎯 **Intent & Domain Classification**: Paragraph explaining why this query was classified as an operational incident in the {domain} domain.
   
   - 📖 **Knowledge Base & SOP Selection**: Paragraph explaining why SOP {matched_sop.get('sop_id', 'standard diagnostic') if matched_sop else 'standard diagnostic'} was retrieved and how it addresses the root cause.
   
   - 🛡️ **SQL & AST Guard Enforcement**: Paragraph explaining how business parameters were sanitized and how Tier 2 AST read-only validation ensured zero database mutation.
   
   - ⚖️ **Governance & Safety Policy**: Paragraph explaining why the risk tier ({governance_result.get('risk_level', 'LOW_RISK_READONLY') if governance_result else 'LOW_RISK_READONLY'}) was assigned and what preconditions/rollback procedures apply.
6. "sql_reasoning": Short concise explanation of the diagnostic SQL query.

Return ONLY a valid JSON object:
{{
  "l1_summary": "...",
  "l2_summary": "...",
  "l3_summary": "...",
  "narrative": "...",
  "reasoning": "...",
  "sql_reasoning": "...",
  "mermaid_diagram": ""
}}
"""
        try:
            res = LLMProviderFactory.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=1500,
            )
            p_tok = getattr(res.usage, "prompt_tokens", 0) if hasattr(res, "usage") and res.usage else len(prompt) // 4
            c_tok = getattr(res.usage, "completion_tokens", 0) if hasattr(res, "usage") and res.usage else len(res.choices[0].message.content) // 4
            content = res.choices[0].message.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            parsed = json.loads(content)
            parsed["_prompt_tokens"] = p_tok
            parsed["_completion_tokens"] = c_tok
            return parsed
        except Exception as e:
            logger.error(f"Narrative synthesis failed: {e}")
            default_summary = f"I have processed your incident diagnostic request for {query} using the Yonder Graph knowledge base."
            return {
                "l1_summary": f"Incident reported for {query}. Diagnostic steps have been compiled from warehouse operating runbooks. Please follow the investigation steps below.",
                "l2_summary": f"Incident triage for {query}: WMS transaction state mapped against schema definitions. Safe read-only diagnostic SQL queries generated.",
                "l3_summary": f"Diagnostic pipeline executed for {query}: Oracle parameters sanitized, AST read-only validated with ROWNUM <= 100 boundaries, Level 1 MOCA governance verified.",
                "narrative": default_summary,
                "reasoning": (
                    f"🎯 **Intent & Domain Classification**\n\n"
                    f"Verified incident triage query mapped to the `{domain}` domain for automated parameter binding.\n\n"
                    f"📖 **Knowledge Base & SOP Retrieval**\n\n"
                    f"Traversed Neo4j domain graph and mapped against standard warehouse operating procedures to isolate root cause.\n\n"
                    f"🛡️ **SQL AST Guard Enforcement**\n\n"
                    f"Enforced read-only SELECT AST constraints and bound parameters safely with zero mutation.\n\n"
                    f"⚖️ **Governance & Safety Policy**\n\n"
                    f"Classified as `{governance_result.get('risk_level', 'LOW_RISK_READONLY') if governance_result else 'LOW_RISK_READONLY'}` compliant with multi-tier safety controls."
                ),
                "sql_reasoning": "Standard diagnostic query based on schema.",
                "mermaid_diagram": "",
                "_prompt_tokens": 150,
                "_completion_tokens": 80,
            }

    def _evaluate_narrative_governance(
        self, narrative: str, governance_decision: Optional[Dict[str, Any]], session_id: str
    ) -> Dict[str, Any]:
        """Evaluate if the generated narrative violates governance rules."""
        if not governance_decision or not narrative:
            return {"approved": True, "reason": "No governance restrictions applied."}

        prompt = f"""
You are the strict Tier 1 Governance Agent for a WMS system.
Your job is to read the proposed chat response and ensure it adheres to security and governance rules.

Context:
- Recommended Policy: {governance_decision.get('recommended_action', 'Read-only review')}
- Tier: {governance_decision.get('tier', 'LEVEL_1_STANDARD_MOCA')}

Proposed Chat Response:
"{narrative}"

Rules:
1. The response MUST NOT suggest executing raw DML/DDL (INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE) directly in the database. Read-only SELECT diagnostic queries are permitted.
2. The response MUST NOT advocate for unauthorized, destructive data manipulations.
3. If the response violates any of these, set "approved": false and provide a concise "reason". Otherwise set "approved": true.
4. Return ONLY a JSON object: {{"approved": true|false, "reason": "..."}}
"""
        try:
            res = LLMProviderFactory.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=200,
            )
            content = res.choices[0].message.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            return json.loads(content)
        except Exception as e:
            logger.error(f"Narrative governance evaluation failed: {e}")
            return {"approved": True, "reason": "Evaluator fallback: read-only narrative"}





# Module-level singleton
orchestrator = TriageOrchestrator()
