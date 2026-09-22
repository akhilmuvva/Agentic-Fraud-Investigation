"""
agent/nodes/recommend_action.py
--------------------------------
LangGraph node: recommend_action_node

Uses Gemini to recommend the final set of actions for the fraud case,
then post-processes the response to enforce policy rules (SAR threshold,
human-approval gates).

Also captures the post-loop snapshot into state["next_action_after"].
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

from agent import graphrag
from agent.prompts import RECOMMEND_ACTION_PROMPT
from agent.state import CaseState

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
_MODEL = genai.GenerativeModel("gemini-3.6-flash")

# Actions that require a human sign-off before execution
_HIGH_SEVERITY_ACTIONS = {"BLOCK_CARD", "FILE_REPORT", "ESCALATE"}

# Policy PC-01: file SAR when exposure >= $5 000 AND confirmed pattern
_SAR_THRESHOLD_USD = 5_000.0


def recommend_action_node(state: CaseState) -> CaseState:
    """
    Generate and validate the final action recommendation.

    Steps
    -----
    1. Build structured summaries of pattern_matches, policy_hits,
       similar_cases, and the evidence log.
    2. Estimate ``exposure_usd`` from the flagged transaction amount
       (uses entity data; falls back to 0.0).
    3. Call Gemini with :data:`RECOMMEND_ACTION_PROMPT`.
    4. Parse ``recommended_actions``, ``requires_human_approval``,
       ``sar_required``, and ``exposure_usd`` from the JSON response.
    5. Post-process (policy enforcement):
       - If any action in ``_HIGH_SEVERITY_ACTIONS`` is present →
         ``requires_human_approval = True`` (override).
       - If ``exposure_usd >= _SAR_THRESHOLD_USD`` AND any pattern matched →
         ``sar_required = True`` (PC-01 override).
    6. Store ``next_action_after`` snapshot.
    7. Append evidence entry and return updated state.

    Parameters
    ----------
    state : CaseState
        Current graph state.

    Returns
    -------
    CaseState
        Updated state with recommendation fields populated.
    """
    case_id = state.get("case_id", "")
    confidence = float(state.get("confidence", 0.0))
    pattern_matches = state.get("pattern_matches", [])
    policy_hits = state.get("policy_hits", [])
    similar_cases = state.get("similar_cases", [])

    logger.info(
        "[recommend_action_node] case_id=%s confidence=%.3f", case_id, confidence
    )

    evidence = list(state.get("evidence", []))

    # ── Estimate exposure from transaction data ────────────────────────────
    txn = state.get("entities", {}).get("transaction", {})
    raw_amount = txn.get("TransactionAmt", txn.get("amount", 0))
    try:
        estimated_exposure = float(raw_amount)
    except (TypeError, ValueError):
        estimated_exposure = state.get("exposure_usd", 0.0) or 0.0

    # ── Build structured summaries ────────────────────────────────────────
    pattern_match_summary = _summarise_patterns(pattern_matches)
    policy_summary = graphrag.format_policy_context(policy_hits)
    similar_cases_summary = graphrag.format_case_context(similar_cases)
    evidence_summary = _summarise_evidence_tail(evidence)

    # ── Build and call prompt ─────────────────────────────────────────────
    prompt = RECOMMEND_ACTION_PROMPT.format(
        case_id=case_id,
        customer_id=state.get("customer_id", ""),
        card_id=state.get("card_id", ""),
        flagged_txn_id=state.get("flagged_txn_id", ""),
        confidence=confidence,
        trigger_type=state.get("trigger_type", ""),
        pattern_match_summary=pattern_match_summary,
        exposure_usd=estimated_exposure,
        policy_summary=policy_summary,
        similar_cases_summary=similar_cases_summary,
        evidence_summary=evidence_summary,
    )

    llm_raw = ""
    parsed: dict[str, Any] = {}
    try:
        from agent.llm import generate_content_with_retry
        llm_raw = generate_content_with_retry(prompt)
        parsed = _parse_json(llm_raw)
    except Exception as exc:
        logger.error("[recommend_action_node] LLM call failed: %s", exc)
        parsed = _heuristic_recommendation(pattern_matches, confidence, estimated_exposure)

    # ── Extract fields ────────────────────────────────────────────────────
    recommended_actions: list[str] = parsed.get("recommended_actions", [])
    requires_human = bool(parsed.get("requires_human_approval", False))
    sar_required = bool(parsed.get("sar_required", False))
    exposure_usd = float(parsed.get("exposure_usd", estimated_exposure))
    justification = parsed.get("justification", "")

    # Validate action strings against allowed set
    _VALID_ACTIONS = {
        "CREATE_CASE", "BLOCK_CARD", "VERIFY_WITH_CUSTOMER",
        "CLOSE_NO_FRAUD", "FILE_REPORT", "MONITOR_ACCOUNT", "ESCALATE",
    }
    recommended_actions = [
        a for a in recommended_actions if a in _VALID_ACTIONS
    ]
    if not recommended_actions:
        # Minimum safe default
        recommended_actions = ["CREATE_CASE", "MONITOR_ACCOUNT"]

    # ── Policy enforcement overrides ──────────────────────────────────────
    # High-severity gate
    if any(a in _HIGH_SEVERITY_ACTIONS for a in recommended_actions):
        requires_human = True

    # PC-01: SAR threshold
    any_pattern_matched = any(pm.get("matched") for pm in pattern_matches)
    if exposure_usd >= _SAR_THRESHOLD_USD and any_pattern_matched:
        sar_required = True
        if "FILE_REPORT" not in recommended_actions:
            recommended_actions.append("FILE_REPORT")
        requires_human = True

    # ── Next-action-after snapshot ────────────────────────────────────────
    next_action_after: dict[str, Any] = {
        "actions": recommended_actions,
        "confidence": confidence,
        "exposure_usd": exposure_usd,
        "sar_required": sar_required,
        "requires_human_approval": requires_human,
    }

    # ── Append evidence entry ─────────────────────────────────────────────
    evidence.append(
        {
            "step": "recommend_action",
            "timestamp": _utc_now(),
            "recommended_actions": recommended_actions,
            "requires_human_approval": requires_human,
            "sar_required": sar_required,
            "exposure_usd": exposure_usd,
            "justification": justification,
            "llm_raw": llm_raw,
        }
    )

    # ── Derive outcome and pattern_matched ────────────────────────────────
    if "CLOSE_NO_FRAUD" in recommended_actions:
        outcome = "cleared"
    elif "BLOCK_CARD" in recommended_actions or "FILE_REPORT" in recommended_actions or confidence >= 0.7:
        outcome = "confirmed_fraud"
    elif "ESCALATE" in recommended_actions:
        outcome = "escalated"
    else:
        outcome = "investigating"

    matched_pats = [pm["pattern_id"] for pm in pattern_matches if pm.get("matched")]
    pattern_matched = matched_pats[0] if matched_pats else "none"

    updated = dict(state)
    updated["recommended_actions"] = recommended_actions
    updated["requires_human_approval"] = requires_human
    updated["sar_required"] = sar_required
    updated["exposure_usd"] = exposure_usd
    updated["next_action_after"] = next_action_after
    updated["outcome"] = outcome
    updated["pattern_matched"] = pattern_matched
    updated["evidence"] = evidence

    logger.info(
        "[recommend_action_node] actions=%s human_approval=%s sar=%s exposure=$%.2f",
        recommended_actions, requires_human, sar_required, exposure_usd,
    )
    return updated  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _summarise_patterns(pattern_matches: list[dict]) -> str:
    if not pattern_matches:
        return "No pattern queries were executed."
    matched = [pm["pattern_id"] for pm in pattern_matches if pm.get("matched")]
    not_matched = [pm["pattern_id"] for pm in pattern_matches if not pm.get("matched")]
    lines = [
        f"Matched patterns ({len(matched)}): {', '.join(matched) if matched else 'none'}",
        f"Not matched ({len(not_matched)}): {', '.join(not_matched) if not_matched else 'none'}",
    ]
    for pm in pattern_matches:
        if pm.get("matched"):
            indicators = "; ".join(str(i) for i in pm.get("risk_indicators", [])[:3])
            lines.append(f"  ✓ {pm['pattern_id']}: {indicators}")
    return "\n".join(lines)


def _summarise_evidence_tail(evidence: list[dict], tail: int = 15) -> str:
    if not evidence:
        return "No evidence entries."
    recent = evidence[-tail:]
    lines = [f"Last {len(recent)} evidence entries (of {len(evidence)} total):"]
    for e in recent:
        step = e.get("step", "?")
        summary = e.get(
            "result_summary",
            e.get("simulated_response", e.get("justification", ""))
        )
        lines.append(f"  [{e.get('timestamp', '')[:19]}] {step}: {summary[:180]}")
    return "\n".join(lines)


def _heuristic_recommendation(
    pattern_matches: list[dict],
    confidence: float,
    exposure_usd: float,
) -> dict[str, Any]:
    """Fallback heuristic when the LLM is unavailable."""
    any_matched = any(pm.get("matched") for pm in pattern_matches)
    actions: list[str] = ["CREATE_CASE"]
    if confidence >= 0.75 and any_matched:
        actions += ["BLOCK_CARD", "FILE_REPORT"]
    elif confidence >= 0.5:
        actions += ["VERIFY_WITH_CUSTOMER", "ESCALATE"]
    elif confidence < 0.3 and not any_matched:
        actions = ["CLOSE_NO_FRAUD"]
    else:
        actions.append("MONITOR_ACCOUNT")

    return {
        "recommended_actions": actions,
        "requires_human_approval": any(a in _HIGH_SEVERITY_ACTIONS for a in actions),
        "sar_required": exposure_usd >= _SAR_THRESHOLD_USD and any_matched,
        "exposure_usd": exposure_usd,
        "justification": "Heuristic fallback recommendation (LLM unavailable).",
    }


def _parse_json(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(), strict=False)
    except Exception:
        try:
            sanitized = re.sub(r"[\x00-\x1f\x7f-\x9f]", " ", match.group())
            return json.loads(sanitized, strict=False)
        except Exception:
            return {}


def _utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()
