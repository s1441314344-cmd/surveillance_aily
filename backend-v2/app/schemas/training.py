from pydantic import BaseModel, ConfigDict


class TrainingOverviewRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    reviewed_samples: int
    candidate_samples: int
    pending_release_requests: int
    last_run_id: str | None = None
    last_run_status: str | None = None
    last_run_at: str | None = None
    last_error: str | None = None


class TrainingDatasetRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    strategy_id: str
    strategy_name: str
    model_provider: str
    model_name: str
    sample_count: int
    incorrect_count: int
    correct_count: int
    positive_ratio: float
    status: str
    dataset_path: str
    created_at: str | None = None
    updated_at: str | None = None


class TrainingRunRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    dataset_id: str
    strategy_id: str
    strategy_name: str
    model_provider: str
    baseline_model_name: str
    route_requested: str
    route_actual: str
    status: str
    candidate_version: str | None = None
    sample_count: int = 0
    evaluation_summary: dict | None = None
    release_status: str | None = None
    error_message: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class TrainingRunDetailRead(TrainingRunRead):
    candidate_snapshot: dict | None = None
    evaluation_report_path: str | None = None
    release_request: dict | None = None


class TrainingPipelineRunRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    strategy_id: str | None = None


class TrainingPipelineRunRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    trigger_source: str
    triggered_by: str
    strategy_id: str | None = None
    dataset_ids: list[str]
    run_ids: list[str]
    skipped: list[dict]


class TrainingRunReviewRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    comment: str | None = None


class TrainingRunReviewRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    run_id: str
    release_request_id: str
    status: str
    reviewed_at: str | None = None
    reviewer: str | None = None
    comment: str | None = None


class TrainingHistoryRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    candidate_id: str
    record_id: str
    strategy_id: str
    strategy_name: str
    judgement: str
    reviewer: str | None = None
    comment: str | None = None
    model_provider: str
    model_name: str
    reflowed_at: str | None = None
    reflow_run_id: str | None = None
    reflow_dataset_id: str | None = None


class TrainingConfigRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    min_samples: int


class TrainingConfigUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    min_samples: int
