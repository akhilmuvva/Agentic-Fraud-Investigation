"""
agent/llm.py
------------
Centralized Gemini client with automatic rate-limit (HTTP 429) backoff and retry.
Designed specifically for Google AI Studio Free Tier (5 requests/minute).
"""

import logging
import os
import re
import time
from typing import Any

from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
_MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
_model = genai.GenerativeModel(_MODEL_NAME)


def generate_content_with_retry(prompt: str, max_retries: int = 3, default_delay: float = 12.0) -> str:
    """
    Call Gemini generate_content with automatic exponential backoff on HTTP 429 / ResourceExhausted.
    """
    for attempt in range(max_retries + 1):
        try:
            response = _model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
            return ""
        except Exception as exc:
            exc_str = str(exc)
            if "429" in exc_str or "ResourceExhausted" in exc_str or "quota" in exc_str.lower():
                # Parse recommended retry delay if provided
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
