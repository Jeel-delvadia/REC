# RECShield

Fraud detection and verification for Renewable Energy Certificates. FastAPI backend in `backend/`, React + Vite frontend in `frontend/`.

## Run locally

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
LLM_API_KEY=your-key-here
```

Postgres works too: `DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/recshield`.

### Demo data

The database isn't in git. With the API running, open a second terminal in `backend/` and run:

```bash
python -m scripts.seed_data
```

This writes the simulated CSVs, trains the anomaly model, and loads everything through `POST /api/v1/ingest`. Run it again whenever you want a fresh database.

### Frontend

From `frontend/`:

```bash
npm install
npm run dev                       # http://localhost:5173
```

`frontend/.env` isn't committed either. Create it with:

```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Tests

```bash
cd backend
pytest
```

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
