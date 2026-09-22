"""
agent/llm.py
------------
Centralized Gemini client with automatic rate-limit (HTTP 429) backoff, retry,
and local disk caching. Designed specifically for reliable execution under
API rate limits.
"""

import hashlib
import json
import logging
import os
from pathlib import Path
import re
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


genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
_MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
_model = genai.GenerativeModel(_MODEL_NAME)


def generate_content_with_retry(prompt: str, max_retries: int = 3, default_delay: float = 15.0) -> str:
    """
    Call Gemini generate_content with disk caching and automatic backoff on 429.
    """
    prompt_hash = hashlib.sha256(prompt.strip().encode("utf-8")).hexdigest()
    cache = _get_cache()
    if prompt_hash in cache:
        logger.info("[LLM cache hit] Returning cached response for prompt %s...", prompt_hash[:8])
        return cache[prompt_hash]

    for attempt in range(max_retries + 1):
        try:
            response = _model.generate_content(prompt)
            if response and response.text:
                text = response.text.strip()
                cache[prompt_hash] = text
                _save_cache(cache)
                return text
            return ""
        except Exception as exc:
            exc_str = str(exc)
            if "PerDay" in exc_str:
                logger.warning("[LLM daily quota] Daily limit reached on this free key. Falling back to policy rules.")
                raise RuntimeError("Daily Gemini Free Tier quota reached") from exc

            if "429" in exc_str or "ResourceExhausted" in exc_str or "quota" in exc_str.lower():
                delay = default_delay
                match = re.search(r"retry in (\d+(?:\.\d+)?)s", exc_str, re.IGNORECASE)
                if match:
                    delay = float(match.group(1)) + 1.0
                else:
                    delay_match = re.search(r"seconds:\s*(\d+)", exc_str)
                    if delay_match:
                        delay = float(delay_match.group(1)) + 1.0
                    else:
                        delay = default_delay * (attempt + 1)

                logger.warning(
                    "[LLM rate limit] Hit 429 quota. Waiting %.1fs before attempt %d/%d...",
                    delay, attempt + 1, max_retries
                )
                time.sleep(delay)
            else:
                logger.error("[LLM error] %s", exc)
                raise exc

    raise RuntimeError(f"Exceeded max retries ({max_retries}) on Gemini generate_content")
