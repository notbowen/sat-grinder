# SAT Grinder

SAT Grinder is a static Next.js application for medium and hard Reading & Writing and Math practice. Cloudflare Pages serves the exported frontend, while Supabase provides Google authentication, Postgres persistence, transactional grading RPCs, row-level security, and private question-asset storage.

## Tasks

- [ ] Finish testing friendship feature
- [ ] Migrate Supabase to `ap-southeast-1`

## Architecture

- Next.js 16 static export (`out/`) with no application server or API routes.
- Supabase Auth with Google OAuth and PKCE. Any valid Google account may register.
- Supabase Postgres functions grade answers and update sessions/mastery atomically. Browser clients cannot select question rows, answer keys, rationales, sync staging, or another learner's history directly.
- A private `question-assets` Storage bucket. The browser replaces internal asset references with one-hour signed URLs.
- A nightly GitHub Action replaces the College Board bank only after the complete source bank and every asset have validated and staged successfully.

## Local development

Requirements: Node.js 24+ and pnpm 11.

```bash
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Set these public values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://rigrymriolaubfubhcfx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key is safe to expose in the static frontend. Never put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable, Pages environment, or browser bundle.

Apply migrations in filename order from `supabase/migrations/`. Database tests are in `supabase/tests/`.

## Google OAuth configuration

1. In Google Cloud, create a Web OAuth client and add this authorized redirect URI:

   `https://rigrymriolaubfubhcfx.supabase.co/auth/v1/callback`

2. In Supabase Auth providers, enable Google and enter the client ID and secret.
3. In Supabase URL Configuration, set the production Pages/custom domain as the Site URL. Add the production `/auth/callback/`, Cloudflare preview callback pattern, and `http://localhost:3000/auth/callback/` as allowed redirect URLs.
4. Keep the requested scopes at `openid email profile`.

## Deploy to Cloudflare Pages

Connect the GitHub repository to a Pages project with:

- Build command: `pnpm build`
- Build output directory: `out`
- Node version: 24
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The export includes `public/_headers`, which supplies the security headers and permits only this Supabase project's HTTPS and WebSocket origins. Preview the Pages deployment and test OAuth before changing production traffic.

## Authorized College Board synchronization

Manual local runs require server-side credentials and the explicit authorization assertion:

```bash
SUPABASE_URL=https://rigrymriolaubfubhcfx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
COLLEGE_BOARD_EQB_AUTHORIZED=true \
pnpm question-bank:sync
```

The workflow at `.github/workflows/question-bank-sync.yml` runs nightly at 19:00 UTC (03:00 Singapore) and supports manual dispatch. Configure:

- GitHub Actions variable `SUPABASE_URL`
- GitHub Actions secret `SUPABASE_SERVICE_ROLE_KEY`

Only the sync job receives the service-role key. It validates all source metadata and details, sanitizes HTML, uploads content-addressed assets, inserts run-scoped staging rows, and calls a service-only finalization transaction. Failures mark the run failed and leave the currently active bank unchanged.

## Verification

```bash
pnpm lint
pnpm test
pnpm build
```

A successful build lists every route as static and emits the complete Pages deployment in `out/`.
