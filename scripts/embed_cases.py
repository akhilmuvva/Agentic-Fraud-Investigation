"""
embed_cases.py
==============
Embeds closed case summaries and policy clause texts using Google's
text-embedding-004 model, then upserts the resulting embedding vectors
back into TigerGraph as vertex attributes.

Target vertex types and attributes:
  Case         → summary_embedding (LIST<DOUBLE>)
  PolicyClause → clause_embedding  (LIST<DOUBLE>)

Logic
-----
1. Load .env from project root; connect to TigerGraph and Google AI.
2. Fetch Case vertices where summary_embedding is empty / zero-length.
3. For each Case, build a human-readable summary_text, call the
   text-embedding-004 API, then upsert the embedding vector.
4. Fetch PolicyClause vertices where clause_embedding is empty.
5. Embed each clause_text, upsert the vector.
6. Both loops process records in batches of 20 with a 1 s sleep between
   batches to stay well within the Google AI free-tier rate limit.

Usage
-----
  python scripts/embed_cases.py

Environment variables (D:\\hakern\\.env):
  TG_HOST, TG_GRAPH, TG_USERNAME, TG_PASSWORD
  GOOGLE_API_KEY
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv
import pyTigerGraph as tg

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

EMBEDDING_MODEL = "models/text-embedding-004"
BATCH_SIZE = 20          # embeddings per API call batch
SLEEP_BETWEEN_BATCHES = 1.0  # seconds

# An embedding is considered "empty" if it has fewer than this many dimensions.
MIN_EMBEDDING_DIMS = 10

# ---------------------------------------------------------------------------
# Helpers — environment / connection
# ---------------------------------------------------------------------------

def _load_env() -> None:
    if not ENV_FILE.exists():
        sys.exit(f"[ERROR] .env not found at {ENV_FILE}")
    load_dotenv(ENV_FILE)
    required_tg = ["TG_HOST", "TG_GRAPH", "TG_USERNAME", "TG_PASSWORD"]
    required_ai = ["GOOGLE_API_KEY"]
    missing = [k for k in required_tg + required_ai if not os.getenv(k)]
    if missing:
        sys.exit(f"[ERROR] Missing env vars: {', '.join(missing)}")


def _connect_tg() -> tg.TigerGraphConnection:
    host = os.environ["TG_HOST"].rstrip("/")
    graph = os.environ["TG_GRAPH"]
    username = os.environ["TG_USERNAME"]
    password = os.environ["TG_PASSWORD"]

    print(f"[INFO] Connecting to TigerGraph at {host}, graph={graph} …")
    try:
        conn = tg.TigerGraphConnection(
            host=host,
            graphname=graph,
            username=username,
            password=password,
        )
        conn.getToken(conn.createSecret())
        print("[INFO] TigerGraph: connected.")
        return conn
    except Exception as exc:
        sys.exit(f"[ERROR] TigerGraph connection failed: {exc}")


def _configure_google_ai() -> None:
    api_key = os.environ["GOOGLE_API_KEY"]
    genai.configure(api_key=api_key)
    print("[INFO] Google AI SDK configured.")


# ---------------------------------------------------------------------------
# Helpers — embedding
# ---------------------------------------------------------------------------

def _embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a list of texts using text-embedding-004.
    Returns a list of float vectors, one per input text.
    Retries once on transient failures.
    """
    try:
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=texts,
            task_type="RETRIEVAL_DOCUMENT",
        )
        # result["embedding"] is a list of vectors when content is a list
        embeddings = result["embedding"]
        return embeddings
    except Exception as exc:
        print(f"  [WARN] Embedding call failed: {exc}. Retrying in 5 s …")
        time.sleep(5)
        try:
            result = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=texts,
                task_type="RETRIEVAL_DOCUMENT",
            )
            return result["embedding"]
        except Exception as exc2:
            print(f"  [ERROR] Embedding retry also failed: {exc2}")
            # Return zero vectors so the batch doesn't block progress
            return [[] for _ in texts]


# ---------------------------------------------------------------------------
# Helpers — TigerGraph fetch / upsert
# ---------------------------------------------------------------------------

def _fetch_vertices_needing_embedding(
    conn: tg.TigerGraphConnection,
    vertex_type: str,
    embedding_attr: str,
) -> list[dict[str, Any]]:
    """
    Return all vertices of vertex_type whose embedding_attr is empty.
    Uses getVertices and filters client-side (works without GSQL query auth).
    """
    try:
        all_verts = conn.getVertices(vertex_type)
    except Exception as exc:
        print(f"  [WARN] Could not fetch {vertex_type} vertices: {exc}")
        return []

    needs_embedding: list[dict] = []
    for v in all_verts:
        attrs = v.get("attributes", {})
        emb = attrs.get(embedding_attr, [])
        # Treat as empty if it's None, empty list, or all-zero short list
        if not emb or len(emb) < MIN_EMBEDDING_DIMS:
            needs_embedding.append(v)
    return needs_embedding


def _upsert_embedding(
    conn: tg.TigerGraphConnection,
    vertex_type: str,
    vertex_id: str,
    embedding_attr: str,
    vector: list[float],
) -> None:
    try:
        conn.upsertVertex(
            vertex_type,
            vertex_id,
            {embedding_attr: vector},
        )
    except Exception as exc:
        print(f"  [WARN] Failed to upsert embedding for {vertex_type}/{vertex_id}: {exc}")


# ---------------------------------------------------------------------------
# Case embeddings
# ---------------------------------------------------------------------------

def _build_case_summary(attrs: dict[str, Any]) -> str:
    """Build a human-readable summary string from a Case vertex's attributes."""
    parts = [
        f"Case ID: {attrs.get('case_id', 'N/A')}",
        f"Outcome: {attrs.get('outcome', 'N/A')}",
        f"Pattern: {attrs.get('pattern', 'N/A')}",
        f"Exposure USD: {attrs.get('exposure_usd', 0.0):.2f}",
        f"Actions taken: {attrs.get('actions_taken', 'N/A')}",
        f"Analyst notes: {attrs.get('analyst_notes', 'N/A')}",
    ]
    return " | ".join(parts)


def embed_cases(conn: tg.TigerGraphConnection) -> None:
    print("\n[CASES] Fetching Case vertices that need embeddings …")
    cases = _fetch_vertices_needing_embedding(conn, "Case", "summary_embedding")
    print(f"  Found {len(cases):,} Case vertices to embed.")

    total_done = 0
    for batch_start in range(0, len(cases), BATCH_SIZE):
        batch = cases[batch_start : batch_start + BATCH_SIZE]

        # Build texts
        texts = []
        vertex_ids = []
        for v in batch:
            vid = v.get("v_id", "")
            attrs = v.get("attributes", {})
            summary_text = _build_case_summary(attrs)
            texts.append(summary_text)
            vertex_ids.append(vid)

        # Embed
        vectors = _embed_texts(texts)

        # Upsert each embedding
        for vid, vector in zip(vertex_ids, vectors):
            if vector:
                _upsert_embedding(conn, "Case", vid, "summary_embedding", vector)

        total_done += len(batch)
        print(f"  [Cases] {total_done}/{len(cases)} embedded", end="\r")
        time.sleep(SLEEP_BETWEEN_BATCHES)

    print(f"\n  [Cases] Done. {total_done} embeddings upserted.")


# ---------------------------------------------------------------------------
# PolicyClause embeddings
# ---------------------------------------------------------------------------

def embed_policy_clauses(conn: tg.TigerGraphConnection) -> None:
    print("\n[POLICY] Fetching PolicyClause vertices that need embeddings …")
    clauses = _fetch_vertices_needing_embedding(conn, "PolicyClause", "clause_embedding")
    print(f"  Found {len(clauses):,} PolicyClause vertices to embed.")

    total_done = 0
    for batch_start in range(0, len(clauses), BATCH_SIZE):
        batch = clauses[batch_start : batch_start + BATCH_SIZE]

        texts = []
        vertex_ids = []
        for v in batch:
            vid = v.get("v_id", "")
            attrs = v.get("attributes", {})
            clause_text = str(attrs.get("clause_text", "")).strip()
            # Enrich with action and threshold for richer embedding
            action = attrs.get("action_required", "")
            threshold = attrs.get("threshold", 0.0)
            enriched = (
                f"Policy clause: {clause_text} "
                f"Action: {action} "
                f"Threshold: {threshold}"
            )
            texts.append(enriched)
            vertex_ids.append(vid)

        vectors = _embed_texts(texts)

        for vid, vector in zip(vertex_ids, vectors):
            if vector:
                _upsert_embedding(conn, "PolicyClause", vid, "clause_embedding", vector)

        total_done += len(batch)
        print(f"  [PolicyClause] {total_done}/{len(clauses)} embedded", end="\r")
        time.sleep(SLEEP_BETWEEN_BATCHES)

    print(f"\n  [PolicyClause] Done. {total_done} embeddings upserted.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    _load_env()
    _configure_google_ai()
    conn = _connect_tg()

    embed_cases(conn)
    embed_policy_clauses(conn)

    print("\n=== embed_cases.py Complete ===")


if __name__ == "__main__":
    start = time.time()
    main()
    elapsed = time.time() - start
    print(f"[INFO] Total runtime: {elapsed:.1f}s")
