from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decrypt_secret, encrypt_secret, mask_secret
from app.core.database import SessionLocal
from app.models.model_provider import ModelProvider
from app.schemas.model_provider import (
    ModelProviderDebugLog,
    ModelProviderDebugRead,
    ModelProviderDebugRequest,
    ModelProviderRead,
    ModelProviderUpdate,
)
from app.services.providers.base import ProviderRequest

PROVIDER_NAME_ALIASES = {
    "doubao": "ark",
    "volcengine": "ark",
    "huoshan": "ark",
}


@dataclass
class ModelProviderRuntimeConfig:
    provider: str
    display_name: str
    base_url: str
    api_key: str | None
    default_model: str
    timeout_seconds: int
    status: str


def serialize_model_provider(provider: ModelProvider) -> ModelProviderRead:
    api_key = decrypt_secret(provider.api_key_encrypted)
    return ModelProviderRead(
        provider=provider.provider,
        display_name=provider.display_name,
        base_url=provider.base_url,
        api_key_masked=mask_secret(api_key),
        has_api_key=bool(api_key),
        default_model=provider.default_model,
        timeout_seconds=provider.timeout_seconds,
        status=provider.status,
    )


def list_model_providers(db: Session) -> list[ModelProviderRead]:
    providers = list(db.scalars(select(ModelProvider).order_by(ModelProvider.provider.asc())))
    return [serialize_model_provider(provider) for provider in providers]


def upsert_model_provider(db: Session, provider_name: str, payload: ModelProviderUpdate) -> ModelProviderRead:
    provider_name = _normalize_provider_name(provider_name)
    provider = db.get(ModelProvider, provider_name)
    if provider is None:
        provider = ModelProvider(
            provider=provider_name,
            display_name=payload.display_name or provider_name,
            base_url=payload.base_url,
            api_key_encrypted=encrypt_secret(payload.api_key),
            default_model=payload.default_model,
            timeout_seconds=payload.timeout_seconds,
            status=payload.status,
        )
        db.add(provider)
    else:
        provider.display_name = payload.display_name or provider.display_name
        provider.base_url = payload.base_url
        provider.default_model = payload.default_model
        provider.timeout_seconds = payload.timeout_seconds
        provider.status = payload.status
        if payload.api_key is not None:
            provider.api_key_encrypted = encrypt_secret(payload.api_key)

    db.commit()
    db.refresh(provider)
    return serialize_model_provider(provider)


def build_model_provider_runtime(provider: ModelProvider) -> ModelProviderRuntimeConfig:
    return ModelProviderRuntimeConfig(
        provider=provider.provider,
        display_name=provider.display_name,
        base_url=provider.base_url,
        api_key=decrypt_secret(provider.api_key_encrypted),
        default_model=provider.default_model,
        timeout_seconds=provider.timeout_seconds,
        status=provider.status,
    )


def get_model_provider_runtime(db: Session, provider_name: str) -> ModelProviderRuntimeConfig | None:
    provider = db.get(ModelProvider, _normalize_provider_name(provider_name))
    if provider is None:
        return None
    return build_model_provider_runtime(provider)


def load_model_provider_runtime(provider_name: str) -> ModelProviderRuntimeConfig | None:
    with SessionLocal() as db:
        return get_model_provider_runtime(db, provider_name)


def get_provider_adapter(provider_name: str):
    from app.services.providers.factory import get_provider_adapter as resolve_provider_adapter

    return resolve_provider_adapter(_normalize_provider_name(provider_name))


def debug_model_provider(
    db: Session,
    *,
    provider_name: str,
    payload: ModelProviderDebugRequest,
) -> ModelProviderDebugRead:
    runtime = get_model_provider_runtime(db, provider_name)
    if runtime is None:
        return _build_debug_read(
            provider=provider_name.lower(),
            display_name=provider_name,
            base_url="",
            model=payload.model or "",
            response_format=payload.response_format,
            include_sample_image=payload.include_sample_image,
            success=False,
            has_api_key=False,
            status="missing",
            timeout_seconds=0,
            request_payload={},
            logs=[ModelProviderDebugLog(level="error", message="模型提供方不存在，请先保存配置。")],
            raw_response="",
            normalized_json=None,
            error_message="Model provider does not exist",
            usage=None,
        )

    model_name = payload.model or runtime.default_model
    request_payload = {
        "provider": runtime.provider,
        "display_name": runtime.display_name,
        "base_url": runtime.base_url,
        "model": model_name,
        "response_format": payload.response_format,
        "prompt": payload.prompt,
        "response_schema": payload.response_schema,
        "include_sample_image": payload.include_sample_image,
    }
    logs: list[ModelProviderDebugLog] = [
        ModelProviderDebugLog(level="info", message=f"已加载提供方 {runtime.display_name}({runtime.provider})"),
        ModelProviderDebugLog(level="info", message=f"目标模型：{model_name}"),
    ]

    if runtime.status != "active":
        logs.append(ModelProviderDebugLog(level="error", message="提供方当前为未启用状态，请先启用后再调试。"))
        return _build_debug_read(
            provider=runtime.provider,
            display_name=runtime.display_name,
            base_url=runtime.base_url,
            model=model_name,
            response_format=payload.response_format,
            include_sample_image=payload.include_sample_image,
            success=False,
            has_api_key=bool(runtime.api_key),
            status=runtime.status,
            timeout_seconds=runtime.timeout_seconds,
            request_payload=request_payload,
            logs=logs,
            raw_response="",
            normalized_json=None,
            error_message="Model provider is inactive",
            usage=None,
        )

    if not runtime.api_key:
        logs.append(ModelProviderDebugLog(level="error", message="未配置 API Key，调试已中止。"))
        return _build_debug_read(
            provider=runtime.provider,
            display_name=runtime.display_name,
            base_url=runtime.base_url,
            model=model_name,
            response_format=payload.response_format,
            include_sample_image=payload.include_sample_image,
            success=False,
            has_api_key=False,
            status=runtime.status,
            timeout_seconds=runtime.timeout_seconds,
            request_payload=request_payload,
            logs=logs,
            raw_response="",
            normalized_json=None,
            error_message="Model provider API key is missing",
            usage=None,
        )

    adapter = get_provider_adapter(runtime.provider)
    logs.append(ModelProviderDebugLog(level="info", message=f"已选择适配器：{adapter.__class__.__name__}"))

    try:
        with TemporaryDirectory(prefix="provider-debug-") as temp_dir:
            image_paths = _build_debug_image_paths(temp_dir, include_sample_image=payload.include_sample_image)
            request_payload["image_count"] = len(image_paths)
            provider_response = adapter.analyze(
                ProviderRequest(
                    model=model_name,
                    prompt=payload.prompt,
                    image_paths=image_paths,
                    response_format=payload.response_format,
                    response_schema=payload.response_schema,
                )
            )
    except Exception as exc:
        logs.append(ModelProviderDebugLog(level="error", message=f"适配器调试异常：{exc}"))
        return _build_debug_read(
            provider=runtime.provider,
            display_name=runtime.display_name,
            base_url=runtime.base_url,
            model=model_name,
            response_format=payload.response_format,
            include_sample_image=payload.include_sample_image,
            success=False,
            has_api_key=True,
            status=runtime.status,
            timeout_seconds=runtime.timeout_seconds,
            request_payload=request_payload,
            logs=logs,
            raw_response="",
            normalized_json=None,
            error_message=str(exc),
            usage=None,
        )

    logs.append(
        ModelProviderDebugLog(
            level="info" if provider_response.success else "error",
            message="模型请求完成" if provider_response.success else f"模型请求失败：{provider_response.error_message}",
        )
    )
    if provider_response.usage:
        logs.append(ModelProviderDebugLog(level="info", message=f"Token usage: {provider_response.usage}"))

    return _build_debug_read(
        provider=runtime.provider,
        display_name=runtime.display_name,
        base_url=runtime.base_url,
        model=model_name,
        response_format=payload.response_format,
        include_sample_image=payload.include_sample_image,
        success=provider_response.success,
        has_api_key=True,
        status=runtime.status,
        timeout_seconds=runtime.timeout_seconds,
        request_payload=request_payload,
        logs=logs,
        raw_response=provider_response.raw_response,
        normalized_json=provider_response.normalized_json,
        error_message=provider_response.error_message,
        usage=provider_response.usage,
    )


def _build_debug_image_paths(temp_dir: str, *, include_sample_image: bool) -> list[str]:
    if not include_sample_image:
        return []

    image_path = Path(temp_dir) / "provider-debug-sample.png"
    image_path.write_bytes(_DEBUG_SAMPLE_PNG_BYTES)
    return [str(image_path)]


def _normalize_provider_name(provider_name: str) -> str:
    normalized = (provider_name or "").strip().lower()
    if not normalized:
        return normalized
    return PROVIDER_NAME_ALIASES.get(normalized, normalized)


def _build_debug_read(
    *,
    provider: str,
    display_name: str,
    base_url: str,
    model: str,
    response_format: str,
    include_sample_image: bool,
    success: bool,
    has_api_key: bool,
    status: str,
    timeout_seconds: int,
    request_payload: dict,
    logs: list[ModelProviderDebugLog],
    raw_response: str,
    normalized_json: dict | None,
    error_message: str | None,
    usage: dict | None,
) -> ModelProviderDebugRead:
    return ModelProviderDebugRead(
        provider=provider,
        display_name=display_name,
        base_url=base_url,
        model=model,
        response_format=response_format,
        include_sample_image=include_sample_image,
        success=success,
        has_api_key=has_api_key,
        status=status,
        timeout_seconds=timeout_seconds,
        request_payload=request_payload,
        logs=logs,
        raw_response=raw_response,
        normalized_json=normalized_json,
        error_message=error_message,
        usage=usage,
    )


_DEBUG_SAMPLE_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00 \x00\x00\x00 \x08\x06\x00\x00\x00szz\xf4"
    b"\x00\x00\x00BIDATx\xda\xed\xd3\xa1\x01\x00 \x08EA\xe6tv\x86p\x03\xadjW\x82\x17H?p\xe5Eom"
    b"\xac72\xb7\xbb\xbd\x07@9\xe0\xf5\xc3s\x07\xa8\x07\xa8\x00@\x05\x00*\x00P\x01\x80\n\x00T\xf0=`"
    b"\x02\x02\xcf\xb2\xb5\xbe\xa4}\x1b\x00\x00\x00\x00IEND\xaeB`\x82"
)
