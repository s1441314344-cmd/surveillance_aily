from dataclasses import dataclass
import re


@dataclass(frozen=True)
class VersionRecognitionTemplate:
    key: str
    roi: dict[str, float]
    regex_patterns: tuple[re.Pattern[str], ...]
    relaxed_regex_patterns: tuple[re.Pattern[str], ...]
    fallback_rois: tuple[tuple[str, dict[str, float]], ...]
    rotation_angles: tuple[int, ...]
    trusted_prefixes: tuple[str, ...]
    min_match_score: float = 0.62
    min_match_confidence: float = 0.2
    min_segment_count: int = 4
    ambiguous_score_delta: float = 0.02


DEFAULT_VERSION_RECOGNITION_TEMPLATE = VersionRecognitionTemplate(
    key="default-version-template",
    roi={
        "x": 0.08,
        "y": 0.2,
        "width": 0.84,
        "height": 0.5,
    },
    regex_patterns=(
        re.compile(r"[A-Z0-9]+(?:-[A-Z0-9.]+){2,}(?:\([A-Z0-9]+\))?"),
        re.compile(r"[A-Z]{1,}[A-Z0-9.]*-[A-Z0-9.]+(?:-[A-Z0-9.]+)+(?:\([A-Z0-9]+\))?"),
    ),
    relaxed_regex_patterns=(
        re.compile(r"[A-Z0-9]+(?:-[A-Z0-9.()]+){1,}"),
        re.compile(r"[A-Z0-9]+(?:-[A-Z0-9.()]+)+(?:\([A-Z0-9]+\))?"),
    ),
    fallback_rois=(
        ("right_bottom", {"x": 0.55, "y": 0.55, "width": 0.42, "height": 0.4}),
        ("left_bottom", {"x": 0.03, "y": 0.55, "width": 0.42, "height": 0.4}),
        ("right_top", {"x": 0.55, "y": 0.03, "width": 0.42, "height": 0.35}),
        ("left_top", {"x": 0.03, "y": 0.03, "width": 0.42, "height": 0.35}),
    ),
    rotation_angles=(90, 270),
    trusted_prefixes=(
        "BQ",
        "ZX",
        "WXR",
        "PE",
        "PG",
        "BSB",
        "LG",
        "BHMC",
        "ZZX",
        "CNN",
        "XGN",
        "BSW",
        "WB",
        "XG",
        "DC",
        "XSN",
        "CMNN",
        "GGN",
        "CWN",
        "MGNN",
        "BQBSW",
        "RY",
        "LS",
        "PP",
        "YSJ",
        "NCNL",
        "TNN",
        "YL",
        "JLB",
        "QXLR",
        "MKTG",
    ),
)
