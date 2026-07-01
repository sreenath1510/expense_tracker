# Fathom — Personal Finance App

A private, local-first replacement for the Excel pivot you've been
maintaining. The categories from your sheet are seeded in — Mandatory,
Add On, Self Help, Transport, Junk, Invest Block — and the Settings page
lets you change everything.

```
finance-app/
  frontend/   React 18 + Vite + TypeScript + SCSS + Redux Toolkit
  backend/    FastAPI + SQLAlchemy 2.0 + Pydantic v2 + pandas
```

## Running it locally (both halves)

**Terminal 1 — backend:**

```bash
cd backend
python -m venv .venv
. .venv/bin/activate                 # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m scripts.init_db            # creates SQLite file + seeds categories
uvicorn app.main:app --reload        # http://localhost:8000
```

`init_db` also seeds a default login the first time it runs:

```
username: admin
password: ledger
```

Override these (and the JWT signing key) with `DEFAULT_ADMIN_USERNAME`,
`DEFAULT_ADMIN_PASSWORD`, and `SECRET_KEY` env vars — see `.env.example`.

**Terminal 2 — frontend:**

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

Then **flip the frontend onto the real backend**:

Open `frontend/src/api/client.ts` and change:

```ts
export const USE_MOCKS = true;       // change to:
export const USE_MOCKS = false;
```

Reload `http://localhost:5173` and you're talking to the FastAPI server.
The Vite dev proxy handles `/api/...` → `http://localhost:8000` so CORS
is a non-issue in dev.

## What's in each half

**Frontend** — Login gate (token kept in the auth slice + localStorage,
all routes behind a guard), collapsible inverted-dark sidebar with the
signed-in user + sign-out. Dashboard matrix (month-over-month pivot with
sticky category column, per-block subtotals, summary engine, monthly
remarks); **click any month column header to drill into a Month Detail
view** listing every transaction for that month, grouped by block with a
filter box — like opening a "project". Quick Add form, Bulk Upload with
the interactive mapping table, Settings CRUD for blocks and line items
with the Expense/Investment type flag. Styled to the `theme.md` design
system: Electric Blue gradient, Calistoga + Inter + JetBrains Mono fonts.

> The Month Detail transaction list is generated locally for now (the stat
> cards come from the live summary). When the backend grows a
> `GET /api/transactions?month=YYYY-MM` route, swap `getMonthTransactions`
> in `src/api/mockTransactions.ts` for an RTK Query call — the component
> already consumes the final shape.

**Backend** — JWT auth: `POST /api/auth/{login,register}` issue a token,
`GET /api/auth/me` validates it, and every other router sits behind a
`get_current_user` dependency (passwords stored as PBKDF2 hashes). Full
CRUD for blocks, line items, payment sources, income sources; single +
batch transaction insert with FK validation; parser for Excel/CSV
statements; aggregation service that builds the matrix on demand (never
stored — single source of truth); per-month remark upsert. Pydantic v2
schemas with camelCase aliasing so JSON keys match the frontend types
exactly. Interactive docs at `http://localhost:8000/docs`.

## Deploying to Vercel + Neon

The whole app ships as **one Vercel project**: the React build is served as
static assets, and the FastAPI app runs as a **Python serverless function**
at `/api`. Because both live on the same domain, the frontend's `/api`
base URL works unchanged and there is **no CORS**. Data lives in **Neon**
(serverless Postgres) since Vercel functions have no persistent disk.

```
repo root
  vercel.json        builds (static frontend + python fn) + routes
  api/index.py       exposes the FastAPI ASGI `app` to Vercel
  requirements.txt   deps Vercel installs for the function (incl. psycopg)
  frontend/          Vite app (built to frontend/dist)
  backend/           FastAPI app (imported by api/index.py)
```

**1. Create the database (Neon).** Make a project at neon.tech, copy the
**pooled** connection string, and convert the scheme for SQLAlchemy + psycopg:

```
postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require
```

**2. Bootstrap the schema once** (run locally, pointed at Neon). Alembic
creates the tables; `init_db` then seeds the admin account:

```bash
cd backend
export DATABASE_URL="postgresql+psycopg://...neon.../db?sslmode=require"
python -m alembic upgrade head     # create all tables
python -m scripts.init_db          # seed the admin user (create_all is a no-op here)
```

Future schema changes: edit the models, `alembic revision --autogenerate -m "..."`,
commit the new file, then `alembic upgrade head` against each environment.

> Your **existing local SQLite** db already has these tables (from earlier),
> so mark it as up-to-date once instead of re-running upgrade:
> `cd backend && python -m alembic stamp head`.

**3. Set Vercel env vars** (Project → Settings → Environment Variables):

| Var | Value |
|-----|-------|
| `DATABASE_URL` | the Neon `postgresql+psycopg://…` string |
| `SECRET_KEY` | a long random string (`openssl rand -hex 32`) — **not** the dev default |
| `CORS_ORIGINS` | your Vercel URL (only matters if you later split hosts) |
| `DEFAULT_ADMIN_PASSWORD` | a strong password (or rely on open signup) |

**4. Deploy.** Push to GitHub and "Import Project" on Vercel (or run
`vercel` / `vercel --prod` from the repo root). Vercel reads `vercel.json`,
builds the frontend, and provisions the function.

### Notes & hardening
- **Open signup is on** — anyone can register. Before sharing publicly, add
  rate-limiting on `/auth/login` + `/register`. On serverless this needs an
  external store (e.g. Upstash Redis + `slowapi`) or Vercel's WAF/Attack
  Challenge, since in-memory limiters don't span function instances.
- **Tokens** are kept in `localStorage` (simple; XSS-readable). Switchable to
  httpOnly cookies if you want it hardened.
- **Migrations:** managed by **Alembic** (`backend/alembic/`), with the
  initial schema committed. Use `alembic upgrade head` per environment.
- **Cold starts:** first request after idle is ~1–2s. If that's unacceptable,
  the alternative is hosting the backend on Railway/Render (long-running) and
  pointing the frontend at it via a `VITE_API_URL` build var + CORS.
