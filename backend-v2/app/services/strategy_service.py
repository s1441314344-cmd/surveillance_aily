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

RESULT_FORMAT_JSON_SCHEMA = "json_schema"
RESULT_FORMAT_JSON_OBJECT = "json_object"
RESULT_FORMAT_AUTO = "auto"
RESULT_FORMAT_TEXT = "text"
ALLOWED_RESULT_FORMATS = {
    RESULT_FORMAT_JSON_SCHEMA,
    RESULT_FORMAT_JSON_OBJECT,
    RESULT_FORMAT_AUTO,
    RESULT_FORMAT_TEXT,
}


def serialize_strategy(strategy: AnalysisStrategy) -> StrategyRead:
    return StrategyRead(
        id=strategy.id,
        name=strategy.name,
        scene_description=strategy.scene_description,
        prompt_template=strategy.prompt_template,
        model_provider=strategy.model_provider,
        model_name=strategy.model_name,
        result_format=strategy.result_format,
        response_schema=strategy.response_schema,
        status=strategy.status,
        version=strategy.version,
        is_preset=strategy.is_preset,
        is_signal_strategy=strategy.is_signal_strategy,
        signal_mapping=deepcopy(strategy.signal_mapping) if strategy.signal_mapping else None,
    )


def build_strategy_snapshot(strategy: AnalysisStrategy) -> dict:
    return {
        "id": strategy.id,
        "name": strategy.name,
        "scene_description": strategy.scene_description,
        "prompt_template": strategy.prompt_template,
        "model_provider": strategy.model_provider,
        "model_name": strategy.model_name,
        "result_format": strategy.result_format,
        "response_schema": deepcopy(strategy.response_schema),
        "status": strategy.status,
        "version": strategy.version,
        "is_preset": strategy.is_preset,
        "is_signal_strategy": strategy.is_signal_strategy,
        "signal_mapping": deepcopy(strategy.signal_mapping) if strategy.signal_mapping else None,
    }


def validate_response_schema(schema: dict) -> list[str]:
    guardrail_errors = _validate_schema_guardrails(schema)

    if Draft202012Validator is None:
        return guardrail_errors + _validate_schema_fallback(schema)

    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        return guardrail_errors + [exc.message]
    return guardrail_errors


def validate_strategy_output_config(result_format: str, response_schema: dict | None) -> list[str]:
    normalized_format = normalize_result_format(result_format)
    schema = response_schema if isinstance(response_schema, dict) else {}

    if normalized_format == RESULT_FORMAT_JSON_SCHEMA:
        return validate_response_schema(schema)

    # 非 schema 模式允许空 schema，但如果用户填写了 schema，仍做基础语法校验。
    if not schema:
        return []
    if Draft202012Validator is None:
        return _validate_schema_fallback(schema)
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        return [exc.message]
    return []


def normalize_result_format(result_format: str | None) -> str:
    normalized = (result_format or RESULT_FORMAT_JSON_SCHEMA).strip().lower()
    if normalized not in ALLOWED_RESULT_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"result_format must be one of {sorted(ALLOWED_RESULT_FORMATS)}",
        )
    return normalized


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
    result_format = normalize_result_format(payload.result_format)

    errors = validate_strategy_output_config(result_format, payload.response_schema)
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=errors)

    strategy = AnalysisStrategy(
        id=generate_id(),
        name=payload.name,
        scene_description=payload.scene_description,
        prompt_template=payload.prompt_template,
        model_provider=payload.model_provider,
        model_name=payload.model_name,
        result_format=result_format,
        response_schema=payload.response_schema,
        status=payload.status,
        version=1,
        is_preset=is_preset,
        is_signal_strategy=payload.is_signal_strategy,
        signal_mapping=payload.signal_mapping,
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
    if "result_format" in updated_fields:
        updated_fields["result_format"] = normalize_result_format(updated_fields["result_format"])

    if "response_schema" in updated_fields or "result_format" in updated_fields:
        target_result_format = str(updated_fields.get("result_format") or strategy.result_format)
        target_response_schema = (
            updated_fields["response_schema"] if "response_schema" in updated_fields else strategy.response_schema
        )
        errors = validate_strategy_output_config(target_result_format, target_response_schema)
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


def _validate_schema_guardrails(schema: dict) -> list[str]:
    # Business guardrails: empty schema leads to "{}" mock outputs and unusable results.
    if not isinstance(schema, dict):
        return ["Response schema must be a JSON object"]
    if not schema:
        return ["Response schema cannot be empty"]

    errors: list[str] = []
    if schema.get("type") != "object":
        errors.append("Response schema root type must be 'object'")

    properties = schema.get("properties")
    if not isinstance(properties, dict) or not properties:
        errors.append("Response schema must define at least one field in properties")

    return errors
