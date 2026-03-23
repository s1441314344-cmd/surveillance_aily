#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd docker

docker compose -f "${COMPOSE_FILE}" stop postgres redis
echo "[v2] dependencies stopped: postgres + redis"
