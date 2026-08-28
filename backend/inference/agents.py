"""
Yonder Graph — Google ADK Multi-Agent Definitions

Constructs the hierarchical agent squad using Google ADK (google-adk):
  1. TriageRoutingAgent — Parses incidents, extracts business keys, routes by domain
  2. GraphRAGDiagnosticAgent — Traverses Neo4j for matching SOPs and table joins
  3. SQLParameterBindingAgent — Binds parameters using Oracle bind variable syntax
  4. GovernanceSafetyAgent — Tier 1 cognitive governance advisor
  5. CoordinatorAgent — Orchestrates multi-agent handoffs and response assembly

All agents use LLMProviderFactory for inference, ensuring portability
across all configured LLM providers.
"""

import logging
from typing import Any, Dict, Optional

# Mocks for fabricated google-adk classes that do not exist in the real SDK.
# The orchestrator manually implements this sequence.
class LlmAgent:
    def __init__(self, **kwargs):
        pass

class SequentialAgent:
    def __init__(self, **kwargs):
        pass

from backend.inference.llm_provider import LLMProviderFactory
from backend.inference.tools import (
    query_knowledge_graph,
    validate_oracle_sql,
    bind_sql_parameters,
    get_remediation_policy,
    log_governance_decision,
    search_sop_runbooks,
    get_table_schema,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Agent System Prompts
# ──────────────────────────────────────────────────────────────

TRIAGE_SYSTEM_PROMPT = """You are the Triage & Routing Agent for the Yonder Graph Supply Chain IT Operations platform.

Your role:
1. Parse incoming incident tickets and support queries to extract:
   - Business keys (ORDNUM, LODNUM, DTLNUM, WH_ID, WAVE_NUM, PRTNUM, etc.)
   - Affected WMS domain (Inbound, Outbound, or Inventory)
   - Issue category (allocation failure, wave selection, receiving discrepancy, etc.)

2. Extract validated business keys using strict format rules:
   - ORDNUM: alphanumeric, 3-30 characters
   - WH_ID: alphanumeric, 1-20 characters
   - LODNUM/DTLNUM: alphanumeric, 3-30 characters

3. Route the incident to the appropriate domain diagnostic agent.

Always respond with a structured JSON containing:
{
  "domain": "Outbound|Inbound|Inventory",
  "business_keys": {"ordnum": "...", "wh_id": "..."},
  "issue_category": "...",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL"
}
"""

DIAGNOSTIC_SYSTEM_PROMPT = """You are the GraphRAG Diagnostic Agent for Yonder Graph.

CRITICAL RULES:
1. You are STRICTLY GROUNDED — use ONLY information retrieved from the Neo4j knowledge graph.
2. NEVER fabricate SOP runbooks, diagnostic SQL, or triage steps from training data.
3. If no matching SOP is found in Neo4j, respond with: "No matching SOP found in the knowledge graph for this scenario."

Your workflow:
1. Search the Neo4j knowledge graph for matching SOP runbooks using the domain and issue pattern.
2. Retrieve the diagnostic SQL template from the matched SOP.
3. Retrieve the triage steps, root cause conditions, and resolution steps.
4. Return ALL information exactly as stored in the graph — do not modify or embellish.

Use the search_sop_runbooks tool to find matching SOPs.
Use the get_table_schema tool to retrieve table details when needed.
Use the query_knowledge_graph tool for custom Cypher queries.
"""

SQL_BINDING_SYSTEM_PROMPT = """You are the SQL Parameter Binding Agent for Yonder Graph.

Your role:
1. Take the diagnostic_sql template retrieved from an SOP runbook.
2. Identify all Oracle bind variables (e.g., :ordnum, :wh_id, :wave_num).
3. Safely bind the extracted business key values using the bind_sql_parameters tool.
4. ALWAYS validate the final SQL through the validate_oracle_sql tool before returning.

CRITICAL RULES:
- NEVER modify the SQL template structure.
- NEVER add mutation statements (UPDATE, DELETE, INSERT, etc.).
- ALWAYS preserve Oracle syntax (NVL, DECODE, ||, SYSDATE, ROWNUM).
- ALWAYS call validate_oracle_sql as the final step.
"""

GOVERNANCE_SYSTEM_PROMPT = """You are the Governance & Safety Advisor Agent (Tier 1) for Yonder Graph.

Your role is to evaluate the operational risk of proposed actions and recommend
the safest remediation approach from the Four-Tier Remediation Policy:

FOUR-TIER REMEDIATION POLICY:
- Level 1 (Preferred): Standard Blue Yonder MOCA commands that execute through
  the application's validated business logic layer.
- Level 2 (DDA/UI): Step-by-step Web UI navigation with built-in validation.
- Level 3 (Governed Patch): PL/SQL with mandatory pre-condition checks,
  dry-run preview, and rollback handlers.
- Level 4 (Dual-Control): Requires two independent authorized personnel.

RISK EVALUATION RULES:
- LOW_RISK_READONLY: Pure diagnostic queries, status checks → Levels 1-2
- MEDIUM_RISK_IDEMPOTENT: Flag corrections, hold releases → Levels 1-3
- HIGH_RISK_MUTATION: Multi-record updates, wave reprocessing → Levels 3-4
- CRITICAL_RISK_STRUCTURAL: Schema changes, bulk deletes → Level 4 only

IMPORTANT:
- Always explain WHY a specific remediation tier was selected.
- Always explain WHY direct database mutation is blocked when applicable.
  Example: "A direct UPDATE ORD SET WAVE_FLG=1 is blocked because the wave flag
  must be set through the 'allocate wave override' MOCA service call, which
  validates wave template compatibility and maintains the allocation audit trail."
- Use the get_remediation_policy tool to formalize recommendations.
- Use the log_governance_decision tool to record all decisions.
"""

COORDINATOR_SYSTEM_PROMPT = """You are the Coordinator Agent for the Yonder Graph multi-agent squad.

Your role:
1. Receive the parsed incident from the Triage Agent.
2. Dispatch to the Diagnostic Agent for SOP retrieval from Neo4j.
3. Send diagnostic SQL templates to the SQL Binding Agent for parameter binding.
4. Route the complete plan through the Governance Agent for risk evaluation.
5. Assemble the final response payload with:
   - Triage summary and domain classification
   - Matched SOP runbook details
   - Validated diagnostic SQL with bound parameters
   - Governance risk evaluation and remediation recommendation
   - Agent reasoning trace for transparency

FAIL-CLOSED RULES:
- If NO SOP is found, return a "no_match" response — never hallucinate runbooks.
- If SQL validation FAILS, return the governance blocking reason — never bypass.
- ALL SQL must pass through Tier 2 validation before inclusion in the response.
"""


# ──────────────────────────────────────────────────────────────
# Agent Construction Functions
# ──────────────────────────────────────────────────────────────

def build_triage_agent() -> LlmAgent:
    """Build the Triage & Routing Agent."""
    return LlmAgent(
        name="TriageRoutingAgent",
        model=LLMProviderFactory.get_model_name(),
        instruction=TRIAGE_SYSTEM_PROMPT,
        description="Parses incident tickets, extracts business keys, and routes by WMS domain.",
    )


def build_diagnostic_agent() -> LlmAgent:
    """Build the GraphRAG Diagnostic Agent with Neo4j tools."""
    return LlmAgent(
        name="GraphRAGDiagnosticAgent",
        model=LLMProviderFactory.get_model_name(),
        instruction=DIAGNOSTIC_SYSTEM_PROMPT,
        description="Retrieves matching SOP runbooks and diagnostic SQL from the Neo4j knowledge graph.",
        tools=[
            search_sop_runbooks,
            get_table_schema,
            query_knowledge_graph,
        ],
    )


def build_sql_binding_agent() -> LlmAgent:
    """Build the SQL Parameter Binding Agent."""
    return LlmAgent(
        name="SQLParameterBindingAgent",
        model=LLMProviderFactory.get_model_name(),
        instruction=SQL_BINDING_SYSTEM_PROMPT,
        description="Safely binds business key parameters to Oracle SQL templates and validates through Tier 2.",
        tools=[
            bind_sql_parameters,
            validate_oracle_sql,
        ],
    )


def build_governance_agent() -> LlmAgent:
    """Build the Governance & Safety Advisor Agent (Tier 1)."""
    return LlmAgent(
        name="GovernanceSafetyAgent",
        model=LLMProviderFactory.get_model_name(),
        instruction=GOVERNANCE_SYSTEM_PROMPT,
        description="Evaluates operational risk, selects remediation tiers, and provides policy justifications.",
        tools=[
            get_remediation_policy,
            log_governance_decision,
        ],
    )


def build_coordinator_agent() -> SequentialAgent:
    """
    Build the top-level Coordinator Agent.
    
    Orchestrates the full diagnostic pipeline:
    Triage → Diagnostic → SQL Binding → Governance → Response Assembly
    """
    return SequentialAgent(
        name="CoordinatorAgent",
        description="Orchestrates the multi-agent diagnostic pipeline with Two-Tier Governance enforcement.",
        sub_agents=[
            build_triage_agent(),
            build_diagnostic_agent(),
            build_sql_binding_agent(),
            build_governance_agent(),
        ],
    )


INTENT_CLASSIFIER_PROMPT = """You are the Intent Classification Agent for the Yonder Graph platform.

Your role:
Analyze the user's input and classify it into one of two fundamental operational modes:
1. GENERAL_PROCESS_INQUIRY: Conceptual questions about supply chain flows, domain architectures, table purposes, and general operational overviews (e.g., "explain inbound flow", "how does waving work", "what is inventory", "overview of the system").
2. INCIDENT_TRIAGE: Specific production break-fix issues, errors, stuck records, or diagnostic investigations (e.g., "Order ORD1001 stuck in Planned", "Inventory hold on LPN 5002", "Wave allocation failed at WH01").

Always respond with valid JSON:
{
  "intent": "GENERAL_PROCESS_INQUIRY|INCIDENT_TRIAGE",
  "domain": "Inbound|Outbound|Inventory|general",
  "topic": "summary of the topic or entity"
}
"""

DOMAIN_KNOWLEDGE_PROMPT = """You are the Domain Knowledge Agent for the Yonder Graph platform.

CRITICAL RULES:
1. Ground your explanation STRICTLY on the Domain nodes, Tables, and entity relationships retrieved from the Neo4j Knowledge Graph.
2. Distinguish query types carefully:
   - For PROCESS FLOW / ARCHITECTURE queries: Explain the supply chain process flow in clear, friendly English with sequential steps. Generate a Mermaid.js diagram ONLY if the process has multi-stage or branching complexity.
   - For SCHEMA / TABLE & COLUMN MAPPING queries: Explain table relationships, key status columns, and lookup procedures without generating process flowcharts or Mermaid diagrams.
3. DO NOT recommend MOCA emergency commands or incident patch scripts — this is a domain knowledge explanation.
"""

def build_intent_classifier_agent() -> LlmAgent:
    """Build the Intent Classification Agent."""
    return LlmAgent(
        name="IntentClassifierAgent",
        model=LLMProviderFactory.get_model_name(),
        instruction=INTENT_CLASSIFIER_PROMPT,
        description="Classifies user queries into General Process Inquiries vs Incident Triage.",
    )


def build_domain_knowledge_agent() -> LlmAgent:
    """Build the Domain Knowledge Agent with Neo4j tools."""
    return LlmAgent(
        name="DomainKnowledgeAgent",
        model=LLMProviderFactory.get_model_name(),
        instruction=DOMAIN_KNOWLEDGE_PROMPT,
        description="Synthesizes domain process flows and entity lifecycle diagrams from the Neo4j Knowledge Graph.",
        tools=[
            get_table_schema,
            query_knowledge_graph,
        ],
    )


# ──────────────────────────────────────────────────────────────
# Dedicated Persona Agents: AskProcessAgent & ResolveTriageAgent
# ──────────────────────────────────────────────────────────────

ASK_PROCESS_SYSTEM_PROMPT = """You are the AskProcessAgent (Ask Persona) for the Yonder Graph platform.

Your primary mission:
Provide clear, educational, and grounded explanations of Blue Yonder WMS supply chain processes, table structures, column mappings, and domain lifecycles strictly from the Neo4j Knowledge Graph.

QUERY UNDERSTANDING & OUTPUT RULES:
1. QUERY TYPE RECOGNITION:
   a) TABLE / COLUMN / STATUS MAPPING INQUIRIES (e.g., "show me how to check the order status", "where is inventory status stored", "table mappings for receiving"):
      - Focus on specific Oracle tables, key columns (column name, data type, purpose), status flags, and data relationships.
      - Explain how status is determined across tables (e.g., header status vs line quantities vs shipment status).
      - Include concise, read-only SQL lookup queries demonstrating how to inspect the status.
      - DO NOT generate a full-blown end-to-end process flow architecture or Mermaid diagrams (set `mermaid_diagram: null`).
      - If steps are provided, make them concise verification steps (e.g., Step 1: Check Order Header, Step 2: Check Line Progress, Step 3: Check Shipment).

   b) PROCESS FLOW / LIFECYCLE INQUIRIES (e.g., "show me the order process flow", "explain the inbound receiving flow", "how does wave allocation work end-to-end"):
      - Provide a sequential, step-by-step walkthrough of the supply chain lifecycle (`steps`: Step 1, Step 2, Step 3...).
      - MERMAID DIAGRAM COMPLEXITY RULE:
        * ONLY generate a Mermaid flowchart (`graph TD` or `flowchart LR`) if the process involves multi-stage, multi-entity, or branching complexity (e.g., full Order Ingestion -> Waving -> Picking -> Staging -> Loading -> Ship Confirm).
        * For simple, linear, or single-entity process descriptions, set `mermaid_diagram: null`.
        * Do NOT force a diagram for every request.

   c) GENERAL FAQ / CONCEPT INQUIRIES (e.g., "what is MOCA", "what is an LPN"):
      - Provide a concise, clear narrative. Set `mermaid_diagram: null` and `steps: []`.

2. ZERO HALLUCINATION: Ground every explanation, table name, and column name strictly in the Neo4j Knowledge Graph.
3. DO NOT generate incident remediation SQL or emergency MOCA commands — focus strictly on educational knowledge.
"""

RESOLVE_TRIAGE_SYSTEM_PROMPT = """You are the ResolveTriageAgent (Resolve Persona) for the Yonder Graph platform.

Your primary mission:
Investigate and diagnose production incidents, stuck records, and service requests with zero-error governance and structured investigation steps.

CRITICAL RULES:
1. Ground your investigation strictly on the SOP runbooks and table schema retrieved from Neo4j. Zero hallucination.
2. Decompose the triage investigation into clear, numbered investigation steps:
   - Step Number (1, 2, 3, ...)
   - Step Title (e.g. "Check Order Header Allocation Status", "Inspect Inventory Holds & Allocation Footprint")
   - Step Description: Exact diagnostic purpose and what conditions to look for.
   - Diagnostic SQL: Targeted, read-only Oracle SQL query with bound business keys (:ordnum, :wh_id, etc.).
   - Expected Outcome: What normal vs abnormal results signify.
3. Every single diagnostic SQL query must be strictly READ-ONLY (SELECT only) and pass Tier 2 AST validation.
4. Provide Tier 1 Governance evaluation and recommended MOCA/safe resolution policy.
5. Mermaid diagrams: Default to `mermaid_diagram: null` unless specifically illustrating an incident decision-tree or multi-system routing escalation.
"""


def build_ask_process_agent() -> LlmAgent:
    """Build the AskProcessAgent (FAQ & Process Guide)."""
    return LlmAgent(
        name="AskProcessAgent",
        model=LLMProviderFactory.get_model_name(),
        instruction=ASK_PROCESS_SYSTEM_PROMPT,
        description="Explains supply chain process flows and table architectures with numbered steps and Mermaid diagrams.",
        tools=[
            get_table_schema,
            query_knowledge_graph,
        ],
    )


def build_resolve_triage_agent() -> LlmAgent:
    """Build the ResolveTriageAgent (Incident & Service Request Investigator)."""
    return LlmAgent(
        name="ResolveTriageAgent",
        model=LLMProviderFactory.get_model_name(),
        instruction=RESOLVE_TRIAGE_SYSTEM_PROMPT,
        description="Investigates production incidents with step-by-step diagnostic procedures, per-step Oracle SQL, and governance checks.",
        tools=[
            search_sop_runbooks,
            get_table_schema,
            query_knowledge_graph,
            bind_sql_parameters,
            validate_oracle_sql,
            get_remediation_policy,
        ],
    )


def get_agent_registry() -> Dict[str, Dict[str, Any]]:
    """Return metadata about all registered agents for the dashboard."""
    return {
        "AskProcessAgent": {
            "role": "Ask Persona: FAQ & supply chain process flows with numbered steps and Mermaid flowcharts",
            "tier": "none",
            "tools": ["query_knowledge_graph", "get_table_schema"],
        },
        "ResolveTriageAgent": {
            "role": "Resolve Persona: Incident triage, service request diagnosis, step-by-step investigation & SQL consolidation",
            "tier": "both",
            "tools": [
                "search_sop_runbooks",
                "get_table_schema",
                "query_knowledge_graph",
                "bind_sql_parameters",
                "validate_oracle_sql",
                "get_remediation_policy",
            ],
        },
        "IntentClassifierAgent": {
            "role": "Top-level intent classification: General Process Inquiries vs Production Incident Triage",
            "tier": "none",
            "tools": [],
        },
        "DomainKnowledgeAgent": {
            "role": "Neo4j domain graph traversal, process flow synthesis, and Mermaid diagram generation",
            "tier": "none",
            "tools": ["query_knowledge_graph", "get_table_schema"],
        },
        "TriageRoutingAgent": {
            "role": "Incident parsing, business key extraction, and domain routing",
            "tier": "none",
            "tools": [],
        },
        "GraphRAGDiagnosticAgent": {
            "role": "Neo4j SOP retrieval, table schema lookup, and diagnostic SQL extraction",
            "tier": "none",
            "tools": [
                "search_sop_runbooks",
                "get_table_schema",
                "query_knowledge_graph",
            ],
        },
        "SQLParameterBindingAgent": {
            "role": "Oracle SQL parameter binding and Tier 2 AST read-only validation",
            "tier": "tier2",
            "tools": ["bind_sql_parameters", "validate_oracle_sql"],
        },
        "GovernanceSafetyAgent": {
            "role": "Tier 1 risk evaluation, Four-Tier remediation routing, and post-synthesis approval",
            "tier": "tier1",
            "tools": ["get_remediation_policy", "log_governance_decision"],
        },
        "HumanizingAgent": {
            "role": "Natural language synthesis, IT engineer narrative formatting, and SQL reasoning breakdown",
            "tier": "none",
            "tools": [],
        },
        "CoordinatorAgent": {
            "role": "Dual-track multi-agent orchestration, audit logging, and response assembly",
            "tier": "both",
            "tools": [],
        },
    }

