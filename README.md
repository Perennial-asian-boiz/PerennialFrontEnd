# PerennialFrontEnd

Web app for Project Perennial — CSULB Senior Project 2026, team Asian Boiz.

React 19 + TypeScript, built with Vite 8 and the React Compiler, styled with
Tailwind CSS v4, routed with React Router 7. Backend lives in
[PerennialBackend](https://github.com/Perennial-asian-boiz/PerennialBackend).

This repo replaces `development/frontend/perennial/` in
`haohnguyen94-droid/project-perennial`.

## Quick start

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
| `/forgot-password`, `/reset-password` | Recovery | OTP-gated password recovery; not a dummy success screen |

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

### Dashboard JSON contract

The backend endpoint is `GET /api/watchlist`. It returns this shape:

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-10-14T00:00:00+00:00",
  "affordable_growing": [
    {
      "name": "Example Company",
      "ticker": "EXMP",
      "sector": "Technology",
      "price": 42.00,
      "change_percent": 1.24,
      "confidence_score": 82,
      "sentiment": "Positive",
      "reason": "Growth signals are improving across technology."
    }
  ],
  "popular_stable": []
}
```

The frontend converts the numeric API fields into the display strings used by
the table. Each bucket can contain three companies per sector. The dashboard
uses the sectors selected during onboarding; when the user skips onboarding,
it displays all eleven sectors.

The backend currently returns temporary fixture data in development while the
real company metadata pipeline is being completed. Anything prefixed `VITE_`
ships to the browser, so never put a secret there.

### Simple authentication client

`src/api/auth.ts` contains the small typed client for the Sprint 1 account API.
It covers signup, OTP verification/resend, login, recovery, notification and
password changes, preferences and personal watchlists. The matching backend
branch is `codex/supabase-auth-resend`; use that branch in **both repos**.
The backend README contains the Supabase/Resend owner setup checklist.

Login checks the password first but returns only a pending challenge. Every
login requires the emailed six-digit OTP; new users then choose preferences,
while existing users who completed/skipped onboarding go to Dashboard.
Registration immediately shows the compact **Account created** screen with
only **Back to sign in**. Email confirmation is independent: the user clicks
the signup link later, `/auth/confirm` validates it and returns to Sign in.
There is no six-digit signup screen and confirmation does not sign the user
into Dashboard. Duplicate email registration shows an error instead of success.
Codes last 15 minutes, resend waits 60 seconds, and the backend limits failed
attempts and email requests. There is no displayed development code or fake
account fallback. Real email testing requires Resend SMTP and Supabase's
signup-link, login-OTP and recovery templates to be configured correctly first.
Signup uses `{{ .ConfirmationURL }}`; login/recovery use `{{ .Token }}`.
The callback URL must be allowlisted in Supabase; the backend README explains
the setup. SMTP/template work is still required for real login/recovery OTP
delivery; default Supabase emails may contain links until it is configured.

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

Clone `PerennialFrontEnd` and `PerennialBackend` as sibling directories. Start
the backend database and API using the backend README, then configure this
frontend with:

```bash
cp .env.example .env
npm ci
npm run dev
```

The checked-in `.env.example` points to `http://127.0.0.1:8000`. The app opens
at Login, validates the session with `GET /me`, and redirects unauthenticated
users away from Dashboard, Setup, Profile, Settings, and Watchlist. The
backend's temporary dashboard fixture is still used until the real company
pipeline is ready; it follows the same API response contract.

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
