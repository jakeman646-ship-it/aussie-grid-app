# Aussie Grid

> Community-owned Virtual Power Plant pilot for Mackay, Queensland.

Aussie Grid connects home batteries, rooftop solar and EVs into a single,
community-run Virtual Power Plant (VPP). This repository contains the web app
that pilot participants use to sign in, manage their home's operating mode,
and track community impact.

## Tech stack

- ⚡ **Vite** + **React 18** + **TypeScript** (strict)
- 🎨 **Tailwind CSS** with the Aussie Grid brand palette
- 🔐 **Supabase** for auth and database
- 🧭 **React Router** for navigation

## Brand colours

| Token       | Hex       | Usage                                   |
| ----------- | --------- | --------------------------------------- |
| `navy`      | `#0A2540` | Primary brand colour, headings, surfaces |
| `energy`    | `#22C55E` | Accents, calls-to-action, success states |

## Project structure

```
src/
  app/             Route components and top-level App composition
    routes/        Page components (Login, Dashboard, NotFound)
  components/     Reusable UI building blocks
  hooks/          React hooks (e.g. useAuth)
  lib/            Framework-agnostic utilities (Supabase client, cn helper)
  types/          Shared TypeScript types
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Create a project at [supabase.com](https://supabase.com), then copy the
example env file and fill in your project credentials:

```bash
cp .env.example .env.local
```

```bash
# .env.local
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Both values can be found under **Project Settings → API** in the Supabase
dashboard.

> Email + password auth is enabled by default in Supabase. For the smoothest
> developer experience during the pilot, you may want to disable email
> confirmation under **Authentication → Providers → Email** so new accounts
> can log in immediately.

### 3. Run the dev server

```bash
npm run dev
```

The app will be served at <http://localhost:5173>.

## Available scripts

| Script              | Description                                       |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with hot reload         |
| `npm run build`     | Type-check and build a production bundle          |
| `npm run preview`   | Preview the production build locally              |
| `npm run lint`      | Run ESLint                                        |
| `npm run typecheck` | Run TypeScript in `--noEmit` mode (strict checks) |

## Auth flow

1. Unauthenticated users are sent to `/login`.
2. After a successful `signInWithPassword` call, users are redirected to
   `/dashboard` (or back to the page they originally requested).
3. The dashboard is wrapped in `<ProtectedRoute>`, which subscribes to Supabase
   auth state changes via `useAuth` and redirects back to `/login` on sign-out.

## Operating modes (placeholder)

The dashboard surfaces four upcoming operating modes:

- **Storm** — pre-charge for severe weather
- **Save** — reduce bills by shifting load
- **Sell** — export to the wholesale market
- **Holiday** — set-and-forget defaults

These cards are placeholders today and will become fully interactive as the
pilot progresses.

## License

Proprietary — Aussie Grid pilot, Mackay QLD.
