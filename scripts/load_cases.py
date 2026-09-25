"""
load_cases.py
=============
Loads closed case history and fraud pattern / policy definitions into
TigerGraph Savanna.

Vertex types upserted:
  FraudPattern   – one per known pattern (5 total)
  PolicyClause   – compliance rules (4 total)
  Case           – one per closed case in the CSV

Edge types upserted:
  INVOLVED_IN    Customer  → Case
  INVOLVES_TX    Case      → Transaction
  CITES_PATTERN  Case      → FraudPattern

Input CSV:
  D:\\hakern\\data\\closed_cases_history.csv
  Columns: case_id, customer_id, card_id, opened_at, closed_at, outcome,
            pattern, first_fraud_txn_id, txn_ids, n_txns, exposure_usd,
            connected_card_ids, actions_taken, report_filed, analyst_notes

Usage
-----
  python scripts/load_cases.py

Environment variables (D:\\hakern\\.env):
  TG_HOST, TG_GRAPH, TG_USERNAME, TG_PASSWORD
"""

from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
import pyTigerGraph as tg

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
ENV_FILE = PROJECT_ROOT / ".env"

CASES_CSV = DATA_DIR / "closed_cases_history.csv"

CHUNK_SIZE = 500

# ---------------------------------------------------------------------------
# Known fraud patterns and policy clauses
# ---------------------------------------------------------------------------

FRAUD_PATTERNS: list[dict] = [
    {
        "pattern_id": "card_not_present_fraud",
        "pattern_name": "Card-Not-Present Fraud",
        "description": "Card-Not-Present Fraud — online transaction with identity mismatch flags",
    },
    {
        "pattern_id": "account_takeover",
        "pattern_name": "Account Takeover",
        "description": "Account Takeover — new device + unusual purchase pattern post-login change",
    },
    {
        "pattern_id": "card_not_present_new_device",
        "pattern_name": "CNP + New Device",
        "description": "CNP + New Device — online purchase from first-seen device on this card",
    },
    {
        "pattern_id": "out_of_region_use",
        "pattern_name": "Out-of-Region Use",
        "description": "Out-of-Region Use — billing region statistically anomalous for cardholder",
    },
    {
        "pattern_id": "card_testing",
        "pattern_name": "Card Testing",
        "description": "Card Testing — probe low-value transactions preceding high-value attack",
    },
]

POLICY_CLAUSES: list[dict] = [
    {
        "clause_id": "PC-01",
        "clause_text": "FILE_REPORT required when confirmed_fraud AND exposure_usd >= 5000",
        "action_required": "FILE_REPORT",
        "threshold": 5000.0,
        "clause_embedding": [],
    },
    {
        "clause_id": "PC-02",
        "clause_text": "BLOCK_CARD required immediately on confirmed_fraud",
        "action_required": "BLOCK_CARD",
        "threshold": 0.0,
        "clause_embedding": [],
    },
    {
        "clause_id": "PC-03",
        "clause_text": "VERIFY_WITH_CUSTOMER required for risk_score triggers before blocking",
        "action_required": "VERIFY_WITH_CUSTOMER",
        "threshold": 0.0,
        "clause_embedding": [],
    },
    {
        "clause_id": "PC-04",
        "clause_text": "ESCALATE to senior analyst if account_takeover pattern and exposure > 10000",
        "action_required": "ESCALATE",
        "threshold": 10000.0,
        "clause_embedding": [],
    },
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_env() -> None:
    if not ENV_FILE.exists():
        sys.exit(f"[ERROR] .env not found at {ENV_FILE}")
    load_dotenv(ENV_FILE)
    if not os.getenv("TG_HOST"):
        sys.exit("[ERROR] Missing env var: TG_HOST")
    if not os.getenv("TG_SECRET") and not os.getenv("TG_PASSWORD"):
        sys.exit("[ERROR] Missing authentication: either TG_SECRET or TG_PASSWORD must be set")


def _connect() -> tg.TigerGraphConnection:
    host = os.environ["TG_HOST"].rstrip("/")
    graph = os.environ.get("TG_GRAPH", "FraudInvestigation")
    username = os.environ.get("TG_USERNAME", "tigergraph")
    password = os.environ.get("TG_PASSWORD", "")
    secret = os.environ.get("TG_SECRET", "")

    print(f"[INFO] Connecting to TigerGraph at {host}, graph={graph} …")
    try:
        conn = tg.TigerGraphConnection(
            host=host,
            graphname=graph,
            username=username if not secret else None,
            password=password if not secret else None,
            gsqlSecret=secret if secret else None,
            tgCloud=True,
        )
        if secret:
            conn.getToken(secret)
        else:
            conn.getToken(conn.createSecret())
        print("[INFO] Connected and token obtained.")
        return conn
    except Exception as exc:
        sys.exit(f"[ERROR] Could not connect to TigerGraph: {exc}")


def _safe_str(val: object, default: str = "") -> str:
    if val is None:
        return default
    try:
        if pd.isna(val):
            return default
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return s if s.lower() not in ("nan", "none", "") else default


def _safe_float(val: object, default: float = 0.0) -> float:
    try:
        import numpy as np
        f = float(val)
        return default if np.isnan(f) else f
    except (TypeError, ValueError):
        return default


def _safe_int(val: object, default: int = 0) -> int:
    try:
        import numpy as np
        f = float(val)
        return default if np.isnan(f) else int(f)
    except (TypeError, ValueError):
        return default


def _parse_txn_ids(raw: object) -> list[str]:
    """Parse pipe- or comma-separated transaction IDs into a list of strings."""
    s = _safe_str(raw)
    if not s:
        return []
    # split on pipe or comma, strip whitespace
    parts = re.split(r"[|,]", s)
    return [p.strip() for p in parts if p.strip()]


def _upsert_vertices_chunked(
    conn: tg.TigerGraphConnection,
    vertex_type: str,
    vertices: list[tuple],
    label: str,
) -> None:
    """vertices: list of (vid, attr_dict)."""
    total = len(vertices)
    for i in range(0, total, CHUNK_SIZE):
        batch = vertices[i : i + CHUNK_SIZE]
        try:
            conn.upsertVertices(vertex_type, batch)
        except Exception as exc:
            print(f"  [WARN] upsert {label} chunk {i}–{i+CHUNK_SIZE} failed: {exc}")
    print(f"  [{label}] {total} upserted")


def _upsert_edges_chunked(
    conn: tg.TigerGraphConnection,
    src_type: str,
    edge_type: str,
    tgt_type: str,
    edges: list[tuple],
    label: str,
) -> None:
    """edges: list of (src_id, tgt_id, attr_dict)."""
    total = len(edges)
    for i in range(0, total, CHUNK_SIZE):
        batch = edges[i : i + CHUNK_SIZE]
        try:
            conn.upsertEdges(src_type, edge_type, tgt_type, batch)
        except Exception as exc:
            print(f"  [WARN] upsert {label} chunk {i}–{i+CHUNK_SIZE} failed: {exc}")
    print(f"  [{label}] {total} upserted")


# ---------------------------------------------------------------------------
# Main loader
# ---------------------------------------------------------------------------

def load_cases() -> None:
    _load_env()
    conn = _connect()

    # ------------------------------------------------------------------
    # 1. Upsert FraudPattern vertices
    # ------------------------------------------------------------------
    print("\n[STEP 1/6] Upserting FraudPattern vertices ...")
    fp_vertices = [
        (
            fp["pattern_id"],
            {
                "pattern_id": fp["pattern_id"],
                "pattern_name": fp["pattern_name"],
                "description": fp["description"],
                "gsql_query": f"detect_{fp['pattern_id']}" if not fp['pattern_id'].startswith("detect_") else fp['pattern_id'],
            },
        )
        for fp in FRAUD_PATTERNS
    ]
    _upsert_vertices_chunked(conn, "FraudPattern", fp_vertices, "FraudPattern")

    # ------------------------------------------------------------------
    # 2. Upsert PolicyClause vertices
    # ------------------------------------------------------------------
    print("[STEP 2/6] Upserting PolicyClause vertices ...")
    pc_vertices = [
        (
            pc["clause_id"],
            {
                "clause_id": pc["clause_id"],
                "clause_text": pc["clause_text"],
                "action_required": pc["action_required"],
                "threshold": pc["threshold"],
                "clause_embedding": [],
            },
        )
        for pc in POLICY_CLAUSES
    ]
    _upsert_vertices_chunked(conn, "PolicyClause", pc_vertices, "PolicyClause")

    # ------------------------------------------------------------------
    # 3. Read closed cases CSV
    # ------------------------------------------------------------------
    print(f"[STEP 3/6] Reading {CASES_CSV} ...")
    if not CASES_CSV.exists():
        sys.exit(f"[ERROR] closed_cases_history.csv not found at {CASES_CSV}")
    df = pd.read_csv(CASES_CSV, low_memory=False)
    print(f"  Loaded {len(df):,} rows, {df.shape[1]} cols")

    # ------------------------------------------------------------------
    # 4. Upsert Cases vertices
    # ------------------------------------------------------------------
    print("[STEP 4/6] Upserting Cases vertices ...")
    case_vertices: list[tuple] = []
    for _, row in df.iterrows():
        case_id = _safe_str(row.get("case_id"))
        if not case_id:
            continue
        case_vertices.append((
            case_id,
            {
                "case_id": case_id,
                "trigger_type": "historical_batch",
                "trigger_text": f"Historical case {case_id}",
                "status": "closed",
                "outcome": _safe_str(row.get("outcome")),
                "pattern_matched": _safe_str(row.get("pattern")),
                "confidence_score": 1.0,
                "summary_text": _safe_str(row.get("analyst_notes"))[:1024],
                "summary_embedding": [],  # filled later by embed_cases.py
                "next_action_before": _safe_str(row.get("actions_taken"))[:1024],
                "next_action_after": _safe_str(row.get("actions_taken"))[:1024],
                "exposure_usd": _safe_float(row.get("exposure_usd"), 0.0),
                "sar_required": 1 if _safe_int(row.get("report_filed"), 0) else 0,
            },
        ))
    _upsert_vertices_chunked(conn, "Cases", case_vertices, "Cases")

    # ------------------------------------------------------------------
    # 5. Build and upsert edges
    # ------------------------------------------------------------------
    print("[STEP 5/6] Building edges ...")

    involved_in_edges: list[tuple] = []  # Customer -> Cases
    involves_tx_edges: list[tuple] = []  # Cases -> Transaction
    cites_pattern_edges: list[tuple] = []  # Cases -> FraudPattern

    valid_patterns = {fp["pattern_id"] for fp in FRAUD_PATTERNS}

    for _, row in df.iterrows():
        case_id = _safe_str(row.get("case_id"))
        if not case_id:
            continue

        # INVOLVED_IN: Customer -> Cases
        customer_id = _safe_str(row.get("customer_id"))
        if customer_id:
            involved_in_edges.append((customer_id, case_id, {}))

        # INVOLVES_TX: Cases -> Transaction (for each txn in txn_ids)
        txn_ids = _parse_txn_ids(row.get("txn_ids"))
        for tid in txn_ids:
            involves_tx_edges.append((case_id, tid, {}))

        # Also add first_fraud_txn_id if not already in list
        first_tid = _safe_str(row.get("first_fraud_txn_id"))
        if first_tid and first_tid not in txn_ids:
            involves_tx_edges.append((case_id, first_tid, {}))

        # CITES_PATTERN: Cases -> FraudPattern
        pattern_id = _safe_str(row.get("pattern"))
        if pattern_id in valid_patterns:
            cites_pattern_edges.append((case_id, pattern_id, {}))

    print(f"  INVOLVED_IN edges : {len(involved_in_edges):,}")
    print(f"  INVOLVES_TX edges : {len(involves_tx_edges):,}")
    print(f"  CITES_PATTERN edges: {len(cites_pattern_edges):,}")

    print("[STEP 6/6] Upserting edges ...")

    print("  Upserting INVOLVED_IN (Customer->Cases) ...")
    _upsert_edges_chunked(
        conn, "Customer", "INVOLVED_IN", "Cases", involved_in_edges, "INVOLVED_IN"
    )

    print("  Upserting INVOLVES_TX (Cases->Transaction) ...")
    _upsert_edges_chunked(
        conn, "Cases", "INVOLVES_TX", "Transaction", involves_tx_edges, "INVOLVES_TX"
    )

    print("  Upserting CITES_PATTERN (Cases->FraudPattern) ...")
    _upsert_edges_chunked(
        conn, "Cases", "CITES_PATTERN", "FraudPattern", cites_pattern_edges, "CITES_PATTERN"
    )

    # ------------------------------------------------------------------
    # 6. Summary
    # ------------------------------------------------------------------
    print("\n=== load_cases Complete ===")
    print(f"  FraudPattern vertices : {len(FRAUD_PATTERNS)}")
    print(f"  PolicyClause vertices : {len(POLICY_CLAUSES)}")
    print(f"  Case vertices         : {len(case_vertices):,}")
    print(f"  INVOLVED_IN edges     : {len(involved_in_edges):,}")
    print(f"  INVOLVES_TX edges     : {len(involves_tx_edges):,}")
    print(f"  CITES_PATTERN edges   : {len(cites_pattern_edges):,}")


if __name__ == "__main__":
    start = time.time()
    load_cases()
    elapsed = time.time() - start
    print(f"\n[INFO] Total runtime: {elapsed:.1f}s")
