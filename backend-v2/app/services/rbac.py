from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.rbac import Role, UserRole

ROLE_SYSTEM_ADMIN = "system_admin"
ROLE_STRATEGY_CONFIGURATOR = "strategy_configurator"
ROLE_TASK_OPERATOR = "task_operator"
ROLE_MANUAL_REVIEWER = "manual_reviewer"
ROLE_ANALYSIS_VIEWER = "analysis_viewer"

DEFAULT_ROLES: list[tuple[str, str]] = [
    (ROLE_SYSTEM_ADMIN, "系统管理员"),
    (ROLE_STRATEGY_CONFIGURATOR, "策略配置员"),
    (ROLE_TASK_OPERATOR, "任务操作员"),
    (ROLE_MANUAL_REVIEWER, "人工复核员"),
    (ROLE_ANALYSIS_VIEWER, "分析查看者"),
]


def get_user_role_codes(db: Session, user_id: str) -> list[str]:
    stmt = (
        select(Role.code)
        .join(UserRole, Role.id == UserRole.role_id)
        .where(UserRole.user_id == user_id)
        .order_by(Role.code)
    )
    return list(db.scalars(stmt))


def get_user_role_map(db: Session, user_ids: list[str]) -> dict[str, list[str]]:
    if not user_ids:
        return {}

    stmt = (
        select(UserRole.user_id, Role.code)
        .join(Role, Role.id == UserRole.role_id)
        .where(UserRole.user_id.in_(user_ids))
        .order_by(UserRole.user_id, Role.code)
    )

    role_map: dict[str, list[str]] = defaultdict(list)
    for user_id, role_code in db.execute(stmt):
        role_map[user_id].append(role_code)
    return dict(role_map)


def get_roles_by_codes(db: Session, role_codes: list[str]) -> list[Role]:
    if not role_codes:
        return []
    stmt = select(Role).where(Role.code.in_(role_codes)).order_by(Role.code)
    return list(db.scalars(stmt))
