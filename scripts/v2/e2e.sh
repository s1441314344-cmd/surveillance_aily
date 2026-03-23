#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd npm

cd "${FRONTEND_DIR}"
env -u NO_COLOR npm run e2e -- "$@"
