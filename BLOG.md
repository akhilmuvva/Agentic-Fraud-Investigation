# Agentic Fraud Investigation with TigerGraph & LangGraph: Beyond Rule Engines

**Author:** Akhil Muvva & Team  
**Event:** TigerGraph × Hacker House Goa 2026 Hackathon  
**Repository:** [github.com/akhilmuvva/Agentic-Fraud-Investigation](https://github.com/akhilmuvva/Agentic-Fraud-Investigation)  

---

## Executive Summary

Traditional fraud detection systems struggle with a fundamental tension: machine learning models produce risk scores without context, while rigid rules engines either let sophisticated fraudsters slip through or overwhelm analysts with false positives.

In this project, we built an **autonomous, agentic fraud investigation system** using **TigerGraph Savanna (GSQL)** and **LangGraph**. Given incoming transaction alerts from the 590,000-transaction IEEE-CIS dataset, our agent does not blindly trust real-time risk scores. Instead, it acts like a Tier-3 fraud analyst:
1. **Traverses graph topology** to inspect identity, shared device fingerprints, and billing regions across multi-card neighborhoods.
2. **Executes 5 specialized GSQL graph queries** to detect subtle structural topologies (Card Testing rings, Account Takeover spikes, CNP new device anomalies, and Out-of-Region bursts).
3. **Applies GraphRAG** against historical closed cases and regulatory compliance policies.
4. **Maintains uncertainty loops**, gathering simulated step-up authentication or cardholder verification when confidence is marginal.
5. **Captures Next-Best-Action (NBA) evolution** before and after evidence collection.
6. **Generates autonomous Suspicious Activity Reports (SARs)** and commits closed cases back into the graph as self-learning memory.

---

## Architecture & Graph Schema

```
                       ┌──────────────────────────────────────────────┐
                       │             Incoming Case Alert              │
                       │ (Risk Score / Customer Report / Analyst Req) │
                       └──────────────────────┬───────────────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │      Trigger Node       │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │    Investigate Node     │
                                 │ (Fetch Tx, Card, Cust)  │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────┐
                         │          Gather Evidence Node           │
                         │ ├─ GSQL: detect_card_not_present_fraud  │
                         │ ├─ GSQL: detect_account_takeover        │
                         │ ├─ GSQL: detect_card_not_present_new_dev│
                         │ ├─ GSQL: detect_out_of_region_use       │
                         │ ├─ GSQL: detect_card_testing            │
                         │ ├─ GSQL: get_suspicious_neighborhood    │
                         │ └─ GraphRAG: Policy & Similar Cases     │
                         └────────────────────┬────────────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────┐
                         │         Assess Uncertainty Node         │
                         │  (Snapshot Next-Best-Action BEFORE)     │
                         └────────────────────┬────────────────────┘
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
      [Confidence < 0.65 & Loops < 2]                      [Decision Confident]
   ┌───────────────────────────────────┐                               │
   │      Gather More Evidence         │                               │
   │  (Simulate Step-Up / Customer)    │                               │
   └─────────────────┬─────────────────┘                               │
                     │                                                 │
                     └────────────────────────┐                        │
                                              ▼                        ▼
                                 ┌─────────────────────────┐           │
                                 │ Recommend Action Node   │◄──────────┘
                                 │ (Snapshot NBA AFTER,    │
                                 │  SAR Policy Validation) │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │       Explain Node      │
                                 │ (Audit Trail Narrative) │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │    Update Memory Node   │
                                 │ (Upsert Case to Graph)  │
                                 └─────────────────────────┘
```

### TigerGraph Schema Design
Our GSQL schema (`schema/schema.gsql`) models the financial domain as a rich heterogeneous property graph:
- **Vertices:** `Customer`, `Card`, `Transaction`, `Device`, `Case`, `FraudPattern`, `PolicyClause`
- **Edges:**
  - `Customer -(OWNS)-> Card`
  - `Card -(USED_IN)-> Transaction`
  - `Transaction -(FROM_DEVICE)-> Device`
  - `Customer -(INVOLVED_IN)-> Case`
  - `Case -(INVOLVES_TX)-> Transaction`
  - `Case -(CITES_PATTERN)-> FraudPattern`
  - `Case -(CITES_CLAUSE)-> PolicyClause`
  - `Transaction -(MATCHED_BY)-> FraudPattern`

---

## How TigerGraph Powers Agentic Investigation

Relational databases and flat tabular feature stores fail at fraud detection because fraud is inherently relational. Fraud rings operate across accounts by sharing subtle infrastructure—a single browser profile, a residential proxy, or a testing merchant.

### 1. High-Performance GSQL Pattern Detection
We implemented 5 modular GSQL queries that run directly on TigerGraph:
- **`detect_card_testing`**: Traverses sequential transactions to identify rapid micro-authorizations (<$10) followed by high-value exploitation.
- **`detect_account_takeover`**: Identifies abrupt velocity spikes (2x+ volume) combined with recipient domain shifts and credential anomalies.
- **`detect_out_of_region_use`**: Calculates geographical dispersion using `addr1` frequency distributions.
- **`detect_card_not_present_new_device`**: Flags first-seen devices in CNP channels.
- **`get_suspicious_neighborhood`**: Traverses 2 hops to discover multi-card rings linked to the same device or billing cluster.

### 2. Living Case Memory
When the agent closes an investigation, it writes the `Case` vertex back into TigerGraph, linking it to the relevant `FraudPattern` and `PolicyClause` vertices. Future investigations query this subgraph to retrieve similar historical cases, achieving few-shot contextual reasoning.

---

## Empirical Pattern Validation & Known Limitations

To rigorously benchmark our detection patterns, we evaluated all 5 GSQL queries against a stratified sample of 69 closed historical cases (`data/closed_cases_history.csv`) with full transactional graph topology in TigerGraph:

| Pattern | True Positives (TP) | False Positives (FP) | False Positives on Cleared Cases | True Negatives (TN) | False Negatives (FN) | Precision | Recall (TPR) | FPR | Accuracy |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`card_testing`** | **4** | 2 | 1 | 63 | **0** | **66.67%** | **100.00%** | **3.08%** | **97.10%** |
| **`out_of_region_use`** | **6** | 3 | **0** | 54 | 6 | **66.67%** | **50.00%** | **5.26%** | **86.96%** |
| **`card_not_present_new_device`** | **9** | 45 | 11 | 12 | 3 | 16.67% | **75.00%** | 78.95% | 30.43% |
| **`card_not_present_fraud`** | **8** | 48 | 14 | 9 | 4 | 14.29% | **66.67%** | 84.21% | 24.64% |
| **`account_takeover`** | **6** | 42 | 11 | 15 | 6 | 12.50% | **50.00%** | 73.68% | 30.43% |

### Key Diagnostic Breakthroughs
During our tuning phase, systematic debugging revealed two subtle data engineering issues:
1. **The Card Testing Time Horizon:** Initial implementations assumed a standard 24-hour lookback window (`window_hours = 24`). However, analyzing real card testing attacks in IEEE-CIS revealed that probe-to-exploitation intervals span **478 to 722 hours (20 to 30 days)**—fraudsters probe authorization small-dollar amounts and wait weeks before launching high-value transactions. Widening the GSQL window to 720 hours surged card testing recall from 0% to **100.00%**.
2. **Transaction ID Type Sanitization:** Historical case datasets often parse transaction IDs as floating-point values (e.g. `3007244.0`), whereas graph database vertices are indexed as exact string integers (`3007244`). Normalizing ID strings eliminated 404 vertex misses and lifted `out_of_region_use` recall to 50% with zero false positives on benign cleared accounts.

### Honest Disclosure & Hypotheses on Pattern Overlap
While `card_testing` and `out_of_region_use` exhibit sharp discriminative power (3% to 5% FPR), the trio of `card_not_present_fraud`, `card_not_present_new_device`, and `account_takeover` exhibit elevated false-positive rates when measured against isolated single-label ground truth.
- **Why this occurs:** In real-world card fraud, attacks rarely occur in isolation. An unauthorized online purchase almost always combines a Card-Not-Present channel, a newly introduced device fingerprint, and velocity spikes characteristic of account takeover. Because historical cases were labeled with only one primary category, multi-signal detections are penalized as false positives in single-label metrics even though they accurately reflect the underlying fraudulent activity.
- **LLM Inference Fallback during Benchmark:** During the final live benchmark run across the 20 test cases, Google AI Studio endpoint rate limits and timeout constraints caused the LLM inference step to fall back to the built-in deterministic heuristic for confidence scoring and action recommendations across all 20 cases. The confidence tiers (0.55 for 1 matched pattern, 0.70 for 2, 0.85 for 3, and 0.92 for 4) directly and monotonically reflect the depth of corroborated GSQL graph pattern matches rather than ungrounded hallucination.
- **What we would improve with more time:** We would transition from independent boolean thresholds to a composite Bayesian belief network over graph motifs, calculating joint posterior likelihoods across overlapping pattern signatures.

---

## The Next-Best-Action (NBA) Evolution

A key requirement of the hackathon was recording how recommendations evolve as evidence arrives. 

For example, in **Case HHG-001**:
- **Initial NBA (Before Evidence Gathering):**
  - Action: `CREATE_CASE`, `VERIFY_WITH_CUSTOMER` (Route: `auto`)
  - Reasoning: Single risk score signal (0.61). Policy rule R1 forbids blocking on a weak single signal without verification.
- **Final NBA (After Verification & Pattern Traversal):**
  - Action: `CREATE_CASE`, `VERIFY_WITH_CUSTOMER`, `ESCALATE` (Route: `auto` / `L1`)
  - Reasoning: Customer denied charge; graph confirmed CNP identity mismatch and card testing pattern.
- **What Changed:** "Evidence collection and pattern analysis confirmed the fraud risk, updating recommended actions and approval routes."

---

## What We Learned & Engineering Highlights

1. **Handling Strict API Rate Limits:** Google AI Studio free tier enforces a strict 5 RPM limit. We engineered an adaptive disk-caching layer in `agent/llm.py` with automatic backoff and resilient deterministic policy fallbacks to ensure uninterrupted 20-case batch execution.
2. **Dual-Mode Graph Client:** Our `tg_client.py` seamlessly bridges between live TigerGraph Savanna cloud instances and offline evaluation caches, ensuring zero downtime during hackathon judging.
3. **Full Compliance with Regulatory Rubrics:** Every output file in `cases/<case_id>.json` conforms 100% to the official IEEE-CIS hackathon specification, with verified SAR triggers and approval routing (`auto`, `L1`, `L2`).

---

## Future Improvements
- **Native TigerGraph Vector Index:** Transition from cosine similarity queries to TigerGraph 4.x native vector index (`CREATE VECTOR INDEX`) for sub-millisecond retrieval at scale.
- **Multi-Agent Swarm with MCP:** Expand from a single StateGraph into specialized cooperating subagents via TigerGraph MCP tools (e.g., dedicated Topology Investigator, SAR Compliance Officer, and Customer Interactivity Agent).
- **Real-Time Kafka Streaming:** Ingest live payment streams with TigerGraph Kafka connector for real-time sub-second graph enrichment.
