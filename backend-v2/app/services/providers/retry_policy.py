from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx


@dataclass(frozen=True)
class HTTPRetryPolicy:
    max_attempts: int
    retryable_status_codes: frozenset[int]
    max_backoff_seconds: float = 120.0
    max_retry_after_seconds: float = 300.0

    def should_retry(self, exc: httpx.HTTPError, *, attempt: int) -> bool:
        if attempt >= self.max_attempts:
            return False
        if isinstance(exc, httpx.HTTPStatusError):
            status_code = exc.response.status_code if exc.response is not None else None
            return status_code in self.retryable_status_codes
        return True

    def delay_seconds(self, exc: httpx.HTTPError, *, attempt: int) -> float:
        if isinstance(exc, httpx.HTTPStatusError):
            retry_after = exc.response.headers.get("retry-after") if exc.response is not None else None
            if retry_after:
                retry_after_seconds = parse_retry_after_seconds(retry_after)
                if retry_after_seconds is not None and retry_after_seconds > 0:
                    return min(retry_after_seconds, self.max_retry_after_seconds)
        return min(2 ** (attempt - 1), self.max_backoff_seconds)


def post_json_with_retry(
    *,
    endpoint: str,
    headers: dict,
    payload: dict,
    timeout_seconds: int,
    retry_policy: HTTPRetryPolicy,
    client_factory: Callable[..., object] = httpx.Client,
    sleep_func: Callable[[float], None] = time.sleep,
) -> dict:
    last_exc: httpx.HTTPError | None = None

    with client_factory(timeout=timeout_seconds) as client:
        for attempt in range(1, retry_policy.max_attempts + 1):
            try:
                response = client.post(endpoint, headers=headers, json=payload)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                if not retry_policy.should_retry(exc, attempt=attempt):
                    raise
                last_exc = exc
                sleep_func(retry_policy.delay_seconds(exc, attempt=attempt))
            except httpx.HTTPError as exc:
                if not retry_policy.should_retry(exc, attempt=attempt):
                    raise
                last_exc = exc
                sleep_func(retry_policy.delay_seconds(exc, attempt=attempt))

    if last_exc is not None:
        raise last_exc
    raise RuntimeError("Provider request failed without an exception")


def parse_retry_after_seconds(retry_after: str, *, now: datetime | None = None) -> float | None:
    try:
        return float(retry_after)
    except ValueError:
        pass

    try:
        retry_after_datetime = parsedate_to_datetime(retry_after)
    except (TypeError, ValueError):
        return None

    if retry_after_datetime is None:
        return None
    if retry_after_datetime.tzinfo is None:
        retry_after_datetime = retry_after_datetime.replace(tzinfo=timezone.utc)

    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    return max((retry_after_datetime - current_time).total_seconds(), 0.0)
