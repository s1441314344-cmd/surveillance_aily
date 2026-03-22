from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, create_refresh_token, decode_token, is_refresh_token, verify_password
from app.models.rbac import User
from app.schemas.auth import CurrentUser, TokenResponse
from app.services.rbac import get_user_role_codes


def build_current_user(db: Session, user: User) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        roles=get_user_role_codes(db, user.id),
    )


def authenticate_user(db: Session, username: str, password: str) -> CurrentUser:
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is disabled")
    return build_current_user(db, user)


def create_token_response(current_user: CurrentUser) -> TokenResponse:
    access_token = create_access_token(current_user.id)
    refresh_token = create_refresh_token(current_user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=current_user)


def refresh_user_session(db: Session, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except Exception as exc:  # pragma: no cover - jose exceptions vary by backend
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if not is_refresh_token(payload):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not available")

    return create_token_response(build_current_user(db, user))
