"""
agent/nodes/gather_evidence.py
------------------------------
LangGraph node: gather_evidence_node

Runs all 5 fraud-pattern GSQL queries, the suspicious neighbourhood query,
and retrieves similar prior cases + relevant policy clauses via GraphRAG.
All results are appended to the evidence audit trail and stored in the
appropriate state fields.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from agent import graphrag, tg_client
from agent.state import CaseState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pattern query registry
# ---------------------------------------------------------------------------
# Each entry: (pattern_id, query_name, params_builder)
# params_builder receives the CaseState and returns the dict of GSQL params.

_PATTERN_QUERIES: list[tuple[str, str, Any]] = [
    (
        "card_not_present_fraud",
        "detect_card_not_present_fraud",
        lambda s: {"card_id": s.get("card_id", ""), "lookback_days": 90},
    ),
    (
        "account_takeover",
        "detect_account_takeover",
        lambda s: {"customer_id": s.get("customer_id", ""), "lookback_days": 90},
    ),
    (
        "card_not_present_new_device",
        "detect_card_not_present_new_device",
        lambda s: {"card_id": s.get("card_id", ""), "lookback_days": 90},
    ),
    (
        "out_of_region_use",
        "detect_out_of_region_use",
        lambda s: {
            "card_id": s.get("card_id", ""),
            "transaction_id": s.get("flagged_txn_id", ""),
        },
    ),
    (
        "card_testing",
        "detect_card_testing",
        lambda s: {"card_id": s.get("card_id", ""), "window_hours": 24},
    ),
]


def gather_evidence_node(state: CaseState) -> CaseState:
    """
    Execute all fraud pattern queries and GraphRAG retrievals.

    Steps performed
    ---------------
    1. Run the 5 fraud-pattern GSQL installed queries via
       :func:`tg_client.run_gsql_query`.
    2. Run ``get_suspicious_neighborhood(flagged_txn_id, depth=2)`` to obtain
       the 2-hop subgraph.
    3. Build a case summary string and call
       :func:`graphrag.retrieve_similar_cases` for top-3 prior cases.
    4. Build a situation text and call
       :func:`graphrag.retrieve_relevant_policy` for top-3 policy clauses.

    All results are appended to ``state["evidence"]`` and stored in the
    dedicated state fields:
    - ``pattern_matches`` – list of per-pattern match results
    - ``neighborhood``    – raw subgraph dict
    - ``similar_cases``   – list of similar prior cases
    - ``policy_hits``     – list of relevant policy clauses

    Parameters
    ----------
    state : CaseState
        Current graph state (must contain entities from investigate_node).

    Returns
    -------
    CaseState
        Updated state with all evidence fields populated.
    """
    case_id = state.get("case_id", "")
    card_id = state.get("card_id", "")
    customer_id = state.get("customer_id", "")
    flagged_txn_id = state.get("flagged_txn_id", "")

    logger.info("[gather_evidence_node] case_id=%s", case_id)

    evidence = list(state.get("evidence", []))
    pattern_matches: list[dict[str, Any]] = []

    # ── 1. Run the 5 pattern detection queries ────────────────────────────
    for pattern_id, query_name, params_fn in _PATTERN_QUERIES:
        params = params_fn(state)
        logger.debug("Running pattern query %s with params %s", query_name, params)
        result = tg_client.run_gsql_query(query_name, params)

        # Parse matched status from the query result
        matched, evidence_entities, risk_indicators = _parse_pattern_result(
            pattern_id, result
        )

        pattern_match: dict[str, Any] = {
            "pattern_id": pattern_id,
            "matched": matched,
            "evidence_entities": evidence_entities,
            "risk_indicators": risk_indicators,
        }
        pattern_matches.append(pattern_match)

        evidence.append(
            {
                "step": "gather_evidence",
                "timestamp": _utc_now(),
                "tool": "run_gsql_query",
                "query": query_name,
                "params": params,
                "result_summary": (
                    f"Pattern '{pattern_id}': matched={matched}, "
                    f"{len(evidence_entities)} evidence entities, "
                    f"{len(risk_indicators)} risk indicators"
                ),
                "raw": result,
                "pattern_match": pattern_match,
            }
        )
        logger.info("Pattern %s: matched=%s", pattern_id, matched)

    # ── 2. Suspicious neighbourhood query ─────────────────────────────────
    neighborhood_result = tg_client.run_gsql_query(
        "get_suspicious_neighborhood",
        params={"transaction_id": flagged_txn_id, "hops": 2},
    )
    neighborhood: dict[str, Any] = {}
    if not neighborhood_result.get("error") and neighborhood_result.get("results"):
        neighborhood = {"raw": neighborhood_result["results"]}
        # Try to parse node/edge counts for the summary
        node_count, edge_count = _count_neighborhood(neighborhood_result["results"])
        neighborhood["node_count"] = node_count
        neighborhood["edge_count"] = edge_count
    else:
        node_count, edge_count = 0, 0

    evidence.append(
        {
            "step": "gather_evidence",
            "timestamp": _utc_now(),
            "tool": "run_gsql_query",
            "query": "get_suspicious_neighborhood",
            "params": {"transaction_id": flagged_txn_id, "hops": 2},
            "result_summary": (
                f"Suspicious neighbourhood around txn {flagged_txn_id}: "
                f"{node_count} nodes, {edge_count} edges (2-hop)"
            ),
            "raw": neighborhood_result,
        }
    )

    # ── 3. GraphRAG: similar prior cases ──────────────────────────────────
    # Build a concise summary that covers the most discriminating facts
    matched_pattern_names = [
        pm["pattern_id"] for pm in pattern_matches if pm["matched"]
    ]
    case_summary = (
        f"Fraud investigation: trigger_type={state.get('trigger_type', '')}, "
        f"risk_score={state.get('risk_score', 0.0)}, "
        f"card_id={card_id}, customer_id={customer_id}, "
        f"matched_patterns={', '.join(matched_pattern_names) if matched_pattern_names else 'none'}, "
        f"flagged_txn_id={flagged_txn_id}"
    )
    similar_cases = graphrag.retrieve_similar_cases(case_summary, top_k=3)
    evidence.append(
        {
            "step": "gather_evidence",
            "timestamp": _utc_now(),
            "tool": "graphrag.retrieve_similar_cases",
            "params": {"case_summary": case_summary, "top_k": 3},
            "result_summary": (
                f"Retrieved {len(similar_cases)} similar prior cases. "
                + (
                    f"Best match: case_id={similar_cases[0]['case_id']} "
                    f"(similarity={similar_cases[0].get('similarity_score', 0.0):.3f})"
                    if similar_cases else "No similar cases found."
                )
            ),
            "raw": similar_cases,
        }
    )

    # ── 4. GraphRAG: relevant policy clauses ──────────────────────────────
    txn_attrs = state.get("entities", {}).get("transaction", {})
    situation_text = (
        f"Case involves: trigger_type={state.get('trigger_type', '')}, "
        f"trigger_text={state.get('trigger_text', '')}, "
        f"suspected fraud patterns: {', '.join(matched_pattern_names) if matched_pattern_names else 'unknown'}, "
        f"transaction amount={txn_attrs.get('TransactionAmt', txn_attrs.get('amount', 'unknown'))}, "
        f"risk_score={state.get('risk_score', 0.0)}"
    )
    policy_hits = graphrag.retrieve_relevant_policy(situation_text, top_k=3)
    evidence.append(
        {
            "step": "gather_evidence",
            "timestamp": _utc_now(),
            "tool": "graphrag.retrieve_relevant_policy",
            "params": {"situation_text": situation_text, "top_k": 3},
            "result_summary": (
                f"Retrieved {len(policy_hits)} relevant policy clauses. "
                + (
                    f"Top clause: {policy_hits[0].get('clause_id', 'N/A')} "
                    f"(similarity={policy_hits[0].get('similarity_score', 0.0):.3f})"
                    if policy_hits else "No policy clauses found."
                )
            ),
            "raw": policy_hits,
        }
    )

    # ── Assemble updated state ────────────────────────────────────────────
    updated = dict(state)
    updated["evidence"] = evidence
    updated["pattern_matches"] = pattern_matches
    updated["neighborhood"] = neighborhood
    updated["similar_cases"] = similar_cases
    updated["policy_hits"] = policy_hits

    logger.info(
        "[gather_evidence_node] done – %d patterns checked, %d matched, "
        "%d similar cases, %d policy hits",
        len(pattern_matches),
        sum(1 for pm in pattern_matches if pm["matched"]),
        len(similar_cases),
        len(policy_hits),
    )
    return updated  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_pattern_result(
    pattern_id: str,
    result: dict[str, Any],
) -> tuple[bool, list[Any], list[str]]:
    """
    Parse a GSQL query result dict into (matched, evidence_entities, risk_indicators).

    Conventions understood:
    - result["error"] == True → not matched (query failed)
    - result["results"] contains a list of blocks; any non-empty block → matched
    - Looks for "matched", "is_fraud", or "flagged" boolean attributes
    - Falls back to treating a non-empty results list as a match
    """
    if result.get("error"):
        return False, [], [f"Query error: {result.get('message', 'unknown')}"]

    raw_results: list[Any] = result.get("results", [])
    if not raw_results:
        return False, [], []

    evidence_entities: list[Any] = []
    risk_indicators: list[str] = []
    matched = False

    for block in raw_results:
        if not isinstance(block, dict):
            continue

        # Check for explicit boolean flags
        for flag_key in ("matched", "is_fraud", "flagged", "detected"):
            if flag_key in block:
                val = block[flag_key]
                if val is True or val == 1 or str(val).lower() == "true":
                    matched = True
                break

        # Collect entity lists under common key names
        for entity_key in ("Transactions", "transactions", "Entities", "entities",
                           "Nodes", "nodes", "result", "vertices"):
            if entity_key in block and isinstance(block[entity_key], list):
                evidence_entities.extend(block[entity_key])

        # Collect risk indicator strings
        for ri_key in ("risk_indicators", "RiskIndicators", "indicators", "flags"):
            if ri_key in block and isinstance(block[ri_key], list):
                risk_indicators.extend(str(r) for r in block[ri_key])

        # Fallback: if block has data entries and no explicit match flag, treat as matched
        if not matched and (evidence_entities or risk_indicators):
            matched = True

    # If results is non-empty but we found no entities/flags, still mark matched
    if raw_results and not matched and not evidence_entities:
        # Check if any block is non-trivially non-empty
        for block in raw_results:
            if isinstance(block, dict) and any(
                v for v in block.values() if v and v != 0 and v != ""
            ):
                matched = True
                break

    if matched and not risk_indicators:
        risk_indicators = [f"Pattern '{pattern_id}' query returned matching data"]

    return matched, evidence_entities, risk_indicators


def _count_neighborhood(results: list[Any]) -> tuple[int, int]:
    """
    Attempt to extract node and edge counts from a neighbourhood query result.
    Returns (node_count, edge_count) — both 0 if unparseable.
    """
    node_count = 0
    edge_count = 0
    for block in results:
        if not isinstance(block, dict):
            continue
        for nk in ("Nodes", "nodes", "vertices", "Vertices"):
            if nk in block and isinstance(block[nk], list):
                node_count += len(block[nk])
        for ek in ("Edges", "edges", "EdgeList", "edgelist"):
            if ek in block and isinstance(block[ek], list):
                edge_count += len(block[ek])
    return node_count, edge_count


def _utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()
