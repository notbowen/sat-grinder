#!/usr/bin/env bash
# `pnpm dev` entry point.
#
# Runs `next dev` against the hosted Supabase project from .env.local by
# default. When local mode is requested it instead starts (if needed) the local
# stack described by supabase/config.toml, applies pending migrations, and
# overrides the public Supabase variables for that dev server only.
#
# Local mode is requested by any of:
#   pnpm dev --local                         (same as `pnpm dev:local`)
#   SUPABASE_LOCAL=true pnpm dev
#   SUPABASE_LOCAL=true in .env.development.local / .env.local / .env
#
# `pnpm dev --hosted`, or SUPABASE_LOCAL=false in the shell, always wins over
# the value in the .env files.
#
# Usage: pnpm dev [--local|--hosted] [<extra args passed to next dev>]
set -euo pipefail

SCRIPT_LABEL=dev
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/supabase-lib.sh

mode=""
next_args=()
for arg in "$@"; do
  case "$arg" in
    --local) mode="local" ;;
    --hosted|--remote) mode="hosted" ;;
    *) next_args+=("$arg") ;;
  esac
done

if [[ -z "$mode" ]]; then
  requested="${SUPABASE_LOCAL:-}"
  [[ -n "$requested" ]] || requested="$(dotenv_get SUPABASE_LOCAL || true)"
  if [[ -n "$requested" ]] && is_truthy "$requested"; then
    mode="local"
  else
    mode="hosted"
  fi
fi

if [[ "$mode" != "local" ]]; then
  log "Supabase: hosted project from .env.local"
  log "run \`pnpm dev:local\` (or set SUPABASE_LOCAL=true) to develop against the local stack"
  # Keeps the local-only sign-in path out of the app even if SUPABASE_LOCAL was
  # left behind in a .env file.
  export NEXT_PUBLIC_SUPABASE_LOCAL="false"
  exec pnpm exec next dev ${next_args[@]+"${next_args[@]}"}
fi

ensure_local_stack

if ! read_local_stack_env; then
  log "error: could not read the API URL and key from \`supabase status -o env\`. Inspect the stack with \`pnpm supabase -- status\`."
  exit 1
fi

log "Supabase API: $LOCAL_SUPABASE_URL"
log "Studio:       http://127.0.0.1:54323"
log "Mail (auth):  http://127.0.0.1:54324"
log "DB (psql):    postgres://postgres:postgres@127.0.0.1:54322/postgres"

# Shell-provided variables outrank every .env file during `next dev`, so these
# override the hosted-project credentials in .env.local for this process only.
export NEXT_PUBLIC_SUPABASE_URL="$LOCAL_SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$LOCAL_SUPABASE_PUBLISHABLE_KEY"
# Turns on the local-only email sign-in path on /login, since Google OAuth is
# not configured against the local Auth server.
export NEXT_PUBLIC_SUPABASE_LOCAL="true"
# Handy for service-role scripts started from this shell, such as
# `pnpm question-bank:sync`.
export SUPABASE_URL="$LOCAL_SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SUPABASE_SERVICE_ROLE_KEY"

exec pnpm exec next dev ${next_args[@]+"${next_args[@]}"}
