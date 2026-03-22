from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.schemas.auth import CurrentUser, LoginRequest, RefreshTokenRequest, TokenResponse
from app.services.auth import authenticate_user, create_token_response, refresh_user_session

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    current_user = authenticate_user(db, payload.username, payload.password)
    return create_token_response(current_user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    return refresh_user_session(db, payload.refresh_token)


@router.get("/me", response_model=CurrentUser)
def me(current_user: CurrentUser = Depends(get_current_user)):
    return current_user
