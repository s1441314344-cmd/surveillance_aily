from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path

from app.core.database import SessionLocal
from app.models.camera import Camera
from app.services.camera_capture_service import CameraCaptureConfig, diagnose_camera_capture


@dataclass
class CameraValidationExpectation:
    should_succeed: bool | None = None
    min_width: int | None = None
    min_height: int | None = None
    max_latency_ms: int | None = None
    allowed_capture_modes: list[str] = field(default_factory=list)


@dataclass
class CameraValidationTarget:
    target_id: str
    camera_id: str | None
    name: str
    rtsp_url: str | None
    resolution: str
    jpeg_quality: int
    storage_path: str
    expectation: CameraValidationExpectation


@dataclass
class CameraValidationResult:
    target_id: str
    camera_id: str | None
    camera_name: str
    success: bool
    expectation_passed: bool
    expectation_failures: list[str]
    capture_mode: str
    latency_ms: int
    frame_size_bytes: int | None
    width: int | None
    height: int | None
    mime_type: str | None
    stream_url_masked: str | None
    snapshot_path: str | None
    error_message: str | None
    checked_at: str


@dataclass
class CameraValidationSummary:
    total_targets: int
    success_count: int
    failed_count: int
    expectation_passed_count: int
    success_rate: float
    whitelist_pass_rate: float
    average_latency_ms: float


@dataclass
class CameraValidationReport:
    manifest_path: str
    title: str
    max_workers: int
    save_snapshot: bool
    summary: CameraValidationSummary
    results: list[CameraValidationResult]

    def to_dict(self) -> dict:
        return {
            "manifest_path": self.manifest_path,
            "title": self.title,
            "max_workers": self.max_workers,
            "save_snapshot": self.save_snapshot,
            "summary": asdict(self.summary),
            "results": [asdict(item) for item in self.results],
        }


def load_camera_validation_manifest(manifest_path: str | Path) -> tuple[str, list[CameraValidationTarget]]:
    path = Path(manifest_path).expanduser().resolve()
    payload = json.loads(path.read_text(encoding="utf-8"))
    title = str(payload.get("title") or "智能巡检系统 V2 摄像头白名单验证报告")
    targets: list[CameraValidationTarget] = []
    for index, item in enumerate(payload.get("targets") or [], start=1):
        expectation_payload = item.get("expectation") or {}
        targets.append(
            CameraValidationTarget(
                target_id=str(item.get("target_id") or f"camera-target-{index}"),
                camera_id=item.get("camera_id"),
                name=str(item.get("name") or item.get("camera_id") or f"camera-{index}"),
                rtsp_url=item.get("rtsp_url"),
                resolution=str(item.get("resolution") or "1080p"),
                jpeg_quality=int(item.get("jpeg_quality") or 80),
                storage_path=str(item.get("storage_path") or "./data/storage/cameras/validation"),
                expectation=CameraValidationExpectation(
                    should_succeed=expectation_payload.get("should_succeed"),
                    min_width=expectation_payload.get("min_width"),
                    min_height=expectation_payload.get("min_height"),
                    max_latency_ms=expectation_payload.get("max_latency_ms"),
                    allowed_capture_modes=list(expectation_payload.get("allowed_capture_modes") or []),
                ),
            )
        )
    return title, targets


def validate_camera_manifest(
    *,
    manifest_path: str | Path,
    max_workers: int = 2,
    save_snapshot: bool = True,
) -> CameraValidationReport:
    resolved_manifest_path = Path(manifest_path).expanduser().resolve()
    title, targets = load_camera_validation_manifest(resolved_manifest_path)
    worker_count = max(1, min(max_workers, len(targets) or 1))

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = [executor.submit(_validate_target, target=target, save_snapshot=save_snapshot) for target in targets]
        results = [future.result() for future in futures]

    results.sort(key=lambda item: item.target_id)
    success_count = sum(1 for item in results if item.success)
    pass_count = sum(1 for item in results if item.expectation_passed)
    average_latency = round(sum(item.latency_ms for item in results) / len(results), 2) if results else 0.0

    summary = CameraValidationSummary(
        total_targets=len(results),
        success_count=success_count,
        failed_count=len(results) - success_count,
        expectation_passed_count=pass_count,
        success_rate=_rate(success_count, len(results)),
        whitelist_pass_rate=_rate(pass_count, len(results)),
        average_latency_ms=average_latency,
    )
    return CameraValidationReport(
        manifest_path=str(resolved_manifest_path),
        title=title,
        max_workers=worker_count,
        save_snapshot=save_snapshot,
        summary=summary,
        results=results,
    )


def render_camera_validation_markdown(report: CameraValidationReport) -> str:
    lines = [
        f"# {report.title}",
        "",
        f"- 清单文件: `{report.manifest_path}`",
        f"- 并发数: `{report.max_workers}`",
        f"- 保存诊断快照: `{report.save_snapshot}`",
        "",
        "## 汇总",
        "",
        f"- 总目标数: `{report.summary.total_targets}`",
        f"- 抓帧成功数: `{report.summary.success_count}`",
        f"- 失败数: `{report.summary.failed_count}`",
        f"- 白名单通过数: `{report.summary.expectation_passed_count}`",
        f"- 抓帧成功率: `{report.summary.success_rate}%`",
        f"- 白名单通过率: `{report.summary.whitelist_pass_rate}%`",
        f"- 平均诊断时延: `{report.summary.average_latency_ms} ms`",
        "",
        "## 明细",
        "",
        "| Target | Success | Whitelist | Mode | Latency (ms) | Size | Resolution | Error |",
        "|---|---|---|---|---:|---:|---|---|",
    ]
    for item in report.results:
        resolution = f"{item.width or '-'}x{item.height or '-'}"
        lines.append(
            f"| {item.target_id} | {_bool_label(item.success)} | {_bool_label(item.expectation_passed)} | {item.capture_mode} | {item.latency_ms} | {item.frame_size_bytes or 0} | {resolution} | {(item.error_message or '').replace('|', '/')} |"
        )

    for item in report.results:
        lines.extend(
            [
                "",
                f"## {item.target_id}",
                "",
                f"- 摄像头名称: `{item.camera_name}`",
                f"- Camera ID: `{item.camera_id or 'N/A'}`",
                f"- 抓帧成功: `{item.success}`",
                f"- 白名单通过: `{item.expectation_passed}`",
                f"- 抓帧模式: `{item.capture_mode}`",
                f"- 时延: `{item.latency_ms} ms`",
                f"- 图片大小: `{item.frame_size_bytes}`",
                f"- 图片尺寸: `{item.width}x{item.height}`",
                f"- MIME: `{item.mime_type}`",
                f"- 脱敏 RTSP: `{item.stream_url_masked}`",
                f"- 快照路径: `{item.snapshot_path}`",
                f"- 错误信息: `{item.error_message}`",
            ]
        )
        if item.expectation_failures:
            lines.extend(["", "### 失败原因", ""])
            for reason in item.expectation_failures:
                lines.append(f"- {reason}")

    return "\n".join(lines).strip() + "\n"


def save_camera_validation_report(report: CameraValidationReport, output_path: str | Path) -> Path:
    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def save_camera_validation_markdown_report(report: CameraValidationReport, output_path: str | Path) -> Path:
    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_camera_validation_markdown(report), encoding="utf-8")
    return path


def _validate_target(*, target: CameraValidationTarget, save_snapshot: bool) -> CameraValidationResult:
    if target.camera_id:
        with SessionLocal() as db:
            camera = db.get(Camera, target.camera_id)
            if camera is None:
                return CameraValidationResult(
                    target_id=target.target_id,
                    camera_id=target.camera_id,
                    camera_name=target.name,
                    success=False,
                    expectation_passed=False,
                    expectation_failures=[f"Camera {target.camera_id} not found"],
                    capture_mode="db",
                    latency_ms=0,
                    frame_size_bytes=None,
                    width=None,
                    height=None,
                    mime_type=None,
                    stream_url_masked=None,
                    snapshot_path=None,
                    error_message=f"Camera {target.camera_id} not found",
                    checked_at="",
                )
            diagnostic = diagnose_camera_capture(camera, save_snapshot=save_snapshot)
    else:
        diagnostic = diagnose_camera_capture(
            CameraCaptureConfig(
                id=target.target_id,
                name=target.name,
                rtsp_url=target.rtsp_url,
                resolution=target.resolution,
                jpeg_quality=target.jpeg_quality,
                storage_path=target.storage_path,
            ),
            save_snapshot=save_snapshot,
        )

    expectation_failures = _evaluate_expectation(target.expectation, diagnostic)
    return CameraValidationResult(
        target_id=target.target_id,
        camera_id=target.camera_id,
        camera_name=diagnostic.camera_name,
        success=diagnostic.success,
        expectation_passed=len(expectation_failures) == 0,
        expectation_failures=expectation_failures,
        capture_mode=diagnostic.capture_mode,
        latency_ms=diagnostic.latency_ms,
        frame_size_bytes=diagnostic.frame_size_bytes,
        width=diagnostic.width,
        height=diagnostic.height,
        mime_type=diagnostic.mime_type,
        stream_url_masked=diagnostic.stream_url_masked,
        snapshot_path=diagnostic.snapshot_path,
        error_message=diagnostic.error_message,
        checked_at=diagnostic.checked_at.isoformat(),
    )


def _evaluate_expectation(
    expectation: CameraValidationExpectation,
    diagnostic,
) -> list[str]:
    failures: list[str] = []
    if expectation.should_succeed is not None and diagnostic.success != expectation.should_succeed:
        failures.append(
            f"Expected success={expectation.should_succeed}, actual={diagnostic.success}"
        )
    if expectation.min_width is not None and (diagnostic.width or 0) < expectation.min_width:
        failures.append(f"Width {diagnostic.width} is below required {expectation.min_width}")
    if expectation.min_height is not None and (diagnostic.height or 0) < expectation.min_height:
        failures.append(f"Height {diagnostic.height} is below required {expectation.min_height}")
    if expectation.max_latency_ms is not None and diagnostic.latency_ms > expectation.max_latency_ms:
        failures.append(f"Latency {diagnostic.latency_ms} exceeds limit {expectation.max_latency_ms}")
    if expectation.allowed_capture_modes and diagnostic.capture_mode not in expectation.allowed_capture_modes:
        failures.append(
            f"Capture mode {diagnostic.capture_mode} is not allowed: {', '.join(expectation.allowed_capture_modes)}"
        )
    return failures


def _rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)


def _bool_label(value: bool) -> str:
    return "yes" if value else "no"
