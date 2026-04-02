from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.schemas.alert import (
    AlertFeishuChatSearchResponse,
    AlertFeishuUserSearchResponse,
    AlertNotificationRouteCreate,
    AlertNotificationRouteRead,
    AlertNotificationRouteUpdate,
)
from app.schemas.auth import CurrentUser
from app.services.alert_service import (
    create_alert_notification_route,
    get_alert_notification_route_or_404,
    list_alert_notification_routes,
    search_lark_chats_for_alert_routes,
    search_lark_users_for_alert_routes,
    update_alert_notification_route,
)
from app.services.rbac import ROLE_SYSTEM_ADMIN

router = APIRouter()


@router.get("", response_model=list[AlertNotificationRouteRead])
def get_alert_notification_routes(
    strategy_id: str | None = None,
    enabled: bool | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_alert_notification_routes(
        db,
        strategy_id=strategy_id,
        enabled=enabled,
    )


@router.post("", response_model=AlertNotificationRouteRead)
def post_alert_notification_route(
    payload: AlertNotificationRouteCreate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return create_alert_notification_route(db, payload=payload)


@router.patch("/{route_id}", response_model=AlertNotificationRouteRead)
def patch_alert_notification_route(
    route_id: str,
    payload: AlertNotificationRouteUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    route = get_alert_notification_route_or_404(db, route_id)
    return update_alert_notification_route(db, route=route, payload=payload)


@router.get(
    "/recipients/users/search",
    response_model=AlertFeishuUserSearchResponse,
)
def get_alert_notification_route_recipient_users(
    keyword: str = Query(default="", max_length=128),
    limit: int = Query(default=20, ge=1, le=100),
    page_token: str | None = Query(default=None, max_length=200),
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
):
    return search_lark_users_for_alert_routes(
        keyword=keyword,
        limit=limit,
        page_token=page_token,
    )


@router.get(
    "/recipients/chats/search",
    response_model=AlertFeishuChatSearchResponse,
)
def get_alert_notification_route_recipient_chats(
    keyword: str | None = Query(default=None, max_length=128),
    limit: int = Query(default=20, ge=1, le=100),
    page_token: str | None = Query(default=None, max_length=200),
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
):
    return search_lark_chats_for_alert_routes(
        keyword=keyword,
        limit=limit,
        page_token=page_token,
    )
