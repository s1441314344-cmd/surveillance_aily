import base64
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from app.models.camera import Camera

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


def capture_camera_frame(camera: Camera) -> CameraFrame:
    rtsp_url = (camera.rtsp_url or "").strip()
    if not rtsp_url:
        raise CameraCaptureError("RTSP URL is missing")

    if rtsp_url.startswith("rtsp://mock/"):
        return CameraFrame(
            content=MOCK_FRAME_PNG,
            original_name=f"{_build_file_stem(camera.name)}-{camera.id[:8]}.png",
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

        scale_filter = RESOLUTION_SCALE_MAP.get((camera.resolution or "").lower())
        if scale_filter:
            command.extend(["-vf", scale_filter])

        command.extend(["-q:v", str(_to_ffmpeg_quality(camera.jpeg_quality)), str(output_path)])

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
        original_name=f"{_build_file_stem(camera.name)}-{camera.id[:8]}.jpg",
        mime_type="image/jpeg",
    )


def _build_file_stem(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", name.strip()).strip("-")
    return cleaned or "camera-frame"


def _to_ffmpeg_quality(jpeg_quality: int) -> int:
    safe_quality = min(max(jpeg_quality, 1), 100)
    return max(2, min(31, 31 - round((safe_quality / 100) * 29)))
