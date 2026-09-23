# Frontend — TigerGraph Agentic Fraud Investigation

React + TypeScript + Vite frontend replacing the Streamlit `ui/app.py`. All mutations go through the auditable FastAPI layer; this UI is strictly read-only except for `POST /investigate`.

## Quick Start

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

The dev server proxies `/investigate`, `/cases`, `/health`, and `/api` to `http://localhost:8000`.

## Environment

Copy `.env.local` (already included) or set `VITE_API_BASE_URL` to point to your FastAPI backend:

```
VITE_API_BASE_URL=http://localhost:8000
```

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| 3D Graph | React Three Fiber + drei + Three.js |
| Charts | Recharts |
| Routing | React Router v7 |

## Screens

1. **Case List** (`/`) — all investigated cases with filters, stats, new investigation drawer
2. **Case Detail** (`/cases/:caseId`) — 3D graph, patterns, similar cases, decision, NBA, SAR
3. **Health** — always-visible status indicator in header

## Key Design Decisions

- **TEMPORARY/MOCK** annotations: `CaseGraphExplorer` reconstructs the graph topology client-side from entity ID fields since `GET /cases/{id}` doesn't expose a raw neighborhood subgraph. See code comments.
- **Agent Pipeline**: Timing is estimated (~14.5s / 8 nodes ≈ 1.8s each) since the backend has no streaming endpoint.
- **Dark mode**: Toggle via the 🌙 button in the header. CSS variables in `index.css` provide the full dark palette ready to style.
- **Reduced motion**: `CaseGraphExplorer` falls back to a 2D node grid when `prefers-reduced-motion` is set.

## Do Not Touch

`/agent`, `/api`, `/schema`, `/scripts`, `/ui` — backend is production-locked.
