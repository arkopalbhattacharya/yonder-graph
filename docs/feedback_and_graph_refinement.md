# Feedback & Graph Refinement

Yonder Graph is designed to get smarter over time without requiring retraining of the underlying LLM models. It achieves this through a closed-loop feedback mechanism that directly refines the Neo4j Knowledge Graph.

## 1. Operator Feedback (Thumbs Up/Down)
At the end of every diagnostic session in the Copilot UI, operators are prompted to evaluate the accuracy of the result.

- **THUMBS_UP**: Logs the success in the PostgreSQL `feedback_events` table. Increases the confidence weighting of the matched `(:SOPRunbook)`.
- **THUMBS_DOWN**: Flags the session for SME (Subject Matter Expert) review.

## 2. SME Correction Submission
When a Thumbs Down is registered, a modal allows the operator or an SME to submit a correction. They can provide:
- Corrected Triage Steps
- Corrected Read-Only Diagnostic SQL
- Corrected MOCA Commands
- Root Cause Analysis Criteria

## 3. Human-in-the-Loop (HITL) Validation
Corrections are not blindly accepted into the graph. They pass through the `HITLService`:
1. **Comprehensiveness Check**: The corrected triage steps must be substantially detailed.
2. **Tier 2 AST Validation**: Any provided SQL must pass the deterministic oracle SQL interceptor (must be read-only).
3. **Re-Evaluation Loop**: The `EnrichmentAgent` re-scores the corrected content against the 100-point rubric.
4. **Graph Patching**: If the updated SOP achieves a confidence score of ≥ 90%, the `HITLService` executes a Cypher `SET` query to patch the existing `(:SOPRunbook)` node (or create a new one) with the corrected information.

The next time an operator encounters the same issue, the Multi-Agent engine retrieves the newly patched SOP.
