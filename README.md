# 🔍 TigerGraph Agentic Fraud Investigation

An end-to-end **agentic fraud investigation system** built on TigerGraph Savanna, powered by a LangGraph state-machine agent, Google Gemini LLM, and vector-embedding similarity search. Given a fraud alert, the agent autonomously queries the graph, matches known fraud patterns, retrieves similar past cases, recommends actions, decides SAR filing, and writes the investigation result back to the graph — all without human in the loop.

---

## Architecture

```
IEEE-CIS Dataset (CSV)
        │
        ▼
 [ load_data.py ]  ────────────────────────────────────────────────┐
        │                                                           │
        ▼                                                           │
 TigerGraph Savanna                                                 │
  ┌─────────────────────────────────────────────────────────────┐  │
  │  Vertices: Transaction, Card, Customer, Device, IP, MerchCat│  │
  │  Edges:    used_card, has_device, located_at, belongs_to …  │  │
  │  GSQL Queries: pattern_match, ring_detection, velocity …    │  │
  └──────────────┬──────────────────────────────────────────────┘  │
                 │  pyTigerGraph                                     │
                 ▼                                                   │
        [ LangGraph Agent ]                                         │
         ┌──────────────────────────────────────────────────────┐   │
         │  Node 1 — ingest_case        (load & validate input) │   │
         │  Node 2 — retrieve_context   (graph neighbourhood)   │   │
         │  Node 3 — match_patterns     (5 GSQL pattern queries) │  │
         │  Node 4 — retrieve_similar   (vector embedding RAG)  │   │
         │  Node 5 — decision           (Gemini LLM reasoning)  │   │
         │  Node 6 — next_best_action   (NBA before/after)      │   │
         │  Node 7 — write_to_graph     (persist verdict)       │   │
         │  Node 8 — format_output      (final state)           │   │
         └──────────────┬───────────────────────────────────────┘   │
                        │                                            │
                        ▼                                            │
              [ FastAPI Backend ]                                     │
               POST /investigate                                     │
               GET  /cases                                           │
               GET  /cases/{case_id}                                 │
               GET  /health                                          │
                        │                                            │
                        ▼                                            │
              [ Streamlit Dashboard ]  ◄──────────────────────────── ┘
               Case List (colour-coded)
               Case Detail (timeline, patterns, NBA)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Graph DB | TigerGraph Savanna (cloud) |
| Graph Client | pyTigerGraph |
| Graph Queries | GSQL |
| Agent Framework | LangGraph (state machine) |
| LLM | Google Gemini (`gemini-2.0-flash` or `gemini-3.6-flash`) |
| Embeddings | Google `text-embedding-004` |
| Vector Search | TigerGraph vector store via pyTigerGraph |
| Backend API | FastAPI + Uvicorn |
| Dashboard | Streamlit |
| Config | python-dotenv |
| Dataset | IEEE-CIS Fraud Detection (HHGOA variant) |

---

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/<your-org>/tigergraph-fraud-investigation.git
cd tigergraph-fraud-investigation
```

### 2. Create and Activate Virtual Environment
```powershell
py -3 -m venv .venv
.venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
```bash
copy .env.example .env
```
Edit `.env` and fill in all required values:
```dotenv
# TigerGraph Savanna
TG_HOST=https://<your-host>.i.tgcloud.io
TG_USERNAME=tigergraph
TG_PASSWORD=<your-password>
TG_GRAPH_NAME=FraudGraph
TG_SECRET=<your-secret>

# Google AI (Gemini + Embeddings)
GOOGLE_API_KEY=<your-google-ai-api-key>

# Optional
LOG_LEVEL=INFO
OUTPUT_DIR=D:\hakern\output
```

### 5. Provision TigerGraph Savanna
1. Sign up / log in at [savanna.tgcloud.io](https://savanna.tgcloud.io)
2. Create a new **TG Cloud** cluster (free tier is sufficient for the dataset)
3. Note the host, username, password, and graph name — add to `.env`

### 6. Create the Schema
```bash
gsql schema/schema.gsql
```
Or via the TigerGraph Studio UI — paste the contents of `schema/schema.gsql`.

### 7. Load the Dataset
```bash
python scripts/load_data.py    # loads IEEE-CIS transaction & identity data
python scripts/load_cases.py   # loads 20 benchmark investigation cases
```

### 8. Embed Cases for RAG
```bash
python scripts/embed_cases.py  # generates text-embedding-004 vectors for all cases
```

### 9. Start the API Server
```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### 10. Start the Streamlit Dashboard
```bash
streamlit run ui/app.py
```
Open [http://localhost:8501](http://localhost:8501) in your browser.

### 11. Run the Benchmark
```bash
python scripts/run_benchmark.py
```
Output files land in `D:\hakern\output\{case_id}\`.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **LangGraph over raw chains** | Explicit state machine gives deterministic node order; edges can branch on confidence threshold for conditional re-investigation |
| **TigerGraph for fraud graphs** | Native graph traversals (BFS, pattern matching, ring detection) at scale; GSQL gives millisecond hop queries |
| **Vector RAG for similar cases** | text-embedding-004 embeddings stored in TG allow semantic retrieval of past cases without a separate vector DB |
| **Gemini for reasoning** | Multimodal-capable, long-context; structured JSON output via `response_schema` eliminates fragile regex parsing |
| **FastAPI + thread pool** | Agent calls are I/O-bound (network to TG + Gemini); offloading to `run_in_executor` keeps the event loop free |
| **Read-only Streamlit** | Dashboard is purely observational; all mutations go through the auditable FastAPI layer |
| **SAR auto-filing** | Agent decides `sar_required` in the decision node; benchmark script writes `sar.json` for downstream compliance systems |

---

## 5 Fraud Patterns

| Pattern | Description | Key Graph Signals |
|---|---|---|
| `card_not_present_fraud` | Card used for online purchases without physical card present | High CNP velocity, new merchant categories, foreign IPs |
| `account_takeover` | Attacker gains control of a legitimate account | Password reset + device change + large transfer within 24 h |
| `card_not_present_new_device` | CNP transactions from a device never previously seen for the card | New device fingerprint + CNP flag + first-time merchant |
| `out_of_region_use` | Card used far from the cardholder's home region | Geo-distance between billing address and transaction IP |
| `card_testing` | Attacker makes micro-transactions to verify a stolen card before cashing out | Many low-value transactions in rapid succession on same card |

---

## Project Structure

```
D:\hakern\
├── agent\
│   ├── __init__.py
│   ├── graph.py            # LangGraph state machine (8 nodes)
│   ├── nodes\
│   │   ├── ingest.py
│   │   ├── retrieve_context.py
│   │   ├── match_patterns.py
│   │   ├── retrieve_similar.py
│   │   ├── decision.py
│   │   ├── next_best_action.py
│   │   ├── write_to_graph.py
│   │   └── format_output.py
│   ├── tools\
│   │   ├── tg_queries.py   # GSQL query wrappers
│   │   └── embeddings.py   # text-embedding-004 helpers
│   └── state.py            # TypedDict / dataclass for agent state
├── api\
│   └── main.py             # FastAPI backend
├── ui\
│   └── app.py              # Streamlit dashboard
├── scripts\
│   ├── load_data.py
│   ├── load_cases.py
│   ├── embed_cases.py
│   └── run_benchmark.py    # Benchmark runner
├── schema\
│   └── schema.gsql         # TigerGraph schema DDL
├── data\
│   └── case_pack.csv       # 20 benchmark cases
├── output\                 # Auto-created; one sub-dir per case
├── .env.example
├── requirements.txt
└── README.md
```

---

## Hackathon Submission Checklist

- [x] TigerGraph Savanna graph with IEEE-CIS schema and loaded data
- [x] GSQL queries for all 5 fraud patterns
- [x] LangGraph agent with 8 nodes (ingest → retrieve → pattern match → RAG → decision → NBA → write → output)
- [x] Google Gemini LLM for decision reasoning (structured JSON output)
- [x] text-embedding-004 RAG for similar case retrieval
- [x] FastAPI backend with `/investigate`, `/cases`, `/cases/{case_id}`, `/health`
- [x] Streamlit read-only dashboard with Case List + Case Detail views
- [x] Benchmark runner for all 20 cases with JSON output files
- [x] SAR auto-filing logic (`sar.json` written when `sar_required=True`)
- [x] Next-Best-Action before/after evidence comparison
- [x] `case_written_to_graph` assertion validated in benchmark
- [x] Complete README with architecture, setup, design decisions
- [x] All secrets in `.env` (never committed)
- [x] `requirements.txt` with pinned versions

---

> **Hackathon:** TigerGraph 2025 Agentic AI Challenge  
> **Team:** [Your Team Name]  
> **Submitted:** September 2026
