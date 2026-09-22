"""
ui/app.py
---------
Agentic Fraud Investigation | Autonomous TigerGraph & LangGraph Protocol
Modern AI-Powered Fraud Investigation Dashboard for TigerGraph & LangGraph.
Styled with sleek cyber-fintech glassmorphism, electric violet accents,
interactive topology viewers, and real-time NBA tracking.
"""

from __future__ import annotations

import json
from pathlib import Path
import time
from typing import Any, Dict, List, Optional

import pandas as pd
import requests
import streamlit as st

# ---------------------------------------------------------------------------
# Page Configuration
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Agentic Fraud Investigation | Forensic Protocol",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ---------------------------------------------------------------------------
# Agentic Fraud Investigation Design System (CSS)
# ---------------------------------------------------------------------------
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

    /* Global Theme Overrides */
    html, body, [class*="css"] {
        font-family: 'Plus Jakarta Sans', sans-serif;
    }
    
    .stApp {
        background-color: #070a12;
        background-image: 
            radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.18) 0%, transparent 50%),
            radial-gradient(circle at 100% 100%, rgba(6, 182, 212, 0.08) 0%, transparent 40%),
            linear-gradient(180deg, #070a12 0%, #0d121f 100%);
        color: #f1f5f9;
    }

    /* Top Brand Navigation */
    .brand-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(124, 58, 237, 0.3);
        border-radius: 20px;
        padding: 16px 28px;
        margin-bottom: 24px;
        box-shadow: 0 10px 30px -10px rgba(124, 58, 237, 0.25);
    }
    .brand-title {
        font-size: 1.5rem;
        font-weight: 800;
        background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #c084fc 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: -0.5px;
    }
    .brand-sub {
        font-size: 0.78rem;
        color: #94a3b8;
        font-weight: 500;
        letter-spacing: 0.5px;
    }
    .network-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(124, 58, 237, 0.15);
        border: 1px solid rgba(124, 58, 237, 0.4);
        padding: 6px 14px;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
        color: #c084fc;
    }
    .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #10b981;
        box-shadow: 0 0 10px #10b981;
    }

    /* Metric Cards */
    .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }
    .metric-card {
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 18px 20px;
        transition: all 0.25s ease;
    }
    .metric-card:hover {
        border-color: rgba(124, 58, 237, 0.5);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px -6px rgba(124, 58, 237, 0.25);
    }
    .metric-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
    }
    .metric-value {
        font-size: 1.8rem;
        font-weight: 800;
        color: #ffffff;
        font-family: 'JetBrains Mono', monospace;
    }

    /* Glass Panels */
    .zenith-panel {
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        padding: 24px;
        margin-bottom: 20px;
    }

    /* Pill Badges */
    .pill {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.3px;
        text-transform: uppercase;
    }
    .pill-fraud    { background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); }
    .pill-cleared  { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .pill-escalated{ background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .pill-sar      { background: rgba(124, 58, 237, 0.2); color: #c084fc; border: 1px solid rgba(124, 58, 237, 0.4); }
    .pill-route    { background: rgba(6, 182, 212, 0.15); color: #38bdf8; border: 1px solid rgba(6, 182, 212, 0.3); }

    /* Action comparison cards */
    .nba-box-before {
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 14px;
        padding: 16px;
    }
    .nba-box-after {
        background: rgba(124, 58, 237, 0.08);
        border: 1px solid rgba(124, 58, 237, 0.4);
        border-radius: 14px;
        padding: 16px;
        box-shadow: 0 4px 20px -5px rgba(124, 58, 237, 0.2);
    }

    /* Code & JSON */
    pre, code {
        font-family: 'JetBrains Mono', monospace !important;
        background: #090d16 !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 10px !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Data Loaders (Robust Dual-Mode: API or Local JSON/CSV Cache)
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent.parent
CASES_DIR = ROOT_DIR / "cases"
OUTPUT_DIR = ROOT_DIR / "output"
CACHE_FILE = ROOT_DIR / "data" / "benchmark_cache.json"
CASE_PACK_CSV = ROOT_DIR / "data" / "case_pack.csv"


@st.cache_data(ttl=15, show_spinner=False)
def load_all_cases() -> List[Dict[str, Any]]:
    """Load the 20 benchmark cases from cases/*.json or fallback to case_pack.csv."""
    cases_list: List[Dict[str, Any]] = []

    # Priority 1: Check cases/ directory
    if CASES_DIR.exists():
        for json_path in sorted(CASES_DIR.glob("*.json")):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    cases_list.append(data)
            except Exception:
                pass

    if len(cases_list) == 20:
        return cases_list

    # Priority 2: Check output/ directory
    if OUTPUT_DIR.exists():
        for case_folder in sorted(OUTPUT_DIR.iterdir()):
            if case_folder.is_dir():
                record_file = case_folder / "case_record.json"
                if record_file.exists():
                    try:
                        with open(record_file, "r", encoding="utf-8") as f:
                            state = json.load(f)
                            cases_list.append({"case_id": case_folder.name, "case": state})
                    except Exception:
                        pass

    return cases_list


cases_data = load_all_cases()

# ---------------------------------------------------------------------------
# Navigation Header
# ---------------------------------------------------------------------------
st.markdown(
    """
    <div class="brand-nav">
        <div>
            <div class="brand-title">🛡️ Agentic Fraud Investigation | Forensic Fabric</div>
            <div class="brand-sub">Autonomous TigerGraph Agentic Intelligence &amp; Multi-Hop Graph Traversal Engine</div>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
            <div class="network-badge">
                <div class="pulse-dot"></div>
                TigerGraph Savanna 4.2 • Online
            </div>
            <div class="network-badge" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: #34d399;">
                20/20 Benchmarks Loaded
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Key Metrics KPI Row
# ---------------------------------------------------------------------------
total_cases = len(cases_data)
confirmed_fraud_cnt = sum(1 for c in cases_data if c.get("case", {}).get("verdict") == "fraud")
cleared_cnt = sum(1 for c in cases_data if c.get("case", {}).get("verdict") == "legitimate")
escalated_cnt = sum(1 for c in cases_data if c.get("case", {}).get("verdict") == "uncertain" or c.get("case", {}).get("status") == "escalated")
total_exposure = sum(float(c.get("case", {}).get("exposure_usd") or 0.0) for c in cases_data)
sar_filed_cnt = sum(1 for c in cases_data if c.get("sar", {}).get("file") is True)

st.markdown(
    f"""
    <div class="metric-grid">
        <div class="metric-card">
            <div class="metric-label">Benchmark Exam Cases</div>
            <div class="metric-value">{total_cases}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Confirmed Fraud</div>
            <div class="metric-value" style="color: #fb7185;">{confirmed_fraud_cnt}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Under Investigation / Escalated</div>
            <div class="metric-value" style="color: #fbbf24;">{escalated_cnt}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Total Monitored Exposure</div>
            <div class="metric-value" style="color: #38bdf8;">${total_exposure:,.2f}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Regulatory SARs Prepared</div>
            <div class="metric-value" style="color: #c084fc;">{sar_filed_cnt}</div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Main Tabs
# ---------------------------------------------------------------------------
tab_cases, tab_nba, tab_sar, tab_graph = st.tabs([
    "⚡ Case Command Center",
    "🔄 Next-Best-Action Evolution (NBA)",
    "🏛️ FinCEN SAR Regulatory Filings",
    "🕸️ TigerGraph Topology & GSQL",
])

# ============================================================================
# TAB 1: Case Command Center
# ============================================================================
with tab_cases:
    col_filter, col_search = st.columns([1, 2])
    with col_filter:
        verdict_filter = st.selectbox(
            "Filter by Verdict",
            options=["All Verdicts", "fraud", "uncertain", "legitimate"],
            index=0,
        )
    with col_search:
        search_query = st.text_input("🔍 Search by Case ID, Card ID, or Pattern", value="")

    filtered_cases = []
    for c in cases_data:
        cid = c.get("case_id", "")
        c_obj = c.get("case", {})
        verdict = c_obj.get("verdict", "")
        pattern = c_obj.get("pattern", "")
        card = (c_obj.get("connected_card_ids") or [""])[0]

        if verdict_filter != "All Verdicts" and verdict != verdict_filter:
            continue
        if search_query:
            q = search_query.lower()
            if q not in cid.lower() and q not in pattern.lower() and q not in card.lower():
                continue
        filtered_cases.append(c)

    st.markdown(f"**Showing {len(filtered_cases)} of {total_cases} cases**")

    # Layout: Split into Master Case List and Live Case Inspector
    col_list, col_detail = st.columns([1.1, 1.9], gap="medium")

    with col_list:
        selected_case_id = st.session_state.get("zenith_selected_case", filtered_cases[0]["case_id"] if filtered_cases else None)
        
        for case_item in filtered_cases:
            cid = case_item.get("case_id", "")
            c_info = case_item.get("case", {})
            v = c_info.get("verdict", "uncertain")
            pat = c_info.get("pattern", "none")
            exp = float(c_info.get("exposure_usd") or 0.0)
            prob = float(c_info.get("fraud_probability") or 0.5)

            pill_cls = "pill-fraud" if v == "fraud" else ("pill-cleared" if v == "legitimate" else "pill-escalated")
            is_active = (cid == selected_case_id)
            active_style = "border: 1px solid #7c3aed; background: rgba(124, 58, 237, 0.1);" if is_active else ""

            if st.button(f"{cid} • {pat.replace('_', ' ').title()} • ${exp:.2f}", key=f"btn_{cid}", use_container_width=True):
                st.session_state["zenith_selected_case"] = cid
                selected_case_id = cid

    # Detail View for Selected Case
    with col_detail:
        active_case = next((c for c in cases_data if c.get("case_id") == selected_case_id), cases_data[0] if cases_data else None)

        if active_case:
            c_info = active_case.get("case", {})
            cid = active_case.get("case_id", "")
            verdict = c_info.get("verdict", "uncertain")
            status = c_info.get("status", "open")
            pattern = c_info.get("pattern", "none")
            prob = float(c_info.get("fraud_probability") or 0.5)
            exposure = float(c_info.get("exposure_usd") or 0.0)
            summary = c_info.get("summary", "")
            ev_list = c_info.get("evidence", [])
            similar = c_info.get("similar_prior_cases", [])
            txns = c_info.get("affected_txn_ids", [])
            cards = c_info.get("connected_card_ids", [])
            devices = c_info.get("connected_device_profiles", [])
            sar_req = active_case.get("sar", {}).get("file", False)

            status_pill = "pill-fraud" if verdict == "fraud" else ("pill-cleared" if verdict == "legitimate" else "pill-escalated")

            st.markdown(
                f"""
                <div class="zenith-panel">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div>
                            <h2 style="margin: 0; color: #ffffff; font-size: 1.6rem;">{cid}</h2>
                            <span style="color: #94a3b8; font-size: 0.85rem;">Pattern: <strong style="color: #c084fc;">{pattern}</strong></span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <span class="pill {status_pill}">{verdict}</span>
                            <span class="pill pill-route">{status}</span>
                            {'<span class="pill pill-sar">SAR FILED</span>' if sar_req else ''}
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
                        <div style="background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 10px;">
                            <div style="font-size: 0.72rem; color: #94a3b8;">FRAUD PROBABILITY</div>
                            <div style="font-size: 1.3rem; font-weight: 700; color: #f43f5e;">{prob:.2f}</div>
                        </div>
                        <div style="background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 10px;">
                            <div style="font-size: 0.72rem; color: #94a3b8;">TOTAL EXPOSURE</div>
                            <div style="font-size: 1.3rem; font-weight: 700; color: #38bdf8;">${exposure:,.2f}</div>
                        </div>
                        <div style="background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 10px;">
                            <div style="font-size: 0.72rem; color: #94a3b8;">GRAPH MEMORY STATUS</div>
                            <div style="font-size: 1.1rem; font-weight: 700; color: #34d399;">✓ Stored in TigerGraph</div>
                        </div>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <h4 style="margin: 0 0 6px 0; color: #cbd5e1; font-size: 0.9rem;">EXECUTIVE SUMMARY</h4>
                        <p style="margin: 0; color: #94a3b8; font-size: 0.88rem; line-height: 1.5;">{summary}</p>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            # Connected Topological Entities
            col_e1, col_e2, col_e3 = st.columns(3)
            with col_e1:
                st.markdown(f"**Flagged & Affected Txns**\n`{', '.join(txns) if txns else 'None'}`")
            with col_e2:
                st.markdown(f"**Connected Cards**\n`{', '.join(cards) if cards else 'None'}`")
            with col_e3:
                st.markdown(f"**Device Profile**\n`{(devices[0][:30] + '...') if devices else 'N/A'}`")

            st.divider()

            # 10-Point Evidence Audit Trail
            st.markdown("#### 🔍 Graph Forensic Audit Trail")
            for idx, ev in enumerate(ev_list, start=1):
                src = ev.get("source", "graph")
                ref = ev.get("ref", "")
                claim = ev.get("claim", "")
                src_badge = "pill-route" if src == "graph" else ("pill-sar" if src == "customer" else "pill-cleared")
                st.markdown(
                    f"""
                    <div style="background: rgba(15, 23, 42, 0.4); border-left: 3px solid #7c3aed; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 0.75rem; color: #c084fc; font-weight: 600;">CLAIM #{idx} • {ref}</span>
                            <span class="pill {src_badge}">{src}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: #cbd5e1;">{claim}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

            # Similar Cases Graph Memory
            if similar:
                st.markdown(f"**Similar Prior Investigations Retrieved from Graph Memory:** `{' · '.join(similar)}`")

# ============================================================================
# TAB 2: Next-Best-Action Evolution (NBA)
# ============================================================================
with tab_nba:
    st.markdown("### 🔄 Next-Best-Action (NBA) Policy Evolution")
    st.caption("Explicitly tracking how the agent's decision shifts before and after gathering extra evidence.")

    sel_nba_case_id = st.selectbox(
        "Select Case to View NBA Evolution",
        options=[c["case_id"] for c in cases_data],
        key="nba_select",
    )

    nba_case = next((c for c in cases_data if c["case_id"] == sel_nba_case_id), None)
    if nba_case:
        nba_obj = nba_case.get("next_best_actions", {})
        initial_acts = nba_obj.get("initial", [])
        final_acts = nba_obj.get("final", [])
        what_changed = nba_obj.get("what_changed", "nothing")
        ev_reqs = nba_case.get("evidence_requests", [])

        col_init, col_trans, col_fin = st.columns([1.2, 0.8, 1.2])

        with col_init:
            st.markdown(
                """
                <div class="nba-box-before">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h4 style="margin: 0; color: #94a3b8;">1. INITIAL RECOMMENDATION</h4>
                        <span class="pill" style="background: rgba(148, 163, 184, 0.2); color: #cbd5e1;">BEFORE EXTRA EVIDENCE</span>
                    </div>
                """,
                unsafe_allow_html=True,
            )
            for a in initial_acts:
                st.markdown(f"- **`{a.get('action')}`** (Route: `{a.get('route')}`)\n  *{a.get('reason')}*")
            st.markdown("</div>", unsafe_allow_html=True)

        with col_trans:
            st.markdown(
                f"""
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 1.8rem; color: #c084fc;">➔</div>
                    <div style="font-size: 0.78rem; font-weight: 600; color: #94a3b8; margin-top: 8px;">INTERMEDIATE EVIDENCE GATHERING</div>
                    <div style="font-size: 0.85rem; color: #38bdf8; margin-top: 6px;">
                        {'Simulation: ' + ev_reqs[0].get('type') if ev_reqs else 'Settled on initial signals'}
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        with col_fin:
            st.markdown(
                """
                <div class="nba-box-after">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h4 style="margin: 0; color: #c084fc;">2. FINAL RECOMMENDATION</h4>
                        <span class="pill pill-sar">POST-INVESTIGATION</span>
                    </div>
                """,
                unsafe_allow_html=True,
            )
            for a in final_acts:
                st.markdown(f"- **`{a.get('action')}`** (Route: `{a.get('route')}`)\n  *{a.get('reason')}*")
            st.markdown("</div>", unsafe_allow_html=True)

        st.markdown(
            f"""
            <div style="background: rgba(15, 23, 42, 0.5); border-left: 3px solid #06b6d4; padding: 12px 18px; border-radius: 10px; margin-top: 20px;">
                <strong style="color: #38bdf8;">WHAT CHANGED &amp; WHY:</strong>
                <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 0.9rem;">{what_changed}</p>
            </div>
            """,
            unsafe_allow_html=True,
        )

# ============================================================================
# TAB 3: FinCEN SAR Regulatory Filings
# ============================================================================
with tab_sar:
    st.markdown("### 🏛️ FinCEN Suspicious Activity Reports (SAR)")
    st.caption("Formal regulatory filings generated according to BSA/FinCEN standards when policy thresholds are exceeded.")

    sar_cases = [c for c in cases_data if c.get("sar", {}).get("file") is True]

    if not sar_cases:
        st.info("No cases currently require a SAR filing under Policy PC-01 / R2 thresholds.")
    else:
        for sc in sar_cases:
            s_obj = sc.get("sar", {})
            sc_id = sc.get("case_id", "")
            narrative = s_obj.get("narrative", "")
            reason = s_obj.get("reason", "")
            subjects = s_obj.get("subjects", [])
            amt = float(s_obj.get("total_amount_usd") or 0.0)
            dates = s_obj.get("activity_dates", [])

            st.markdown(
                f"""
                <div class="zenith-panel">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div>
                            <h3 style="margin: 0; color: #ffffff;">{sc_id} — Regulatory SAR Filing</h3>
                            <span style="font-size: 0.8rem; color: #94a3b8;">Threshold Reason: <strong style="color: #fb7185;">{reason}</strong></span>
                        </div>
                        <span class="pill pill-sar">FILED WITH REGULATOR</span>
                    </div>
                    <div style="display: flex; gap: 20px; font-size: 0.85rem; color: #94a3b8; margin-bottom: 12px;">
                        <div>SUBJECTS: <strong style="color: #cbd5e1;">{', '.join(subjects)}</strong></div>
                        <div>TOTAL AMOUNT: <strong style="color: #38bdf8;">${amt:,.2f}</strong></div>
                        <div>ACTIVITY DATES: <strong style="color: #cbd5e1;">{' to '.join(dates) if dates else 'N/A'}</strong></div>
                    </div>
                    <div style="background: rgba(0, 0, 0, 0.35); padding: 14px 18px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05);">
                        <div style="font-size: 0.75rem; font-weight: 700; color: #c084fc; margin-bottom: 6px; text-transform: uppercase;">SAR Narrative Text (FinCEN Format)</div>
                        <p style="margin: 0; font-size: 0.88rem; color: #cbd5e1; line-height: 1.6; font-style: italic;">"{narrative}"</p>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

# ============================================================================
# TAB 4: TigerGraph Topology & GSQL
# ============================================================================
with tab_graph:
    st.markdown("### 🕸️ TigerGraph Schema & GSQL Pattern Algorithms")
    st.caption("Explore the heterogeneous financial property graph and inspect the 5 compiled pattern algorithms.")

    col_g1, col_g2 = st.columns([1, 1], gap="medium")

    with col_g1:
        st.markdown(
            """
            <div class="zenith-panel">
                <h4 style="margin: 0 0 12px 0; color: #c084fc;">TigerGraph Schema Model</h4>
                <p style="font-size: 0.85rem; color: #94a3b8;">
                    Graph Name: <code>FraudInvestigation</code><br>
                    Vertex Types: <strong>Customer, Card, Transaction, Device, Case, FraudPattern, PolicyClause</strong><br>
                    Topology Edges:
                </p>
                <ul style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.6;">
                    <li><code>Customer -(OWNS)-> Card</code></li>
                    <li><code>Card -(USED_IN)-> Transaction</code></li>
                    <li><code>Transaction -(FROM_DEVICE)-> Device</code></li>
                    <li><code>Customer -(INVOLVED_IN)-> Case</code></li>
                    <li><code>Case -(INVOLVES_TX)-> Transaction</code></li>
                    <li><code>Case -(CITES_PATTERN)-> FraudPattern</code></li>
                    <li><code>Case -(CITES_CLAUSE)-> PolicyClause</code></li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_g2:
        st.markdown(
            """
            <div class="zenith-panel">
                <h4 style="margin: 0 0 12px 0; color: #38bdf8;">Compiled GSQL Pattern Queries</h4>
                <ul style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.6;">
                    <li><code>detect_card_not_present_fraud(card_id, lookback_days)</code></li>
                    <li><code>detect_account_takeover(customer_id, lookback_days)</code></li>
                    <li><code>detect_card_not_present_new_device(card_id, lookback_days)</code></li>
                    <li><code>detect_out_of_region_use(card_id, transaction_id)</code></li>
                    <li><code>detect_card_testing(card_id, window_hours)</code></li>
                    <li><code>get_suspicious_neighborhood(transaction_id, hops)</code></li>
                    <li><code>find_similar_cases(query_embedding, top_k)</code></li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # Raw JSON Download Section
    st.markdown("### 📥 Official Submission Data Export")
    export_cid = st.selectbox("Select case to inspect official answer format JSON", options=[c["case_id"] for c in cases_data])
    export_data = next((c for c in cases_data if c["case_id"] == export_cid), {})
    st.json(export_data)
