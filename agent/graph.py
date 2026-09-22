"""
agent/graph.py
--------------
LangGraph state machine for the TigerGraph Agentic Fraud Investigation.

Graph topology
--------------

    trigger
        │
        ▼
    investigate
        │
        ▼
    gather_evidence
        │
        ▼
    assess_uncertainty ◄────────────────────┐
        │                                    │
        ├─ confidence < threshold            │
        │  AND loop_count < MAX_LOOPS        │
        │       │                            │
        │       ▼                            │
        │  gather_more_evidence ─────────────┘
        │
        └─ otherwise
                │
                ▼
           recommend_action
                │
                ▼
             explain
                │
                ▼
           update_memory
                │
                ▼
               END

Public exports
--------------
fraud_investigation_graph : CompiledStateGraph
    The compiled, ready-to-invoke LangGraph graph.

run_investigation(case_input: dict) -> dict
    Convenience wrapper: accepts a plain dict (compatible with the fields in
    CaseState), invokes the graph, and returns the final state as a dict.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from dotenv import load_dotenv
from langgraph.graph import END, StateGraph

from agent.state import CaseState, default_state
from agent.nodes.trigger import trigger_node
from agent.nodes.investigate import investigate_node
from agent.nodes.gather_evidence import gather_evidence_node
from agent.nodes.assess_uncertainty import assess_uncertainty_node
from agent.nodes.gather_more_evidence import gather_more_evidence_node
from agent.nodes.recommend_action import recommend_action_node
from agent.nodes.explain import explain_node
from agent.nodes.update_memory import update_memory_node

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Routing constants
# ---------------------------------------------------------------------------

# Confidence threshold below which more evidence is gathered
_CONFIDENCE_THRESHOLD: float = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.65"))

# Maximum number of gather_more_evidence → assess_uncertainty loop iterations
_MAX_LOOPS: int = int(os.environ.get("MAX_EVIDENCE_LOOPS", "2"))

# ---------------------------------------------------------------------------
# Conditional edge router
# ---------------------------------------------------------------------------


def _route_after_assess(state: CaseState) -> str:
    """
    Routing function for the conditional edge after assess_uncertainty.

    Returns
    -------
    str
        ``"gather_more_evidence"`` if confidence is below threshold AND the
        loop cap has not been reached; ``"recommend_action"`` otherwise.
    """
    confidence: float = float(state.get("confidence", 0.0))
    loop_count: int = int(state.get("loop_count", 0))

    # Also respect the LLM's own needs_more_evidence flag (stored as _needs_more_evidence)
    needs_more: bool = bool(state.get("_needs_more_evidence", False))

    if (confidence < _CONFIDENCE_THRESHOLD or needs_more) and loop_count < _MAX_LOOPS:
        logger.info(
            "[router] confidence=%.3f < threshold=%.3f, loop=%d/%d → gather_more_evidence",
            confidence, _CONFIDENCE_THRESHOLD, loop_count, _MAX_LOOPS,
        )
        return "gather_more_evidence"

    logger.info(
        "[router] confidence=%.3f >= threshold=%.3f or loop=%d/%d reached → recommend_action",
        confidence, _CONFIDENCE_THRESHOLD, loop_count, _MAX_LOOPS,
    )
    return "recommend_action"


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def _build_graph() -> StateGraph:
    """
    Construct the LangGraph StateGraph with all 8 nodes and their edges.

    Returns
    -------
    StateGraph
        Uncompiled graph (caller should call ``.compile()``).
    """
    graph = StateGraph(CaseState)

    # ── Register nodes ─────────────────────────────────────────────────────
    graph.add_node("trigger", trigger_node)
    graph.add_node("investigate", investigate_node)
    graph.add_node("gather_evidence", gather_evidence_node)
    graph.add_node("assess_uncertainty", assess_uncertainty_node)
    graph.add_node("gather_more_evidence", gather_more_evidence_node)
    graph.add_node("recommend_action", recommend_action_node)
    graph.add_node("explain", explain_node)
    graph.add_node("update_memory", update_memory_node)

    # ── Set entry point ────────────────────────────────────────────────────
    graph.set_entry_point("trigger")

    # ── Linear edges ──────────────────────────────────────────────────────
    graph.add_edge("trigger", "investigate")
    graph.add_edge("investigate", "gather_evidence")
    graph.add_edge("gather_evidence", "assess_uncertainty")

    # ── Conditional edge: assess_uncertainty → gather_more_evidence OR recommend_action
    graph.add_conditional_edges(
        "assess_uncertainty",
        _route_after_assess,
        {
            "gather_more_evidence": "gather_more_evidence",
            "recommend_action": "recommend_action",
        },
    )

    # ── Loop-back edge ─────────────────────────────────────────────────────
    graph.add_edge("gather_more_evidence", "assess_uncertainty")

    # ── Terminal linear edges ──────────────────────────────────────────────
    graph.add_edge("recommend_action", "explain")
    graph.add_edge("explain", "update_memory")
    graph.add_edge("update_memory", END)

    return graph


# ---------------------------------------------------------------------------
# Compiled graph (module-level singleton)
# ---------------------------------------------------------------------------

fraud_investigation_graph = _build_graph().compile()
"""
``fraud_investigation_graph`` is the compiled, ready-to-invoke LangGraph graph.

Usage::

    from agent.graph import fraud_investigation_graph
    result = fraud_investigation_graph.invoke(initial_state)
"""


# ---------------------------------------------------------------------------
# Convenience wrapper
# ---------------------------------------------------------------------------


def run_investigation(case_input: dict[str, Any]) -> dict[str, Any]:
    """
    Run a complete fraud investigation and return the final state.

    This function is the primary public entry-point for the FastAPI backend
    and any test harnesses.

    Parameters
    ----------
    case_input : dict
        A dict with at minimum the required CaseState fields:
        ``case_id``, ``trigger_type``, ``trigger_text``,
        ``flagged_txn_id``, ``card_id``, ``customer_id``.
        Optional fields (``risk_score``, etc.) will be defaulted.

    Returns
    -------
    dict
        The final CaseState as a plain dict, after all nodes have executed.
        Contains all evidence, decisions, explanation, and the
        ``case_written_to_graph`` flag.

    Raises
    ------
    KeyError
        If any required identity field is missing from ``case_input``.

    Example
    -------
    >>> result = run_investigation({
    ...     "case_id": "CASE-2026-001",
    ...     "trigger_type": "risk_score",
    ...     "trigger_text": "Automated alert: risk score 0.93 on txn T123",
    ...     "flagged_txn_id": "T123",
    ...     "card_id": "C456",
    ...     "customer_id": "U789",
    ...     "risk_score": 0.93,
    ... })
    >>> print(result["recommended_actions"])
    ['CREATE_CASE', 'BLOCK_CARD', 'FILE_REPORT']
    """
    # Build a fully-initialised state with safe defaults for every field
    initial_state: CaseState = default_state(
        case_id=case_input["case_id"],
        trigger_type=case_input.get("trigger_type", "analyst_request"),
        trigger_text=case_input.get("trigger_text", ""),
        flagged_txn_id=case_input["flagged_txn_id"],
        card_id=case_input.get("card_id", ""),
        customer_id=case_input["customer_id"],
        risk_score=float(case_input.get("risk_score", 0.0)),
    )

    # Overlay any additional caller-supplied fields (e.g. pre-populated entities)
    for key, value in case_input.items():
        if key in CaseState.__annotations__:
            initial_state[key] = value  # type: ignore[literal-required]

    logger.info(
        "[run_investigation] starting – case_id=%s trigger_type=%s",
        initial_state["case_id"],
        initial_state["trigger_type"],
    )

    try:
        final_state: dict[str, Any] = fraud_investigation_graph.invoke(initial_state)
    except Exception as exc:
        logger.exception("[run_investigation] graph execution failed: %s", exc)
        # Return a minimal error state so callers get a structured response
        return {
            **initial_state,
            "error": f"Graph execution failed: {exc}",
            "case_written_to_graph": False,
            "recommended_actions": [],
            "explanation": f"Investigation failed due to an internal error: {exc}",
        }

    logger.info(
        "[run_investigation] complete – case_id=%s confidence=%.3f actions=%s",
        final_state.get("case_id"),
        final_state.get("confidence", 0.0),
        final_state.get("recommended_actions", []),
    )
    return final_state
