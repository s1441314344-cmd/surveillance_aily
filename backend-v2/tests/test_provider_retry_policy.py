from datetime import datetime, timezone

import httpx

from app.services.providers.retry_policy import HTTPRetryPolicy, parse_retry_after_seconds


def _build_status_error(status_code: int, headers: dict[str, str] | None = None) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://api.example.com")
    response = httpx.Response(status_code, request=request, headers=headers or {})
    return httpx.HTTPStatusError("request failed", request=request, response=response)


def test_http_retry_policy_retries_retryable_status_before_limit():
    policy = HTTPRetryPolicy(max_attempts=4, retryable_status_codes=frozenset({429, 503}))
    exc = _build_status_error(429)

    assert policy.should_retry(exc, attempt=1) is True
    assert policy.should_retry(exc, attempt=3) is True
    assert policy.should_retry(exc, attempt=4) is False


def test_http_retry_policy_does_not_retry_non_retryable_status():
    policy = HTTPRetryPolicy(max_attempts=4, retryable_status_codes=frozenset({429, 503}))
    exc = _build_status_error(400)

    assert policy.should_retry(exc, attempt=1) is False


def test_http_retry_policy_retries_transport_error_before_limit():
    policy = HTTPRetryPolicy(max_attempts=3, retryable_status_codes=frozenset({429}))
    exc = httpx.ReadTimeout("timeout")

    assert policy.should_retry(exc, attempt=1) is True
    assert policy.should_retry(exc, attempt=2) is True
    assert policy.should_retry(exc, attempt=3) is False


def test_http_retry_policy_prefers_retry_after_header_with_cap():
    policy = HTTPRetryPolicy(
        max_attempts=4,
        retryable_status_codes=frozenset({429}),
        max_backoff_seconds=120.0,
        max_retry_after_seconds=300.0,
    )
    exc = _build_status_error(429, headers={"retry-after": "600"})

    assert policy.delay_seconds(exc, attempt=1) == 300.0


def test_http_retry_policy_uses_exponential_backoff_with_cap():
    policy = HTTPRetryPolicy(
        max_attempts=10,
        retryable_status_codes=frozenset({429}),
        max_backoff_seconds=120.0,
        max_retry_after_seconds=300.0,
    )
    exc = httpx.ConnectError("connect failed")

    assert policy.delay_seconds(exc, attempt=1) == 1.0
    assert policy.delay_seconds(exc, attempt=3) == 4.0
    assert policy.delay_seconds(exc, attempt=8) == 120.0


def test_parse_retry_after_seconds_supports_http_date():
    now = datetime(2030, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    retry_after = "Tue, 01 Jan 2030 00:00:10 GMT"

    assert parse_retry_after_seconds(retry_after, now=now) == 10.0
