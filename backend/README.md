# Ledger API — FastAPI backend

Local-first personal finance backend for the Ledger frontend. FastAPI +
SQLAlchemy 2.0 + Pydantic v2. Defaults to SQLite for dev; one env-var swap
moves it to Postgres for deployment.

## Running it (dev)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # optional — defaults work as-is
python -m scripts.init_db          # create tables + seed categories
uvicorn app.main:app --reload      # → http://localhost:8000
```

Interactive API docs at <http://localhost:8000/docs>.
Health check at <http://localhost:8000/healthz>.

The Vite dev server already proxies `/api` to `http://localhost:8000`, so
once the backend is up, set `USE_MOCKS = false` in
`frontend/src/api/client.ts` and the frontend talks to the real API.

## Wiping the database

```bash
rm finance.db
python -m scripts.init_db
```

## Structure

```
backend/
  app/
    main.py            FastAPI app, CORS, router mounts
    config.py          Settings loaded from env / .env
    database.py        Engine, session factory, get_db dependency
    models.py          SQLAlchemy 2.0 models
    schemas.py         Pydantic schemas with camelCase aliasing
    routers/
      blocks.py
      line_items.py
      payment_sources.py
      income_sources.py
      transactions.py  (single + batch + income entries)
      matrix.py        Dashboard aggregation
      upload.py        Multipart CSV/Excel parse
      remarks.py       Per-month free text
    services/
      aggregation.py   Matrix + summary engine
      parser.py        Pandas-based statement parser
  scripts/
    init_db.py         Create tables + seed initial categories
```

## API surface

All routes are mounted under `/api`. The Pydantic schemas in `app/schemas.py`
are the contract — they emit and accept camelCase JSON to match the
frontend TypeScript types exactly.

```
GET    /api/blocks
POST   /api/blocks
PUT    /api/blocks/{id}
DELETE /api/blocks/{id}

GET    /api/line-items
POST   /api/line-items
PUT    /api/line-items/{id}
DELETE /api/line-items/{id}

GET    /api/payment-sources       (+ POST/PUT/DELETE)
GET    /api/income-sources        (+ POST/PUT/DELETE)

POST   /api/transactions          (single)
POST   /api/transactions/batch    (bulk save from upload mapping)
POST   /api/income-entries

GET    /api/matrix                (dashboard data)
POST   /api/upload/parse          (multipart file → RawStatementRow[])
PUT    /api/remarks               (upsert by year + month)
```

## Future deployment

The architecture is built so you can host this on Railway / Fly.io / Render
when ready — anywhere with a persistent volume (SQLite) or a managed
Postgres. The only things to change for prod:

1. **Database**: set `DATABASE_URL` to a Postgres URL (e.g. Neon, Supabase,
   Railway Postgres). The SQLAlchemy code is identical for both.

2. **CORS**: set `CORS_ORIGINS` to your deployed frontend URL, e.g.
   `https://your-app.vercel.app`.

A simple Dockerfile is included for container hosts. For Vercel-hosted
frontend, deploy `/backend` separately on Railway/Render and point the
frontend's API base at it (replace the dev proxy with a `VITE_API_URL`).

Vercel itself isn't a good home for this backend because its serverless
functions have an ephemeral filesystem — SQLite data wouldn't survive
between invocations. Use Railway/Render/Fly for the API, Vercel for the
static frontend.
