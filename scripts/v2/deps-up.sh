#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd docker

docker compose -f "${COMPOSE_FILE}" up -d postgres redis local-detector
echo "[v2] dependencies are up: postgres + redis + local-detector"
