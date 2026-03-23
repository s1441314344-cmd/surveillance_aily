#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd npm

ensure_backend_env

echo "[v2] installing backend dependencies..."
python3 -m pip install -r "${BACKEND_DIR}/requirements.txt"

echo "[v2] installing frontend dependencies..."
cd "${FRONTEND_DIR}"
npm install

echo "[v2] setup completed"
