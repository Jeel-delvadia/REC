"""Thin wrapper around the Claude API. Returns None whenever the LLM can't answer, so callers can fall back."""
import logging

import anthropic

from app.core.config import settings

log = logging.getLogger(__name__)

_PLACEHOLDER_KEYS = {"", "your-key-here"}
_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic | None:
    global _client
    if _client is None and settings.LLM_API_KEY not in _PLACEHOLDER_KEYS:
        _client = anthropic.Anthropic(api_key=settings.LLM_API_KEY, timeout=60.0)
    return _client


def complete(system: str, prompt: str, max_tokens: int = 8000) -> str | None:
    client = _get_client()
    if client is None:
        return None
    try:
        response = client.beta.messages.create(
            model=settings.LLM_MODEL,
            max_tokens=max_tokens,
            # If the model declines, the API re-runs the request on a recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            # A short summary of structured facts doesn't need deep reasoning; keeps the button snappy.
            output_config={"effort": "low"},
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.AuthenticationError:
        log.error("LLM_API_KEY was rejected; falling back to rule-based explanations")
        return None
    except anthropic.APIStatusError as exc:
        log.warning("Claude API returned %s: %s", exc.status_code, exc.message)
        return None
    except anthropic.APIConnectionError as exc:
        log.warning("Could not reach the Claude API: %s", exc)
        return None

    if response.stop_reason == "refusal":
        log.warning("Claude declined to explain this result; falling back to rule-based explanation")
        return None
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    return text or None
