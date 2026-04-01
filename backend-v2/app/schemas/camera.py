from pydantic import BaseModel, ConfigDict, Field


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


class CameraStatusLogRead(BaseModel):
    id: str
    camera_id: str
    connection_status: str
    alert_status: str
    last_error: str | None = None
    created_at: str


class CameraStatusSweepRead(BaseModel):
    checked_count: int
    failed_count: int
    total_count: int


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


class CameraPhotoCaptureRequest(BaseModel):
    source_kind: str = "manual"


class CameraRecordingStartRequest(BaseModel):
    duration_seconds: int = 30
    source_kind: str = "manual"


class CameraMediaRead(BaseModel):
    id: str
    camera_id: str
    related_job_id: str | None = None
    file_asset_id: str | None = None
    media_type: str
    source_kind: str
    status: str
    original_name: str
    storage_path: str
    mime_type: str
    duration_seconds: int | None = None
    stop_requested: bool = False
    started_at: str | None = None
    finished_at: str | None = None
    error_message: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class CameraPhotoCaptureRead(BaseModel):
    camera_id: str
    success: bool
    media: CameraMediaRead | None = None
    error_message: str | None = None


class CameraRecordingStatusRead(BaseModel):
    camera_id: str
    success: bool
    media: CameraMediaRead
    message: str | None = None


class CameraTriggerRuleBase(BaseModel):
    name: str
    event_type: str
    event_key: str | None = None
    match_mode: str = "simple"
    expression_json: dict | None = None
    priority: int = 100
    action_policy_json: dict | None = None
    enabled: bool = True
    min_confidence: float = Field(default=0.6, ge=0, le=1)
    min_consecutive_frames: int = Field(default=1, ge=1, le=300)
    cooldown_seconds: int = Field(default=30, ge=0, le=86400)
    description: str | None = None


class CameraTriggerRuleCreate(CameraTriggerRuleBase):
    pass


class CameraTriggerRuleUpdate(BaseModel):
    name: str | None = None
    event_type: str | None = None
    event_key: str | None = None
    match_mode: str | None = None
    expression_json: dict | None = None
    priority: int | None = None
    action_policy_json: dict | None = None
    enabled: bool | None = None
    min_confidence: float | None = Field(default=None, ge=0, le=1)
    min_consecutive_frames: int | None = Field(default=None, ge=1, le=300)
    cooldown_seconds: int | None = Field(default=None, ge=0, le=86400)
    description: str | None = None


class CameraTriggerRuleRead(CameraTriggerRuleBase):
    id: str
    camera_id: str
    last_triggered_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class CameraTriggerRuleDebugRequest(BaseModel):
    signals: dict[str, float] = Field(default_factory=dict)
    consecutive_hits: dict[str, int] = Field(default_factory=dict)
    dry_run: bool = True
    capture_on_match: bool = False
    source_kind: str = "trigger_rule"
    rule_ids: list[str] | None = None


class CameraTriggerRuleDebugLiveRequest(BaseModel):
    strategy_id: str | None = None
    model_provider: str | None = None
    model_name: str | None = None
    dry_run: bool = True
    capture_on_match: bool = False
    source_kind: str = "trigger_rule_auto"
    rule_ids: list[str] | None = None


class CameraTriggerRuleDebugResult(BaseModel):
    rule_id: str
    rule_name: str
    event_type: str
    event_key: str
    match_mode: str = "simple"
    enabled: bool
    matched: bool
    confidence: float
    threshold: float
    consecutive_hits: int
    required_consecutive_hits: int
    cooldown_ok: bool
    cooldown_remaining_seconds: int
    reason: str
    expression_result: dict | None = None
    media: CameraMediaRead | None = None
    error_message: str | None = None


class CameraTriggerRuleDebugRead(BaseModel):
    camera_id: str
    dry_run: bool
    capture_on_match: bool
    matched_count: int
    evaluated_at: str
    detected_signals: dict[str, float] | None = None
    consecutive_hits: dict[str, int] | None = None
    normalized_json: dict | None = None
    results: list[CameraTriggerRuleDebugResult]


class CameraSignalMonitorConfigBase(BaseModel):
    enabled: bool = False
    runtime_mode: str = "daemon"
    signal_strategy_id: str | None = None
    strict_local_gate: bool = True
    monitor_interval_seconds: int = Field(default=30, ge=1, le=3600)
    schedule_type: str | None = None
    schedule_value: str | None = None
    manual_until: str | None = None
    roi_enabled: bool = False
    roi_x: float | None = Field(default=None, ge=0, le=1)
    roi_y: float | None = Field(default=None, ge=0, le=1)
    roi_width: float | None = Field(default=None, gt=0, le=1)
    roi_height: float | None = Field(default=None, gt=0, le=1)
    roi_shape: str = "rect"
    roi_points: list[dict[str, float]] | None = None


class CameraSignalMonitorConfigUpdate(CameraSignalMonitorConfigBase):
    pass


class CameraSignalMonitorConfigRead(CameraSignalMonitorConfigBase):
    id: str
    camera_id: str
    next_run_at: str | None = None
    last_run_at: str | None = None
    last_error: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class CameraSignalMonitorStartRequest(BaseModel):
    duration_seconds: int = Field(default=600, ge=30, le=86400)


class CameraSignalMonitorStatusRead(BaseModel):
    camera_id: str
    enabled: bool
    runtime_mode: str
    signal_strategy_id: str | None = None
    next_run_at: str | None = None
    last_run_at: str | None = None
    last_error: str | None = None
