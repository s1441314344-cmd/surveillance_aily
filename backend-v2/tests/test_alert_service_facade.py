from datetime import datetime, timezone

from app.schemas.alert import AlertFeishuChatSearchResponse
from app.schemas.alert import AlertFeishuUserSearchResponse
from app.services import alert_service


def test_dispatch_alert_webhooks_facade_uses_alert_service_httpx_client(monkeypatch):
    from app.services import alert_webhook_helpers

    captured: dict[str, object] = {}
    expected_result = ["delivery-1"]

    class SentinelClient:
        pass

    def _fake_dispatch(db, *, event, httpx_client_factory):
        captured["db"] = db
        captured["event"] = event
        captured["httpx_client_factory"] = httpx_client_factory
        return expected_result

    sentinel_db = object()
    sentinel_event = object()

    monkeypatch.setattr(alert_service.httpx, "Client", SentinelClient)
    monkeypatch.setattr(alert_webhook_helpers, "dispatch_alert_webhooks", _fake_dispatch)

    result = alert_service.dispatch_alert_webhooks(sentinel_db, event=sentinel_event)

    assert result == expected_result
    assert captured["db"] is sentinel_db
    assert captured["event"] is sentinel_event
    assert captured["httpx_client_factory"] is SentinelClient


def test_dispatch_alert_notifications_facade_uses_alert_service_runtime_deps(monkeypatch):
    from app.services import alert_notification_helpers

    captured: dict[str, object] = {}
    expected_result = ["route-1"]

    def _fake_run(*_args, **_kwargs):
        return None

    def _fake_dispatch(db, *, event, settings_obj, subprocess_run):
        captured["db"] = db
        captured["event"] = event
        captured["settings_obj"] = settings_obj
        captured["subprocess_run"] = subprocess_run
        return expected_result

    sentinel_db = object()
    sentinel_event = object()

    monkeypatch.setattr(alert_service.subprocess, "run", _fake_run)
    monkeypatch.setattr(alert_notification_helpers, "dispatch_alert_notifications", _fake_dispatch)

    result = alert_service.dispatch_alert_notifications(sentinel_db, event=sentinel_event)

    assert result == expected_result
    assert captured["db"] is sentinel_db
    assert captured["event"] is sentinel_event
    assert captured["settings_obj"] is alert_service.settings
    assert captured["subprocess_run"] is _fake_run


def test_search_lark_users_facade_uses_alert_service_runtime_deps(monkeypatch):
    from app.services import alert_notification_helpers

    captured: dict[str, object] = {}

    def _fake_run(*_args, **_kwargs):
        return None

    def _fake_search(*, keyword, limit, page_token, settings_obj, subprocess_run):
        captured["keyword"] = keyword
        captured["limit"] = limit
        captured["page_token"] = page_token
        captured["settings_obj"] = settings_obj
        captured["subprocess_run"] = subprocess_run
        return AlertFeishuUserSearchResponse(items=[], has_more=False, page_token=None)

    monkeypatch.setattr(alert_service.subprocess, "run", _fake_run)
    monkeypatch.setattr(alert_notification_helpers, "search_lark_users_for_alert_routes", _fake_search)

    response = alert_service.search_lark_users_for_alert_routes(keyword="Shao", limit=5, page_token="pt")

    assert response.items == []
    assert captured["keyword"] == "Shao"
    assert captured["limit"] == 5
    assert captured["page_token"] == "pt"
    assert captured["settings_obj"] is alert_service.settings
    assert captured["subprocess_run"] is _fake_run


def test_search_lark_chats_facade_uses_alert_service_runtime_deps(monkeypatch):
    from app.services import alert_notification_helpers

    captured: dict[str, object] = {}

    def _fake_run(*_args, **_kwargs):
        return None

    def _fake_search(*, keyword, limit, page_token, settings_obj, subprocess_run):
        captured["keyword"] = keyword
        captured["limit"] = limit
        captured["page_token"] = page_token
        captured["settings_obj"] = settings_obj
        captured["subprocess_run"] = subprocess_run
        return AlertFeishuChatSearchResponse(items=[], has_more=False, page_token=None)

    monkeypatch.setattr(alert_service.subprocess, "run", _fake_run)
    monkeypatch.setattr(alert_notification_helpers, "search_lark_chats_for_alert_routes", _fake_search)

    response = alert_service.search_lark_chats_for_alert_routes(keyword="ops", limit=9, page_token="cp")

    assert response.items == []
    assert captured["keyword"] == "ops"
    assert captured["limit"] == 9
    assert captured["page_token"] == "cp"
    assert captured["settings_obj"] is alert_service.settings
    assert captured["subprocess_run"] is _fake_run


def test_run_due_alert_webhook_deliveries_once_facade_uses_alert_service_httpx_client(monkeypatch):
    from app.services import alert_webhook_helpers

    captured: dict[str, object] = {}
    expected_result = ["delivery-retry-1"]

    class SentinelClient:
        pass

    def _fake_run_due(db, *, now, httpx_client_factory):
        captured["db"] = db
        captured["now"] = now
        captured["httpx_client_factory"] = httpx_client_factory
        return expected_result

    sentinel_db = object()
    sentinel_now = datetime.now(timezone.utc)

    monkeypatch.setattr(alert_service.httpx, "Client", SentinelClient)
    monkeypatch.setattr(alert_webhook_helpers, "run_due_alert_webhook_deliveries_once", _fake_run_due)

    result = alert_service.run_due_alert_webhook_deliveries_once(sentinel_db, now=sentinel_now)

    assert result == expected_result
    assert captured["db"] is sentinel_db
    assert captured["now"] is sentinel_now
    assert captured["httpx_client_factory"] is SentinelClient


def test_create_alert_event_facade_fans_out_via_webhook_and_notification_delegates(monkeypatch):
    from app.services import alert_event_queries

    captured: dict[str, object] = {}
    delegate_calls: list[tuple[str, object, object]] = []
    sentinel_db = object()
    sentinel_event = object()

    def _fake_dispatch_webhooks(db, *, event):
        delegate_calls.append(("webhooks", db, event))
        return []

    def _fake_dispatch_notifications(db, *, event):
        delegate_calls.append(("notifications", db, event))
        return []

    def _fake_create_alert_event(db, **kwargs):
        captured["db"] = db
        captured.update(kwargs)
        kwargs["dispatch_webhooks_fn"](db, sentinel_event)
        kwargs["dispatch_notifications_fn"](db, sentinel_event)
        return sentinel_event

    monkeypatch.setattr(alert_service, "dispatch_alert_webhooks", _fake_dispatch_webhooks)
    monkeypatch.setattr(alert_service, "dispatch_alert_notifications", _fake_dispatch_notifications)
    monkeypatch.setattr(alert_event_queries, "create_alert_event", _fake_create_alert_event)

    result = alert_service.create_alert_event(
        sentinel_db,
        camera_id="cam-1",
        strategy_id="strategy-1",
        strategy_name="Strategy 1",
        rule_id="rule-1",
        rule_name="Rule 1",
        event_key="fire",
        confidence=0.98,
        message="fire detected",
        media_id="media-1",
        payload={"k": "v"},
        dispatch_webhooks=True,
    )

    assert result is sentinel_event
    assert captured["db"] is sentinel_db
    assert captured["dispatch_webhooks"] is True
    assert callable(captured["dispatch_webhooks_fn"])
    assert callable(captured["dispatch_notifications_fn"])
    assert delegate_calls == [
        ("webhooks", sentinel_db, sentinel_event),
        ("notifications", sentinel_db, sentinel_event),
    ]
