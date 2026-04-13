#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd npm

# Canonical V2 E2E entrypoint used by preflight/UAT/release flows.
cd "${FRONTEND_DIR}"
E2E_GROUP="${V2_E2E_GROUP:-}"
if [[ -z "${E2E_GROUP}" ]]; then
  env -u NO_COLOR npm run e2e -- "$@"
  exit 0
fi

case "${E2E_GROUP}" in
  grouped|all)
    env -u NO_COLOR npm run e2e:grouped -- "$@"
    ;;
  mainline)
    env -u NO_COLOR npm run e2e:mainline -- "$@"
    ;;
  observability)
    env -u NO_COLOR npm run e2e:observability -- "$@"
    ;;
  regression)
    env -u NO_COLOR npm run e2e:regression -- "$@"
    ;;
  *)
    echo "[v2-e2e] unsupported V2_E2E_GROUP: ${E2E_GROUP}" >&2
    echo "[v2-e2e] supported values: grouped, all, mainline, observability, regression" >&2
    exit 2
    ;;
esac
