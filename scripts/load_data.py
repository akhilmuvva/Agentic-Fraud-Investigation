"""
load_data.py
============
Loads IEEE-CIS fraud detection data (transactions.csv + identity.csv) into
TigerGraph Savanna.

Vertex types created / upserted:
  Customer  – deduplicated by customer_id (hash of card1 + addr1)
  Card      – one per card1/addr1 combination
  Transaction – core transactional fields
  Device    – deduplicated device fingerprint

Edge types created / upserted:
  OWNS         Customer → Card
  USED_IN      Card     → Transaction
  FROM_DEVICE  Transaction → Device   (only where identity data exists)

Usage
-----
  python scripts/load_data.py

Environment variables (D:\\hakern\\.env):
  TG_HOST       – e.g. https://your-solution.i.tgcloud.io
  TG_GRAPH      – graph name
  TG_USERNAME   – TigerGraph username
  TG_PASSWORD   – TigerGraph password
"""

from __future__ import annotations

import hashlib
import os
import re
import sys
import time
from pathlib import Path

import pandas as pd
import numpy as np
from dotenv import load_dotenv
import pyTigerGraph as tg

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
ENV_FILE = PROJECT_ROOT / ".env"

TRANSACTIONS_CSV = DATA_DIR / "transactions.csv"
IDENTITY_CSV = DATA_DIR / "identity.csv"

CHUNK_SIZE = 5_000
PRINT_EVERY = 10_000

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_env() -> None:
    """Load .env from project root; abort if critical keys are missing."""
    if not ENV_FILE.exists():
        sys.exit(f"[ERROR] .env not found at {ENV_FILE}")
    load_dotenv(ENV_FILE)
    required = ["TG_HOST", "TG_GRAPH", "TG_USERNAME", "TG_PASSWORD"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        sys.exit(f"[ERROR] Missing env vars: {', '.join(missing)}")


def _connect() -> tg.TigerGraphConnection:
    """Return an authenticated TigerGraph connection."""
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
        print("[INFO] Connected and token obtained.")
        return conn
    except Exception as exc:
        sys.exit(f"[ERROR] Could not connect to TigerGraph: {exc}")


def _make_customer_id(card1: object, addr1: object) -> str:
    """Deterministic 5-digit hash of card1 + addr1 -> 'C{5digits}'."""
    raw = f"{card1}{addr1}"
    digest = hashlib.sha256(raw.encode()).hexdigest()
    # Take first 5 hex chars -> convert to decimal, keep last 5 digits
    num = int(digest[:8], 16) % 100_000
    return f"C{num:05d}"


def _make_card_id(customer_id: str, card1: object) -> str:
    """'{customer_id}-K{last_digit_of_card1}'."""
    card1_str = str(card1).strip()
    last_digit = card1_str[-1] if card1_str else "0"
    return f"{customer_id}-K{last_digit}"


def _slugify(text: str) -> str:
    """Lower-case alphanumeric slug (hyphens for spaces/separators)."""
    text = str(text).strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text[:50] if text else "unknown"


def _make_device_id(device_info: object, device_type: object) -> str:
    """Slug of DeviceInfo + DeviceType, or 'UNKNOWN' if both missing."""
    info = str(device_info).strip() if pd.notna(device_info) else ""
    dtype = str(device_type).strip() if pd.notna(device_type) else ""
    if not info and not dtype:
        return "UNKNOWN"
    combined = f"{info}-{dtype}".strip("-")
    return _slugify(combined)


def _safe_float(val: object, default: float = 0.0) -> float:
    """Convert value to float, returning default on NaN/None."""
    try:
        f = float(val)
        return default if np.isnan(f) else f
    except (TypeError, ValueError):
        return default


def _safe_int(val: object, default: int = 0) -> int:
    try:
        f = float(val)
        return default if np.isnan(f) else int(f)
    except (TypeError, ValueError):
        return default


def _safe_str(val: object, default: str = "") -> str:
    if pd.isna(val) if not isinstance(val, str) else False:
        return default
    s = str(val).strip()
    return s if s.lower() not in ("nan", "none", "") else default


# ---------------------------------------------------------------------------
# Batch upsert helpers
# ---------------------------------------------------------------------------

def _upsert_vertices_chunked(
    conn: tg.TigerGraphConnection,
    vertex_type: str,
    vertices: dict[str, dict],
    label: str,
) -> None:
    """Upsert a dict of {vid: attributes} in chunks."""
    items = list(vertices.items())
    total = len(items)
    uploaded = 0
    for i in range(0, total, CHUNK_SIZE):
        batch = dict(items[i : i + CHUNK_SIZE])
        try:
            conn.upsertVertices(vertex_type, [
                (vid, attrs) for vid, attrs in batch.items()
            ])
        except Exception as exc:
            print(f"  [WARN] upsert {label} chunk {i}–{i+CHUNK_SIZE} failed: {exc}")
        uploaded += len(batch)
        if uploaded % PRINT_EVERY == 0 or uploaded == total:
            print(f"  [{label}] {uploaded}/{total} upserted")


def _upsert_edges_chunked(
    conn: tg.TigerGraphConnection,
    src_type: str,
    edge_type: str,
    tgt_type: str,
    edges: list[tuple],
    label: str,
) -> None:
    """Upsert a list of (src_id, tgt_id, attrs_dict) edge tuples in chunks."""
    total = len(edges)
    uploaded = 0
    for i in range(0, total, CHUNK_SIZE):
        batch = edges[i : i + CHUNK_SIZE]
        try:
            conn.upsertEdges(src_type, edge_type, tgt_type, batch)
        except Exception as exc:
            print(f"  [WARN] upsert {label} chunk {i}–{i+CHUNK_SIZE} failed: {exc}")
        uploaded += len(batch)
        if uploaded % PRINT_EVERY == 0 or uploaded == total:
            print(f"  [{label}] {uploaded}/{total} upserted")


# ---------------------------------------------------------------------------
# Main loader
# ---------------------------------------------------------------------------

def load_data() -> None:
    _load_env()
    conn = _connect()

    # ------------------------------------------------------------------
    # 1. Read CSVs
    # ------------------------------------------------------------------
    print(f"\n[INFO] Reading {TRANSACTIONS_CSV} …")
    if not TRANSACTIONS_CSV.exists():
        sys.exit(f"[ERROR] transactions.csv not found at {TRANSACTIONS_CSV}")
    tx_df = pd.read_csv(TRANSACTIONS_CSV, low_memory=False)
    print(f"  Loaded {len(tx_df):,} transaction rows, {tx_df.shape[1]} cols")

    print(f"[INFO] Reading {IDENTITY_CSV} …")
    if not IDENTITY_CSV.exists():
        sys.exit(f"[ERROR] identity.csv not found at {IDENTITY_CSV}")
    id_df = pd.read_csv(IDENTITY_CSV, low_memory=False)
    print(f"  Loaded {len(id_df):,} identity rows, {id_df.shape[1]} cols")

    # Merge identity onto transactions (left join — identity is optional)
    print("[INFO] Merging identity data onto transactions …")
    df = tx_df.merge(id_df, on="TransactionID", how="left")
    print(f"  Merged shape: {df.shape}")

    # ------------------------------------------------------------------
    # 2. Derive IDs
    # ------------------------------------------------------------------
    print("[INFO] Deriving customer_id, card_id, device_id …")
    df["customer_id"] = df.apply(
        lambda r: _make_customer_id(r.get("card1", ""), r.get("addr1", "")), axis=1
    )
    df["card_id"] = df.apply(
        lambda r: _make_card_id(r["customer_id"], r.get("card1", "0")), axis=1
    )
    df["device_id"] = df.apply(
        lambda r: _make_device_id(r.get("DeviceInfo"), r.get("DeviceType")), axis=1
    )
    has_identity = id_df["TransactionID"].astype(str).tolist()
    df["_has_identity"] = df["TransactionID"].astype(str).isin(has_identity)

    # ------------------------------------------------------------------
    # 3. Build vertex / edge collections
    # ------------------------------------------------------------------

    # -- Customer vertices (deduplicated) --
    print("\n[STEP 1/7] Building Customer vertices …")
    customer_dict: dict[str, dict] = {}
    for _, row in df.iterrows():
        cid = row["customer_id"]
        if cid not in customer_dict:
            customer_dict[cid] = {
                "customer_id": cid,
                "card1": _safe_int(row.get("card1"), 0),
                "addr1": _safe_int(row.get("addr1"), 0),
                "addr2": _safe_int(row.get("addr2"), 0),
                "P_emaildomain": _safe_str(row.get("P_emaildomain")),
                "R_emaildomain": _safe_str(row.get("R_emaildomain")),
            }
    print(f"  Distinct customers: {len(customer_dict):,}")

    # -- Card vertices (deduplicated) --
    print("[STEP 2/7] Building Card vertices …")
    card_dict: dict[str, dict] = {}
    for _, row in df.iterrows():
        kid = row["card_id"]
        if kid not in card_dict:
            card_dict[kid] = {
                "card_id": kid,
                "card1": _safe_int(row.get("card1"), 0),
                "card2": _safe_float(row.get("card2"), 0.0),
                "card3": _safe_float(row.get("card3"), 0.0),
                "card4": _safe_str(row.get("card4")),
                "card5": _safe_float(row.get("card5"), 0.0),
                "card6": _safe_str(row.get("card6")),
                "customer_id": row["customer_id"],
            }
    print(f"  Distinct cards: {len(card_dict):,}")

    # -- Transaction vertices --
    print("[STEP 3/7] Building Transaction vertices …")
    tx_dict: dict[str, dict] = {}
    for _, row in df.iterrows():
        tid = str(_safe_int(row.get("TransactionID"), 0))
        tx_dict[tid] = {
            "TransactionID": tid,
            "TransactionDT": _safe_int(row.get("TransactionDT"), 0),
            "TransactionAmt": _safe_float(row.get("TransactionAmt"), 0.0),
            "ProductCD": _safe_str(row.get("ProductCD")),
            "dist1": _safe_float(row.get("dist1"), 0.0),
            "dist2": _safe_float(row.get("dist2"), 0.0),
            "P_emaildomain": _safe_str(row.get("P_emaildomain")),
            "R_emaildomain": _safe_str(row.get("R_emaildomain")),
            "bank_risk_score": 0.0,
            "M1": _safe_str(row.get("M1")),
            "M2": _safe_str(row.get("M2")),
            "M3": _safe_str(row.get("M3")),
            "M4": _safe_str(row.get("M4")),
            "M5": _safe_str(row.get("M5")),
            "M6": _safe_str(row.get("M6")),
            "M7": _safe_str(row.get("M7")),
            "M8": _safe_str(row.get("M8")),
            "M9": _safe_str(row.get("M9")),
            "C1": _safe_float(row.get("C1"), 0.0),
            "C2": _safe_float(row.get("C2"), 0.0),
            "C6": _safe_float(row.get("C6"), 0.0),
            "C13": _safe_float(row.get("C13"), 0.0),
            "C14": _safe_float(row.get("C14"), 0.0),
            "isFraud": _safe_int(row.get("isFraud"), 0),
            "addr1": _safe_int(row.get("addr1"), 0),
            "addr2": _safe_int(row.get("addr2"), 0),
        }
    print(f"  Distinct transactions: {len(tx_dict):,}")

    # -- Device vertices (deduplicated) --
    print("[STEP 4/7] Building Device vertices …")
    device_dict: dict[str, dict] = {}
    for _, row in df[df["_has_identity"]].iterrows():
        did = row["device_id"]
        if did not in device_dict:
            device_dict[did] = {
                "device_id": did,
                "DeviceType": _safe_str(row.get("DeviceType")),
                "DeviceInfo": _safe_str(row.get("DeviceInfo")),
            }
    print(f"  Distinct devices: {len(device_dict):,}")

    # -- OWNS edges: Customer -> Card --
    print("[STEP 5/7] Building OWNS edges …")
    owns_edges: list[tuple] = []
    seen_owns: set = set()
    for _, row in df.iterrows():
        key = (row["customer_id"], row["card_id"])
        if key not in seen_owns:
            seen_owns.add(key)
            owns_edges.append((row["customer_id"], row["card_id"], {}))
    print(f"  OWNS edges: {len(owns_edges):,}")

    # -- USED_IN edges: Card -> Transaction --
    print("[STEP 6/7] Building USED_IN edges …")
    used_in_edges: list[tuple] = []
    for _, row in df.iterrows():
        tid = str(_safe_int(row.get("TransactionID"), 0))
        used_in_edges.append((row["card_id"], tid, {}))
    print(f"  USED_IN edges: {len(used_in_edges):,}")

    # -- FROM_DEVICE edges: Transaction -> Device (identity rows only) --
    print("[STEP 7/7] Building FROM_DEVICE edges …")
    from_device_edges: list[tuple] = []
    for _, row in df[df["_has_identity"]].iterrows():
        tid = str(_safe_int(row.get("TransactionID"), 0))
        did = row["device_id"]
        from_device_edges.append((tid, did, {}))
    print(f"  FROM_DEVICE edges: {len(from_device_edges):,}")

    # ------------------------------------------------------------------
    # 4. Upsert into TigerGraph
    # ------------------------------------------------------------------
    print("\n=== Upserting into TigerGraph ===\n")

    print("[UPSERT] Customer vertices …")
    _upsert_vertices_chunked(conn, "Customer", customer_dict, "Customer")

    print("[UPSERT] Card vertices …")
    _upsert_vertices_chunked(conn, "Card", card_dict, "Card")

    print("[UPSERT] Transaction vertices …")
    _upsert_vertices_chunked(conn, "Transaction", tx_dict, "Transaction")

    print("[UPSERT] Device vertices …")
    _upsert_vertices_chunked(conn, "Device", device_dict, "Device")

    print("[UPSERT] OWNS edges (Customer→Card) …")
    _upsert_edges_chunked(conn, "Customer", "OWNS", "Card", owns_edges, "OWNS")

    print("[UPSERT] USED_IN edges (Card→Transaction) …")
    _upsert_edges_chunked(conn, "Card", "USED_IN", "Transaction", used_in_edges, "USED_IN")

    print("[UPSERT] FROM_DEVICE edges (Transaction→Device) …")
    _upsert_edges_chunked(conn, "Transaction", "FROM_DEVICE", "Device", from_device_edges, "FROM_DEVICE")

    # ------------------------------------------------------------------
    # 5. Summary
    # ------------------------------------------------------------------
    print("\n=== Load Complete ===")
    print(f"  Customers  : {len(customer_dict):>10,}")
    print(f"  Cards      : {len(card_dict):>10,}")
    print(f"  Transactions: {len(tx_dict):>10,}")
    print(f"  Devices    : {len(device_dict):>10,}")
    print(f"  OWNS       : {len(owns_edges):>10,}")
    print(f"  USED_IN    : {len(used_in_edges):>10,}")
    print(f"  FROM_DEVICE: {len(from_device_edges):>10,}")


if __name__ == "__main__":
    start = time.time()
    load_data()
    elapsed = time.time() - start
    print(f"\n[INFO] Total runtime: {elapsed:.1f}s")
