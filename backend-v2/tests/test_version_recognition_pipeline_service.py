import ast
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
            "app.services.version_recognition_attempt_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("center roi unavailable")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_by_roi",
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
            "app.services.version_recognition_attempt_service.extract_version_recognition_result",
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
        assert "full" not in scopes
        assert any(scope.startswith("roi_") for scope in scopes)
        assert record.normalized_json["extraction_status"] == "matched"


def test_version_recognition_pipeline_skips_full_ocr_when_roi_match_is_stable(monkeypatch, tmp_path):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()

        def fake_recognize(*, image_bytes, filename, template):
            if filename == "version-upload.png":
                raise AssertionError("full OCR should be skipped after ROI match")
            return _fake_ocr_result(filename)

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.recognize_with_ocr_service",
            fake_recognize,
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_for_template",
            lambda **_kwargs: b"center-roi",
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_by_roi",
            lambda **_kwargs: b"fallback-roi",
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.extract_version_recognition_result",
            lambda **_kwargs: {
                "extraction_status": "matched",
                "recognized_version": "BQ-ROI-1-0",
                "summary": "已识别版本号：BQ-ROI-1-0",
            },
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
        assert "full" not in scopes
        assert scopes[0] == "roi_center"
        assert record.normalized_json["recognized_version"] == "BQ-ROI-1-0"


def test_version_recognition_pipeline_skips_fallback_rois_when_center_roi_match_is_stable(
    monkeypatch,
    tmp_path,
):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()
        fallback_roi_calls = {"count": 0}

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_for_template",
            lambda **_kwargs: b"center-roi",
        )

        def fake_crop_fallback_roi(**_kwargs):
            fallback_roi_calls["count"] += 1
            return b"fallback-roi"

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_by_roi",
            fake_crop_fallback_roi,
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.extract_version_recognition_result",
            lambda **_kwargs: {
                "extraction_status": "matched",
                "recognized_version": "BQ-ROI-ONLY-1-0",
                "summary": "已识别版本号：BQ-ROI-ONLY-1-0",
            },
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
        assert fallback_roi_calls["count"] == 0
        assert scopes == ["roi_center"]
        assert record.normalized_json["recognized_version"] == "BQ-ROI-ONLY-1-0"


def test_version_recognition_pipeline_stops_after_first_stable_fallback_roi(
    monkeypatch,
    tmp_path,
):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()
        fallback_roi_calls: list[str] = []

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("center roi unavailable")),
        )

        def fake_crop_fallback_roi(*, image_bytes, roi):
            fallback_roi_calls.append(f"{roi['x']:.2f},{roi['y']:.2f}")
            return b"fallback-roi"

        extract_calls = {"count": 0}

        def fake_extract(**_kwargs):
            extract_calls["count"] += 1
            return {
                "extraction_status": "matched",
                "recognized_version": "BQ-FIRST-FALLBACK-1-0",
                "summary": "已识别版本号：BQ-FIRST-FALLBACK-1-0",
            }

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_by_roi",
            fake_crop_fallback_roi,
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.extract_version_recognition_result",
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
        assert extract_calls["count"] == 1
        assert len(fallback_roi_calls) == 1
        assert scopes == ["roi_right_bottom"]
        assert record.normalized_json["recognized_version"] == "BQ-FIRST-FALLBACK-1-0"


def test_version_recognition_pipeline_rotation_fallback_contract(monkeypatch, tmp_path):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip center roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_by_roi",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip fallback roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.rotate_image_bytes",
            lambda *, image_bytes, angle: f"rot-{angle}".encode("utf-8"),
        )

        def fake_extract(*, lines, template, roi_applied, context_hint):
            texts = {str(item.get("text")) for item in lines}
            if "rot270-version-upload.png" in texts:
                return {
                    "extraction_status": "matched",
                    "recognized_version": "BQ-9-9-9",
                    "summary": "已识别版本号：BQ-9-9-9",
                }
            return {
                "extraction_status": "not_found",
                "recognized_version": None,
                "summary": "未识别到版本号",
            }

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.extract_version_recognition_result",
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
        assert "full_rotated_90" in scopes
        assert "full_rotated_270" in scopes
        assert "通过旋转回退命中" in str(record.normalized_json.get("summary"))


def test_version_recognition_pipeline_stops_after_first_stable_rotation_match(monkeypatch, tmp_path):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()
        rotate_calls: list[int] = []

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip center roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_by_roi",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip fallback roi")),
        )

        def fake_rotate(*, image_bytes, angle):
            rotate_calls.append(angle)
            return f"rot-{angle}".encode("utf-8")

        def fake_extract(*, lines, template, roi_applied, context_hint):
            texts = {str(item.get("text")) for item in lines}
            if "rot90-version-upload.png" in texts:
                return {
                    "extraction_status": "matched",
                    "recognized_version": "BQ-ROT-90-1-0",
                    "summary": "已识别版本号：BQ-ROT-90-1-0",
                }
            return {
                "extraction_status": "not_found",
                "recognized_version": None,
                "summary": "未识别到版本号",
            }

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.rotate_image_bytes",
            fake_rotate,
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.extract_version_recognition_result",
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
        assert rotate_calls == [90]
        assert scopes == ["full", "full_rotated_90"]
        assert "通过旋转回退命中" in str(record.normalized_json.get("summary"))


def test_version_recognition_pipeline_upscale_fallback_contract(monkeypatch, tmp_path):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip center roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_by_roi",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip fallback roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.rotate_image_bytes",
            lambda *, image_bytes, angle: f"rot-{angle}".encode("utf-8"),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service._upscale_image_bytes",
            lambda *, image_bytes, scale, max_side: b"upscaled-x2",
        )

        def fake_extract(*, lines, template, roi_applied, context_hint):
            texts = {str(item.get("text")) for item in lines}
            if "upscaled-rot270-version-upload.png" in texts:
                return {
                    "extraction_status": "matched",
                    "recognized_version": "BQ-7-7-7",
                    "summary": "已识别版本号：BQ-7-7-7",
                }
            return {
                "extraction_status": "not_found",
                "recognized_version": None,
                "summary": "未识别到版本号",
            }

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.extract_version_recognition_result",
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
        assert "full_upscaled_x2" in scopes
        assert "full_upscaled_x2_rotated_90" in scopes
        assert "full_upscaled_x2_rotated_270" in scopes
        assert "通过放大/旋转回退命中" in str(record.normalized_json.get("summary"))


def test_version_recognition_pipeline_stops_after_first_stable_upscaled_rotation_match(
    monkeypatch,
    tmp_path,
):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()
        rotate_calls: list[str] = []

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip center roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_by_roi",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip fallback roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service._upscale_image_bytes",
            lambda *, image_bytes, scale, max_side: b"upscaled-x2",
        )

        def fake_rotate(*, image_bytes, angle):
            source = "upscaled" if image_bytes == b"upscaled-x2" else "original"
            rotate_calls.append(f"{source}:{angle}")
            return f"{source}-rot-{angle}".encode("utf-8")

        def fake_extract(*, lines, template, roi_applied, context_hint):
            texts = {str(item.get("text")) for item in lines}
            if "upscaled-rot90-version-upload.png" in texts:
                return {
                    "extraction_status": "matched",
                    "recognized_version": "BQ-UPSCALED-ROT-90-1-0",
                    "summary": "已识别版本号：BQ-UPSCALED-ROT-90-1-0",
                }
            return {
                "extraction_status": "not_found",
                "recognized_version": None,
                "summary": "未识别到版本号",
            }

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.rotate_image_bytes",
            fake_rotate,
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.extract_version_recognition_result",
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
        assert rotate_calls == ["original:90", "original:270", "upscaled:90"]
        assert scopes == [
            "full",
            "full_rotated_90",
            "full_rotated_270",
            "full_upscaled_x2",
            "full_upscaled_x2_rotated_90",
        ]
        assert "通过放大/旋转回退命中" in str(record.normalized_json.get("summary"))


def test_version_recognition_pipeline_not_found_degradation_contract(monkeypatch, tmp_path):
    with SessionLocal() as db:
        job = _seed_version_recognition_job(db, tmp_path)
        finished, finish_job, create_failed_upload_record = _success_callbacks()

        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.recognize_with_ocr_service",
            lambda *, image_bytes, filename, template: _fake_ocr_result(filename),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_for_template",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip center roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.crop_image_by_roi",
            lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("skip fallback roi")),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.rotate_image_bytes",
            lambda *, image_bytes, angle: f"rot-{angle}".encode("utf-8"),
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service._upscale_image_bytes",
            lambda *, image_bytes, scale, max_side: b"upscaled-x2",
        )
        monkeypatch.setattr(
            "app.services.version_recognition_attempt_service.extract_version_recognition_result",
            lambda **_kwargs: {
                "extraction_status": "not_found",
                "recognized_version": None,
                "summary": "未识别到版本号",
            },
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


def test_version_recognition_pipeline_module_delegates_attempt_execution():
    module_path = Path(__file__).resolve().parents[1] / "app" / "services" / "version_recognition_pipeline_service.py"
    module_ast = ast.parse(module_path.read_text(encoding="utf-8"))

    imported_modules: set[str] = set()
    for node in ast.walk(module_ast):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.add(node.module)

    assert "app.services.version_recognition_attempt_service" in imported_modules

    target = next(
        (
            node
            for node in module_ast.body
            if isinstance(node, ast.FunctionDef) and node.name == "process_version_recognition_job"
        ),
        None,
    )
    assert target is not None
    assert any(
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "run_version_recognition_attempts"
        for node in ast.walk(target)
    )
