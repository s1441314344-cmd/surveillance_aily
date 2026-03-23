import json
from pathlib import Path

from app.services.model_evaluation_service import (
    EvaluationTarget,
    evaluate_model_targets,
    load_evaluation_dataset,
)
from app.services.providers.base import ProviderResponse


def test_load_evaluation_dataset_resolves_relative_image_paths(tmp_path):
    dataset_path = create_dataset_fixture(tmp_path)

    samples = load_evaluation_dataset(dataset_path)

    assert len(samples) == 2
    assert samples[0].sample_id == "sample-1"
    assert Path(samples[0].image_path).exists()
    assert samples[0].compare_fields == ["flag"]


def test_evaluate_model_targets_builds_summary_metrics(monkeypatch, tmp_path):
    dataset_path = create_dataset_fixture(tmp_path)
    call_counts = {"openai:gpt-5-mini": {}, "zhipu:glm-4v-plus": {}}

    class FakeAdapter:
        def __init__(self, target_key: str):
            self.target_key = target_key

        def analyze(self, request):
            sample_name = Path(request.image_paths[0]).stem
            current = call_counts[self.target_key].get(sample_name, 0) + 1
            call_counts[self.target_key][sample_name] = current

            if self.target_key == "openai:gpt-5-mini":
                flag = True if sample_name == "sample-1" else False
            else:
                if sample_name == "sample-1":
                    flag = current == 1
                else:
                    flag = False

            return ProviderResponse(
                success=True,
                raw_response=json.dumps({"flag": flag, "summary": f"{self.target_key}-{sample_name}"}, ensure_ascii=False),
                normalized_json={"flag": flag, "summary": f"{self.target_key}-{sample_name}"},
                error_message=None,
                usage={"input_tokens": 100, "output_tokens": 50, "total_tokens": 150},
            )

    monkeypatch.setattr(
        "app.services.model_evaluation_service.get_provider_adapter",
        lambda provider: FakeAdapter("openai:gpt-5-mini" if provider == "openai" else "zhipu:glm-4v-plus"),
    )

    report = evaluate_model_targets(
        dataset_path=dataset_path,
        targets=[
            EvaluationTarget(provider="openai", model="gpt-5-mini"),
            EvaluationTarget(provider="zhipu", model="glm-4v-plus"),
        ],
        repeats=2,
        max_workers=2,
        pricing_table={
            "openai:gpt-5-mini": {"input_per_million": 1, "output_per_million": 2},
            "zhipu:glm-4v-plus": {"input_per_million": 0.5, "output_per_million": 1},
        },
    )

    assert len(report.results) == 8
    summaries = {item.target: item for item in report.summaries}

    openai_summary = summaries["openai:gpt-5-mini"]
    assert openai_summary.total_runs == 4
    assert openai_summary.request_success_rate == 100.0
    assert openai_summary.structured_success_rate == 100.0
    assert openai_summary.accuracy_rate == 100.0
    assert openai_summary.stability_rate == 100.0
    assert openai_summary.total_input_tokens == 400
    assert openai_summary.total_output_tokens == 200
    assert openai_summary.total_tokens == 600
    assert openai_summary.estimated_total_cost == 0.0008
    assert openai_summary.sample_accuracy == {"sample-1": True, "sample-2": True}

    zhipu_summary = summaries["zhipu:glm-4v-plus"]
    assert zhipu_summary.total_runs == 4
    assert zhipu_summary.request_success_rate == 100.0
    assert zhipu_summary.structured_success_rate == 100.0
    assert zhipu_summary.accuracy_rate == 75.0
    assert zhipu_summary.stability_rate == 50.0
    assert zhipu_summary.estimated_total_cost == 0.0004
    assert zhipu_summary.sample_accuracy == {"sample-1": False, "sample-2": True}


def create_dataset_fixture(tmp_path: Path) -> Path:
    (tmp_path / "images").mkdir()
    (tmp_path / "images" / "sample-1.jpg").write_bytes(b"sample-1")
    (tmp_path / "images" / "sample-2.jpg").write_bytes(b"sample-2")

    payload = {
        "version": "v1",
        "samples": [
            {
                "sample_id": "sample-1",
                "image_path": "./images/sample-1.jpg",
                "prompt": "请返回 JSON",
                "response_schema": {
                    "type": "object",
                    "properties": {
                        "flag": {"type": "boolean"},
                        "summary": {"type": "string"},
                    },
                    "required": ["flag", "summary"],
                },
                "expected_json": {"flag": True},
                "compare_fields": ["flag"],
            },
            {
                "sample_id": "sample-2",
                "image_path": "./images/sample-2.jpg",
                "prompt": "请返回 JSON",
                "response_schema": {
                    "type": "object",
                    "properties": {
                        "flag": {"type": "boolean"},
                        "summary": {"type": "string"},
                    },
                    "required": ["flag", "summary"],
                },
                "expected_json": {"flag": False},
                "compare_fields": ["flag"],
            },
        ],
    }
    dataset_path = tmp_path / "dataset.json"
    dataset_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return dataset_path
