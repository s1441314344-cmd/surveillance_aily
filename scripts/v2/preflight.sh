#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd make
require_cmd date
require_cmd curl
ensure_backend_env

API_PORT="${V2_PREFLIGHT_API_PORT:-5810}"
WITH_E2E="false"
PERF_ARGS_RAW="${V2_PREFLIGHT_PERF_ARGS:-}"
SOAK_ARGS_RAW="${V2_PREFLIGHT_SOAK_ARGS:-}"
SMOKE_SCHEDULE_WAIT_SECONDS="${V2_SMOKE_SCHEDULE_WAIT_SECONDS:-95}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-e2e)
      WITH_E2E="true"
      shift
      ;;
    --api-port)
      API_PORT="$2"
      shift 2
      ;;
    --perf-args)
      PERF_ARGS_RAW="$2"
      shift 2
      ;;
    --soak-args)
      SOAK_ARGS_RAW="$2"
      shift 2
      ;;
    --smoke-wait-seconds)
      SMOKE_SCHEDULE_WAIT_SECONDS="$2"
      shift 2
      ;;
    *)
      echo "[v2-preflight] unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${PERF_ARGS_RAW}" ]]; then
  PERF_ARGS_RAW="--jobs 12 --concurrency 4 --files-per-job 1 --poll-timeout-seconds 120"
fi
if [[ -z "${SOAK_ARGS_RAW}" ]]; then
  SOAK_ARGS_RAW="--rounds 3 --jobs-per-round 8 --concurrency 4 --files-per-job 1 --poll-timeout-seconds 120 --sleep-between-rounds-seconds 1"
fi

read -r -a PERF_ARGS <<<"${PERF_ARGS_RAW}"
read -r -a SOAK_ARGS <<<"${SOAK_ARGS_RAW}"

timestamp="$(date +%Y%m%d-%H%M%S)"
log_dir="${ROOT_DIR}/data/preflight-logs/${timestamp}"
mkdir -p "${log_dir}"

api_pid=""
worker_pid=""
scheduler_pid=""

cleanup() {
  set +e
  if [[ -n "${scheduler_pid}" ]] && kill -0 "${scheduler_pid}" >/dev/null 2>&1; then
    kill "${scheduler_pid}" >/dev/null 2>&1
    wait "${scheduler_pid}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${worker_pid}" ]] && kill -0 "${worker_pid}" >/dev/null 2>&1; then
    kill "${worker_pid}" >/dev/null 2>&1
    wait "${worker_pid}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${api_pid}" ]] && kill -0 "${api_pid}" >/dev/null 2>&1; then
    kill "${api_pid}" >/dev/null 2>&1
    wait "${api_pid}" >/dev/null 2>&1 || true
  fi
  make v2-deps-down >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "[v2-preflight] logs dir: ${log_dir}"
echo "[v2-preflight] starting dependencies"
make v2-deps-up

echo "[v2-preflight] starting api on port ${API_PORT}"
(
  cd "${BACKEND_DIR}"
  python3 -m uvicorn app.main:app --host 127.0.0.1 --port "${API_PORT}" >"${log_dir}/api.log" 2>&1
) &
api_pid="$!"

echo "[v2-preflight] starting worker"
(
  cd "${BACKEND_DIR}"
  python3 -m celery -A app.core.celery_app.celery_app worker --loglevel="${V2_CELERY_LOGLEVEL:-warning}" >"${log_dir}/worker.log" 2>&1
) &
worker_pid="$!"

echo "[v2-preflight] starting scheduler"
(
  cd "${BACKEND_DIR}"
  python3 -m app.schedulers.runner >"${log_dir}/scheduler.log" 2>&1
) &
scheduler_pid="$!"

api_base="http://127.0.0.1:${API_PORT}"
echo "[v2-preflight] waiting for api health: ${api_base}/api/health"
for _ in $(seq 1 60); do
  if curl -fsS "${api_base}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "${api_base}/api/health" >/dev/null 2>&1; then
  echo "[v2-preflight] api health check failed, see ${log_dir}/api.log" >&2
  exit 2
fi

echo "[v2-preflight] running smoke"
V2_API_BASE_URL="${api_base}" V2_SMOKE_SCHEDULE_WAIT_SECONDS="${SMOKE_SCHEDULE_WAIT_SECONDS}" make v2-smoke

echo "[v2-preflight] running perf: ${PERF_ARGS_RAW}"
./scripts/v2/perf.sh --api-base "${api_base}" "${PERF_ARGS[@]}"

echo "[v2-preflight] running soak: ${SOAK_ARGS_RAW}"
./scripts/v2/soak.sh --api-base "${api_base}" "${SOAK_ARGS[@]}"

if [[ "${WITH_E2E}" == "true" ]]; then
  echo "[v2-preflight] running e2e"
  make v2-e2e
fi

echo "[v2-preflight] all checks passed"
echo "[v2-preflight] logs: ${log_dir}"
