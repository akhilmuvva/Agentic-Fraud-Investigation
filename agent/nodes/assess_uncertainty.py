"""
agent/nodes/assess_uncertainty.py
----------------------------------
LangGraph node: assess_uncertainty_node

Evaluates the current body of evidence to assign a confidence score (0-1)
and determines whether additional evidence gathering is warranted before
making a final recommendation.

On the first pass (loop_count == 0) it also takes a snapshot of the current
estimated action set into state["next_action_before"] for later comparison.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone

import google.generativeai as genai
from dotenv import load_dotenv

from agent import graphrag
from agent.prompts import ASSESS_UNCERTAINTY_PROMPT
from agent.state import CaseState

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)



# Maximum number of evidence-gathering loops before forcing a decision
MAX_LOOPS = 2


def assess_uncertainty_node(state: CaseState) -> CaseState:
    """
    Assess confidence level and decide whether to gather more evidence.

    Behaviour
    ---------
    1. Builds a structured textual summary of:
       - Pattern match results (counts + per-pattern status)
       - Evidence log highlights (step names, tool names, result summaries)
       - Similar prior cases (formatted by graphrag)
       - Relevant policy clauses (formatted by graphrag)
    2. If ``loop_count == 0``, saves a pre-loop snapshot into
       ``state["next_action_before"]``.
    3. Calls Gemini with :data:`ASSESS_UNCERTAINTY_PROMPT`.
    4. Parses the JSON response for ``confidence``, ``reasoning``,
       ``needs_more_evidence``, and ``missing_evidence``.
    5. Enforces ``needs_more_evidence = False`` when ``loop_count >= MAX_LOOPS``
       to prevent infinite loops.
    6. Updates ``state["confidence"]`` and appends an evidence entry.

    Parameters
    ----------
    state : CaseState
        Current graph state.

    Returns
    -------
    CaseState
        Updated state with ``confidence`` set and evidence appended.
    """
    case_id = state.get("case_id", "")
    loop_count = int(state.get("loop_count", 0))
    logger.info(
        "[assess_uncertainty_node] case_id=%s loop_count=%d", case_id, loop_count
    )

    evidence = list(state.get("evidence", []))
    pattern_matches = state.get("pattern_matches", [])
    similar_cases = state.get("similar_cases", [])
    policy_hits = state.get("policy_hits", [])

    # ── Build structured summaries ────────────────────────────────────────
    pattern_match_summary = _summarise_patterns(pattern_matches)
    evidence_summary = _summarise_evidence(evidence)
    similar_cases_summary = graphrag.format_case_context(similar_cases)
    policy_summary = graphrag.format_policy_context(policy_hits)

    # ── Snapshot before first loop ────────────────────────────────────────
    updated = dict(state)
    if loop_count == 0:
        snapshot = _estimate_preliminary_actions(pattern_matches, state.get("risk_score", 0.0))
        updated["next_action_before"] = snapshot
        logger.info(
            "[assess_uncertainty_node] next_action_before snapshot: %s", snapshot
        )

    # ── Build prompt ──────────────────────────────────────────────────────
    prompt = ASSESS_UNCERTAINTY_PROMPT.format(
        case_id=case_id,
        loop_count=loop_count,
        pattern_match_summary=pattern_match_summary,
        evidence_count=len(evidence),
        evidence_summary=evidence_summary,
        similar_cases_summary=similar_cases_summary,
        policy_summary=policy_summary,
    )

    # ── Call Gemini ───────────────────────────────────────────────────────
    llm_response_text = ""
    parsed: dict = {}
    print(f"\n[assess_uncertainty_node] --- RAW GEMINI PROMPT SENT ---\n{prompt}\n--- END PROMPT ---\n")
    logger.info("[assess_uncertainty_node] Prompt sent:\n%s", prompt)
    try:
        from agent.llm import generate_content_with_retry
        llm_response_text = generate_content_with_retry(prompt)
        print(f"\n[assess_uncertainty_node] --- RAW GEMINI TEXT RESPONSE ---\n{llm_response_text}\n--- END RESPONSE ---\n")
        logger.info("[assess_uncertainty_node] Raw response:\n%s", llm_response_text)
        parsed = _parse_json(llm_response_text)
        print(f"[assess_uncertainty_node] _parse_json status: {'SUCCESS' if (parsed and 'confidence' in parsed) else 'FELL BACK TO DEFAULT'}, parsed: {parsed}\n")
        logger.info("[assess_uncertainty_node] _parse_json status: %s", "SUCCESS" if (parsed and "confidence" in parsed) else "FELL BACK TO DEFAULT")
    except Exception as exc:
        print(f"[assess_uncertainty_node] Gemini call exception: {exc}")
        logger.error("[assess_uncertainty_node] LLM call failed: %s", exc)
        matched_cnt = sum(1 for pm in pattern_matches if pm.get("matched"))
        calc_conf = min(0.92, 0.40 + 0.15 * matched_cnt) if matched_cnt > 0 else max(0.10, float(state.get("risk_score", 0.0)))
        parsed = {
            "confidence": round(calc_conf, 2),
            "reasoning": f"Evidence-based heuristic: {matched_cnt} matched patterns, risk_score={state.get('risk_score', 0.0)}",
            "needs_more_evidence": loop_count < MAX_LOOPS and matched_cnt == 0,
            "missing_evidence": [],
        }
        print(f"[assess_uncertainty_node] Fallback computed confidence: {parsed['confidence']}\n")

    # ── Enforce loop cap ──────────────────────────────────────────────────
    confidence = float(parsed.get("confidence", 0.5))
    needs_more = bool(parsed.get("needs_more_evidence", False))
    if loop_count >= MAX_LOOPS:
        needs_more = False
        parsed["needs_more_evidence"] = False
        logger.info(
            "[assess_uncertainty_node] loop_count=%d >= MAX_LOOPS=%d, "
            "forcing needs_more_evidence=False",
            loop_count, MAX_LOOPS,
        )

    # ── Append evidence entry ─────────────────────────────────────────────
    evidence.append(
        {
            "step": "assess_uncertainty",
            "timestamp": _utc_now(),
            "loop_count": loop_count,
            "confidence": confidence,
            "reasoning": parsed.get("reasoning", ""),
            "needs_more_evidence": needs_more,
            "missing_evidence": parsed.get("missing_evidence", []),
            "llm_raw": llm_response_text,
        }
    )

    updated["confidence"] = confidence
    updated["evidence"] = evidence
    # Store needs_more_evidence as a transient flag for the conditional edge
    # (We embed it in the evidence; the graph edge router reads state["confidence"]
    # and state["loop_count"] directly — see graph.py)
    updated["_needs_more_evidence"] = needs_more  # type: ignore[literal-required]

    logger.info(
        "[assess_uncertainty_node] confidence=%.3f needs_more=%s loop=%d",
        confidence, needs_more, loop_count,
    )
    return updated  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _summarise_patterns(pattern_matches: list[dict]) -> str:
    """Convert pattern_matches list to a compact multi-line summary."""
    if not pattern_matches:
        return "No pattern queries have been executed yet."
    matched_count = sum(1 for pm in pattern_matches if pm.get("matched"))
    lines = [
        f"Total patterns checked: {len(pattern_matches)}, "
        f"matched: {matched_count}, not matched: {len(pattern_matches) - matched_count}"
    ]
    for pm in pattern_matches:
        status = "MATCHED" if pm.get("matched") else "NOT MATCHED"
        indicators = pm.get("risk_indicators", [])
        ind_str = "; ".join(str(i) for i in indicators[:3]) if indicators else "none"
        lines.append(
            f"  [{status}] {pm.get('pattern_id', 'unknown')} - indicators: {ind_str}"
        )
    return "\n".join(lines)


def _summarise_evidence(evidence: list[dict]) -> str:
    """Produce a concise audit of the evidence log suitable for an LLM prompt."""
    if not evidence:
        return "No evidence gathered yet."
    # Include at most the last 20 entries to avoid token overflow
    recent = evidence[-20:]
    lines = [f"Evidence log ({len(evidence)} total entries, showing last {len(recent)}):"]
    for entry in recent:
        step = entry.get("step", "unknown")
        tool = entry.get("tool", entry.get("query", ""))
        summary = entry.get("result_summary", entry.get("simulated_response", ""))
        ts = entry.get("timestamp", "")[:19]  # trim microseconds
        lines.append(f"  [{ts}] step={step} tool={tool}: {summary[:200]}")
    return "\n".join(lines)


def _estimate_preliminary_actions(
    pattern_matches: list[dict], risk_score: float
) -> dict:
    """
    Heuristic pre-loop action estimate for the next_action_before snapshot.
    Not used by the LLM — purely a human-readable record.
    """
    matched = [pm["pattern_id"] for pm in pattern_matches if pm.get("matched")]
    if matched or risk_score >= 0.7:
        actions = ["CREATE_CASE", "VERIFY_WITH_CUSTOMER"]
        if risk_score >= 0.85:
            actions.append("BLOCK_CARD")
    else:
        actions = ["MONITOR_ACCOUNT"]
    return {
        "estimated_actions": actions,
        "matched_patterns": matched,
        "risk_score": risk_score,
        "note": "Pre-loop preliminary estimate before gather_more_evidence",
    }


def _parse_json(text: str) -> dict:
    """
    Extract and parse the first JSON object found in *text*.
    Falls back to an empty dict on failure.
    """
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    # Find first {...} block
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        logger.warning("_parse_json: no JSON object found in LLM response")
        return {}
    try:
        return json.loads(match.group(), strict=False)
    except Exception:
        try:
            sanitized = re.sub(r"[\x00-\x1f\x7f-\x9f]", " ", match.group())
            return json.loads(sanitized, strict=False)
        except json.JSONDecodeError as exc:
            logger.warning("_parse_json: JSON decode error: %s", exc)
            return {}


def _utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()
