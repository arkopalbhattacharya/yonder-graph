# Google ADK Multi-Agent Framework

Yonder Graph's diagnostic engine is powered by a hierarchical multi-agent squad built on the **Google Agent Development Kit (ADK)** (`google-adk`).

This framework orchestrates specialized AI agents that pass context and payloads to one another, culminating in a secure, validated response.

## The Squad Structure

1. **`CoordinatorAgent`** (`SequentialAgent`)
   - The top-level orchestrator.
   - Manages the state, assembles agent outputs, and formats the final JSON payload.

2. **`TriageRoutingAgent`**
   - **Role:** NLP classification and extraction.
   - **Task:** Parses raw user queries (e.g., "Order 1234 won't wave") to extract business keys (`ordnum=1234`) and domain (`Outbound`).
   - **Tools:** None.

3. **`GraphRAGDiagnosticAgent`**
   - **Role:** Information retrieval from Neo4j.
   - **Task:** Uses the parsed domain and issue pattern to locate the most relevant `(:SOPRunbook)` node. Returns deterministic triage steps and Oracle SQL templates.
   - **Tools:** `search_sop_runbooks`, `get_table_schema`, `query_knowledge_graph`.

4. **`SQLParameterBindingAgent`**
   - **Role:** Safe SQL interpolation.
   - **Task:** Takes the SQL template from the SOP and binds the business keys extracted by the Triage agent.
   - **Safety Gate:** Invokes the Tier 2 AST Validator tool. If validation fails, it halts the SQL generation process.
   - **Tools:** `bind_sql_parameters`, `validate_oracle_sql`.

5. **`GovernanceSafetyAgent`**
   - **Role:** Operational risk evaluation (Tier 1 Governance).
   - **Task:** Evaluates the proposed remediation action, assigns a risk level (e.g., `MEDIUM_RISK_IDEMPOTENT`), and selects a remediation tier (e.g., Level 1 MOCA).
   - **Tools:** `get_remediation_policy`, `log_governance_decision`.

## Telemetry
Each agent's latency, token consumption, and success/error rate are tracked by the `TelemetryCollector` and displayed in real-time on the React Agent Dashboard.
