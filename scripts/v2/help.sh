#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
Smart Inspection V2 local commands:

  make v2-setup        # install backend + frontend dependencies
  make v2-deps-up      # start postgres + redis + local-detector
  make v2-api          # run FastAPI (backend-v2)
  make v2-worker       # run Celery worker
  make v2-scheduler    # run scheduler process
  make v2-frontend     # run frontend dev server
  make v2-backend-test # run backend pytest suite
  make v2-backend-integration-test # run backend Postgres/Redis/Celery integration suite
  make v2-frontend-test # run frontend vitest suite
  make v2-verify       # run precheck + integration preflight + final UAT in sequence
  make v2-dev          # deps-up + startup hint
  make v2-smoke        # verify upload/schedule async flows plus failed-job retry against running stack
  make v2-e2e          # run Playwright E2E baseline (auto start test api + frontend)
  make v2-perf         # run upload-job performance probe and print latency/throughput summary
  make v2-soak         # run multi-round async queue soak test and detect unresolved jobs
  make v2-preflight    # run smoke + perf + soak in one command with managed local processes
  make v2-real-async-test # explicit real stack verification (API + worker + scheduler + deps)
  make v2-backfill     # dry-run legacy SQLite -> V2 backfill report
  make v2-eval         # run model evaluation dataset against provider adapters
  make v2-camera-check # run deep RTSP/mock camera diagnostic
  make v2-camera-validate # validate a whitelist manifest and export reports
  make v2-security    # run dependency/security regression gate
  make v2-reconcile   # run legacy backfill dry-run reconcile summary
  make v2-release-drill # run cutover drill (preflight + backfill + rollback-ready report)
  make v2-uat          # run UAT baseline (pytest + lint + vitest + build + e2e) and export summary
  make v2-release-checklist # build final release checklist from UAT + release drill artifacts
  make v2-release-gate # run release gate with optional overrides, marked as bypass when used
  make v2-release-gate-final # default production release gate (enforce drill apply-backfill, no dry-run)
  make v2-deps-down    # stop postgres + redis + local-detector

Recommended flow:
  1) make v2-setup
  2) make v2-dev
  3) open 4 terminals and run:
     make v2-api
     make v2-worker
     make v2-scheduler
     make v2-frontend

Verification examples:
  make v2-backend-test
  make v2-backend-integration-test
  make v2-frontend-test
  make v2-security
  make v2-reconcile
  make v2-real-async-test
  make v2-uat
  make v2-verify

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

Release drill examples:
  make v2-release-drill
  ./scripts/v2/release-drill.sh --with-e2e
  ./scripts/v2/release-drill.sh --apply-backfill

UAT examples:
  make v2-uat
  ./scripts/v2/uat.sh --with-release-drill
  ./scripts/v2/uat.sh --with-release-drill --release-drill-with-e2e
  ./scripts/v2/uat.sh --with-release-drill --release-drill-apply-backfill

Release checklist examples:
  ./scripts/v2/release-checklist.sh --uat-summary /path/to/uat/summary.json --release-drill-report /path/to/release-drill-report.json
  ./scripts/v2/release-checklist.sh --uat-summary /path/to/uat/summary.json --allow-without-release-drill
  ./scripts/v2/release-checklist.sh --uat-summary /path/to/uat/summary.json --release-drill-report /path/to/release-drill-report.json --require-drill-apply-backfill

Release gate examples:
  make v2-release-gate-final
  make v2-release-gate
  ./scripts/v2/release-gate.sh --skip-uat --uat-summary /path/to/summary.json --release-drill-report /path/to/release-drill-report.json --override-reason "manual audit trail"
  ./scripts/v2/release-gate.sh --release-drill-apply-backfill --require-drill-apply-backfill
EOF
