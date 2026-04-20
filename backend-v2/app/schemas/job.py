from pydantic import BaseModel, ConfigDict


class JobRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    job_type: str
    trigger_mode: str
    strategy_id: str
    strategy_name: str
    camera_id: str | None = None
    schedule_id: str | None = None
    model_provider: str
    model_name: str
    status: str
    total_items: int
    completed_items: int
    failed_items: int
    error_message: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    created_at: str | None = None


class JobUploadCreateResponse(BaseModel):
    job_id: str
    status: str


class JobCameraOnceCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    camera_id: str
    strategy_id: str
    model_provider: str | None = None
    model_name: str | None = None


class JobCameraSnapshotUploadCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    camera_id: str
    strategy_id: str


class JobScheduleCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    camera_id: str
    strategy_id: str
    precheck_strategy_id: str | None = None
    precheck_config: dict | None = None
    schedule_type: str
    schedule_value: str


class JobScheduleUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    camera_id: str | None = None
    strategy_id: str | None = None
    precheck_strategy_id: str | None = None
    precheck_config: dict | None = None
    schedule_type: str | None = None
    schedule_value: str | None = None
    status: str | None = None
    next_run_at: str | None = None


class JobScheduleStatusUpdate(BaseModel):
    status: str


class JobScheduleRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    camera_id: str
    strategy_id: str
    precheck_strategy_id: str | None = None
    precheck_config: dict | None = None
    schedule_type: str
    schedule_value: str
    status: str
    next_run_at: str | None = None
    last_run_at: str | None = None
    last_error: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
