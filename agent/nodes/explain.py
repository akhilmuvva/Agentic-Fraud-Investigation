"""
agent/nodes/explain.py
-----------------------
LangGraph node: explain_node

Generates a human-readable, compliance-grade narrative for the completed
fraud investigation by passing the full evidence audit trail to Gemini.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import google.generativeai as genai
from dotenv import load_dotenv

from agent.prompts import EXPLAIN_PROMPT
from agent.state import CaseState

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
_MODEL = genai.GenerativeModel("gemini-3.6-flash")


def explain_node(state: CaseState) -> CaseState:
    """
    Generate a human-readable explanation of the investigation.

    The explanation is a single prose paragraph (200-400 words) that
    covers the trigger, detected patterns, similar cases, applicable
    policies, and why each action was or was not selected.

    Gemini is called with :data:`EXPLAIN_PROMPT` populated from the full
    evidence audit trail and the final decision fields.

    Evidence entry appended
    -----------------------
    ::

        {
            "step": "explain",
            "timestamp": str,
            "explanation_length_chars": int,
            "llm_raw": str
        }

    Parameters
    ----------
    state : CaseState
        Current graph state (should have all decision fields populated by
        ``recommend_action_node``).

    Returns
    -------
    CaseState
        Updated state with ``explanation`` set.
    """
    case_id = state.get("case_id", "")
    logger.info("[explain_node] case_id=%s", case_id)

    evidence = list(state.get("evidence", []))

    # ── Compile full audit trail for the prompt ───────────────────────────
    audit_trail = _compile_audit_trail(state, evidence)

    # ── Build prompt ──────────────────────────────────────────────────────
    prompt = EXPLAIN_PROMPT.format(
        audit_trail=audit_trail,
        confidence=state.get("confidence", 0.0),
        recommended_actions=", ".join(state.get("recommended_actions", [])) or "none",
        requires_human_approval=state.get("requires_human_approval", False),
        sar_required=state.get("sar_required", False),
        exposure_usd=state.get("exposure_usd", 0.0),
    )

    # ── Call Gemini ───────────────────────────────────────────────────────
    explanation = ""
    llm_raw = ""
    try:
        from agent.llm import generate_content_with_retry
        explanation = generate_content_with_retry(prompt)
        llm_raw = explanation
    except Exception as exc:
        logger.error("[explain_node] LLM call failed: %s", exc)
        explanation = _fallback_explanation(state)

    # ── Append evidence entry ─────────────────────────────────────────────
    evidence.append(
        {
            "step": "explain",
            "timestamp": _utc_now(),
            "explanation_length_chars": len(explanation),
            "llm_raw": llm_raw,
        }
    )

    updated = dict(state)
    updated["explanation"] = explanation
    updated["evidence"] = evidence

    logger.info(
        "[explain_node] explanation generated (%d chars)", len(explanation)
    )
    return updated  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _compile_audit_trail(state: CaseState, evidence: list[dict]) -> str:
    """
    Build a structured string representation of the evidence audit trail
    for inclusion in the EXPLAIN_PROMPT.

    Includes:
    - Case metadata header
    - Every evidence entry (condensed)
    - Pattern match results
    - Similar cases (top 3)
    - Policy hits (top 3)
    """
    lines: list[str] = [
        "=== CASE AUDIT TRAIL ===",
        f"Case ID         : {state.get('case_id', 'N/A')}",
        f"Trigger type    : {state.get('trigger_type', 'N/A')}",
        f"Trigger text    : {state.get('trigger_text', 'N/A')}",
        f"Flagged txn     : {state.get('flagged_txn_id', 'N/A')}",
        f"Card ID         : {state.get('card_id', 'N/A')}",
        f"Customer ID     : {state.get('customer_id', 'N/A')}",
        f"Initial risk    : {state.get('risk_score', 0.0):.3f}",
        f"Final confidence: {state.get('confidence', 0.0):.3f}",
        f"Loop count      : {state.get('loop_count', 0)}",
        "",
        "--- Evidence Log ---",
    ]

    for i, entry in enumerate(evidence, start=1):
        step = entry.get("step", "?")
        ts = entry.get("timestamp", "")[:19]
        summary = entry.get(
            "result_summary",
            entry.get(
                "simulated_response",
                entry.get("reasoning", entry.get("justification", "")),
            ),
        )
        lines.append(f"{i:3d}. [{ts}] {step}: {summary[:250]}")

    # Pattern matches
    lines += ["", "--- Pattern Match Results ---"]
    for pm in state.get("pattern_matches", []):
        status = "MATCHED" if pm.get("matched") else "not matched"
        lines.append(f"  {pm.get('pattern_id', '?')}: {status}")
        for ri in pm.get("risk_indicators", [])[:2]:
            lines.append(f"    indicator: {ri}")

    # Similar cases
    lines += ["", "--- Similar Prior Cases ---"]
    similar = state.get("similar_cases", [])
    if similar:
        for sc in similar[:3]:
            lines.append(
                f"  Case {sc.get('case_id','?')}: "
                f"pattern={sc.get('pattern','?')}, "
                f"outcome={sc.get('outcome','?')}, "
                f"actions={sc.get('actions_taken',[])} "
                f"(sim={sc.get('similarity_score',0.0):.3f})"
            )
    else:
        lines.append("  No similar cases found.")

    # Policy hits
    lines += ["", "--- Applicable Policy Clauses ---"]
    policy = state.get("policy_hits", [])
    if policy:
        for ph in policy[:3]:
            lines.append(
                f"  Clause {ph.get('clause_id','?')}: "
                f"{ph.get('clause_text','')[:150]} "
                f"→ Action: {ph.get('action_required','?')}"
            )
    else:
        lines.append("  No policy clauses retrieved.")

    return "\n".join(lines)


def _fallback_explanation(state: CaseState) -> str:
    """Deterministic fallback explanation when the LLM is unavailable."""
    matched = [
        pm["pattern_id"]
        for pm in state.get("pattern_matches", [])
        if pm.get("matched")
    ]
    actions = ", ".join(state.get("recommended_actions", [])) or "none"
    return (
        f"Investigation case {state.get('case_id', 'N/A')} was triggered by a "
        f"{state.get('trigger_type', 'unknown')} event on transaction "
        f"{state.get('flagged_txn_id', 'N/A')}. "
        f"Initial risk score was {state.get('risk_score', 0.0):.2f}. "
        f"The following fraud patterns were matched: "
        f"{', '.join(matched) if matched else 'none'}. "
        f"Final confidence: {state.get('confidence', 0.0):.2f}. "
        f"Recommended actions: {actions}. "
        f"Estimated exposure: ${state.get('exposure_usd', 0.0):.2f}. "
        f"SAR required: {state.get('sar_required', False)}. "
        f"Human approval required: {state.get('requires_human_approval', False)}."
    )


def _utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()
