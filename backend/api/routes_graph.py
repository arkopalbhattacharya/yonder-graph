"""
Yonder Graph — Graph API Routes

GET /api/graph/schema — Returns Neo4j nodes and edges for visualization.
GET /api/graph/subgraph?table={table_name} — Returns local neighborhood.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from backend.database.neo4j_client import neo4j_client

router = APIRouter()


@router.get("/schema")
def get_graph_schema():
    """Return the full Neo4j graph schema for visualization."""
    try:
        return neo4j_client.get_full_graph_for_viz()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subgraph")
def get_subgraph(
    table: str = Query(..., description="Oracle table name (e.g., ORD, INVDTL)"),
    depth: int = Query(default=2, ge=1, le=5, description="Traversal depth"),
):
    """Return the local neighborhood of a table node."""
    try:
        result = neo4j_client.get_subgraph(table_name=table, depth=depth)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/labels")
def get_node_labels():
    """Return all distinct node labels in the graph."""
    try:
        schema = neo4j_client.get_schema()
        return {
            "labels": schema.get("node_labels", []),
            "relationship_types": schema.get("relationship_types", []),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables")
def get_tables():
    """Return all registered Oracle table names."""
    try:
        tables = neo4j_client.get_table_nodes()
        return {"tables": tables, "count": len(tables)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sops")
def get_sops(
    domain: Optional[str] = Query(default=None, description="Filter by domain"),
):
    """Return all SOP Runbook nodes, optionally filtered by domain."""
    try:
        if domain:
            results = neo4j_client.execute_read(
                """
                MATCH (sop:SOPRunbook)-[:BELONGS_TO_DOMAIN]->(d:Domain)
                WHERE toLower(d.name) = toLower($domain)
                RETURN sop {.*} AS runbook
                ORDER BY sop.sop_id
                """,
                {"domain": domain},
            )
        else:
            results = neo4j_client.execute_read(
                """
                MATCH (sop:SOPRunbook)
                RETURN sop {.*} AS runbook
                ORDER BY sop.sop_id
                """
            )
        return {
            "sops": [r["runbook"] for r in results],
            "count": len(results),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
