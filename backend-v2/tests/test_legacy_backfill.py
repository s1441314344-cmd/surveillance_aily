import json
import sqlite3
from pathlib import Path

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.camera import Camera
from app.models.file_asset import FileAsset
from app.models.job import Job, JobSchedule
from app.models.model_provider import ModelProvider
from app.models.strategy import AnalysisStrategy, StrategyVersion
from app.models.task_record import TaskRecord
from app.services.legacy_backfill_service import _uuid_from_legacy, run_legacy_backfill


def test_legacy_backfill_dry_run_does_not_persist(reset_database, tmp_path):
    source_path, source_root = create_legacy_fixture(tmp_path)

    with SessionLocal() as db:
        report = run_legacy_backfill(db, source_path=source_path, source_root=source_root, dry_run=True)

    assert report.source_counts["detection_records"] == 1
    assert report.source_counts["submit_tasks"] == 1
    assert report.entity_stats["jobs"].created == 2
    assert report.entity_stats["task_records"].created == 3
    assert report.entity_stats["job_schedules"].created == 1
    assert any("Skipped 1 legacy work_orders" in warning for warning in report.warnings)

    with SessionLocal() as db:
        assert count_rows(db, Job) == 0
        assert count_rows(db, TaskRecord) == 0
        assert count_rows(db, Camera) == 0
        assert count_rows(db, FileAsset) == 0
        assert count_rows(db, AnalysisStrategy) == 3


def test_legacy_backfill_apply_is_idempotent(reset_database, tmp_path):
    source_path, source_root = create_legacy_fixture(tmp_path)

    with SessionLocal() as db:
        first_report = run_legacy_backfill(db, source_path=source_path, source_root=source_root, dry_run=False)

    assert first_report.entity_stats["jobs"].created == 2
    assert first_report.entity_stats["task_records"].created == 3

    with SessionLocal() as db:
        assert count_rows(db, Camera) == 1
        assert count_rows(db, AnalysisStrategy) == 4
        assert count_rows(db, StrategyVersion) == 4
        assert count_rows(db, JobSchedule) == 1
        assert count_rows(db, Job) == 2
        assert count_rows(db, TaskRecord) == 3
        assert count_rows(db, FileAsset) == 3

        provider = db.get(ModelProvider, "zhipu")
        assert provider is not None
        assert provider.status == "active"
        assert provider.default_model == "glm-4v-plus"

        submit_records = list(
            db.scalars(select(TaskRecord).where(TaskRecord.job_id == _uuid_from_legacy("job_submit_task", 1)))
        )
        assert len(submit_records) == 2
        assert all(record.normalized_json["summary"] == "No issues detected" for record in submit_records)

    with SessionLocal() as db:
        second_report = run_legacy_backfill(db, source_path=source_path, source_root=source_root, dry_run=False)

    assert second_report.entity_stats["jobs"].created == 0
    assert second_report.entity_stats["jobs"].skipped == 2
    assert second_report.entity_stats["task_records"].created == 0
    assert second_report.entity_stats["file_assets"].created == 0

    with SessionLocal() as db:
        assert count_rows(db, Camera) == 1
        assert count_rows(db, AnalysisStrategy) == 4
        assert count_rows(db, JobSchedule) == 1
        assert count_rows(db, Job) == 2
        assert count_rows(db, TaskRecord) == 3
        assert count_rows(db, FileAsset) == 3


def count_rows(db, model_cls) -> int:
    return int(db.scalar(select(func.count()).select_from(model_cls)) or 0)


def create_legacy_fixture(tmp_path: Path) -> tuple[Path, Path]:
    source_root = tmp_path / "legacy-root"
    detections_dir = source_root / "data" / "detections"
    screenshots_dir = source_root / "screenshot"
    detections_dir.mkdir(parents=True)
    screenshots_dir.mkdir(parents=True)

    (detections_dir / "detect-1.jpg").write_bytes(b"legacy-detection-image")
    (screenshots_dir / "result-1.jpg").write_bytes(b"legacy-result-image")
    (detections_dir / "submit-1.jpg").write_bytes(b"legacy-submit-image-1")
    (detections_dir / "submit-2.jpg").write_bytes(b"legacy-submit-image-2")

    source_path = source_root / "surveillance.db"
    conn = sqlite3.connect(source_path)
    try:
        conn.executescript(
            """
            CREATE TABLE cameras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                rtsp_url TEXT,
                location TEXT,
                frequency INTEGER DEFAULT 60,
                status TEXT DEFAULT 'active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                prompt_content TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                scene TEXT,
                output_format TEXT,
                template_id INTEGER
            );
            CREATE TABLE prompt_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                prompt_content TEXT NOT NULL,
                description TEXT,
                usage_count INTEGER DEFAULT 0,
                success_rate REAL DEFAULT 0,
                is_system INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE inspection_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                camera_id INTEGER NOT NULL,
                rule_id INTEGER NOT NULL,
                frequency_seconds INTEGER NOT NULL,
                auto_create_work_order INTEGER DEFAULT 1,
                status TEXT DEFAULT 'active',
                last_run_time TEXT,
                next_run_time TEXT,
                last_record_id INTEGER,
                last_error TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                resolution TEXT DEFAULT 'original',
                quality INTEGER DEFAULT 80,
                storage_path TEXT,
                max_frames INTEGER DEFAULT 1000
            );
            CREATE TABLE detection_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id INTEGER,
                rule_id INTEGER NOT NULL,
                image_path TEXT,
                result_image_path TEXT,
                llm_result TEXT,
                has_violation INTEGER DEFAULT 0,
                detect_time TEXT DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                source_type TEXT DEFAULT 'upload',
                analysis_summary TEXT,
                prompt_snapshot TEXT,
                analysis_model TEXT,
                severity TEXT DEFAULT 'normal',
                structured_output TEXT
            );
            CREATE TABLE submit_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id INTEGER NOT NULL,
                model_name TEXT,
                image_path_1 TEXT NOT NULL,
                image_path_2 TEXT NOT NULL,
                llm_raw_result TEXT,
                llm_structured_result TEXT,
                status TEXT DEFAULT 'success',
                error_message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE work_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT DEFAULT 'medium',
                assignee TEXT,
                status TEXT DEFAULT 'pending',
                processing_note TEXT,
                processing_image_path TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                closed_at TEXT
            );
            CREATE TABLE system_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        conn.execute(
            """
            INSERT INTO cameras (id, code, name, rtsp_url, location, frequency, status, created_at, updated_at)
            VALUES (1, 'cam_legacy_1', '历史摄像头', 'rtsp://tester:secret@192.168.1.66:554/live', '老厂区', 45, 'active', '2026-03-20 10:00:00', '2026-03-20 10:05:00')
            """
        )
        conn.execute(
            """
            INSERT INTO rules (id, code, name, prompt_content, description, status, created_at, updated_at, scene, output_format, template_id)
            VALUES (1, 'legacy_helmet', '历史安全帽检测', '请分析图片中的安全帽佩戴情况', '历史规则描述', 'active', '2026-03-20 10:00:00', '2026-03-20 10:06:00', '历史安全帽场景', '结果、描述、总结', 1)
            """
        )
        conn.execute(
            """
            INSERT INTO prompt_templates (id, code, name, category, prompt_content, description, is_system, status, created_at, updated_at)
            VALUES (1, 'legacy_helmet', '历史安全帽模板', '安全', '请输出四段式结果', '历史模板描述', 1, 'active', '2026-03-20 10:00:00', '2026-03-20 10:06:00')
            """
        )
        conn.execute(
            """
            INSERT INTO inspection_tasks (id, name, camera_id, rule_id, frequency_seconds, auto_create_work_order, status, last_run_time, next_run_time, last_record_id, last_error, created_at, updated_at, resolution, quality, storage_path, max_frames)
            VALUES (1, 'legacy-task', 1, 1, 45, 1, 'active', '2026-03-20 11:00:00', '2026-03-20 11:01:00', 1, NULL, '2026-03-20 10:10:00', '2026-03-20 10:20:00', 'original', 80, NULL, 1000)
            """
        )

        detection_output = json.dumps({"summary": "检测到 1 人未佩戴安全帽", "result": "异常"}, ensure_ascii=False)
        conn.execute(
            """
            INSERT INTO detection_records (id, camera_id, rule_id, image_path, result_image_path, llm_result, has_violation, detect_time, created_at, source_type, analysis_summary, prompt_snapshot, analysis_model, severity, structured_output)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                None,
                1,
                "./data/detections/detect-1.jpg",
                "./screenshot/result-1.jpg",
                "检测结果：存在违规",
                1,
                "2026-03-20 12:00:00",
                "2026-03-20 12:00:00",
                "upload",
                None,
                "请按 JSON 返回结果",
                "glm-4v-plus",
                "normal",
                detection_output,
            ),
        )

        submit_output = {
            "has_violation": False,
            "risk_level": "low",
            "summary": "No issues detected",
        }
        conn.execute(
            """
            INSERT INTO submit_tasks (id, rule_id, model_name, image_path_1, image_path_2, llm_raw_result, llm_structured_result, status, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                1,
                "glm-4v-plus",
                "./data/detections/submit-1.jpg",
                "./data/detections/submit-2.jpg",
                "```json\n" + json.dumps(submit_output, ensure_ascii=False) + "\n```",
                json.dumps(submit_output, ensure_ascii=False),
                "success",
                None,
                "2026-03-20 13:00:00",
            ),
        )
        conn.execute(
            """
            INSERT INTO work_orders (id, record_id, title, description, priority, status, created_at, updated_at)
            VALUES (1, 1, '历史工单', '保留在旧系统', 'medium', 'pending', '2026-03-20 12:10:00', '2026-03-20 12:10:00')
            """
        )
        conn.execute(
            """
            INSERT INTO system_settings (key, value, updated_at)
            VALUES
              ('system', ?, '2026-03-20 10:00:00'),
              ('llm', ?, '2026-03-20 10:00:00'),
              ('llm_runtime', ?, '2026-03-20 10:00:00')
            """,
            (
                json.dumps({"llm_timeout_seconds": 90}, ensure_ascii=False),
                json.dumps({"provider": "zhipu", "model": "glm-4v-plus"}, ensure_ascii=False),
                json.dumps(
                    {
                        "provider": "zhipu",
                        "model_name": "glm-4v-plus",
                        "base_url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                        "api_key": "",
                    },
                    ensure_ascii=False,
                ),
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return source_path, source_root
