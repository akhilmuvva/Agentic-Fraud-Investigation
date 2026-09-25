"""
agent/llm.py
------------
Centralized Gemini client with disk caching, automatic failover across
distinct model quota pools, REST transport, and fast timeout protection.
"""

import hashlib
import json
import logging
import os
from pathlib import Path
import time
from typing import Any

from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger(__name__)

CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "llm_cache.json"

_cache: dict[str, str] | None = None


def _get_cache() -> dict[str, str]:
    global _cache
    if _cache is not None:
        return _cache
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                _cache = json.load(f)
                return _cache
        except Exception:
            pass
    _cache = {}
    return _cache


def _save_cache(cache: dict[str, str]) -> None:
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
    except Exception as exc:
        logger.warning("Failed to save LLM cache: %s", exc)


# Use REST transport to avoid gRPC exponential retry stalls
genai.configure(api_key=os.environ["GOOGLE_API_KEY"], transport="rest")

# Active candidate models in fallback order
_MODEL_CANDIDATES = [
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemma-4-26b-a4b-it",
]


def generate_content_with_retry(prompt: str, max_retries: int = 1, default_delay: float = 0.5) -> str:
    """
    Call Gemini generate_content with disk caching and fast failover across model pools.
    """
    import re
    normalized_prompt = re.sub(r"\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?", "<TS>", prompt)
    prompt_hash = hashlib.sha256(normalized_prompt.strip().encode("utf-8")).hexdigest()
    cache = _get_cache()
    if prompt_hash in cache:
        logger.info("[LLM cache hit] Returning cached response for %s", prompt_hash[:8])
        return cache[prompt_hash]

    last_exc = None
    for model_name in _MODEL_CANDIDATES:
        try:
            m = genai.GenerativeModel(model_name)
            response = m.generate_content(prompt, request_options={"timeout": 4})
            if response and response.text:
                text = response.text.strip()
                cache[prompt_hash] = text
                _save_cache(cache)
                return text
        except Exception as exc:
            last_exc = exc
            # Rate limited, 404, 503, or timeout -> immediately try next model candidate
            continue

    if last_exc:
        raise last_exc
    return ""
