#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend-v2"
FRONTEND_DIR="${ROOT_DIR}/frontend-v2"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.v2.yml"

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "[v2] missing command: ${cmd}" >&2
    exit 1
  fi
}

ensure_backend_env() {
  if [[ ! -f "${BACKEND_DIR}/.env" && -f "${BACKEND_DIR}/.env.example" ]]; then
    cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
    echo "[v2] created backend-v2/.env from .env.example"
  fi
}
