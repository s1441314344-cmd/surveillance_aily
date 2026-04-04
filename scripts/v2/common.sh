#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend-v2"
FRONTEND_DIR="${ROOT_DIR}/frontend-v2"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.v2.yml"

git_current_sha() {
  git -C "${ROOT_DIR}" rev-parse HEAD 2>/dev/null || echo "unknown"
}

git_current_branch() {
  git -C "${ROOT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

git_is_dirty() {
  if ! git -C "${ROOT_DIR}" diff --no-ext-diff --quiet --ignore-submodules --exit-code 2>/dev/null; then
    echo "true"
    return
  fi
  if ! git -C "${ROOT_DIR}" diff --no-ext-diff --cached --quiet --ignore-submodules --exit-code 2>/dev/null; then
    echo "true"
    return
  fi
  echo "false"
}

resolve_v2_environment() {
  if [[ -n "${V2_ENVIRONMENT:-}" ]]; then
    echo "${V2_ENVIRONMENT}"
    return
  fi
  if [[ -n "${APP_ENV:-}" ]]; then
    echo "${APP_ENV}"
    return
  fi
  echo "development"
}

build_run_id() {
  local prefix="$1"
  local timestamp="$2"
  local git_sha
  git_sha="$(git_current_sha)"
  echo "${prefix}-${timestamp}-${git_sha:0:8}"
}

require_readable_file() {
  local path="$1"
  local label="${2:-file}"
  if [[ -z "${path}" ]]; then
    echo "[v2] ${label} path is empty" >&2
    return 1
  fi
  if [[ ! -r "${path}" ]]; then
    echo "[v2] ${label} is not readable: ${path}" >&2
    return 1
  fi
}

load_backend_runtime_flags() {
  local raw
  raw="$(
    cd "${BACKEND_DIR}"
    python3 - <<'PY'
from app.core.config import get_settings

settings = get_settings()
print(f"LOCAL_DETECTOR_STRICT_BLOCK={'true' if settings.local_detector_strict_block else 'false'}")
print(f"PROVIDER_MOCK_FALLBACK_ENABLED={'true' if settings.provider_mock_fallback_enabled else 'false'}")
PY
  )"
  while IFS='=' read -r key value; do
    case "${key}" in
      LOCAL_DETECTOR_STRICT_BLOCK)
        export LOCAL_DETECTOR_STRICT_BLOCK="${value}"
        ;;
      PROVIDER_MOCK_FALLBACK_ENABLED)
        export PROVIDER_MOCK_FALLBACK_ENABLED="${value}"
        ;;
    esac
  done <<<"${raw}"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "[v2] missing command: ${cmd}" >&2
    exit 1
  fi
}

require_python_module() {
  local module="$1"
  if ! python3 - <<PY >/dev/null 2>&1
import importlib
importlib.import_module("${module}")
PY
  then
    echo "[v2] missing python module: ${module}" >&2
    echo "[v2] run 'make v2-setup' or install backend-v2/requirements.txt first" >&2
    exit 1
  fi
}

ensure_backend_env() {
  if [[ ! -f "${BACKEND_DIR}/.env" && -f "${BACKEND_DIR}/.env.example" ]]; then
    cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
    echo "[v2] created backend-v2/.env from .env.example"
  fi
}
