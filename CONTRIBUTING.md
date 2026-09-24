# Contributing to TigerGraph Agentic Fraud Investigation

Thank you for your interest in contributing to the **TigerGraph Agentic Fraud Investigation** project, developed for the **TigerGraph 2025 Agentic AI Challenge**!

---

## 👥 Core Contributors & Team PolyLance

- **[@sunny200551](https://github.com/sunny200551)** — **Frontend Lead & UI/UX Architect**
  - Architected and built the full modern neumorphic design system (Light & Dark mode).
  - Engineered the interactive 3D TigerGraph neighborhood visualizer using React Three Fiber (`@react-three/fiber` & `three.js`).
  - Redesigned the primary Dashboard: KPI metric cards with live count-up animations, high-contrast filter system, and verdict-coded case cards.
  - Implemented the LangGraph 8-node live pipeline rail and audit log timelines.
  - Built offline static case caching and automated GitHub Pages deployment.

- **[@akhilmuvva](https://github.com/akhilmuvva)** — **Repository Owner & Backend / Agent Architect**
  - TigerGraph Savanna schema design and GSQL query suite (graph algorithms, pattern matching, community detection).
  - LangGraph 8-node state machine pipeline integration with Gemini 2.0 Flash reasoning.
  - Vector similarity search (RAG) and FastAPI service layer.

---

## 🚀 Development Workflow

### Prerequisites
- **Node.js** >= 20.x
- **Python** >= 3.10
- **npm** >= 10.x

### 1. Repository Setup
Clone the repository and install frontend dependencies:
```bash
git clone https://github.com/akhilmuvva/Agentic-Fraud-Investigation.git
cd Agentic-Fraud-Investigation
cd frontend
npm install
```

### 2. Branching Strategy
- `main`: Production-ready release branch deployed live to GitHub Pages.
- `dev.sunny`: Active frontend feature and UI development branch.
- `feature/<name>`: New standalone feature branches created off `dev.sunny`.

### 3. Local Development
Run the Vite development server:
```bash
cd frontend
npm run dev
```

Optional: Run the static case server (for local mock testing without live credentials):
```bash
python static_server.py
```

### 4. Quality & Build Checks
Before submitting or merging:
```bash
cd frontend
npm run build
```
Ensure TypeScript checks (`tsc -b`) and Vite production bundle pass with zero errors.

---

## 📋 Code of Conduct & Pull Request Guidelines
1. Always open pull requests against `dev.sunny` or `main`.
2. Provide clear, descriptive commit messages following Conventional Commits (`feat:`, `fix:`, `ci:`, `docs:`).
3. Preserve established neumorphic styling tokens, accessibility conventions, and `prefers-reduced-motion` compliance.

Thank you for contributing!
