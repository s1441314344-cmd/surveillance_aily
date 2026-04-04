import logging
from collections.abc import Callable
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def process_due_monitor_config(
    *,
    db: Session,
    config: Any,
    current_time: datetime,
    should_dispatch: bool,
    run_local_gate: Callable[..., tuple[bool, str | None]],
    advance_schedule: Callable[..., None],
    mark_error: Callable[..., None],
    dispatch_cycle: Callable[..., None],
) -> bool:
    try:
        if bool(getattr(config, "strict_local_gate", True)):
            local_gate_passed, local_gate_message = run_local_gate(
                db=db,
                camera_id=config.camera_id,
                strategy_id=config.signal_strategy_id,
                monitor_config=config,
            )
            if not local_gate_passed:
                advance_schedule(config, now=current_time)
                config.last_error = local_gate_message or "Signal monitor local gate blocked"
                db.commit()
                return False

        advance_schedule(config, now=current_time)
        db.commit()
        dispatch_cycle(db=db, camera_id=config.camera_id, dispatch=should_dispatch)
        return True
    except Exception as exc:  # pragma: no cover - safety fallback
        db.rollback()
        persisted_config = db.get(type(config), config.id)
        if persisted_config is None:
            return False
        mark_error(persisted_config, error_message=str(exc), now=current_time)
        db.commit()
        logger.warning("signal monitor cycle failed for camera_id=%s: %s", config.camera_id, exc)
        return False
