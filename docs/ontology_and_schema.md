# Ontology and Knowledge Graph Schema

Yonder Graph utilizes Neo4j as the deterministic map of the Blue Yonder WMS ecosystem. The ontology is designed to link conceptual business processes to literal database structures.

## Node Labels

- **`(:Domain)`**: High-level functional areas (e.g., Inbound, Outbound, Inventory).
- **`(:Table)`**: Oracle WMS table metadata (e.g., `ORD`, `INVDTL`, `RCVLIN`). Contains estimated row counts, anomalies, and business purpose.
- **`(:Column)`**: Specific attributes belonging to a table. Identifies Primary Keys.
- **`(:SOPRunbook)`**: Standard Operating Procedures detailing triage steps, diagnostic read-only SQL, and resolution paths for specific error patterns.
- **`(:BusinessFlow)`**: A sequenced workflow (e.g., Order Waving → Picking → Packing → Shipping).
- **`(:BusinessTerm)`**: A mapping between business language (e.g., "Shipped Order") and database logic (e.g., `ORD.ORD_STATE = 'S'`).
- **`(:BYConfig)`**: Application configuration toggles (e.g., Allocation Policies) that dictate system behavior.
- **`(:AgentQueryPattern)`**: Directives linking natural language intents to specific graph traversal queries.

## Key Relationships (Edges)

- **`(:Table)-[:HAS_COLUMN]->(:Column)`**
- **`(:Table)-[:RELATES_TO]->(:Table)`**: Denotes Foreign Key joins or logical associations. Includes cardinality properties.
- **`(:SOPRunbook)-[:REFERENCES_TABLE]->(:Table)`**: Connects an SOP to the tables it queries during triage.
- **`(:SOPRunbook)-[:BELONGS_TO_DOMAIN]->(:Domain)`**

## Data Ingestion
1. **Canonical Loader**: Ingests baseline structures deterministically from Excel templates.
2. **HITL Pipeline**: Ingests new unstructured markdown or JSON files via the Enrichment Agent and SME review. Auto-ingested nodes carry the property `auto_ingested: true` and `confidence_score`.
