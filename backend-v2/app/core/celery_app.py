from app.core.config import get_settings

settings = get_settings()

try:  # pragma: no cover - import path depends on local environment
    from celery import Celery
except ModuleNotFoundError:  # pragma: no cover - fallback for lightweight local/test envs
    class _FallbackAsyncResult:
        def __init__(self):
            self.id = None

    class _FallbackControl:
        def revoke(self, *_args, **_kwargs):
            return None

    class Celery:  # type: ignore[override]
        def __init__(self, *_args, **_kwargs):
            self.conf = type("Conf", (), {})()
            self.control = _FallbackControl()

        def task(self, **_kwargs):
            def decorator(func):
                def delay(*args, **kwargs):
                    result = _FallbackAsyncResult()
                    if not settings.celery_enabled:
                        return result
                    func(*args, **kwargs)
                    return result

                func.delay = delay
                return func

            return decorator


celery_app = Celery(
    "surveillance_v2",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.task_default_queue = "surveillance-v2"
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
