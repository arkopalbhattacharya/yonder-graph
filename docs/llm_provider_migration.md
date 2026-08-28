# Pluggable Multi-LLM Provider Migration

Enterprise architectures require vendor neutrality. Yonder Graph implements a **Pluggable LLM Provider Factory Layer** (`backend/inference/llm_provider.py`) that abstracts model interactions behind the industry-standard OpenAI API interface.

## Supported Providers out-of-the-box
1. **Poolside** (`Laguna S 2.1` via standard OpenAI API compatibility) — *Default for software engineering/diagnostic tasks.*
2. **Google Gemini** (via OpenAI compatibility layer).
3. **OpenAI / Azure OpenAI** (GPT-4o, etc).
4. **Anthropic** (via LiteLLM proxy).
5. **Local Offline Inference** (Ollama, vLLM).

## Hot-Swapping Providers

You can switch the underlying LLM instantly **without changing a single line of agent code**.

1. Open the `.env` file at the root of the project.
2. Change the `LLM_PROVIDER` and `LLM_MODEL_NAME` variables:

```bash
# Example: Switching from Poolside to Gemini
LLM_PROVIDER=gemini
LLM_MODEL_NAME=gemini-1.5-pro
```

3. Ensure the corresponding API key (e.g., `GEMINI_API_KEY`) is set.
4. Restart the backend server. The `LLMProviderFactory` will automatically instantiate the correct client format and the UI Telemetry Dashboard will update to reflect the active provider.

## How it works under the hood
The `Google ADK LlmAgent` classes are configured to call `LLMProviderFactory.get_model_name()` and `LLMProviderFactory.chat_completion()`. Because all prompts are role-based and output JSON where required, the agents remain agnostic to whether Poolside or Gemini is generating the response.

Because **Tier 2 Governance is deterministic Python code (AST parsing)**, switching LLMs does not affect the safety or read-only guarantees of the application.
