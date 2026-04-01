from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.schemas.model_provider import (
    ModelCallLogRead,
    ModelProviderDebugRead,
    ModelProviderDebugRequest,
    ModelProviderRead,
    ModelProviderUpdate,
)
from app.schemas.auth import CurrentUser
from app.services.model_provider_service import debug_model_provider
from app.services.model_provider_service import list_model_providers as list_model_provider_records
from app.services.model_provider_service import upsert_model_provider
from app.services.model_call_log_service import build_model_call_details, create_model_call_log, list_model_call_logs
from app.services.rbac import ROLE_STRATEGY_CONFIGURATOR, ROLE_SYSTEM_ADMIN

router = APIRouter()


@router.get("", response_model=list[ModelProviderRead])
def list_model_providers(
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return list_model_provider_records(db)


@router.get("/call-logs", response_model=list[ModelCallLogRead])
def get_model_call_logs(
    provider: str | None = None,
    trigger_type: str | None = None,
    success: bool | None = None,
    limit: int = 100,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return list_model_call_logs(
        db,
        provider=provider,
        trigger_type=trigger_type,
        success=success,
        limit=limit,
    )


@router.put("/{provider}", response_model=ModelProviderRead)
def update_model_provider(
    provider: str,
    payload: ModelProviderUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return upsert_model_provider(db, provider, payload)


@router.post("/{provider}/debug", response_model=ModelProviderDebugRead)
def debug_provider(
    provider: str,
    payload: ModelProviderDebugRequest,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    result = debug_model_provider(db, provider_name=provider, payload=payload)
    create_model_call_log(
        db,
        provider=result.provider,
        model_name=result.model,
        trigger_type="provider_debug",
        trigger_source="settings",
        response_format=result.response_format,
        success=result.success,
        error_message=result.error_message,
        usage=result.usage,
        input_image_count=int(result.request_payload.get("image_count") or 0),
        details=build_model_call_details(
            prompt=str(payload.prompt or ""),
            response_format=result.response_format,
            input_summary={
                "include_sample_image": result.include_sample_image,
                "request_payload": result.request_payload,
            },
            raw_response=result.raw_response,
            normalized_json=result.normalized_json,
            error_message=result.error_message,
            context={
                "status": result.status,
                "base_url": result.base_url,
            },
        ),
    )
    db.commit()
    return result
