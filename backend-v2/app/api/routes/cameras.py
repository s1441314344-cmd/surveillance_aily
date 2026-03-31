from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.camera import (
    CameraCreate,
    CameraSignalMonitorConfigRead,
    CameraSignalMonitorConfigUpdate,
    CameraSignalMonitorStartRequest,
    CameraSignalMonitorStatusRead,
    CameraTriggerRuleCreate,
    CameraTriggerRuleDebugRead,
    CameraTriggerRuleDebugLiveRequest,
    CameraTriggerRuleDebugRequest,
    CameraTriggerRuleRead,
    CameraTriggerRuleUpdate,
    CameraMediaRead,
    CameraPhotoCaptureRead,
    CameraPhotoCaptureRequest,
    CameraRecordingStartRequest,
    CameraRecordingStatusRead,
    CameraDiagnosticRead,
    CameraRead,
    CameraStatusLogRead,
    CameraStatusRead,
    CameraStatusSweepRead,
    CameraUpdate,
)
from app.services.camera_signal_monitor_service import (
    get_monitor_config_or_create,
    serialize_monitor_config,
    serialize_monitor_status,
    start_manual_monitor,
    stop_monitor,
    upsert_monitor_config,
)
from app.services.camera_signal_pipeline_service import (
    debug_camera_trigger_rules_live as debug_camera_trigger_rules_live_record,
)
from app.services.camera_service import (
    check_camera_status as check_camera_status_record,
    create_camera as create_camera_record,
    delete_camera as delete_camera_record,
    diagnose_camera as diagnose_camera_record,
    get_camera_or_404,
    get_camera_status as get_camera_status_record,
    list_cameras as list_camera_records,
    list_camera_status_logs as list_camera_status_log_records,
    list_camera_statuses as list_camera_status_records,
    serialize_camera,
    update_camera as update_camera_record,
)
from app.services.camera_media_service import (
    capture_photo as capture_camera_photo_record,
    delete_camera_media as delete_camera_media_record,
    get_camera_media_file_path_or_404,
    get_camera_media_or_404,
    list_camera_media as list_camera_media_records,
    serialize_camera_media,
    start_video_recording as start_video_recording_record,
    stop_video_recording as stop_video_recording_record,
)
from app.services.camera_trigger_rule_service import (
    create_camera_trigger_rule as create_camera_trigger_rule_record,
    debug_camera_trigger_rules as debug_camera_trigger_rules_record,
    delete_camera_trigger_rule as delete_camera_trigger_rule_record,
    get_camera_trigger_rule_or_404,
    list_camera_trigger_rules as list_camera_trigger_rule_records,
    update_camera_trigger_rule as update_camera_trigger_rule_record,
)
from app.services.rbac import ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR
from app.services.scheduler_service import run_camera_status_sweep_once_with_db

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


@router.get("/statuses", response_model=list[CameraStatusRead])
def list_camera_statuses(
    camera_ids: str | None = None,
    alert_only: bool = False,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    parsed_camera_ids = [item.strip() for item in (camera_ids or "").split(",") if item.strip()]
    return list_camera_status_records(
        db,
        camera_ids=parsed_camera_ids or None,
        alert_only=alert_only,
    )


@router.get("/{camera_id}", response_model=CameraRead)
def get_camera(
    camera_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return serialize_camera(get_camera_or_404(db, camera_id))


@router.get("/{camera_id}/media", response_model=list[CameraMediaRead])
def list_camera_media(
    camera_id: str,
    media_type: str | None = None,
    limit: int = 50,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return list_camera_media_records(db, camera_id=camera.id, media_type=media_type, limit=limit)


@router.get("/{camera_id}/trigger-rules", response_model=list[CameraTriggerRuleRead])
def list_camera_trigger_rules(
    camera_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return list_camera_trigger_rule_records(db, camera_id=camera.id)


@router.post("/{camera_id}/trigger-rules", response_model=CameraTriggerRuleRead)
def create_camera_trigger_rule(
    camera_id: str,
    payload: CameraTriggerRuleCreate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return create_camera_trigger_rule_record(db, camera=camera, payload=payload)


@router.patch("/{camera_id}/trigger-rules/{rule_id}", response_model=CameraTriggerRuleRead)
def update_camera_trigger_rule(
    camera_id: str,
    rule_id: str,
    payload: CameraTriggerRuleUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    rule = get_camera_trigger_rule_or_404(db, camera_id=camera.id, rule_id=rule_id)
    return update_camera_trigger_rule_record(db, rule=rule, payload=payload)


@router.delete("/{camera_id}/trigger-rules/{rule_id}")
def delete_camera_trigger_rule(
    camera_id: str,
    rule_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    rule = get_camera_trigger_rule_or_404(db, camera_id=camera.id, rule_id=rule_id)
    return delete_camera_trigger_rule_record(db, rule=rule)


@router.post("/{camera_id}/trigger-rules/debug", response_model=CameraTriggerRuleDebugRead)
def debug_camera_trigger_rules(
    camera_id: str,
    payload: CameraTriggerRuleDebugRequest,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return debug_camera_trigger_rules_record(db, camera=camera, payload=payload)


@router.post("/{camera_id}/trigger-rules/debug-live", response_model=CameraTriggerRuleDebugRead)
def debug_camera_trigger_rules_live(
    camera_id: str,
    payload: CameraTriggerRuleDebugLiveRequest,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return debug_camera_trigger_rules_live_record(db, camera=camera, payload=payload)


@router.post("/{camera_id}/debug-live", response_model=CameraTriggerRuleDebugRead)
def debug_camera_trigger_rules_live_alias(
    camera_id: str,
    payload: CameraTriggerRuleDebugLiveRequest,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return debug_camera_trigger_rules_live_record(db, camera=camera, payload=payload)


@router.get("/{camera_id}/signal-monitor-config", response_model=CameraSignalMonitorConfigRead)
def get_signal_monitor_config(
    camera_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    config = get_monitor_config_or_create(db, camera=camera)
    return serialize_monitor_config(config)


@router.put("/{camera_id}/signal-monitor-config", response_model=CameraSignalMonitorConfigRead)
def put_signal_monitor_config(
    camera_id: str,
    payload: CameraSignalMonitorConfigUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return upsert_monitor_config(db, camera=camera, payload=payload)


@router.patch("/{camera_id}/signal-monitor-config", response_model=CameraSignalMonitorConfigRead)
def patch_signal_monitor_config(
    camera_id: str,
    payload: CameraSignalMonitorConfigUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return upsert_monitor_config(db, camera=camera, payload=payload)


@router.post("/{camera_id}/signal-monitor/start", response_model=CameraSignalMonitorStatusRead)
def start_signal_monitor(
    camera_id: str,
    payload: CameraSignalMonitorStartRequest | None = None,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    duration_seconds = payload.duration_seconds if payload is not None else 600
    return start_manual_monitor(db, camera=camera, duration_seconds=duration_seconds)


@router.post("/{camera_id}/signal-monitor/stop", response_model=CameraSignalMonitorStatusRead)
def stop_signal_monitor(
    camera_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return stop_monitor(db, camera=camera)


@router.get("/{camera_id}/signal-monitor/status", response_model=CameraSignalMonitorStatusRead)
def get_signal_monitor_status(
    camera_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    config = get_monitor_config_or_create(db, camera=camera)
    return serialize_monitor_status(config)


@router.get("/{camera_id}/media/{media_id}", response_model=CameraMediaRead)
def get_camera_media(
    camera_id: str,
    media_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    media = get_camera_media_or_404(db, camera_id=camera.id, media_id=media_id)
    return serialize_camera_media(media)


@router.get("/{camera_id}/media/{media_id}/file")
def get_camera_media_file(
    camera_id: str,
    media_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    media = get_camera_media_or_404(db, camera_id=camera.id, media_id=media_id)
    file_path = get_camera_media_file_path_or_404(media)
    return FileResponse(file_path, filename=media.original_name, media_type=media.mime_type)


@router.delete("/{camera_id}/media/{media_id}")
def delete_camera_media(
    camera_id: str,
    media_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    media = get_camera_media_or_404(db, camera_id=camera.id, media_id=media_id)
    return delete_camera_media_record(db, media=media)


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


@router.post("/{camera_id}/capture-photo", response_model=CameraPhotoCaptureRead)
def capture_camera_photo(
    camera_id: str,
    payload: CameraPhotoCaptureRequest | None = None,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    source_kind = payload.source_kind if payload is not None else "manual"
    return capture_camera_photo_record(db, camera=camera, source_kind=source_kind)


@router.post("/{camera_id}/recordings/start", response_model=CameraRecordingStatusRead)
def start_video_recording(
    camera_id: str,
    payload: CameraRecordingStartRequest,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return start_video_recording_record(
        db,
        camera=camera,
        duration_seconds=payload.duration_seconds,
        source_kind=payload.source_kind,
    )


@router.post("/{camera_id}/recordings/{media_id}/stop", response_model=CameraRecordingStatusRead)
def stop_video_recording(
    camera_id: str,
    media_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    media = get_camera_media_or_404(db, camera_id=camera.id, media_id=media_id)
    return stop_video_recording_record(db, media=media)


@router.get("/{camera_id}/status", response_model=CameraStatusRead)
def get_camera_status(
    camera_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return get_camera_status_record(db, camera)


@router.get("/{camera_id}/status-logs", response_model=list[CameraStatusLogRead])
def list_camera_status_logs(
    camera_id: str,
    limit: int = 20,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return list_camera_status_log_records(
        db,
        camera_id=camera.id,
        limit=limit,
    )


@router.post("/{camera_id}/check", response_model=CameraStatusRead)
def check_camera_status(
    camera_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return check_camera_status_record(db, camera)


@router.post("/check-all", response_model=CameraStatusSweepRead)
def check_all_cameras_status(
    camera_ids: str | None = None,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    parsed_camera_ids = [item.strip() for item in (camera_ids or "").split(",") if item.strip()]
    return run_camera_status_sweep_once_with_db(db, camera_ids=parsed_camera_ids or None)


@router.post("/{camera_id}/diagnose", response_model=CameraDiagnosticRead)
def diagnose_camera(
    camera_id: str,
    save_snapshot: bool = True,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    camera = get_camera_or_404(db, camera_id)
    return diagnose_camera_record(db, camera, save_snapshot=save_snapshot)
