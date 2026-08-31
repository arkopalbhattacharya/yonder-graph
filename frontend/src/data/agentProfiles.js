/**
 * Yonder Graph Multi-Agent Squad Profiles & Engineering Reference
 * Comprehensive breakdown tailored for L1 (Operations/Service Desk),
 * L2 (Application Support & Incident Triage), and L3 (WMS Architects / DBAs).
 */

export const AGENT_PROFILES = {
  SentinelScannerAgent: {
    name: "SentinelScannerAgent",
    title: "Autonomous Proactive WMS Health Sentinel",
    tagline: "Autonomous 24/7 background diagnostic daemon detecting wave shortfalls, dock bottlenecks, and hold locks.",
    primaryMission: "Continuously scans Oracle WMS tables (PCKWAV, RCVTRK, INVDTL, ORD) in read-only mode to detect operational deadlocks and auto-triage solutions before floor operations are impacted.",
    category: "Autonomous Proactive Sentinel",
    tier: "Tier 1 AST Read-Only Enforced",
    healthStatus: "Continuous autonomous background poller operating strictly under SET TRANSACTION READ ONLY air gap.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Floor Operators, Shift Supervisors, Operations Incident Leads",
      points: [
        "Catches stuck pick waves and inventory shortages before warehouse pickers experience idle time.",
        "Alerts floor supervisors to stagnant inbound trailers checked into dock doors >4 hours without receiving lines.",
        "Provides 1-click 'Investigate in Copilot' button with pre-assembled root causes and solutions."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "WMS Functional Analysts, Application Support Engineers",
      points: [
        "Extracts business keys (wave_num, wh_id, lodnum, trknum) directly from table ground truth.",
        "Automatically evaluates severity thresholds (CRITICAL, HIGH, WARNING) across all WMS domains.",
        "Dispatches detected anomalies to the 7-agent squad in background to generate investigation steps in 1.2s."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Database Administrators, Backend Developers, Solutions Architects",
      points: [
        "Enforces 4-layer Zero-Mutation Air-Gap: AST SELECT Enforcer, session READ ONLY lock, and DB GRANT SELECT.",
        "Runs with Oracle optimizer hints, strict ROWNUM <= 50 bounds, and 2.0s query timeouts to prevent locks.",
        "Recommends pointing sweeps to Oracle Active Data Guard Read Replicas for zero-OLTP performance impact."
      ]
    },
    governanceGuardrails: [
      "Zero-Mutation Air-Gap: Mathematically prohibits all INSERT, UPDATE, DELETE, and DDL commands.",
      "Pre-Execution AST Validation: Statements are decomposed via sqlparse and verified before execution.",
      "Session Read-Only Mode: Executes 'SET TRANSACTION READ ONLY' on every database connection.",
      "Strict Bounded Queries: Enforces ROWNUM <= 50 and maximum 2.0s execution timeout."
    ]
  },

  AskProcessAgent: {
    name: "AskProcessAgent",
    title: "Supply Chain Process & SOP Knowledge Guide",
    tagline: "Interactive educational flow synthesizer with Mermaid state diagrams and step-by-step guidance.",
    primaryMission: "Demystifies complex supply chain warehousing processes, translating business workflows into structured, visual procedural walkthroughs for operations staff.",
    category: "Educational & Knowledge Synthesis",
    tier: "Read-Only Informational",
    healthStatus: "Operates purely in read-only informational space with zero database mutation risk.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Floor Operators, Shift Supervisors, Service Desk Analysts",
      points: [
        "Provides clear, numbered instructions on how warehouse tasks should be performed (e.g. Inbound ASN Receiving, Wave Picking, Cycle Counts).",
        "Generates visual Mermaid flowcharts to help operators see the lifecycle of an order or shipment.",
        "Answers 'How do I...' and 'What is the standard procedure for...' questions without technical jargon."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "WMS Functional Analysts, Application Support Engineers",
      points: [
        "Identifies required transaction preconditions before inventory or order status transitions can occur.",
        "Maps user symptoms against standard business process milestones to pinpoint deviations.",
        "Outlines screen navigation sequences and expected system states for Oracle WMS modules."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Database Administrators, Backend Developers, Solutions Architects",
      points: [
        "Traverses Neo4j entity graph ontology (Process -> Task -> Table -> Column) without touching production OLTP.",
        "Validates process flow coherence against active schema definitions and SOP runbooks.",
        "Enforces deterministic zero-mutation output constraints with strict read-only token guarantees."
      ]
    },
    governanceGuardrails: [
      "Strictly informational — prohibited from generating DML or executing backend commands.",
      "Automatically bounds all graph traversals to prevent runaway recursion.",
      "Outputs sanitized Mermaid diagram definitions rendered safely in the client."
    ]
  },

  ResolveTriageAgent: {
    name: "ResolveTriageAgent",
    title: "Production Incident Diagnostic & Triage Orchestrator",
    tagline: "End-to-end incident investigation synthesizer with step-by-step diagnostic cards and consolidated SQL.",
    primaryMission: "Investigates mission-critical WMS supply chain incidents, extracts root causes from graph runbooks, binds live parameters, and generates safe diagnostic SQL scripts.",
    category: "Incident Triage & SQL Generation",
    tier: "Tier 1 Cognitive & Tier 2 AST Safe",
    healthStatus: "Active diagnostic orchestrator with dual-tier cognitive and AST validation guards.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Floor Supervisors, IT Helpdesk, Operations Incident Leads",
      points: [
        "Pulls order numbers (ordnum), loads (lodnum), and warehouse codes (wh_id) straight from ticket descriptions.",
        "Delivers structured diagnostic cards (Step 1: Check Header, Step 2: Check Lines, Step 3: Check Holds).",
        "Provides immediate plain-English explanations of why an order or shipment is stuck."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Incident Triage",
      audience: "L2 Support Engineers, WMS Technical Analysts",
      points: [
        "Generates ready-to-run, parameter-bound Oracle SQL diagnostic queries for each triage step.",
        "Consolidates individual queries into a single verified diagnostic script for quick DBA/support execution.",
        "Explains expected vs abnormal query outcomes to isolate inventory shortfalls or lock contention."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Senior DBAs, Principal Architects, Performance Engineers",
      points: [
        "Enforces Tier 2 AST validation using Python sqlparse to hard-block any data mutation (UPDATE/DELETE/DROP).",
        "Injects Oracle-specific ROWNUM <= 100 safeguards on all SELECT queries to protect database buffer pools.",
        "Mandates SME Approval triggers and rollback specifications for any remediation tier above Level 1 MOCA."
      ]
    },
    governanceGuardrails: [
      "Two-tier zero-error governance: Cognitive Tier 1 risk assessment + AST Tier 2 hard validator.",
      "Requires explicit SME sign-off for any proposed database patch or structural schema correction.",
      "All diagnostic SQL validated against active Neo4j schema definitions before client dispatch."
    ]
  },

  IntentClassifierAgent: {
    name: "IntentClassifierAgent",
    title: "Cognitive Intent Gateway & Domain Boundary Guard",
    tagline: "Semantic classifier enforcing strict supply chain domain boundaries and mode-specific routing (Ask vs Resolve).",
    primaryMission: "Analyzes incoming user queries to classify operational intent between General Process Guidance (Ask Mode) and Active Production Incident Triage (Resolve Mode), while intercepting out-of-scope queries and mode mismatches before graph traversal.",
    category: "Cognitive Routing & Gateway Guard",
    tier: "Gateway Classifier & Domain Guard",
    healthStatus: "Low-latency deterministic classifier enforcing domain boundaries and mode guardrails.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "All Users, Operations Dispatchers, Service Desk",
      points: [
        "Eliminates misrouted tickets by ensuring general process questions are routed through Ask Mode and production incidents through Resolve Mode.",
        "Catches and stops out-of-scope queries (weather, general trivia, recipes) immediately with helpful supply chain example prompts.",
        "Understands warehouse phrasing, typos, barcode scans, and raw pasted system logs."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "Incident Handlers, WMS Support Specialists",
      points: [
        "Enforces strict mode guardrails: GENERAL_PROCESS_INQUIRY is restricted to Ask Mode; INCIDENT_TRIAGE is restricted to Resolve Mode.",
        "Intercepts mode mismatches at step 1 to guide analysts to the appropriate toolset with zero wasted database hops.",
        "Extracts domain classification (Inbound, Outbound, Inventory) and records confidence metrics in the audit trace."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Architects, Security Engineers, Database Administrators",
      points: [
        "Domain Guardrail: Completely bypasses Neo4j graph traversal and SQL generation when queries are OUT_OF_SCOPE or mode-mismatched.",
        "Fast-path keyword filtering alongside structured 3-category LLM JSON schema classification.",
        "Logs full audit telemetry events (OUT_OF_SCOPE_INTERCEPT, MODE_MISMATCH_INTERCEPT) to PostgreSQL."
      ]
    },
    governanceGuardrails: [
      "Strict Supply Chain Domain Boundary: Restricts queries strictly to Blue Yonder WMS, logistics, and Oracle database operations.",
      "Operational Mode Guardrail: Hard-blocks GENERAL_PROCESS_INQUIRY in Resolve Mode and INCIDENT_TRIAGE in Ask Mode.",
      "Zero-Graph Air Gap for Non-Matching Queries: Emits immediate client guidance without invoking Neo4j or SQL engines."
    ]
  },

  DomainKnowledgeAgent: {
    name: "DomainKnowledgeAgent",
    title: "Graph Knowledge Traversal & Ontology Navigator",
    tagline: "Traverses Neo4j graph nodes to discover warehouse entity relationships and schema ontologies.",
    primaryMission: "Queries and navigates the graph database to uncover relational links between warehouse tables, SOP documents, business columns, and physical process workflows.",
    category: "Graph Knowledge & Schema Navigation",
    tier: "GraphRAG Traversal",
    healthStatus: "Traverses Neo4j graph database using parameterized, read-only Cypher queries.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Service Desk, New Onboarding Engineers",
      points: [
        "Shows how different warehouse components fit together (e.g. Purchase Orders -> ASNs -> Pallets -> Inventory).",
        "Discovers related procedures when an operator is searching for guidance.",
        "Helps visualize interconnected supply chain steps."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "WMS Support Engineers, Technical Analysts",
      points: [
        "Maps functional business entities to specific Oracle database tables (e.g. 'Order' -> ORD, 'Pallet' -> INVLOD).",
        "Traces foreign key relationships and logical table dependencies across modules.",
        "Identifies relevant documentation runbooks attached to specific database tables."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Graph Architects, Database Administrators",
      points: [
        "Executes vector similarity search and Cypher graph pattern traversals in Neo4j.",
        "Validates schema column metadata, primary keys, and index configurations.",
        "Keeps graph schema caches fresh without locking active transactional databases."
      ]
    },
    governanceGuardrails: [
      "All Cypher queries run with read-only transaction wrappers (execute_read).",
      "Hop counts constrained to maximum depth 3 to prevent graph combinatorial explosion."
    ]
  },

  TriageRoutingAgent: {
    name: "TriageRoutingAgent",
    title: "Business Key Extractor & Domain Classifier",
    tagline: "Extracts supply chain identifiers and categorizes incident severity and domain.",
    primaryMission: "Parses unformatted incident tickets to extract operational business keys (ordnum, wh_id, lodnum, trknum) and route issues into Inbound, Outbound, or Inventory domains.",
    category: "Key Extraction & Routing",
    tier: "Deterministic Parser",
    healthStatus: "Dual regex and LLM extractor with zero side effects.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Floor Supervisors, Ticket Logging Staff",
      points: [
        "Automatically identifies order IDs and warehouse numbers even if pasted inside a messy email or log.",
        "Flags whether an incident is Inbound (receiving), Outbound (shipping), or Inventory (stock).",
        "Prevents tickets from bouncing between queues due to missing identifiers."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "Triage Engineers, Application Support",
      points: [
        "Standardizes extracted keys for immediate downstream parameter binding in diagnostic SQL queries.",
        "Assigns preliminary incident severity levels (LOW, MEDIUM, HIGH, CRITICAL).",
        "Provides structured JSON business key dictionaries to the diagnostic pipeline."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Backend Engineers, Security Analysts",
      points: [
        "Sanitizes parameter characters against regex patterns to prevent SQL injection payloads.",
        "Normalizes warehouse keys against Oracle schema data types (VARCHAR2, NUMBER).",
        "Employs fallback regex parsers when LLM response times or connectivity jitter occur."
      ]
    },
    governanceGuardrails: [
      "Input regex sanitization blocks alphanumeric special character attacks.",
      "Strict parameter whitelisting for Oracle bind variables."
    ]
  },

  GraphRAGDiagnosticAgent: {
    name: "GraphRAGDiagnosticAgent",
    title: "Semantic SOP & Diagnostic SQL Retriever",
    tagline: "Finds the exact standard operating runbook and validated diagnostic SQL templates in Neo4j.",
    primaryMission: "Performs hybrid semantic and keyword search across the Neo4j SOP knowledge base to match verified incident runbooks with their diagnostic SQL queries.",
    category: "Retrieval Augmented Generation",
    tier: "GraphRAG Retrieval",
    healthStatus: "Connected to Neo4j knowledge base with vector indexing and fulltext search.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Floor Operators, Helpdesk Agents",
      points: [
        "Finds the approved SOP document written specifically for the problem reported.",
        "Displays the official SOP ID (e.g. SOP-OB-002) for audit compliance and ticket referencing.",
        "Provides the verified resolution steps authored by warehouse operations management."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "WMS L2 Support, Incident Responders",
      points: [
        "Retrieves pre-tested, read-only diagnostic SQL queries designed to pinpoint the root cause.",
        "Pairs diagnostic steps with expected data values so engineers know what abnormal records look like.",
        "Identifies related tables required for comprehensive root cause analysis."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Senior DBAs, Architecture Review Board",
      points: [
        "Retrieves queries that adhere to Oracle index strategies and partition pruning guidelines.",
        "Verifies that SOP SQL templates use bind variables rather than raw string concatenation.",
        "Logs vector similarity scores and cosine distances for continual retrieval tuning."
      ]
    },
    governanceGuardrails: [
      "Only retrieves curated and verified SOP runbooks from the governed knowledge base.",
      "Rejects unverified or community-submitted SQL without governance audit approval."
    ]
  },

  SQLParameterBindingAgent: {
    name: "SQLParameterBindingAgent",
    title: "Oracle SQL Parameter Binder & Tier 2 AST Guard",
    tagline: "Deterministic AST validator and parameter binder ensuring 100% read-only SQL safety.",
    primaryMission: "Binds sanitized business keys into SQL templates and enforces Python AST validation to guarantee that every query is strictly a read-only SELECT statement with ROWNUM limits.",
    category: "SQL Safety & AST Validation",
    tier: "Tier 2 AST Hard Guard",
    healthStatus: "Active deterministic AST interceptor with zero-mutation hard-blocking.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Non-Technical Users, Service Desk",
      points: [
        "Guarantees that clicking or running any SQL provided by the system will NEVER delete or modify warehouse data.",
        "Fills in order and warehouse numbers automatically so users don't have to edit SQL code manually.",
        "Provides complete peace of mind when executing diagnostic checks in production."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "Application Support Engineers, Data Analysts",
      points: [
        "Formats clean, executable Oracle SQL queries ready for SQL Developer, MOCA, or Toad.",
        "Injects Oracle-compliant ROWNUM <= 100 limits to prevent queries from pulling millions of rows and freezing tools.",
        "Validates that all referenced table and column names exist in the warehouse database."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Oracle DBAs, Principal Security Architects",
      points: [
        "Employs Python sqlparse AST syntax tree inspection to hard-block mutation tokens (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, MERGE, EXEC, CALL).",
        "Regex-sanitizes bind variables against strict alphanumeric patterns to prevent SQL injection.",
        "Validates referenced tables against active Neo4j schema definitions and flags schema mismatches."
      ]
    },
    governanceGuardrails: [
      "Tier 2 Hard Interceptor: Rejects queries containing ANY DML/DDL mutation keywords.",
      "Strict row limiting: Automatically injects ROWNUM <= 100 or FETCH FIRST 100 ROWS ONLY.",
      "Fail-closed execution: Any AST parse ambiguity results in immediate query rejection."
    ]
  },

  GovernanceSafetyAgent: {
    name: "GovernanceSafetyAgent",
    title: "Tier 1 Cognitive Risk & Policy Advisor",
    tagline: "Cognitive risk evaluator enforcing the Four-Tier Remediation Policy and SME approvals.",
    primaryMission: "Evaluates the operational risk of proposed resolutions, enforces the Four-Tier Remediation Policy (MOCA -> UI -> Governed Patch -> Dual-Control), and flags high-risk actions for SME approval.",
    category: "Cognitive Governance & Policy",
    tier: "Tier 1 Cognitive Advisor",
    healthStatus: "Operational compliance officer with immutable PostgreSQL audit logging.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Floor Staff, Shift Managers, Helpdesk",
      points: [
        "Guides operators to safe UI screens and standard MOCA commands rather than risky backend changes.",
        "Explains company policy on why certain fixes cannot be performed directly on the database.",
        "Protects operations from unintended side effects during high-pressure outage scenarios."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "L2 Support Leads, Incident Incident Managers",
      points: [
        "Classifies resolution actions into standard risk tiers (Low, Medium, High, Critical).",
        "Identifies mandatory preconditions that must be verified before performing a fix.",
        "Specifies step-by-step rollback procedures in case a remediation does not resolve the issue."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "IT Compliance, Security Officers, Principal DBAs",
      points: [
        "Enforces the Four-Tier Policy: Level 1 (MOCA), Level 2 (UI Guidance), Level 3 (Governed Patch), Level 4 (Dual-Control Sign-off).",
        "Automatically writes immutable audit records to PostgreSQL (agent_audit_logs) for SOC2/ISO compliance.",
        "Blocks automated data fixes on core financial and inventory ledger tables (INVLOT, INVSUB, ORD_LINE)."
      ]
    },
    governanceGuardrails: [
      "Mandates SME (Subject Matter Expert) approval for any High or Critical risk action.",
      "Logs every safety evaluation and policy justification to PostgreSQL audit tables.",
      "Re-evaluates synthesized narratives to verify that no unauthorized instructions bypass policy."
    ]
  },

  HumanizingAgent: {
    name: "HumanizingAgent",
    title: "Technical Narrative & Reasoning Architect",
    tagline: "Translates complex graph traces, AST validations, and SQL outputs into clear engineer narratives.",
    primaryMission: "Synthesizes multi-agent graph telemetry, SOP steps, and SQL diagnostics into clear, professional IT triage narratives and step-by-step reasoning breakdowns.",
    category: "Natural Language Synthesis",
    tier: "Synthesis & Formatting",
    healthStatus: "Active natural language generation model with strict tone and formatting guidelines.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Service Desk Technicians, Warehouse Supervisors",
      points: [
        "Explains complex technical findings in clear, understandable language.",
        "Highlights the immediate next steps needed to move a stuck order or shipment forward.",
        "Eliminates cryptic database error codes and raw JSON outputs from the final answer."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "Application Support Engineers, Technical Analysts",
      points: [
        "Provides clear 'Why This SQL Works' breakdowns explaining table joins and filter conditions.",
        "Structures output into clean, organized sections: Overview, Investigation Steps, SQL Script, and Resolution.",
        "Maintains consistent formatting across all triage responses for easy ticket logging."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Engineering Managers, Technical Writers",
      points: [
        "Ensures precise technical terminology (e.g. pessimistic locking, allocation status flags, MOCA verbs).",
        "Maintains zero-hallucination compliance by strictly grounding narrative text in retrieved SOPs.",
        "Formats consolidated SQL blocks with proper headers, comments, and transaction notes."
      ]
    },
    governanceGuardrails: [
      "Subject to narrative governance checks to ensure no forbidden instructions are generated.",
      "Grounds 100% of facts in retrieved Neo4j knowledge nodes and SQL execution plans."
    ]
  },

  CoordinatorAgent: {
    name: "CoordinatorAgent",
    title: "Multi-Agent Squad Orchestrator & Audit Dispatcher",
    tagline: "Master controller orchestrating dual-track agent squad execution, telemetry, and audit logging.",
    primaryMission: "Orchestrates the entire multi-agent squad, managing asynchronous execution pipelines, calculating turn latencies, collecting token telemetry, and persisting audit logs to PostgreSQL.",
    category: "Master Orchestration & Telemetry",
    tier: "Master Orchestrator",
    healthStatus: "Core execution engine running dual-track pipelines with live telemetry aggregation.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "All Users and Operational Stakeholders",
      points: [
        "Coordinates all sub-agents behind the scenes to deliver a seamless, single-response experience.",
        "Ensures fast response times and handles temporary network retries transparently.",
        "Guarantees that user requests never get lost or stuck in infinite loops."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "Application Support Leads, System Integrators",
      points: [
        "Maintains detailed agent trace logs showing latency and output for each triage step.",
        "Collects per-agent and per-session token metrics stored in local storage and telemetry.",
        "Enables instant stop and cancellation of running triage requests if requested by the user."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Platform Engineers, SREs, Enterprise Architects",
      points: [
        "Manages dual-track execution pipelines for AskProcessAgent and ResolveTriageAgent.",
        "Calculates rolling P95 latencies and error rates across all squad members.",
        "Writes complete execution metadata and token counts to PostgreSQL agent_audit_logs."
      ]
    },
    governanceGuardrails: [
      "Enforces pipeline timeouts (15s) to prevent thread exhaustion.",
      "Provides thread-safe lock management across concurrent triage sessions.",
      "Logs immutable audit trails for every agent invocation and policy decision."
    ]
  },

  EnrichmentAgent: {
    name: "EnrichmentAgent",
    title: "Knowledge Ingestion & Graph Schema Extender",
    tagline: "Parses Oracle DDL and SOP markdown files to enrich and update the Neo4j knowledge graph.",
    primaryMission: "Asynchronously parses incoming SOP runbooks, Oracle DDL schema files, and warehouse documentation to construct graph nodes, relationships, and vector embeddings in Neo4j.",
    category: "Knowledge Ingestion & Graph ETL",
    tier: "Graph ETL & Enrichment",
    healthStatus: "Background knowledge poller and vector indexing pipeline.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Process Authors, Warehouse Managers",
      points: [
        "Allows teams to add new SOPs simply by dropping markdown files into the knowledge directory.",
        "Ensures the system always has the latest warehouse operating rules and changes.",
        "Automatically links new operational procedures to existing warehouse departments."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "Support Engineers, Subject Matter Experts",
      points: [
        "Ingests newly created custom WMS tables, columns, and MOCA commands into the graph.",
        "Validates that new SOPs have valid diagnostic SQL templates before making them active.",
        "Maintains versioning and update timestamps on all graph knowledge nodes."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Data Engineers, Graph DBAs, Knowledge Architects",
      points: [
        "Parses Oracle DDL syntax to extract table definitions, primary keys, and foreign key constraints.",
        "Generates dense text embeddings for vector indexing in Neo4j using Google Gemini.",
        "Maintains graph referential integrity and ontological schema constraints across updates."
      ]
    },
    governanceGuardrails: [
      "Requires schema verification before creating new database table nodes in Neo4j.",
      "Rejects duplicate SOP IDs and validates foreign key referential integrity in the graph."
    ]
  },

  PIISanitizerAgent: {
    name: "PIISanitizerAgent",
    title: "Tier 0 On-Premise PII & Data Privacy Perimeter",
    tagline: "Zero-GPU hybrid regex + contextual entity recognizer sanitizing personal data before LLM transmission.",
    primaryMission: "Guarantees that sensitive customer data (credit cards, emails, phone numbers, physical addresses, names) is masked on-premise before external LLM dispatch or Neo4j persistence.",
    category: "Data Privacy & Governance Perimeter",
    tier: "Tier 0 On-Premise Privacy Perimeter",
    healthStatus: "Active on-premise deterministic + NER sanitization running in <20ms on CPU.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Floor Operators, Service Desk, Customer Service",
      points: [
        "Automatically masks customer contact details and payment numbers in incident tickets.",
        "Prevents customer PII from ever leaving company servers or appearing in external AI logs.",
        "Enables safe troubleshooting using operational order and inventory IDs without privacy risks."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "Support Engineers, Incident Leads, Security Compliance",
      points: [
        "Sanitizes live Oracle WMS tabular database results before feeding into agent reasoning context.",
        "Strips PII from uploaded Knowledge Studio runbooks and SME feedback corrections.",
        "Maintains ephemeral session vaults for tokenized entity tracking (<PII_EMAIL_1>, <PII_NAME_1>)."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "Security Officers, Cloud Architects, Compliance Auditors",
      points: [
        "Runs 100% on-premise on CPU with 0 GPU dependency and <300MB RAM footprint.",
        "Executes Luhn algorithm checksum validation for credit cards and regex patterns for SSNs and phones.",
        "Enforces strict data residency and compliance with GDPR, HIPAA, and CCPA privacy standards."
      ]
    },
    governanceGuardrails: [
      "Pre-LLM Execution: Operates before any cognitive agent evaluates the request.",
      "Zero Data Egress: Sensitive plain-text tokens are held in ephemeral RAM vault only.",
      "Dual-Pass Sanitization: Combines deterministic regex with contextual entity parsing."
    ]
  },

  ContextManagementAgent: {
    name: "ContextManagementAgent",
    title: "Context & Multi-Turn Session Manager",
    tagline: "Tracks per-chat conversation memory, business entity retention, and follow-up gating policies.",
    primaryMission: "Maintains conversation state across query turns, contextualizes follow-up questions with prior diagnostic context, and enforces single-turn vs multi-turn triage interaction guardrails.",
    category: "Session Memory & Orchestration Guard",
    tier: "Tier 1 Cognitive Context Enforced",
    healthStatus: "Active per-chat context tracker with single-turn policy gating enabled by default.",
    l1Summary: {
      title: "L1 — Service Desk & Warehouse Operations",
      audience: "Floor Operators, Service Desk, Operations Incident Leads",
      points: [
        "Keeps track of order numbers and warehouse IDs across questions when follow-up mode is enabled.",
        "Prevents cross-incident contamination by isolating each triage inquiry to a single turn by default.",
        "Provides clear guidance when follow-ups are restricted, pointing operators to '+ new chat'."
      ]
    },
    l2Summary: {
      title: "L2 — Application Support & Functional Triage",
      audience: "WMS Functional Analysts, Application Support Engineers",
      points: [
        "Resolves anaphoric references in follow-up queries ('why did that wave fail?', 'check the second order').",
        "Merges previous SQL diagnostic results with subsequent follow-up queries for deep-dive root cause analysis.",
        "Routes contextualized follow-up prompts through the full multi-agent squad (PII -> Intent -> SOP -> SQL -> AST -> Governance)."
      ]
    },
    l3Summary: {
      title: "L3 — Core Engineering, WMS Architects & DBAs",
      audience: "System Architects, Compliance Officers, Platform Leads",
      points: [
        "Constructed using hierarchical session state management patterns.",
        "Guards against context token explosion with sliding-window history extraction and PostgreSQL audit persistence.",
        "Feature-flagged under experimental settings ('yg-experimental-followup') with zero backend overhead when disabled."
      ]
    },
    governanceGuardrails: [
      "Single-Turn Isolation: Prevents prompt bleed between distinct operational incidents when disabled.",
      "Upstream PII Shielding: Follow-up contextualization occurs before Tier 0 PII de-tokenization to prevent token leaks.",
      "Audit Trail Integrity: Every context evaluation and follow-up block is logged in PostgreSQL AgentAuditLog."
    ]
  }
};
