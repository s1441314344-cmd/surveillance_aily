from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass
class ExpressionEvalResult:
    matched: bool
    reason: str


ALLOWED_COMPARATORS = {"gte", "lte", "gt", "lt", "eq"}


def evaluate_expression(
    expression: dict | None,
    *,
    signals: dict[str, float],
    consecutive_hits: dict[str, int],
) -> ExpressionEvalResult:
    if not isinstance(expression, Mapping):
        return ExpressionEvalResult(matched=False, reason="表达式为空")

    matched, reason = _evaluate_node(expression, signals=signals, consecutive_hits=consecutive_hits)
    return ExpressionEvalResult(matched=matched, reason=reason)


def _evaluate_node(
    node: Mapping,
    *,
    signals: dict[str, float],
    consecutive_hits: dict[str, int],
) -> tuple[bool, str]:
    op = str(node.get("op") or "").strip().lower()
    if op in {"and", "or"}:
        children = node.get("conditions")
        if not isinstance(children, list) or not children:
            return False, f"{op.upper()} 条件为空"
        child_results = [
            _evaluate_node(child, signals=signals, consecutive_hits=consecutive_hits)
            for child in children
            if isinstance(child, Mapping)
        ]
        if not child_results:
            return False, f"{op.upper()} 条件为空"
        if op == "and":
            failed = [reason for matched, reason in child_results if not matched]
            return (len(failed) == 0, " AND ".join(failed) if failed else "AND 命中")
        passed = [reason for matched, reason in child_results if matched]
        return (len(passed) > 0, passed[0] if passed else "OR 未命中")

    if op == "not":
        child = node.get("condition")
        if not isinstance(child, Mapping):
            return False, "NOT 条件为空"
        child_matched, child_reason = _evaluate_node(child, signals=signals, consecutive_hits=consecutive_hits)
        return (not child_matched, f"NOT({child_reason})")

    return _evaluate_predicate(node, signals=signals, consecutive_hits=consecutive_hits)


def _evaluate_predicate(
    node: Mapping,
    *,
    signals: dict[str, float],
    consecutive_hits: dict[str, int],
) -> tuple[bool, str]:
    signal_key = str(node.get("signal") or node.get("event_key") or "").strip().lower()
    if not signal_key:
        return False, "缺少 signal"

    operator = str(node.get("operator") or node.get("op") or "gte").strip().lower()
    if operator not in ALLOWED_COMPARATORS:
        return False, f"不支持的比较符 {operator}"

    value = _to_float(node.get("value", node.get("threshold", node.get("target"))), default=0.0)
    confidence = _to_float(signals.get(signal_key), default=0.0)
    consecutive_required = max(
        int(_to_float(node.get("min_consecutive", node.get("minConsecutive")), default=1)),
        1,
    )
    consecutive_actual = max(int(consecutive_hits.get(signal_key, 0)), 0)

    compare_ok = _compare(confidence, operator, value)
    consecutive_ok = consecutive_actual >= consecutive_required
    if compare_ok and consecutive_ok:
        return True, f"{signal_key} 命中({confidence:.3f} {operator} {value:.3f})"
    if not compare_ok:
        return False, f"{signal_key} 阈值未命中({confidence:.3f} {operator} {value:.3f})"
    return False, f"{signal_key} 连续帧不足({consecutive_actual}/{consecutive_required})"


def _compare(left: float, operator: str, right: float) -> bool:
    if operator == "gte":
        return left >= right
    if operator == "lte":
        return left <= right
    if operator == "gt":
        return left > right
    if operator == "lt":
        return left < right
    return abs(left - right) < 1e-8


def _to_float(value, *, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
