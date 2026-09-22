"""
FastAPI backend for TigerGraph Agentic Fraud Investigation.
Exposes investigation endpoints backed by the LangGraph agent.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from functools import partial
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fraud_api")

# ---------------------------------------------------------------------------
# Agent import
# ---------------------------------------------------------------------------
from agent.graph import run_investigation  # noqa: E402

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="TigerGraph Fraud Investigation API",
    description="Agentic fraud investigation powered by TigerGraph + LangGraph + Gemini.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------
cases_store: Dict[str, Dict[str, Any]] = {}

# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class InvestigateRequest(BaseModel):
    case_id: str = Field(..., description="Unique case identifier")
    trigger_type: str = Field(..., description="Type of fraud trigger")
    trigger_text: str = Field(..., description="Free-text description of the trigger")
    flagged_txn_id: str = Field(..., description="Transaction ID that raised the alert")
    card_id: str = Field(..., description="Payment card identifier")
    customer_id: str = Field(..., description="Customer identifier")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Initial risk score 0-1")


class InvestigateResponse(BaseModel):
    case_id: str
    status: str
    outcome: Optional[str]
    confidence: Optional[float]
    recommended_actions: Optional[List[str]]
    sar_required: Optional[bool]


class CaseSummary(BaseModel):
    case_id: str
    trigger_type: Optional[str]
    status: str
    outcome: Optional[str]
    pattern_matched: Optional[str]
    confidence: Optional[float]
    sar_required: Optional[bool]
    risk_score: Optional[float]


class HealthResponse(BaseModel):
    status: str
    timestamp: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_summary(case_id: str, state: Dict[str, Any]) -> Dict[str, Any]:
    """Extract a flat summary dict from a full agent state dict."""
    return {
        "case_id": case_id,
        "trigger_type": state.get("trigger_type"),
        "status": state.get("status", "completed"),
        "outcome": state.get("outcome"),
        "pattern_matched": state.get("pattern_matched"),
        "confidence": state.get("confidence"),
        "sar_required": state.get("sar_required", False),
        "risk_score": state.get("risk_score"),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse, tags=["Meta"])
async def health_check() -> HealthResponse:
    """Simple liveness probe."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/investigate", response_model=InvestigateResponse, tags=["Investigation"])
async def investigate(request: InvestigateRequest) -> InvestigateResponse:
    """
    Trigger a fraud investigation for a single case.

    Runs the LangGraph agent synchronously in a thread-pool executor so the
    event loop is not blocked (the agent makes blocking I/O calls to TigerGraph
    and the Gemini API).
    """
    input_dict: Dict[str, Any] = request.model_dump()
    case_id = request.case_id

    logger.info("Starting investigation for case_id=%s", case_id)

    loop = asyncio.get_running_loop()
    try:
        # run_investigation is blocking — offload to thread pool
        state: Dict[str, Any] = await loop.run_in_executor(
            None, partial(run_investigation, input_dict)
        )
    except Exception as exc:
        logger.exception("Investigation failed for case_id=%s: %s", case_id, exc)
        raise HTTPException(status_code=500, detail=f"Investigation failed: {exc}") from exc

    # Persist in memory
    cases_store[case_id] = state
    logger.info(
        "Investigation completed: case_id=%s outcome=%s confidence=%.2f",
        case_id,
        state.get("outcome"),
        state.get("confidence", 0.0),
    )

    recommended_actions = state.get("recommended_actions") or []
    # Normalise: may be list of dicts or list of strings
    if recommended_actions and isinstance(recommended_actions[0], dict):
        recommended_actions = [
            a.get("action", str(a)) for a in recommended_actions
        ]

    return InvestigateResponse(
        case_id=case_id,
        status="completed",
        outcome=state.get("outcome"),
        confidence=state.get("confidence"),
        recommended_actions=recommended_actions,
        sar_required=state.get("sar_required", False),
    )


@app.get("/cases", response_model=List[CaseSummary], tags=["Cases"])
async def list_cases() -> List[CaseSummary]:
    """Return a summary list of all investigated cases."""
    return [
        CaseSummary(**_build_summary(cid, st))
        for cid, st in cases_store.items()
    ]


@app.get("/cases/{case_id}", tags=["Cases"])
async def get_case(case_id: str) -> Dict[str, Any]:
    """Return the full agent state dict for a single case."""
    if case_id not in cases_store:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    return cases_store[case_id]
