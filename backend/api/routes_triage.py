"""
Yonder Graph — Triage API Routes

POST /api/triage — Executes multi-agent diagnosis for AskProcessAgent ('ask') or ResolveTriageAgent ('resolve')
POST /api/triage/consolidate-sql — Combines investigation step queries into a validated Oracle script
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from backend.database.postgres_client import get_db
from backend.inference.orchestrator import orchestrator
from backend.api.routes_chat import record_chat_turn

router = APIRouter()


class TriageRequest(BaseModel):
    """Triage request payload."""
    query: str = Field(
        ...,
        description="Incident description or support query",
        min_length=2,
        max_length=5000,
        examples=["Order ORD-12345 at warehouse WH01 is not being allocated despite available inventory"],
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Optional session ID for audit trail correlation",
    )
    persona: Optional[str] = Field(
        default="resolve",
        description="Active agent persona: 'resolve' (ResolveTriageAgent) or 'ask' (AskProcessAgent)",
    )


class ConsolidateSQLRequest(BaseModel):
    """Consolidation request with list of step objects."""
    session_id: Optional[str] = None
    steps: List[Dict[str, Any]] = []


@router.post("/triage")
def run_triage(request: TriageRequest, db: Session = Depends(get_db)):
    """
    Execute multi-agent diagnosis and persist turn to PostgreSQL history.
    """
    try:
        result = orchestrator.run_triage(
            query=request.query,
            session_id=request.session_id,
            persona=request.persona,
        )
        
        # Persist conversation turn in PostgreSQL
        try:
            active_session_id = result.get("session_id") or request.session_id
            if active_session_id:
                record_chat_turn(
                    session_id=active_session_id,
                    user_query=request.query,
                    assistant_payload=result,
                    db=db,
                )
        except Exception as persist_err:
            import logging
            logging.getLogger(__name__).warning("Chat persistence skipped: %s", persist_err)

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/triage/consolidate-sql")
def consolidate_sql(request: ConsolidateSQLRequest):
    """
    Consolidate step-by-step diagnostic SQL statements into a validated script.
    """
    try:
        res = orchestrator.consolidate_sql_script(request.steps)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
