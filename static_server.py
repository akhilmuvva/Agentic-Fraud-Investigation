"""
static_server.py — Lightweight FastAPI that serves the pre-loaded HHG case JSON files.
Use this when you don't have TigerGraph/Gemini credentials set up but want to browse
all 20 cases in the UI.

Run: python static_server.py
"""
from __future__ import annotations
import json
import os
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Fraud Investigation — Static Case Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load all HHG-*.json files from /cases directory
CASES_DIR = Path(__file__).resolve().parent / "cases"
cases: dict[str, dict] = {}

if CASES_DIR.exists():
    for f in sorted(CASES_DIR.glob("HHG-*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            cases[data["case_id"]] = data
        except Exception as e:
            print(f"Warning: could not load {f.name}: {e}")

print(f"Loaded {len(cases)} cases: {sorted(cases.keys())}")


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok", "cases_loaded": len(cases)}


@app.get("/cases")
@app.get("/api/cases")
def list_cases():
    return list(cases.values())


@app.get("/api/full-cases")
def list_full_cases():
    return list(cases.values())


@app.get("/cases/{case_id}")
@app.get("/api/cases/{case_id}")
def get_case(case_id: str):
    if case_id not in cases:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return cases[case_id]


@app.post("/investigate")
@app.post("/api/investigate")
async def investigate(body: dict):
    """Mock investigation response for UI testing without live graph/Gemini."""
    case_id = body.get("case_id", "HHG-NEW")
    if case_id in cases:
        c = cases[case_id]["case"]
        return {
            "case_id": case_id,
            "status": "completed",
            "outcome": f"Evaluated case {case_id}: verdict={c.get('verdict')}, pattern={c.get('pattern')}",
            "confidence": c.get("fraud_probability", 0.75),
            "recommended_actions": [a.get("action") for a in cases[case_id].get("next_best_actions", {}).get("final", [])] or ["VERIFY_WITH_CUSTOMER"],
            "sar_required": cases[case_id].get("sar", {}).get("file", False),
        }
    return {
        "case_id": case_id,
        "status": "completed",
        "outcome": f"Simulated investigation for {case_id} — high risk detected in card topology",
        "confidence": float(body.get("risk_score", 0.78)),
        "recommended_actions": ["BLOCK_CARD", "VERIFY_WITH_CUSTOMER", "NOTIFY_FRAUD_ANALYST"],
        "sar_required": float(body.get("risk_score", 0)) > 0.7,
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
