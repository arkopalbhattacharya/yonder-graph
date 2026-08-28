"""
Yonder Graph — Pluggable LLM Provider Factory Layer

Unified LLM client abstraction using OpenAI-compatible interfaces,
allowing instant switching between Poolside Laguna S 2.1 (default),
Google Gemini, OpenAI, Anthropic, or local Ollama/vLLM models by
editing .env without touching application or agent code.

Supports:
  - poolside:   Poolside Laguna S 2.1 via OpenAI-compatible API
  - gemini:     Google Gemini via OpenAI-compatible endpoint
  - openai:     OpenAI GPT models (also Azure OpenAI)
  - anthropic:  Anthropic Claude via LiteLLM proxy
  - ollama:     Local Ollama models
  - vllm:       Self-hosted vLLM inference server
  - local:      Any OpenAI-compatible local endpoint
  - (fallback): LiteLLM universal router for any other provider
"""

import os
import logging
from typing import Any, Dict, List, Optional

from openai import OpenAI
import litellm

from backend.config import settings

logger = logging.getLogger(__name__)


class LLMProviderFactory:
    """
    Unified LLM Client Factory supporting hot-swapping between providers.
    
    All providers are accessed through the OpenAI client interface,
    which is the de facto standard for LLM API compatibility.
    """

    _client: Optional[OpenAI] = None
    _current_provider: Optional[str] = None

    @classmethod
    def get_client(cls) -> OpenAI:
        """
        Get or create the LLM client based on current .env configuration.
        
        Caches the client instance and re-creates it if the provider changes.
        """
        provider = settings.llm_provider.lower()

        if cls._client is not None and cls._current_provider == provider:
            return cls._client

        cls._client = cls._create_client(provider)
        cls._current_provider = provider
        logger.info(
            "LLM client initialized: provider=%s, model=%s",
            provider,
            settings.llm_model_name,
        )
        return cls._client

    @staticmethod
    def _create_client(provider: str) -> OpenAI:
        """Create a new OpenAI-compatible client for the specified provider."""

        if provider == "poolside":
            return OpenAI(
                api_key=settings.poolside_api_key,
                base_url=settings.poolside_base_url,
            )

        elif provider == "gemini":
            return OpenAI(
                api_key=settings.gemini_api_key,
                base_url=settings.gemini_base_url,
            )

        elif provider in ("openai", "azure"):
            return OpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url,
            )

        elif provider == "anthropic":
            # Anthropic via LiteLLM's OpenAI-compatible proxy
            return OpenAI(
                api_key=settings.anthropic_api_key or "dummy",
                base_url="http://localhost:4000/v1",  # LiteLLM proxy
            )

        elif provider in ("ollama", "vllm", "local"):
            return OpenAI(
                api_key="ollama-local",
                base_url=settings.local_llm_base_url,
            )

        else:
            # Universal fallback using LiteLLM standard router
            logger.warning(
                "Unknown provider '%s' — using generic LLM endpoint",
                provider,
            )
            return OpenAI(
                api_key=settings.generic_llm_api_key or "dummy",
                base_url=settings.generic_llm_base_url
                or "http://localhost:8080/v1",
            )

    @staticmethod
    def get_model_name() -> str:
        """Return the currently configured model name from .env."""
        return settings.llm_model_name

    @staticmethod
    def get_provider_name() -> str:
        """Return the currently configured provider name."""
        return settings.llm_provider

    @classmethod
    def get_provider_info(cls) -> Dict[str, Any]:
        """Return metadata about the active LLM configuration."""
        return {
            "provider": settings.llm_provider,
            "model": settings.llm_model_name,
            "base_url": cls._get_active_base_url(),
            "is_local": settings.llm_provider.lower()
            in ("ollama", "vllm", "local"),
        }

    @staticmethod
    def _get_active_base_url() -> str:
        """Determine the active base URL for the current provider."""
        provider = settings.llm_provider.lower()
        url_map = {
            "poolside": settings.poolside_base_url,
            "gemini": settings.gemini_base_url,
            "openai": settings.openai_base_url,
            "azure": settings.openai_base_url,
            "ollama": settings.local_llm_base_url,
            "vllm": settings.local_llm_base_url,
            "local": settings.local_llm_base_url,
        }
        return url_map.get(provider, settings.generic_llm_base_url or "")

    @classmethod
    def chat_completion(
        cls,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 4096,
        **kwargs,
    ) -> Any:
        """
        Convenience method for a standard chat completion call.
        
        Uses the configured provider and model from .env.
        """
        client = cls.get_client()
        return client.chat.completions.create(
            model=cls.get_model_name(),
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )

    @classmethod
    def reset(cls) -> None:
        """Reset the cached client (forces re-creation on next call)."""
        cls._client = None
        cls._current_provider = None
        logger.info("LLM client cache cleared — will re-initialize on next call")
