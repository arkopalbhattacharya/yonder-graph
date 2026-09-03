"""
Yonder Graph — Neo4j Client

Provides a connection-pooled Neo4j driver wrapper with Cypher execution,
schema introspection, and batch loading utilities.
"""

from typing import Any, Dict, List, Optional
from neo4j import GraphDatabase, Driver, Session, Result
from backend.config import settings
import logging

logger = logging.getLogger(__name__)


class Neo4jClient:
    """Thread-safe Neo4j driver wrapper with connection pooling."""

    _instance: Optional["Neo4jClient"] = None
    _driver: Optional[Driver] = None

    def __new__(cls) -> "Neo4jClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def connect(self) -> None:
        """Initialize the Neo4j driver connection pool."""
        if self._driver is None:
            self._driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
                max_connection_pool_size=50,
            )
            # Verify connectivity
            self._driver.verify_connectivity()
            logger.info(
                "Neo4j connected: %s (user: %s)",
                settings.neo4j_uri,
                settings.neo4j_user,
            )

    def close(self) -> None:
        """Close the driver and release all connections."""
        if self._driver:
            self._driver.close()
            self._driver = None
            logger.info("Neo4j connection closed")

    @property
    def driver(self) -> Driver:
        if self._driver is None:
            self.connect()
        return self._driver

    def execute_read(
        self, cypher: str, parameters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Execute a read-only Cypher query and return results as dicts."""
        with self.driver.session() as session:
            result = session.run(cypher, parameters or {})
            return [record.data() for record in result]

    def execute_write(
        self, cypher: str, parameters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Execute a write Cypher query within an explicit write transaction."""
        with self.driver.session() as session:

            def _tx(tx):
                result = tx.run(cypher, parameters or {})
                return [record.data() for record in result]

            return session.execute_write(lambda tx: _tx(tx))

    def execute_write_batch(
        self, cypher: str, rows: List[Dict[str, Any]], batch_size: int = 5000
    ) -> int:
        """Execute a batched write using UNWIND-style Cypher with chunked rows."""
        total = 0
        for i in range(0, len(rows), batch_size):
            chunk = rows[i : i + batch_size]
            with self.driver.session() as session:

                def _tx(tx, data=chunk):
                    tx.run(cypher, {"rows": data})
                    return len(data)

                total += session.execute_write(lambda tx: _tx(tx))
        logger.info(
            "Batch write completed: %d rows across %d chunks",
            total,
            (len(rows) + batch_size - 1) // batch_size,
        )
        return total

    def get_schema(self) -> Dict[str, Any]:
        """Introspect the Neo4j graph schema: node labels, relationship types, property keys."""
        labels = self.execute_read("CALL db.labels() YIELD label RETURN label")
        rel_types = self.execute_read(
            "CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType"
        )
        constraints = self.execute_read("SHOW CONSTRAINTS YIELD *")
        return {
            "node_labels": [r["label"] for r in labels],
            "relationship_types": [r["relationshipType"] for r in rel_types],
            "constraints": constraints,
        }

    def get_table_nodes(self) -> List[str]:
        """Return all Oracle table names registered as (:Table) nodes in the graph."""
        results = self.execute_read(
            "MATCH (t:Table) RETURN t.oracle_table_name AS table_name"
        )
        return [r["table_name"] for r in results if r.get("table_name")]

    def get_subgraph(
        self, table_name: str, depth: int = 2
    ) -> Dict[str, Any]:
        """Return the local neighborhood of a table node up to the specified depth."""
        cypher = """
        MATCH (t:Table {oracle_table_name: $table_name})
        CALL apoc.path.subgraphAll(t, {maxLevel: $depth})
        YIELD nodes, relationships
        RETURN nodes, relationships
        """
        # Fallback without APOC
        fallback_cypher = """
        MATCH (t:Table {oracle_table_name: $table_name})
        OPTIONAL MATCH path = (t)-[*1..2]-(connected)
        WITH t, collect(DISTINCT connected) AS neighbors,
             collect(DISTINCT relationships(path)) AS rels
        RETURN t, neighbors, rels
        """
        try:
            results = self.execute_read(
                cypher, {"table_name": table_name, "depth": depth}
            )
            if results:
                return results[0]
        except Exception:
            logger.warning("APOC not available, using fallback subgraph query")

        results = self.execute_read(
            fallback_cypher, {"table_name": table_name}
        )
        if results:
            return results[0]
        return {"nodes": [], "relationships": []}

    def get_full_graph_for_viz(self) -> Dict[str, Any]:
        """Return all nodes and edges with human-readable titles, labels, and styles for graph visualization."""
        nodes_cypher = """
        MATCH (n)
        WITH n, labels(n) AS lbls, properties(n) AS props, elementId(n) AS eid
        RETURN eid AS id, lbls AS labels, props
        LIMIT 600
        """
        edges_cypher = """
        MATCH (a)-[r]->(b)
        WITH elementId(a) AS source, elementId(b) AS target,
             type(r) AS rel_type, properties(r) AS props
        RETURN source, target, rel_type, props
        LIMIT 1000
        """
        raw_nodes = self.execute_read(nodes_cypher)
        raw_edges = self.execute_read(edges_cypher)

        formatted_nodes = []
        for n in raw_nodes:
            lbls = n.get("labels", [])
            props = n.get("props", {})
            primary_label = lbls[0] if lbls else "Node"

            # Determine title & name
            if "Table" in lbls:
                name = props.get("oracle_table_name") or props.get("graph_label") or "Table"
                val = 8
                color = "#3b82f6"  # Blue
            elif "Column" in lbls:
                col = props.get("column_name", "")
                tbl = props.get("table_name", "")
                name = f"{tbl}.{col}" if tbl and col else (col or "Column")
                val = 4
                color = "#ec4899"  # Pink (same as business term color)
            elif "SOPRunbook" in lbls:
                name = props.get("sop_id") or props.get("issue_pattern") or "SOP"
                val = 7
                color = "#eab308"  # Yellow
            elif "Domain" in lbls:
                name = props.get("name") or "Domain"
                val = 12
                color = "#10b981"  # Emerald
            elif "BusinessFlow" in lbls:
                name = props.get("name") or props.get("flow_name") or "Flow"
                val = 6
                color = "#94a3b8"  # Slate Grey (Light)
            elif "BusinessTerm" in lbls:
                name = props.get("term") or props.get("name") or "Term"
                val = 5
                color = "#64748b"  # Slate Grey (Medium/Dark)
            elif "BYConfig" in lbls:
                name = props.get("config_name") or props.get("name") or "Config"
                val = 5
                color = "#ef4444"  # Red
            elif "AgentQueryPattern" in lbls:
                name = props.get("pattern_id") or "Query Pattern"
                val = 4
                color = "#6366f1"  # Indigo
            else:
                name = props.get("name") or props.get("title") or primary_label
                val = 5
                color = "#64748b"

            formatted_nodes.append({
                "id": n.get("id"),
                "name": name,
                "label": primary_label,
                "labels": lbls,
                "val": val,
                "color": color,
                "props": props,
            })

        formatted_edges = []
        for e in raw_edges:
            rel = e.get("rel_type") or "RELATES_TO"
            formatted_edges.append({
                "source": e.get("source"),
                "target": e.get("target"),
                "name": rel,
                "rel_type": rel,
                "props": e.get("props", {}),
            })

        return {"nodes": formatted_nodes, "edges": formatted_edges}


# Module-level singleton
neo4j_client = Neo4jClient()
