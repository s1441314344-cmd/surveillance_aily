#!/usr/bin/env python3
"""
独立版智能巡检系统 API

运行:
    python3 api_server.py
"""

import base64
import io
import os
import re
import sys
import uuid
import json
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

sys.path.append(os.getcwd())

from app.config import config
from app.services.db import (
    CameraService,
    Database,
    InspectionTaskService,
    RecordService,
    RuleService,
    SettingService,
    SubmitTaskService,
    WorkOrderService,
    PromptTemplateService,
)
from app.services.local_detect_service import LocalDetectService
from app.services.llm_service import LLMService


BASE_DIR = Path(os.getcwd()).resolve()
UPLOAD_DIR = (BASE_DIR / "uploads").resolve()
DETECTIONS_DIR = (BASE_DIR / "data" / "detections").resolve()
PROCESSING_DIR = (BASE_DIR / "data" / "processing").resolve()
STATIC_DIR = (BASE_DIR / "webapp").resolve()
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "webp"}

for path in [UPLOAD_DIR, DETECTIONS_DIR, PROCESSING_DIR, STATIC_DIR]:
    os.makedirs(path, exist_ok=True)

Database.init_db()

YOLO_AVAILABLE = False
try:
    import torch
    from ultralytics import YOLO  # noqa: F401

    YOLO_AVAILABLE = True
    print(f"[API] Torch可用, CUDA: {torch.cuda.is_available()}")
except Exception as exc:
    print(f"[API] YOLO不可用，将仅使用智谱大模型分析: {exc}")

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = config.upload_limit_mb * 1024 * 1024
CORS(app)

scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
scheduler.start()


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def resolve_public_file(file_path: str):
    if not file_path:
        return None
    target = Path(file_path)
    if not target.is_absolute():
        target = (BASE_DIR / target).resolve()
    else:
        target = target.resolve()
    allowed_roots = [UPLOAD_DIR, DETECTIONS_DIR, PROCESSING_DIR, (BASE_DIR / "screenshot").resolve()]
    for root in allowed_roots:
        try:
            target.relative_to(root)
            return target
        except ValueError:
            continue
    return None


def build_file_url(file_path: str):
    return f"/api/files?path={quote(file_path)}" if file_path else None


def enrich_record(record: dict):
    if not record:
        return None
    enriched = dict(record)
    enriched["image_url"] = build_file_url(enriched.get("image_path"))
    enriched["result_image_url"] = build_file_url(enriched.get("result_image_path"))
    return enriched


def enrich_work_order(work_order: dict):
    if not work_order:
        return None
    enriched = dict(work_order)
    enriched["processing_image_url"] = build_file_url(enriched.get("processing_image_path"))
    return enriched


def save_binary(content: bytes, folder: Path, prefix: str, original_name: str = "image.jpg") -> str:
    suffix = Path(original_name).suffix or ".jpg"
    filename = f"{prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{suffix}"
    path = folder / filename
    with open(path, "wb") as file:
        file.write(content)
    return str(path.relative_to(BASE_DIR))


def get_llm_runtime(model_override: str = None):
    runtime = SettingService.get("llm_runtime", {}) or {}
    model_name = model_override or runtime.get("model_name") or config.zhipu_model
    base_url = runtime.get("base_url") or LLMService.ZHIPU_API_URL
    api_key = runtime.get("api_key") or config.zhipu_api_key
    provider = runtime.get("provider") or "zhipu"
    return {
        "provider": provider,
        "model_name": model_name,
        "base_url": base_url,
        "api_key": api_key,
    }


def parse_structured_result(raw_text: str):
    if not raw_text:
        return None
    stripped = raw_text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", stripped)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def parse_analysis(rule: dict, image_path: str, model_override: str = None) -> dict:
    prompt = rule["prompt_content"]
    llm_result = None
    analysis_summary = None
    severity = "normal"
    has_violation = False
    structured_output = None

    system_settings = SettingService.get("system", {})
    timeout_seconds = int(system_settings.get("llm_timeout_seconds", config.llm_timeout_seconds))

    runtime = get_llm_runtime(model_override)

    if runtime["api_key"]:
        with open(BASE_DIR / image_path, "rb") as file:
            image_b64 = base64.b64encode(file.read()).decode("utf-8")
        llm_response = LocalDetectService.detect_with_llm_base64(
            image_base64=image_b64,
            prompt=prompt,
            api_key=runtime["api_key"],
            model=runtime["model_name"],
            timeout=timeout_seconds,
            base_url=runtime["base_url"],
        )
        if llm_response.get("success"):
            llm_result = llm_response.get("analysis", "")
            standard_format = LocalDetectService.parse_standard_format(llm_result)
            structured_output = {
                "结果": standard_format.get("结果", ""),
                "描述": standard_format.get("描述", ""),
                "违规原因": standard_format.get("违规原因", "无"),
                "总结": standard_format.get("总结", "")
            }
            has_violation = standard_format.get("has_violation", False)
            analysis_summary = standard_format.get("描述") or standard_format.get("结果", "")[:160]
            if has_violation:
                severity = "high"
            else:
                severity = "normal"
        else:
            llm_result = f"模型调用失败: {llm_response.get('error')}"
            analysis_summary = "模型调用失败"
            severity = "high"
    else:
        llm_result = "未配置智谱 API Key，暂未执行图像分析。"
        analysis_summary = "模型未配置"

    return {
        "prompt_snapshot": prompt,
        "llm_result": llm_result,
        "analysis_summary": analysis_summary,
        "analysis_model": runtime["model_name"],
        "severity": severity,
        "has_violation": has_violation,
        "structured_output": json.dumps(structured_output, ensure_ascii=False) if structured_output else None,
    }


def capture_camera_frame(rtsp_url: str, camera_id: int, resolution: str = "original", quality: int = 80, max_retries: int = 3):
    import cv2

    last_error = None
    for attempt in range(max_retries):
        cap = cv2.VideoCapture(rtsp_url)
        if not cap.isOpened():
            last_error = f"尝试 {attempt + 1}/{max_retries}: 无法连接摄像头，请检查 RTSP 地址是否可达"
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            raise ValueError(last_error)

        try:
            ret, frame = cap.read()
            if not ret:
                last_error = f"尝试 {attempt + 1}/{max_retries}: 摄像头已连接，但未读取到视频帧"
                cap.release()
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                raise ValueError(last_error)

            if resolution != "original":
                target_sizes = {
                    "720p": (1280, 720),
                    "1080p": (1920, 1080),
                    "4k": (3840, 2160),
                }
                if resolution in target_sizes:
                    frame = cv2.resize(frame, target_sizes[resolution])

            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
            _, buffer = cv2.imencode('.jpg', frame, encode_param)

            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"camera_{camera_id}_{timestamp}.jpg"
            frame_path = DETECTIONS_DIR / filename

            with open(frame_path, 'wb') as f:
                f.write(buffer)

            return str(frame_path.relative_to(BASE_DIR))
        finally:
            cap.release()

    raise ValueError(last_error)


def maybe_generate_result_image(image_path: str):
    if not YOLO_AVAILABLE:
        return None
    yolo_result = LocalDetectService.detect_with_yolo(str(BASE_DIR / image_path))
    if yolo_result.get("success") and yolo_result.get("detections"):
        result_path = LocalDetectService.draw_detection_results(
            str(BASE_DIR / image_path),
            yolo_result["detections"],
            str(DETECTIONS_DIR / f"result_{Path(image_path).name}"),
        )
        return str(Path(result_path).resolve().relative_to(BASE_DIR))
    return None


def auto_create_enabled(task_auto_create: bool = None) -> bool:
    system_settings = SettingService.get("system", {})
    default_value = system_settings.get("auto_create_work_order", config.default_auto_create_work_order)
    return default_value if task_auto_create is None else bool(task_auto_create)


def create_work_order_for_record(record: dict, assignee: str = None, priority: str = "medium"):
    existing = WorkOrderService.get_by_record_id(record["id"])
    if existing:
        return existing
    title = f"{record.get('rule_name', '巡检规则')} 异常处理工单"
    description = record.get("analysis_summary") or "识别结果存在异常，请尽快处理。"
    return WorkOrderService.create(
        record_id=record["id"],
        title=title,
        description=description,
        priority=priority,
        assignee=assignee,
    )


def persist_detection(
    *,
    image_path: str,
    rule: dict,
    camera: dict = None,
    source_type: str,
    auto_create_work_order: bool = None,
    model_override: str = None,
):
    result_image_path = maybe_generate_result_image(image_path)
    analysis = parse_analysis(rule, image_path, model_override=model_override)
    record = RecordService.create(
        camera_id=camera["id"] if camera else None,
        rule_id=rule["id"],
        source_type=source_type,
        image_path=image_path,
        result_image_path=result_image_path,
        llm_result=analysis["llm_result"],
        analysis_summary=analysis["analysis_summary"],
        prompt_snapshot=analysis["prompt_snapshot"],
        analysis_model=analysis["analysis_model"],
        severity=analysis["severity"],
        has_violation=analysis["has_violation"],
        structured_output=analysis.get("structured_output"),
    )
    work_order = None
    if record["has_violation"] and auto_create_enabled(auto_create_work_order):
        work_order = create_work_order_for_record(record)
    return enrich_record(record), enrich_work_order(work_order)


def cleanup_old_frames(storage_path: str = None, max_frames: int = 1000):
    if not storage_path:
        storage_path = str(DETECTIONS_DIR)

    try:
        files = []
        for f in Path(storage_path).glob("camera_*.jpg"):
            if f.is_file():
                files.append((f.stat().st_mtime, str(f)))
        files.sort()

        if len(files) > max_frames:
            for _, file_path in files[:len(files) - max_frames]:
                try:
                    os.remove(file_path)
                except Exception:
                    pass
    except Exception:
        pass


def run_task(task_id: int):
    task = InspectionTaskService.get_by_id(task_id)
    if not task or task["status"] != "active":
        return

    next_run_time = (datetime.now() + timedelta(seconds=int(task["frequency_seconds"]))).strftime("%Y-%m-%d %H:%M:%S")

    try:
        camera = CameraService.get_by_id(task["camera_id"])
        rule = RuleService.get_by_id(task["rule_id"])
        if not camera or not camera.get("rtsp_url"):
            raise ValueError("任务关联摄像头不存在或未配置 RTSP 地址")
        if not rule:
            raise ValueError("任务关联规则不存在")

        resolution = task.get("resolution", "original")
        quality = task.get("quality", 80)
        max_frames = task.get("max_frames", 1000)
        storage_path = task.get("storage_path")

        image_path = capture_camera_frame(
            camera["rtsp_url"],
            camera["id"],
            resolution=resolution,
            quality=quality
        )

        if storage_path:
            cleanup_old_frames(storage_path, max_frames)
        else:
            cleanup_old_frames(str(DETECTIONS_DIR), max_frames)

        record, work_order = persist_detection(
            image_path=image_path,
            rule=rule,
            camera=camera,
            source_type="task",
            auto_create_work_order=bool(task["auto_create_work_order"]),
        )
        InspectionTaskService.update(
            task_id,
            last_run_time=now_text(),
            next_run_time=next_run_time,
            last_record_id=record["id"],
            last_error=None,
        )
        return {"record": record, "work_order": work_order}
    except Exception as exc:
        InspectionTaskService.update(
            task_id,
            last_run_time=now_text(),
            next_run_time=next_run_time,
            last_error=str(exc),
        )
        raise


def sync_scheduler():
    active_task_ids = set()
    for task in InspectionTaskService.get_active():
        job_id = f"inspection_task_{task['id']}"
        active_task_ids.add(job_id)
        existing = scheduler.get_job(job_id)
        kwargs = {"id": job_id, "replace_existing": True}
        if existing:
            existing.remove()
        scheduler.add_job(
            run_task,
            "interval",
            seconds=max(10, int(task["frequency_seconds"])),
            args=[task["id"]],
            **kwargs,
        )

    for job in scheduler.get_jobs():
        if job.id.startswith("inspection_task_") and job.id not in active_task_ids:
            scheduler.remove_job(job.id)


sync_scheduler()


@app.route("/")
def index():
    return send_file(STATIC_DIR / "index.html")


@app.route("/api/files")
def serve_file():
    file_path = request.args.get("path")
    if not file_path:
        return jsonify({"success": False, "error": "缺少 path 参数"}), 400
    resolved = resolve_public_file(file_path)
    if not resolved or not resolved.exists():
        return jsonify({"success": False, "error": "文件不存在或不可访问"}), 404
    return send_file(resolved)


@app.route("/api/health")
def health():
    return jsonify(
        {
            "success": True,
            "version": "6.0.0",
            "mode": "independent",
            "timestamp": datetime.now().isoformat(),
            "features": {
                "database": "sqlite",
                "llm_provider": "zhipu",
                "llm_model": config.zhipu_model,
                "llm_configured": bool(config.zhipu_api_key),
                "yolo": YOLO_AVAILABLE,
                "scheduler_running": scheduler.running,
            },
        }
    )


@app.route("/api/dashboard")
def dashboard():
    stats = RecordService.get_dashboard_stats()
    stats["latest_records"] = [enrich_record(item) for item in stats["latest_records"]]
    stats["latest_work_orders"] = [enrich_work_order(item) for item in WorkOrderService.get_all()[:5]]
    return jsonify({"success": True, "data": stats})


@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify({"success": True, "data": SettingService.get_all()})


@app.route("/api/settings", methods=["PUT"])
def update_settings():
    payload = request.get_json(force=True)
    updated = {}
    for key, value in payload.items():
        updated[key] = SettingService.set(key, value)
    return jsonify({"success": True, "data": updated, "message": "设置更新成功"})


@app.route("/api/settings/llm")
def llm_settings():
    system_settings = SettingService.get("system", {})
    runtime = get_llm_runtime()
    return jsonify(
        {
            "success": True,
            "data": {
                "provider": runtime["provider"],
                "model": runtime["model_name"],
                "base_url": runtime["base_url"],
                "configured": bool(runtime["api_key"]),
                "api_key_masked": f"{runtime['api_key'][:6]}***" if runtime["api_key"] else None,
                "timeout_seconds": system_settings.get("llm_timeout_seconds", config.llm_timeout_seconds),
            },
        }
    )


@app.route("/api/models", methods=["GET"])
def get_model_config():
    runtime = get_llm_runtime()
    return jsonify(
        {
            "success": True,
            "data": {
                "provider": runtime["provider"],
                "model_name": runtime["model_name"],
                "base_url": runtime["base_url"],
                "api_key": runtime["api_key"] or "",
            },
        }
    )


@app.route("/api/models", methods=["PUT"])
def update_model_config():
    payload = request.get_json(force=True)
    current = get_llm_runtime()
    updated = {
        "provider": payload.get("provider", current["provider"]),
        "model_name": payload.get("model_name", current["model_name"]),
        "base_url": payload.get("base_url", current["base_url"]),
        "api_key": payload.get("api_key", current["api_key"]),
    }
    SettingService.set("llm_runtime", updated)
    return jsonify({"success": True, "data": {"provider": updated["provider"], "model_name": updated["model_name"], "base_url": updated["base_url"]}, "message": "模型配置已更新"})


@app.route("/api/cameras", methods=["GET"])
def get_cameras():
    cameras = CameraService.get_all()
    return jsonify({"success": True, "data": cameras, "count": len(cameras)})


@app.route("/api/cameras/<int:camera_id>", methods=["GET"])
def get_camera(camera_id):
    camera = CameraService.get_by_id(camera_id)
    if not camera:
        return jsonify({"success": False, "error": "摄像头不存在"}), 404
    return jsonify({"success": True, "data": camera})


@app.route("/api/cameras", methods=["POST"])
def create_camera():
    data = request.get_json(force=True)
    if not data.get("code") or not data.get("name"):
        return jsonify({"success": False, "error": "摄像头编码和名称为必填项"}), 400
    camera = CameraService.create(
        code=data["code"],
        name=data["name"],
        rtsp_url=data.get("rtsp_url"),
        location=data.get("location"),
        frequency=int(data.get("frequency") or 60),
    )
    return jsonify({"success": True, "data": camera, "message": "摄像头创建成功"})


@app.route("/api/cameras/<int:camera_id>", methods=["PUT"])
def update_camera(camera_id):
    camera = CameraService.update(camera_id, **request.get_json(force=True))
    if not camera:
        return jsonify({"success": False, "error": "摄像头不存在"}), 404
    return jsonify({"success": True, "data": camera, "message": "摄像头更新成功"})


@app.route("/api/cameras/<int:camera_id>", methods=["DELETE"])
def delete_camera(camera_id):
    if not CameraService.delete(camera_id):
        return jsonify({"success": False, "error": "摄像头不存在"}), 404
    return jsonify({"success": True, "message": "摄像头删除成功"})


@app.route("/api/rules", methods=["GET"])
def get_rules():
    rules = RuleService.get_all()
    return jsonify({"success": True, "data": rules, "count": len(rules)})


@app.route("/api/rules/<int:rule_id>", methods=["GET"])
def get_rule(rule_id):
    rule = RuleService.get_by_id(rule_id)
    if not rule:
        return jsonify({"success": False, "error": "规则不存在"}), 404
    return jsonify({"success": True, "data": rule})


@app.route("/api/rules", methods=["POST"])
def create_rule():
    data = request.get_json(force=True)
    required = [data.get("code"), data.get("name"), data.get("scene"), data.get("prompt_content")]
    if not all(required):
        return jsonify({"success": False, "error": "规则编码、名称、分析场景、提示词为必填项"}), 400
    rule = RuleService.create(
        code=data["code"],
        name=data["name"],
        scene=data["scene"],
        prompt_content=data["prompt_content"],
        output_format=data.get("output_format"),
        description=data.get("description"),
    )
    return jsonify({"success": True, "data": rule, "message": "规则创建成功"})


@app.route("/api/rules/<int:rule_id>", methods=["PUT"])
def update_rule(rule_id):
    rule = RuleService.update(rule_id, **request.get_json(force=True))
    if not rule:
        return jsonify({"success": False, "error": "规则不存在"}), 404
    return jsonify({"success": True, "data": rule, "message": "规则更新成功"})


@app.route("/api/rules/<int:rule_id>", methods=["DELETE"])
def delete_rule(rule_id):
    if not RuleService.delete(rule_id):
        return jsonify({"success": False, "error": "规则不存在"}), 404
    return jsonify({"success": True, "message": "规则删除成功"})


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    return jsonify({"success": True, "data": InspectionTaskService.get_all()})


@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json(force=True)
    required = [data.get("name"), data.get("camera_id"), data.get("rule_id"), data.get("frequency_seconds")]
    if not all(required):
        return jsonify({"success": False, "error": "任务名称、摄像头、规则、频率为必填项"}), 400

    frequency = max(10, int(data.get("frequency_seconds", 60)))
    resolution = data.get("resolution", "original")
    quality = int(data.get("quality", 80))
    max_frames = int(data.get("max_frames", 1000))
    storage_path = data.get("storage_path")

    task = InspectionTaskService.create(
        name=data["name"],
        camera_id=int(data["camera_id"]),
        rule_id=int(data["rule_id"]),
        frequency_seconds=frequency,
        auto_create_work_order=bool(data.get("auto_create_work_order", True)),
        status=data.get("status", "active"),
        resolution=resolution,
        quality=quality,
        storage_path=storage_path,
        max_frames=max_frames,
    )
    sync_scheduler()
    return jsonify({"success": True, "data": task, "message": "任务创建成功"})


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    payload = request.get_json(force=True)
    task = InspectionTaskService.update(task_id, **payload)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404
    sync_scheduler()
    return jsonify({"success": True, "data": task, "message": "任务更新成功"})


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    if not InspectionTaskService.delete(task_id):
        return jsonify({"success": False, "error": "任务不存在"}), 404
    sync_scheduler()
    return jsonify({"success": True, "message": "任务删除成功"})


@app.route("/api/tasks/<int:task_id>/run", methods=["POST"])
def run_task_once(task_id):
    try:
        result = run_task(task_id)
        return jsonify({"success": True, "data": result, "message": "任务执行成功"})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/records", methods=["GET"])
def get_records():
    result = RecordService.get_all(
        page=request.args.get("page", 1, type=int),
        page_size=request.args.get("page_size", 20, type=int),
        camera_id=request.args.get("camera_id", type=int),
        rule_id=request.args.get("rule_id", type=int),
        work_order_status=request.args.get("work_order_status"),
        start_time=request.args.get("start_time"),
        end_time=request.args.get("end_time"),
    )
    result["records"] = [enrich_record(item) for item in result["records"]]
    return jsonify({"success": True, "data": result})


@app.route("/api/records/<int:record_id>", methods=["GET"])
def get_record(record_id):
    record = RecordService.get_by_id(record_id)
    if not record:
        return jsonify({"success": False, "error": "记录不存在"}), 404
    work_order = WorkOrderService.get_by_record_id(record_id)
    return jsonify({"success": True, "data": {"record": enrich_record(record), "work_order": enrich_work_order(work_order)}})


@app.route("/api/records/<int:record_id>", methods=["DELETE"])
def delete_record(record_id):
    if not RecordService.delete(record_id):
        return jsonify({"success": False, "error": "记录不存在"}), 404
    return jsonify({"success": True, "message": "记录删除成功"})


@app.route("/api/records/export", methods=["GET"])
def export_records():
    csv_content = RecordService.export_csv(
        camera_id=request.args.get("camera_id", type=int),
        rule_id=request.args.get("rule_id", type=int),
        work_order_status=request.args.get("work_order_status"),
        start_time=request.args.get("start_time"),
        end_time=request.args.get("end_time"),
    )
    filename = f"detection_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return send_file(io.BytesIO(csv_content.encode("utf-8-sig")), mimetype="text/csv", as_attachment=True, download_name=filename)


@app.route("/api/work-orders", methods=["GET"])
def get_work_orders():
    status = request.args.get("status")
    data = [enrich_work_order(item) for item in WorkOrderService.get_all(status=status)]
    return jsonify({"success": True, "data": data})


@app.route("/api/work-orders/<int:work_order_id>", methods=["GET"])
def get_work_order(work_order_id):
    work_order = WorkOrderService.get_by_id(work_order_id)
    if not work_order:
        return jsonify({"success": False, "error": "工单不存在"}), 404
    return jsonify({"success": True, "data": enrich_work_order(work_order)})


@app.route("/api/work-orders", methods=["POST"])
def create_work_order():
    data = request.get_json(force=True)
    record_id = data.get("record_id")
    if not record_id:
        return jsonify({"success": False, "error": "record_id 为必填项"}), 400
    record = RecordService.get_by_id(int(record_id))
    if not record:
        return jsonify({"success": False, "error": "来源记录不存在"}), 404
    work_order = create_work_order_for_record(record, assignee=data.get("assignee"), priority=data.get("priority", "medium"))
    return jsonify({"success": True, "data": enrich_work_order(work_order), "message": "工单创建成功"})


@app.route("/api/work-orders/<int:work_order_id>", methods=["PUT"])
def update_work_order(work_order_id):
    payload = {}
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        payload["title"] = request.form.get("title")
        payload["description"] = request.form.get("description")
        payload["priority"] = request.form.get("priority")
        payload["assignee"] = request.form.get("assignee")
        payload["status"] = request.form.get("status")
        payload["processing_note"] = request.form.get("processing_note")
        if payload.get("status") == "closed":
            payload["closed_at"] = now_text()
        file = request.files.get("processing_image")
        if file and file.filename and allowed_file(file.filename):
            payload["processing_image_path"] = save_binary(file.read(), PROCESSING_DIR, "work_order", file.filename)
    else:
        payload = request.get_json(force=True)
        if payload.get("status") == "closed" and not payload.get("closed_at"):
            payload["closed_at"] = now_text()
    work_order = WorkOrderService.update(work_order_id, **payload)
    if not work_order:
        return jsonify({"success": False, "error": "工单不存在"}), 404
    return jsonify({"success": True, "data": enrich_work_order(work_order), "message": "工单更新成功"})


@app.route("/api/work-orders/<int:work_order_id>", methods=["DELETE"])
def delete_work_order(work_order_id):
    if not WorkOrderService.delete(work_order_id):
        return jsonify({"success": False, "error": "工单不存在"}), 404
    return jsonify({"success": True, "message": "工单删除成功"})


@app.route("/api/upload", methods=["POST"])
def upload_only():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "没有接收到文件"}), 400
    file = request.files["file"]
    if not file.filename or not allowed_file(file.filename):
        return jsonify({"success": False, "error": "不支持的文件类型"}), 400
    image_path = save_binary(file.read(), UPLOAD_DIR, "upload", file.filename)
    return jsonify({"success": True, "data": {"image_path": image_path, "image_url": build_file_url(image_path)}})


@app.route("/api/detect", methods=["POST"])
def detect_upload():
    image_data = None
    original_name = "upload.jpg"
    auto_create_work_order = None
    model_name = None

    if "image" in request.files:
        file = request.files["image"]
        if not file.filename or not allowed_file(file.filename):
            return jsonify({"success": False, "error": "请上传 JPG/PNG/BMP/WEBP 图片"}), 400
        image_data = file.read()
        original_name = file.filename
        rule_id = request.form.get("rule_id", type=int)
        camera_id = request.form.get("camera_id", type=int)
        if request.form.get("auto_create_work_order") is not None:
            auto_create_work_order = request.form.get("auto_create_work_order") == "true"
        model_name = request.form.get("model_name")
    else:
        payload = request.get_json(silent=True) or {}
        image_base64 = payload.get("image_base64")
        if image_base64:
            image_data = base64.b64decode(image_base64)
        rule_id = payload.get("rule_id")
        camera_id = payload.get("camera_id")
        auto_create_work_order = payload.get("auto_create_work_order")
        model_name = payload.get("model_name")

    if not image_data:
        return jsonify({"success": False, "error": "请提供待检测图片"}), 400
    if not rule_id:
        return jsonify({"success": False, "error": "请选择巡检规则"}), 400

    rule = RuleService.get_by_id(int(rule_id))
    if not rule:
        return jsonify({"success": False, "error": "规则不存在"}), 404
    camera = CameraService.get_by_id(int(camera_id)) if camera_id else None
    image_path = save_binary(image_data, DETECTIONS_DIR, "detect", original_name)
    record, work_order = persist_detection(
        image_path=image_path,
        rule=rule,
        camera=camera,
        source_type="upload",
        auto_create_work_order=auto_create_work_order,
        model_override=model_name,
    )
    return jsonify({"success": True, "data": {"record": record, "work_order": work_order}})


@app.route("/api/detect/camera/<int:camera_id>", methods=["POST"])
def detect_camera(camera_id):
    camera = CameraService.get_by_id(camera_id)
    if not camera:
        return jsonify({"success": False, "error": "摄像头不存在"}), 404
    if not camera.get("rtsp_url"):
        return jsonify({"success": False, "error": "该摄像头未配置 RTSP 地址"}), 400
    payload = request.get_json(silent=True) or {}
    rule_id = payload.get("rule_id")
    model_name = payload.get("model_name")
    if not rule_id:
        return jsonify({"success": False, "error": "请选择巡检规则"}), 400
    rule = RuleService.get_by_id(int(rule_id))
    if not rule:
        return jsonify({"success": False, "error": "规则不存在"}), 404
    image_path = capture_camera_frame(camera["rtsp_url"], camera_id)
    record, work_order = persist_detection(
        image_path=image_path,
        rule=rule,
        camera=camera,
        source_type="camera",
        auto_create_work_order=payload.get("auto_create_work_order"),
        model_override=model_name,
    )
    return jsonify({"success": True, "data": {"record": record, "work_order": work_order}})


@app.route("/api/submit-tasks", methods=["GET"])
def get_submit_tasks():
    items = SubmitTaskService.get_all(limit=request.args.get("limit", 50, type=int))
    for item in items:
        item["image_url_1"] = build_file_url(item.get("image_path_1"))
        item["image_url_2"] = build_file_url(item.get("image_path_2"))
    return jsonify({"success": True, "data": items})


@app.route("/api/submit-task", methods=["POST"])
def submit_task():
    if "image_1" not in request.files or "image_2" not in request.files:
        return jsonify({"success": False, "error": "请上传两张图片：image_1 和 image_2"}), 400

    image_1 = request.files["image_1"]
    image_2 = request.files["image_2"]
    if not image_1.filename or not image_2.filename:
        return jsonify({"success": False, "error": "请选择两张图片"}), 400
    if not allowed_file(image_1.filename) or not allowed_file(image_2.filename):
        return jsonify({"success": False, "error": "仅支持 JPG/PNG/BMP/WEBP"}), 400

    rule_id = request.form.get("rule_id", type=int)
    model_name = request.form.get("model_name")
    if not rule_id:
        return jsonify({"success": False, "error": "请选择规则"}), 400
    rule = RuleService.get_by_id(rule_id)
    if not rule:
        return jsonify({"success": False, "error": "规则不存在"}), 404

    image_path_1 = save_binary(image_1.read(), DETECTIONS_DIR, "submit_1", image_1.filename)
    image_path_2 = save_binary(image_2.read(), DETECTIONS_DIR, "submit_2", image_2.filename)

    runtime = get_llm_runtime(model_override=model_name)
    if not runtime["api_key"]:
        return jsonify({"success": False, "error": "模型 API Key 未配置，请先在模型配置中设置"}), 400

    with open(BASE_DIR / image_path_1, "rb") as file_1:
        image_b64_1 = base64.b64encode(file_1.read()).decode("utf-8")
    with open(BASE_DIR / image_path_2, "rb") as file_2:
        image_b64_2 = base64.b64encode(file_2.read()).decode("utf-8")

    prompt = (
        f"{rule['prompt_content']}\n\n"
        "请结合两张图片进行对比分析，并严格返回 JSON，格式如下："
        "{\"has_violation\": bool, \"risk_level\": \"low|medium|high\", \"summary\": string, "
        "\"issues\": [string], \"suggestions\": [string], \"evidence\": [string]}。"
        "不要输出任何 JSON 之外的内容。"
    )
    llm_response = LLMService.analyze_images_base64(
        image_base64_list=[image_b64_1, image_b64_2],
        prompt=prompt,
        api_key=runtime["api_key"],
        model=runtime["model_name"],
        base_url=runtime["base_url"],
        timeout=config.llm_timeout_seconds,
    )
    if not llm_response.get("success"):
        saved = SubmitTaskService.create(
            rule_id=rule_id,
            model_name=runtime["model_name"],
            image_path_1=image_path_1,
            image_path_2=image_path_2,
            llm_raw_result=llm_response.get("error"),
            llm_structured_result=None,
            status="failed",
            error_message=llm_response.get("error"),
        )
        return jsonify({"success": False, "error": llm_response.get("error"), "data": saved}), 500

    raw_result = llm_response.get("result", "")
    structured_result = parse_structured_result(raw_result)
    if structured_result is None:
        structured_result = {
            "has_violation": False,
            "risk_level": "medium",
            "summary": "模型返回未严格遵守 JSON，已保存原始结果。",
            "issues": [],
            "suggestions": [],
            "evidence": [],
            "raw_text": raw_result,
        }

    saved = SubmitTaskService.create(
        rule_id=rule_id,
        model_name=runtime["model_name"],
        image_path_1=image_path_1,
        image_path_2=image_path_2,
        llm_raw_result=raw_result,
        llm_structured_result=structured_result,
        status="success",
        error_message=None,
    )
    saved["image_url_1"] = build_file_url(saved.get("image_path_1"))
    saved["image_url_2"] = build_file_url(saved.get("image_path_2"))
    return jsonify({"success": True, "data": saved, "message": "任务提交成功"})


@app.route("/api/prompt-templates", methods=["GET"])
def get_prompt_templates():
    result = PromptTemplateService.get_all(
        category=request.args.get("category"),
        search=request.args.get("search"),
        sort=request.args.get("sort", "name"),
        order=request.args.get("order", "asc"),
        page=request.args.get("page", 1, type=int),
        page_size=request.args.get("page_size", 20, type=int),
    )
    return jsonify({"success": True, "data": result})


@app.route("/api/prompt-templates/<int:template_id>", methods=["GET"])
def get_prompt_template(template_id):
    template = PromptTemplateService.get_by_id(template_id)
    if not template:
        return jsonify({"success": False, "error": "模板不存在"}), 404
    return jsonify({"success": True, "data": template})


@app.route("/api/prompt-templates", methods=["POST"])
def create_prompt_template():
    data = request.get_json(force=True)
    required = [data.get("code"), data.get("name"), data.get("category"), data.get("prompt_content")]
    if not all(required):
        return jsonify({"success": False, "error": "模板编码、名称、分类、提示词内容为必填项"}), 400

    existing = PromptTemplateService.get_by_code(data["code"])
    if existing:
        return jsonify({"success": False, "error": "模板编码已存在"}), 400

    template = PromptTemplateService.create(
        code=data["code"],
        name=data["name"],
        category=data["category"],
        prompt_content=data["prompt_content"],
        description=data.get("description"),
        is_system=False,
    )
    return jsonify({"success": True, "data": template, "message": "模板创建成功"})


@app.route("/api/prompt-templates/<int:template_id>", methods=["PUT"])
def update_prompt_template(template_id):
    template = PromptTemplateService.get_by_id(template_id)
    if not template:
        return jsonify({"success": False, "error": "模板不存在"}), 404

    if template.get("is_system"):
        return jsonify({"success": False, "error": "系统预设模板不可修改"}), 403

    updated = PromptTemplateService.update(template_id, **request.get_json(force=True))
    return jsonify({"success": True, "data": updated, "message": "模板更新成功"})


@app.route("/api/prompt-templates/<int:template_id>", methods=["DELETE"])
def delete_prompt_template(template_id):
    template = PromptTemplateService.get_by_id(template_id)
    if not template:
        return jsonify({"success": False, "error": "模板不存在"}), 404

    if template.get("is_system"):
        return jsonify({"success": False, "error": "系统预设模板不可删除"}), 403

    PromptTemplateService.delete(template_id)
    return jsonify({"success": True, "message": "模板删除成功"})


@app.route("/api/prompt-templates/categories", methods=["GET"])
def get_template_categories():
    categories = PromptTemplateService.get_categories()
    return jsonify({"success": True, "data": categories})


@app.route("/api/prompt-templates/recommend", methods=["GET"])
def get_recommended_templates():
    limit = request.args.get("limit", 5, type=int)
    templates = PromptTemplateService.get_recommended(limit=limit)
    return jsonify({"success": True, "data": templates})


@app.route("/api/prompt-templates/optimize", methods=["POST"])
def optimize_template():
    data = request.get_json(force=True)
    template_id = data.get("template_id")
    if not template_id:
        return jsonify({"success": False, "error": "template_id 为必填项"}), 400

    template = PromptTemplateService.get_by_id(template_id)
    if not template:
        return jsonify({"success": False, "error": "模板不存在"}), 404

    suggestions = []
    suggestions.append({
        "type": "content_optimization",
        "suggestion": "建议在提示词中明确要求输出标准四字段格式",
        "priority": "high"
    })

    if template.get("usage_count", 0) > 0:
        success_rate = template.get("success_rate", 0)
        if success_rate < 70:
            suggestions.append({
                "type": "success_rate_improvement",
                "suggestion": "当前模板成功率较低，建议优化提示词表述，增加更明确的判断标准",
                "priority": "medium"
            })

    return jsonify({
        "success": True,
        "data": {
            "template_id": template_id,
            "template_name": template.get("name"),
            "usage_count": template.get("usage_count", 0),
            "success_rate": template.get("success_rate", 0),
            "suggestions": suggestions
        }
    })


@app.route("/api/prompt-templates/export", methods=["GET"])
def export_templates():
    template_ids = request.args.getlist("ids", type=int)
    templates = PromptTemplateService.export_templates(template_ids if template_ids else None)
    return jsonify({"success": True, "data": templates})


@app.route("/api/prompt-templates/import", methods=["POST"])
def import_templates():
    data = request.get_json(force=True)
    templates = data.get("templates", [])
    overwrite = data.get("overwrite", False)

    if not templates:
        return jsonify({"success": False, "error": "请提供要导入的模板数据"}), 400

    result = PromptTemplateService.import_templates(templates, overwrite=overwrite)
    return jsonify({"success": True, "data": result, "message": f"导入完成：成功 {result['imported']}，跳过 {result['skipped']}"})


@app.route("/api/inspection-tasks", methods=["GET"])
def get_inspection_tasks():
    tasks = InspectionTaskService.get_all()
    return jsonify({"success": True, "data": tasks, "count": len(tasks)})


@app.route("/api/inspection-tasks", methods=["POST"])
def create_inspection_task():
    data = request.get_json(force=True)
    required = [data.get("name"), data.get("camera_id"), data.get("rule_id"), data.get("frequency_seconds")]
    if not all(required):
        return jsonify({"success": False, "error": "任务名称、摄像头、规则、频率为必填项"}), 400

    task = InspectionTaskService.create(
        name=data["name"],
        camera_id=int(data["camera_id"]),
        rule_id=int(data["rule_id"]),
        frequency_seconds=max(10, int(data["frequency_seconds"])),
        auto_create_work_order=bool(data.get("auto_create_work_order", True)),
        status=data.get("status", "active"),
        resolution=data.get("resolution", "original"),
        quality=int(data.get("quality", 80)),
        storage_path=data.get("storage_path"),
        max_frames=int(data.get("max_frames", 1000)),
    )
    sync_scheduler()
    return jsonify({"success": True, "data": task, "message": "任务创建成功"})


@app.route("/api/inspection-tasks/<int:task_id>", methods=["GET"])
def get_inspection_task(task_id):
    task = InspectionTaskService.get_by_id(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404
    return jsonify({"success": True, "data": task})


@app.route("/api/inspection-tasks/<int:task_id>", methods=["PUT"])
def update_inspection_task(task_id):
    task = InspectionTaskService.get_by_id(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404

    payload = request.get_json(force=True)
    if "frequency_seconds" in payload:
        payload["frequency_seconds"] = max(10, int(payload["frequency_seconds"]))

    updated = InspectionTaskService.update(task_id, **payload)
    sync_scheduler()
    return jsonify({"success": True, "data": updated, "message": "任务更新成功"})


@app.route("/api/inspection-tasks/<int:task_id>", methods=["DELETE"])
def delete_inspection_task(task_id):
    task = InspectionTaskService.get_by_id(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404

    InspectionTaskService.delete(task_id)
    sync_scheduler()
    return jsonify({"success": True, "message": "任务删除成功"})


@app.route("/api/inspection-tasks/<int:task_id>/start", methods=["POST"])
def start_inspection_task(task_id):
    task = InspectionTaskService.get_by_id(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404

    InspectionTaskService.update(task_id, status="active")
    sync_scheduler()
    return jsonify({"success": True, "message": "任务已启动"})


@app.route("/api/inspection-tasks/<int:task_id>/stop", methods=["POST"])
def stop_inspection_task(task_id):
    task = InspectionTaskService.get_by_id(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404

    InspectionTaskService.update(task_id, status="inactive")
    sync_scheduler()
    return jsonify({"success": True, "message": "任务已停止"})


@app.route("/api/inspection-tasks/<int:task_id>/status", methods=["GET"])
def get_inspection_task_status(task_id):
    task = InspectionTaskService.get_by_id(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404

    job_id = f"inspection_task_{task_id}"
    job = scheduler.get_job(job_id)
    job_running = job is not None

    return jsonify({
        "success": True,
        "data": {
            "task_id": task_id,
            "status": task.get("status"),
            "is_running": job_running,
            "last_run_time": task.get("last_run_time"),
            "next_run_time": task.get("next_run_time"),
            "last_error": task.get("last_error"),
        }
    })


if __name__ == "__main__":
    print("=" * 60)
    print("独立版智能巡检系统 API v6.0")
    print("=" * 60)
    print("前端地址: http://127.0.0.1:5002/")
    print("接口健康检查: http://127.0.0.1:5002/api/health")
    app.run(host="0.0.0.0", port=5002, debug=True)
