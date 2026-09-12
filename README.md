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

> **Never copy `.venv/`, `node_modules/`, or `*.db` between machines.** They're gitignored on
> purpose. `.venv` bakes in the exact original file path and OS/CPU-specific compiled binaries
> (`numpy`, `pandas`, `scikit-learn`, `psycopg[binary]`, `cryptography` all ship native code) —
> copying it to another machine causes import errors or silent path breakage that look nothing
> like "wrong Python version." Every machine (including CI and any deploy target) should run
> `pip install -r requirements.txt` / `npm install` itself, into its own fresh `.venv` /
> `node_modules`. The only things that *should* move between machines by hand are the two
> `.env` files (see below) and, optionally, `backend/recshield.db` if you want to carry demo
> data over instead of reseeding.

### Backend

From `backend/`:

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload     # API docs at http://localhost:8000/docs
```

`backend/.env` isn't committed — copy `backend/.env.example` to `backend/.env` and fill it in.
At minimum for local dev:

```
DATABASE_URL=sqlite:///./recshield.db
CORS_ORIGINS=["http://localhost:5173"]
```

`LLM_API_KEY` and the Supabase variables are optional locally (see `.env.example` for what each
one does and when you need it). Postgres works too:
`DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/recshield`.

> **If every API call 401s with "Invalid session token: ... (iat)"**, it's not a code bug — the
> machine's system clock is behind real time, so the JWT's issued-at timestamp looks like it's
> in the future. Fix the system clock (enable automatic time sync). A small clock-drift leeway
> is already built in (`app/core/auth.py`), but it can't compensate for a clock that's minutes
> or hours wrong.

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

`frontend/.env` isn't committed either — copy `frontend/.env.example` to `frontend/.env`. Leave
everything blank for local dev (requests go through Vite's own dev proxy to
`http://localhost:8000`, and auth is skipped entirely) — see the next section for what has to
be filled in once you deploy.

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

## Deploying

**The frontend is a Vercel-native static build; the backend is not.** Vercel's serverless
functions aren't a good fit for this backend as-is — it holds a live SQLAlchemy/Postgres
connection, loads a trained scikit-learn model from disk, and runs a batch ingest job, none of
which suit a stateless, short-lived function well. Deploy them separately:

### Frontend → Vercel

1. Import the repo in Vercel, set the project root to `frontend/`. Vercel auto-detects Vite
   (`npm install && npm run build`, output `dist/`).
2. `vercel.json` (already in `frontend/`) rewrites every path to `index.html`, so client-side
   routes like `/dashboard` or `/login` don't 404 on a hard refresh or direct link.
3. Set these in the Vercel project's Environment Variables (same names as `.env.example`):
   - `VITE_API_BASE_URL` — the backend's real, public URL (see below). **Required** — unlike
     local dev there is no proxy in a production build, so leaving this blank means every API
     call 404s against Vercel's own domain instead.
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — optional, only if you want real auth.

### Backend → any host that runs a long-lived process (Render, Railway, Fly.io, a VPS, ...)

`render.yaml` at the repo root is a Render Blueprint — "New -> Blueprint" in Render picks it up
automatically and pre-fills the build/start commands and env var names (you still enter the
actual secret values yourself; none are stored in the file). On any host:

1. Provision a **real Postgres** database (Supabase's own Postgres works, or the host's
   managed Postgres) — SQLite's on-disk file won't survive most hosts' ephemeral filesystems.
2. Set `DATABASE_URL` to that Postgres URL, and set the rest from `backend/.env.example`:
   - `CORS_ORIGINS` — must include your deployed Vercel URL, e.g.
     `["https://your-app.vercel.app"]` (the built-in regex only allows localhost/LAN origins).
   - `PUBLIC_BASE_URL` — your deployed frontend's URL, so PDF reports link somewhere real.
   - `SUPABASE_JWT_SECRET` or `SUPABASE_URL` — same Supabase project as the frontend, if using auth.
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
4. Bootstrap the first `registry_admin`: sign up for a real account on the deployed frontend,
   then from your own machine, temporarily point `backend/.env`'s `DATABASE_URL` at the same
   production Postgres and run `python -m scripts.promote_admin --email you@example.com` — it
   writes directly to the database, no running server needed.
5. Seed demo data: with `DATABASE_URL` still pointed at production but `SUPABASE_URL` /
   `SUPABASE_JWT_SECRET` left blank *locally* (so your local server skips login), run the
   backend locally and `python -m scripts.seed_data` against it — it posts to your local
   `:8000`, which writes into the shared production database.

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
