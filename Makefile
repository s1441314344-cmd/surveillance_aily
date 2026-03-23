.PHONY: help v2-help v2-deps-up v2-deps-down v2-api v2-worker v2-scheduler v2-frontend v2-dev

help: v2-help

v2-help:
	@./scripts/v2/help.sh

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
