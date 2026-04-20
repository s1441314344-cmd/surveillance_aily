from datetime import datetime

from app.core.database import SessionLocal
from app.services.alert_service import run_due_alert_webhook_deliveries_once as run_due_alert_webhook_deliveries_once_with_db


def run_due_alert_webhook_deliveries_once(*, now: datetime | None = None) -> list[str]:
    with SessionLocal() as db:
        return run_due_alert_webhook_deliveries_once_with_db(db, now=now)
