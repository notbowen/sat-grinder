#!/usr/bin/env bash
# Runs the Supabase CLI against this project without a global install.
#
# Usage: pnpm supabase -- status
#        pnpm supabase -- db reset
set -euo pipefail

SCRIPT_LABEL=supabase
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/supabase-lib.sh

run_supabase "$@"
