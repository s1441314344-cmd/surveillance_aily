from copy import deepcopy

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.model_provider import ModelProvider
from app.models.strategy import AnalysisStrategy, StrategyVersion
from app.schemas.strategy import StrategyCreate, StrategyRead, StrategyUpdate
from app.services.ids import generate_id

try:  # pragma: no cover - optional dependency
    from jsonschema import Draft202012Validator, SchemaError
except ImportError:  # pragma: no cover - executed in lightweight local env
    Draft202012Validator = None
    SchemaError = ValueError


def serialize_strategy(strategy: AnalysisStrategy) -> StrategyRead:
    return StrategyRead(
        id=strategy.id,
        name=strategy.name,
        scene_description=strategy.scene_description,
        prompt_template=strategy.prompt_template,
        model_provider=strategy.model_provider,
        model_name=strategy.model_name,
        response_schema=strategy.response_schema,
        status=strategy.status,
        version=strategy.version,
        is_preset=strategy.is_preset,
    )


def build_strategy_snapshot(strategy: AnalysisStrategy) -> dict:
    return {
        "id": strategy.id,
        "name": strategy.name,
        "scene_description": strategy.scene_description,
        "prompt_template": strategy.prompt_template,
        "model_provider": strategy.model_provider,
        "model_name": strategy.model_name,
        "response_schema": deepcopy(strategy.response_schema),
        "status": strategy.status,
        "version": strategy.version,
        "is_preset": strategy.is_preset,
    }


def validate_response_schema(schema: dict) -> list[str]:
    if Draft202012Validator is None:
        return _validate_schema_fallback(schema)

    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        return [exc.message]
    return []


def ensure_provider_exists(db: Session, provider_name: str) -> None:
    provider = db.get(ModelProvider, provider_name)
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model provider '{provider_name}' is not configured",
        )


def record_strategy_version(db: Session, strategy: AnalysisStrategy) -> None:
    db.add(
        StrategyVersion(
            id=generate_id(),
            strategy_id=strategy.id,
            version=strategy.version,
            snapshot=build_strategy_snapshot(strategy),
        )
    )


def list_strategies(
    db: Session,
    status_filter: str | None = None,
    model_provider: str | None = None,
) -> list[StrategyRead]:
    stmt = select(AnalysisStrategy).order_by(AnalysisStrategy.created_at.desc(), AnalysisStrategy.name.asc())
    if status_filter:
        stmt = stmt.where(AnalysisStrategy.status == status_filter)
    if model_provider:
        stmt = stmt.where(AnalysisStrategy.model_provider == model_provider)
    return [serialize_strategy(strategy) for strategy in db.scalars(stmt)]


def create_strategy(db: Session, payload: StrategyCreate, is_preset: bool = False) -> StrategyRead:
    ensure_provider_exists(db, payload.model_provider)

    errors = validate_response_schema(payload.response_schema)
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=errors)

    strategy = AnalysisStrategy(
        id=generate_id(),
        name=payload.name,
        scene_description=payload.scene_description,
        prompt_template=payload.prompt_template,
        model_provider=payload.model_provider,
        model_name=payload.model_name,
        response_schema=payload.response_schema,
        status=payload.status,
        version=1,
        is_preset=is_preset,
    )
    db.add(strategy)
    db.flush()
    record_strategy_version(db, strategy)
    db.commit()
    db.refresh(strategy)
    return serialize_strategy(strategy)


def get_strategy_or_404(db: Session, strategy_id: str) -> AnalysisStrategy:
    strategy = db.get(AnalysisStrategy, strategy_id)
    if strategy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strategy not found")
    return strategy


def update_strategy(db: Session, strategy: AnalysisStrategy, payload: StrategyUpdate) -> StrategyRead:
    updated_fields = payload.model_dump(exclude_unset=True)
    if "model_provider" in updated_fields:
        ensure_provider_exists(db, updated_fields["model_provider"])
    if "response_schema" in updated_fields:
        errors = validate_response_schema(updated_fields["response_schema"])
        if errors:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=errors)

    changed = False
    for field_name, value in updated_fields.items():
        if getattr(strategy, field_name) != value:
            setattr(strategy, field_name, value)
            changed = True

    if changed:
        strategy.version += 1
        record_strategy_version(db, strategy)
        db.commit()
        db.refresh(strategy)

    return serialize_strategy(strategy)


def update_strategy_status(db: Session, strategy: AnalysisStrategy, status_value: str) -> StrategyRead:
    strategy.status = status_value
    db.commit()
    db.refresh(strategy)
    return serialize_strategy(strategy)


def _validate_schema_fallback(schema: dict, path: str = "$") -> list[str]:
    allowed_types = {"object", "array", "string", "number", "integer", "boolean", "null"}

    if not isinstance(schema, dict):
        return [f"{path} must be an object"]

    errors: list[str] = []
    schema_type = schema.get("type")
    if schema_type is not None and schema_type not in allowed_types:
        errors.append(f"{path}.type must be one of {sorted(allowed_types)}")

    properties = schema.get("properties")
    if properties is not None:
        if not isinstance(properties, dict):
            errors.append(f"{path}.properties must be an object")
        else:
            for property_name, property_schema in properties.items():
                errors.extend(_validate_schema_fallback(property_schema, f"{path}.properties.{property_name}"))

    required = schema.get("required")
    if required is not None:
        if not isinstance(required, list) or not all(isinstance(item, str) for item in required):
            errors.append(f"{path}.required must be an array of strings")

    items = schema.get("items")
    if items is not None:
        errors.extend(_validate_schema_fallback(items, f"{path}.items"))

    return errors
