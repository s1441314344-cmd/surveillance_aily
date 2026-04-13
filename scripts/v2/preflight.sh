#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd make
require_cmd date
require_cmd curl
require_cmd grep
ensure_backend_env
load_backend_runtime_flags

API_PORT="${V2_PREFLIGHT_API_PORT:-5810}"
WITH_E2E="false"
PERF_ARGS_RAW="${V2_PREFLIGHT_PERF_ARGS:-}"
SOAK_ARGS_RAW="${V2_PREFLIGHT_SOAK_ARGS:-}"
SMOKE_SCHEDULE_WAIT_SECONDS="${V2_SMOKE_SCHEDULE_WAIT_SECONDS:-125}"
OUTPUT_DIR="${V2_PREFLIGHT_OUTPUT_DIR:-}"
INJECTION_MODE="${V2_PREFLIGHT_INJECTION_MODE:-}"

set_injection_mode() {
  local mode="$1"
  if [[ -n "${INJECTION_MODE}" && "${INJECTION_MODE}" != "${mode}" ]]; then
    echo "[v2-preflight] failure injection mode conflict: ${INJECTION_MODE} vs ${mode}" >&2
    exit 2
  fi
  INJECTION_MODE="${mode}"
}

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
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --inject-deps-unready)
      set_injection_mode "deps-unready"
      shift
      ;;
    --inject-queue-down)
      set_injection_mode "queue-down"
      shift
      ;;
    --inject-worker-unregistered)
      set_injection_mode "worker-unregistered"
      shift
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
run_id="${V2_RUN_ID:-$(build_run_id "preflight" "${timestamp}")}"
git_sha="$(git_current_sha)"
branch="$(git_current_branch)"
git_dirty="$(git_is_dirty)"
environment="$(resolve_v2_environment)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/preflight-logs/${run_id}"
fi
log_dir="${OUTPUT_DIR}"
mkdir -p "${log_dir}"
started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

smoke_status="skipped"
perf_status="skipped"
soak_status="skipped"
e2e_status="skipped"
api_readiness_status="waiting"
worker_readiness_status="waiting"
scheduler_readiness_status="waiting"

smoke_log_path="${log_dir}/smoke.log"
perf_json_path="${log_dir}/perf.json"
soak_json_path="${log_dir}/soak.json"
summary_json_path="${log_dir}/summary.json"

api_pid=""
worker_pid=""
scheduler_pid=""
celery_pool="$(resolve_celery_pool)"

wait_for_http_health() {
  local url="$1"
  local attempts="${2:-60}"
  local label="${3:-service}"
  local attempt
  for attempt in $(seq 1 "${attempts}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    if [[ -n "${api_pid}" ]] && ! kill -0 "${api_pid}" >/dev/null 2>&1; then
      echo "[v2-preflight] ${label} process exited before health check passed" >&2
      return 1
    fi
    sleep 1
  done
  return 1
}

wait_for_worker_ready() {
  local attempts="${1:-60}"
  local attempt
  for attempt in $(seq 1 "${attempts}"); do
    if [[ -n "${worker_pid}" ]] && ! kill -0 "${worker_pid}" >/dev/null 2>&1; then
      echo "[v2-preflight] worker process exited before readiness check passed" >&2
      return 1
    fi
    if (
      cd "${BACKEND_DIR}"
      python3 -m celery -A app.core.celery_app.celery_app inspect ping --timeout=1 >/dev/null 2>&1
    ); then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_scheduler_ready() {
  local attempts="${1:-60}"
  local log_path="$2"
  local attempt
  for attempt in $(seq 1 "${attempts}"); do
    if [[ -n "${scheduler_pid}" ]] && ! kill -0 "${scheduler_pid}" >/dev/null 2>&1; then
      echo "[v2-preflight] scheduler process exited before readiness check passed" >&2
      return 1
    fi
    if [[ -r "${log_path}" ]] && grep -q "scheduler started with poll interval=" "${log_path}"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

write_summary() {
  local exit_code="$1"
  local finished_at
  local overall_status
  finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  if [[ "${exit_code}" -eq 0 ]]; then
    overall_status="passed"
  else
    overall_status="failed"
  fi

  python3 - <<PY
import json
from pathlib import Path

summary = {
    "run_id": "${run_id}",
    "git_sha": "${git_sha}",
    "branch": "${branch}",
    "git_dirty": "${git_dirty}" == "true",
    "started_at": "${started_at}",
    "finished_at": "${finished_at}",
    "environment": "${environment}",
    "api_base": "${api_base:-}",
    "result": "${overall_status}",
    "exit_code": int("${exit_code}"),
    "parameter_summary": {
        "with_e2e": "${WITH_E2E}" == "true",
        "api_port": int("${API_PORT}"),
        "smoke_wait_seconds": int("${SMOKE_SCHEDULE_WAIT_SECONDS}"),
        "perf_args": "${PERF_ARGS_RAW}",
        "soak_args": "${SOAK_ARGS_RAW}",
        "injection_mode": "${INJECTION_MODE}" or None,
        "output_dir": "${OUTPUT_DIR}",
    },
    "readiness": {
        "api": {
            "status": "${api_readiness_status}",
            "health_url": "${api_base:-}/api/health",
        },
        "worker": {
            "status": "${worker_readiness_status}",
            "log_path": "${log_dir}/worker.log",
        },
        "scheduler": {
            "status": "${scheduler_readiness_status}",
            "log_path": "${log_dir}/scheduler.log",
        },
    },
    "runtime_flags": {
        "local_detector_strict_block": "${LOCAL_DETECTOR_STRICT_BLOCK:-true}" == "true",
        "provider_mock_fallback_enabled": "${PROVIDER_MOCK_FALLBACK_ENABLED:-true}" == "true",
    },
    "checks": {
        "smoke": {
            "status": "${smoke_status}",
            "log_path": "${smoke_log_path}",
        },
        "perf": {
            "status": "${perf_status}",
            "report_path": "${perf_json_path}",
        },
        "soak": {
            "status": "${soak_status}",
            "report_path": "${soak_json_path}",
        },
        "e2e": {
            "status": "${e2e_status}",
        },
    },
}
Path("${summary_json_path}").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
PY
}

cleanup() {
  local exit_code="$?"
  write_summary "${exit_code}"
  set +e
  kill_process_tree "${scheduler_pid}"
  kill_process_tree "${worker_pid}"
  kill_process_tree "${api_pid}"
  [[ -n "${scheduler_pid}" ]] && wait "${scheduler_pid}" >/dev/null 2>&1 || true
  [[ -n "${worker_pid}" ]] && wait "${worker_pid}" >/dev/null 2>&1 || true
  [[ -n "${api_pid}" ]] && wait "${api_pid}" >/dev/null 2>&1 || true
  make v2-deps-down >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "[v2-preflight] logs dir: ${log_dir}"
echo "[v2-preflight] run_id: ${run_id}"

if [[ "${INJECTION_MODE}" == "deps-unready" ]]; then
  api_readiness_status="failed"
  worker_readiness_status="skipped"
  scheduler_readiness_status="skipped"
  echo "[v2-preflight] failure injection active: deps-unready" >&2
  exit 2
fi

if [[ "${INJECTION_MODE}" == "queue-down" ]]; then
  api_readiness_status="skipped"
  worker_readiness_status="failed"
  scheduler_readiness_status="skipped"
  echo "[v2-preflight] failure injection active: queue-down" >&2
  exit 2
fi

if [[ "${INJECTION_MODE}" == "worker-unregistered" ]]; then
  api_readiness_status="skipped"
  worker_readiness_status="failed"
  scheduler_readiness_status="skipped"
  echo "[v2-preflight] failure injection active: worker-unregistered" >&2
  exit 2
fi

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
  V2_CELERY_LOGLEVEL="${V2_CELERY_LOGLEVEL:-warning}" \
  V2_CELERY_POOL="${celery_pool}" \
  V2_CELERY_CONCURRENCY="${V2_CELERY_CONCURRENCY:-1}" \
  V2_CELERY_PREFETCH_MULTIPLIER="${V2_CELERY_PREFETCH_MULTIPLIER:-1}" \
  ./scripts/v2/worker.sh >"${log_dir}/worker.log" 2>&1
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
if ! wait_for_http_health "${api_base}/api/health" 60 "api"; then
  api_readiness_status="failed"
  echo "[v2-preflight] api health check failed, see ${log_dir}/api.log" >&2
  exit 2
fi
api_readiness_status="ready"

echo "[v2-preflight] waiting for worker readiness"
if ! wait_for_worker_ready 60; then
  worker_readiness_status="failed"
  echo "[v2-preflight] worker readiness failed, see ${log_dir}/worker.log" >&2
  exit 2
fi
worker_readiness_status="ready"

echo "[v2-preflight] waiting for scheduler readiness"
if ! wait_for_scheduler_ready 60 "${log_dir}/scheduler.log"; then
  scheduler_readiness_status="failed"
  echo "[v2-preflight] scheduler readiness failed, see ${log_dir}/scheduler.log" >&2
  exit 2
fi
scheduler_readiness_status="ready"

echo "[v2-preflight] running smoke"
if V2_API_BASE_URL="${api_base}" V2_SMOKE_SCHEDULE_WAIT_SECONDS="${SMOKE_SCHEDULE_WAIT_SECONDS}" make v2-smoke | tee "${smoke_log_path}"; then
  smoke_status="passed"
else
  smoke_status="failed"
  exit 1
fi

echo "[v2-preflight] running perf: ${PERF_ARGS_RAW}"
if ./scripts/v2/perf.sh --api-base "${api_base}" --output-json "${perf_json_path}" "${PERF_ARGS[@]}"; then
  perf_status="passed"
else
  perf_status="failed"
  exit 1
fi

echo "[v2-preflight] running soak: ${SOAK_ARGS_RAW}"
if ./scripts/v2/soak.sh --api-base "${api_base}" --output-json "${soak_json_path}" "${SOAK_ARGS[@]}"; then
  soak_status="passed"
else
  soak_status="failed"
  exit 1
fi

if [[ "${WITH_E2E}" == "true" ]]; then
  echo "[v2-preflight] running e2e"
  if ./scripts/v2/e2e-entrypoint.sh; then
    e2e_status="passed"
  else
    e2e_status="failed"
    exit 1
  fi
fi

echo "[v2-preflight] all checks passed"
echo "[v2-preflight] logs: ${log_dir}"
echo "[v2-preflight] summary: ${summary_json_path}"
