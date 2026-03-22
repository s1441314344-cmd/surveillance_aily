from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.rbac import User, UserRole
from app.schemas.user import UserCreate, UserRead
from app.services.ids import generate_id
from app.services.rbac import get_roles_by_codes, get_user_role_codes, get_user_role_map


def serialize_user(user: User, roles: list[str]) -> UserRead:
    return UserRead(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        is_active=user.is_active,
        roles=roles,
    )


def list_users(db: Session) -> list[UserRead]:
    users = list(db.scalars(select(User).order_by(User.created_at.desc(), User.username.asc())))
    role_map = get_user_role_map(db, [user.id for user in users])
    return [serialize_user(user, role_map.get(user.id, [])) for user in users]


def create_user(db: Session, payload: UserCreate) -> UserRead:
    existing_user = db.scalar(select(User).where(User.username == payload.username))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    roles = get_roles_by_codes(db, sorted(set(payload.roles)))
    found_role_codes = {role.code for role in roles}
    missing_roles = sorted(set(payload.roles) - found_role_codes)
    if missing_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown role codes: {', '.join(missing_roles)}",
        )

    user = User(
        id=generate_id(),
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        display_name=payload.display_name,
        is_active=True,
    )
    db.add(user)
    db.flush()

    for role in roles:
        db.add(UserRole(user_id=user.id, role_id=role.id))

    db.commit()
    db.refresh(user)
    return serialize_user(user, [role.code for role in roles])


def update_user_status(db: Session, user_id: str, is_active: bool) -> UserRead:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return serialize_user(user, get_user_role_codes(db, user.id))
