#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd npm

cd "${FRONTEND_DIR}"
exec npm run dev -- --host 0.0.0.0 --port "${V2_FRONTEND_PORT:-5174}"
