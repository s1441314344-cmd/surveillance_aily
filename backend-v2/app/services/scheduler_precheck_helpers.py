from __future__ import annotations

import time


def resolve_signal_strategy_snapshot(
    *,
    db,
    strategy_id: str | None,
    analysis_strategy_model,
    select_fn,
    get_strategy_or_404_fn,
    build_strategy_snapshot_fn,
) -> dict:
    selected_strategy = None
    if strategy_id:
        selected_strategy = get_strategy_or_404_fn(db, strategy_id)
    if selected_strategy is None:
        selected_strategy = db.scalar(
            select_fn(analysis_strategy_model)
            .where(analysis_strategy_model.status == "active")
            .where(analysis_strategy_model.is_signal_strategy.is_(True))
            .order_by(analysis_strategy_model.created_at.desc(), analysis_strategy_model.id.asc())
        )
    if selected_strategy is None:
        selected_strategy = db.get(analysis_strategy_model, "preset-fire")
    if selected_strategy is None:
        selected_strategy = db.scalar(
            select_fn(analysis_strategy_model)
            .where(analysis_strategy_model.status == "active")
            .order_by(analysis_strategy_model.created_at.desc(), analysis_strategy_model.id.asc())
        )
    if selected_strategy is None:
        return {}
    return build_strategy_snapshot_fn(selected_strategy)


def collect_camera_rule_signal_keys(
    *,
    db,
    camera_id: str,
    camera_trigger_rule_model,
    select_fn,
) -> set[str]:
    rules = list(
        db.scalars(
            select_fn(camera_trigger_rule_model)
            .where(camera_trigger_rule_model.camera_id == camera_id)
            .where(camera_trigger_rule_model.enabled.is_(True))
            .order_by(camera_trigger_rule_model.priority.asc(), camera_trigger_rule_model.created_at.asc())
        )
    )
    signal_keys: set[str] = set()
    for rule in rules:
        signal_keys.update(_extract_rule_signal_keys(rule))
    return signal_keys


def run_schedule_local_gate_with_sampling(
    *,
    camera,
    analysis_roi: dict | None,
    expected_signal_keys: set[str],
    person_threshold: float,
    frame_samples: int,
    sample_interval_ms: int,
    capture_camera_frame_fn,
    apply_analysis_roi_to_frame_fn,
    detect_with_local_detector_fn,
    camera_capture_error_cls,
    camera_roi_error_cls,
    local_detector_error_cls,
) -> dict:
    attempts = max(1, min(int(frame_samples or 1), 5))
    interval_ms = max(0, min(int(sample_interval_ms or 0), 2000))

    best_frame = None
    best_result = None
    best_person_confidence = -1.0

    for index in range(attempts):
        try:
            frame = capture_camera_frame_fn(camera)
        except camera_capture_error_cls as exc:
            return {
                "frame": None,
                "result": None,
                "best_person_confidence": 0.0,
                "attempts": index + 1,
                "error": f"capture failed: {exc}",
            }
        try:
            frame, _ = apply_analysis_roi_to_frame_fn(frame, analysis_roi)
        except camera_roi_error_cls as exc:
            return {
                "frame": None,
                "result": None,
                "best_person_confidence": 0.0,
                "attempts": index + 1,
                "error": f"ROI crop failed: {exc}",
            }

        try:
            local_result = detect_with_local_detector_fn(
                camera=camera,
                expected_signal_keys=expected_signal_keys,
                person_threshold=person_threshold,
                frame=frame,
                analysis_roi=None,
            )
        except local_detector_error_cls as exc:
            return {
                "frame": None,
                "result": None,
                "best_person_confidence": 0.0,
                "attempts": index + 1,
                "error": str(exc),
            }

        person_confidence = float((local_result.signals or {}).get("person") or 0.0)
        if person_confidence >= best_person_confidence:
            best_person_confidence = person_confidence
            best_frame = frame
            best_result = local_result

        if local_result.passed:
            return {
                "frame": frame,
                "result": local_result,
                "best_person_confidence": person_confidence,
                "attempts": index + 1,
                "error": None,
            }

        if index < attempts - 1 and interval_ms > 0:
            time.sleep(interval_ms / 1000.0)

    return {
        "frame": best_frame,
        "result": best_result,
        "best_person_confidence": max(best_person_confidence, 0.0),
        "attempts": attempts,
        "error": None,
    }


def infer_expected_signal_keys(*, strategy_snapshot: dict) -> set[str]:
    mapping = strategy_snapshot.get("signal_mapping")
    if isinstance(mapping, dict) and mapping:
        return {str(key).strip().lower() for key in mapping.keys() if str(key).strip()}
    return {"person", "fire", "leak"}


def resolve_precheck_config(
    *,
    raw_config: dict | None,
    defaults: dict[str, float | int],
) -> dict[str, float | int]:
    config = raw_config if isinstance(raw_config, dict) else {}
    person_threshold = float(config.get("person_threshold", defaults["person_threshold"]))
    soft_negative_threshold = float(config.get("soft_negative_threshold", defaults["soft_negative_threshold"]))
    state_ttl_seconds = int(config.get("state_ttl_seconds", defaults["state_ttl_seconds"]))
    refresh_interval_seconds = int(config.get("refresh_interval_seconds", defaults["refresh_interval_seconds"]))
    frame_samples = int(config.get("frame_samples", defaults["frame_samples"]))
    sample_interval_ms = int(config.get("sample_interval_ms", defaults["sample_interval_ms"]))

    if person_threshold < 0 or person_threshold > 1:
        person_threshold = float(defaults["person_threshold"])
    if soft_negative_threshold < 0 or soft_negative_threshold > 1:
        soft_negative_threshold = float(defaults["soft_negative_threshold"])
    if state_ttl_seconds < 1:
        state_ttl_seconds = int(defaults["state_ttl_seconds"])
    if refresh_interval_seconds < 0:
        refresh_interval_seconds = int(defaults["refresh_interval_seconds"])
    if frame_samples < 1:
        frame_samples = int(defaults["frame_samples"])
    if frame_samples > 5:
        frame_samples = 5
    if sample_interval_ms < 0:
        sample_interval_ms = 0
    if sample_interval_ms > 2000:
        sample_interval_ms = 2000

    return {
        "person_threshold": person_threshold,
        "soft_negative_threshold": soft_negative_threshold,
        "state_ttl_seconds": state_ttl_seconds,
        "refresh_interval_seconds": refresh_interval_seconds,
        "frame_samples": frame_samples,
        "sample_interval_ms": sample_interval_ms,
    }


def resolve_precheck_match(
    *,
    normalized_json: dict,
    strategy_snapshot: dict,
    extract_signals_fn,
    signal_threshold: float,
) -> bool:
    direct = _resolve_direct_precheck_flag(normalized_json)
    if direct is not None:
        return direct

    signals = extract_signals_fn(normalized_json=normalized_json, strategy_snapshot=strategy_snapshot)
    for signal_key, confidence in signals.items():
        if signal_key == "person_fire":
            continue
        if float(confidence or 0) >= signal_threshold:
            return True
    return False


def _extract_rule_signal_keys(rule) -> set[str]:
    mode = str(rule.match_mode or "simple").strip().lower()
    if mode == "expression":
        return _extract_expression_signal_keys(rule.expression_json)

    key = str(rule.event_key or rule.event_type or "").strip().lower()
    if not key or key == "custom":
        return set()
    return {key}


def _extract_expression_signal_keys(expression_json: dict | None) -> set[str]:
    keys: set[str] = set()
    if not isinstance(expression_json, dict):
        return keys

    def walk(node: object) -> None:
        if isinstance(node, dict):
            signal_key = node.get("signal")
            if isinstance(signal_key, str) and signal_key.strip():
                keys.add(signal_key.strip().lower())
            child = node.get("condition")
            if child is not None:
                walk(child)
            conditions = node.get("conditions")
            if isinstance(conditions, list):
                for item in conditions:
                    walk(item)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(expression_json)
    return keys


def _resolve_direct_precheck_flag(payload: dict) -> bool | None:
    candidates = (
        "should_trigger",
        "should_execute",
        "matched",
        "is_matched",
        "triggered",
        "hit",
        "pass",
    )
    for key in candidates:
        if key not in payload:
            continue
        value = payload[key]
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return float(value) > 0
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "yes", "1", "matched", "hit", "pass"}:
                return True
            if normalized in {"false", "no", "0", "unmatched", "miss"}:
                return False
    return None
