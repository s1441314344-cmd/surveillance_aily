from pydantic import BaseModel, ConfigDict


class CameraBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str
    location: str | None = None
    ip_address: str | None = None
    port: int | None = None
    protocol: str = "rtsp"
    username: str | None = None
    rtsp_url: str | None = None
    frame_frequency_seconds: int = 60
    resolution: str = "1080p"
    jpeg_quality: int = 80
    storage_path: str = "./data/storage/cameras"


class CameraCreate(CameraBase):
    password: str | None = None


class CameraUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str | None = None
    location: str | None = None
    ip_address: str | None = None
    port: int | None = None
    protocol: str | None = None
    username: str | None = None
    password: str | None = None
    rtsp_url: str | None = None
    frame_frequency_seconds: int | None = None
    resolution: str | None = None
    jpeg_quality: int | None = None
    storage_path: str | None = None


class CameraRead(CameraBase):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    has_password: bool = False


class CameraStatusRead(BaseModel):
    camera_id: str
    connection_status: str
    alert_status: str
    last_error: str | None = None
    last_checked_at: str | None = None


class CameraDiagnosticRead(BaseModel):
    camera_id: str
    camera_name: str
    protocol: str
    stream_url_masked: str | None = None
    success: bool
    capture_mode: str
    latency_ms: int
    frame_size_bytes: int | None = None
    mime_type: str | None = None
    width: int | None = None
    height: int | None = None
    snapshot_path: str | None = None
    error_message: str | None = None
    checked_at: str
