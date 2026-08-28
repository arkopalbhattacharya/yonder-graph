# Optimization & Future Scope

Yonder Graph is built as a highly modular foundation. As the enterprise scales, several architectural optimizations can be introduced.

## 1. Async Multi-Agent Execution
Currently, the `CoordinatorAgent` executes the multi-agent pipeline sequentially (Triage → Diagnostic → SQL Binding → Governance). While this ensures strict state management, adopting asynchronous execution (e.g., using `asyncio` with the Google ADK) would allow parallel processing where applicable (e.g., evaluating Governance risk simultaneously with Neo4j SOP retrieval), significantly reducing global P95 latency.

## 2. Advanced Caching Layer
Frequent deterministic queries (e.g., exact matches on specific error codes) currently traverse the full Neo4j graph and LLM pipeline. Implementing a Redis caching layer ahead of the Triage agent would allow instant responses for known, immutable incident patterns.

## 3. Automated Root Cause Analysis (RCA) Reports
The current system provides immediate triage and diagnostic SQL. A future iteration could include an `RCAGenerationAgent` that takes the output of the executed diagnostic SQL (run manually by the SME) and automatically drafts a formal ITIL-compliant Incident Report.

## 4. Integration with ITSM Tools
The PostgreSQL audit log currently tracks all activity internally. Building a bidirectional sync with ServiceNow or Jira Service Management would allow Yonder Graph to automatically update ticket statuses, append diagnostic SQL to the work notes, and close tickets upon successful remediation.

## 5. Expanding Tier 2 Validator Logic
The current Oracle SQL validator (`sqlparse` AST interceptor) is highly effective at blocking mutations. Future enhancements could include:
- Complex join validation (preventing Cartesian products).
- Index utilization checks (blocking queries that scan unindexed columns on tables with >1M rows).
- Query cost estimation gating.
