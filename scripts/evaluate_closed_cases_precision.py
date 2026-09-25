import sys
import time
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from agent.tg_client import _get_conn
from agent.nodes.gather_evidence import _parse_pattern_result

conn = _get_conn()
if not conn:
    print("Failed to connect to TigerGraph!")
    sys.exit(1)

# Get all Card IDs in TG
print("Fetching all Card vertices from TG ...")
cards_in_tg = set()
res = conn.getVertices("Card", limit=10000)
for c in res:
    cards_in_tg.add(c["v_id"])
print(f"Total Card vertices in TG: {len(cards_in_tg)}")

df = pd.read_csv(ROOT / "data" / "closed_cases_history.csv")
df_valid = df[df["card_id"].isin(cards_in_tg)].copy()
print(f"Valid matching cases with cards in TG: {len(df_valid)}")
print("Distribution of valid matching cases:")
print(df_valid["pattern"].value_counts())

# Stratified sample: up to 12 from each pattern category
patterns = [
    ("card_not_present_fraud", 12),
    ("account_takeover", 12),
    ("card_not_present_new_device", 12),
    ("out_of_region_use", 12),
    ("card_testing", 4),
    ("none", 17),
]

sample_frames = []
for p, count in patterns:
    sub = df_valid[df_valid["pattern"] == p]
    if len(sub) > count:
        sub = sub.sample(count, random_state=42)
    sample_frames.append(sub)

sample_df = pd.concat(sample_frames).reset_index(drop=True)
print(f"\nEvaluating {len(sample_df)} cases against TigerGraph live queries...")

results = []
query_times = []

for idx, row in sample_df.iterrows():
    cid = row["case_id"]
    cust = str(row["customer_id"])
    card = str(row["card_id"])
    raw_tx = row["first_fraud_txn_id"]
    if pd.notna(raw_tx) and str(raw_tx).replace(".", "", 1).isdigit():
        tx = str(int(float(raw_tx)))
    else:
        tx = str(raw_tx)
    true_pattern = str(row["pattern"])
    true_outcome = str(row["outcome"])

    case_matches = {}

    # P1: detect_card_not_present_fraud
    try:
        t0 = time.time()
        r1 = conn.runInstalledQuery("detect_card_not_present_fraud", {"card_id": card, "lookback_days": 90})
        query_times.append(time.time() - t0)
        m1, ev1, ind1 = _parse_pattern_result("card_not_present_fraud", {"results": r1})
        case_matches["card_not_present_fraud"] = m1
    except Exception as e:
        case_matches["card_not_present_fraud"] = False

    # P2: detect_account_takeover
    try:
        t0 = time.time()
        r2 = conn.runInstalledQuery("detect_account_takeover", {"customer_id": cust, "lookback_days": 90})
        query_times.append(time.time() - t0)
        m2, ev2, ind2 = _parse_pattern_result("account_takeover", {"results": r2})
        case_matches["account_takeover"] = m2
    except Exception as e:
        case_matches["account_takeover"] = False

    # P3: detect_card_not_present_new_device
    try:
        t0 = time.time()
        r3 = conn.runInstalledQuery("detect_card_not_present_new_device", {"card_id": card, "lookback_days": 90})
        query_times.append(time.time() - t0)
        m3, ev3, ind3 = _parse_pattern_result("card_not_present_new_device", {"results": r3})
        case_matches["card_not_present_new_device"] = m3
    except Exception as e:
        case_matches["card_not_present_new_device"] = False

    # P4: detect_out_of_region_use
    try:
        t0 = time.time()
        r4 = conn.runInstalledQuery("detect_out_of_region_use", {"card_id": card, "transaction_id": tx})
        query_times.append(time.time() - t0)
        m4, ev4, ind4 = _parse_pattern_result("out_of_region_use", {"results": r4})
        case_matches["out_of_region_use"] = m4
    except Exception as e:
        case_matches["out_of_region_use"] = False

    # P5: detect_card_testing
    try:
        t0 = time.time()
        r5 = conn.runInstalledQuery("detect_card_testing", {"card_id": card, "window_hours": 720})
        query_times.append(time.time() - t0)
        m5, ev5, ind5 = _parse_pattern_result("card_testing", {"results": r5})
        case_matches["card_testing"] = m5
    except Exception as e:
        case_matches["card_testing"] = False

    results.append({
        "case_id": cid,
        "true_pattern": true_pattern,
        "true_outcome": true_outcome,
        "matches": case_matches
    })

print("\n" + "="*80)
print(f"EVALUATION METRICS ACROSS {len(results)} VALID CLOSED CASES IN TIGERGRAPH")
print("="*80)

PATTERNS = ["card_not_present_fraud", "account_takeover", "card_not_present_new_device", "out_of_region_use", "card_testing"]

for p in PATTERNS:
    tp = 0
    fp = 0
    tn = 0
    fn = 0
    fp_cleared = 0

    for r in results:
        is_pos = (r["true_pattern"] == p)
        pred_pos = r["matches"].get(p, False)

        if is_pos and pred_pos:
            tp += 1
        elif not is_pos and pred_pos:
            fp += 1
            if r["true_outcome"] == "cleared":
                fp_cleared += 1
        elif not is_pos and not pred_pos:
            tn += 1
        elif is_pos and not pred_pos:
            fn += 1

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0.0

    print(f"\nPattern: {p}")
    print(f"  TP={tp:2d}, FP={fp:2d} (of which {fp_cleared:2d} were on cleared cases), TN={tn:2d}, FN={fn:2d}")
    print(f"  Precision: {precision:6.2%} | Recall (TPR): {recall:6.2%} | FPR: {fpr:6.2%} | Accuracy: {accuracy:6.2%}")

print(f"\nAverage query latency: {sum(query_times)/len(query_times):.3f}s across {len(query_times)} queries")
