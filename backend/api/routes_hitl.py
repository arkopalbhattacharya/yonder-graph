"""
Yonder Graph — HITL API Routes

GET  /api/hitl/pending — Returns candidate files awaiting SME review.
POST /api/hitl/review — Accepts SME edits for staged files.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Optional, Any
from backend.ingestion.hitl_service import hitl_service

router = APIRouter()


class ReviewRequest(BaseModel):
    """SME review submission payload."""
    review_filename: str = Field(
        ..., description="Name of the review JSON file"
    )
    approved: bool = Field(
        ..., description="Whether the SME approves the ingestion"
    )
    sme_edits: Optional[Dict[str, Any]] = Field(
        default=None, description="Optional edits from the SME"
    )


@router.get("/pending")
def get_pending_reviews():
    """Return all files in the staging/pending_review directory."""
    try:
        pending = hitl_service.get_pending_reviews()
        return {
            "pending_reviews": pending,
            "count": len(pending),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/review")
def process_review(request: ReviewRequest):
    """Process an SME review of a staged file."""
    try:
        result = hitl_service.process_review(
            review_filename=request.review_filename,
            approved=request.approved,
            sme_edits=request.sme_edits,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
