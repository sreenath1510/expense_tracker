# Ledger — Personal Finance Frontend

Local-first personal finance web app. React 18 + Vite + TypeScript + SCSS,
state via Redux Toolkit + RTK Query, animations via Framer Motion. Designed
to talk to a FastAPI backend over `/api`, but ships with a stateful in-memory
mock layer so the UI is fully interactive on its own.

## Running it

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # production bundle into ./dist
npm run preview  # serve the built bundle locally
```

Node 18+ recommended. No Docker, no env vars required for the mock phase.

## What's in the box

Four real, wired feature modules:

- **Dashboard** (`/`) — the month-over-month pivot matrix from your Excel,
  with sticky category column, per-block subtotals, the Summary engine
  (Income / Expenditure / Balance / Investments / Liquid Savings), and a
  per-month Remarks row. Seeded with data from your screenshots.
- **Quick Add** (`/add`) — single-transaction form: amount, date, line
  item (grouped by block), payment source, optional note.
- **Bulk Upload** (`/upload`) — drop a CSV statement, get the interactive
  mapping table. Per-row category + payment-source dropdowns, "set all"
  shortcuts, single batch save.
- **Settings** (`/settings`) — full CRUD for Blocks (Expense/Investment
  type flag), Line Items (mapped to their parent block), and Payment
  Sources. Income sources surface read-only until the backend connects.

## Structure

```
src/
  api/             RTK Query slice + the stateful mock store
  app/             App root + router
  components/
    ui/            Button, Card, Input, Select, Modal, IconButton, SectionLabel
    layout/        AppLayout (shell), Sidebar, PageHeader
  features/
    dashboard/     The matrix view
    transactions/  Quick Add form
    upload/        Bulk upload + mapping table + temp CSV parser
    settings/      Categories & sources CRUD
  store/           Redux store config + typed hooks
  styles/
    abstracts/     Design tokens + mixins (translated from theme.md)
    base/          Global reset, CSS custom properties, base typography
  types/           Domain types mirroring the DB schema
  utils/           Formatting helpers
```

## Design system

Tokens and patterns live in `src/styles/abstracts/_tokens.scss` and
`_mixins.scss`. They translate the theme spec into SCSS variables plus
CSS custom properties, so a future dark mode is a few `:root` overrides
away with no component rewrites.

The signature Electric Blue gradient (`#0052FF → #4D7CFF`) appears on
the primary button, active nav link, brand mark, block tags, gradient
text highlights in page titles, and the dropzone icon. The dual-font
system (Calistoga / Inter / JetBrains Mono) loads from Google Fonts in
`index.html`.

## Backend hand-off

The frontend talks to the backend over a `/api` proxy already configured
in `vite.config.ts` (target `http://localhost:8000`). Every endpoint the
UI calls is listed in `src/api/client.ts` — those are exactly the routes
the FastAPI app needs:

```
GET    /api/blocks
POST   /api/blocks
PUT    /api/blocks/:id
DELETE /api/blocks/:id
GET    /api/line-items
POST   /api/line-items
PUT    /api/line-items/:id
DELETE /api/line-items/:id
GET    /api/payment-sources       (+ POST/PUT/DELETE)
GET    /api/income-sources
GET    /api/matrix
POST   /api/transactions
POST   /api/transactions/batch
POST   /api/upload/parse          (multipart file → RawStatementRow[])
PUT    /api/remarks               ({year, month, body})
```

When the backend is live, flip `USE_MOCKS` to `false` in
`src/api/client.ts` and the entire app switches to real persistence
with no component changes.

Request/response shapes are pinned by the types in `src/types/index.ts`
— that's the contract between frontend and FastAPI.
