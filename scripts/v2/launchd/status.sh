#!/usr/bin/env bash
set -euo pipefail

echo "launchd status:"
launchctl list | rg "com.surveillance.v2.(api|worker|scheduler)" || true

echo ""
echo "http health:"
curl -sS -o /dev/null -w "api_docs=%{http_code}\n" http://localhost:8000/api/docs || true

echo ""
echo "scheduler tail:"
tail -n 5 /Users/shaopeng/Downloads/surveillance_aily/backend-v2/logs/scheduler.err.log 2>/dev/null || true
