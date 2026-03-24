.PHONY: help v2-help v2-setup v2-deps-up v2-deps-down v2-api v2-worker v2-scheduler v2-frontend v2-dev v2-smoke v2-e2e v2-perf v2-soak v2-preflight v2-backfill v2-eval v2-camera-check v2-camera-validate v2-release-drill v2-uat v2-release-checklist

help: v2-help

v2-help:
	@./scripts/v2/help.sh

v2-setup:
	@./scripts/v2/setup.sh

v2-deps-up:
	@./scripts/v2/deps-up.sh

v2-deps-down:
	@./scripts/v2/deps-down.sh

v2-api:
	@./scripts/v2/api.sh

v2-worker:
	@./scripts/v2/worker.sh

v2-scheduler:
	@./scripts/v2/scheduler.sh

v2-frontend:
	@./scripts/v2/frontend.sh

v2-dev:
	@./scripts/v2/dev.sh

v2-smoke:
	@./scripts/v2/smoke.sh

v2-e2e:
	@./scripts/v2/e2e.sh

v2-perf:
	@./scripts/v2/perf.sh

v2-soak:
	@./scripts/v2/soak.sh

v2-preflight:
	@./scripts/v2/preflight.sh

v2-backfill:
	@./scripts/v2/backfill.sh

v2-eval:
	@./scripts/v2/evaluate.sh

v2-camera-check:
	@./scripts/v2/camera-check.sh

v2-camera-validate:
	@./scripts/v2/camera-validate.sh

v2-release-drill:
	@./scripts/v2/release-drill.sh

v2-uat:
	@./scripts/v2/uat.sh

v2-release-checklist:
	@./scripts/v2/release-checklist.sh
