# RECShield

Fraud detection and verification for Renewable Energy Certificates (RECs). A FastAPI backend
scores every certificate against five independent checks — physics plausibility, duplicate/double
counting, meter-vs-claim mismatch, ML anomaly detection, and ownership-graph wash-trading patterns
— and a React frontend gives auditors a role-scoped dashboard to investigate what it finds, backed
by a real SHA-256 hash-chained ledger and a public, no-login certificate verification page.

Built against a fraud-detection problem statement (see `docs/requirements-coverage.md` for the
full requirement-by-requirement traceability matrix).

## What it actually does

- **Physics plausibility** (`app/engines/physics.py`) — estimates expected output from a plant's
  capacity and historical solar irradiance (via `pvlib`'s PVWatts model, backfilled from the
  Open-Meteo archive API when local data is missing) and compares it against the claimed/metered
  energy.
- **Duplicate / double-counting detection** (`app/engines/duplicate.py`) — SHA-256 fingerprints
  generation events (plant + meter + interval + quantity) to catch exact re-certification, plus a
  day-overlap heuristic across a plant's other certificates.
- **ML anomaly detection** (`app/engines/anomaly.py`) — a scikit-learn Isolation Forest
  (`backend/ml/train_anomaly.py`) trained on six features per REC (claim ratios, capacity
  utilisation, seasonal deviation, issuance frequency/delay).
- **Provenance graph & wash-trading detection** (`app/engines/graph.py`) — models plant → REC →
  holder ownership chains as a NetworkX graph; flags circular resales and rapid flip-trading.
- **SHA-256 hash-chained ledger** (`app/engines/ledger.py`) — every issuance/transfer/verification
  event links to the hash of the entry before it. Editing or deleting a past entry breaks the
  chain from that point forward, and the chain is independently re-verifiable on demand.
- **Weighted risk scoring** (`app/services/risk_service.py`) — combines the five checks
  (weights 30/25/25/15/5) into one 0–100 score, banded into `genuine` / `suspicious` /
  `high_risk` / `likely_fraud`. A broken ledger or a tampered DB row forces `likely_fraud`
  regardless of the weighted score.
- **Explainability** (`app/services/explanation_service.py`) — an LLM-generated plain-English
  explanation of *why* a certificate scored the way it did, with a deterministic template
  fallback when no LLM key is configured or the call fails.
- **Data Quality Engine** (`app/engines/data_quality.py`) — batch-level checks Pydantic can't
  express on its own: duplicate IDs, dangling references, statistical outliers (median/MAD, not
  mean/stdev, so outliers don't mask themselves), completeness, freshness.
- **Full RBAC** (`app/core/auth.py`) — six roles (`registry_admin`, `regulator`, `auditor`,
  `plant_operator`, `buyer`, plus unauthenticated public) enforced server-side per endpoint, with
  row-level scoping so a plant operator or buyer only ever sees their own data.
- **Marketplace** — a buyer can request an unclaimed REC; an auditor/admin approval performs the
  real ownership transfer and writes a `TRANSFERRED` ledger entry.
- **Public verification** — anyone can scan a REC's QR code and see its verification result with
  no account, at `/verify/:recId`.
- **PDF audit reports** (`app/services/report_service.py`, via ReportLab) — a downloadable report
  per certificate with its full check breakdown and explanation.

## Roles

| Role | Can do |
|---|---|
| `registry_admin` | Everything: user/role management, all oversight tools, issuing, approvals |
| `regulator` | Oversight tools (graph, ledger, dashboard) — read/investigate, no issuing |
| `auditor` | Oversight tools + audit actions (approve/reject/report) + issue certificates |
| `plant_operator` | Scoped to their own plant's certificates and generation data |
| `buyer` | Marketplace: browse and request unclaimed certificates |
| *(public, no account)* | Scan a certificate's QR code at `/verify/:recId` |

`registry_admin` is never self-assignable at signup (`SELF_SERVICE_ROLES` in
`app/core/auth.py` / `frontend/src/lib/permissions.js`) — an existing admin has to grant it.

## Architecture

**Backend** — FastAPI, SQLAlchemy 2.0, Pydantic v2, PostgreSQL (or SQLite for local dev),
Supabase Auth (JWKS/ES256, with a legacy HS256 fallback), scikit-learn, pvlib, NetworkX,
ReportLab, Anthropic Claude for explanations. Auth soft-gates: with no Supabase config, every
request is treated as a local-dev `registry_admin` so the app and its test suite still run
without any external service.

**Frontend** — React 18 + Vite, react-router-dom, Tailwind CSS v4, Framer Motion, Recharts,
`@xyflow/react` (provenance graph), `qrcode.react`, Supabase JS client. Design system lives in
`frontend/src/index.css` as CSS custom properties; reusable components (`Button`, `Card`,
`RiskBadge`, `KPI`, `DataTable`, loading/empty/error states, the app shell) live in
`frontend/src/components/ui/` and `frontend/src/components/shell/`.

```
recshield/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/    # dashboard, recs, actions, alerts, graph, ledger,
│   │   │                        #   ingest, marketplace, users, reports
│   │   ├── core/                # config, database, auth (RBAC + JWT verification)
│   │   ├── engines/             # physics, anomaly, duplicate, graph, ledger, data_quality
│   │   ├── integrations/        # Anthropic (explanations), Open-Meteo (irradiance)
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   └── services/             # orchestration: risk, verification, dashboard, marketplace...
│   ├── ml/train_anomaly.py      # trains ml/artifacts/isolation_forest.joblib
│   ├── scripts/                 # seed_data.py (demo data + planted fraud scenarios), promote_admin.py
│   └── tests/                   # pytest, ~110 tests across engines/auth/RBAC/marketplace
├── frontend/
│   └── src/
│       ├── pages/                # Landing, Login, Dashboard, REC Explorer, Graph, Ledger,
│       │                         #   Data Hub, Marketplace, Purchase Requests, Admin, Public Verify
│       ├── components/{ui,shell,rec}/
│       ├── lib/                  # AuthContext, permissions (RBAC mirror), Supabase client
│       └── api/client.js
└── docs/                        # requirements-coverage.md, report-alignment-tickets.md
```

## Getting started

### Backend

From `backend/`:

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload     # API docs at http://localhost:8000/docs
```

`backend/.env` isn't committed. Create it with:

```
DATABASE_URL=sqlite:///./recshield.db
CORS_ORIGINS=["http://localhost:5173"]
LLM_API_KEY=your-anthropic-key-here     # optional — falls back to a template explanation
LLM_MODEL=claude-opus-5                 # optional

# Optional — enables real Supabase Auth + RBAC. Leave both blank to skip login entirely
# (every request is treated as a local-dev registry_admin).
SUPABASE_JWT_SECRET=
SUPABASE_URL=
```

Postgres works too: `DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/recshield`.

### Demo data

The database isn't in git. With the API running, open a second terminal in `backend/` and run:

```bash
python -m scripts.seed_data
```

This generates simulated plants, meter readings and certificates (including planted fraud
scenarios — inflated meter readings, overcast days claimed as full sun, meter gaps, wash
trading, plus a fixed double-certification example), trains the anomaly model, and loads
everything through `POST /api/v1/ingest`. Run it again whenever you want a fresh database.

To grant the first `registry_admin` (once you have a real signed-up account via Supabase):

```bash
python -m scripts.promote_admin <email>
```

### Frontend

From `frontend/`:

```bash
npm install
npm run dev                       # http://localhost:5173
```

`frontend/.env` isn't committed either. Create it with:

```
# Leave blank to talk to the Vite dev proxy at /api (see vite.config.js) - fine for local dev.
VITE_API_BASE_URL=

# Leave both blank to skip auditor login entirely (matches the backend's soft-gate default).
# Fill in from your Supabase project's Settings -> API page to require sign-in.
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Flow: **Landing (`/`) → Sign in / Sign up (`/login`) → Dashboard (`/dashboard`)**, then the rest
of the app (Certificates, Graph Analysis, Audit History, Data Hub, Marketplace, Purchase
Requests, User Management) via the sidebar, scoped to whatever role signed in. Certificate QR
codes point at `/verify/:recId`, which needs no account.

### Tests

```bash
cd backend
pytest
```

~110 tests across the risk engines, auth/JWT verification, RBAC row-level scoping, the
marketplace transfer flow, and the data quality engine.

## API overview

Everything is under `/api/v1` (interactive docs at `/docs`):

| Area | Endpoints |
|---|---|
| Dashboard | `GET /dashboard/summary` |
| Certificates | `GET/POST /recs`, `GET /recs/{id}`, `POST /recs/{id}/verify`, `POST /recs/{id}/buyer`, `POST /recs/{id}/actions`, `GET /recs/{id}/report` (PDF), `GET/POST /recs/plants` |
| Public verification | `GET /recs/public/verify/{id}` — no auth |
| Ledger | `GET /ledger/verify`, `GET /recs/{id}/history` |
| Provenance graph | `GET /graph` |
| Alerts | `GET /alerts` |
| Data Hub | `POST /ingest`, `GET /ingest/data-quality/latest` |
| Marketplace | `GET /marketplace`, `POST /recs/{id}/purchase-requests`, `GET /purchase-requests`, `POST /purchase-requests/{id}/approve\|reject` |
| Users | `GET /auth/me`, `GET /admin/users`, `PATCH /admin/users/{id}/role` |

## Working on this repo

- Don't commit to `main` directly. Start every change on a branch from an up-to-date `main`:
  ```bash
  git switch main
  git pull
  git switch -c feature/<short-name>
  ```
- Push the branch and open a pull request into `main`. No review is required; the PR is there so everyone can see what's landing.
- Keep branches small. Before opening the PR, bring in the latest `main` with `git pull origin main` and fix any conflicts on your branch.
- Never commit `.env`, `*.db`, `node_modules/` or `.venv/`. They're in `.gitignore`.
