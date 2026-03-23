#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd celery
ensure_backend_env

cd "${BACKEND_DIR}"
exec celery -A app.core.celery_app.celery_app worker --loglevel="${V2_CELERY_LOGLEVEL:-info}"
