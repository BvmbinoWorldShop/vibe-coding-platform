"""Reasoning layer over free API keys. The heavy computer-vision work is done
locally by the pipeline; these helpers only add language/vision *reasoning*
(coaching read, play descriptions), so a free tier is plenty.

Keys are read from the environment: MISTRAL_API_KEY, CEREBRAS_API_KEY. Nothing
here is required for tracking to work — it's optional enrichment."""

from __future__ import annotations

import os

import httpx

MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"


def _chat(url: str, key: str, model: str, prompt: str, max_tokens: int = 800) -> str:
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            url,
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens": max_tokens,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def coaching_read(stat_summary: str) -> str:
    """Turn a real stat summary into strengths/weaknesses/workout plan. Prefers
    Cerebras (fast, free), falls back to Mistral."""
    prompt = (
        "You are a professional basketball performance coach. From these REAL "
        "tracked stats, give 3 strengths, 3 weaknesses, and a focused 1-week "
        "workout plan targeting the weaknesses. Plain text, short headers.\n\n"
        + stat_summary
    )
    cerebras = os.environ.get("CEREBRAS_API_KEY")
    if cerebras:
        return _chat(CEREBRAS_URL, cerebras, "llama-3.3-70b", prompt)
    mistral = os.environ.get("MISTRAL_API_KEY")
    if mistral:
        return _chat(MISTRAL_URL, mistral, "mistral-small-latest", prompt)
    raise RuntimeError("Set CEREBRAS_API_KEY or MISTRAL_API_KEY to use AI reasoning.")
