# V2 E2E Grouped Entrypoint Guide

## Purpose
- Provide a deterministic grouped E2E execution path for `mainline / observability / regression`.
- Keep existing default behavior unchanged for release and historical flows.

## Entrypoint
- Script: `./scripts/v2/e2e-entrypoint.sh`
- Default behavior (no env): runs `npm run e2e`

## Group Selection
Set `V2_E2E_GROUP` to select a grouped suite:

- `grouped` / `all`: `npm run e2e:grouped`
- `mainline`: `npm run e2e:mainline`
- `observability`: `npm run e2e:observability`
- `regression`: `npm run e2e:regression`

Invalid values return exit code `2`.

## Examples
- `V2_E2E_GROUP=mainline ./scripts/v2/e2e-entrypoint.sh`
- `V2_E2E_GROUP=observability ./scripts/v2/e2e-entrypoint.sh --project=chromium`
- `V2_E2E_GROUP=grouped ./scripts/v2/e2e-entrypoint.sh`

## Guardrail
- `make v2-release-gate-final` remains the default release gate.
- Grouped E2E selection is opt-in and does not change default release policy.
