#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${SCRIPT_DIR}/uninstall-api.sh"
"${SCRIPT_DIR}/uninstall-scheduler.sh"
"${SCRIPT_DIR}/uninstall-worker.sh"

echo "All launchd services removed."
