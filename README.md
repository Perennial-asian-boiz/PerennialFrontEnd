# PerennialFrontEnd

Web app for Project Perennial — CSULB Senior Project 2026, team Asian Boiz.

React 19 + TypeScript, built with Vite 8 and the React Compiler, styled with
Tailwind CSS v4, routed with React Router 7. Backend lives in
[PerennialBackend](https://github.com/Perennial-asian-boiz/PerennialBackend).

This repo replaces `development/frontend/perennial/` in
`haohnguyen94-droid/project-perennial`.

## Quick start

These commands start the frontend only. To use login, account settings, and
other API-backed features, start the backend too; see
[Run the complete app locally](#run-the-complete-app-locally).

```bash
npm ci
npm run dev        # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`), then production build into `dist/` |
| `npm run lint` | ESLint over `src/` |
| `npm test` | Offline auth-client contract and refresh/recovery tests |
| `npm run preview` | Serve the production build locally |

`npm run build` and `npm run lint` both pass on `main`. Keep them that way —
unused imports and variables fail the type check (`noUnusedLocals`).

## Screens

| Route | Page | State |
|---|---|---|
| `/` | Dashboard | Sector-filtered dashboard using the frontend dashboard JSON contract |
| `/setup` | Onboarding — interests and risk comfort | Saved to the signed-in account through FastAPI |
| `/confirmation` | Setup confirmation | Shows selected sectors and risk profile |
| `/watchlist` | Watchlist | Account-owned tickers from the backend; temporary company metadata |
| `/company` | Company detail | Placeholder values |
| `/why` | Why this company | Placeholder values |
| `/insights` | Insights | Empty |
| `/profile` | Profile and notification toggles | Verified identity and saved sectors |
| `/settings` | Settings menu | Backend notification/password APIs and preference editor |
| `/login`, `/signup`, `/verify-code` | Auth | Supabase-backed password + email OTP through FastAPI |
| `/forgot-password`, `/reset-password` | Recovery | Email-link password recovery through FastAPI |

## Connecting to the backend

The dashboard calls the backend when `VITE_API_URL` is configured. Copy
`.env.example` to `.env` while running the local backend:

```bash
cp .env.example .env
```

The dashboard's two buckets map directly to the backend API:

| Button | Backend bucket |
|---|---|
| Affordable and Growing | `affordable_growing` |
| Popular and Stable | `popular_stable` |

### Published dashboard data (S2-07)

Dashboard ranks and signals come from `GET /v1/watchlist`. Its two buckets
are inside `watchlist`; each company has `ticker`, `rank`, and `signals`:

```json
{
  "api_version": "v1",
  "publication": { "id": 6 },
  "watchlist": {
    "affordable_growing": [{
      "ticker": "EXMP",
      "rank": 1,
      "signals": {
        "ark": { "fund_count": 2, "funds": ["ARKK", "ARKG"], "total_weight": 10.88 },
        "insider": { "buy_count": 3, "distinct_insider_count": 2 }
      }
    }],
    "popular_stable": []
  }
}
```

The dashboard shows Company / ticker, Signal status, ARK, Insider, and Action.
ARK displays the fund count and total weight; Insider displays the buy count
and distinct insider count. A missing signal is `—`; a reported zero remains
zero. There is no Price or market-cap column.

Company names and normalized sectors are joined by ticker from the existing
`GET /api/watchlist` display adapter, shared with search and the saved watchlist.
New tickers missing from that adapter are resolved through
`GET /v1/securities/{symbol}`. Configure the backend with
`DASHBOARD_DATA_MODE=publication` so its display metadata matches the publication.
Neither demo-only rows nor display-adapter ordering can replace publication rows.

The dashboard filters by the user's selected sectors and retains ascending
publication rank inside each sector. It shows ten rows initially per sector;
View all expands the rest. No publication or an API error produces the
unavailable state rather than synthetic company data. `npm run mock-api`
supports both watchlist endpoints for local development.

Anything prefixed `VITE_` ships to the browser, so never put a secret there.

### Company Finance and explanation sources

Company Finance's first row shows SEC public float in USD from
`GET /v1/securities/{symbol}` → `current.entry.public_float`, with the actual
`public_float_as_of` measurement date. `size_flags` produces a separate measurement
caution; missing float/date stays unavailable and never falls back to market cap.

Each financial explanation links to that company's SEC filings, while preserving
its stored record, value and as-of date. These are company-level filing links, not
links to an exact report: the current explanation contract contains no accession
or document URL. Non-financial explanations keep source links unavailable until
the backend provides their actual source documents.

The public `sec-company-ciks.json` index is derived from SEC's official
`https://www.sec.gov/files/company_tickers.json`. It is loaded once when needed,
so the browser needs no cross-origin SEC request or credentials. Numeric CIKs
are required for EDGAR browse links; unknown tickers get no guessed link.
Refresh this public mapping with `npm run refresh:sec-ciks`.

### Simple authentication client

`src/api/auth.ts` contains the small typed client for the Sprint 1 account API.
It covers signup, OTP verification/resend, login, recovery, notification and
password changes, preferences and personal watchlists. After the matching
Sprint 1 pull requests are merged, use `main` in both repositories. Before
then, use `codex/supabase-auth-resend` in both repositories.
The backend README contains the Supabase/Resend owner setup checklist.

Login checks the password first but returns only a pending challenge. Every
login requires the emailed six-digit OTP; new users then choose preferences,
while existing users who completed/skipped onboarding go to Dashboard.
Registration immediately shows the compact **Account created** screen with
only **Back to sign in**. Email confirmation is independent: the user clicks
the signup link later, `/auth/confirm` validates it and returns to Sign in.
There is no six-digit signup screen and confirmation does not sign the user
into Dashboard. Duplicate email registration shows an error instead of success.
Signup validates each field before sending, shows errors under the affected
input, and focuses the first invalid field. `src/lib/signupValidation.ts`
matches the API baseline (8–200 password characters; Unicode names allowed).
The client consumes the backend's safe `code`/`field_errors` contract; provider
email-delivery problems remain form-level errors rather than blaming passwords.
Codes last 15 minutes. The backend enforces a 60-second resend cooldown and
email-request limits; the verification page shows the remaining cooldown.
Supabase or its SMTP provider may still enforce additional send limits.
There is no displayed development code or fake
account fallback. Real email testing requires Resend SMTP and Supabase's
signup-link, login-OTP and recovery templates to be configured correctly first.
Signup and password recovery use `{{ .ConfirmationURL }}`; login uses `{{ .Token }}`.
The callback URL must be allowlisted in Supabase; the backend README explains
the setup. SMTP/template work is still required for real login OTP delivery.

Only access/refresh tokens and the pending challenge live in tab-scoped
`sessionStorage`; `clearSession()` removes both tokens. Expired access tokens
refresh through the backend once; concurrent requests share a refresh.
Invalid/revoked sessions redirect to Login. A temporary network/provider outage
shows a retry option rather than erasing the session. Preferences, watchlist
items and settings live in the backend database, not `localStorage`.
Recovery sessions cannot access app data. Password changes and logout revoke
sessions on the backend, including refresh access.

Old opaque tokens are incompatible; sign in again. Users in the legacy custom
auth database need to register with Supabase or use a separately reviewed
account migration. No passwords are copied into the frontend or a new database.

### Run the two repositories together

After the Sprint 1 pull requests are merged, clone the default `main` branch of
both repositories into sibling directories. Start the backend by following its
[local setup guide](https://github.com/Perennial-asian-boiz/PerennialBackend#quick-start-sprint-1-app).
Then, in this repository, configure and start the frontend:

```bash
cp .env.example .env
npm ci
npm run dev
```

The checked-in `.env.example` points to `http://127.0.0.1:8000`. Open
`http://localhost:5173`; the API reference is at `http://127.0.0.1:8000/docs`.
The app opens at Login and validates sessions through the backend. If the
pull requests have not been merged yet, both repositories must use the matching
`codex/supabase-auth-resend` branch instead of `main`.

Supabase and database credentials are not included in Git. Ask the project
maintainer for access and private local configuration; never put secrets in a
`VITE_*` variable, commit a `.env`, or post credentials in chat. Dashboard
company data remains a development fixture until the company-data integration
is complete.

## Layout

```
src/
  main.tsx            # entry
  App.tsx             # routes + onboarding topic list
  components/         # sidebar, company logo
  pages/              # one file per route
  index.css           # Tailwind import + root styles
```

## A note on `.gitignore`

The old repo's root `.gitignore` had a bare `*.json` under "Credentials", which
silently ignored `package.json`, `tsconfig.json` and the lockfile everywhere —
that is why the frontend could not be installed from it. Don't add blanket
`*.json` rules here; ignore credential files by path.
