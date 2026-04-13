#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd npm

# Canonical V2 E2E entrypoint used by preflight/UAT/release flows.
cd "${FRONTEND_DIR}"
env -u NO_COLOR npm run e2e -- "$@"
