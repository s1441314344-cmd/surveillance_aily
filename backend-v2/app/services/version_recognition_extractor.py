from io import BytesIO
import re
import unicodedata

from PIL import Image

from app.services.version_recognition_templates import VersionRecognitionTemplate

_VERSION_DECIMAL_TAIL_SEGMENT_RE = re.compile(r"^(\d+\.\d)(?:\([A-Z0-9]+\))?$")
_VERSION_DECIMAL_WITH_SUFFIX_RE = re.compile(r"^(\d+\.\d)(?:\([A-Z0-9]+\))?([A-Z0-9]+)$")
_NOISE_DECIMAL_SUFFIX_RE = re.compile(
    r"^(?:\d{2,}|[A-Z]{2,}\d+[A-Z0-9]*|\d+[A-Z]{2,}[A-Z0-9]*|(?:MM|CM|ML|MG|KG|KCAL|KJ|G)\d*[A-Z0-9]*)+$"
)
_LEGAL_TAIL_SUFFIX_RE = re.compile(r"^[A-Z0-9]{1,14}(?:\([A-Z0-9]{1,10}\))?$")
_PREFIX_STANDARD_NOISE_RE = re.compile(r"^(?:SC|GB|DB|QB|FSC)\d{2,}[A-Z0-9]*$")
_PREFIX_NUMERIC_NOISE_RE = re.compile(r"^\d{4,}[A-Z0-9]*$")
_NUMERIC_GLUE_PREFIX_RE = re.compile(r"^\d{6,}([A-Z]{2,}[A-Z0-9]*)$")
_LEGAL_LONG_SUFFIX_WHITELIST = {
    "XXLYPYM",
    "XLYPYM",
    "XLYP",
    "YPYM",
    "WZRY",
    "DZPD",
    "JWYB",
    "YXDS",
    "HPJY",
    "NQR",
    "TC",
    "SD",
    "YX",
    "FQ",
    "BW",
    "CQ",
}
_PREFIX_NOISE_WORDS = {
    "ABSOLUT",
    "VODKA",
    "PLEASE",
    "HIGH",
    "SATURATEDFAT",
    "REFRIGERATEAT",
    "ENERGY",
    "PROTEIN",
    "FAT",
    "CARBOHYDRATE",
    "SODIUM",
    "SHELFLIFE",
    "TOTALFAT",
    "SATURATEDFAT",
    "REFRIGERATEAT",
    "RAPPORT",
    "DAYS",
    "WATER",
}
_CHAR_CONFUSION_SEGMENT_MAP = {
    "WOXR": "WXR",
    "BO": "BQ",
    "BOBSW": "BQBSW",
    "1CE": "ICE",
    "0B": "DB",
    "VW": "YW",
}


def crop_image_for_template(*, image_bytes: bytes, template: VersionRecognitionTemplate) -> bytes:
    return crop_image_by_roi(image_bytes=image_bytes, roi=template.roi)


def crop_image_by_roi(*, image_bytes: bytes, roi: dict[str, float]) -> bytes:
    image = Image.open(BytesIO(image_bytes))
    width, height = image.size
    left = max(0, min(width, int(width * roi["x"])))
    top = max(0, min(height, int(height * roi["y"])))
    crop_width = max(1, int(width * roi["width"]))
    crop_height = max(1, int(height * roi["height"]))
    right = max(left + 1, min(width, left + crop_width))
    bottom = max(top + 1, min(height, top + crop_height))

    cropped = image.crop((left, top, right, bottom))
    buffer = BytesIO()
    cropped.save(buffer, format=image.format or "PNG")
    return buffer.getvalue()


def rotate_image_bytes(*, image_bytes: bytes, angle: int) -> bytes:
    image = Image.open(BytesIO(image_bytes))
    rotated = image.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    buffer = BytesIO()
    rotated.save(buffer, format=image.format or "PNG")
    return buffer.getvalue()


def extract_version_recognition_result(
    *,
    lines: list[dict],
    template: VersionRecognitionTemplate,
    roi_applied: bool,
    context_hint: str | None = None,
) -> dict:
    candidates: list[dict] = []

    line_entries = _build_line_entries(lines)
    stitched_entries = _build_stitched_entries(line_entries, template=template)
    all_entries = line_entries + stitched_entries

    for entry in all_entries:
        original_text = str(entry["text"])
        normalized_line = str(entry["normalized_text"])
        confidence = float(entry["confidence"])
        bbox = entry["bbox"]

        for pattern in template.regex_patterns:
            for match in pattern.finditer(normalized_line):
                candidate_text = _normalize_candidate(match.group(0), template=template)
                if not _looks_like_version(candidate_text, template=template):
                    continue
                candidates.append(
                    {
                        "text": original_text,
                        "normalized_text": candidate_text,
                        "score": _score_candidate(
                            candidate_text,
                            confidence,
                            template=template,
                            context_hint=context_hint,
                            is_relaxed_pattern=False,
                        ),
                        "confidence": confidence,
                        "bbox": bbox,
                    }
                )

        for pattern in template.relaxed_regex_patterns:
            for match in pattern.finditer(normalized_line):
                candidate_text = _normalize_candidate(match.group(0), template=template)
                if not _looks_like_version(candidate_text, template=template):
                    continue
                candidates.append(
                    {
                        "text": original_text,
                        "normalized_text": candidate_text,
                        "score": _score_candidate(
                            candidate_text,
                            confidence,
                            template=template,
                            context_hint=context_hint,
                            is_relaxed_pattern=True,
                        ),
                        "confidence": confidence,
                        "bbox": bbox,
                    }
                )

    deduped_candidates = _dedupe_candidates(candidates)
    if not deduped_candidates:
        return {
            "recognized_version": None,
            "extraction_status": "not_found",
            "summary": "未识别到版本号",
            "candidates": [],
            "template_key": template.key,
            "roi_applied": roi_applied,
        }

    ordered_candidates = sorted(
        deduped_candidates,
        key=lambda item: (-float(item["score"]), -float(item["confidence"]), item["normalized_text"]),
    )
    top_candidate = ordered_candidates[0]
    if len(ordered_candidates) > 1:
        score_gap = float(top_candidate["score"]) - float(ordered_candidates[1]["score"])
        if score_gap <= template.ambiguous_score_delta:
            return {
                "recognized_version": None,
                "extraction_status": "ambiguous",
                "summary": "检测到多个版本号候选，无法稳定判定",
                "candidates": ordered_candidates,
                "template_key": template.key,
                "roi_applied": roi_applied,
            }

    if (
        float(top_candidate["score"]) < float(template.min_match_score)
        or float(top_candidate["confidence"]) < float(template.min_match_confidence)
    ):
        return {
            "recognized_version": None,
            "extraction_status": "ambiguous",
            "summary": "检测到版本号候选，但置信度不足，建议补拍更清晰图片",
            "candidates": ordered_candidates,
            "template_key": template.key,
            "roi_applied": roi_applied,
        }

    return {
        "recognized_version": top_candidate["normalized_text"],
        "extraction_status": "matched",
        "summary": f"已识别版本号：{top_candidate['normalized_text']}",
        "candidates": ordered_candidates,
        "template_key": template.key,
        "roi_applied": roi_applied,
    }


def normalize_version_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text or "").upper()
    normalized = normalized.replace("（", "(").replace("）", ")")
    normalized = normalized.replace("【", "(").replace("】", ")")
    normalized = normalized.replace("—", "-").replace("–", "-")
    normalized = normalized.replace("_", "-").replace("－", "-")
    normalized = normalized.replace("／", "-").replace("/", "-")
    normalized = normalized.replace("　", " ")
    normalized = re.sub(r"\s+", "", normalized)
    normalized = re.sub(r"-{2,}", "-", normalized)
    normalized = re.sub(r"(?<=\d)[OQ](?=\d)", "0", normalized)
    normalized = re.sub(r"(?<=\d)[IL](?=\d)", "1", normalized)
    normalized = re.sub(r"(?<=\d)S(?=\d)", "5", normalized)
    normalized = re.sub(r"(?<=\d)Z(?=\d)", "2", normalized)
    normalized = re.sub(r"(?<=\d)B(?=\d)", "8", normalized)
    return normalized


def _looks_like_version(text: str, *, template: VersionRecognitionTemplate) -> bool:
    if "-" not in text:
        return False
    if not any(char.isalpha() for char in text):
        return False
    if not any(char.isdigit() for char in text):
        return False
    if not _has_decimal_tail_segment(text):
        return False
    segments = [segment for segment in text.split("-") if segment]
    min_segment_count = _required_min_segments(segments, template=template)
    if len(segments) < min_segment_count:
        return False
    if segments and segments[0].isdigit():
        return False
    first_segment = segments[0] if segments else ""
    if "." in first_segment:
        return False
    if any(char.isdigit() for char in first_segment) and first_segment not in template.trusted_prefixes:
        return False
    if _looks_like_nutrition_noise(segments, template=template):
        return False
    return True


def _score_candidate(
    normalized_text: str,
    confidence: float,
    *,
    template: VersionRecognitionTemplate,
    context_hint: str | None,
    is_relaxed_pattern: bool,
) -> float:
    segments = [segment for segment in normalized_text.split("-") if segment]
    prefix = segments[0] if segments else ""
    required_min_segments = _required_min_segments(segments, template=template)
    length_score = min(len(normalized_text) / 36, 1.0)
    segment_score = min(max(len(segments) - 1, 0) / 6, 1.0)
    mixed_bonus = 1.0 if any(char.isalpha() for char in normalized_text) and any(char.isdigit() for char in normalized_text) else 0.0
    suffix_bonus = 1.0 if normalized_text.endswith(")") and "(" in normalized_text else 0.0
    decimal_bonus = 1.0 if "." in normalized_text else 0.0
    trusted_prefix_bonus = 1.0 if prefix in template.trusted_prefixes else 0.0
    context_hint_bonus = _context_hint_bonus(normalized_text, context_hint)
    structure_penalty = 1.0 if len(segments) < required_min_segments else 0.0
    numeric_prefix_penalty = 1.0 if prefix.isdigit() else 0.0
    relaxed_penalty = 1.0 if is_relaxed_pattern else 0.0
    score = (
        (length_score * 0.14)
        + (segment_score * 0.12)
        + (mixed_bonus * 0.08)
        + (suffix_bonus * 0.05)
        + (decimal_bonus * 0.05)
        + (confidence * 0.45)
        + (trusted_prefix_bonus * 0.1)
        + (context_hint_bonus * 0.12)
        - (structure_penalty * 0.24)
        - (numeric_prefix_penalty * 0.18)
        - (relaxed_penalty * 0.05)
    )
    return round(max(0.0, min(1.0, score)), 6)


def _normalize_confidence(value: object) -> float:
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, numeric_value))


def _dedupe_candidates(candidates: list[dict]) -> list[dict]:
    best_by_text: dict[str, dict] = {}
    for candidate in candidates:
        key = str(candidate["normalized_text"])
        current = best_by_text.get(key)
        if current is None or float(candidate["score"]) > float(current["score"]):
            best_by_text[key] = candidate
    return list(best_by_text.values())


def _build_line_entries(lines: list[dict]) -> list[dict]:
    entries: list[dict] = []
    for line in lines:
        original_text = str(line.get("text") or "")
        normalized_line = normalize_version_text(original_text)
        if not normalized_line:
            continue
        entries.append(
            {
                "text": original_text,
                "normalized_text": normalized_line,
                "confidence": _normalize_confidence(line.get("confidence")),
                "bbox": line.get("bbox"),
            }
        )
    return entries


def _build_stitched_entries(entries: list[dict], *, template: VersionRecognitionTemplate) -> list[dict]:
    stitched: list[dict] = []
    total = len(entries)
    for start in range(total):
        for window_size in (2, 3):
            end = start + window_size
            if end > total:
                continue
            chunk = entries[start:end]
            chunk_parts = [str(item["normalized_text"]) for item in chunk if str(item["normalized_text"])]
            if len(chunk_parts) < 2:
                continue
            if any(len(part) > 36 for part in chunk_parts):
                continue
            if all(_is_complete_version_like(part) for part in chunk_parts):
                continue
            stitched_text_variants = (
                _combine_parts(chunk_parts, force_hyphen=False),
                _combine_parts(chunk_parts, force_hyphen=True),
            )
            for stitched_text in stitched_text_variants:
                normalized_stitched = _normalize_candidate(stitched_text, template=template)
                if len(normalized_stitched) < 8:
                    continue
                stitched.append(
                    {
                        "text": " ".join(str(item["text"]) for item in chunk),
                        "normalized_text": normalized_stitched,
                        "confidence": min(float(item["confidence"]) for item in chunk),
                        "bbox": chunk[0]["bbox"],
                    }
                )
    return stitched


def _combine_parts(parts: list[str], *, force_hyphen: bool) -> str:
    combined = parts[0]
    for part in parts[1:]:
        left = combined.rstrip("-")
        right = part.lstrip("-")
        if force_hyphen:
            combined = f"{left}-{right}"
            continue
        if combined.endswith("-") or part.startswith("-"):
            combined = f"{left}-{right}"
            continue
        combined = f"{combined}{part}"
    return re.sub(r"-{2,}", "-", combined).strip("-")


def _normalize_candidate(text: str, *, template: VersionRecognitionTemplate | None = None) -> str:
    candidate = normalize_version_text(text)
    candidate = _truncate_by_decimal_tail(candidate)
    if template is not None:
        candidate = _extract_embedded_trusted_prefix(candidate, template=template)
        candidate = _strip_numeric_glued_prefix(candidate)
        candidate = _strip_noise_prefix(candidate, template=template)
        candidate = _repair_common_char_confusions(candidate)
        candidate = _truncate_by_decimal_tail(candidate)
    candidate = re.sub(r"[^A-Z0-9\-\.\(\)\*]", "", candidate)
    if "(" in candidate and not candidate.endswith(")"):
        candidate = candidate.replace("(", "-").replace(")", "")
    candidate = re.sub(r"-{2,}", "-", candidate).strip("-")
    return candidate


def _context_hint_bonus(candidate: str, context_hint: str | None) -> float:
    if not context_hint:
        return 0.0
    normalized_hint = normalize_version_text(context_hint)
    if not normalized_hint:
        return 0.0
    if candidate in normalized_hint:
        return 1.0
    candidate_segments = [segment for segment in candidate.split("-") if segment]
    if not candidate_segments:
        return 0.0
    matched_segment_count = sum(
        1 for segment in candidate_segments if len(segment) >= 2 and segment in normalized_hint
    )
    return min(matched_segment_count / 3.0, 1.0)


def _is_complete_version_like(text: str) -> bool:
    segments = [segment for segment in text.split("-") if segment]
    return (
        len(segments) >= 3
        and any(char.isalpha() for char in text)
        and any(char.isdigit() for char in text)
    )


def _truncate_by_decimal_tail(text: str) -> str:
    segments = [segment for segment in text.split("-") if segment]
    if not segments:
        return text

    fallback_decimal_segments: tuple[list[str], int] | None = None
    for index, segment in enumerate(segments):
        if _VERSION_DECIMAL_TAIL_SEGMENT_RE.fullmatch(segment):
            return _collect_decimal_tail_segments(segments, decimal_index=index)

        match = _VERSION_DECIMAL_WITH_SUFFIX_RE.fullmatch(segment)
        if match is None:
            continue

        decimal_part = str(match.group(1))
        suffix_part = str(match.group(2))
        rebuilt_segments = list(segments)
        rebuilt_segments[index] = decimal_part
        if _is_legal_tail_suffix_segment(suffix_part):
            rebuilt_segments.insert(index + 1, suffix_part)
            return _collect_decimal_tail_segments(rebuilt_segments, decimal_index=index)
        if fallback_decimal_segments is None:
            fallback_decimal_segments = (rebuilt_segments, index)

    if fallback_decimal_segments is not None:
        fallback_segments, fallback_index = fallback_decimal_segments
        return _collect_decimal_tail_segments(fallback_segments, decimal_index=fallback_index)
    return text


def _has_decimal_tail_segment(text: str) -> bool:
    segments = [segment for segment in text.split("-") if segment]
    return any(_VERSION_DECIMAL_TAIL_SEGMENT_RE.fullmatch(segment) for segment in segments)


def _collect_decimal_tail_segments(segments: list[str], *, decimal_index: int) -> str:
    kept_segments = segments[: decimal_index + 1]
    for segment in segments[decimal_index + 1 :]:
        if _is_legal_tail_suffix_segment(segment):
            kept_segments.append(segment)
            continue
        break
    return "-".join(kept_segments)


def _is_legal_tail_suffix_segment(segment: str) -> bool:
    if not segment:
        return False
    if _NOISE_DECIMAL_SUFFIX_RE.fullmatch(segment):
        return False
    if segment.isdigit():
        return False
    if not _LEGAL_TAIL_SUFFIX_RE.fullmatch(segment):
        return False
    segment_without_brackets = segment.replace("(", "").replace(")", "")
    if len(segment_without_brackets) < 2:
        return False
    if segment_without_brackets.isalpha() and len(segment_without_brackets) > 5:
        return segment_without_brackets in _LEGAL_LONG_SUFFIX_WHITELIST
    return any(char.isalpha() for char in segment_without_brackets)


def _strip_noise_prefix(text: str, *, template: VersionRecognitionTemplate) -> str:
    segments = [segment for segment in text.split("-") if segment]
    minimum_retained = max(3, template.min_segment_count - 1)
    if len(segments) < minimum_retained:
        return text

    best_start = 0
    best_priority = 0
    max_start = len(segments) - minimum_retained
    for start in range(1, max_start + 1):
        leading_segments = segments[:start]
        if not leading_segments or not all(
            _is_prefix_noise_segment(segment, template=template) for segment in leading_segments
        ):
            continue

        trimmed_segments = segments[start:]
        trimmed_text = "-".join(trimmed_segments)
        if not _looks_like_version(trimmed_text, template=template):
            continue

        prefix = trimmed_segments[0]
        priority = 2 if prefix in template.trusted_prefixes else 1
        if priority > best_priority:
            best_priority = priority
            best_start = start

    if best_start <= 0:
        return text
    return "-".join(segments[best_start:])


def _is_prefix_noise_segment(segment: str, *, template: VersionRecognitionTemplate) -> bool:
    if not segment:
        return True
    if segment in template.trusted_prefixes:
        return False
    if segment in _PREFIX_NOISE_WORDS:
        return True
    if _PREFIX_STANDARD_NOISE_RE.fullmatch(segment):
        return True
    if _PREFIX_NUMERIC_NOISE_RE.fullmatch(segment):
        return True
    if len(segment) == 1 and segment.isalpha():
        return True
    if (
        len(segment) >= 5
        and any(char.isalpha() for char in segment)
        and any(char.isdigit() for char in segment)
    ):
        return True
    return bool(segment.isalpha() and len(segment) >= 8)


def _repair_common_char_confusions(text: str) -> str:
    segments = [segment for segment in text.split("-") if segment]
    if not segments:
        return text

    repaired_segments = [_repair_confusion_segment(segment) for segment in segments]
    return "-".join(repaired_segments)


def _repair_confusion_segment(segment: str) -> str:
    mapped = _CHAR_CONFUSION_SEGMENT_MAP.get(segment)
    if mapped is not None:
        return mapped
    if segment == "Q":
        return "YQ"
    if segment.startswith("YQ5"):
        return f"YQS{segment[3:]}"
    if re.fullmatch(r"VQ[A-Z]{1,4}", segment):
        return f"YQ{segment[2:]}"
    if re.fullmatch(r"Q[ABC]", segment):
        return f"Y{segment}"
    return segment


def _strip_numeric_glued_prefix(text: str) -> str:
    segments = [segment for segment in text.split("-") if segment]
    if not segments:
        return text
    first_segment = segments[0]
    match = _NUMERIC_GLUE_PREFIX_RE.fullmatch(first_segment)
    if match is None:
        return text
    suffix = str(match.group(1))
    if suffix in _PREFIX_NOISE_WORDS:
        return text
    segments[0] = suffix
    return "-".join(segments)


def _extract_embedded_trusted_prefix(text: str, *, template: VersionRecognitionTemplate) -> str:
    segments = [segment for segment in text.split("-") if segment]
    if not segments:
        return text

    trusted_prefixes = sorted(template.trusted_prefixes, key=len, reverse=True)
    for index, segment in enumerate(segments):
        for prefix in trusted_prefixes:
            if segment == prefix or not segment.endswith(prefix):
                continue
            leading = segment[: -len(prefix)]
            if not leading:
                continue
            if (
                _PREFIX_NUMERIC_NOISE_RE.fullmatch(leading)
                or (len(leading) >= 3 and any(ch.isdigit() for ch in leading) and any(ch.isalpha() for ch in leading))
            ):
                segments[index] = prefix
                return "-".join(segments)
    return text


def _looks_like_nutrition_noise(segments: list[str], *, template: VersionRecognitionTemplate) -> bool:
    if not segments:
        return False
    if segments[0] in template.trusted_prefixes:
        return False
    if any(segment in template.trusted_prefixes for segment in segments[1:]):
        return False

    noise_hits = 0
    for segment in segments:
        for noise_word in _PREFIX_NOISE_WORDS:
            if segment.startswith(noise_word):
                noise_hits += 1
                break
        if re.search(r"(?:MM|ML|KCAL|KJ|DAYS|DAY)$", segment):
            noise_hits += 1

    return noise_hits >= 2


def _required_min_segments(segments: list[str], *, template: VersionRecognitionTemplate) -> int:
    if not segments:
        return template.min_segment_count
    if len(segments) >= template.min_segment_count:
        return template.min_segment_count

    if len(segments) == 3:
        first_segment = segments[0]
        middle_segment = segments[1]
        if first_segment in template.trusted_prefixes and len(middle_segment) >= 3 and middle_segment.isalnum():
            return 3
    return template.min_segment_count
