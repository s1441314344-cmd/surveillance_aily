from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.alert import AlertWebhookDelivery
from app.services.scheduler_service import run_due_signal_monitors_once

from .test_auth_and_users import auth_headers, login_as_admin


def test_trigger_rule_debug_live_extracts_signals(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])
    camera = _create_mock_camera(client, headers, name="debug-live-camera")
    strategy = _create_signal_strategy(client, headers, name="debug-live-strategy")

    create_rule_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules",
        headers=headers,
        json={
            "name": "火情阈值规则",
            "event_type": "fire",
            "enabled": True,
            "min_confidence": 0.6,
            "min_consecutive_frames": 1,
            "cooldown_seconds": 0,
        },
    )
    assert create_rule_response.status_code == 200

    debug_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules/debug-live",
        headers=headers,
        json={
            "strategy_id": strategy["id"],
            "dry_run": True,
            "capture_on_match": False,
        },
    )
    assert debug_response.status_code == 200
    body = debug_response.json()
    assert body["detected_signals"] is not None
    assert body["detected_signals"]["fire"] >= 0.9
    assert body["matched_count"] == 1
    assert body["results"][0]["matched"] is True


def test_expression_rule_matches_in_debug(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])
    camera = _create_mock_camera(client, headers, name="expression-camera")

    create_rule_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules",
        headers=headers,
        json={
            "name": "复合表达式规则",
            "event_type": "person",
            "match_mode": "expression",
            "expression_json": {
                "op": "and",
                "conditions": [
                    {"signal": "person", "op": "gte", "value": 0.7, "min_consecutive": 2},
                    {"op": "not", "condition": {"signal": "fire", "op": "gte", "value": 0.5}},
                ],
            },
            "enabled": True,
            "cooldown_seconds": 0,
        },
    )
    assert create_rule_response.status_code == 200

    debug_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules/debug",
        headers=headers,
        json={
            "signals": {"person": 0.88, "fire": 0.1},
            "consecutive_hits": {"person": 2, "fire": 1},
            "dry_run": True,
        },
    )
    assert debug_response.status_code == 200
    body = debug_response.json()
    assert body["matched_count"] == 1
    assert body["results"][0]["matched"] is True
    assert body["results"][0]["match_mode"] == "expression"


def test_signal_monitor_schedule_triggers_alert(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])
    camera = _create_mock_camera(client, headers, name="monitor-schedule-camera")
    strategy = _create_signal_strategy(client, headers, name="monitor-schedule-strategy")

    create_rule_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules",
        headers=headers,
        json={
            "name": "调度火情规则",
            "event_type": "fire",
            "enabled": True,
            "min_confidence": 0.6,
            "min_consecutive_frames": 1,
            "cooldown_seconds": 0,
        },
    )
    assert create_rule_response.status_code == 200

    update_config_response = client.put(
        f"/api/cameras/{camera['id']}/signal-monitor-config",
        headers=headers,
        json={
            "enabled": True,
            "runtime_mode": "daemon",
            "signal_strategy_id": strategy["id"],
            "monitor_interval_seconds": 1,
        },
    )
    assert update_config_response.status_code == 200

    start_response = client.post(
        f"/api/cameras/{camera['id']}/signal-monitor/start",
        headers=headers,
        json={"duration_seconds": 120},
    )
    assert start_response.status_code == 200

    processed_camera_ids = run_due_signal_monitors_once(
        now=datetime.now() + timedelta(seconds=5),
        dispatch_jobs=False,
    )
    assert camera["id"] in processed_camera_ids

    list_alerts_response = client.get(f"/api/alerts?camera_id={camera['id']}", headers=headers)
    assert list_alerts_response.status_code == 200
    alerts = list_alerts_response.json()
    assert len(alerts) >= 1
    assert alerts[0]["camera_id"] == camera["id"]


def test_alert_webhook_delivery_record_created(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])
    camera = _create_mock_camera(client, headers, name="webhook-camera")
    strategy = _create_signal_strategy(client, headers, name="webhook-strategy")

    create_rule_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules",
        headers=headers,
        json={
            "name": "webhook规则",
            "event_type": "fire",
            "enabled": True,
            "min_confidence": 0.6,
            "min_consecutive_frames": 1,
            "cooldown_seconds": 0,
        },
    )
    assert create_rule_response.status_code == 200

    create_webhook_response = client.post(
        "/api/alert-webhooks",
        headers=headers,
        json={
            "name": "默认Webhook",
            "url": "https://example.com/webhook",
            "status": "active",
            "timeout_seconds": 3,
        },
    )
    assert create_webhook_response.status_code == 200

    class DummyResponse:
        def __init__(self):
            self.status_code = 200
            self.text = "ok"

    class DummyClient:
        def __init__(self, timeout):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, *_args, **_kwargs):
            return DummyResponse()

    monkeypatch.setattr("app.services.alert_service.httpx.Client", DummyClient)

    debug_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules/debug-live",
        headers=headers,
        json={
            "strategy_id": strategy["id"],
            "dry_run": False,
            "capture_on_match": False,
            "source_kind": "trigger_rule_auto",
        },
    )
    assert debug_response.status_code == 200
    assert debug_response.json()["matched_count"] >= 1

    with SessionLocal() as db:
        deliveries = list(db.scalars(select(AlertWebhookDelivery)))
    assert len(deliveries) >= 1
    assert deliveries[0].status == "success"
    assert deliveries[0].response_code == 200


def test_alert_webhook_create_supports_endpoint_enabled_shape(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_webhook_response = client.post(
        "/api/alert-webhooks",
        headers=headers,
        json={
            "name": "Endpoint Alias Webhook",
            "endpoint": "https://example.com/alias-webhook",
            "enabled": True,
            "events": ["fire", "person"],
            "timeout_seconds": 5,
        },
    )
    assert create_webhook_response.status_code == 200
    payload = create_webhook_response.json()
    assert payload["name"] == "Endpoint Alias Webhook"
    assert payload["url"] == "https://example.com/alias-webhook"
    assert payload["status"] == "active"


def test_alert_webhook_update_supports_endpoint_enabled_shape(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_webhook_response = client.post(
        "/api/alert-webhooks",
        headers=headers,
        json={
            "name": "Webhook For Update",
            "url": "https://example.com/origin-webhook",
            "status": "active",
            "timeout_seconds": 3,
        },
    )
    assert create_webhook_response.status_code == 200
    webhook = create_webhook_response.json()

    update_webhook_response = client.patch(
        f"/api/alert-webhooks/{webhook['id']}",
        headers=headers,
        json={
            "endpoint": "https://example.com/updated-webhook",
            "enabled": False,
        },
    )
    assert update_webhook_response.status_code == 200
    updated = update_webhook_response.json()
    assert updated["url"] == "https://example.com/updated-webhook"
    assert updated["status"] == "inactive"


def test_alert_list_supports_acknowledged_alias_severity_and_keyword_filters(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])
    camera = _create_mock_camera(client, headers, name="alerts-filter-camera")
    strategy = _create_signal_strategy(client, headers, name="alerts-filter-strategy")

    create_rule_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules",
        headers=headers,
        json={
            "name": "关键火情规则Alpha",
            "event_type": "fire",
            "enabled": True,
            "min_confidence": 0.6,
            "min_consecutive_frames": 1,
            "cooldown_seconds": 0,
            "description": "用于关键字筛选验证",
        },
    )
    assert create_rule_response.status_code == 200

    debug_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules/debug-live",
        headers=headers,
        json={
            "strategy_id": strategy["id"],
            "dry_run": False,
            "capture_on_match": False,
            "source_kind": "trigger_rule_auto",
        },
    )
    assert debug_response.status_code == 200
    assert debug_response.json()["matched_count"] >= 1

    list_open_response = client.get(
        f"/api/alerts?camera_id={camera['id']}&status=open",
        headers=headers,
    )
    assert list_open_response.status_code == 200
    open_alerts = list_open_response.json()
    assert len(open_alerts) >= 1
    alert_id = open_alerts[0]["id"]

    ack_response = client.post(f"/api/alerts/{alert_id}/ack", headers=headers)
    assert ack_response.status_code == 200
    assert ack_response.json()["status"] == "acked"

    acknowledged_list_response = client.get(
        f"/api/alerts?camera_id={camera['id']}&status=acknowledged",
        headers=headers,
    )
    assert acknowledged_list_response.status_code == 200
    acknowledged_alerts = acknowledged_list_response.json()
    assert any(item["id"] == alert_id for item in acknowledged_alerts)

    severity_response = client.get(
        f"/api/alerts?camera_id={camera['id']}&severity=critical",
        headers=headers,
    )
    assert severity_response.status_code == 200
    severity_alerts = severity_response.json()
    assert any(item["id"] == alert_id for item in severity_alerts)

    keyword_response = client.get(
        f"/api/alerts?camera_id={camera['id']}&keyword=Alpha",
        headers=headers,
    )
    assert keyword_response.status_code == 200
    keyword_alerts = keyword_response.json()
    assert any(item["id"] == alert_id for item in keyword_alerts)


def _create_mock_camera(client, headers: dict[str, str], *, name: str) -> dict:
    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": name,
            "location": "signal-test",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": f"rtsp://mock/{name}",
            "frame_frequency_seconds": 10,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": f"./data/storage/cameras/{name}",
        },
    )
    assert create_camera_response.status_code == 200
    return create_camera_response.json()


def _create_signal_strategy(client, headers: dict[str, str], *, name: str) -> dict:
    create_strategy_response = client.post(
        "/api/strategies",
        headers=headers,
        json={
            "name": name,
            "scene_description": "signal strategy",
            "prompt_template": "return json",
            "model_provider": "zhipu",
            "model_name": "glm-4v-plus",
            "result_format": "json_schema",
            "response_schema": {
                "type": "object",
                "properties": {"fire": {"type": "number"}},
                "required": ["fire"],
            },
            "status": "active",
            "is_signal_strategy": True,
            "signal_mapping": {"fire": "fire"},
        },
    )
    assert create_strategy_response.status_code == 200
    return create_strategy_response.json()
