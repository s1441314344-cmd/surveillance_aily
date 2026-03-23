from __future__ import annotations

import json
import math
import mimetypes
import sqlite3
import uuid
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import encrypt_secret
from app.models.camera import Camera
from app.models.file_asset import FileAsset
from app.models.job import Job, JobSchedule
from app.models.model_provider import ModelProvider
from app.models.strategy import AnalysisStrategy, StrategyVersion
from app.models.task_record import TaskRecord
from app.services.job_schedule_service import (
    SCHEDULE_STATUS_ACTIVE,
    SCHEDULE_STATUS_PAUSED,
    SCHEDULE_TYPE_INTERVAL_MINUTES,
    calculate_next_run_at,
)
from app.services.strategy_service import build_strategy_snapshot

LEGACY_NAMESPACE = uuid.UUID("4cdac1f1-b77f-454c-8cb0-5a2c10a82024")
DEFAULT_PROVIDER = "zhipu"
DEFAULT_MODEL_NAME = "glm-4v-plus"

SUPPORTED_SOURCE_TABLES = [
    "cameras",
    "rules",
    "prompt_templates",
    "inspection_tasks",
    "detection_records",
    "submit_tasks",
    "work_orders",
    "system_settings",
]

TARGET_MODELS = {
    "model_providers": ModelProvider,
    "cameras": Camera,
    "analysis_strategies": AnalysisStrategy,
    "strategy_versions": StrategyVersion,
    "job_schedules": JobSchedule,
    "jobs": Job,
    "task_records": TaskRecord,
    "file_assets": FileAsset,
}


@dataclass
class EntitySyncStats:
    created: int = 0
    updated: int = 0
    skipped: int = 0


@dataclass
class BackfillReport:
    source_path: str
    source_root: str
    dry_run: bool
    source_counts: dict[str, int] = field(default_factory=dict)
    target_counts_before: dict[str, int] = field(default_factory=dict)
    target_counts_after: dict[str, int] = field(default_factory=dict)
    entity_stats: dict[str, EntitySyncStats] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    missing_files: list[str] = field(default_factory=list)

    def bump(self, entity: str, action: str) -> None:
        stats = self.entity_stats.setdefault(entity, EntitySyncStats())
        setattr(stats, action, getattr(stats, action) + 1)

    def add_warning(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)

    def add_missing_file(self, path: str) -> None:
        if path not in self.missing_files:
            self.missing_files.append(path)

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["entity_stats"] = {
            entity: asdict(stats)
            for entity, stats in sorted(self.entity_stats.items())
        }
        return payload


@dataclass
class LegacyRuleContext:
    row: sqlite3.Row
    matching_template: sqlite3.Row | None
    sample_json: dict | list | None
    provider: str
    model_name: str


def run_legacy_backfill(
    db: Session,
    *,
    source_path: str | Path,
    source_root: str | Path | None = None,
    dry_run: bool = True,
) -> BackfillReport:
    resolved_source_path = Path(source_path).expanduser().resolve()
    if not resolved_source_path.exists():
        raise FileNotFoundError(f"Legacy SQLite source not found: {resolved_source_path}")

    resolved_source_root = _resolve_source_root(resolved_source_path, source_root)
    report = BackfillReport(
        source_path=str(resolved_source_path),
        source_root=str(resolved_source_root),
        dry_run=dry_run,
    )
    report.source_counts = _collect_source_counts(resolved_source_path, report)
    report.target_counts_before = _collect_target_counts(db)

    conn = sqlite3.connect(str(resolved_source_path))
    conn.row_factory = sqlite3.Row

    try:
        system_settings = _load_key_value_json_table(conn, "system_settings", report)
        default_provider = str(
            (system_settings.get("llm_runtime") or {}).get("provider")
            or (system_settings.get("llm") or {}).get("provider")
            or DEFAULT_PROVIDER
        )
        default_model_name = str(
            (system_settings.get("llm_runtime") or {}).get("model_name")
            or (system_settings.get("llm") or {}).get("model")
            or DEFAULT_MODEL_NAME
        )

        _backfill_model_provider_config(
            db,
            report,
            system_settings=system_settings,
            default_provider=default_provider,
            default_model_name=default_model_name,
        )

        camera_rows = _load_rows(conn, "cameras", report)
        rule_rows = _load_rows(conn, "rules", report)
        prompt_rows = _load_rows(conn, "prompt_templates", report)
        schedule_rows = _load_rows(conn, "inspection_tasks", report)
        detection_rows = _load_rows(conn, "detection_records", report)
        submit_rows = _load_rows(conn, "submit_tasks", report)
        work_order_rows = _load_rows(conn, "work_orders", report)

        camera_id_map = _backfill_cameras(
            db,
            report,
            camera_rows=camera_rows,
            source_root=resolved_source_root,
            dry_run=dry_run,
        )
        rule_contexts = _build_rule_contexts(
            rule_rows=rule_rows,
            prompt_rows=prompt_rows,
            detection_rows=detection_rows,
            submit_rows=submit_rows,
            default_provider=default_provider,
            default_model_name=default_model_name,
        )
        strategy_id_map = _backfill_strategies(
            db,
            report,
            rule_contexts=rule_contexts,
        )
        schedule_id_map = _backfill_job_schedules(
            db,
            report,
            schedule_rows=schedule_rows,
            camera_id_map=camera_id_map,
            strategy_id_map=strategy_id_map,
        )

        work_orders_by_record_id = _group_rows_by_key(work_order_rows, "record_id")
        _backfill_detection_record_history(
            db,
            report,
            detection_rows=detection_rows,
            camera_rows_by_id=_rows_by_id(camera_rows),
            strategy_rows_by_id=_rows_by_id(rule_rows),
            work_orders_by_record_id=work_orders_by_record_id,
            camera_id_map=camera_id_map,
            strategy_id_map=strategy_id_map,
            source_root=resolved_source_root,
            default_provider=default_provider,
            default_model_name=default_model_name,
        )
        _backfill_submit_task_history(
            db,
            report,
            submit_rows=submit_rows,
            strategy_rows_by_id=_rows_by_id(rule_rows),
            strategy_id_map=strategy_id_map,
            source_root=resolved_source_root,
            default_provider=default_provider,
            default_model_name=default_model_name,
        )

        if work_order_rows:
            report.add_warning(
                f"Skipped {len(work_order_rows)} legacy work_orders from core migration; keep them in the legacy database."
            )

        db.flush()
        report.target_counts_after = _collect_target_counts(db)
        if dry_run:
            db.rollback()
        else:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        conn.close()

    return report


def _backfill_model_provider_config(
    db: Session,
    report: BackfillReport,
    *,
    system_settings: dict[str, dict | str | list | None],
    default_provider: str,
    default_model_name: str,
) -> None:
    llm_runtime = system_settings.get("llm_runtime") or {}
    llm_settings = system_settings.get("llm") or {}
    system_config = system_settings.get("system") or {}

    provider_name = str(llm_runtime.get("provider") or llm_settings.get("provider") or default_provider)
    base_url = str(llm_runtime.get("base_url") or _default_base_url_for_provider(provider_name))
    timeout_seconds = int(system_config.get("llm_timeout_seconds") or 120)
    existing_provider = db.get(ModelProvider, provider_name)
    encrypted_api_key = encrypt_secret(str(llm_runtime.get("api_key") or "").strip()) or (
        existing_provider.api_key_encrypted if existing_provider else None
    )

    values = {
        "provider": provider_name,
        "display_name": _default_display_name_for_provider(provider_name),
        "base_url": base_url,
        "api_key_encrypted": encrypted_api_key,
        "default_model": str(llm_runtime.get("model_name") or llm_settings.get("model") or default_model_name),
        "timeout_seconds": timeout_seconds,
        "status": "active",
    }

    _upsert_model(db, report, "model_providers", ModelProvider, provider_name, values)


def _backfill_cameras(
    db: Session,
    report: BackfillReport,
    *,
    camera_rows: list[sqlite3.Row],
    source_root: Path,
    dry_run: bool,
) -> dict[int, str]:
    camera_id_map: dict[int, str] = {}

    for row in camera_rows:
        legacy_id = _uuid_from_legacy("camera", row["id"])
        camera_id_map[int(row["id"])] = legacy_id
        rtsp_url = row["rtsp_url"]
        parsed_rtsp = urlparse(rtsp_url) if rtsp_url else None
        storage_path = row["location"] or row["code"] or f"camera-{row['id']}"
        camera_storage_path = (source_root / "data" / "storage" / "legacy" / "cameras" / _safe_path_segment(storage_path)).resolve()
        if not dry_run:
            camera_storage_path.mkdir(parents=True, exist_ok=True)

        values = {
            "id": legacy_id,
            "name": row["name"],
            "location": row["location"],
            "ip_address": parsed_rtsp.hostname if parsed_rtsp else None,
            "port": parsed_rtsp.port if parsed_rtsp else None,
            "protocol": (parsed_rtsp.scheme or "rtsp") if parsed_rtsp else "rtsp",
            "username": parsed_rtsp.username if parsed_rtsp else None,
            "password_encrypted": encrypt_secret(parsed_rtsp.password) if parsed_rtsp and parsed_rtsp.password else None,
            "rtsp_url": rtsp_url,
            "frame_frequency_seconds": int(row["frequency"] or 60),
            "resolution": "original",
            "jpeg_quality": 80,
            "storage_path": str(camera_storage_path),
            "created_at": _parse_datetime(row["created_at"]),
            "updated_at": _parse_datetime(row["updated_at"]),
        }
        _upsert_model(db, report, "cameras", Camera, legacy_id, values)

    return camera_id_map


def _build_rule_contexts(
    *,
    rule_rows: list[sqlite3.Row],
    prompt_rows: list[sqlite3.Row],
    detection_rows: list[sqlite3.Row],
    submit_rows: list[sqlite3.Row],
    default_provider: str,
    default_model_name: str,
) -> dict[int, LegacyRuleContext]:
    prompts_by_id = {int(row["id"]): row for row in prompt_rows}
    prompts_by_code = {str(row["code"]): row for row in prompt_rows}
    prompts_by_name = {str(row["name"]): row for row in prompt_rows}

    detection_by_rule = _group_rows_by_key(detection_rows, "rule_id")
    submit_by_rule = _group_rows_by_key(submit_rows, "rule_id")

    contexts: dict[int, LegacyRuleContext] = {}
    for row in rule_rows:
        rule_id = int(row["id"])
        matching_template = None
        if row["template_id"]:
            matching_template = prompts_by_id.get(int(row["template_id"]))
        if matching_template is None:
            matching_template = prompts_by_code.get(str(row["code"]))
        if matching_template is None:
            matching_template = prompts_by_name.get(str(row["name"]))

        sample_json = None
        for candidate in detection_by_rule.get(rule_id, []):
            sample_json = _extract_json_payload(candidate["structured_output"]) or _extract_json_payload(candidate["llm_result"])
            if sample_json is not None:
                break
        if sample_json is None:
            for candidate in submit_by_rule.get(rule_id, []):
                sample_json = _extract_json_payload(candidate["llm_structured_result"]) or _extract_json_payload(candidate["llm_raw_result"])
                if sample_json is not None:
                    break

        model_name = default_model_name
        for candidate in submit_by_rule.get(rule_id, []):
            if candidate["model_name"]:
                model_name = str(candidate["model_name"])
                break
        if model_name == default_model_name:
            for candidate in detection_by_rule.get(rule_id, []):
                if candidate["analysis_model"]:
                    model_name = str(candidate["analysis_model"])
                    break

        contexts[rule_id] = LegacyRuleContext(
            row=row,
            matching_template=matching_template,
            sample_json=sample_json,
            provider=_infer_provider_name(model_name, default_provider),
            model_name=model_name,
        )

    return contexts


def _backfill_strategies(
    db: Session,
    report: BackfillReport,
    *,
    rule_contexts: dict[int, LegacyRuleContext],
) -> dict[int, str]:
    strategy_id_map: dict[int, str] = {}

    for rule_id, context in rule_contexts.items():
        row = context.row
        strategy_id = _uuid_from_legacy("strategy", rule_id)
        strategy_id_map[rule_id] = strategy_id

        prompt_template = (
            row["prompt_content"]
            or (context.matching_template["prompt_content"] if context.matching_template else None)
            or "请结合图片内容完成分析，并返回结构化 JSON。"
        )
        scene_description = " / ".join(
            item
            for item in [
                row["scene"],
                row["description"],
                context.matching_template["description"] if context.matching_template else None,
            ]
            if item
        ) or row["name"]
        response_schema = _infer_response_schema(
            sample_json=context.sample_json,
            output_format=row["output_format"],
            prompt_template=prompt_template,
        )

        values = {
            "id": strategy_id,
            "name": row["name"],
            "scene_description": scene_description,
            "prompt_template": prompt_template,
            "model_provider": context.provider,
            "model_name": context.model_name,
            "response_schema": response_schema,
            "status": "active" if str(row["status"]).lower() == "active" else "inactive",
            "version": 1,
            "is_preset": False,
            "created_at": _parse_datetime(row["created_at"]),
            "updated_at": _parse_datetime(row["updated_at"]),
        }

        strategy = _upsert_model(db, report, "analysis_strategies", AnalysisStrategy, strategy_id, values)
        version_values = {
            "id": _uuid_from_legacy("strategy_version", rule_id, 1),
            "strategy_id": strategy_id,
            "version": 1,
            "snapshot": build_strategy_snapshot(strategy),
            "created_at": values["created_at"],
            "updated_at": values["updated_at"],
        }
        _upsert_model(db, report, "strategy_versions", StrategyVersion, version_values["id"], version_values)

    return strategy_id_map


def _backfill_job_schedules(
    db: Session,
    report: BackfillReport,
    *,
    schedule_rows: list[sqlite3.Row],
    camera_id_map: dict[int, str],
    strategy_id_map: dict[int, str],
) -> dict[int, str]:
    schedule_id_map: dict[int, str] = {}

    for row in schedule_rows:
        legacy_id = _uuid_from_legacy("job_schedule", row["id"])
        schedule_id_map[int(row["id"])] = legacy_id

        frequency_seconds = int(row["frequency_seconds"] or 60)
        interval_minutes = max(1, math.ceil(frequency_seconds / 60))
        if frequency_seconds % 60 != 0:
            report.add_warning(
                f"Legacy inspection_task {row['id']} used {frequency_seconds}s frequency; rounded to {interval_minutes} minute(s) in V2."
            )

        current_time = _parse_datetime(row["updated_at"]) or datetime.now(timezone.utc)
        status = SCHEDULE_STATUS_ACTIVE if str(row["status"]).lower() == "active" else SCHEDULE_STATUS_PAUSED
        next_run_at = _parse_datetime(row["next_run_time"])
        if status == SCHEDULE_STATUS_ACTIVE and next_run_at is None:
            next_run_at = calculate_next_run_at(SCHEDULE_TYPE_INTERVAL_MINUTES, str(interval_minutes), current_time)
        if status != SCHEDULE_STATUS_ACTIVE:
            next_run_at = None

        values = {
            "id": legacy_id,
            "camera_id": camera_id_map.get(int(row["camera_id"])),
            "strategy_id": strategy_id_map.get(int(row["rule_id"])),
            "schedule_type": SCHEDULE_TYPE_INTERVAL_MINUTES,
            "schedule_value": str(interval_minutes),
            "status": status,
            "next_run_at": next_run_at,
            "last_run_at": _parse_datetime(row["last_run_time"]),
            "last_error": row["last_error"],
            "created_at": _parse_datetime(row["created_at"]),
            "updated_at": _parse_datetime(row["updated_at"]),
        }

        if not values["camera_id"] or not values["strategy_id"]:
            report.add_warning(f"Skipped inspection_task {row['id']} because its camera or rule could not be mapped.")
            report.bump("job_schedules", "skipped")
            continue

        _upsert_model(db, report, "job_schedules", JobSchedule, legacy_id, values)

    return schedule_id_map


def _backfill_detection_record_history(
    db: Session,
    report: BackfillReport,
    *,
    detection_rows: list[sqlite3.Row],
    camera_rows_by_id: dict[int, sqlite3.Row],
    strategy_rows_by_id: dict[int, sqlite3.Row],
    work_orders_by_record_id: dict[int, list[sqlite3.Row]],
    camera_id_map: dict[int, str],
    strategy_id_map: dict[int, str],
    source_root: Path,
    default_provider: str,
    default_model_name: str,
) -> None:
    for row in detection_rows:
        rule_row = strategy_rows_by_id.get(int(row["rule_id"]))
        if rule_row is None:
            report.add_warning(f"Skipped detection_record {row['id']} because rule {row['rule_id']} was not found.")
            report.bump("jobs", "skipped")
            report.bump("task_records", "skipped")
            continue

        strategy_id = strategy_id_map.get(int(row["rule_id"]))
        camera_id = camera_id_map.get(int(row["camera_id"])) if row["camera_id"] is not None else None
        model_name = str(row["analysis_model"] or default_model_name)
        model_provider = _infer_provider_name(model_name, default_provider)
        created_at = _parse_datetime(row["detect_time"]) or _parse_datetime(row["created_at"])
        schedule_id = None

        job_id = _uuid_from_legacy("job_detection", row["id"])
        strategy_snapshot = _build_legacy_strategy_snapshot(
            strategy_row=rule_row,
            strategy_id=strategy_id,
            model_provider=model_provider,
            model_name=model_name,
            prompt_override=row["prompt_snapshot"],
            normalized_json=_extract_json_payload(row["structured_output"]) or _extract_json_payload(row["llm_result"]),
        )

        file_asset_id, input_image_path, input_filename = _ensure_file_asset(
            db,
            report,
            source_root=source_root,
            raw_path=row["image_path"],
            asset_id=_uuid_from_legacy("file_detection_input", row["id"]),
            original_name=Path(str(row["image_path"] or "")).name or f"detection-{row['id']}.jpg",
            purpose="legacy_job_input",
            entity_label="file_assets",
        )
        preview_image_path = _resolve_existing_path_or_none(
            report=report,
            source_root=source_root,
            raw_path=row["result_image_path"],
        )

        raw_model_response = str(row["llm_result"] or "")
        normalized_json = _extract_json_payload(row["structured_output"]) or _extract_json_payload(raw_model_response)
        result_status = "completed" if raw_model_response or normalized_json is not None else "failed"
        job_status = "completed" if result_status == "completed" else "failed"
        error_message = None if job_status == "completed" else "Legacy detection record is missing model output"

        camera_snapshot = None
        if camera_id and row["camera_id"] is not None:
            camera_row = camera_rows_by_id.get(int(row["camera_id"]))
            camera_snapshot = _build_legacy_camera_snapshot(camera_id, camera_row, source_root)

        job_payload = {
            "requested_by": "legacy_backfill",
            "source_type": "camera" if camera_id else "upload",
            "legacy_source_table": "detection_records",
            "legacy_source_id": row["id"],
            "legacy_work_order_ids": [item["id"] for item in work_orders_by_record_id.get(int(row["id"]), [])],
            "strategy_snapshot": strategy_snapshot,
            "input_asset_ids": [file_asset_id] if file_asset_id else [],
            "input_file_names": [input_filename] if input_filename else [],
        }
        if camera_snapshot is not None:
            job_payload["camera_snapshot"] = camera_snapshot

        job_values = {
            "id": job_id,
            "job_type": "camera_once" if camera_id else "upload_single",
            "trigger_mode": "manual",
            "strategy_id": strategy_id,
            "strategy_name": rule_row["name"],
            "camera_id": camera_id,
            "schedule_id": schedule_id,
            "model_provider": model_provider,
            "model_name": model_name,
            "celery_task_id": None,
            "status": job_status,
            "total_items": 1,
            "completed_items": 1 if job_status == "completed" else 0,
            "failed_items": 0 if job_status == "completed" else 1,
            "error_message": error_message,
            "started_at": created_at,
            "finished_at": created_at,
            "payload": job_payload,
            "created_at": created_at,
            "updated_at": created_at,
        }
        _upsert_model(db, report, "jobs", Job, job_id, job_values)

        record_values = {
            "id": _uuid_from_legacy("task_record_detection", row["id"]),
            "job_id": job_id,
            "strategy_id": strategy_id,
            "strategy_name": rule_row["name"],
            "strategy_snapshot": strategy_snapshot,
            "input_file_asset_id": file_asset_id,
            "input_filename": input_filename,
            "input_image_path": input_image_path,
            "preview_image_path": preview_image_path,
            "source_type": "camera" if camera_id else "upload",
            "camera_id": camera_id,
            "model_provider": model_provider,
            "model_name": model_name,
            "raw_model_response": raw_model_response or (error_message or ""),
            "normalized_json": normalized_json,
            "result_status": result_status,
            "duration_ms": 0,
            "feedback_status": "unreviewed",
            "created_at": created_at,
            "updated_at": created_at,
        }
        _upsert_model(db, report, "task_records", TaskRecord, record_values["id"], record_values)


def _backfill_submit_task_history(
    db: Session,
    report: BackfillReport,
    *,
    submit_rows: list[sqlite3.Row],
    strategy_rows_by_id: dict[int, sqlite3.Row],
    strategy_id_map: dict[int, str],
    source_root: Path,
    default_provider: str,
    default_model_name: str,
) -> None:
    for row in submit_rows:
        rule_row = strategy_rows_by_id.get(int(row["rule_id"]))
        if rule_row is None:
            report.add_warning(f"Skipped submit_task {row['id']} because rule {row['rule_id']} was not found.")
            report.bump("jobs", "skipped")
            report.bump("task_records", "skipped")
            continue

        created_at = _parse_datetime(row["created_at"])
        strategy_id = strategy_id_map.get(int(row["rule_id"]))
        model_name = str(row["model_name"] or default_model_name)
        model_provider = _infer_provider_name(model_name, default_provider)
        normalized_json = _extract_json_payload(row["llm_structured_result"]) or _extract_json_payload(row["llm_raw_result"])
        raw_model_response = str(row["llm_raw_result"] or "")
        image_specs = [
            ("1", row["image_path_1"], _uuid_from_legacy("file_submit_input", row["id"], 1)),
            ("2", row["image_path_2"], _uuid_from_legacy("file_submit_input", row["id"], 2)),
        ]

        file_assets: list[tuple[str | None, str, str]] = []
        for slot, raw_path, asset_id in image_specs:
            file_asset_id, input_image_path, input_filename = _ensure_file_asset(
                db,
                report,
                source_root=source_root,
                raw_path=raw_path,
                asset_id=asset_id,
                original_name=Path(str(raw_path or "")).name or f"submit-{row['id']}-{slot}.jpg",
                purpose="legacy_job_input",
                entity_label="file_assets",
            )
            file_assets.append((file_asset_id, input_image_path, input_filename))

        total_items = len(file_assets)
        result_status = "completed" if str(row["status"]).lower() == "success" else "failed"
        job_status = "completed" if result_status == "completed" else "failed"
        strategy_snapshot = _build_legacy_strategy_snapshot(
            strategy_row=rule_row,
            strategy_id=strategy_id,
            model_provider=model_provider,
            model_name=model_name,
            prompt_override=None,
            normalized_json=normalized_json,
        )

        job_id = _uuid_from_legacy("job_submit_task", row["id"])
        job_values = {
            "id": job_id,
            "job_type": "upload_batch" if total_items > 1 else "upload_single",
            "trigger_mode": "manual",
            "strategy_id": strategy_id,
            "strategy_name": rule_row["name"],
            "camera_id": None,
            "schedule_id": None,
            "model_provider": model_provider,
            "model_name": model_name,
            "celery_task_id": None,
            "status": job_status,
            "total_items": total_items,
            "completed_items": total_items if job_status == "completed" else 0,
            "failed_items": 0 if job_status == "completed" else total_items,
            "error_message": row["error_message"],
            "started_at": created_at,
            "finished_at": created_at,
            "payload": {
                "requested_by": "legacy_backfill",
                "source_type": "upload",
                "legacy_source_table": "submit_tasks",
                "legacy_source_id": row["id"],
                "legacy_pair_input": True,
                "strategy_snapshot": strategy_snapshot,
                "input_asset_ids": [item[0] for item in file_assets if item[0]],
                "input_file_names": [item[2] for item in file_assets],
            },
            "created_at": created_at,
            "updated_at": created_at,
        }
        _upsert_model(db, report, "jobs", Job, job_id, job_values)

        for index, (file_asset_id, input_image_path, input_filename) in enumerate(file_assets, start=1):
            record_values = {
                "id": _uuid_from_legacy("task_record_submit", row["id"], index),
                "job_id": job_id,
                "strategy_id": strategy_id,
                "strategy_name": rule_row["name"],
                "strategy_snapshot": strategy_snapshot,
                "input_file_asset_id": file_asset_id,
                "input_filename": input_filename,
                "input_image_path": input_image_path,
                "preview_image_path": None,
                "source_type": "upload",
                "camera_id": None,
                "model_provider": model_provider,
                "model_name": model_name,
                "raw_model_response": raw_model_response or str(row["error_message"] or ""),
                "normalized_json": normalized_json,
                "result_status": result_status,
                "duration_ms": 0,
                "feedback_status": "unreviewed",
                "created_at": created_at,
                "updated_at": created_at,
            }
            _upsert_model(db, report, "task_records", TaskRecord, record_values["id"], record_values)


def _build_legacy_camera_snapshot(camera_id: str, camera_row: sqlite3.Row | None, source_root: Path) -> dict:
    if camera_row is None:
        return {
            "id": camera_id,
            "name": "legacy-camera",
            "protocol": "rtsp",
            "rtsp_url": None,
            "resolution": "original",
            "jpeg_quality": 80,
            "storage_path": str((source_root / "data" / "storage" / "legacy" / "cameras" / "unknown").resolve()),
        }

    rtsp_url = camera_row["rtsp_url"]
    parsed_rtsp = urlparse(rtsp_url) if rtsp_url else None
    storage_path = camera_row["location"] or camera_row["code"] or f"camera-{camera_row['id']}"
    return {
        "id": camera_id,
        "name": camera_row["name"],
        "protocol": (parsed_rtsp.scheme or "rtsp") if parsed_rtsp else "rtsp",
        "rtsp_url": rtsp_url,
        "resolution": "original",
        "jpeg_quality": 80,
        "storage_path": str(
            (source_root / "data" / "storage" / "legacy" / "cameras" / _safe_path_segment(storage_path)).resolve()
        ),
    }


def _build_legacy_strategy_snapshot(
    *,
    strategy_row: sqlite3.Row,
    strategy_id: str | None,
    model_provider: str,
    model_name: str,
    prompt_override: str | None,
    normalized_json: dict | list | None,
) -> dict:
    prompt_template = prompt_override or strategy_row["prompt_content"] or "请返回结构化 JSON"
    response_schema = _infer_response_schema(
        sample_json=normalized_json,
        output_format=strategy_row["output_format"],
        prompt_template=prompt_template,
    )
    scene_description = " / ".join(
        item for item in [strategy_row["scene"], strategy_row["description"]] if item
    ) or strategy_row["name"]
    return {
        "id": strategy_id,
        "name": strategy_row["name"],
        "scene_description": scene_description,
        "prompt_template": prompt_template,
        "model_provider": model_provider,
        "model_name": model_name,
        "response_schema": response_schema,
        "status": "active" if str(strategy_row["status"]).lower() == "active" else "inactive",
        "version": 1,
        "is_preset": False,
        "legacy_rule_id": strategy_row["id"],
        "legacy_rule_code": strategy_row["code"],
    }


def _ensure_file_asset(
    db: Session,
    report: BackfillReport,
    *,
    source_root: Path,
    raw_path: str | None,
    asset_id: str,
    original_name: str,
    purpose: str,
    entity_label: str,
) -> tuple[str | None, str, str]:
    resolved_path = _resolve_path(source_root, raw_path)
    if resolved_path is None:
        return None, "", original_name

    absolute_path = str(resolved_path)
    mime_type = mimetypes.guess_type(absolute_path)[0] or "application/octet-stream"
    file_timestamp = _parse_filesystem_timestamp(resolved_path.stat().st_mtime) if resolved_path.exists() else None
    values = {
        "id": asset_id,
        "purpose": purpose,
        "original_name": original_name,
        "storage_path": absolute_path,
        "mime_type": mime_type,
        "created_at": file_timestamp,
        "updated_at": file_timestamp,
    }

    if resolved_path.exists():
        _upsert_model(db, report, entity_label, FileAsset, asset_id, values)
        return asset_id, absolute_path, original_name

    report.add_missing_file(absolute_path)
    return None, absolute_path, original_name


def _upsert_model(
    db: Session,
    report: BackfillReport,
    entity_label: str,
    model_cls,
    primary_key,
    values: dict,
):
    instance = db.get(model_cls, primary_key)
    if instance is None:
        instance = model_cls(**values)
        db.add(instance)
        report.bump(entity_label, "created")
        return instance

    changed = False
    for field_name, value in values.items():
        if not _values_equal(getattr(instance, field_name), value):
            setattr(instance, field_name, value)
            changed = True

    if changed:
        report.bump(entity_label, "updated")
    else:
        report.bump(entity_label, "skipped")
    return instance


def _infer_response_schema(
    *,
    sample_json: dict | list | None,
    output_format: str | None,
    prompt_template: str | None,
) -> dict:
    if sample_json is not None:
        return _infer_schema_from_value(sample_json)

    output_fields = _extract_output_fields(output_format)
    if output_fields:
        return {
            "type": "object",
            "properties": {field_name: {"type": "string"} for field_name in output_fields},
            "required": output_fields,
        }

    if prompt_template and all(token in prompt_template for token in ["结果", "描述", "总结"]):
        return {
            "type": "object",
            "properties": {
                "结果": {"type": "string"},
                "描述": {"type": "string"},
                "违规原因": {"type": "string"},
                "总结": {"type": "string"},
            },
            "required": ["结果", "描述", "总结"],
        }

    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "details": {"type": "string"},
        },
        "required": ["summary"],
    }


def _infer_schema_from_value(value):
    if isinstance(value, dict):
        properties = {
            str(key): _infer_schema_from_value(item_value)
            for key, item_value in value.items()
        }
        return {
            "type": "object",
            "properties": properties,
            "required": list(properties.keys()),
        }
    if isinstance(value, list):
        if value:
            return {"type": "array", "items": _infer_schema_from_value(value[0])}
        return {"type": "array", "items": {"type": "string"}}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, int) and not isinstance(value, bool):
        return {"type": "integer"}
    if isinstance(value, float):
        return {"type": "number"}
    if value is None:
        return {"type": "null"}
    return {"type": "string"}


def _extract_output_fields(output_format: str | None) -> list[str]:
    if not output_format:
        return []

    normalized = (
        str(output_format)
        .replace("，", ",")
        .replace("、", ",")
        .replace("；", ",")
        .replace(";", ",")
        .replace("\n", ",")
    )
    fields = [segment.strip(" -:：") for segment in normalized.split(",") if segment.strip(" -:：")]
    deduped: list[str] = []
    for field_name in fields:
        if field_name not in deduped:
            deduped.append(field_name)
    return deduped


def _extract_json_payload(value: str | None):
    if not value:
        return None

    text = str(value).strip()
    if not text:
        return None

    candidates = [text]
    if text.startswith("```"):
        stripped = text.strip("`").strip()
        if stripped.startswith("json"):
            stripped = stripped[4:].strip()
        candidates.append(stripped)

    object_start = text.find("{")
    object_end = text.rfind("}")
    if object_start != -1 and object_end != -1 and object_end > object_start:
        candidates.append(text[object_start : object_end + 1])

    array_start = text.find("[")
    array_end = text.rfind("]")
    if array_start != -1 and array_end != -1 and array_end > array_start:
        candidates.append(text[array_start : array_end + 1])

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def _collect_source_counts(source_path: Path, report: BackfillReport) -> dict[str, int]:
    conn = sqlite3.connect(str(source_path))
    try:
        counts: dict[str, int] = {}
        for table_name in SUPPORTED_SOURCE_TABLES:
            if not _table_exists(conn, table_name):
                report.add_warning(f"Legacy source table '{table_name}' is missing and will be skipped.")
                counts[table_name] = 0
                continue
            counts[table_name] = int(conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0])
        return counts
    finally:
        conn.close()


def _collect_target_counts(db: Session) -> dict[str, int]:
    counts: dict[str, int] = {}
    for table_name, model_cls in TARGET_MODELS.items():
        counts[table_name] = int(db.scalar(select(func.count()).select_from(model_cls)) or 0)
    return counts


def _load_rows(conn: sqlite3.Connection, table_name: str, report: BackfillReport) -> list[sqlite3.Row]:
    if not _table_exists(conn, table_name):
        report.add_warning(f"Legacy source table '{table_name}' is missing and will be skipped.")
        return []
    return list(conn.execute(f"SELECT * FROM {table_name} ORDER BY rowid ASC"))


def _load_key_value_json_table(
    conn: sqlite3.Connection,
    table_name: str,
    report: BackfillReport,
) -> dict[str, dict | str | list | None]:
    rows = _load_rows(conn, table_name, report)
    payload: dict[str, dict | str | list | None] = {}
    for row in rows:
        key = str(row["key"])
        value = row["value"]
        if value is None:
            payload[key] = None
            continue
        try:
            payload[key] = json.loads(value)
        except json.JSONDecodeError:
            payload[key] = value
    return payload


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def _rows_by_id(rows: list[sqlite3.Row]) -> dict[int, sqlite3.Row]:
    return {int(row["id"]): row for row in rows if row["id"] is not None}


def _group_rows_by_key(rows: list[sqlite3.Row], key: str) -> dict[int, list[sqlite3.Row]]:
    grouped: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for row in rows:
        if row[key] is None:
            continue
        grouped[int(row[key])].append(row)
    return grouped


def _resolve_source_root(source_path: Path, source_root: str | Path | None) -> Path:
    if source_root is not None:
        return Path(source_root).expanduser().resolve()
    if source_path.parent.name == "data":
        return source_path.parent.parent.resolve()
    return source_path.parent.resolve()


def _resolve_path(source_root: Path, raw_path: str | None) -> Path | None:
    if not raw_path:
        return None
    path = Path(str(raw_path))
    if path.is_absolute():
        return path.resolve()
    return (source_root / path).resolve()


def _resolve_existing_path_or_none(
    *,
    report: BackfillReport,
    source_root: Path,
    raw_path: str | None,
) -> str | None:
    resolved = _resolve_path(source_root, raw_path)
    if resolved is None:
        return None
    if not resolved.exists():
        report.add_missing_file(str(resolved))
    return str(resolved)


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        parsed = datetime.strptime(text, "%Y-%m-%d %H:%M:%S")
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _uuid_from_legacy(entity: str, *parts) -> str:
    payload = "::".join([entity, *[str(part) for part in parts]])
    return str(uuid.uuid5(LEGACY_NAMESPACE, payload))


def _infer_provider_name(model_name: str | None, default_provider: str) -> str:
    if not model_name:
        return default_provider
    normalized = str(model_name).lower()
    if normalized.startswith("glm") or "zhipu" in normalized:
        return "zhipu"
    if normalized.startswith("gpt") or normalized.startswith("o1") or normalized.startswith("o3"):
        return "openai"
    return default_provider


def _default_display_name_for_provider(provider_name: str) -> str:
    normalized = provider_name.lower()
    if normalized == "openai":
        return "OpenAI"
    if normalized == "zhipu":
        return "智谱"
    return provider_name.upper()


def _default_base_url_for_provider(provider_name: str) -> str:
    normalized = provider_name.lower()
    if normalized == "openai":
        return "https://api.openai.com/v1/responses"
    if normalized == "zhipu":
        return "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    return ""


def _safe_path_segment(value: str) -> str:
    cleaned = "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in value.strip())
    return cleaned.strip("-") or "legacy"


def _parse_filesystem_timestamp(value: float) -> datetime:
    return datetime.fromtimestamp(value, tz=timezone.utc)


def _values_equal(left, right) -> bool:
    if isinstance(left, datetime) and isinstance(right, datetime):
        return _normalize_datetime(left) == _normalize_datetime(right)
    return left == right


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
