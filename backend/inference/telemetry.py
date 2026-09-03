"""
Yonder Graph — Agent Telemetry Collector

Collects and exposes real-time metrics about agent invocations,
latencies, token usage, error rates, and governance intercept counts.
"""

import time
import threading
import logging
from typing import Any, Dict, List, Optional
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class AgentMetrics:
    """Accumulated metrics for a single agent."""

    invocation_count: int = 0
    success_count: int = 0
    error_count: int = 0
    total_tokens: int = 0
    prompt_tokens: int = 0         # lifetime input tokens
    completion_tokens: int = 0     # lifetime output tokens

    # Current active session tracking
    session_invocation_count: int = 0
    session_total_tokens: int = 0
    session_prompt_tokens: int = 0
    session_completion_tokens: int = 0

    total_latency_ms: float = 0
    latencies: List[float] = field(default_factory=list)
    governance_intercepts: int = 0
    session_governance_intercepts: int = 0
    last_invocation_ts: Optional[float] = None

    @property
    def avg_latency_ms(self) -> float:
        if not self.latencies:
            return 0
        return sum(self.latencies) / len(self.latencies)

    @property
    def p95_latency_ms(self) -> float:
        if not self.latencies:
            return 0
        sorted_lat = sorted(self.latencies)
        idx = int(len(sorted_lat) * 0.95)
        return sorted_lat[min(idx, len(sorted_lat) - 1)]

    @property
    def error_rate(self) -> float:
        if self.invocation_count == 0:
            return 0
        return self.error_count / self.invocation_count

    def to_dict(self) -> Dict[str, Any]:
        return {
            "invocation_count": self.invocation_count,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "total_tokens": self.total_tokens,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "session_invocation_count": self.session_invocation_count,
            "session_total_tokens": self.session_total_tokens,
            "session_prompt_tokens": self.session_prompt_tokens,
            "session_completion_tokens": self.session_completion_tokens,
            "avg_latency_ms": round(self.avg_latency_ms, 2),
            "p95_latency_ms": round(self.p95_latency_ms, 2),
            "governance_intercepts": self.governance_intercepts,
            "session_governance_intercepts": self.session_governance_intercepts,
            "error_rate": round(self.error_rate * 100, 2),
            "last_invocation": self.last_invocation_ts,
        }


class TelemetryCollector:
    """
    Thread-safe telemetry collector for agent performance metrics.
    
    Maintains rolling windows and per-session input/output token usage.
    """

    MAX_LATENCY_SAMPLES = 1000  # Rolling window per agent

    def __init__(self):
        self._lock = threading.Lock()
        self._agents: Dict[str, AgentMetrics] = defaultdict(AgentMetrics)
        self._global_start_time = time.time()
        self._total_sessions: int = 0
        self._total_queries: int = 0
        self._session_queries: int = 0
        self._current_session_id: Optional[str] = None

    def record_invocation(
        self,
        agent_name: str,
        latency_ms: float,
        tokens_used: int = 0,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        success: bool = True,
        governance_intercept: bool = False,
        session_id: Optional[str] = None,
    ) -> None:
        """Record a single agent execution."""
        with self._lock:
            # Handle session tracking
            if session_id:
                if self._current_session_id != session_id:
                    self._current_session_id = session_id
                    self._total_sessions += 1
                    for m in self._agents.values():
                        m.session_invocation_count = 0
                        m.session_total_tokens = 0
                        m.session_prompt_tokens = 0
                        m.session_completion_tokens = 0
                        m.session_governance_intercepts = 0

            # Handle token estimates if only total passed
            if tokens_used > 0 and (prompt_tokens == 0 and completion_tokens == 0):
                prompt_tokens = int(tokens_used * 0.65)
                completion_tokens = tokens_used - prompt_tokens
            elif (prompt_tokens > 0 or completion_tokens > 0) and tokens_used == 0:
                tokens_used = prompt_tokens + completion_tokens

            metrics = self._agents[agent_name]
            metrics.invocation_count += 1
            metrics.total_latency_ms += latency_ms
            metrics.total_tokens += tokens_used
            metrics.prompt_tokens += prompt_tokens
            metrics.completion_tokens += completion_tokens

            metrics.session_invocation_count += 1
            metrics.session_total_tokens += tokens_used
            metrics.session_prompt_tokens += prompt_tokens
            metrics.session_completion_tokens += completion_tokens

            metrics.last_invocation_ts = time.time()

            # Maintain rolling latency window
            metrics.latencies.append(latency_ms)
            if len(metrics.latencies) > self.MAX_LATENCY_SAMPLES:
                metrics.latencies = metrics.latencies[-self.MAX_LATENCY_SAMPLES:]

            if success:
                metrics.success_count += 1
            else:
                metrics.error_count += 1

            if governance_intercept:
                metrics.governance_intercepts += 1
                metrics.session_governance_intercepts += 1

    def record_intercept(
        self,
        agent_name: str = "GovernanceSafetyAgent",
        session_id: Optional[str] = None,
    ) -> None:
        """Explicitly record a governance safety intercept or policy block."""
        with self._lock:
            if session_id and self._current_session_id != session_id:
                self._current_session_id = session_id
                self._total_sessions += 1
                for m in self._agents.values():
                    m.session_invocation_count = 0
                    m.session_total_tokens = 0
                    m.session_prompt_tokens = 0
                    m.session_completion_tokens = 0
                    m.session_governance_intercepts = 0

            metrics = self._agents[agent_name]
            metrics.governance_intercepts += 1
            metrics.session_governance_intercepts += 1

    def record_session(self, session_id: Optional[str] = None) -> None:
        """Record a new triage session."""
        with self._lock:
            self._total_sessions += 1
            if session_id and self._current_session_id != session_id:
                self._current_session_id = session_id
                self._session_queries = 0
                for m in self._agents.values():
                    m.session_invocation_count = 0
                    m.session_total_tokens = 0
                    m.session_prompt_tokens = 0
                    m.session_completion_tokens = 0

    def record_query(self, session_id: Optional[str] = None) -> None:
        """Record a user query/chat turn."""
        with self._lock:
            self._total_queries += 1
            if session_id and self._current_session_id != session_id:
                self._current_session_id = session_id
                self._session_queries = 1
                for m in self._agents.values():
                    m.session_invocation_count = 0
                    m.session_total_tokens = 0
                    m.session_prompt_tokens = 0
                    m.session_completion_tokens = 0
            else:
                self._session_queries += 1

    def get_agent_metrics(self, agent_name: str) -> Dict[str, Any]:
        """Get metrics for a specific agent."""
        with self._lock:
            if agent_name in self._agents:
                return self._agents[agent_name].to_dict()
            return AgentMetrics().to_dict()

    def get_all_metrics(self) -> Dict[str, Any]:
        """Get aggregated metrics across all agents."""
        with self._lock:
            total_invocations = sum(
                m.invocation_count for m in self._agents.values()
            )
            total_tokens = sum(
                m.total_tokens for m in self._agents.values()
            )
            total_prompt_tokens = sum(
                m.prompt_tokens for m in self._agents.values()
            )
            total_completion_tokens = sum(
                m.completion_tokens for m in self._agents.values()
            )

            session_total_tokens = sum(
                m.session_total_tokens for m in self._agents.values()
            )
            session_prompt_tokens = sum(
                m.session_prompt_tokens for m in self._agents.values()
            )
            session_completion_tokens = sum(
                m.session_completion_tokens for m in self._agents.values()
            )

            total_errors = sum(
                m.error_count for m in self._agents.values()
            )
            total_intercepts = sum(
                m.governance_intercepts for m in self._agents.values()
            )
            session_intercepts = sum(
                m.session_governance_intercepts for m in self._agents.values()
            )

            # Compute global P95 latency
            all_latencies = []
            for m in self._agents.values():
                all_latencies.extend(m.latencies)
            
            p95_global = 0
            if all_latencies:
                sorted_lat = sorted(all_latencies)
                idx = int(len(sorted_lat) * 0.95)
                p95_global = sorted_lat[min(idx, len(sorted_lat) - 1)]

            return {
                "uptime_seconds": round(time.time() - self._global_start_time, 1),
                "current_session_id": self._current_session_id,
                "total_sessions": self._total_sessions,
                "total_queries": self._total_queries,
                "session_queries": self._session_queries,
                "total_invocations": total_invocations,
                "total_tokens": total_tokens,
                "total_prompt_tokens": total_prompt_tokens,
                "total_completion_tokens": total_completion_tokens,
                "session_total_tokens": session_total_tokens,
                "session_prompt_tokens": session_prompt_tokens,
                "session_completion_tokens": session_completion_tokens,
                "total_errors": total_errors,
                "total_governance_intercepts": total_intercepts,
                "session_governance_intercepts": session_intercepts,
                "p95_latency_ms": round(p95_global, 2),
                "active_agents": len(self._agents),
                "agents": {
                    name: metrics.to_dict()
                    for name, metrics in self._agents.items()
                },
            }

    def reset(self) -> None:
        """Reset all telemetry data."""
        with self._lock:
            self._agents.clear()
            self._total_sessions = 0
            self._global_start_time = time.time()
            self._current_session_id = None


# Module-level singleton
telemetry = TelemetryCollector()
