#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PLIST_NAME="com.surveillance.v2.scheduler.plist"
SOURCE_PLIST="${ROOT_DIR}/scripts/v2/launchd/${PLIST_NAME}"
TARGET_PLIST="${HOME}/Library/LaunchAgents/${PLIST_NAME}"
LOG_DIR="${ROOT_DIR}/backend-v2/logs"

mkdir -p "${LOG_DIR}"
mkdir -p "${HOME}/Library/LaunchAgents"
cp -f "${SOURCE_PLIST}" "${TARGET_PLIST}"

if launchctl list | rg -q "com.surveillance.v2.scheduler"; then
  launchctl bootout "gui/$(id -u)" "${TARGET_PLIST}" || true
fi
launchctl bootstrap "gui/$(id -u)" "${TARGET_PLIST}"
launchctl enable "gui/$(id -u)/com.surveillance.v2.scheduler"
launchctl kickstart -k "gui/$(id -u)/com.surveillance.v2.scheduler"

echo "Scheduler launchd installed and started."
