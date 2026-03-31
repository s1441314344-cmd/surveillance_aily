#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${SCRIPT_DIR}/install-worker.sh"
"${SCRIPT_DIR}/install-scheduler.sh"
"${SCRIPT_DIR}/install-api.sh"

echo "All launchd services installed and started."
