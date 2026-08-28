# Telemetry & Monitoring

In a multi-agent system, performance bottlenecks are often hidden between agent handoffs. Yonder Graph implements a robust, thread-safe `TelemetryCollector` to monitor squad health in real-time.

## Metrics Tracked

1. **Global P95 Latency**: The 95th percentile latency across all agent invocations. This ensures that outlier slow API calls (e.g., from an overloaded LLM endpoint) are immediately visible.
2. **Agent-Specific Latency**: Each agent (Triage, Diagnostic, SQL Binding, Governance) is tracked independently.
3. **Token Consumption**: Total tokens utilized during the active server session.
4. **Governance Intercepts**: A specific counter for how many times the Tier 2 Validator blocked a query. A high spike here indicates either malicious user intent or severe LLM hallucination.
5. **Error Rates**: Tracks how often an agent fails to return a valid JSON payload or encounters an API timeout.

## Agent Dashboard

These metrics are exposed via the `/api/audit/stats` endpoint and rendered in the React **Agent Dashboard**. 

The dashboard provides a visual breakdown of:
- Total Invocations
- Global P95 Latency
- Tokens Consumed
- Governance Intercepts
- A grid view of individual agent performance (Calls, P95 Lat, Error Rate).

This real-time visibility is critical when testing different LLM providers (e.g., comparing Poolside latency vs. Gemini latency) during hot-swapping.
