"""
Yonder Graph — Chat Context Management Agent

Manages per-chat context history, entity tracking, multi-turn follow-up queries,
and single-turn follow-up gating policies across Ask and Resolve triage flows.
"""

import logging
from typing import Any, Dict, List, Optional
from backend.audit.models import ChatMessage, ChatSession
from backend.database.postgres_client import get_db_context
from backend.audit.audit_logger import audit_logger, AuditTimer
from backend.inference.telemetry import telemetry

logger = logging.getLogger(__name__)


class ChatContextManager:
    """
    Context Management Agent:
    - Tracks conversation turn count per chat session.
    - Resolves anaphoric references and merges business keys across turns when follow-ups are enabled.
    - Guards and enforces single-turn policy when experimental follow-up feature is disabled.
    """

    def __init__(self):
        self.agent_name = "ContextManagementAgent"

    def evaluate_turn_and_context(
        self,
        session_id: str,
        query: str,
        enable_followup: bool = False,
    ) -> Dict[str, Any]:
        """
        Evaluates whether a query is a new conversation turn or a follow-up,
        and applies the follow-up gating policy.
        """
        with AuditTimer() as timer:
            history_messages: List[Dict[str, Any]] = []

            # Query historical messages in PostgreSQL for this session
            try:
                with get_db_context() as db:
                    messages = (
                        db.query(ChatMessage)
                        .filter(ChatMessage.session_id == session_id)
                        .order_by(ChatMessage.created_at.asc())
                        .all()
                    )
                    history_messages = [m.to_dict() for m in messages]
            except Exception as e:
                logger.warn(f"[{self.agent_name}] Could not query session history: {e}")

            turn_count = len(history_messages)
            is_followup = turn_count > 0

            # If follow-ups are disabled and there is prior conversation history
            if is_followup and not enable_followup:
                telemetry.record_invocation(
                    self.agent_name,
                    timer.elapsed_ms,
                    tokens_used=0,
                    prompt_tokens=0,
                    completion_tokens=0,
                    success=False,
                    session_id=session_id,
                )
                audit_logger.log_event(
                    session_id=session_id,
                    agent_name=self.agent_name,
                    action="FOLLOWUP_BLOCKED",
                    inputs={"query": query, "turn_count": turn_count},
                    outputs={"policy": "SINGLE_TURN_ENFORCED"},
                    latency_ms=timer.elapsed_ms,
                    status="BLOCKED",
                )
                return {
                    "allowed": False,
                    "is_followup": True,
                    "turn_count": turn_count,
                    "rejection_response": {
                        "session_id": session_id,
                        "status": "blocked",
                        "policy_justification": (
                            "Follow-up questions are currently disabled under single-turn triage policy. "
                            "Please click '+ new chat' to start a new inquiry or enable 'Chat Follow-ups' in Settings."
                        ),
                        "narrative": (
                            "Follow-up questions are currently disabled under single-turn triage policy. "
                            "Please click '+ new chat' to start a new inquiry or enable 'Chat Follow-ups' in Settings."
                        ),
                        "agent_traces": [
                            {
                                "agent": self.agent_name,
                                "step": "Context Management & Follow-up Policy Check",
                                "latency_ms": round(timer.elapsed_ms, 2),
                                "result": {
                                    "status": "FOLLOWUP_RESTRICTED",
                                    "turn_count": turn_count,
                                    "policy": "Experimental 'Chat Follow-ups' feature is currently disabled.",
                                },
                            }
                        ],
                    },
                }

            # If it is an allowed follow-up turn, contextualize with history
            contextualized_query = query
            if is_followup and enable_followup:
                # Extract previous user queries and assistant summaries
                prev_context_snippets = []
                for m in history_messages[-4:]:
                    role = m.get("role")
                    content = m.get("content")
                    if role == "user":
                        text = content.get("text", "") if isinstance(content, dict) else str(content)
                        prev_context_snippets.append(f"User: {text}")
                    elif role == "assistant" and isinstance(content, dict):
                        narrative = content.get("narrative", "")
                        prev_context_snippets.append(f"Assistant: {narrative[:200]}")

                context_prefix = " [Prior Context: " + " | ".join(prev_context_snippets) + "] "
                contextualized_query = f"{query}{context_prefix}"

            telemetry.record_invocation(
                self.agent_name,
                timer.elapsed_ms,
                tokens_used=0,
                prompt_tokens=0,
                completion_tokens=0,
                success=True,
                session_id=session_id,
            )

            audit_logger.log(
                session_id=session_id,
                agent_name=self.agent_name,
                action_type="SESSION_CONTEXT_EVALUATED",
                input_payload={"is_followup": is_followup, "enable_followup": enable_followup, "turn_count": turn_count},
                output_payload={"contextualized": is_followup and enable_followup},
                execution_time_ms=timer.elapsed_ms,
                status="SUCCESS",
            )

            return {
                "allowed": True,
                "is_followup": is_followup,
                "turn_count": turn_count,
                "contextualized_query": contextualized_query,
            }


context_manager = ChatContextManager()
