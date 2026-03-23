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
  make v2-smoke        # verify upload/schedule async flows plus failed-job retry against running stack
  make v2-e2e          # run Playwright E2E baseline (auto start test api + frontend)
  make v2-perf         # run upload-job performance probe and print latency/throughput summary
  make v2-soak         # run multi-round async queue soak test and detect unresolved jobs
  make v2-backfill     # dry-run legacy SQLite -> V2 backfill report
  make v2-eval         # run model evaluation dataset against provider adapters
  make v2-camera-check # run deep RTSP/mock camera diagnostic
  make v2-camera-validate # validate a whitelist manifest and export reports
  make v2-deps-down    # stop postgres + redis

Recommended flow:
  1) make v2-setup
  2) make v2-dev
  3) open 4 terminals and run:
     make v2-api
     make v2-worker
     make v2-scheduler
     make v2-frontend

Backfill examples:
  make v2-backfill
  ./scripts/v2/backfill.sh --apply

Evaluation examples:
  make v2-eval
  ./scripts/v2/evaluate.sh --target zhipu:glm-4v-plus --target openai:gpt-5-mini --repeats 3
  ./scripts/v2/evaluate.sh --decision-policy ./backend-v2/examples/model_eval_decision_policy.example.json --output /tmp/eval.json --markdown-output /tmp/eval.md

Camera diagnostic examples:
  ./scripts/v2/camera-check.sh --rtsp-url rtsp://mock/diag
  ./scripts/v2/camera-check.sh --camera-id <camera-id>

Camera whitelist examples:
  ./scripts/v2/camera-validate.sh --manifest ./backend-v2/examples/camera_whitelist_manifest.example.json
  ./scripts/v2/camera-validate.sh --manifest ./backend-v2/examples/camera_whitelist_manifest.example.json --markdown-output /tmp/camera-whitelist.md
EOF
