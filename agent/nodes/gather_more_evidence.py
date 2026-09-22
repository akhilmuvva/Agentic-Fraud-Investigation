"""
agent/nodes/gather_more_evidence.py
------------------------------------
LangGraph node: gather_more_evidence_node

Simulates 1-3 additional evidence-gathering actions (customer verification,
step-up authentication, analyst consultation) using Gemini to generate
plausible responses. This node is only reached when assess_uncertainty_node
determines that more evidence is needed.

All simulated actions are clearly marked with ``stub: true`` in the evidence
log so that real integrations can replace them without changing the graph
structure.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

from agent.prompts import GATHER_MORE_EVIDENCE_STUB_PROMPT
from agent.state import CaseState

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
_MODEL = genai.GenerativeModel("gemini-3.6-flash")


def gather_more_evidence_node(state: CaseState) -> CaseState:
    """
    Simulate additional evidence-gathering actions and append results.

    Action selection logic
    ----------------------
    - If ``trigger_type`` is ``customer_report`` OR the ``account_takeover``
      pattern matched → simulate **VERIFY_WITH_CUSTOMER**.
    - If ``trigger_type`` is ``risk_score`` → simulate **STEP_UP_AUTH**.
    - Always simulate **ASK_ANALYST** as a catch-all.

    Each action calls Gemini with :data:`GATHER_MORE_EVIDENCE_STUB_PROMPT`
    to generate a realistic simulated response consistent with the suspected
    fraud patterns.

    Evidence entries appended
    -------------------------
    For each action::

        {
            "step": "gather_more_evidence",
            "timestamp": str,
            "action": str,
            "stub": True,
            "action_taken": str,
            "simulated_response": str,
            "evidence_added": dict,
            "confidence_delta": float
        }

    Parameters
    ----------
    state : CaseState
        Current graph state (must include pattern_matches, trigger_type).

    Returns
    -------
    CaseState
        Updated state with ``loop_count`` incremented and evidence appended.
    """
    case_id = state.get("case_id", "")
    trigger_type = state.get("trigger_type", "")
    loop_count = int(state.get("loop_count", 0))
    confidence = float(state.get("confidence", 0.5))
    pattern_matches = state.get("pattern_matches", [])

    logger.info(
        "[gather_more_evidence_node] case_id=%s loop=%d confidence=%.3f",
        case_id, loop_count, confidence,
    )

    # ── Determine which actions to simulate ──────────────────────────────
    actions_to_run: list[str] = []

    account_takeover_matched = any(
        pm.get("pattern_id") == "account_takeover" and pm.get("matched")
        for pm in pattern_matches
    )
    if trigger_type == "customer_report" or account_takeover_matched:
        actions_to_run.append("VERIFY_WITH_CUSTOMER")

    if trigger_type == "risk_score":
        actions_to_run.append("STEP_UP_AUTH")

    # Always ask the analyst
    actions_to_run.append("ASK_ANALYST")

    # De-duplicate while preserving order
    seen: set[str] = set()
    unique_actions: list[str] = []
    for a in actions_to_run:
        if a not in seen:
            unique_actions.append(a)
            seen.add(a)

    # ── Build suspected patterns string for the prompt ────────────────────
    suspected_patterns = _format_suspected_patterns(pattern_matches)

    evidence = list(state.get("evidence", []))

    # ── Run each simulated action ─────────────────────────────────────────
    for action in unique_actions:
        result = _simulate_action(
            action=action,
            state=state,
            suspected_patterns=suspected_patterns,
            confidence=confidence,
            loop_count=loop_count,
        )
        confidence_delta = float(result.get("confidence_delta", 0.0))

        entry: dict[str, Any] = {
            "step": "gather_more_evidence",
            "timestamp": _utc_now(),
            "action": action,
            "stub": True,
            "action_taken": result.get("action_taken", action),
            "simulated_response": result.get("simulated_response", ""),
            "evidence_added": result.get("evidence_added", {}),
            "confidence_delta": confidence_delta,
        }
        evidence.append(entry)
        logger.info(
            "[gather_more_evidence_node] action=%s confidence_delta=%+.3f",
            action, confidence_delta,
        )

    # ── Increment loop counter ────────────────────────────────────────────
    updated = dict(state)
    updated["evidence"] = evidence
    updated["loop_count"] = loop_count + 1

    logger.info(
        "[gather_more_evidence_node] done – loop_count now %d, "
        "%d actions simulated",
        loop_count + 1,
        len(unique_actions),
    )
    return updated  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _simulate_action(
    action: str,
    state: CaseState,
    suspected_patterns: str,
    confidence: float,
    loop_count: int,
) -> dict[str, Any]:
    """
    Call Gemini to generate a plausible simulation of *action*.

    Falls back to a heuristic response on LLM failure.
    """
    prompt = GATHER_MORE_EVIDENCE_STUB_PROMPT.format(
        case_id=state.get("case_id", ""),
        customer_id=state.get("customer_id", ""),
        card_id=state.get("card_id", ""),
        flagged_txn_id=state.get("flagged_txn_id", ""),
        trigger_type=state.get("trigger_type", ""),
        confidence=confidence,
        loop_count=loop_count,
        suspected_patterns=suspected_patterns,
        action_to_simulate=action,
    )
    try:
        from agent.llm import generate_content_with_retry
        text = generate_content_with_retry(prompt, max_retries=1, default_delay=5.0)
        parsed = _parse_json(text)
        if parsed and "action_taken" in parsed:
            return parsed
        return _fallback_response(action)
    except Exception as exc:
        logger.info("[gather_more_evidence_node] Using realistic stub for action=%s", action)
        return _fallback_response(action)


def _fallback_response(action: str) -> dict[str, Any]:
    """Return a deterministic stub response when the LLM is unavailable."""
    fallbacks: dict[str, dict[str, Any]] = {
        "VERIFY_WITH_CUSTOMER": {
            "action_taken": "Attempted out-of-band SMS verification with cardholder",
            "simulated_response": (
                "Customer did not recognise the flagged transaction. "
                "Stated they have not used the card in the last 7 days. "
                "Provided last-known device fingerprint for comparison."
            ),
            "evidence_added": {
                "customer_confirmed_fraud": True,
                "customer_contact_method": "SMS",
                "customer_last_known_device": "iPhone-Safari-iOS17",
            },
            "confidence_delta": 0.15,
        },
        "STEP_UP_AUTH": {
            "action_taken": "Initiated TOTP step-up authentication challenge",
            "simulated_response": (
                "Step-up authentication challenge sent to registered mobile number. "
                "Challenge timed out after 5 minutes — no response received. "
                "This is consistent with account takeover scenarios."
            ),
            "evidence_added": {
                "step_up_auth_result": "TIMED_OUT",
                "challenge_sent_to": "registered_mobile",
                "timeout_seconds": 300,
            },
            "confidence_delta": 0.10,
        },
        "ASK_ANALYST": {
            "action_taken": "Queried level-2 fraud analyst for domain assessment",
            "simulated_response": (
                "Analyst notes: transaction profile matches known card-not-present "
                "fraud ring operating in the Southeast US region. "
                "Similar cards flagged in the past 48 hours. "
                "Recommend immediate card block pending customer verification."
            ),
            "evidence_added": {
                "analyst_level": 2,
                "analyst_assessment": "HIGH_RISK",
                "analyst_recommendation": "BLOCK_CARD",
                "similar_incident_count_48h": 7,
            },
            "confidence_delta": 0.12,
        },
    }
    return fallbacks.get(
        action,
        {
            "action_taken": f"Simulated {action}",
            "simulated_response": "Action completed with no additional findings.",
            "evidence_added": {},
            "confidence_delta": 0.0,
        },
    )


def _format_suspected_patterns(pattern_matches: list[dict]) -> str:
    """Format pattern_matches list to a short prompt-friendly string."""
    if not pattern_matches:
        return "No patterns evaluated yet."
    lines = []
    for pm in pattern_matches:
        status = "MATCHED" if pm.get("matched") else "not matched"
        lines.append(f"  - {pm.get('pattern_id', 'unknown')}: {status}")
    return "\n".join(lines)


def _parse_json(text: str) -> dict[str, Any]:
    """Extract and parse the first JSON object in *text*."""
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        logger.warning("_parse_json: no JSON found in LLM response")
        return {}
    try:
        return json.loads(match.group(), strict=False)
    except Exception:
        try:
            sanitized = re.sub(r"[\x00-\x1f\x7f-\x9f]", " ", match.group())
            return json.loads(sanitized, strict=False)
        except json.JSONDecodeError as exc:
            logger.warning("_parse_json: decode error: %s", exc)
            return {}


def _utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()
