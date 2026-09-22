"""
agent/state.py
--------------
Pydantic-based LangGraph state definition for the Fraud Investigation agent.

CaseState is a TypedDict so LangGraph can introspect it as a typed graph state.
All fields use plain Python types (no Pydantic models) to stay compatible with
LangGraph's reducer model and JSON serialisation.
"""

from __future__ import annotations

from typing import Any, TypedDict


class CaseState(TypedDict, total=False):
    """
    Full mutable state that flows through every node of the fraud
    investigation graph.

    Fields
    ------
    case_id : str
        Unique identifier for this investigation case.
    trigger_type : str
        How the case was initiated. One of:
        ``risk_score`` | ``customer_report`` | ``analyst_request``
    trigger_text : str
        Free-text description of the trigger event (e.g. customer complaint,
        analyst note, automated alert message).
    flagged_txn_id : str
        The transaction ID that triggered the investigation.
    card_id : str
        Payment card linked to the flagged transaction.
    customer_id : str
        Account holder / cardholder identity.
    risk_score : float
        Initial risk score attached to the event (0.0 – 1.0).
    entities : dict
        Hydrated graph entities retrieved from TigerGraph::

            {
                "customer": {...},
                "card": {...},
                "transaction": {...},
                "card_history": [...]
            }

    evidence : list
        Append-only audit log. Each entry is a dict with at minimum
        ``{step, timestamp}`` plus step-specific keys.
    pattern_matches : list
        Results of the 5 fraud-pattern GSQL queries. Each element::

            {
                "pattern_id": str,
                "matched": bool,
                "evidence_entities": list,
                "risk_indicators": list
            }

    neighborhood : dict
        Raw result of the ``get_suspicious_neighborhood`` GSQL query
        (2-hop subgraph around flagged_txn_id).
    similar_cases : list
        Top-k similar prior cases from GraphRAG retrieval. Each element::

            {
                "case_id": str,
                "outcome": str,
                "pattern": str,
                "actions_taken": list,
                "analyst_notes": str,
                "similarity_score": float
            }

    policy_hits : list
        Matched policy clauses from GraphRAG retrieval. Each element::

            {
                "clause_id": str,
                "clause_text": str,
                "action_required": str,
                "similarity_score": float
            }

    confidence : float
        Agent's current confidence in the fraud assessment (0.0 – 1.0).
    loop_count : int
        Number of completed ``gather_more_evidence`` iterations.
    next_action_before : dict
        Snapshot of the recommended-action estimate taken BEFORE the first
        ``gather_more_evidence`` pass (loop_count == 0).
    next_action_after : dict
        Snapshot captured AFTER the evidence loop exits into
        ``recommend_action``::

            {"actions": [...], "confidence": float}

    recommended_actions : list
        Final ordered list of action strings. Valid values::

            CREATE_CASE | BLOCK_CARD | VERIFY_WITH_CUSTOMER |
            CLOSE_NO_FRAUD | FILE_REPORT | MONITOR_ACCOUNT | ESCALATE

    requires_human_approval : bool
        True when any high-severity action (BLOCK_CARD, FILE_REPORT,
        ESCALATE) is in ``recommended_actions``.
    sar_required : bool
        True when policy PC-01 triggers (exposure >= $5 000 AND a confirmed
        fraud pattern exists).
    exposure_usd : float
        Estimated financial exposure in USD.
    explanation : str
        Human-readable narrative produced by the ``explain`` node, citing
        specific evidence, patterns, policies, and decisions.
    case_written_to_graph : bool
        Set to True once ``update_memory_node`` successfully persists the
        case to TigerGraph.
    error : str
        Any error message captured during node execution (empty string if
        none).
    """

    # ── Trigger / identity ────────────────────────────────────────────────
    case_id: str
    trigger_type: str            # risk_score | customer_report | analyst_request
    trigger_text: str
    flagged_txn_id: str
    card_id: str
    customer_id: str
    risk_score: float

    # ── Hydrated entities ─────────────────────────────────────────────────
    entities: dict[str, Any]

    # ── Append-only audit log ─────────────────────────────────────────────
    evidence: list[dict[str, Any]]

    # ── Pattern detection ─────────────────────────────────────────────────
    pattern_matches: list[dict[str, Any]]
    neighborhood: dict[str, Any]

    # ── GraphRAG retrieval ────────────────────────────────────────────────
    similar_cases: list[dict[str, Any]]
    policy_hits: list[dict[str, Any]]

    # ── Confidence & loop control ─────────────────────────────────────────
    confidence: float
    loop_count: int
    next_action_before: dict[str, Any]
    next_action_after: dict[str, Any]

    # ── Decisions ─────────────────────────────────────────────────────────
    recommended_actions: list[str]
    requires_human_approval: bool
    sar_required: bool
    exposure_usd: float

    # ── Outputs ───────────────────────────────────────────────────────────
    explanation: str
    case_written_to_graph: bool
    error: str


def default_state(
    case_id: str,
    trigger_type: str,
    trigger_text: str,
    flagged_txn_id: str,
    card_id: str,
    customer_id: str,
    risk_score: float = 0.0,
) -> CaseState:
    """
    Return a fully-initialised CaseState with safe defaults for every field.

    Parameters
    ----------
    case_id, trigger_type, trigger_text, flagged_txn_id,
    card_id, customer_id : str
        Required identity / trigger fields.
    risk_score : float, optional
        Initial risk score, default 0.0.

    Returns
    -------
    CaseState
        A TypedDict instance with every optional field populated so that
        downstream nodes never encounter a ``KeyError``.
    """
    return CaseState(
        case_id=case_id,
        trigger_type=trigger_type,
        trigger_text=trigger_text,
        flagged_txn_id=flagged_txn_id,
        card_id=card_id,
        customer_id=customer_id,
        risk_score=risk_score,
        entities={},
        evidence=[],
        pattern_matches=[],
        neighborhood={},
        similar_cases=[],
        policy_hits=[],
        confidence=0.0,
        loop_count=0,
        next_action_before={},
        next_action_after={},
        recommended_actions=[],
        requires_human_approval=False,
        sar_required=False,
        exposure_usd=0.0,
        explanation="",
        case_written_to_graph=False,
        error="",
    )
