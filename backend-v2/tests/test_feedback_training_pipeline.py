from pathlib import Path

from app.core.database import SessionLocal
from app.models.strategy import AnalysisStrategy
from app.models.task_record import PredictionFeedback, TaskRecord
from app.services.feedback_training_pipeline_service import TRAINING_ROUTE_PROMPT_ENHANCE
from app.services.ids import generate_id
from app.services.strategy_service import build_strategy_snapshot

from .test_auth_and_users import auth_headers, login_as_admin


def test_feedback_training_pipeline_sampling_and_route_fallback(client, monkeypatch):
    _set_training_defaults_for_test(monkeypatch)
    _seed_reviewed_records(strategy_id="preset-fire", incorrect_count=3, correct_count=5, unreviewed_count=2)

    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    run_response = client.post("/api/training/pipeline/run", headers=headers, json={})
    assert run_response.status_code == 200
    run_payload = run_response.json()
    assert len(run_payload["run_ids"]) == 1

    datasets_response = client.get("/api/training/datasets", headers=headers)
    assert datasets_response.status_code == 200
    datasets = datasets_response.json()
    assert len(datasets) == 1
    # incorrect(3) 全量 + correct(5) 按 1:1 抽样 3 条
    assert datasets[0]["sample_count"] == 6
    assert datasets[0]["incorrect_count"] == 3
    assert datasets[0]["correct_count"] == 3

    runs_response = client.get("/api/training/runs", headers=headers)
    assert runs_response.status_code == 200
    runs = runs_response.json()
    assert len(runs) == 1
    assert runs[0]["route_requested"] == "finetune"
    assert runs[0]["route_actual"] == TRAINING_ROUTE_PROMPT_ENHANCE
    assert runs[0]["status"] == "completed"
    assert runs[0]["release_status"] == "pending"

    overview_response = client.get("/api/training/overview", headers=headers)
    assert overview_response.status_code == 200
    overview = overview_response.json()
    assert overview["reviewed_samples"] == 8
    assert overview["pending_release_requests"] == 1


def test_feedback_training_release_approval_updates_strategy(client, monkeypatch):
    _set_training_defaults_for_test(monkeypatch)
    _seed_reviewed_records(strategy_id="preset-fire", incorrect_count=1, correct_count=1, unreviewed_count=0)

    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    run_response = client.post("/api/training/pipeline/run", headers=headers, json={})
    assert run_response.status_code == 200
    run_id = run_response.json()["run_ids"][0]

    run_detail_response = client.get(f"/api/training/runs/{run_id}", headers=headers)
    assert run_detail_response.status_code == 200
    assert run_detail_response.json()["release_status"] == "pending"

    approve_response = client.post(
        f"/api/training/runs/{run_id}/approve",
        headers=headers,
        json={"comment": "approve-for-test"},
    )
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    strategy_response = client.get("/api/strategies/preset-fire", headers=headers)
    assert strategy_response.status_code == 200
    strategy = strategy_response.json()
    assert strategy["version"] >= 2
    assert "反馈回流增强" in strategy["prompt_template"]


def _set_training_defaults_for_test(monkeypatch):
    from app.services import feedback_training_pipeline_service as service

    monkeypatch.setattr(service.settings, "feedback_training_min_samples", 1, raising=False)
    monkeypatch.setattr(service.settings, "feedback_training_positive_ratio", 1.0, raising=False)
    monkeypatch.setattr(service.settings, "feedback_training_max_samples_per_strategy", 2000, raising=False)
    monkeypatch.setattr(service.settings, "feedback_training_route_default", "finetune", raising=False)


def _seed_reviewed_records(*, strategy_id: str, incorrect_count: int, correct_count: int, unreviewed_count: int) -> None:
    image_path = str((Path(__file__).resolve().parents[2] / "test_media" / "test_cam_1.jpg").resolve())

    with SessionLocal() as db:
        strategy = db.get(AnalysisStrategy, strategy_id)
        assert strategy is not None
        strategy_snapshot = build_strategy_snapshot(strategy)

        def create_record(judgement: str | None):
            record = TaskRecord(
                id=generate_id(),
                job_id=generate_id(),
                strategy_id=strategy.id,
                strategy_name=strategy.name,
                strategy_snapshot=strategy_snapshot,
                input_file_asset_id=None,
                input_filename=Path(image_path).name,
                input_image_path=image_path,
                preview_image_path=None,
                source_type="upload",
                camera_id=None,
                model_provider=strategy.model_provider,
                model_name=strategy.model_name,
                raw_model_response="{}",
                normalized_json={},
                result_status="completed",
                duration_ms=1,
                feedback_status=judgement or "unreviewed",
            )
            db.add(record)
            if judgement in {"correct", "incorrect"}:
                db.add(
                    PredictionFeedback(
                        id=generate_id(),
                        record_id=record.id,
                        judgement=judgement,
                        corrected_label='{"has_fire": false}' if judgement == "incorrect" else None,
                        comment=f"test-{judgement}",
                        reviewer="qa",
                    )
                )

        for _ in range(incorrect_count):
            create_record("incorrect")
        for _ in range(correct_count):
            create_record("correct")
        for _ in range(unreviewed_count):
            create_record(None)
        db.commit()
