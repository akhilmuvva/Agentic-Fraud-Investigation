import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

CACHE_FILE = ROOT / "data" / "benchmark_cache.json"
BAK_FILE = ROOT / "data" / "benchmark_cache.json.bak"

from agent.graph import run_investigation

TEST_CASES = [
    {
        "case_id": "HHG-001",
        "trigger_type": "risk_score",
        "trigger_text": "Model scored txn 3514030 at 0.61",
        "flagged_txn_id": "3514030",
        "card_id": "C12382-K1",
        "customer_id": "C12382",
        "risk_score": 0.61
    },
    {
        "case_id": "HHG-002",
        "trigger_type": "risk_score",
        "trigger_text": "Model scored txn 3478782 at 0.89",
        "flagged_txn_id": "3478782",
        "card_id": "C11891-K1",
        "customer_id": "C11891",
        "risk_score": 0.89
    },
    {
        "case_id": "HHG-003",
        "trigger_type": "customer_report",
        "trigger_text": "Customer dispute on txn 3530164",
        "flagged_txn_id": "3530164",
        "card_id": "C08623-K2",
        "customer_id": "C08623",
        "risk_score": 0.70
    }
]

print("=== STEP 1: Renaming benchmark_cache.json to benchmark_cache.json.bak ===")
if CACHE_FILE.exists():
    shutil.move(CACHE_FILE, BAK_FILE)
    print("Renamed benchmark_cache.json successfully.")
else:
    print("benchmark_cache.json not found, BAK might already exist.")

# Clear in-memory cache in tg_client
import agent.tg_client as tg_client
tg_client._cache = None

try:
    for c in TEST_CASES:
        cid = c["case_id"]
        print(f"\n--- Running Investigation on {cid} (WITHOUT CACHE) ---")
        try:
            res = run_investigation(c)
            print(f"Result for {cid}:")
            print(f"  status: {res.get('status')}")
            print(f"  outcome: {res.get('outcome')}")
            print(f"  confidence: {res.get('confidence')}")
            print(f"  pattern_matches: {res.get('pattern_matches')}")
            print(f"  recommended_actions: {res.get('recommended_actions')}")
            print(f"  entities retrieved: {list(res.get('entities', {}).keys())}")
            for k, v in res.get('entities', {}).items():
                print(f"    entity '{k}': {v}")
            print(f"  evidence items count: {len(res.get('evidence', []))}")
            for ev in res.get('evidence', []):
                print(f"    evidence step: {ev.get('step')} | ref: {ev.get('ref') or ev.get('tool')} | claim: {ev.get('claim') or ev.get('result_summary')}")
        except Exception as exc:
            print(f"  FAILED with exception: {type(exc).__name__}: {exc}")

finally:
    print("\n=== RESTORING: Restoring benchmark_cache.json from BAK ===")
    if BAK_FILE.exists():
        shutil.move(BAK_FILE, CACHE_FILE)
        print("Restored benchmark_cache.json successfully.")
