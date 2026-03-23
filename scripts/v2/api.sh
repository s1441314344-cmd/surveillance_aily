#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd uvicorn
ensure_backend_env

cd "${BACKEND_DIR}"
exec uvicorn app.main:app --reload --port "${V2_API_PORT:-8000}"
