"""
agent/nodes/trigger.py
----------------------
LangGraph node: trigger_node

Validates the incoming case trigger fields and logs the trigger event to
the evidence audit trail. This is always the first node executed.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from agent.state import CaseState

logger = logging.getLogger(__name__)

# Required fields that must be present and non-empty before investigation begins
_REQUIRED_FIELDS: list[str] = [
    "case_id",
    "flagged_txn_id",
    "customer_id",
]


def trigger_node(state: CaseState) -> CaseState:
    """
    Validate the trigger and append the initial evidence entry.

    Validation
    ----------
    Checks that ``case_id``, ``flagged_txn_id``, and ``customer_id`` are
    present and non-empty in the incoming state. If any field is missing
    or empty, ``state["error"]`` is populated with a descriptive message.

    Evidence entry appended
    -----------------------
    ::

        {
            "step": "trigger",
            "timestamp": "<ISO-8601 UTC>",
            "trigger_type": str,
            "trigger_text": str,
            "flagged_txn_id": str,
            "card_id": str,
            "customer_id": str,
            "risk_score": float
        }

    Parameters
    ----------
    state : CaseState
        The initial graph state, typically constructed from a caller-supplied
        dict via :func:`agent.state.default_state`.

    Returns
    -------
    CaseState
        Updated state with the trigger evidence entry appended (and
        ``error`` set if validation failed).
    """
    logger.info(
        "[trigger_node] case_id=%s trigger_type=%s",
        state.get("case_id", "<missing>"),
        state.get("trigger_type", "<missing>"),
    )

    # ── Validation ────────────────────────────────────────────────────────
    missing = [f for f in _REQUIRED_FIELDS if not state.get(f)]
    if missing:
        error_msg = f"trigger_node: missing required fields: {', '.join(missing)}"
        logger.error(error_msg)
        # Mutate a copy so LangGraph can track deltas
        updated = dict(state)
        updated["error"] = error_msg
        # Still append a partial evidence entry so the audit trail is honest
        evidence = list(state.get("evidence", []))
        evidence.append(
            {
                "step": "trigger",
                "timestamp": _utc_now(),
                "status": "VALIDATION_FAILED",
                "missing_fields": missing,
                "error": error_msg,
            }
        )
        updated["evidence"] = evidence
        return updated  # type: ignore[return-value]

    # ── Build evidence entry ──────────────────────────────────────────────
    trigger_entry: dict = {
        "step": "trigger",
        "timestamp": _utc_now(),
        "status": "OK",
        "trigger_type": state.get("trigger_type", ""),
        "trigger_text": state.get("trigger_text", ""),
        "flagged_txn_id": state.get("flagged_txn_id", ""),
        "card_id": state.get("card_id", ""),
        "customer_id": state.get("customer_id", ""),
        "risk_score": state.get("risk_score", 0.0),
    }

    evidence = list(state.get("evidence", []))
    evidence.append(trigger_entry)

    updated = dict(state)
    updated["evidence"] = evidence
    # Clear any prior error from a retry
    updated["error"] = ""

    logger.info(
        "[trigger_node] validation passed – case_id=%s", state.get("case_id")
    )
    return updated  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()
