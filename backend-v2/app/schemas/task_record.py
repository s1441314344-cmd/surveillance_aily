from pydantic import BaseModel, ConfigDict


class TaskRecordRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    job_id: str
    strategy_id: str
    strategy_name: str
    strategy_snapshot: dict
    input_file_asset_id: str | None = None
    input_filename: str
    input_image_path: str
    preview_image_path: str | None = None
    source_type: str
    camera_id: str | None = None
    model_provider: str
    model_name: str
    raw_model_response: str
    normalized_json: dict | None = None
    result_status: str
    duration_ms: int
    feedback_status: str
    created_at: str | None = None
