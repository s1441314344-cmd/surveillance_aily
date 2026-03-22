from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.camera import CameraCreate, CameraRead, CameraStatusRead, CameraUpdate
from app.services.camera_service import (
    check_camera_status as check_camera_status_record,
    create_camera as create_camera_record,
    delete_camera as delete_camera_record,
    get_camera_or_404,
    get_camera_status as get_camera_status_record,
    list_cameras as list_camera_records,
    serialize_camera,
    update_camera as update_camera_record,
)
from app.services.rbac import ROLE_SYSTEM_ADMIN

router = APIRouter()


@router.get("", response_model=list[CameraRead])
def list_cameras(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_camera_records(db)


@router.post("", response_model=CameraRead)
def create_camera(
    payload: CameraCreate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return create_camera_record(db, payload)


@router.get("/{camera_id}", response_model=CameraRead)
def get_camera(
    camera_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return serialize_camera(get_camera_or_404(db, camera_id))


@router.patch("/{camera_id}", response_model=CameraRead)
def update_camera(
    camera_id: str,
    payload: CameraUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return update_camera_record(db, camera, payload)


@router.delete("/{camera_id}")
def delete_camera(
    camera_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return delete_camera_record(db, camera)


@router.get("/{camera_id}/status", response_model=CameraStatusRead)
def get_camera_status(
    camera_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return get_camera_status_record(db, camera)


@router.post("/{camera_id}/check", response_model=CameraStatusRead)
def check_camera_status(
    camera_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return check_camera_status_record(db, camera)
