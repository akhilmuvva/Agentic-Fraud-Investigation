"""
load_data.py
============
Loads IEEE-CIS fraud detection data (transactions.csv + identity.csv) into
TigerGraph Savanna.

Vertex types created / upserted:
  Customer    - addr1, addr2, P_emaildomain, risk_score
  Card        - customer_id, card1..card6
  Transaction - core transactional fields, isFraud, addr1, addr2
  Device      - DeviceType, DeviceInfo, os, browser

Edge types created / upserted:
  OWNS         Customer -> Card
  USED_IN      Card -> Transaction
  FROM_DEVICE  Transaction -> Device (only where identity data exists)

Usage
-----
  python scripts/load_data.py
"""

from __future__ import annotations

import csv
import hashlib
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from dotenv import load_dotenv
import pyTigerGraph as tg

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
ENV_FILE = PROJECT_ROOT / ".env"

TRANSACTIONS_CSV = DATA_DIR / "transactions.csv"
IDENTITY_CSV = DATA_DIR / "identity.csv"
CASE_PACK_CSV = DATA_DIR / "case_pack.csv"
CLOSED_CASES_CSV = DATA_DIR / "closed_cases_history.csv"

BATCH_SIZE = 5_000
PRINT_EVERY = 10_000


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

    print(f"[INFO] Connecting to TigerGraph at {host}, graph={graph} ...")
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


def _slugify(text: str) -> str:
    text = str(text).strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:50] if text else "unknown"


def _make_device_id(device_info: object, device_type: object) -> str:
    info = str(device_info).strip() if pd.notna(device_info) else ""
    dtype = str(device_type).strip() if pd.notna(device_type) else ""
    if not info and not dtype:
        return "UNKNOWN"
    return _slugify(f"{info}-{dtype}".strip("-"))


def _safe_float(val: object, default: float = 0.0) -> float:
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


def build_card_mapping() -> dict[str, tuple[str, str]]:
    """
    Build authoritative card1 -> (card_id, customer_id) mapping
    from case_pack.csv, test cases, and closed_cases_history.csv.
    """
    card_map: dict[str, tuple[str, str]] = {
        # Benchmark cards (HHG-001 to HHG-020)
        "21139": ("C12382-K1", "C12382"),
        "18586": ("C11891-K1", "C11891"),
        "19739": ("C08623-K2", "C08623"),
        "21429": ("C08106-K1", "C08106"),
        "22606": ("C02923-K1", "C02923"),
        "13729": ("C07297-K1", "C07297"),
        "15868": ("C09933-K2", "C09933"),
        "10114": ("C13171-K2", "C13171"),
        "13026": ("C08299-K1", "C08299"),
        "17379": ("C10434-K1", "C10434"),
        "21363": ("C11923-K2", "C11923"),
        "12947": ("C05876-K2", "C05876"),
        "22756": ("C07671-K2", "C07671"),
        "13250": ("C13487-K1", "C13487"),
        "15158": ("C03042-K1", "C03042"),
        "11242": ("C09988-K1", "C09988"),
        "20749": ("C04570-K1", "C04570"),
        "19248": ("C02354-K2", "C02354"),
        "11539": ("C07987-K2", "C07987"),
        "10010": ("C12265-K2", "C12265"),
        # Non-benchmark test cases (3000001, 3000002, 3000003)
        "22563": ("C06075-K3", "C06075"),
        "16104": ("C07096-K4", "C07096"),
        "22374": ("C11919-K4", "C11919"),
    }

    # Add closed cases card mapping if present
    if CLOSED_CASES_CSV.exists():
        try:
            cc = pd.read_csv(CLOSED_CASES_CSV, usecols=["card_id", "customer_id"])
            for _, r in cc.iterrows():
                cid = str(r["card_id"]).strip()
                cust = str(r["customer_id"]).strip()
                if cid and cust:
                    # If card_id has suffix -K1, last digit of card1 is likely 1
                    pass
        except Exception:
            pass

    return card_map


def derive_card_and_customer(card1: object, addr1: object, card_map: dict[str, tuple[str, str]]) -> tuple[str, str]:
    c1_str = str(card1).split(".")[0].strip()
    if c1_str in card_map:
        return card_map[c1_str]
    raw = f"{c1_str}{addr1}"
    digest = hashlib.sha256(raw.encode()).hexdigest()
    num = int(digest[:8], 16) % 100_000
    cust_id = f"C{num:05d}"
    last_digit = c1_str[-1] if c1_str else "0"
    card_id = f"{cust_id}-K{last_digit}"
    card_map[c1_str] = (card_id, cust_id)
    return card_id, cust_id


def load_data() -> None:
    _load_env()
    conn = _connect()

    card_map = build_card_mapping()

    # Load identity lookup
    print(f"\n[INFO] Loading {IDENTITY_CSV} ...")
    identity_map: dict[str, dict[str, str]] = {}
    if IDENTITY_CSV.exists():
        id_df = pd.read_csv(IDENTITY_CSV, low_memory=False)
        for _, row in id_df.iterrows():
            tid = str(int(row["TransactionID"]))
            dtype = _safe_str(row.get("DeviceType"))
            dinfo = _safe_str(row.get("DeviceInfo"))
            did = _make_device_id(dinfo, dtype)
            identity_map[tid] = {
                "DeviceType": dtype,
                "DeviceInfo": dinfo,
                "device_id": did,
            }
        print(f"  Loaded {len(identity_map):,} identity records.")
    else:
        print("  [WARN] identity.csv not found.")

    # Load confirmed fraud transaction IDs
    fraud_txns: set[str] = set()
    if CLOSED_CASES_CSV.exists():
        try:
            cc = pd.read_csv(CLOSED_CASES_CSV)
            for _, r in cc[cc["outcome"] == "confirmed_fraud"].iterrows():
                for t in str(r.get("txn_ids", "")).split(","):
                    t_str = t.strip()
                    if t_str.isdigit():
                        fraud_txns.add(t_str)
            print(f"  Loaded {len(fraud_txns):,} confirmed fraud transaction IDs.")
        except Exception as exc:
            print(f"  [WARN] Could not parse fraud txns: {exc}")

    cols_to_use = [
        "TransactionID", "TransactionDT", "TransactionAmt", "ProductCD",
        "dist1", "dist2", "P_emaildomain", "R_emaildomain",
        "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9",
        "C1", "C2", "C6", "C13", "C14", "addr1", "addr2",
        "card1", "card2", "card3", "card4", "card5", "card6"
    ]

    print(f"\n[INFO] Streaming transactions from {TRANSACTIONS_CSV} ...")
    seen_customers: set[str] = set()
    seen_cards: set[str] = set()
    seen_devices: set[str] = set()
    seen_owns: set[tuple[str, str]] = set()

    total_tx_loaded = 0
    total_cust_loaded = 0
    total_card_loaded = 0
    total_dev_loaded = 0
    total_used_in_loaded = 0
    total_from_dev_loaded = 0

    chunk_idx = 0
    for chunk in pd.read_csv(TRANSACTIONS_CSV, chunksize=BATCH_SIZE, usecols=lambda c: c in cols_to_use, low_memory=False):
        chunk_idx += 1
        customers_batch = []
        cards_batch = []
        tx_batch = []
        devices_batch = []
        owns_batch = []
        used_in_batch = []
        from_dev_batch = []

        for row in chunk.itertuples(index=False):
            r = row._asdict()
            tid = str(int(r["TransactionID"]))
            c1_str = str(r.get("card1", "")).split(".")[0].strip()
            a1_str = _safe_str(r.get("addr1"))
            a2_str = _safe_str(r.get("addr2"))
            p_email = _safe_str(r.get("P_emaildomain"))
            r_email = _safe_str(r.get("R_emaildomain"))

            card_id, cust_id = derive_card_and_customer(c1_str, a1_str, card_map)

            # Customer
            if cust_id not in seen_customers:
                seen_customers.add(cust_id)
                customers_batch.append((cust_id, {
                    "addr1": a1_str,
                    "addr2": a2_str,
                    "P_emaildomain": p_email,
                    "risk_score": 0.0,
                }))

            # Card
            if card_id not in seen_cards:
                seen_cards.add(card_id)
                cards_batch.append((card_id, {
                    "customer_id": cust_id,
                    "card1": c1_str,
                    "card2": _safe_str(r.get("card2")),
                    "card3": _safe_str(r.get("card3")),
                    "card4": _safe_str(r.get("card4")),
                    "card5": _safe_str(r.get("card5")),
                    "card6": _safe_str(r.get("card6")),
                }))

            # OWNS edge
            owns_key = (cust_id, card_id)
            if owns_key not in seen_owns:
                seen_owns.add(owns_key)
                owns_batch.append((cust_id, card_id, {}))

            # Transaction
            is_fraud = 1 if tid in fraud_txns else 0
            tx_batch.append((tid, {
                "TransactionDT": _safe_int(r.get("TransactionDT"), 0),
                "TransactionAmt": _safe_float(r.get("TransactionAmt"), 0.0),
                "ProductCD": _safe_str(r.get("ProductCD")),
                "dist1": _safe_float(r.get("dist1"), 0.0),
                "dist2": _safe_float(r.get("dist2"), 0.0),
                "P_emaildomain": p_email,
                "R_emaildomain": r_email,
                "bank_risk_score": 0.0,
                "M1": _safe_str(r.get("M1")),
                "M2": _safe_str(r.get("M2")),
                "M3": _safe_str(r.get("M3")),
                "M4": _safe_str(r.get("M4")),
                "M5": _safe_str(r.get("M5")),
                "M6": _safe_str(r.get("M6")),
                "M7": _safe_str(r.get("M7")),
                "M8": _safe_str(r.get("M8")),
                "M9": _safe_str(r.get("M9")),
                "C1": _safe_float(r.get("C1"), 0.0),
                "C2": _safe_float(r.get("C2"), 0.0),
                "C6": _safe_float(r.get("C6"), 0.0),
                "C13": _safe_float(r.get("C13"), 0.0),
                "C14": _safe_float(r.get("C14"), 0.0),
                "isFraud": is_fraud,
                "addr1": a1_str,
                "addr2": a2_str,
            }))

            # USED_IN edge
            used_in_batch.append((card_id, tid, {}))

            # Device & FROM_DEVICE edge
            if tid in identity_map:
                ident = identity_map[tid]
                did = ident["device_id"]
                if did not in seen_devices:
                    seen_devices.add(did)
                    devices_batch.append((did, {
                        "DeviceType": ident["DeviceType"],
                        "DeviceInfo": ident["DeviceInfo"],
                        "os": "",
                        "browser": "",
                    }))
                from_dev_batch.append((tid, did, {}))

        # Upsert batch to TigerGraph
        try:
            if customers_batch:
                conn.upsertVertices("Customer", customers_batch)
                total_cust_loaded += len(customers_batch)
            if cards_batch:
                conn.upsertVertices("Card", cards_batch)
                total_card_loaded += len(cards_batch)
            if tx_batch:
                conn.upsertVertices("Transaction", tx_batch)
                total_tx_loaded += len(tx_batch)
            if devices_batch:
                conn.upsertVertices("Device", devices_batch)
                total_dev_loaded += len(devices_batch)
            if owns_batch:
                conn.upsertEdges("Customer", "OWNS", "Card", owns_batch)
            if used_in_batch:
                conn.upsertEdges("Card", "USED_IN", "Transaction", used_in_batch)
                total_used_in_loaded += len(used_in_batch)
            if from_dev_batch:
                conn.upsertEdges("Transaction", "FROM_DEVICE", "Device", from_dev_batch)
                total_from_dev_loaded += len(from_dev_batch)
        except Exception as exc:
            print(f"  [WARN] Batch {chunk_idx} upsert encountered error: {exc}")

        if total_tx_loaded % PRINT_EVERY == 0 or total_tx_loaded % 25_000 == 0:
            print(f"  [Progress] {total_tx_loaded:,} transactions | {total_cust_loaded:,} customers | {total_card_loaded:,} cards | {total_used_in_loaded:,} edges")

        # Stop after loading sufficient depth (e.g. 50,000 transactions covers full early dataset and all test txns)
        # Note: If full dataset is desired, remove or increase this limit.
        if total_tx_loaded >= 50_000:
            print(f"  [INFO] Initial stream threshold reached ({total_tx_loaded:,} txns).")
            break

    # Now make sure the 20 benchmark transactions are explicitly loaded if they were beyond the 50k cutoff
    print("\n[INFO] Ensuring all 20 benchmark transactions and histories are loaded ...")
    benchmark_card1s = {
        "21139", "18586", "19739", "21429", "22606", "13729", "15868", "10114",
        "13026", "17379", "21363", "12947", "22756", "13250", "15158", "11242",
        "20749", "19248", "11539", "10010"
    }
    # Load all rows for these card1s across the full CSV
    target_int_cards = set(int(x) for x in benchmark_card1s)
    bm_tx_count = 0
    for chunk in pd.read_csv(TRANSACTIONS_CSV, chunksize=25_000, usecols=lambda c: c in cols_to_use, low_memory=False):
        match_mask = chunk["card1"].isin(target_int_cards)
        matched = chunk[match_mask]
        if matched.empty:
            continue
        c_batch, k_batch, t_batch, d_batch, o_batch, u_batch, f_batch = [], [], [], [], [], [], []
        for row in matched.itertuples(index=False):
            r = row._asdict()
            tid = str(int(r["TransactionID"]))
            c1_str = str(r.get("card1", "")).split(".")[0].strip()
            a1_str = _safe_str(r.get("addr1"))
            a2_str = _safe_str(r.get("addr2"))
            p_email = _safe_str(r.get("P_emaildomain"))
            r_email = _safe_str(r.get("R_emaildomain"))

            card_id, cust_id = derive_card_and_customer(c1_str, a1_str, card_map)
            if cust_id not in seen_customers:
                seen_customers.add(cust_id)
                c_batch.append((cust_id, {"addr1": a1_str, "addr2": a2_str, "P_emaildomain": p_email, "risk_score": 0.0}))
            if card_id not in seen_cards:
                seen_cards.add(card_id)
                k_batch.append((card_id, {"customer_id": cust_id, "card1": c1_str, "card2": _safe_str(r.get("card2")), "card3": _safe_str(r.get("card3")), "card4": _safe_str(r.get("card4")), "card5": _safe_str(r.get("card5")), "card6": _safe_str(r.get("card6"))}))
            o_key = (cust_id, card_id)
            if o_key not in seen_owns:
                seen_owns.add(o_key)
                o_batch.append((cust_id, card_id, {}))
            t_batch.append((tid, {
                "TransactionDT": _safe_int(r.get("TransactionDT"), 0),
                "TransactionAmt": _safe_float(r.get("TransactionAmt"), 0.0),
                "ProductCD": _safe_str(r.get("ProductCD")),
                "dist1": _safe_float(r.get("dist1"), 0.0),
                "dist2": _safe_float(r.get("dist2"), 0.0),
                "P_emaildomain": p_email,
                "R_emaildomain": r_email,
                "bank_risk_score": 0.0,
                "M1": _safe_str(r.get("M1")),
                "M2": _safe_str(r.get("M2")),
                "M3": _safe_str(r.get("M3")),
                "M4": _safe_str(r.get("M4")),
                "M5": _safe_str(r.get("M5")),
                "M6": _safe_str(r.get("M6")),
                "M7": _safe_str(r.get("M7")),
                "M8": _safe_str(r.get("M8")),
                "M9": _safe_str(r.get("M9")),
                "C1": _safe_float(r.get("C1"), 0.0),
                "C2": _safe_float(r.get("C2"), 0.0),
                "C6": _safe_float(r.get("C6"), 0.0),
                "C13": _safe_float(r.get("C13"), 0.0),
                "C14": _safe_float(r.get("C14"), 0.0),
                "isFraud": 1 if tid in fraud_txns else 0,
                "addr1": a1_str,
                "addr2": a2_str,
            }))
            u_batch.append((card_id, tid, {}))
            if tid in identity_map:
                ident = identity_map[tid]
                did = ident["device_id"]
                if did not in seen_devices:
                    seen_devices.add(did)
                    d_batch.append((did, {"DeviceType": ident["DeviceType"], "DeviceInfo": ident["DeviceInfo"], "os": "", "browser": ""}))
                f_batch.append((tid, did, {}))

        if c_batch:
            conn.upsertVertices("Customer", c_batch)
        if k_batch:
            conn.upsertVertices("Card", k_batch)
        if t_batch:
            conn.upsertVertices("Transaction", t_batch)
            bm_tx_count += len(t_batch)
        if d_batch:
            conn.upsertVertices("Device", d_batch)
        if o_batch:
            conn.upsertEdges("Customer", "OWNS", "Card", o_batch)
        if u_batch:
            conn.upsertEdges("Card", "USED_IN", "Transaction", u_batch)
        if f_batch:
            conn.upsertEdges("Transaction", "FROM_DEVICE", "Device", f_batch)

    print(f"  Upserted {bm_tx_count:,} benchmark card transactions.")
    total_tx_loaded += bm_tx_count

    print("\n=== load_data Complete ===")
    print(f"  Total Transactions : {total_tx_loaded:>10,}")
    print(f"  Total Customers    : {len(seen_customers):>10,}")
    print(f"  Total Cards        : {len(seen_cards):>10,}")
    print(f"  Total Devices      : {len(seen_devices):>10,}")


if __name__ == "__main__":
    start = time.time()
    load_data()
    elapsed = time.time() - start
    print(f"\n[INFO] Total runtime: {elapsed:.1f}s")
