"""
Yonder Graph — Canonical Knowledge Graph Loader

Deterministic ingestion of the three Blue Yonder WMS domain models
(Outbound, Inventory, Inbound) from Excel workbooks into Neo4j.

Ingests:
  - Node constraints and indexes
  - Table metadata nodes (structural, not live data)
  - Column property nodes
  - Relationship edges between tables
  - SOP Runbook nodes
  - Business Flow nodes
  - Business Term nodes
  - BlueYonder Config nodes
  - Agent Query Pattern nodes
  - Domain grouping nodes

No LLM processing — this is a pure deterministic ingestion pipeline.
"""

import os
import sys
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from backend.config import CANONICAL_DIR, settings
from backend.database.neo4j_client import neo4j_client

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Workbook Definitions
# ──────────────────────────────────────────────────────────────

WORKBOOKS = [
    {
        "filename": "Blue_Yonder_WMS_Outbound_KnowledgeGraph_Model.xlsx",
        "domain": "Outbound",
    },
    {
        "filename": "Blue_Yonder_WMS_Inventory_KnowledgeGraph_Model.xlsx",
        "domain": "Inventory",
    },
    {
        "filename": "Blue_Yonder_WMS_Inbound_KnowledgeGraph_Model 1.xlsx",
        "domain": "Inbound",
    },
]

# Sheet name mappings (consistent across all workbooks)
SHEET_NODES = "Nodes (Tables)"
SHEET_PROPERTIES = "Properties (Columns)"
SHEET_EDGES = "Edges (Relationships)"
SHEET_BUSINESS_TERMS = "Business Term & Schema Map"
SHEET_BUSINESS_FLOW = "Business Flow"
SHEET_SOPS = "SOP & Incident Runbooks"
SHEET_BY_CONFIG = "BlueYonder Config"
SHEET_CONSTRAINTS = "Neo4j - Node Constraints"
SHEET_NODE_LOAD = "Neo4j - Node Load Cypher"
SHEET_REL_LOAD = "Neo4j - Rel Load Cypher"
SHEET_AGENT_PATTERNS = "Agent Query Patterns (Cypher)"


class CanonicalLoader:
    """
    Deterministic loader for canonical Blue Yonder WMS knowledge models.
    
    Reads Excel workbooks and creates the complete Neo4j knowledge graph
    structure without any LLM processing.
    """

    def __init__(self):
        self.stats = {
            "constraints_created": 0,
            "tables_loaded": 0,
            "columns_loaded": 0,
            "edges_loaded": 0,
            "sops_loaded": 0,
            "business_flows_loaded": 0,
            "business_terms_loaded": 0,
            "configs_loaded": 0,
            "agent_patterns_loaded": 0,
            "domains_created": 0,
        }

    def run(self) -> Dict[str, Any]:
        """Execute the full canonical ingestion pipeline."""
        logger.info("=" * 60)
        logger.info("Canonical Knowledge Graph Ingestion — Starting")
        logger.info("=" * 60)

        # Connect to Neo4j
        neo4j_client.connect()

        # Step 1: Create Domain nodes
        self._create_domain_nodes()

        # Step 2: Process each workbook
        for wb_config in WORKBOOKS:
            filepath = CANONICAL_DIR / wb_config["filename"]
            domain = wb_config["domain"]

            if not filepath.exists():
                logger.warning("Workbook not found: %s — skipping", filepath)
                continue

            logger.info("Processing: %s (domain: %s)", filepath.name, domain)

            try:
                self._process_workbook(filepath, domain)
            except Exception as e:
                logger.error(
                    "Failed to process %s: %s", filepath.name, e, exc_info=True
                )

        logger.info("=" * 60)
        logger.info("Canonical Ingestion Complete — Statistics:")
        for key, value in self.stats.items():
            logger.info("  %s: %d", key, value)
        logger.info("=" * 60)

        return self.stats

    def _create_domain_nodes(self) -> None:
        """Create the top-level Domain nodes."""
        for wb_config in WORKBOOKS:
            domain = wb_config["domain"]
            neo4j_client.execute_write(
                "MERGE (d:Domain {name: $name}) "
                "SET d.description = $desc, d.lastLoadedAt = datetime()",
                {
                    "name": domain,
                    "desc": f"Blue Yonder WMS {domain} Domain",
                },
            )
            self.stats["domains_created"] += 1
        logger.info("Domain nodes created: Outbound, Inventory, Inbound")

    def _process_workbook(self, filepath: Path, domain: str) -> None:
        """Process all sheets in a single workbook."""
        # Load all sheets
        xl = pd.ExcelFile(filepath, engine="openpyxl")
        available_sheets = xl.sheet_names

        # Step 1: Create constraints (if available)
        if SHEET_CONSTRAINTS in available_sheets:
            self._load_constraints(xl, SHEET_CONSTRAINTS)

        # Step 2: Load table metadata nodes
        if SHEET_NODES in available_sheets:
            self._load_tables(xl, SHEET_NODES, domain)

        # Step 3: Load column property nodes
        if SHEET_PROPERTIES in available_sheets:
            self._load_columns(xl, SHEET_PROPERTIES, domain)

        # Step 4: Load relationship edges
        if SHEET_EDGES in available_sheets:
            self._load_edges(xl, SHEET_EDGES, domain)

        # Step 5: Load SOP Runbooks
        if SHEET_SOPS in available_sheets:
            self._load_sops(xl, SHEET_SOPS, domain)

        # Step 6: Load Business Flows
        if SHEET_BUSINESS_FLOW in available_sheets:
            self._load_business_flows(xl, SHEET_BUSINESS_FLOW, domain)

        # Step 7: Load Business Terms
        if SHEET_BUSINESS_TERMS in available_sheets:
            self._load_business_terms(xl, SHEET_BUSINESS_TERMS, domain)

        # Step 8: Load BlueYonder Config
        if SHEET_BY_CONFIG in available_sheets:
            self._load_by_config(xl, SHEET_BY_CONFIG, domain)

        # Step 9: Load Agent Query Patterns
        if SHEET_AGENT_PATTERNS in available_sheets:
            self._load_agent_patterns(xl, SHEET_AGENT_PATTERNS, domain)

        xl.close()

    def _load_constraints(self, xl: pd.ExcelFile, sheet: str) -> None:
        """Create Neo4j constraints from the constraints sheet."""
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            cypher_stmt = row.get("Cypher Constraint Statement", "")
            if cypher_stmt and isinstance(cypher_stmt, str) and cypher_stmt.strip():
                try:
                    neo4j_client.execute_write(cypher_stmt.strip())
                    self.stats["constraints_created"] += 1
                except Exception as e:
                    # Constraint may already exist
                    if "already exists" not in str(e).lower() and "equivalent" not in str(e).lower():
                        logger.warning("Constraint creation warning: %s", e)
                    else:
                        self.stats["constraints_created"] += 1

    def _load_tables(
        self, xl: pd.ExcelFile, sheet: str, domain: str
    ) -> None:
        """Load table metadata as (:Table) nodes."""
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            table_name = row.get("Oracle Table Name", "")
            if not table_name or not isinstance(table_name, str):
                continue

            graph_label = row.get("Graph Entity Label (Node)", "")
            business_purpose = row.get("Business Purpose", "")
            est_row_count = row.get("Est. Row Count", "")
            refresh_strategy = row.get("Refresh / Sync Strategy", "")
            anomalies = row.get("Data Anomalies / Quirks", "")

            neo4j_client.execute_write(
                """
                MERGE (t:Table {oracle_table_name: $table_name})
                SET t.graph_label = $graph_label,
                    t.business_purpose = $purpose,
                    t.est_row_count = $est_rows,
                    t.refresh_strategy = $refresh,
                    t.data_anomalies = $anomalies,
                    t.domain = $domain,
                    t.lastLoadedAt = datetime()
                WITH t
                MATCH (d:Domain {name: $domain})
                MERGE (t)-[:BELONGS_TO_DOMAIN]->(d)
                """,
                {
                    "table_name": table_name.strip(),
                    "graph_label": str(graph_label).strip() if graph_label else "",
                    "purpose": str(business_purpose).strip() if business_purpose else "",
                    "est_rows": str(est_row_count).strip() if est_row_count else "",
                    "refresh": str(refresh_strategy).strip() if refresh_strategy else "",
                    "anomalies": str(anomalies).strip() if anomalies else "",
                    "domain": domain,
                },
            )
            self.stats["tables_loaded"] += 1

    def _load_columns(
        self, xl: pd.ExcelFile, sheet: str, domain: str
    ) -> None:
        """Load column metadata as (:Column) nodes linked to (:Table) nodes."""
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            table_name = row.get("Oracle Table Name", "")
            column_name = row.get("Column Name", "")
            if not table_name or not column_name:
                continue

            data_type = row.get("Data Type", "")
            is_pk = row.get("Is Primary Key?", "")
            graph_role = row.get("Graph Role", "")
            definition = row.get("Business Definition / Comment", "")

            neo4j_client.execute_write(
                """
                MATCH (t:Table {oracle_table_name: $table_name})
                MERGE (c:Column {
                    table_name: $table_name,
                    column_name: $column_name
                })
                SET c.data_type = $data_type,
                    c.is_primary_key = $is_pk,
                    c.graph_role = $graph_role,
                    c.business_definition = $definition,
                    c.domain = $domain,
                    c.lastLoadedAt = datetime()
                MERGE (t)-[:HAS_COLUMN]->(c)
                """,
                {
                    "table_name": str(table_name).strip(),
                    "column_name": str(column_name).strip(),
                    "data_type": str(data_type).strip() if data_type else "",
                    "is_pk": str(is_pk).strip() if is_pk else "",
                    "graph_role": str(graph_role).strip() if graph_role else "",
                    "definition": str(definition).strip() if definition else "",
                    "domain": domain,
                },
            )
            self.stats["columns_loaded"] += 1

    def _load_edges(
        self, xl: pd.ExcelFile, sheet: str, domain: str
    ) -> None:
        """Load relationship edges between table nodes."""
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            source = row.get("Source Table (Node)", "")
            target = row.get("Target Table (Node)", "")
            edge_verb = row.get("Edge Semantic (Verb)", "")
            if not source or not target or not edge_verb:
                continue

            source_col = row.get("Source Column", "")
            target_col = row.get("Target Column", "")
            cardinality = row.get("Cardinality", "")
            rel_type = row.get("Relationship Type", "")
            justification = row.get("Business Justification", "")

            # Sanitize edge verb for Cypher relationship type
            rel_name = str(edge_verb).strip().upper().replace(" ", "_").replace("-", "_")
            # Remove any non-alphanumeric characters except underscores
            rel_name = "".join(c for c in rel_name if c.isalnum() or c == "_")
            if not rel_name:
                rel_name = "RELATES_TO"

            cypher = f"""
            MATCH (s:Table {{oracle_table_name: $source}})
            MATCH (t:Table {{oracle_table_name: $target}})
            MERGE (s)-[r:{rel_name}]->(t)
            SET r.source_column = $source_col,
                r.target_column = $target_col,
                r.cardinality = $cardinality,
                r.relationship_type = $rel_type,
                r.business_justification = $justification,
                r.domain = $domain,
                r.lastLoadedAt = datetime()
            """
            try:
                neo4j_client.execute_write(
                    cypher,
                    {
                        "source": str(source).strip(),
                        "target": str(target).strip(),
                        "source_col": str(source_col).strip() if source_col else "",
                        "target_col": str(target_col).strip() if target_col else "",
                        "cardinality": str(cardinality).strip() if cardinality else "",
                        "rel_type": str(rel_type).strip() if rel_type else "",
                        "justification": str(justification).strip() if justification else "",
                        "domain": domain,
                    },
                )
                self.stats["edges_loaded"] += 1
            except Exception as e:
                logger.warning("Edge load warning (%s->%s): %s", source, target, e)

    def _load_sops(
        self, xl: pd.ExcelFile, sheet: str, domain: str
    ) -> None:
        """Load SOP Runbook nodes."""
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            sop_id = row.get("SOP / Ref ID", "")
            if not sop_id or not isinstance(sop_id, str):
                continue

            neo4j_client.execute_write(
                """
                MERGE (sop:SOPRunbook {sop_id: $sop_id})
                SET sop.process_domain = $process_domain,
                    sop.issue_pattern = $issue_pattern,
                    sop.trigger_entity = $trigger_entity,
                    sop.triage_steps = $triage_steps,
                    sop.db_targets = $db_targets,
                    sop.diagnostic_sql = $diagnostic_sql,
                    sop.root_cause_conditions = $root_cause,
                    sop.resolution_steps = $resolution,
                    sop.risk_level = $risk_level,
                    sop.prerequisites = $prerequisites,
                    sop.domain = $domain,
                    sop.lastLoadedAt = datetime()
                WITH sop
                MATCH (d:Domain {name: $domain})
                MERGE (sop)-[:BELONGS_TO_DOMAIN]->(d)
                """,
                {
                    "sop_id": str(sop_id).strip(),
                    "process_domain": str(row.get("Process / Domain", "")).strip(),
                    "issue_pattern": str(row.get("Issue / Query Pattern", "")).strip(),
                    "trigger_entity": str(row.get("Trigger Entity (ID)", "")).strip(),
                    "triage_steps": str(row.get("Triage Steps (Logic)", "")).strip(),
                    "db_targets": str(row.get("DB Targets (Schema.Table)", "")).strip(),
                    "diagnostic_sql": str(
                        row.get("Diagnostic Query / Logic (Read-Only SQL)", "")
                    ).strip(),
                    "root_cause": str(row.get("Root Cause Conditions", "")).strip(),
                    "resolution": str(
                        row.get("Resolution / Fix Steps (Remediation Script/Action)", "")
                    ).strip(),
                    "risk_level": str(row.get("Risk / Impact Level", "")).strip(),
                    "prerequisites": str(
                        row.get("Prerequisites / Dependencies", "")
                    ).strip(),
                    "domain": domain,
                },
            )
            self.stats["sops_loaded"] += 1

            # Link SOP to referenced tables
            db_targets = str(row.get("DB Targets (Schema.Table)", ""))
            for table in db_targets.split(","):
                table = table.strip().split(".")[-1].strip()
                if table:
                    try:
                        neo4j_client.execute_write(
                            """
                            MATCH (sop:SOPRunbook {sop_id: $sop_id})
                            MATCH (t:Table {oracle_table_name: $table})
                            MERGE (sop)-[:REFERENCES_TABLE]->(t)
                            """,
                            {"sop_id": str(sop_id).strip(), "table": table},
                        )
                    except Exception:
                        pass  # Table may not exist in this domain

    def _load_business_flows(
        self, xl: pd.ExcelFile, sheet: str, domain: str
    ) -> None:
        """Load Business Flow nodes."""
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            process_group = row.get("Process Group", "")
            seq = row.get("Seq", "")
            stage_name = row.get("Stage / Step Name", "")
            if not stage_name:
                continue

            flow_id = f"{domain}_{process_group}_{seq}".replace(" ", "_")

            neo4j_client.execute_write(
                """
                MERGE (bf:BusinessFlow {flow_id: $flow_id})
                SET bf.process_group = $process_group,
                    bf.sequence = $seq,
                    bf.stage_name = $stage_name,
                    bf.activity = $activity,
                    bf.nodes_involved = $nodes_involved,
                    bf.business_logic = $business_logic,
                    bf.sop_reference = $sop_ref,
                    bf.domain = $domain,
                    bf.lastLoadedAt = datetime()
                WITH bf
                MATCH (d:Domain {name: $domain})
                MERGE (bf)-[:BELONGS_TO_DOMAIN]->(d)
                """,
                {
                    "flow_id": flow_id,
                    "process_group": str(process_group).strip(),
                    "seq": str(seq).strip(),
                    "stage_name": str(stage_name).strip(),
                    "activity": str(
                        row.get("Business Activity / Description", "")
                    ).strip(),
                    "nodes_involved": str(
                        row.get("Graph Nodes Involved", "")
                    ).strip(),
                    "business_logic": str(
                        row.get("Business Logic & Exit Criteria", "")
                    ).strip(),
                    "sop_ref": str(row.get("SOP Cross-Reference", "")).strip(),
                    "domain": domain,
                },
            )
            self.stats["business_flows_loaded"] += 1

    def _load_business_terms(
        self, xl: pd.ExcelFile, sheet: str, domain: str
    ) -> None:
        """Load Business Term nodes."""
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            term = row.get("Business Term", "")
            if not term:
                continue

            term_id = f"{domain}_{term}".replace(" ", "_")

            neo4j_client.execute_write(
                """
                MERGE (bt:BusinessTerm {term_id: $term_id})
                SET bt.business_term = $term,
                    bt.term_domain = $term_domain,
                    bt.db_mapping = $db_mapping,
                    bt.fk_join_path = $fk_path,
                    bt.common_filters = $filters,
                    bt.business_logic = $logic,
                    bt.domain = $domain,
                    bt.lastLoadedAt = datetime()
                WITH bt
                MATCH (d:Domain {name: $domain})
                MERGE (bt)-[:BELONGS_TO_DOMAIN]->(d)
                """,
                {
                    "term_id": term_id,
                    "term": str(term).strip(),
                    "term_domain": str(row.get("Domain", "")).strip(),
                    "db_mapping": str(
                        row.get("Database Attribute Mapping (Table.Column)", "")
                    ).strip(),
                    "fk_path": str(
                        row.get("Foreign Key / Join Path", "")
                    ).strip(),
                    "filters": str(
                        row.get("Common Filter Flags / Values", "")
                    ).strip(),
                    "logic": str(
                        row.get("Business Logic & Calculation Rules", "")
                    ).strip(),
                    "domain": domain,
                },
            )
            self.stats["business_terms_loaded"] += 1

    def _load_by_config(
        self, xl: pd.ExcelFile, sheet: str, domain: str
    ) -> None:
        """Load BlueYonder Config nodes."""
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            module = row.get("BY Module / Domain", "")
            interface = row.get("Interface / Process Name", "")
            if not module and not interface:
                continue

            config_id = f"{domain}_{module}_{interface}".replace(" ", "_")

            neo4j_client.execute_write(
                """
                MERGE (cfg:BYConfig {config_id: $config_id})
                SET cfg.module = $module,
                    cfg.interface_name = $interface,
                    cfg.core_tables = $core_tables,
                    cfg.staging_tables = $staging_tables,
                    cfg.moca_command = $moca,
                    cfg.controlling_policies = $policies,
                    cfg.error_codes = $errors,
                    cfg.diagnostic_query = $diag_query,
                    cfg.safe_remediation = $remediation,
                    cfg.domain = $domain,
                    cfg.lastLoadedAt = datetime()
                WITH cfg
                MATCH (d:Domain {name: $domain})
                MERGE (cfg)-[:BELONGS_TO_DOMAIN]->(d)
                """,
                {
                    "config_id": config_id,
                    "module": str(module).strip(),
                    "interface": str(interface).strip(),
                    "core_tables": str(
                        row.get("Core Database Tables", "")
                    ).strip(),
                    "staging_tables": str(
                        row.get("Staging / Log Tables", "")
                    ).strip(),
                    "moca": str(
                        row.get("MOCA Command / Service Call", "")
                    ).strip(),
                    "policies": str(
                        row.get("Controlling Policies / Parameters", "")
                    ).strip(),
                    "errors": str(
                        row.get("Common Error / Exit Codes", "")
                    ).strip(),
                    "diag_query": str(
                        row.get("Diagnostic MOCA / SQL Query", "")
                    ).strip(),
                    "remediation": str(
                        row.get("Safe Remediation Action", "")
                    ).strip(),
                    "domain": domain,
                },
            )
            self.stats["configs_loaded"] += 1

    def _load_agent_patterns(
        self, xl: pd.ExcelFile, sheet: str, domain: str
    ) -> None:
        """Load Agent Query Pattern nodes."""
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            sop_ref = row.get("SOP Cross-Ref", "")
            trigger = row.get("Natural-Language Trigger (Agent Prompt)", "")
            if not trigger:
                continue

            pattern_id = f"{domain}_{sop_ref}_{hash(trigger) % 10000}"

            neo4j_client.execute_write(
                """
                MERGE (ap:AgentQueryPattern {pattern_id: $pattern_id})
                SET ap.sop_reference = $sop_ref,
                    ap.trigger_prompt = $trigger,
                    ap.cypher_query = $cypher,
                    ap.expected_action = $expected,
                    ap.domain = $domain,
                    ap.lastLoadedAt = datetime()
                WITH ap
                MATCH (d:Domain {name: $domain})
                MERGE (ap)-[:BELONGS_TO_DOMAIN]->(d)
                """,
                {
                    "pattern_id": pattern_id,
                    "sop_ref": str(sop_ref).strip(),
                    "trigger": str(trigger).strip(),
                    "cypher": str(
                        row.get("Cypher Query (Graph-Native Diagnostic)", "")
                    ).strip(),
                    "expected": str(
                        row.get(
                            "Expected Agent Interpretation / Next Action", ""
                        )
                    ).strip(),
                    "domain": domain,
                },
            )
            self.stats["agent_patterns_loaded"] += 1


def main():
    """CLI entry point for canonical ingestion."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
    )
    loader = CanonicalLoader()
    stats = loader.run()
    print("\nIngestion Statistics:")
    for key, value in stats.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
