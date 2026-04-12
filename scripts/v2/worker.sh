#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_python_module celery
ensure_backend_env

cd "${BACKEND_DIR}"
celery_pool="$(resolve_celery_pool)"
exec python3 -m celery -A app.core.celery_app.celery_app worker \
  --loglevel="${V2_CELERY_LOGLEVEL:-info}" \
  --pool="${celery_pool}" \
  --concurrency="${V2_CELERY_CONCURRENCY:-1}" \
  --prefetch-multiplier="${V2_CELERY_PREFETCH_MULTIPLIER:-1}" \
  -Ofair
