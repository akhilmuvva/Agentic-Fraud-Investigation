"""
agent/nodes/update_memory.py
-----------------------------
LangGraph node: update_memory_node

Persists the completed investigation case to TigerGraph as an
InvestigationCase vertex plus CITES_PATTERN and CITES_CLAUSE edges.
This is always the final node before END.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from agent import tg_client
from agent.state import CaseState

logger = logging.getLogger(__name__)


def update_memory_node(state: CaseState) -> CaseState:
    """
    Persist the completed fraud investigation case to TigerGraph.

    Operations performed
    --------------------
    1. Build a serialisable ``case_dict`` from the full state (all scalar
       fields + summaries of list fields).
    2. Call :func:`tg_client.upsert_case` which:
       - Upserts the **InvestigationCase** vertex.
       - Creates **CITES_PATTERN** edges to each matched FraudPattern vertex.
       - Creates **CITES_CLAUSE** edges to each retrieved PolicyClause vertex.
    3. Set ``state["case_written_to_graph"] = True`` on success.
    4. Append final evidence entry.

    Evidence entry appended
    -----------------------
    ::

        {
            "step": "update_memory",
            "timestamp": str,
            "case_written_to_graph": bool,
            "upsert_success": bool,
            "case_dict_keys": list[str],
            "pattern_edges_created": int,
            "clause_edges_created": int,
            "error": str  # empty on success
        }

    Parameters
    ----------
    state : CaseState
        Final graph state after explain_node.

    Returns
    -------
    CaseState
        Updated state with ``case_written_to_graph`` set.
    """
    case_id = state.get("case_id", "UNKNOWN")
    logger.info("[update_memory_node] persisting case_id=%s", case_id)

    evidence = list(state.get("evidence", []))

    # ── Build serialisable case dict ──────────────────────────────────────
    case_dict = _build_case_dict(state)

    # ── Upsert to TigerGraph ──────────────────────────────────────────────
    success = False
    error_msg = ""
    try:
        success = tg_client.upsert_case(case_dict)
    except Exception as exc:
        error_msg = str(exc)
        logger.error("[update_memory_node] upsert_case failed: %s", exc)

    # Count expected edges for the evidence log
    matched_patterns = [
        pm for pm in state.get("pattern_matches", []) if pm.get("matched")
    ]
    policy_hits = state.get("policy_hits", [])

    # ── Append evidence entry ─────────────────────────────────────────────
    evidence.append(
        {
            "step": "update_memory",
            "timestamp": _utc_now(),
            "case_written_to_graph": success,
            "upsert_success": success,
            "case_dict_keys": list(case_dict.keys()),
            "pattern_edges_created": len(matched_patterns),
            "clause_edges_created": len(policy_hits),
            "error": error_msg,
        }
    )

    updated = dict(state)
    updated["case_written_to_graph"] = success
    updated["evidence"] = evidence
    if error_msg:
        updated["error"] = error_msg

    logger.info(
        "[update_memory_node] done – success=%s patterns_edges=%d clause_edges=%d",
        success, len(matched_patterns), len(policy_hits),
    )
    return updated  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_case_dict(state: CaseState) -> dict[str, Any]:
    """
    Construct a flat, serialisable dict from the CaseState for upsert.

    Lists and dicts are included as-is; :func:`tg_client.upsert_case`
    handles the serialisation nuances for TigerGraph attributes.
    """
    return {
        # Identity
        "case_id": state.get("case_id", ""),
        "trigger_type": state.get("trigger_type", ""),
        "trigger_text": state.get("trigger_text", ""),
        "flagged_txn_id": state.get("flagged_txn_id", ""),
        "card_id": state.get("card_id", ""),
        "customer_id": state.get("customer_id", ""),

        # Scores
        "risk_score": state.get("risk_score", 0.0),
        "confidence": state.get("confidence", 0.0),
        "exposure_usd": state.get("exposure_usd", 0.0),
        "loop_count": state.get("loop_count", 0),

        # Decisions
        "recommended_actions": state.get("recommended_actions", []),
        "requires_human_approval": state.get("requires_human_approval", False),
        "sar_required": state.get("sar_required", False),

        # Audit
        "explanation": state.get("explanation", ""),
        "case_written_to_graph": state.get("case_written_to_graph", False),
        "error": state.get("error", ""),

        # Graph-edge source data
        "pattern_matches": state.get("pattern_matches", []),
        "policy_hits": state.get("policy_hits", []),

        # Snapshots
        "next_action_before": state.get("next_action_before", {}),
        "next_action_after": state.get("next_action_after", {}),

        # Neighbourhood summary (trimmed to avoid oversized vertex attributes)
        "neighborhood_node_count": state.get("neighborhood", {}).get("node_count", 0),
        "neighborhood_edge_count": state.get("neighborhood", {}).get("edge_count", 0),

        # Similar-case IDs for reference
        "similar_case_ids": [
            sc.get("case_id", "") for sc in state.get("similar_cases", [])
        ],

        # Timestamp
        "completed_at": _utc_now(),
    }


def _utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()
