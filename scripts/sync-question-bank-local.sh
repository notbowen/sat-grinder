#!/usr/bin/env bash
# Fills the local Supabase database with the real College Board bank.
#
# Identical to `pnpm question-bank:sync`, except the service-role credentials are
# read from the local stack instead of the hosted project, so a run can never
# touch production. It still downloads from College Board and takes a while.
#
# Usage: pnpm question-bank:sync:local
set -euo pipefail

SCRIPT_LABEL=sync-local
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/supabase-lib.sh

ensure_local_stack

if ! read_local_stack_env; then
  log "error: could not read the API URL and key from \`supabase status -o env\`. Inspect the stack with \`pnpm supabase -- status\`."
  exit 1
fi
if [[ -z "$LOCAL_SUPABASE_SERVICE_ROLE_KEY" ]]; then
  log "error: the local stack reported no service-role key; \`pnpm supabase -- status\` shows what it did report."
  exit 1
fi

authorized="${COLLEGE_BOARD_EQB_AUTHORIZED:-}"
[[ -n "$authorized" ]] || authorized="$(dotenv_get COLLEGE_BOARD_EQB_AUTHORIZED || true)"
if ! is_truthy "$authorized"; then
  log "error: set COLLEGE_BOARD_EQB_AUTHORIZED=true (in the shell or .env.local) only after confirming written content authorization."
  exit 1
fi

log "target: $LOCAL_SUPABASE_URL (local stack — the hosted project is untouched)"

export SUPABASE_URL="$LOCAL_SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SUPABASE_SERVICE_ROLE_KEY"
export COLLEGE_BOARD_EQB_AUTHORIZED="true"

exec pnpm exec tsx scripts/sync-question-bank.ts
