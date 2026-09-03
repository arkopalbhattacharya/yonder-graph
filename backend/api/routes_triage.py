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
    enable_followup: Optional[bool] = Field(
        default=False,
        description="Experimental feature flag for multi-turn follow-up queries via ContextManagementAgent",
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
            enable_followup=bool(request.enable_followup),
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


@router.post("/triage/stream")
def run_triage_stream(request: TriageRequest, db: Session = Depends(get_db)):
    """
    Execute multi-agent diagnosis and stream real-time Server-Sent Events (SSE).
    """
    from fastapi.responses import StreamingResponse
    import json

    def event_generator():
        final_payload = None
        for frame in orchestrator.run_triage_stream(
            query=request.query,
            session_id=request.session_id,
            persona=request.persona,
            enable_followup=bool(request.enable_followup),
        ):
            event_name = frame.get("event", "message")
            event_data = frame.get("data", {})
            if event_name == "final_payload":
                final_payload = event_data

            payload_str = json.dumps(event_data)
            yield f"event: {event_name}\ndata: {payload_str}\n\n"

        # Persist conversation turn in PostgreSQL when stream finishes
        if final_payload:
            try:
                active_session_id = final_payload.get("session_id") or request.session_id
                if active_session_id:
                    record_chat_turn(
                        session_id=active_session_id,
                        user_query=request.query,
                        assistant_payload=final_payload,
                        db=db,
                    )
            except Exception as persist_err:
                import logging
                logging.getLogger(__name__).warning("Chat persistence skipped: %s", persist_err)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
