import json
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.core.database import SessionLocal
from app.models.file_asset import FileAsset
from app.models.job import Job
from app.models.task_record import TaskRecord
from app.services.ids import generate_id
from app.services.ocr_service import OcrServiceResult
from app.services.version_recognition_pipeline_service import process_version_recognition_job


def _write_png(path: Path) -> None:
    image = Image.new("RGB", (64, 64), color=(255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    path.write_bytes(buffer.getvalue())


def _seed_version_recognition_job(db, tmp_path: Path) -> Job:
    input_name = "version-upload.png"
    input_path = tmp_path / input_name
    _write_png(input_path)

    asset = FileAsset(
        id=generate_id(),
        purpose="version_recognition_upload",
        original_name=input_name,
        storage_path=str(input_path),
        mime_type="image/png",
    )
    job = Job(
        id=generate_id(),
        job_type="version_recognition_upload",
        trigger_mode="manual",
        strategy_id="strategy-version-recognition",
        strategy_name="版本号识别",
        camera_id=None,
        schedule_id=None,
        model_provider="ocr_service",
        model_name="paddleocr-http-v1",
        status="running",
        total_items=1,
        completed_items=0,
        failed_items=0,
        error_message=None,
        payload={
            "strategy_snapshot": {
                "prompt_template": "请识别版本号",
                "response_schema": {"type": "object"},
                "result_format": "json_schema",
            },
            "input_asset_ids": [asset.id],
            "input_file_names": [input_name],
        },
    )
    db.add(asset)
    db.add(job)
    db.commit()
    return db.get(Job, job.id)


def _success_callbacks():
    finished: list[tuple[str, str | None]] = []

    def finish_job(db, job, *, status: str, error_message: str | None):
        finished.append((status, error_message))
        current = db.get(Job, job.id)
        if current is not None:
            current.status = status
            current.error_message = error_message
            db.commit()

    def create_failed_upload_record(*_args, **_kwargs):
        raise AssertionError("unexpected failed upload record")

    return finished, finish_job, create_failed_upload_record


def _fake_ocr_result(scope: str) -> OcrServiceResult:
    return OcrServiceResult(
        lines=[{"text": scope}],
        image_width=1920,
        image_height=1080,
        raw_payload={"scope": scope},
    )


def test_version_recognition_pipeline_roi_fallback_contract(monkeypatch, tmp_path):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()
        extract_calls: list[dict] = []

        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("center roi unavailable")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.crop_image_by_roi",
            lambda **_kwargs: b"fallback-roi",
        )

        def fake_extract(*, lines, template, roi_applied, context_hint):
            extract_calls.append({"roi_applied": roi_applied, "line_count": len(lines)})
            return {
                "extraction_status": "matched",
                "recognized_version": "BQ-1-2-3",
                "summary": "已识别版本号：BQ-1-2-3",
            }

        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.extract_version_recognition_result",
            fake_extract,
        )

        process_version_recognition_job(
            db,
            job,
            job_cancelled=lambda _db, _job_id: False,
            finish_job=finish_job,
            create_failed_upload_record=create_failed_upload_record,
        )

        record = db.query(TaskRecord).filter(TaskRecord.job_id == job.id).one()
        attempts = json.loads(record.raw_model_response)["attempts"]
        scopes = [item["scope"] for item in attempts]

        assert finished and finished[-1][0] == "completed"
        assert extract_calls and extract_calls[0]["roi_applied"] is True
        assert "full" in scopes
        assert any(scope.startswith("roi_") for scope in scopes)
        assert record.normalized_json["extraction_status"] == "matched"


def test_version_recognition_pipeline_rotation_fallback_contract(monkeypatch, tmp_path):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()
        results = [
            {"extraction_status": "not_found", "recognized_version": None, "summary": "未识别到版本号"},
            {"extraction_status": "matched", "recognized_version": "BQ-9-9-9", "summary": "已识别版本号：BQ-9-9-9"},
        ]

        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip center roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.crop_image_by_roi",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip fallback roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.rotate_image_bytes",
            lambda *, image_bytes, angle: f"rot-{angle}".encode("utf-8"),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.extract_version_recognition_result",
            lambda **_kwargs: results.pop(0),
        )

        process_version_recognition_job(
            db,
            job,
            job_cancelled=lambda _db, _job_id: False,
            finish_job=finish_job,
            create_failed_upload_record=create_failed_upload_record,
        )

        record = db.query(TaskRecord).filter(TaskRecord.job_id == job.id).one()
        attempts = json.loads(record.raw_model_response)["attempts"]
        scopes = [item["scope"] for item in attempts]

        assert finished and finished[-1][0] == "completed"
        assert "full_rotated_90" in scopes
        assert "full_rotated_270" in scopes
        assert "通过旋转回退命中" in str(record.normalized_json.get("summary"))


def test_version_recognition_pipeline_upscale_fallback_contract(monkeypatch, tmp_path):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()
        results = [
            {"extraction_status": "not_found", "recognized_version": None, "summary": "未识别到版本号"},
            {"extraction_status": "not_found", "recognized_version": None, "summary": "未识别到版本号"},
            {"extraction_status": "matched", "recognized_version": "BQ-7-7-7", "summary": "已识别版本号：BQ-7-7-7"},
        ]

        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip center roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.crop_image_by_roi",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip fallback roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.rotate_image_bytes",
            lambda *, image_bytes, angle: f"rot-{angle}".encode("utf-8"),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service._upscale_image_bytes",
            lambda *, image_bytes, scale, max_side: b"upscaled-x2",
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.extract_version_recognition_result",
            lambda **_kwargs: results.pop(0),
        )

        process_version_recognition_job(
            db,
            job,
            job_cancelled=lambda _db, _job_id: False,
            finish_job=finish_job,
            create_failed_upload_record=create_failed_upload_record,
        )

        record = db.query(TaskRecord).filter(TaskRecord.job_id == job.id).one()
        attempts = json.loads(record.raw_model_response)["attempts"]
        scopes = [item["scope"] for item in attempts]

        assert finished and finished[-1][0] == "completed"
        assert "full_upscaled_x2" in scopes
        assert "full_upscaled_x2_rotated_90" in scopes
        assert "full_upscaled_x2_rotated_270" in scopes
        assert "通过放大/旋转回退命中" in str(record.normalized_json.get("summary"))


def test_version_recognition_pipeline_not_found_degradation_contract(monkeypatch, tmp_path):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()
        results = [
            {"extraction_status": "not_found", "recognized_version": None, "summary": "未识别到版本号"},
            {"extraction_status": "not_found", "recognized_version": None, "summary": "未识别到版本号"},
            {"extraction_status": "not_found", "recognized_version": None, "summary": "未识别到版本号"},
        ]

        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip center roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.crop_image_by_roi",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip fallback roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.rotate_image_bytes",
            lambda *, image_bytes, angle: f"rot-{angle}".encode("utf-8"),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service._upscale_image_bytes",
            lambda *, image_bytes, scale, max_side: b"upscaled-x2",
        )
        monkeypatch.setattr(
            "app.services.version_recognition_pipeline_service.extract_version_recognition_result",
            lambda **_kwargs: results.pop(0),
        )

        process_version_recognition_job(
            db,
            job,
            job_cancelled=lambda _db, _job_id: False,
            finish_job=finish_job,
            create_failed_upload_record=create_failed_upload_record,
        )

        record = db.query(TaskRecord).filter(TaskRecord.job_id == job.id).one()
        assert finished and finished[-1][0] == "completed"
        assert record.normalized_json["extraction_status"] == "not_found"
        assert (
            record.normalized_json["summary"]
            == "未识别到版本号（已尝试中心ROI、四角ROI、全图、旋转与放大回退）"
        )
