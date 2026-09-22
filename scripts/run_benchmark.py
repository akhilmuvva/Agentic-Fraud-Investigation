"""
Batch benchmark runner for all 20 fraud investigation cases.

Usage:
    python scripts/run_benchmark.py

Reads  : D:\\hakern\\data\\case_pack.csv
Writes : D:\\hakern\\output\\{case_id}\\
"""

from __future__ import annotations

import csv
import json
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Path setup — ensure project root is on sys.path
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from agent.graph import run_investigation  # noqa: E402

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CASE_PACK_CSV = PROJECT_ROOT / "data" / "case_pack.csv"
OUTPUT_ROOT = PROJECT_ROOT / "output"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_cases(csv_path: Path) -> list[dict]:
    """Load benchmark cases from CSV, coercing types."""
    cases: list[dict] = []
    with csv_path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            raw_rs = row.get("risk_score")
            row["risk_score"] = float(raw_rs) if raw_rs and raw_rs.strip() else 0.0
            cases.append(row)
    return cases


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, default=str)


def _safe_list(val) -> list:
    if val is None:
        return []
    if isinstance(val, list):
        return val
    return list(val)


def _action_str(action) -> str:
    if isinstance(action, dict):
        return action.get("action", str(action))
    return str(action)


# ---------------------------------------------------------------------------
# Per-case processing
# ---------------------------------------------------------------------------


def process_case(row: dict) -> tuple[str, dict | None, str | None]:
    """
    Run a single investigation.

    Returns (case_id, state_dict_or_None, error_message_or_None).
    """
    case_id: str = row["case_id"]
    input_dict: dict = {
        "case_id": case_id,
        "trigger_type": row.get("trigger_type", ""),
        "trigger_text": row.get("trigger_text", ""),
        "flagged_txn_id": row.get("flagged_txn_id", ""),
        "card_id": row.get("card_id", ""),
        "customer_id": row.get("customer_id", ""),
        "risk_score": row["risk_score"],
    }

    try:
        state: dict = run_investigation(input_dict)
    except Exception:  # noqa: BLE001
        err = traceback.format_exc()
        return case_id, None, err

    case_dir = OUTPUT_ROOT / case_id
    case_dir.mkdir(parents=True, exist_ok=True)

    # --- (c) Full state record -------------------------------------------------
    _write_json(case_dir / "case_record.json", state)

    # --- (d) next_best_action_before ------------------------------------------
    nba_before = state.get("next_action_before") or {}
    _write_json(case_dir / "next_best_action_before.json", nba_before)

    # --- (e) next_best_action_after -------------------------------------------
    nba_after = state.get("next_action_after") or {}
    _write_json(case_dir / "next_best_action_after.json", nba_after)

    # --- (f) SAR file (if required) -------------------------------------------
    if state.get("sar_required"):
        actions = _safe_list(state.get("recommended_actions"))
        sar_payload = {
            "case_id": case_id,
            "customer_id": row.get("customer_id", ""),
            "card_id": row.get("card_id", ""),
            "pattern_matched": state.get("pattern_matched"),
            "exposure_usd": state.get("exposure_usd", 0.0),
            "recommended_actions": [_action_str(a) for a in actions],
            "explanation": state.get("explanation", ""),
            "filed_at": datetime.now(timezone.utc).isoformat(),
        }
        _write_json(case_dir / "sar.json", sar_payload)

    # --- (g) Assert graph write -----------------------------------------------
    assert state.get("case_written_to_graph") is True, (
        f"[{case_id}] case_written_to_graph is not True — got: "
        f"{state.get('case_written_to_graph')!r}"
    )

    return case_id, state, None


# ---------------------------------------------------------------------------
# Summary printing
# ---------------------------------------------------------------------------

_COL_WIDTHS = {
    "case_id":    20,
    "outcome":    20,
    "pattern":    32,
    "confidence":  10,
    "actions":     8,
    "sar":         5,
}

_HDR = (
    f"{'Case ID':<20} | "
    f"{'Outcome':<20} | "
    f"{'Pattern':<32} | "
    f"{'Conf':>10} | "
    f"{'Actions':>8} | "
    f"{'SAR':>5}"
)
_SEP = "-" * len(_HDR)


def _print_row(case_id: str, state: dict) -> None:
    actions = _safe_list(state.get("recommended_actions"))
    print(
        f"{case_id:<20} | "
        f"{str(state.get('outcome','')):<20} | "
        f"{str(state.get('pattern_matched','')):<32} | "
        f"{state.get('confidence', 0.0):>10.3f} | "
        f"{len(actions):>8} | "
        f"{'YES' if state.get('sar_required') else 'no':>5}"
    )


def _print_error_row(case_id: str) -> None:
    print(
        f"{case_id:<20} | "
        f"{'ERROR':<20} | "
        f"{'':32} | "
        f"{'':>10} | "
        f"{'':>8} | "
        f"{'':>5}"
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    if not CASE_PACK_CSV.exists():
        print(f"ERROR: case_pack.csv not found at {CASE_PACK_CSV}", file=sys.stderr)
        sys.exit(1)

    cases = _load_cases(CASE_PACK_CSV)
    total = len(cases)
    print(f"\n{'='*60}")
    print(f"  TigerGraph Fraud Investigation — Benchmark Run")
    print(f"  {total} cases loaded from {CASE_PACK_CSV.name}")
    print(f"{'='*60}\n")

    results: list[tuple[str, dict | None, str | None]] = []

    for idx, row in enumerate(cases, start=1):
        case_id = row["case_id"]
        print(f"[{idx:02d}/{total}] Processing {case_id} ... ", end="", flush=True)
        case_id_out, state, err = process_case(row)
        if err:
            print("FAILED")
            print(f"       {err.splitlines()[-1]}", file=sys.stderr)
        else:
            actions = _safe_list(state.get("recommended_actions"))
            print(
                f"outcome={state.get('outcome')} | "
                f"pattern={state.get('pattern_matched')} | "
                f"conf={state.get('confidence', 0.0):.3f} | "
                f"actions={len(actions)} | "
                f"SAR={'YES' if state.get('sar_required') else 'no'}"
            )
        results.append((case_id_out, state, err))
        if idx < total:
            import time
            time.sleep(15.0)

    # --- Final summary table --------------------------------------------------
    print(f"\n{'='*60}")
    print("  FINAL SUMMARY")
    print(f"{'='*60}")
    print(_HDR)
    print(_SEP)

    errors: list[str] = []
    for case_id, state, err in results:
        if err:
            _print_error_row(case_id)
            errors.append(case_id)
        else:
            _print_row(case_id, state)

    print(_SEP)
    succeeded = total - len(errors)
    print(f"\n  Passed : {succeeded}/{total}")
    if errors:
        print(f"  Failed : {', '.join(errors)}")

    print(f"\n✅ All {total} benchmark cases completed. Output in D:\\hakern\\output\n")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
