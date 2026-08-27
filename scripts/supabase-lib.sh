# Shared helpers for the local-development scripts. Sourced, never executed.
#
# Bash 3.2 (the macOS system bash) is the floor, so no associative arrays and
# no `${array[@]}` without the `${array[@]+...}` guard under `set -u`.

log() { echo "[${SCRIPT_LABEL:-scripts}] $*" >&2; }

# The Supabase CLI is optional as a global install: a `supabase` on PATH is used
# when present, otherwise it is fetched on demand through Nix. Determinate-style
# setups enable flakes by default; passing the experimental feature flags
# explicitly makes this work on any Nix install without extra user config.
run_supabase() {
  if [[ -n "${SUPABASE_CLI_BIN:-}" ]]; then
    "$SUPABASE_CLI_BIN" "$@"
  elif command -v supabase >/dev/null 2>&1; then
    supabase "$@"
  elif command -v nix >/dev/null 2>&1; then
    nix --extra-experimental-features "nix-command flakes" \
      run nixpkgs#supabase-cli -- "$@"
  else
    log "error: no Supabase CLI found. Install Nix, install the Supabase CLI, or set SUPABASE_CLI_BIN to its path."
    return 127
  fi
}

strip_quotes() {
  local value="$1"
  case "$value" in
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
    \"*\") value="${value%\"}"; value="${value#\"}" ;;
  esac
  printf '%s' "$value"
}

# Reads one key out of the `.env*` files, honouring the same precedence
# `next dev` uses: .env.development.local, then .env.local, .env.development,
# .env. Shell variables are not consulted here; callers check those first
# because `process.env` outranks every file.
dotenv_get() {
  local key="$1" file line value
  for file in .env.development.local .env.local .env.development .env; do
    [[ -f "$file" ]] || continue
    line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n 1 || true)"
    [[ -n "$line" ]] || continue
    value="${line#*=}"
    value="${value#"${value%%[![:space:]]*}"}"
    case "$value" in
      \"*\"|\'*\') : ;;
      *) value="${value%%#*}" ;;
    esac
    value="${value%"${value##*[![:space:]]}"}"
    strip_quotes "$value"
    return 0
  done
  return 1
}

is_truthy() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

local_stack_running() {
  run_supabase status >/dev/null 2>&1
}

# `supabase status -o env` emits KEY=value lines whose names have changed across
# CLI releases (API_URL/PUBLISHABLE_KEY today, SUPABASE_URL/SUPABASE_ANON_KEY on
# older builds), so every known spelling is accepted. Sets LOCAL_SUPABASE_URL,
# LOCAL_SUPABASE_PUBLISHABLE_KEY and LOCAL_SUPABASE_SERVICE_ROLE_KEY.
read_local_stack_env() {
  local status_output line value
  LOCAL_SUPABASE_URL=""
  LOCAL_SUPABASE_PUBLISHABLE_KEY=""
  LOCAL_SUPABASE_SERVICE_ROLE_KEY=""

  status_output="$(run_supabase status -o env 2>/dev/null)" || return 1

  while IFS= read -r line || [[ -n "$line" ]]; do
    value="$(strip_quotes "${line#*=}")"
    case "$line" in
      API_URL=*|SUPABASE_URL=*|NEXT_PUBLIC_SUPABASE_URL=*)
        [[ -n "$LOCAL_SUPABASE_URL" ]] || LOCAL_SUPABASE_URL="$value" ;;
      PUBLISHABLE_KEY=*|SUPABASE_PUBLISHABLE_KEY=*)
        LOCAL_SUPABASE_PUBLISHABLE_KEY="$value" ;;
      ANON_KEY=*|SUPABASE_ANON_KEY=*)
        [[ -n "$LOCAL_SUPABASE_PUBLISHABLE_KEY" ]] || LOCAL_SUPABASE_PUBLISHABLE_KEY="$value" ;;
      SERVICE_ROLE_KEY=*|SUPABASE_SERVICE_ROLE_KEY=*)
        LOCAL_SUPABASE_SERVICE_ROLE_KEY="$value" ;;
      SECRET_KEY=*|SUPABASE_SECRET_KEY=*)
        [[ -n "$LOCAL_SUPABASE_SERVICE_ROLE_KEY" ]] || LOCAL_SUPABASE_SERVICE_ROLE_KEY="$value" ;;
    esac
  done <<< "$status_output"

  [[ -n "$LOCAL_SUPABASE_URL" && -n "$LOCAL_SUPABASE_PUBLISHABLE_KEY" ]]
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "error: Docker is required to run the local Supabase stack, and no \`docker\` binary is on PATH."
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    log "error: Docker is installed but its daemon is unreachable. Start Docker Desktop (or an equivalent engine) and try again."
    return 1
  fi
}

# Brings the local stack up if it is down, then applies any migrations the local
# database has not seen yet.
ensure_local_stack() {
  [[ -f supabase/config.toml ]] || { log "error: supabase/config.toml not found (wrong directory?)"; return 1; }

  if local_stack_running; then
    log "local Supabase stack already running"
  else
    require_docker || return 1
    log "starting the local Supabase stack (the first run downloads several GB of Docker images and may take a few minutes)"
    run_supabase start || return 1
  fi

  if is_truthy "${SUPABASE_SKIP_MIGRATIONS:-}"; then
    log "skipping \`supabase migration up\` (SUPABASE_SKIP_MIGRATIONS is set)"
    return 0
  fi
  if ! run_supabase migration up; then
    log "error: \`supabase migration up\` failed. If the local database has drifted from supabase/migrations, rebuild it with \`pnpm db:reset\` (this erases local data), or set SUPABASE_SKIP_MIGRATIONS=true to run anyway."
    return 1
  fi
}
