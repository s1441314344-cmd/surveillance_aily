#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deps-up.sh"

cat <<'EOF'
[v2] dependencies are ready.
  - postgres
  - redis
  - local-detector

Open separate terminals to run:
  make v2-api
  make v2-worker
  make v2-scheduler
  make v2-frontend
EOF
