#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd docker

dependency_containers=(
  "surveillance-v2-postgres"
  "surveillance-v2-redis"
  "surveillance-v2-local-detector"
)

container_exists() {
  local name="$1"
  docker ps -a --format '{{.Names}}' | grep -Fxq "${name}"
}

all_dependency_containers_exist() {
  local container_name
  for container_name in "${dependency_containers[@]}"; do
    if ! container_exists "${container_name}"; then
      return 1
    fi
  done
  return 0
}

wait_for_container_ready() {
  local name="$1"
  local attempts="${2:-60}"
  local attempt status
  for attempt in $(seq 1 "${attempts}"); do
    status="$(
      docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{if .State.Running}}running{{else}}stopped{{end}}{{end}}' \
        "${name}" 2>/dev/null || echo "missing"
    )"
    if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
      return 0
    fi
    sleep 1
  done
  echo "[v2] dependency container not ready: ${name} (last status=${status})" >&2
  return 1
}

if all_dependency_containers_exist; then
  echo "[v2] reusing existing dependency containers by name"
  for container_name in "${dependency_containers[@]}"; do
    docker start "${container_name}" >/dev/null 2>&1 || true
  done
else
  compose_error_log="$(mktemp)"
  if ! docker compose -f "${COMPOSE_FILE}" up -d postgres redis local-detector 2> >(tee "${compose_error_log}" >&2); then
    if grep -qi "container name .* is already in use" "${compose_error_log}"; then
      echo "[v2] detected existing dependency containers; attempting reuse by container name"
      for container_name in "${dependency_containers[@]}"; do
        if container_exists "${container_name}"; then
          docker start "${container_name}" >/dev/null 2>&1 || true
        fi
      done
    else
      rm -f "${compose_error_log}"
      exit 1
    fi
  fi
  rm -f "${compose_error_log}"
fi

for container_name in "${dependency_containers[@]}"; do
  if container_exists "${container_name}"; then
    wait_for_container_ready "${container_name}" 90
  fi
done

echo "[v2] dependencies are ready: postgres + redis + local-detector"
