# SAT Grinder

SAT Grinder is a static Next.js application for medium and hard Reading & Writing and Math practice. Cloudflare Pages serves the exported frontend, while Supabase provides Google authentication, Postgres persistence, transactional grading RPCs, row-level security, and private question-asset storage.

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
NEXT_PUBLIC_SUPABASE_URL=https://sxrppeuogdwbsjzvpixq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key is safe to expose in the static frontend. Never put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable, Pages environment, or browser bundle.

Apply migrations in filename order from `supabase/migrations/`. Database tests are in `supabase/tests/`.

### Against the local Supabase stack

`pnpm dev` targets the hosted project above. To develop against a local stack instead, add Docker and either the Supabase CLI or Nix (the scripts fall back to `nix run nixpkgs#supabase-cli`, so no global install is needed):

```bash
pnpm dev:local
```

That starts the stack described by `supabase/config.toml` if it is down, applies any migrations the local database has not seen, and then runs `next dev` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` overridden to point at it. Shell variables outrank every `.env` file, so `.env.local` keeps holding the hosted credentials and nothing needs to be edited to switch back.

To make plain `pnpm dev` choose the local stack, set `SUPABASE_LOCAL=true` in the shell or in `.env.local`. `pnpm dev --hosted` and `SUPABASE_LOCAL=false` override that for a single run.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Hosted project, unless `SUPABASE_LOCAL=true` is set |
| `pnpm dev:local` / `pnpm dev --hosted` | Force one mode for this run |
| `pnpm supabase -- <args>` | Run the CLI against this project, e.g. `pnpm supabase -- status` |
| `pnpm db:reset` | Rebuild the local database from `supabase/migrations/` (erases local data) |
| `pnpm question-bank:sync:local` | Import the College Board bank into the local database |

Local services: API on `http://127.0.0.1:54321`, Studio on `http://127.0.0.1:54323`, the auth mailbox on `http://127.0.0.1:54324`, and Postgres on `postgres://postgres:postgres@127.0.0.1:54322/postgres`.

Google sign-in is not configured on the local Auth server, so `/login` shows an extra email form whenever the dev server sets `NEXT_PUBLIC_SUPABASE_LOCAL=true`. It signs in with a local account and creates that account on first use; `[auth.email]` in `supabase/config.toml` enables sign-up and skips confirmations for the local stack only. Both halves of the condition are inlined at build time, so a production build never contains the form. Nothing about the hosted project changes: its providers live in the Supabase dashboard.

Editing `supabase/config.toml` only takes effect once the containers are recreated with `pnpm supabase -- stop` followed by the next `pnpm dev:local`. Migrations that have already been applied locally need `pnpm db:reset` when they change.

The local database starts with no questions, so practice and dashboard pages stay empty until `pnpm question-bank:sync:local` runs. It is `pnpm question-bank:sync` with the service-role credentials read from the local stack, so it cannot write to the hosted project.

## Google OAuth configuration

1. In Google Cloud, create a Web OAuth client and add this authorized redirect URI:

   `https://sxrppeuogdwbsjzvpixq.supabase.co/auth/v1/callback`

2. In Supabase Auth providers, enable Google and enter the client ID and secret.
3. In Supabase URL Configuration, set the production Pages/custom domain as the Site URL. Add the production `/auth/callback/**`, `https://**.satgrinder.pages.dev/auth/callback/**` for Cloudflare previews, and `http://localhost:3000/auth/callback/**` as allowed redirect URLs. The callback carries the page that initiated sign-in in its query string, so the trailing `**` is required.
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
SUPABASE_URL=https://sxrppeuogdwbsjzvpixq.supabase.co \
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
