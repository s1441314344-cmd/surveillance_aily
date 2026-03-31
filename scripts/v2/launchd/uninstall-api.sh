#!/usr/bin/env bash
set -euo pipefail

PLIST_NAME="com.surveillance.v2.api.plist"
TARGET_PLIST="${HOME}/Library/LaunchAgents/${PLIST_NAME}"

if [ -f "${TARGET_PLIST}" ]; then
  launchctl bootout "gui/$(id -u)" "${TARGET_PLIST}" || true
  rm -f "${TARGET_PLIST}"
  echo "API launchd removed."
else
  echo "API launchd not installed."
fi
