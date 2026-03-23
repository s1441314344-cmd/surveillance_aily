from __future__ import annotations

import json
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path

from app.services.model_provider_service import load_model_provider_runtime
from app.services.providers.base import ProviderRequest, ProviderResponse
from app.services.providers.factory import get_provider_adapter


@dataclass
class EvaluationSample:
    sample_id: str
    image_path: str
    prompt: str
    response_schema: dict
    expected_json: dict | None = None
    compare_fields: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


@dataclass
class EvaluationTarget:
    provider: str
    model: str

    @property
    def key(self) -> str:
        return f"{self.provider}:{self.model}"


@dataclass
class EvaluationRunResult:
    target: str
    sample_id: str
    repeat_index: int
    success: bool
    structured_success: bool
    accuracy_match: bool | None
    latency_ms: int
    raw_response: str
    normalized_json: dict | None
    error_message: str | None
    usage: dict | None


@dataclass
class EvaluationTargetSummary:
    target: str
    total_runs: int
    total_samples: int
    repeats: int
    request_success_rate: float
    structured_success_rate: float
    accuracy_rate: float | None
    stability_rate: float | None
    average_latency_ms: float
    max_latency_ms: int
    total_input_tokens: int | None
    total_output_tokens: int | None
    total_tokens: int | None
    estimated_total_cost: float | None
    estimated_average_cost: float | None
    sample_accuracy: dict[str, bool | None]


@dataclass
class EvaluationReport:
    dataset_path: str
    targets: list[str]
    repeats: int
    max_workers: int
    pricing_path: str | None
    summaries: list[EvaluationTargetSummary]
    results: list[EvaluationRunResult]

    def to_dict(self) -> dict:
        return {
            "dataset_path": self.dataset_path,
            "targets": self.targets,
            "repeats": self.repeats,
            "max_workers": self.max_workers,
            "pricing_path": self.pricing_path,
            "summaries": [asdict(item) for item in self.summaries],
            "results": [asdict(item) for item in self.results],
        }


def load_evaluation_dataset(dataset_path: str | Path) -> list[EvaluationSample]:
    path = Path(dataset_path).expanduser().resolve()
    payload = json.loads(path.read_text(encoding="utf-8"))
    samples: list[EvaluationSample] = []
    for index, item in enumerate(payload.get("samples") or [], start=1):
        image_path = _resolve_dataset_path(path.parent, item["image_path"])
        samples.append(
            EvaluationSample(
                sample_id=str(item.get("sample_id") or f"sample-{index}"),
                image_path=str(image_path),
                prompt=str(item["prompt"]),
                response_schema=item["response_schema"],
                expected_json=item.get("expected_json"),
                compare_fields=list(item.get("compare_fields") or []),
                tags=list(item.get("tags") or []),
            )
        )
    return samples


def load_pricing_table(pricing_path: str | Path | None) -> dict:
    if not pricing_path:
        return {}
    path = Path(pricing_path).expanduser().resolve()
    return json.loads(path.read_text(encoding="utf-8"))


def build_targets(target_specs: list[str] | None) -> list[EvaluationTarget]:
    if target_specs:
        return [_parse_target_spec(item) for item in target_specs]

    inferred_targets: list[EvaluationTarget] = []
    for provider_name in ("zhipu", "openai"):
        runtime = load_model_provider_runtime(provider_name)
        if runtime is None or runtime.status != "active":
            continue
        inferred_targets.append(EvaluationTarget(provider=runtime.provider, model=runtime.default_model))
    return inferred_targets


def evaluate_model_targets(
    *,
    dataset_path: str | Path,
    targets: list[EvaluationTarget],
    repeats: int = 1,
    max_workers: int = 2,
    pricing_table: dict | None = None,
) -> EvaluationReport:
    samples = load_evaluation_dataset(dataset_path)
    pricing_table = pricing_table or {}

    jobs: list[tuple[EvaluationTarget, EvaluationSample, int]] = []
    for target in targets:
        for sample in samples:
            for repeat_index in range(1, repeats + 1):
                jobs.append((target, sample, repeat_index))

    results: list[EvaluationRunResult] = []
    worker_count = max(1, min(max_workers, len(jobs) or 1))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = [
            executor.submit(_evaluate_single_run, target=target, sample=sample, repeat_index=repeat_index)
            for target, sample, repeat_index in jobs
        ]
        for future in futures:
            results.append(future.result())

    results.sort(key=lambda item: (item.target, item.sample_id, item.repeat_index))
    summaries = _summarize_results(
        samples=samples,
        targets=targets,
        repeats=repeats,
        pricing_table=pricing_table,
        results=results,
    )
    return EvaluationReport(
        dataset_path=str(Path(dataset_path).expanduser().resolve()),
        targets=[target.key for target in targets],
        repeats=repeats,
        max_workers=worker_count,
        pricing_path=None,
        summaries=summaries,
        results=results,
    )


def save_evaluation_report(report: EvaluationReport, output_path: str | Path) -> Path:
    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _evaluate_single_run(*, target: EvaluationTarget, sample: EvaluationSample, repeat_index: int) -> EvaluationRunResult:
    adapter = get_provider_adapter(target.provider)
    started_at = time.perf_counter()
    response: ProviderResponse = adapter.analyze(
        ProviderRequest(
            model=target.model,
            prompt=sample.prompt,
            image_paths=[sample.image_path],
            response_schema=sample.response_schema,
        )
    )
    latency_ms = int((time.perf_counter() - started_at) * 1000)
    structured_success = response.normalized_json is not None
    accuracy_match = _match_expected_json(
        actual=response.normalized_json,
        expected=sample.expected_json,
        compare_fields=sample.compare_fields,
    )
    return EvaluationRunResult(
        target=target.key,
        sample_id=sample.sample_id,
        repeat_index=repeat_index,
        success=response.success,
        structured_success=structured_success,
        accuracy_match=accuracy_match,
        latency_ms=latency_ms,
        raw_response=response.raw_response,
        normalized_json=response.normalized_json,
        error_message=response.error_message,
        usage=response.usage,
    )


def _summarize_results(
    *,
    samples: list[EvaluationSample],
    targets: list[EvaluationTarget],
    repeats: int,
    pricing_table: dict,
    results: list[EvaluationRunResult],
) -> list[EvaluationTargetSummary]:
    sample_ids = [sample.sample_id for sample in samples]
    grouped: dict[str, list[EvaluationRunResult]] = defaultdict(list)
    for item in results:
        grouped[item.target].append(item)

    summaries: list[EvaluationTargetSummary] = []
    for target in targets:
        target_key = target.key
        target_results = grouped[target_key]
        success_count = sum(1 for item in target_results if item.success)
        structured_count = sum(1 for item in target_results if item.structured_success)
        comparable_results = [item for item in target_results if item.accuracy_match is not None]
        accuracy_count = sum(1 for item in comparable_results if item.accuracy_match)
        latency_values = [item.latency_ms for item in target_results]
        sample_accuracy = _build_sample_accuracy(sample_ids, target_results)
        stability_rate = _build_stability_rate(sample_ids, target_results, repeats)
        token_totals = _aggregate_usage(target_results)
        estimated_total_cost = _estimate_cost(pricing_table, target_key, token_totals)

        summaries.append(
            EvaluationTargetSummary(
                target=target_key,
                total_runs=len(target_results),
                total_samples=len(samples),
                repeats=repeats,
                request_success_rate=_rate(success_count, len(target_results)),
                structured_success_rate=_rate(structured_count, len(target_results)),
                accuracy_rate=(
                    _rate(accuracy_count, len(comparable_results))
                    if comparable_results
                    else None
                ),
                stability_rate=stability_rate,
                average_latency_ms=round(sum(latency_values) / len(latency_values), 2) if latency_values else 0.0,
                max_latency_ms=max(latency_values) if latency_values else 0,
                total_input_tokens=token_totals["input_tokens"],
                total_output_tokens=token_totals["output_tokens"],
                total_tokens=token_totals["total_tokens"],
                estimated_total_cost=estimated_total_cost,
                estimated_average_cost=(
                    round(estimated_total_cost / len(target_results), 8)
                    if estimated_total_cost is not None and target_results
                    else None
                ),
                sample_accuracy=sample_accuracy,
            )
        )
    return summaries


def _build_sample_accuracy(sample_ids: list[str], results: list[EvaluationRunResult]) -> dict[str, bool | None]:
    sample_results: dict[str, list[bool | None]] = defaultdict(list)
    for item in results:
        sample_results[item.sample_id].append(item.accuracy_match)

    accuracy_map: dict[str, bool | None] = {}
    for sample_id in sample_ids:
        values = [value for value in sample_results.get(sample_id, []) if value is not None]
        if not values:
            accuracy_map[sample_id] = None
            continue
        accuracy_map[sample_id] = all(values)
    return accuracy_map


def _build_stability_rate(sample_ids: list[str], results: list[EvaluationRunResult], repeats: int) -> float | None:
    if repeats < 2:
        return None

    stable_count = 0
    sample_results: dict[str, list[EvaluationRunResult]] = defaultdict(list)
    for item in results:
        sample_results[item.sample_id].append(item)

    for sample_id in sample_ids:
        group = sorted(sample_results.get(sample_id, []), key=lambda item: item.repeat_index)
        if len(group) != repeats:
            continue
        if not all(item.structured_success for item in group):
            continue
        normalized_outputs = [json.dumps(item.normalized_json, ensure_ascii=False, sort_keys=True) for item in group]
        if len(set(normalized_outputs)) == 1:
            stable_count += 1

    return _rate(stable_count, len(sample_ids))


def _aggregate_usage(results: list[EvaluationRunResult]) -> dict[str, int | None]:
    usages = [item.usage for item in results if item.usage]
    if not usages:
        return {"input_tokens": None, "output_tokens": None, "total_tokens": None}
    return {
        "input_tokens": sum(int(item.get("input_tokens") or 0) for item in usages),
        "output_tokens": sum(int(item.get("output_tokens") or 0) for item in usages),
        "total_tokens": sum(int(item.get("total_tokens") or 0) for item in usages),
    }


def _estimate_cost(pricing_table: dict, target_key: str, token_totals: dict[str, int | None]) -> float | None:
    input_tokens = token_totals.get("input_tokens")
    output_tokens = token_totals.get("output_tokens")
    if input_tokens is None or output_tokens is None:
        return None

    pricing = pricing_table.get(target_key) or pricing_table.get(target_key.split(":", 1)[0])
    if not pricing:
        return None

    input_per_million = float(pricing.get("input_per_million") or 0)
    output_per_million = float(pricing.get("output_per_million") or 0)
    total_cost = (input_tokens / 1_000_000) * input_per_million + (output_tokens / 1_000_000) * output_per_million
    return round(total_cost, 8)


def _match_expected_json(*, actual: dict | None, expected: dict | None, compare_fields: list[str]) -> bool | None:
    if expected is None:
        return None
    if actual is None:
        return False
    if compare_fields:
        for field_path in compare_fields:
            if _get_field(actual, field_path) != _get_field(expected, field_path):
                return False
        return True
    return _is_subset(expected, actual)


def _is_subset(expected, actual) -> bool:
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        for key, value in expected.items():
            if key not in actual or not _is_subset(value, actual[key]):
                return False
        return True
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(expected) > len(actual):
            return False
        return all(_is_subset(expected[index], actual[index]) for index in range(len(expected)))
    return expected == actual


def _get_field(payload: dict, field_path: str):
    current = payload
    for part in field_path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _parse_target_spec(value: str) -> EvaluationTarget:
    if ":" not in value:
        raise ValueError(f"Invalid target spec '{value}', expected provider:model")
    provider, model = value.split(":", 1)
    provider = provider.strip().lower()
    model = model.strip()
    if not provider or not model:
        raise ValueError(f"Invalid target spec '{value}', expected provider:model")
    return EvaluationTarget(provider=provider, model=model)


def _resolve_dataset_path(base_dir: Path, raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path.resolve()
    return (base_dir / path).resolve()


def _rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)
