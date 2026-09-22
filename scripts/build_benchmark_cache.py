"""
scripts/build_benchmark_cache.py
--------------------------------
Scans transactions.csv, identity.csv, and closed_cases_history.csv in a single fast pass,
extracting the 20 benchmark cases and their card histories into data/benchmark_cache.json.
This provides instantaneous lookups for local evaluation and automated testing.
"""

import csv
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

def main():
    print("[1/4] Loading case_pack.csv...")
    with open(DATA / "case_pack.csv", "r", encoding="utf-8") as f:
        cases = list(csv.DictReader(f))

    flagged_txn_ids = {c["flagged_txn_id"] for c in cases}
    card_map = {c["flagged_txn_id"]: c["card_id"] for c in cases}
    cust_map = {c["card_id"]: c["customer_id"] for c in cases}
    card_ids = set(card_map.values())
    cust_ids = set(cust_map.values())

    print(f"Targeting {len(cases)} benchmark cases across {len(card_ids)} cards.")

    # First pass: find card1 values associated with the benchmark cases
    # We map card1 from the transactions. To do it in one pass, collect all txns that match flagged or card1
    print("[2/3] Scanning transactions.csv in a single pass...")
    txns = {}
    
    # Pre-index: let's find the flagged transactions first
    with open(DATA / "transactions.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tid = row["TransactionID"]
            if tid in flagged_txn_ids:
                txns[tid] = row
                if len(txns) == len(flagged_txn_ids):
                    break

    card1_to_card_id = {txns[tid]["card1"]: card_map[tid] for tid in txns if "card1" in txns[tid]}
    print(f"Found all {len(txns)} flagged transactions.")
    print(f"Mapped card1 prefixes: {card1_to_card_id}")

    # Now collect card histories in one pass
    card_histories = {cid: [] for cid in card_ids}
    with open(DATA / "transactions.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            card1 = row.get("card1")
            if card1 in card1_to_card_id:
                cid = card1_to_card_id[card1]
                card_histories[cid].append({
                    "transaction_id": row["TransactionID"],
                    "TransactionDT": int(row["TransactionDT"]),
                    "TransactionAmt": float(row["TransactionAmt"] or 0),
                    "ProductCD": row.get("ProductCD", ""),
                    "card1": row.get("card1", ""),
                    "addr1": row.get("addr1", ""),
                    "P_emaildomain": row.get("P_emaildomain", ""),
                    "R_emaildomain": row.get("R_emaildomain", ""),
                    "M1": row.get("M1", ""),
                    "M4": row.get("M4", ""),
                    "M6": row.get("M6", ""),
                    "M9": row.get("M9", ""),
                    "C1": float(row.get("C1") or 0),
                    "C2": float(row.get("C2") or 0),
                    "bank_risk_score": float(row.get("bank_risk_score") or 0.0),
                })

    for cid in card_histories:
        card_histories[cid].sort(key=lambda x: x["TransactionDT"], reverse=True)
        print(f"  Card {cid}: {len(card_histories[cid])} transactions")

    # Load identity data for flagged transactions
    print("[4/4] Scanning identity.csv for device and browser information...")
    identities = {}
    with open(DATA / "identity.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tid = row["TransactionID"]
            if tid in flagged_txn_ids:
                identities[tid] = {
                    "DeviceType": row.get("DeviceType", ""),
                    "DeviceInfo": row.get("DeviceInfo", ""),
                    "id_30": row.get("id_30", ""),
                    "id_31": row.get("id_31", ""),
                    "id_15": row.get("id_15", ""),
                    "id_16": row.get("id_16", ""),
                }

    # Load closed cases sample for similarity retrieval
    print("Loading closed cases for retrieval index...")
    closed_cases_sample = []
    with open(DATA / "closed_cases_history.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i < 200 or row["outcome"] == "cleared":  # include good variety
                closed_cases_sample.append({
                    "case_id": row["case_id"],
                    "outcome": row["outcome"],
                    "pattern": row["pattern"],
                    "actions_taken": row["actions_taken"].split("|") if row["actions_taken"] else [],
                    "analyst_notes": row["analyst_notes"],
                    "exposure_usd": float(row["exposure_usd"] or 0.0),
                })
            if len(closed_cases_sample) >= 300:
                break

    cache_data = {
        "benchmark_cases": cases,
        "transactions": txns,
        "identities": identities,
        "card_histories": card_histories,
        "closed_cases_sample": closed_cases_sample,
    }

    out_file = DATA / "benchmark_cache.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(cache_data, f, indent=2)

    print(f"\n[SUCCESS] Benchmark cache generated at {out_file} ({out_file.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
