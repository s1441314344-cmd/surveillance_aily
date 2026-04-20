# V2 P0 Failure Injection Matrix

## Purpose
- Validate that `preflight` can deterministically fail for high-frequency runtime failures.
- Keep the default release path unchanged.

## Scenarios

| Mode | Command | Expected Exit | Expected Readiness | Notes |
| --- | --- | --- | --- | --- |
| deps-unready | `./scripts/v2/preflight.sh --inject-deps-unready --output-dir /tmp/p0-fi-deps` | `2` | `api=failed`, `worker=skipped`, `scheduler=skipped` | Simulates dependency bootstrap failure before startup |
| queue-down | `./scripts/v2/preflight.sh --inject-queue-down --output-dir /tmp/p0-fi-queue` | `2` | `api=skipped`, `worker=failed`, `scheduler=skipped` | Deterministic queue failure injection without runtime startup |
| worker-unregistered | `./scripts/v2/preflight.sh --inject-worker-unregistered --output-dir /tmp/p0-fi-worker` | `2` | `api=skipped`, `worker=failed`, `scheduler=skipped` | Deterministic worker registration failure injection without runtime startup |

## Evidence Checklist
- `summary.json` exists under the selected `--output-dir`.
- `summary.json.parameter_summary.injection_mode` matches the selected mode.
- `summary.json.result == "failed"`.

## Guardrail
- Failure injection is opt-in only.
- Production/default verification remains:
  - `./scripts/v2/preflight.sh --with-e2e`
  - `make v2-release-gate-final`
