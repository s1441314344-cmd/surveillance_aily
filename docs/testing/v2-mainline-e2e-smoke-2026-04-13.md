# V2 Mainline E2E Smoke Record (2026-04-13)

## Purpose
- Record grouped E2E smoke evidence after P0/P1 optimization batches.
- Validate that `mainline` critical paths remain healthy with the new grouped entrypoint.

## Command
- `V2_E2E_GROUP=mainline ./scripts/v2/e2e-entrypoint.sh`

## Result
- Status: `passed`
- Summary: `5 passed (31.2s)`
- Group: `tests/e2e/mainline`

## Notes
- First run failed with `vite: command not found` in `frontend-v2` runtime.
- After `npm --prefix frontend-v2 install`, rerun passed.

## Guardrail
- This record is smoke evidence only.
- Default release gate remains:
  - `make v2-release-gate-final`
