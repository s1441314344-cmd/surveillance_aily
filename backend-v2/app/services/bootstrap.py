from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models.model_provider import ModelProvider
from app.models.rbac import Role, User, UserRole
from app.models.strategy import AnalysisStrategy, StrategyVersion
from app.services.rbac import DEFAULT_ROLES, ROLE_SYSTEM_ADMIN
from app.services.strategy_service import record_strategy_version

settings = get_settings()

DEFAULT_PROVIDERS = [
    {
        "provider": "zhipu",
        "display_name": "智谱",
        "base_url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        "default_model": "glm-4v-plus",
        "timeout_seconds": 120,
        "status": "active",
    },
    {
        "provider": "openai",
        "display_name": "OpenAI",
        "base_url": "https://api.openai.com/v1/responses",
        "default_model": "gpt-5-mini",
        "timeout_seconds": 120,
        "status": "inactive",
    },
]

PRESET_STRATEGIES = [
    {
        "id": "preset-helmet",
        "name": "安全帽识别",
        "scene_description": "识别作业现场人员是否正确佩戴安全帽，并输出异常人员信息。",
        "prompt_template": "请识别图片中的人员安全帽佩戴情况，并严格按照 JSON Schema 返回结果。",
        "model_provider": "zhipu",
        "model_name": "glm-4v-plus",
        "response_schema": {
            "type": "object",
            "properties": {
                "has_violation": {"type": "boolean"},
                "summary": {"type": "string"},
                "violations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "target": {"type": "string"},
                            "wearing_helmet": {"type": "boolean"},
                        },
                        "required": ["target", "wearing_helmet"],
                    },
                },
            },
            "required": ["has_violation", "summary", "violations"],
        },
    },
    {
        "id": "preset-fire",
        "name": "火情识别",
        "scene_description": "识别图片中是否存在明火、烟雾或火情疑似场景。",
        "prompt_template": "请判断图片中是否存在火情，并以 JSON 返回风险等级与原因。",
        "model_provider": "zhipu",
        "model_name": "glm-4v-plus",
        "response_schema": {
            "type": "object",
            "properties": {
                "has_fire": {"type": "boolean"},
                "risk_level": {"type": "string"},
                "summary": {"type": "string"},
            },
            "required": ["has_fire", "risk_level", "summary"],
        },
    },
    {
        "id": "preset-bottle-date",
        "name": "瓶盖日期识别",
        "scene_description": "识别瓶盖或包装区域的生产日期、批次号等字符信息。",
        "prompt_template": "请识别瓶盖日期信息，并以 JSON 返回日期文本、置信说明与异常判断。",
        "model_provider": "zhipu",
        "model_name": "glm-4v-plus",
        "response_schema": {
            "type": "object",
            "properties": {
                "recognized_text": {"type": "string"},
                "is_valid": {"type": "boolean"},
                "summary": {"type": "string"},
            },
            "required": ["recognized_text", "is_valid", "summary"],
        },
    },
]


def seed_defaults(db: Session) -> None:
    _seed_roles(db)
    _seed_admin_user(db)
    _seed_model_providers(db)
    _seed_preset_strategies(db)
    db.commit()


def _seed_roles(db: Session) -> None:
    existing_codes = set(db.scalars(select(Role.code)))
    for code, name in DEFAULT_ROLES:
        if code in existing_codes:
            continue
        db.add(Role(id=code, code=code, name=name))


def _seed_admin_user(db: Session) -> None:
    admin_user = db.scalar(select(User).where(User.username == settings.bootstrap_admin_username))
    if admin_user is None:
        admin_user = User(
            id="bootstrap-admin",
            username=settings.bootstrap_admin_username,
            password_hash=get_password_hash(settings.bootstrap_admin_password),
            display_name=settings.bootstrap_admin_display_name,
            is_active=True,
        )
        db.add(admin_user)
        db.flush()

    admin_role_assignment = db.scalar(
        select(UserRole).where(
            UserRole.user_id == admin_user.id,
            UserRole.role_id == ROLE_SYSTEM_ADMIN,
        )
    )
    if admin_role_assignment is None:
        db.add(UserRole(user_id=admin_user.id, role_id=ROLE_SYSTEM_ADMIN))


def _seed_model_providers(db: Session) -> None:
    existing = {provider.provider for provider in db.scalars(select(ModelProvider))}
    for provider_data in DEFAULT_PROVIDERS:
        if provider_data["provider"] in existing:
            continue
        db.add(ModelProvider(api_key_encrypted=None, **provider_data))


def _seed_preset_strategies(db: Session) -> None:
    existing_ids = {strategy.id for strategy in db.scalars(select(AnalysisStrategy))}
    existing_versions = {
        strategy_id for strategy_id in db.scalars(select(StrategyVersion.strategy_id).distinct())
    }

    for preset in PRESET_STRATEGIES:
        if preset["id"] not in existing_ids:
            strategy = AnalysisStrategy(
                id=preset["id"],
                name=preset["name"],
                scene_description=preset["scene_description"],
                prompt_template=preset["prompt_template"],
                model_provider=preset["model_provider"],
                model_name=preset["model_name"],
                response_schema=preset["response_schema"],
                status="active",
                version=1,
                is_preset=True,
            )
            db.add(strategy)
            db.flush()
            record_strategy_version(db, strategy)
            continue

        if preset["id"] not in existing_versions:
            strategy = db.get(AnalysisStrategy, preset["id"])
            if strategy is not None:
                record_strategy_version(db, strategy)
