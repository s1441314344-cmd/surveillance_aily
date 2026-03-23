import json
from pathlib import Path

from app.services.camera_validation_service import (
    render_camera_validation_markdown,
    validate_camera_manifest,
)


def test_validate_camera_manifest_and_render_markdown(tmp_path):
    manifest_path = tmp_path / "camera-manifest.json"
    payload = {
        "title": "摄像头白名单测试",
        "targets": [
            {
                "target_id": "mock-ok",
                "name": "Mock Camera",
                "rtsp_url": "rtsp://mock/diag-ok",
                "resolution": "720p",
                "jpeg_quality": 80,
                "storage_path": str(tmp_path / "storage" / "mock-ok"),
                "expectation": {
                    "should_succeed": True,
                    "min_width": 1,
                    "min_height": 1,
                    "allowed_capture_modes": ["mock"],
                },
            },
            {
                "target_id": "bad-url",
                "name": "Bad Camera",
                "rtsp_url": "bad-rtsp-url",
                "resolution": "720p",
                "jpeg_quality": 80,
                "storage_path": str(tmp_path / "storage" / "bad-url"),
                "expectation": {
                    "should_succeed": False,
                    "allowed_capture_modes": ["rtsp"],
                },
            },
        ],
    }
    manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    report = validate_camera_manifest(manifest_path=manifest_path, max_workers=2, save_snapshot=True)

    assert report.title == "摄像头白名单测试"
    assert report.summary.total_targets == 2
    assert report.summary.success_count == 1
    assert report.summary.expectation_passed_count == 2
    assert report.summary.whitelist_pass_rate == 100.0
    result_map = {item.target_id: item for item in report.results}
    assert result_map["mock-ok"].snapshot_path is not None
    assert result_map["bad-url"].error_message is not None

    markdown = render_camera_validation_markdown(report)
    assert "# 摄像头白名单测试" in markdown
    assert "| mock-ok | yes | yes | mock |" in markdown
    assert "| bad-url | no | yes | rtsp |" in markdown
