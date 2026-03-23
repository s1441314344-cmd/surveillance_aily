import os
import tempfile

import pytest
from fastapi.testclient import TestClient

test_db_path = os.path.join(tempfile.gettempdir(), "surveillance_v2_test.db")

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["CELERY_ENABLED"] = "false"
os.environ["BOOTSTRAP_ADMIN_USERNAME"] = "admin"
os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = "admin123456"
os.environ["BOOTSTRAP_ADMIN_DISPLAY_NAME"] = "测试管理员"

from app.main import app
from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.services.bootstrap import seed_defaults


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_defaults(db)
    yield


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client
