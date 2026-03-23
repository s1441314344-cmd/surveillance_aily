#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_python_module celery
ensure_backend_env

cd "${BACKEND_DIR}"
exec python3 -m celery -A app.core.celery_app.celery_app worker --loglevel="${V2_CELERY_LOGLEVEL:-info}"
