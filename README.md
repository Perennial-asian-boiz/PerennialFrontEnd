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
| `npm run preview` | Serve the production build locally |

`npm run build` and `npm run lint` both pass on `main`. Keep them that way —
unused imports and variables fail the type check (`noUnusedLocals`).

## Screens

| Route | Page | State |
|---|---|---|
| `/` | Dashboard | Layout only; bucket buttons not wired |
| `/setup` | Onboarding — interests and risk comfort | Selections held in state, not saved |
| `/confirmation` | Setup confirmation | Placeholder copy |
| `/watchlist` | Watchlist | Three hardcoded rows |
| `/company` | Company detail | Placeholder values |
| `/why` | Why this company | Placeholder values |
| `/insights` | Insights | Empty |
| `/profile` | Profile and notification toggles | Dummy account |
| `/settings` | Settings menu | Menu items not wired |
| `/login`, `/signup` | Auth | Stubs |

## Connecting to the backend

Nothing calls an API yet — every screen renders module-level dummy data. The
dashboard's two buckets map directly to the backend pipeline's output in
`consensus_watchlist.json`:

| Button | Backend bucket |
|---|---|
| Affordable and Growing | `affordable_growing` |
| Popular and Stable | `popular_stable` |

When wiring this up, put the API base URL in `.env` as `VITE_API_URL` and read
it with `import.meta.env.VITE_API_URL`. Anything prefixed `VITE_` ships to the
browser, so never put a secret there.

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
