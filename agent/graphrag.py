"""
agent/graphrag.py
-----------------
GraphRAG retrieval functions for the Fraud Investigation agent.

These functions bridge the embedding space (Google text-embedding-004)
with TigerGraph stored vectors to retrieve:
- Relevant policy clauses for the current case situation
- Similar historical investigation cases

Public API
----------
retrieve_relevant_policy(situation_text, top_k=3) -> list[dict]
retrieve_similar_cases(case_summary, top_k=3) -> list[dict]
format_policy_context(clauses) -> str
format_case_context(cases) -> str
"""

from __future__ import annotations

import logging
import math
import os
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

from agent import tg_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Embedding client setup
# ---------------------------------------------------------------------------

_EMBED_MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])


def _embed(text: str) -> list[float]:
    """
    Return a dense embedding vector for *text* using Google text-embedding-004.

    Parameters
    ----------
    text : str
        The text to embed. Truncated to 2 048 characters to stay within
        the model's token budget.

    Returns
    -------
    list[float]
        768-dimensional embedding vector. Returns an empty list on failure.
    """
    try:
        response = genai.embed_content(
            model=_EMBED_MODEL,
            content=text[:2048],
            task_type="RETRIEVAL_QUERY",
        )
        return response["embedding"]
    except Exception as exc:
        logger.error("Embedding call failed: %s", exc)
        return []


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Compute cosine similarity between two equal-length vectors.

    Returns 0.0 if either vector is empty or they have different lengths.
    """
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ---------------------------------------------------------------------------
# Public retrieval functions
# ---------------------------------------------------------------------------


def retrieve_relevant_policy(
    situation_text: str,
    top_k: int = 3,
) -> list[dict[str, Any]]:
    """
    Retrieve the most relevant policy clauses for a given case situation.

    Embeds *situation_text* with text-embedding-004, then computes cosine
    similarity against the embedding of each PolicyClause vertex stored in
    TigerGraph. Falls back to fetching all clauses and doing local ranking
    if no vector-search installed query is available.

    Parameters
    ----------
    situation_text : str
        A natural-language description of the case situation
        (e.g. trigger text + pattern summary).
    top_k : int, optional
        Number of top clauses to return (default 3).

    Returns
    -------
    list[dict]
        Up to *top_k* dicts, each containing::

            {
                "clause_id": str,
                "clause_text": str,
                "action_required": str,
                "similarity_score": float
            }

        Sorted by similarity_score descending. Returns an empty list on
        failure or if no clauses exist in the graph.
    """
    query_embedding = _embed(situation_text)
    if not query_embedding:
        logger.warning("retrieve_relevant_policy: embedding failed, returning empty")
        return []

    # First try the installed vector-search query
    result = tg_client.run_gsql_query(
        "find_similar_policy_clauses",
        params={"query_embedding": query_embedding, "top_k": top_k},
    )

    if not result.get("error") and result.get("results"):
        clauses: list[dict[str, Any]] = []
        for block in result["results"]:
            for key in ("SimilarClauses", "similar_clauses", "result"):
                if key in block:
                    for item in block[key]:
                        attrs = item.get("attributes", item)
                        clauses.append(
                            {
                                "clause_id": attrs.get("clause_id", item.get("v_id", "")),
                                "clause_text": attrs.get("clause_text", ""),
                                "action_required": attrs.get("action_required", ""),
                                "similarity_score": float(
                                    attrs.get("similarity_score", 0.0)
                                ),
                            }
                        )
        return sorted(clauses, key=lambda c: c["similarity_score"], reverse=True)[:top_k]

    # Fallback: fetch all clauses and rank locally
    logger.info(
        "retrieve_relevant_policy: vector query unavailable, falling back to local ranking"
    )
    all_clauses = tg_client.get_policy_clauses()
    scored: list[dict[str, Any]] = []
    for clause in all_clauses:
        clause_emb = clause.get("embedding", [])
        if clause_emb:
            sim = _cosine_similarity(query_embedding, clause_emb)
        else:
            # If no stored embedding, embed the clause text on-the-fly
            clause_emb = _embed(clause.get("clause_text", ""))
            sim = _cosine_similarity(query_embedding, clause_emb)

        scored.append(
            {
                "clause_id": clause["clause_id"],
                "clause_text": clause["clause_text"],
                "action_required": clause["action_required"],
                "similarity_score": sim,
            }
        )

    return sorted(scored, key=lambda c: c["similarity_score"], reverse=True)[:top_k]


def retrieve_similar_cases(
    case_summary: str,
    top_k: int = 3,
) -> list[dict[str, Any]]:
    """
    Retrieve the most similar historical investigation cases via GraphRAG.

    Embeds *case_summary* and delegates to
    :func:`tg_client.find_similar_cases` which runs the installed
    ``find_similar_cases_by_embedding`` GSQL query.

    Parameters
    ----------
    case_summary : str
        A concise natural-language summary of the current case
        (trigger, patterns suspected, key facts).
    top_k : int, optional
        Number of similar cases to return (default 3).

    Returns
    -------
    list[dict]
        Up to *top_k* dicts, each containing::

            {
                "case_id": str,
                "outcome": str,
                "pattern": str,
                "actions_taken": list[str],
                "analyst_notes": str,
                "similarity_score": float
            }

        Sorted by similarity_score descending. Returns an empty list on
        failure or if the graph contains no prior cases.
    """
    query_embedding = _embed(case_summary)
    if not query_embedding:
        logger.warning("retrieve_similar_cases: embedding failed, returning empty")
        return []

    cases = tg_client.find_similar_cases(query_embedding, top_k=top_k)
    return sorted(cases, key=lambda c: c.get("similarity_score", 0.0), reverse=True)


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------


def format_policy_context(clauses: list[dict[str, Any]]) -> str:
    """
    Format a list of policy clause dicts into a structured string suitable
    for inclusion in an LLM prompt.

    Parameters
    ----------
    clauses : list[dict]
        Policy clause dicts as returned by :func:`retrieve_relevant_policy`.

    Returns
    -------
    str
        Formatted multi-line string. Returns a sentinel string if *clauses*
        is empty so the prompt remains coherent.

    Example output
    --------------
    ::

        Policy Clause PC-01 (similarity: 0.92)
          Text   : Transactions above $5,000 with confirmed fraud pattern must be reported.
          Action : FILE_REPORT

        Policy Clause PC-07 (similarity: 0.78)
          ...
    """
    if not clauses:
        return "No relevant policy clauses found in the knowledge base."

    lines: list[str] = []
    for i, clause in enumerate(clauses, start=1):
        lines.append(
            f"Policy Clause {clause.get('clause_id', f'#{i}')} "
            f"(similarity: {clause.get('similarity_score', 0.0):.3f})"
        )
        lines.append(f"  Text   : {clause.get('clause_text', 'N/A')}")
        lines.append(f"  Action : {clause.get('action_required', 'N/A')}")
        lines.append("")

    return "\n".join(lines).rstrip()


def format_case_context(cases: list[dict[str, Any]]) -> str:
    """
    Format a list of similar-case dicts into a structured string suitable
    for inclusion in an LLM prompt.

    Parameters
    ----------
    cases : list[dict]
        Similar case dicts as returned by :func:`retrieve_similar_cases`.

    Returns
    -------
    str
        Formatted multi-line string. Returns a sentinel string if *cases*
        is empty so the prompt remains coherent.

    Example output
    --------------
    ::

        Similar Case CASE-0042 (similarity: 0.88)
          Pattern  : card_not_present_fraud
          Outcome  : FRAUD_CONFIRMED
          Actions  : BLOCK_CARD, FILE_REPORT, CREATE_CASE
          Notes    : Customer confirmed they did not authorise the transaction.

        Similar Case CASE-0017 (similarity: 0.71)
          ...
    """
    if not cases:
        return "No similar prior cases found in the knowledge base."

    lines: list[str] = []
    for i, case in enumerate(cases, start=1):
        actions = case.get("actions_taken", [])
        if isinstance(actions, list):
            actions_str = ", ".join(actions) if actions else "None recorded"
        else:
            actions_str = str(actions)

        lines.append(
            f"Similar Case {case.get('case_id', f'#{i}')} "
            f"(similarity: {case.get('similarity_score', 0.0):.3f})"
        )
        lines.append(f"  Pattern  : {case.get('pattern', 'N/A')}")
        lines.append(f"  Outcome  : {case.get('outcome', 'N/A')}")
        lines.append(f"  Actions  : {actions_str}")
        lines.append(f"  Notes    : {case.get('analyst_notes', 'N/A')}")
        lines.append("")

    return "\n".join(lines).rstrip()
