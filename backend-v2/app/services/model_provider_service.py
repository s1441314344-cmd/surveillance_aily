from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decrypt_secret, encrypt_secret, mask_secret
from app.models.model_provider import ModelProvider
from app.schemas.model_provider import ModelProviderRead, ModelProviderUpdate


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
    provider_name = provider_name.lower()
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
