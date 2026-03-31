from __future__ import annotations

from collections.abc import Mapping


KNOWN_SIGNAL_KEYS = {"person", "fire", "leak", "person_fire"}


def extract_signals(*, normalized_json: dict | None, strategy_snapshot: dict | None = None) -> dict[str, float]:
    payload = normalized_json if isinstance(normalized_json, dict) else {}
    strategy_snapshot = strategy_snapshot if isinstance(strategy_snapshot, dict) else {}

    # Preferred shape: {"signals": {"person": 0.9, "fire": 0.2}}
    nested_signals = payload.get("signals")
    if isinstance(nested_signals, Mapping):
        parsed = _coerce_signal_map(nested_signals)
        if parsed:
            return _with_derived_signals(parsed)

    mapping = strategy_snapshot.get("signal_mapping")
    if isinstance(mapping, Mapping) and mapping:
        mapped: dict[str, float] = {}
        for signal_key, mapping_rule in mapping.items():
            dot_path = None
            if isinstance(mapping_rule, str):
                dot_path = mapping_rule.strip()
            elif isinstance(mapping_rule, Mapping):
                dot_path = str(mapping_rule.get("path") or mapping_rule.get("dot_path") or "").strip()
            if not dot_path:
                continue
            resolved = _resolve_dot_path(payload, dot_path)
            if resolved is None:
                continue
            mapped[str(signal_key).strip().lower()] = _coerce_confidence(resolved)
        if mapped:
            return _with_derived_signals(mapped)

    inferred = _infer_signals_from_payload(payload)
    return _with_derived_signals(inferred)


def _infer_signals_from_payload(payload: dict) -> dict[str, float]:
    signals: dict[str, float] = {}

    for key in KNOWN_SIGNAL_KEYS:
        if key in payload:
            signals[key] = _coerce_confidence(payload[key])

    detections = payload.get("detections")
    if isinstance(detections, list):
        for item in detections:
            if not isinstance(item, Mapping):
                continue
            raw_label = str(item.get("label") or item.get("name") or "").strip().lower()
            if not raw_label:
                continue
            confidence = _coerce_confidence(item.get("confidence"))
            if raw_label in {"person", "human"}:
                signals["person"] = max(signals.get("person", 0.0), confidence)
            if raw_label in {"fire", "flame", "smoke", "fire_or_smoke"}:
                signals["fire"] = max(signals.get("fire", 0.0), confidence)
            if raw_label in {"leak", "water_leak", "liquid_leak"}:
                signals["leak"] = max(signals.get("leak", 0.0), confidence)

    return signals


def _coerce_signal_map(values: Mapping) -> dict[str, float]:
    parsed: dict[str, float] = {}
    for raw_key, raw_value in values.items():
        key = str(raw_key).strip().lower()
        if not key:
            continue
        parsed[key] = _coerce_confidence(raw_value)
    return parsed


def _resolve_dot_path(payload: dict, dot_path: str):
    current = payload
    for part in dot_path.split("."):
        if not isinstance(current, Mapping):
            return None
        if part not in current:
            return None
        current = current[part]
    return current


def _coerce_confidence(value) -> float:
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return 0.0
    if parsed < 0:
        return 0.0
    if parsed > 1:
        return 1.0
    return parsed


def _with_derived_signals(signals: dict[str, float]) -> dict[str, float]:
    merged = dict(signals)
    person = merged.get("person", 0.0)
    fire = merged.get("fire", 0.0)
    merged["person_fire"] = min(person, fire)
    return merged
