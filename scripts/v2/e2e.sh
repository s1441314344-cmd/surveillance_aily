#!/usr/bin/env bash
set -euo pipefail

# Backward-compatible shim: keep `make v2-e2e` stable while centralizing execution.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/e2e-entrypoint.sh" "$@"
