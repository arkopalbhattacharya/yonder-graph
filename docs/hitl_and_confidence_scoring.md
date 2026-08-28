# Human-in-the-Loop & Confidence Scoring

Yonder Graph features a robust ingestion pipeline (`backend/ingestion/raw_poller.py`) designed to safely augment the Neo4j Knowledge Graph from raw markdown, text, or Excel documents.

## The 100-Point Confidence Rubric
When a new document is detected, the `EnrichmentAgent` evaluates it against a strict rubric to determine if it is safe to auto-ingest as an `(:SOPRunbook)` node.

1. **Schema Grounding (35 pts)**
   - Do the tables mentioned in the document actually exist in the Neo4j `(:Table)` metadata?
   - *Check*: Deterministic intersection of document text vs. Neo4j `oracle_table_name` properties.

2. **SQL/MOCA Safety (25 pts)**
   - If SQL is embedded in the document, is it read-only?
   - *Check*: The document's SQL blocks are extracted and passed through the Tier 2 AST Validator.

3. **Structural Metadata Completeness (20 pts)**
   - Does the document contain triage steps, root causes, and resolution steps?
   - *Check*: Regex matching for structural headers and list items.

4. **Domain Alignment (20 pts)**
   - Is the document relevant to Blue Yonder WMS?
   - *Check*: Keyword frequency analysis against known supply chain vocabulary.

## Decision Gates
- **Score ≥ 90%**: Auto-ingested. The Neo4j client creates a new node, and the original file is moved to `knowledge/archive`.
- **Score < 90%**: Staged for Review. The file is moved to `knowledge/pending_review`, and the evaluation breakdown is written to a JSON file.

## Knowledge Studio UI
The React frontend includes a "Knowledge Studio" where SMEs can view the `pending_review` queue. They can see exactly which rubric categories failed (e.g., "Failed SQL Safety: Found UPDATE statement") and either Force Approve the document or Reject it.
