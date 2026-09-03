"""
Yonder Graph — Chat Sessions & History API Routes

Provides endpoints for:
  - Retrieving active / pinned chat history sessions
  - Session creation & message persistence
  - Toggling pinned status
  - Deleting conversations
  - Automatic LLM Title Generation (max 8 words)
"""

import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.database.postgres_client import get_db
from backend.audit.models import ChatSession, ChatMessage
from backend.inference.llm_provider import LLMProviderFactory
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat History"])


# ── Pydantic Request / Response Models ──────────────────────────

class CreateSessionRequest(BaseModel):
    session_id: Optional[str] = None
    title: Optional[str] = "New Conversation"
    metadata: Optional[Dict[str, Any]] = None


class PinSessionRequest(BaseModel):
    is_pinned: bool


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: Any
    created_at: Optional[str] = None


class ChatSessionSummary(BaseModel):
    session_id: str
    title: str
    persona: Optional[str] = "ask"
    is_pinned: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    message_count: int = 0


class ChatSessionDetail(BaseModel):
    session_id: str
    title: str
    persona: Optional[str] = "ask"
    is_pinned: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    messages: List[ChatMessageResponse] = []


# ── Title Generation Utility ─────────────────────────────────────

def generate_chat_title(query: str) -> str:
    """
    Generate a simple 3 to 5 words summary title for the conversation based on the user's initial inquiry.
    """
    clean_q = query.strip()
    if not clean_q or len(clean_q) <= 2:
        return "Conversation"
        
    prompt = f"""
Generate a concise, simple 3 to 5 word summary title for this supply chain conversation based on the user's inquiry:
"{clean_q}"

CRITICAL RULES:
1. STRICTLY 3 TO 5 WORDS.
2. Return ONLY the title text.
3. Do NOT wrap in quotes, formatting, or markdown.
4. Capitalize like a title (e.g. "Order Status Check Guide", "Wave Allocation Diagnostic", "LOCMST Inventory Table Schema").
"""
    try:
        res = LLMProviderFactory.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=20,
        )
        title = res.choices[0].message.content.strip().strip('"\'')
        words = title.split()
        if len(words) > 5:
            title = " ".join(words[:5])
        elif len(words) < 3:
            raw_words = clean_q.split()
            title = " ".join(raw_words[:4])
        return title or clean_q[:35]
    except Exception as e:
        logger.warning("LLM title generation failed: %s, using fallback", e)
        words = clean_q.split()
        return " ".join(words[:5]) if len(words) > 5 else clean_q[:35]


def record_chat_turn(
    session_id: str,
    user_query: str,
    assistant_payload: Dict[str, Any],
    db: Session,
    persona: Optional[str] = None,
) -> ChatSession:
    """
    Helper function to record a complete user query + assistant response turn in PostgreSQL.
    Creates or updates the ChatSession and auto-generates the title on the first user message.
    """
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    active_persona = persona or assistant_payload.get("persona") or "ask"

    if not session:
        title = generate_chat_title(user_query)
        session = ChatSession(
            session_id=session_id,
            title=title,
            is_pinned=False,
            metadata_payload={"persona": active_persona},
        )
        db.add(session)
        db.flush()
    else:
        if session.title == "New Conversation" or not session.title:
            session.title = generate_chat_title(user_query)
        meta = dict(session.metadata_payload or {})
        meta["persona"] = active_persona
        session.metadata_payload = meta

    # 1. Insert User Message
    user_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session_id,
        role="user",
        content={"text": user_query},
    )
    db.add(user_msg)

    # 2. Insert Assistant Message
    assistant_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session_id,
        role="assistant",
        content=assistant_payload,
    )
    db.add(assistant_msg)

    db.commit()
    db.refresh(session)
    enforce_session_limits(db)
    return session


# ── Route Handlers ───────────────────────────────────────────────

def enforce_session_limits(db: Session) -> None:
    """
    Enforces that only the last 5 unpinned sessions are maintained in the database.
    Older unpinned sessions are purged so that deleting a recent session does not
    pull in older ghost histories. Pinned sessions are excluded from this purge.
    """
    unpinned_sessions = (
        db.query(ChatSession)
        .filter(ChatSession.is_pinned == False)
        .order_by(desc(ChatSession.updated_at))
        .all()
    )
    if len(unpinned_sessions) > 5:
        excess_sessions = unpinned_sessions[5:]
        for s in excess_sessions:
            db.delete(s)
        db.commit()


@router.get("/sessions", response_model=List[ChatSessionSummary])
def list_chat_sessions(db: Session = Depends(get_db)):
    """
    Get up to 5 pinned sessions and exactly up to 5 most recent unpinned sessions.
    Auto-purges excess older unpinned sessions.
    """
    enforce_session_limits(db)

    pinned_sessions = (
        db.query(ChatSession)
        .filter(ChatSession.is_pinned == True)
        .order_by(desc(ChatSession.updated_at))
        .limit(5)
        .all()
    )

    recent_sessions = (
        db.query(ChatSession)
        .filter(ChatSession.is_pinned == False)
        .order_by(desc(ChatSession.updated_at))
        .limit(5)
        .all()
    )

    all_sessions = pinned_sessions + recent_sessions
    return [s.to_dict() for s in all_sessions]


@router.post("/sessions", response_model=ChatSessionSummary, status_code=status.HTTP_201_CREATED)
def create_chat_session(req: CreateSessionRequest, db: Session = Depends(get_db)):
    """
    Explicitly create a new chat session.
    """
    session_id = req.session_id or str(uuid.uuid4())
    existing = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if existing:
        return existing.to_dict()

    new_session = ChatSession(
        session_id=session_id,
        title=req.title or "New Conversation",
        is_pinned=False,
        metadata_payload=req.metadata,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    enforce_session_limits(db)
    return new_session.to_dict()


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_chat_session_detail(session_id: str, db: Session = Depends(get_db)):
    """
    Retrieve session metadata and all historical messages for a given session.
    """
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session '{session_id}' not found",
        )

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return {
        **session.to_dict(),
        "messages": [m.to_dict() for m in messages],
    }


@router.patch("/sessions/{session_id}/pin", response_model=ChatSessionSummary)
def toggle_pin_session(session_id: str, req: PinSessionRequest, db: Session = Depends(get_db)):
    """
    Pin or unpin a chat session. Max 5 pinned sessions allowed.
    """
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session '{session_id}' not found",
        )

    if req.is_pinned and not session.is_pinned:
        pinned_count = db.query(ChatSession).filter(ChatSession.is_pinned == True).count()
        if pinned_count >= 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum of 5 pinned sessions reached. Please unpin a session first.",
            )

    session.is_pinned = req.is_pinned
    db.commit()
    db.refresh(session)
    enforce_session_limits(db)
    return session.to_dict()


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def delete_chat_session(session_id: str, db: Session = Depends(get_db)):
    """
    Delete a chat session and cascade delete all associated messages.
    """
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session '{session_id}' not found",
        )

    db.delete(session)
    db.commit()
    return {"status": "success", "deleted_session_id": session_id}
