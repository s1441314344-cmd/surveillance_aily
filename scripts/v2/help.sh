#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
Smart Inspection V2 local commands:

  make v2-setup        # install backend + frontend dependencies
  make v2-deps-up      # start postgres + redis
  make v2-api          # run FastAPI (backend-v2)
  make v2-worker       # run Celery worker
  make v2-scheduler    # run scheduler process
  make v2-frontend     # run frontend dev server
  make v2-dev          # deps-up + startup hint
  make v2-deps-down    # stop postgres + redis

Recommended flow:
  1) make v2-setup
  2) make v2-dev
  3) open 4 terminals and run:
     make v2-api
     make v2-worker
     make v2-scheduler
     make v2-frontend
EOF
