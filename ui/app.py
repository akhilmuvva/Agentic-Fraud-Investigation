"""
Streamlit read-only dashboard for TigerGraph Agentic Fraud Investigation.

Run with:
    streamlit run ui/app.py
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

import pandas as pd
import requests
import streamlit as st

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Fraud Investigation Dashboard",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Custom CSS — subtle row highlighting & badge styles
# ---------------------------------------------------------------------------
st.markdown(
    """
    <style>
    .badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 0.82rem;
        font-weight: 600;
        margin-right: 4px;
    }
    .badge-fraud    { background:#ff4b4b; color:white; }
    .badge-cleared  { background:#21c55d; color:white; }
    .badge-invest   { background:#f59e0b; color:white; }
    .badge-sar      { background:#7c3aed; color:white; }
    .badge-info     { background:#3b82f6; color:white; }
    .badge-grey     { background:#94a3b8; color:white; }
    .evidence-step  { border-left: 3px solid #3b82f6; padding-left:10px; margin-bottom:8px; }
    .section-hdr    { font-size:1.1rem; font-weight:700; margin-top:1.2rem; margin-bottom:0.4rem; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FRAUD_PATTERNS = [
    "card_not_present_fraud",
    "account_takeover",
    "card_not_present_new_device",
    "out_of_region_use",
    "card_testing",
]

OUTCOME_BADGE = {
    "confirmed_fraud": "badge-fraud",
    "cleared": "badge-cleared",
    "investigating": "badge-invest",
    "needs_review": "badge-invest",
}

STATUS_BADGE = {
    "completed": "badge-info",
    "running": "badge-invest",
    "failed": "badge-fraud",
}


def _badge(text: str, cls: str) -> str:
    return f'<span class="badge {cls}">{text}</span>'


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
with st.sidebar:
    st.title("⚙️ Settings")
    api_base = st.text_input(
        "API Base URL",
        value="http://localhost:8000",
        help="FastAPI backend URL",
    )
    api_base = api_base.rstrip("/")

    st.divider()
    auto_refresh = st.toggle("Auto-refresh (10 s)", value=False)
    if st.button("🔄 Refresh Now", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    st.divider()
    st.caption("TigerGraph Agentic Fraud Investigation — v1.0")

# ---------------------------------------------------------------------------
# Auto-refresh
# ---------------------------------------------------------------------------
if auto_refresh:
    time.sleep(10)
    st.cache_data.clear()
    st.rerun()

# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------


@st.cache_data(ttl=10, show_spinner=False)
def fetch_cases(base: str) -> List[Dict[str, Any]]:
    try:
        r = requests.get(f"{base}/cases", timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as exc:  # noqa: BLE001
        st.error(f"Failed to fetch cases: {exc}")
        return []


@st.cache_data(ttl=10, show_spinner=False)
def fetch_case(base: str, case_id: str) -> Optional[Dict[str, Any]]:
    try:
        r = requests.get(f"{base}/cases/{case_id}", timeout=10)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    except Exception as exc:  # noqa: BLE001
        st.error(f"Failed to fetch case {case_id}: {exc}")
        return None


# ---------------------------------------------------------------------------
# Helper: row colour for df styling
# ---------------------------------------------------------------------------
_ROW_COLOURS = {
    "confirmed_fraud": "#ffe2e2",
    "cleared":         "#d1fae5",
    "investigating":   "#fef3c7",
    "needs_review":    "#fef3c7",
}

_DEFAULT_ROW_COLOUR = "#f8fafc"


def _colour_row(outcome: str) -> str:
    return _ROW_COLOURS.get(outcome, _DEFAULT_ROW_COLOUR)


def _style_df(df: pd.DataFrame) -> pd.io.formats.style.Styler:
    if "Outcome" not in df.columns:
        return df.style
    return df.style.apply(
        lambda row: [
            f"background-color: {_colour_row(row.get('Outcome', ''))}"
            for _ in row
        ],
        axis=1,
    )


# ---------------------------------------------------------------------------
# Main title
# ---------------------------------------------------------------------------
st.title("🔍 Fraud Investigation Dashboard")
st.caption("Real-time view of TigerGraph agentic fraud investigations. Read-only.")

# ---------------------------------------------------------------------------
# Session state: selected case
# ---------------------------------------------------------------------------
if "selected_case_id" not in st.session_state:
    st.session_state["selected_case_id"] = None

# ---------------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------------
tab_list, tab_detail = st.tabs(["📋 Case List", "🔎 Case Detail"])


# ============================================================================
# TAB 1 — Case List
# ============================================================================
with tab_list:
    with st.spinner("Loading cases …"):
        cases: List[Dict[str, Any]] = fetch_cases(api_base)

    if not cases:
        st.info("No cases found. Run an investigation via POST /investigate or the benchmark script.")
    else:
        # Build display dataframe
        rows = []
        for c in cases:
            rows.append(
                {
                    "Case ID":    c.get("case_id", ""),
                    "Trigger":    c.get("trigger_type", ""),
                    "Risk Score": round(float(c.get("risk_score") or 0), 3),
                    "Outcome":    c.get("outcome") or "",
                    "Pattern":    c.get("pattern_matched") or "",
                    "Confidence": round(float(c.get("confidence") or 0), 3),
                    "SAR":        "✅ YES" if c.get("sar_required") else "no",
                }
            )
        df = pd.DataFrame(rows)

        st.markdown(f"**{len(df)} case(s)** found")

        styled = _style_df(df)
        st.dataframe(
            styled,
            use_container_width=True,
            hide_index=True,
            column_config={
                "Risk Score": st.column_config.ProgressColumn(
                    "Risk Score", min_value=0, max_value=1, format="%.3f"
                ),
                "Confidence": st.column_config.ProgressColumn(
                    "Confidence", min_value=0, max_value=1, format="%.3f"
                ),
            },
        )

        st.divider()
        st.markdown("**Jump to Case Detail →**")
        case_ids = [c.get("case_id", "") for c in cases]
        chosen = st.selectbox(
            "Select Case ID",
            options=[""] + case_ids,
            label_visibility="collapsed",
        )
        if chosen:
            st.session_state["selected_case_id"] = chosen
            st.rerun()


# ============================================================================
# TAB 2 — Case Detail
# ============================================================================
with tab_detail:
    with st.spinner("Loading cases …"):
        cases_for_sel: List[Dict[str, Any]] = fetch_cases(api_base)

    all_ids = [c.get("case_id", "") for c in cases_for_sel]

    default_idx = 0
    preselected = st.session_state.get("selected_case_id")
    if preselected and preselected in all_ids:
        default_idx = all_ids.index(preselected)

    if not all_ids:
        st.info("No cases available. Run investigations first.")
        st.stop()

    selected_id = st.selectbox(
        "Case ID",
        options=all_ids,
        index=default_idx,
        key="detail_selector",
    )
    st.session_state["selected_case_id"] = selected_id

    with st.spinner(f"Loading {selected_id} …"):
        state: Optional[Dict[str, Any]] = fetch_case(api_base, selected_id)

    if state is None:
        st.error(f"Case `{selected_id}` not found in API.")
        st.stop()

    # -------------------------------------------------------------------------
    # 1. Header
    # -------------------------------------------------------------------------
    outcome   = state.get("outcome") or "unknown"
    status    = state.get("status", "completed")
    sar_req   = state.get("sar_required", False)
    conf      = float(state.get("confidence") or 0.0)

    header_html = (
        f"<h2 style='margin-bottom:4px'>{selected_id}</h2>"
        + _badge(status, STATUS_BADGE.get(status, "badge-grey"))
        + _badge(outcome.replace("_", " ").title(), OUTCOME_BADGE.get(outcome, "badge-grey"))
        + (_badge("SAR REQUIRED", "badge-sar") if sar_req else "")
        + f"&nbsp;<span style='font-size:0.9rem;color:#64748b;'>Confidence: {conf:.1%}</span>"
    )
    st.markdown(header_html, unsafe_allow_html=True)
    st.divider()

    col_a, col_b = st.columns(2)

    # -------------------------------------------------------------------------
    # 2. Trigger section
    # -------------------------------------------------------------------------
    with col_a:
        st.markdown('<div class="section-hdr">🚨 Trigger</div>', unsafe_allow_html=True)
        st.markdown(f"**Type:** `{state.get('trigger_type', 'N/A')}`")
        st.markdown(f"**Risk Score:** `{float(state.get('risk_score') or 0):.3f}`")
        trigger_text = state.get("trigger_text") or state.get("input", {}).get("trigger_text", "")
        if trigger_text:
            st.markdown(f"> {trigger_text}")

    # -------------------------------------------------------------------------
    # 3. Pattern Matches
    # -------------------------------------------------------------------------
    with col_b:
        st.markdown('<div class="section-hdr">🔗 Pattern Matches</div>', unsafe_allow_html=True)
        matched_pattern = state.get("pattern_matched") or ""
        pattern_scores  = state.get("pattern_scores") or {}

        pattern_rows = []
        for p in FRAUD_PATTERNS:
            score = pattern_scores.get(p, 0.0)
            matched = (p == matched_pattern) or bool(pattern_scores.get(p, 0.0) >= 0.5)
            pattern_rows.append(
                {
                    "Pattern":  p.replace("_", " ").title(),
                    "Score":    round(float(score), 3),
                    "Matched":  "✅" if matched else "—",
                }
            )
        pat_df = pd.DataFrame(pattern_rows)
        st.dataframe(pat_df, hide_index=True, use_container_width=True)

    st.divider()

    # -------------------------------------------------------------------------
    # 4. Evidence Timeline
    # -------------------------------------------------------------------------
    st.markdown('<div class="section-hdr">📜 Evidence Timeline</div>', unsafe_allow_html=True)
    evidence: list = state.get("evidence") or []
    if not evidence:
        st.caption("No evidence items recorded.")
    else:
        for i, ev in enumerate(evidence):
            if isinstance(ev, dict):
                step   = ev.get("step") or ev.get("node") or f"Step {i+1}"
                tool   = ev.get("tool") or ev.get("query") or ""
                result = ev.get("result_summary") or ev.get("summary") or ev.get("result") or ""
                if isinstance(result, (dict, list)):
                    import json as _json
                    result = _json.dumps(result, default=str)[:300]
                st.markdown(
                    f'<div class="evidence-step">'
                    f'<b>{i+1}. {step}</b>'
                    + (f' &mdash; <code>{tool}</code>' if tool else "")
                    + f"<br><span style='color:#64748b;font-size:0.88rem;'>{result}</span>"
                    + "</div>",
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f'<div class="evidence-step">{i+1}. {ev}</div>',
                    unsafe_allow_html=True,
                )

    st.divider()
    col_c, col_d = st.columns(2)

    # -------------------------------------------------------------------------
    # 5. Similar Cases
    # -------------------------------------------------------------------------
    with col_c:
        st.markdown('<div class="section-hdr">🔄 Similar Cases</div>', unsafe_allow_html=True)
        similar: list = state.get("similar_cases") or []
        if not similar:
            st.caption("No similar cases retrieved.")
        else:
            sim_rows = []
            for s in similar:
                if isinstance(s, dict):
                    sim_rows.append(
                        {
                            "Case ID": s.get("case_id", ""),
                            "Outcome": s.get("outcome", ""),
                            "Pattern": s.get("pattern_matched", ""),
                            "Score":   round(float(s.get("similarity_score") or s.get("score") or 0), 3),
                        }
                    )
                else:
                    sim_rows.append({"Case ID": str(s), "Outcome": "", "Pattern": "", "Score": 0.0})
            st.dataframe(pd.DataFrame(sim_rows), hide_index=True, use_container_width=True)

    # -------------------------------------------------------------------------
    # 6. Recommended Actions
    # -------------------------------------------------------------------------
    with col_d:
        st.markdown('<div class="section-hdr">🎯 Recommended Actions</div>', unsafe_allow_html=True)
        actions: list = state.get("recommended_actions") or []
        if not actions:
            st.caption("No recommended actions.")
        else:
            for action in actions:
                if isinstance(action, dict):
                    action_text = action.get("action", str(action))
                    approval    = action.get("approval_required", False)
                    icon        = "🔐" if approval else "▶️"
                    suffix      = " *(approval required)*" if approval else ""
                    st.markdown(f"{icon} {action_text}{suffix}")
                else:
                    st.markdown(f"▶️ {action}")

    st.divider()

    # -------------------------------------------------------------------------
    # 7. Explanation
    # -------------------------------------------------------------------------
    explanation = state.get("explanation") or state.get("reasoning") or ""
    if explanation:
        st.markdown('<div class="section-hdr">💡 Explanation</div>', unsafe_allow_html=True)
        st.info(explanation)

    st.divider()

    # -------------------------------------------------------------------------
    # 8. Next-Best-Action comparison
    # -------------------------------------------------------------------------
    st.markdown('<div class="section-hdr">⚖️ Next-Best-Action Comparison</div>', unsafe_allow_html=True)

    nba_before = state.get("next_action_before") or {}
    nba_after  = state.get("next_action_after")  or {}

    col_e, col_f = st.columns(2)

    def _render_nba(nba: dict, col, label: str) -> None:
        with col:
            st.markdown(f"**{label}**")
            if not nba:
                st.caption("Not available.")
                return
            if isinstance(nba, dict):
                action   = nba.get("action") or nba.get("recommended_action", "")
                reason   = nba.get("reason") or nba.get("rationale", "")
                conf_nba = nba.get("confidence", nba.get("confidence_after", ""))
                st.markdown(f"**Action:** {action}")
                if reason:
                    st.markdown(f"**Reason:** {reason}")
                if conf_nba:
                    st.markdown(f"**Confidence:** `{conf_nba}`")
            else:
                st.write(nba)

    _render_nba(nba_before, col_e, "🕐 Before More Evidence")
    _render_nba(nba_after,  col_f, "✅ After More Evidence")

    # -------------------------------------------------------------------------
    # Raw state expander (debug)
    # -------------------------------------------------------------------------
    with st.expander("🛠 Raw Agent State (debug)", expanded=False):
        st.json(state)
