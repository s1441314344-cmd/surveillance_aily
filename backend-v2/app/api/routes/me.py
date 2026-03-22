from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.auth import CurrentUser

router = APIRouter()


@router.get("/me", response_model=CurrentUser)
def read_me(current_user: CurrentUser = Depends(get_current_user)):
    return current_user
