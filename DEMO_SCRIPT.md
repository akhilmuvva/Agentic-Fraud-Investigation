# 3–5 Minute Video Demo Script

**Project:** TigerGraph Agentic Fraud Investigation  
**Repository:** [github.com/akhilmuvva/Agentic-Fraud-Investigation](https://github.com/akhilmuvva/Agentic-Fraud-Investigation)  

---

### [0:00 – 0:45] Introduction & The Problem
**Voiceover:**  
"Hello everyone! This is our submission for the TigerGraph × Hacker House Goa 2026 Hackathon: the **Autonomous Agentic Fraud Investigation System**.  
In fraud operations, banks face a massive challenge: statistical models produce risk scores, but risk scores lack context. A score of 0.8 might just be a traveler buying a phone, while a score of 0.5 might be a sophisticated card testing ring.  
Our solution uses **TigerGraph Savanna** combined with a **LangGraph state machine** to autonomously investigate transaction alerts, gather topological evidence, evaluate uncertainty, and recommend defensible actions according to bank policy."

---

### [0:45 – 1:30] Architecture & TigerGraph GSQL Graph Queries
*(Show architecture diagram from README.md or BLOG.md, then switch to VS Code displaying `schema/schema.gsql` and `gsql/patterns/`)*  
**Voiceover:**  
"Here is our architecture:
Our graph schema models Customers, Cards, Transactions, Devices, and historical Cases.  
We built 5 custom GSQL queries that execute graph algorithms directly in TigerGraph:
1. `detect_card_testing`: Finds rapid low-value probe authorizations preceding large attacks.
2. `detect_account_takeover`: Identifies transaction volume spikes and credential shifts.
3. `detect_card_not_present_new_device`: Checks for first-seen device fingerprints.
4. `detect_out_of_region_use`: Flags statistical divergence from historical billing regions.
5. `get_suspicious_neighborhood`: Performs multi-hop traversals to catch shared device rings.  
Each closed case is also written back to TigerGraph as persistent case memory for future GraphRAG retrieval."

---

### [1:30 – 2:45] Live Streamlit UI & Investigation Walkthrough
*(Terminal command: `streamlit run ui/app.py`)*  
*(Screen displays Streamlit dashboard at http://localhost:8501)*  
**Voiceover:**  
"Let’s see the system in action via our analyst dashboard.  
On the **Case List** tab, we can monitor all 20 benchmark alerts.  
Let’s drill into **Case HHG-001**:
- Notice the **Trigger**: A real-time model scored transaction 3514030 at 0.61.
- Here is the key requirement: **Next-Best-Action Evolution**:
  - **Before extra evidence**: The agent recommended `CREATE_CASE` and `VERIFY_WITH_CUSTOMER` under Policy Rule R1 (verify before blocking on a single signal).
  - **During the investigation**: The agent simulated customer outreach, where the cardholder denied the charge, and the graph detected CNP identity mismatches and card testing patterns.
  - **After extra evidence**: The recommendation updated to `BLOCK_CARD`, `CREATE_CASE`, and `ESCALATE` with required L1 team lead approval!
- Below, you can see the complete step-by-step evidence audit trail and the narrative explanation."

---

### [2:45 – 3:45] Batch Benchmark & Official Output Submission
*(Show terminal running `python scripts/run_benchmark.py` and display the final summary table)*  
**Voiceover:**  
"Now let's examine the batch benchmark runner.  
By running `python scripts/run_benchmark.py`, our agent processes all 20 held-out cases fully automatically without any human intervention.  
As you can see on screen:
**Passed: 20/20!**  
All 20 official submission files are generated inside the `cases/` directory: `HHG-001.json` through `HHG-020.json`.  
Each file contains the complete case record, graph write verification, evidence claims, before-and-after next-best-actions, and regulatory SAR filings whenever exposure exceeds policy thresholds."

---

### [3:45 – 4:00] Conclusion
**Voiceover:**  
"All code, schemas, and benchmark answer files are open source on GitHub at `github.com/akhilmuvva/Agentic-Fraud-Investigation`.  
Thank you to TigerGraph for an awesome hackathon!"
