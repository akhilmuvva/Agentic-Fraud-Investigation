import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from agent.graph import run_investigation

NON_BENCHMARK_CASES = [
    {
        "case_id": "NEW-TXN-001",
        "trigger_type": "risk_score",
        "trigger_text": "Model scored transaction 3000001 at 0.25",
        "flagged_txn_id": "3000001",
        "card_id": "C06075-K3",
        "customer_id": "C06075",
        "risk_score": 0.25
    },
    {
        "case_id": "NEW-TXN-002",
        "trigger_type": "risk_score",
        "trigger_text": "Model scored transaction 3000002 at 0.06",
        "flagged_txn_id": "3000002",
        "card_id": "C07096-K4",
        "customer_id": "C07096",
        "risk_score": 0.06
    },
    {
        "case_id": "NEW-TXN-003",
        "trigger_type": "risk_score",
        "trigger_text": "Model scored transaction 3000003 at 0.52",
        "flagged_txn_id": "3000003",
        "card_id": "C11919-K4",
        "customer_id": "C11919",
        "risk_score": 0.52
    }
]

for c in NON_BENCHMARK_CASES:
    cid = c["case_id"]
    print(f"\n==========================================")
    print(f"=== Running /investigate for {cid} (Txn #{c['flagged_txn_id']}) ===")
    print(f"==========================================")
    res = run_investigation(c)
    print(f"Case ID: {cid}")
    print(f"Status: {res.get('status')}")
    print(f"Outcome: {res.get('outcome')}")
    print(f"Confidence: {res.get('confidence')}")
    print(f"Pattern Matches: {res.get('pattern_matches')}")
    print(f"Recommended Actions: {res.get('recommended_actions')}")
    print(f"SAR Required: {res.get('sar_required')}")
    print(f"Exposure USD: {res.get('exposure_usd')}")
    print("Entities retrieved:")
    for k, v in res.get('entities', {}).items():
        print(f"  {k}: {v}")
    print("Evidence claims (first 5):")
    for ev in res.get('evidence', [])[:5]:
        print(f"  [{ev.get('step')}] {ev.get('claim') or ev.get('result_summary')}")
