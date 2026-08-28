"""
Yonder Graph — Feedback API Routes

POST /api/feedback/submit — Logs Thumbs Up/Down feedback.
POST /api/feedback/correct — SME corrections with re-evaluation loop.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Optional, Any
from backend.audit.feedback_logger import feedback_logger
from backend.ingestion.hitl_service import hitl_service

router = APIRouter()


class FeedbackSubmitRequest(BaseModel):
    """Thumbs up/down feedback submission."""
    session_id: str = Field(..., description="Session identifier")
    user_query: str = Field(..., description="Original user query")
    generated_response: Optional[Dict[str, Any]] = Field(
        default=None, description="The AI-generated response"
    )
    feedback_type: str = Field(
        ..., description="THUMBS_UP or THUMBS_DOWN",
        pattern="^(THUMBS_UP|THUMBS_DOWN)$",
    )
    matched_sop_id: Optional[str] = Field(
        default=None, description="Matched SOP ID if available"
    )


class FeedbackCorrectRequest(BaseModel):
    """SME correction payload for a thumbs-down response."""
    feedback_id: str = Field(..., description="UUID of the feedback entry")
    corrected_triage_steps: Optional[str] = Field(
        default=None, description="Improved triage steps"
    )
    corrected_sql: Optional[str] = Field(
        default=None, description="Authoritative read-only Oracle diagnostic SQL"
    )
    corrected_moca: Optional[str] = Field(
        default=None, description="Corrected MOCA commands"
    )
    root_cause_criteria: Optional[str] = Field(
        default=None, description="Root cause analysis criteria"
    )


@router.post("/submit")
def submit_feedback(request: FeedbackSubmitRequest):
    """Log a thumbs up/down feedback event and return the feedback UUID."""
    try:
        feedback_id = feedback_logger.log_feedback(
            session_id=request.session_id,
            user_query=request.user_query,
            generated_response=request.generated_response,
            feedback_type=request.feedback_type,
            matched_sop_id=request.matched_sop_id,
        )
        return {
            "status": "logged",
            "feedback_id": feedback_id,
            "feedback_type": request.feedback_type,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/correct")
def submit_correction(request: FeedbackCorrectRequest):
    """
    Submit SME corrections for a thumbs-down response.
    
    Runs Tier 2 AST validation + Enrichment Agent scoring loop
    and patches Neo4j if confidence >= 90%.
    """
    try:
        result = hitl_service.process_correction(
            feedback_id=request.feedback_id,
            corrected_triage_steps=request.corrected_triage_steps,
            corrected_sql=request.corrected_sql,
            corrected_moca=request.corrected_moca,
            root_cause_criteria=request.root_cause_criteria,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
