import base64
import binascii
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from app.models.camera import Camera
from app.services.storage import FileStorageService

MOCK_FRAME_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s3FoXQAAAAASUVORK5CYII="
)

RESOLUTION_SCALE_MAP = {
    "720p": "scale=1280:720",
    "1080p": "scale=1920:1080",
    "4k": "scale=3840:2160",
}


class CameraCaptureError(RuntimeError):
    pass


@dataclass
class CameraFrame:
    content: bytes
    original_name: str
    mime_type: str


@dataclass
class CameraCaptureConfig:
    id: str
    name: str
    protocol: str
    rtsp_url: str | None
    resolution: str
    jpeg_quality: int
    storage_path: str | None = None


@dataclass
class CameraCaptureDiagnostic:
    camera_id: str
    camera_name: str
    protocol: str
    stream_url_masked: str | None
    success: bool
    capture_mode: str
    latency_ms: int
    frame_size_bytes: int | None
    mime_type: str | None
    width: int | None
    height: int | None
    snapshot_path: str | None
    error_message: str | None
    checked_at: datetime


def camera_to_capture_config(camera: Camera) -> CameraCaptureConfig:
    return CameraCaptureConfig(
        id=camera.id,
        name=camera.name,
        protocol=camera.protocol,
        rtsp_url=camera.rtsp_url,
        resolution=camera.resolution,
        jpeg_quality=camera.jpeg_quality,
        storage_path=camera.storage_path,
    )


def snapshot_to_capture_config(snapshot: dict) -> CameraCaptureConfig:
    return CameraCaptureConfig(
        id=str(snapshot.get("id") or ""),
        name=str(snapshot.get("name") or "camera"),
        protocol=str(snapshot.get("protocol") or "rtsp").lower(),
        rtsp_url=snapshot.get("rtsp_url"),
        resolution=str(snapshot.get("resolution") or "1080p"),
        jpeg_quality=int(snapshot.get("jpeg_quality") or 80),
        storage_path=snapshot.get("storage_path"),
    )


def capture_camera_frame(camera: Camera | CameraCaptureConfig) -> CameraFrame:
    capture_config = camera if isinstance(camera, CameraCaptureConfig) else camera_to_capture_config(camera)
    protocol = (capture_config.protocol or "").strip().lower()
    if protocol != "rtsp":
        raise CameraCaptureError(
            f"Camera protocol {protocol or 'unknown'} is not supported in V1 capture chain; only RTSP is supported",
        )

    rtsp_url = (capture_config.rtsp_url or "").strip()
    if not rtsp_url:
        raise CameraCaptureError("RTSP URL is missing")

    if rtsp_url.startswith("rtsp://mock/"):
        return CameraFrame(
            content=MOCK_FRAME_PNG,
            original_name=f"{_build_file_stem(capture_config.name)}-{capture_config.id[:8]}.png",
            mime_type="image/png",
        )

    if not rtsp_url.startswith("rtsp://"):
        raise CameraCaptureError("RTSP URL must start with rtsp://")

    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path is None:
        raise CameraCaptureError("ffmpeg is required for RTSP frame capture")

    with TemporaryDirectory(prefix="camera-capture-") as temp_dir:
        output_path = Path(temp_dir) / "frame.jpg"
        command = [
            ffmpeg_path,
            "-y",
            "-rtsp_transport",
            "tcp",
            "-i",
            rtsp_url,
            "-frames:v",
            "1",
        ]

        scale_filter = RESOLUTION_SCALE_MAP.get((capture_config.resolution or "").lower())
        if scale_filter:
            command.extend(["-vf", scale_filter])

        command.extend(["-q:v", str(_to_ffmpeg_quality(capture_config.jpeg_quality)), str(output_path)])

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise CameraCaptureError("RTSP frame capture timed out") from exc

        if result.returncode != 0 or not output_path.exists():
            stderr = (result.stderr or result.stdout or "").strip()
            if len(stderr) > 240:
                stderr = stderr[-240:]
            raise CameraCaptureError(f"RTSP frame capture failed: {stderr or 'unknown ffmpeg error'}")

        content = output_path.read_bytes()
        if not content:
            raise CameraCaptureError("Captured frame is empty")

    return CameraFrame(
        content=content,
        original_name=f"{_build_file_stem(capture_config.name)}-{capture_config.id[:8]}.jpg",
        mime_type="image/jpeg",
    )


def diagnose_camera_capture(
    camera: Camera | CameraCaptureConfig,
    *,
    save_snapshot: bool = True,
) -> CameraCaptureDiagnostic:
    capture_config = camera if isinstance(camera, CameraCaptureConfig) else camera_to_capture_config(camera)
    started_at = time.perf_counter()
    checked_at = datetime.now(timezone.utc)
    masked_url = _mask_rtsp_url(capture_config.rtsp_url)

    try:
        frame = capture_camera_frame(capture_config)
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        width, height = _probe_image_size(frame.content)
        snapshot_path = None
        if save_snapshot:
            storage = FileStorageService(root=capture_config.storage_path or None)
            snapshot_path = storage.save_bytes(
                frame.content,
                frame.original_name,
                folder=f"diagnostics/{capture_config.id or 'camera'}",
            )
        return CameraCaptureDiagnostic(
            camera_id=capture_config.id,
            camera_name=capture_config.name,
            protocol=(capture_config.protocol or "rtsp").lower(),
            stream_url_masked=masked_url,
            success=True,
            capture_mode="mock" if (capture_config.rtsp_url or "").startswith("rtsp://mock/") else "rtsp",
            latency_ms=latency_ms,
            frame_size_bytes=len(frame.content),
            mime_type=frame.mime_type,
            width=width,
            height=height,
            snapshot_path=snapshot_path,
            error_message=None,
            checked_at=checked_at,
        )
    except CameraCaptureError as exc:
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        return CameraCaptureDiagnostic(
            camera_id=capture_config.id,
            camera_name=capture_config.name,
            protocol=(capture_config.protocol or "rtsp").lower(),
            stream_url_masked=masked_url,
            success=False,
            capture_mode=(capture_config.protocol or "rtsp").lower(),
            latency_ms=latency_ms,
            frame_size_bytes=None,
            mime_type=None,
            width=None,
            height=None,
            snapshot_path=None,
            error_message=str(exc),
            checked_at=checked_at,
        )


def _build_file_stem(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", name.strip()).strip("-")
    return cleaned or "camera-frame"


def _to_ffmpeg_quality(jpeg_quality: int) -> int:
    safe_quality = min(max(jpeg_quality, 1), 100)
    return max(2, min(31, 31 - round((safe_quality / 100) * 29)))


def _mask_rtsp_url(rtsp_url: str | None) -> str | None:
    if not rtsp_url:
        return None
    return re.sub(r"//([^:/]+):([^@]+)@", r"//\1:***@", rtsp_url)


def _probe_image_size(content: bytes) -> tuple[int | None, int | None]:
    if content.startswith(b"\x89PNG\r\n\x1a\n") and len(content) >= 24:
        width = int.from_bytes(content[16:20], "big")
        height = int.from_bytes(content[20:24], "big")
        return width, height

    if content.startswith(b"\xff\xd8"):
        index = 2
        while index + 9 < len(content):
            if content[index] != 0xFF:
                index += 1
                continue
            marker = content[index + 1]
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                try:
                    height = int.from_bytes(content[index + 5 : index + 7], "big")
                    width = int.from_bytes(content[index + 7 : index + 9], "big")
                    return width, height
                except (ValueError, IndexError, binascii.Error):
                    return None, None
            if index + 4 >= len(content):
                break
            segment_length = int.from_bytes(content[index + 2 : index + 4], "big")
            if segment_length <= 0:
                break
            index += 2 + segment_length

    return None, None
