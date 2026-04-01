from __future__ import annotations

import logging
import os
import time
import json
import subprocess
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger("local-detector")

DEFAULT_MODEL_URL = "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx"
DEFAULT_CORS_ORIGINS = ",".join(
    f"http://{host}:{port}"
    for port in range(5173, 5181)
    for host in ("localhost", "127.0.0.1")
)

MODEL_PATH = Path(os.getenv("DETECTOR_MODEL_PATH", "/tmp/models/yolox_nano.onnx"))
MODEL_URL = os.getenv("DETECTOR_MODEL_URL", DEFAULT_MODEL_URL).strip()
AUTO_DOWNLOAD = os.getenv("DETECTOR_AUTO_DOWNLOAD", "true").strip().lower() in {"1", "true", "yes", "on"}
INPUT_SIZE = int(os.getenv("DETECTOR_INPUT_SIZE", "416"))
SCORE_THRESHOLD = float(os.getenv("DETECTOR_SCORE_THRESHOLD", "0.2"))
NMS_THRESHOLD = float(os.getenv("DETECTOR_NMS_THRESHOLD", "0.45"))
DEFAULT_PERSON_THRESHOLD = float(os.getenv("DETECTOR_PERSON_THRESHOLD", "0.35"))
DETECTOR_CORS_ORIGINS = os.getenv("DETECTOR_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
DETECTOR_PREPROCESS_MODE = os.getenv("DETECTOR_PREPROCESS_MODE", "auto").strip().lower()
DETECTOR_MODEL_PROFILE = os.getenv("DETECTOR_MODEL_PROFILE", "speed").strip().lower()

VALID_PREPROCESS_MODES = {"auto", "bgr_255", "rgb_255", "bgr_01", "rgb_01"}
MODEL_PROFILE_PRESETS = {
    "speed": {
        "model_name": "yolox-nano-onnx",
        "model_path": "/tmp/models/yolox_nano.onnx",
        "model_url": "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx",
        "input_size": 416,
    },
    "balance": {
        "model_name": "yolox-s-onnx",
        "model_path": "/tmp/models/yolox_s.onnx",
        "model_url": "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.onnx",
        "input_size": 640,
    },
}


@dataclass
class RuntimeConfig:
    model_profile: str
    model_name: str
    model_path: str
    model_url: str
    auto_download: bool
    input_size: int
    preprocess_mode: str
    score_threshold: float
    nms_threshold: float
    default_person_threshold: float


class DetectorConfigUpdate(BaseModel):
    model_profile: Literal["speed", "balance", "custom"] | None = None
    preprocess_mode: Literal["auto", "bgr_255", "rgb_255", "bgr_01", "rgb_01"] | None = None
    score_threshold: float | None = Field(default=None, ge=0, le=1)
    nms_threshold: float | None = Field(default=None, ge=0, le=1)
    default_person_threshold: float | None = Field(default=None, ge=0, le=1)
    input_size: int | None = Field(default=None, ge=160, le=1280)
    model_name: str | None = None
    model_path: str | None = None
    model_url: str | None = None
    auto_download: bool | None = None


def _build_initial_runtime_config() -> RuntimeConfig:
    profile = DETECTOR_MODEL_PROFILE if DETECTOR_MODEL_PROFILE in MODEL_PROFILE_PRESETS else "custom"
    if profile in MODEL_PROFILE_PRESETS:
        preset = MODEL_PROFILE_PRESETS[profile]
        model_name = str(preset["model_name"])
        model_path = str(preset["model_path"])
        model_url = str(preset["model_url"])
        input_size = int(preset["input_size"])
    else:
        model_name = "custom-onnx"
        model_path = str(MODEL_PATH)
        model_url = MODEL_URL
        input_size = max(int(INPUT_SIZE), 160)
    preprocess_mode = DETECTOR_PREPROCESS_MODE if DETECTOR_PREPROCESS_MODE in VALID_PREPROCESS_MODES else "auto"
    return RuntimeConfig(
        model_profile=profile,
        model_name=model_name,
        model_path=model_path,
        model_url=model_url,
        auto_download=AUTO_DOWNLOAD,
        input_size=input_size,
        preprocess_mode=preprocess_mode,
        score_threshold=float(SCORE_THRESHOLD),
        nms_threshold=float(NMS_THRESHOLD),
        default_person_threshold=float(DEFAULT_PERSON_THRESHOLD),
    )


runtime_config = _build_initial_runtime_config()

app = FastAPI(title="Local Detector Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in DETECTOR_CORS_ORIGINS.split(",") if item.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DetectorEngine:
    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None
        self._input_name: str | None = None
        self._loaded_model_path: str | None = None
        self._lock = threading.RLock()

    @property
    def ready(self) -> bool:
        return self._session is not None and self._input_name is not None

    def ensure_ready(self) -> None:
        with self._lock:
            current_model_path = runtime_config.model_path
            if self.ready and self._loaded_model_path == current_model_path:
                return
            self._prepare_model()
            providers = ["CPUExecutionProvider"]
            try:
                self._session = ort.InferenceSession(str(runtime_config.model_path), providers=providers)
            except Exception as exc:
                # Self-heal corrupted ONNX cache files (common after interrupted downloads).
                error_text = str(exc)
                if runtime_config.auto_download and runtime_config.model_url and (
                    "INVALID_PROTOBUF" in error_text or "Protobuf parsing failed" in error_text
                ):
                    logger.warning("model file appears corrupted, forcing re-download: %s", current_model_path)
                    self._prepare_model(force_download=True)
                    self._session = ort.InferenceSession(str(runtime_config.model_path), providers=providers)
                else:
                    raise
            self._input_name = self._session.get_inputs()[0].name
            self._loaded_model_path = current_model_path

    def invalidate(self) -> None:
        with self._lock:
            self._session = None
            self._input_name = None
            self._loaded_model_path = None

    def detect(self, *, image_bgr: np.ndarray, person_threshold: float) -> dict[str, Any]:
        self.ensure_ready()
        assert self._session is not None
        assert self._input_name is not None

        started = time.perf_counter()
        input_tensor, ratio, preprocess_variant = _build_best_input_tensor(
            image_bgr=image_bgr,
            input_size=runtime_config.input_size,
            preprocess_mode=runtime_config.preprocess_mode,
            session=self._session,
            input_name=self._input_name,
        )
        output = self._session.run(None, {self._input_name: input_tensor})[0]
        detections = _postprocess(
            output=output,
            ratio=ratio,
            image_shape=image_bgr.shape[:2],
            input_size=runtime_config.input_size,
            score_threshold=runtime_config.score_threshold,
            nms_threshold=runtime_config.nms_threshold,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)

        person_confidence = 0.0
        mapped: list[dict[str, Any]] = []
        for det in detections:
            class_id = int(det["class_id"])
            confidence = float(det["confidence"])
            label = COCO_CLASSES[class_id] if 0 <= class_id < len(COCO_CLASSES) else f"class_{class_id}"
            if label == "person" and confidence > person_confidence:
                person_confidence = confidence
            mapped.append(
                {
                    "label": label,
                    "confidence": round(confidence, 4),
                    "bbox": det["bbox"],
                }
            )

        pass_detect = person_confidence >= max(min(person_threshold, 1.0), 0.0)
        reason = "person_detected" if pass_detect else f"person<{person_threshold:.2f}"
        return {
            "signals": {
                "person": round(person_confidence, 4),
            },
            "detections": mapped,
            "model_meta": {
                "model_name": runtime_config.model_name,
                "input_size": runtime_config.input_size,
                "preprocess_variant": preprocess_variant,
                "score_threshold": runtime_config.score_threshold,
                "nms_threshold": runtime_config.nms_threshold,
                "person_threshold": max(min(person_threshold, 1.0), 0.0),
                "latency_ms": latency_ms,
            },
            "decision": {
                "pass": pass_detect,
                "reason": reason,
            },
        }

    def _prepare_model(self, *, force_download: bool = False) -> None:
        model_path = Path(runtime_config.model_path)
        if model_path.exists() and not force_download:
            return
        if not runtime_config.auto_download:
            raise RuntimeError(f"model file not found: {model_path}")
        if not runtime_config.model_url:
            raise RuntimeError("DETECTOR_MODEL_URL is empty")
        model_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            tmp_path = model_path.with_suffix(f"{model_path.suffix}.download")
            if force_download and model_path.exists():
                model_path.unlink()
            last_error: Exception | None = None
            for attempt in range(1, 4):
                try:
                    if tmp_path.exists():
                        tmp_path.unlink()
                    subprocess.run(
                        [
                            "curl",
                            "-L",
                            "--fail",
                            "--retry",
                            "2",
                            "--retry-delay",
                            "1",
                            "--connect-timeout",
                            "10",
                            "--max-time",
                            "180",
                            "-o",
                            str(tmp_path),
                            runtime_config.model_url,
                        ],
                        check=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.PIPE,
                        text=True,
                    )
                    # Validate downloaded artifact before replacing active model file.
                    ort.InferenceSession(str(tmp_path), providers=["CPUExecutionProvider"])
                    tmp_path.replace(model_path)
                    return
                except Exception as exc:  # pragma: no cover - download instability path
                    last_error = exc
                    logger.warning("model download/validate failed attempt %s/3: %s", attempt, exc)
                    if tmp_path.exists():
                        tmp_path.unlink()
            raise RuntimeError(last_error or "unknown download error")
        except Exception as exc:  # pragma: no cover - network failure path
            raise RuntimeError(f"model download failed from {runtime_config.model_url}: {exc}") from exc


engine = DetectorEngine()


@app.on_event("startup")
def on_startup() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        engine.ensure_ready()
        logger.info("local detector ready with model=%s", runtime_config.model_path)
    except Exception as exc:  # pragma: no cover - startup environment dependent
        logger.warning("local detector startup failed: %s", exc)


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    if not engine.ready:
        try:
            engine.ensure_ready()
        except Exception as exc:
            return {"status": "degraded", "ready": False, "error": str(exc)}
    return {"status": "ok", "ready": True, "model_name": runtime_config.model_name}


@app.get("/v1/config")
def get_config() -> dict[str, Any]:
    return {
        "config": {
            "model_profile": runtime_config.model_profile,
            "model_name": runtime_config.model_name,
            "model_path": runtime_config.model_path,
            "model_url": runtime_config.model_url,
            "auto_download": runtime_config.auto_download,
            "input_size": runtime_config.input_size,
            "preprocess_mode": runtime_config.preprocess_mode,
            "score_threshold": runtime_config.score_threshold,
            "nms_threshold": runtime_config.nms_threshold,
            "default_person_threshold": runtime_config.default_person_threshold,
        },
        "model_profile_options": [
            {"value": "speed", "label": "速度优先（yolox-nano）"},
            {"value": "balance", "label": "平衡档（yolox-s）"},
            {"value": "custom", "label": "自定义"},
        ],
        "preprocess_mode_options": [
            {"value": "auto", "label": "自动选择"},
            {"value": "bgr_255", "label": "BGR 0-255"},
            {"value": "rgb_255", "label": "RGB 0-255"},
            {"value": "bgr_01", "label": "BGR 0-1"},
            {"value": "rgb_01", "label": "RGB 0-1"},
        ],
    }


@app.put("/v1/config")
def update_config(payload: DetectorConfigUpdate) -> dict[str, Any]:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return get_config()
    previous = RuntimeConfig(**runtime_config.__dict__)

    model_fields_changed = False
    profile_locked_input_size = False
    profile = changes.get("model_profile")
    if profile in {"speed", "balance"}:
        preset = MODEL_PROFILE_PRESETS[str(profile)]
        runtime_config.model_profile = str(profile)
        runtime_config.model_name = str(preset["model_name"])
        runtime_config.model_path = str(preset["model_path"])
        runtime_config.model_url = str(preset["model_url"])
        runtime_config.input_size = int(preset["input_size"])
        profile_locked_input_size = True
        model_fields_changed = True
    elif profile == "custom":
        runtime_config.model_profile = "custom"

    if "model_name" in changes and changes["model_name"]:
        runtime_config.model_name = str(changes["model_name"]).strip()
    if "model_path" in changes and changes["model_path"]:
        runtime_config.model_path = str(changes["model_path"]).strip()
        runtime_config.model_profile = "custom"
        model_fields_changed = True
    if "model_url" in changes and changes["model_url"] is not None:
        runtime_config.model_url = str(changes["model_url"]).strip()
        runtime_config.model_profile = "custom"
        model_fields_changed = True
    if "auto_download" in changes and changes["auto_download"] is not None:
        runtime_config.auto_download = bool(changes["auto_download"])
    if (
        "input_size" in changes
        and changes["input_size"] is not None
        and not profile_locked_input_size
    ):
        runtime_config.input_size = int(changes["input_size"])
    if "preprocess_mode" in changes and changes["preprocess_mode"]:
        mode = str(changes["preprocess_mode"]).strip().lower()
        if mode not in VALID_PREPROCESS_MODES:
            raise HTTPException(status_code=400, detail=f"invalid preprocess_mode: {mode}")
        runtime_config.preprocess_mode = mode
    if "score_threshold" in changes and changes["score_threshold"] is not None:
        runtime_config.score_threshold = float(changes["score_threshold"])
    if "nms_threshold" in changes and changes["nms_threshold"] is not None:
        runtime_config.nms_threshold = float(changes["nms_threshold"])
    if "default_person_threshold" in changes and changes["default_person_threshold"] is not None:
        runtime_config.default_person_threshold = float(changes["default_person_threshold"])

    if model_fields_changed:
        engine.invalidate()
        try:
            engine.ensure_ready()
        except Exception as exc:
            runtime_config.model_profile = previous.model_profile
            runtime_config.model_name = previous.model_name
            runtime_config.model_path = previous.model_path
            runtime_config.model_url = previous.model_url
            runtime_config.auto_download = previous.auto_download
            runtime_config.input_size = previous.input_size
            runtime_config.preprocess_mode = previous.preprocess_mode
            runtime_config.score_threshold = previous.score_threshold
            runtime_config.nms_threshold = previous.nms_threshold
            runtime_config.default_person_threshold = previous.default_person_threshold
            engine.invalidate()
            try:
                engine.ensure_ready()
            except Exception:
                pass
            raise HTTPException(status_code=400, detail=f"model reload failed: {exc}") from exc

    return get_config()


@app.post("/v1/detect")
async def detect(
    file: UploadFile = File(...),
    person_threshold: float | None = Form(None),
    rule_mode: str = Form("and"),
    rules_json: str | None = Form(None),
) -> dict[str, Any]:
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="empty file payload")
    image_array = np.frombuffer(payload, dtype=np.uint8)
    image_bgr = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="invalid image payload")

    try:
        threshold = float(runtime_config.default_person_threshold if person_threshold is None else person_threshold)
        result = engine.detect(image_bgr=image_bgr, person_threshold=threshold)
        rules = _parse_rules_json(rules_json)
        if rules:
            mode = (rule_mode or "and").strip().lower()
            if mode not in {"and", "or"}:
                raise HTTPException(status_code=400, detail="rule_mode must be 'and' or 'or'")
            applied = _apply_rules(result, rules=rules, mode=mode)
            result["signals"] = applied["signals"]
            result["decision"] = applied["decision"]
            result["rule_evaluation"] = applied["rule_evaluation"]
        return result
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - runtime safeguard
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _parse_rules_json(rules_json: str | None) -> list[dict[str, Any]]:
    if not rules_json:
        return []
    try:
        data = json.loads(rules_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"rules_json invalid JSON: {exc}") from exc
    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="rules_json must be a JSON array")
    normalized_rules: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        signal_key = str(item.get("signal_key") or "").strip().lower()
        labels_raw = item.get("labels")
        if not signal_key:
            continue
        labels: list[str] = []
        if isinstance(labels_raw, list):
            labels = [str(label).strip().lower() for label in labels_raw if str(label).strip()]
        min_confidence = float(item.get("min_confidence", runtime_config.default_person_threshold))
        min_confidence = max(min(min_confidence, 1.0), 0.0)
        min_detections = int(item.get("min_detections", 1))
        min_detections = max(min_detections, 1)
        normalized_rules.append(
            {
                "signal_key": signal_key,
                "labels": labels,
                "min_confidence": min_confidence,
                "min_detections": min_detections,
            }
        )
    return normalized_rules


def _apply_rules(
    result: dict[str, Any],
    *,
    rules: list[dict[str, Any]],
    mode: str,
) -> dict[str, Any]:
    detections = result.get("detections") if isinstance(result.get("detections"), list) else []
    next_signals = dict(result.get("signals") or {})
    rule_results: list[dict[str, Any]] = []

    for rule in rules:
        labels = set(rule["labels"])
        matched = []
        for detection in detections:
            if not isinstance(detection, dict):
                continue
            label = str(detection.get("label") or "").strip().lower()
            confidence = float(detection.get("confidence") or 0)
            if labels and label not in labels:
                continue
            if confidence < float(rule["min_confidence"]):
                continue
            matched.append(detection)

        signal_confidence = max((float(item.get("confidence") or 0) for item in matched), default=0.0)
        next_signals[rule["signal_key"]] = round(signal_confidence, 4)
        passed = len(matched) >= int(rule["min_detections"])
        rule_results.append(
            {
                "signal_key": rule["signal_key"],
                "labels": sorted(labels),
                "min_confidence": rule["min_confidence"],
                "min_detections": rule["min_detections"],
                "matched_count": len(matched),
                "passed": passed,
            }
        )

    if not rule_results:
        return {"signals": next_signals, "decision": result.get("decision"), "rule_evaluation": []}

    if mode == "or":
        overall_pass = any(item["passed"] for item in rule_results)
    else:
        overall_pass = all(item["passed"] for item in rule_results)

    if overall_pass:
        reason = f"rules_{mode}_passed"
    else:
        failed = [item["signal_key"] for item in rule_results if not item["passed"]]
        reason = f"rules_{mode}_blocked: {', '.join(failed)}"

    return {
        "signals": next_signals,
        "decision": {
            "pass": overall_pass,
            "reason": reason,
        },
        "rule_evaluation": rule_results,
    }


COCO_CLASSES = [
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "airplane",
    "bus",
    "train",
    "truck",
    "boat",
    "traffic light",
    "fire hydrant",
    "stop sign",
    "parking meter",
    "bench",
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
    "backpack",
    "umbrella",
    "handbag",
    "tie",
    "suitcase",
    "frisbee",
    "skis",
    "snowboard",
    "sports ball",
    "kite",
    "baseball bat",
    "baseball glove",
    "skateboard",
    "surfboard",
    "tennis racket",
    "bottle",
    "wine glass",
    "cup",
    "fork",
    "knife",
    "spoon",
    "bowl",
    "banana",
    "apple",
    "sandwich",
    "orange",
    "broccoli",
    "carrot",
    "hot dog",
    "pizza",
    "donut",
    "cake",
    "chair",
    "couch",
    "potted plant",
    "bed",
    "dining table",
    "toilet",
    "tv",
    "laptop",
    "mouse",
    "remote",
    "keyboard",
    "cell phone",
    "microwave",
    "oven",
    "toaster",
    "sink",
    "refrigerator",
    "book",
    "clock",
    "vase",
    "scissors",
    "teddy bear",
    "hair drier",
    "toothbrush",
]


def _preprocess(
    *,
    image_bgr: np.ndarray,
    input_size: int,
    variant: str,
) -> tuple[np.ndarray, float]:
    image_h, image_w = image_bgr.shape[:2]
    ratio = min(input_size / image_h, input_size / image_w)
    resized_h = int(image_h * ratio)
    resized_w = int(image_w * ratio)
    resized = cv2.resize(image_bgr, (resized_w, resized_h), interpolation=cv2.INTER_LINEAR)

    padded = np.full((input_size, input_size, 3), 114, dtype=np.uint8)
    padded[:resized_h, :resized_w, :] = resized
    if variant == "bgr_255":
        formatted = padded.astype(np.float32)
    elif variant == "rgb_255":
        formatted = padded[:, :, ::-1].astype(np.float32)
    elif variant == "bgr_01":
        formatted = padded.astype(np.float32) / 255.0
    else:
        formatted = padded[:, :, ::-1].astype(np.float32) / 255.0
    formatted = np.transpose(formatted, (2, 0, 1))
    input_tensor = np.expand_dims(formatted, axis=0).astype(np.float32)
    return input_tensor, ratio


def _build_best_input_tensor(
    *,
    image_bgr: np.ndarray,
    input_size: int,
    preprocess_mode: str,
    session: ort.InferenceSession,
    input_name: str,
) -> tuple[np.ndarray, float, str]:
    if preprocess_mode in VALID_PREPROCESS_MODES and preprocess_mode != "auto":
        candidates = (preprocess_mode,)
    else:
        candidates = ("bgr_255", "rgb_255", "bgr_01", "rgb_01")
    best_variant = candidates[0]
    best_tensor = None
    best_ratio = 1.0
    best_score = float("-inf")

    for variant in candidates:
        input_tensor, ratio = _preprocess(image_bgr=image_bgr, input_size=input_size, variant=variant)
        try:
            output = session.run(None, {input_name: input_tensor})[0]
            score = _estimate_max_score(output)
        except Exception:
            score = float("-inf")
        if score > best_score:
            best_score = score
            best_variant = variant
            best_tensor = input_tensor
            best_ratio = ratio

    if best_tensor is None:
        fallback_tensor, fallback_ratio = _preprocess(image_bgr=image_bgr, input_size=input_size, variant="bgr_255")
        return fallback_tensor, fallback_ratio, "bgr_255"

    return best_tensor, best_ratio, best_variant


def _estimate_max_score(output: np.ndarray) -> float:
    if not isinstance(output, np.ndarray):
        return float("-inf")
    if output.ndim != 3 or output.shape[0] <= 0 or output.shape[2] < 6:
        return float("-inf")
    prediction = output[0]
    obj = prediction[:, 4:5]
    cls = prediction[:, 5:]
    scores = obj * cls
    if scores.size == 0:
        return float("-inf")
    return float(np.max(scores))


def _postprocess(
    *,
    output: np.ndarray,
    ratio: float,
    image_shape: tuple[int, int],
    input_size: int,
    score_threshold: float,
    nms_threshold: float,
) -> list[dict[str, Any]]:
    predictions = output[0]
    boxes = predictions[:, :4]
    obj_conf = predictions[:, 4:5]
    class_conf = predictions[:, 5:]

    grids, expanded_strides = _make_grids_and_strides(input_size=input_size)
    boxes[:, :2] = (boxes[:, :2] + grids) * expanded_strides
    boxes[:, 2:4] = np.exp(boxes[:, 2:4]) * expanded_strides

    scores = obj_conf * class_conf
    class_ids = np.argmax(scores, axis=1)
    confidences = scores[np.arange(scores.shape[0]), class_ids]

    valid_mask = confidences >= score_threshold
    boxes = boxes[valid_mask]
    class_ids = class_ids[valid_mask]
    confidences = confidences[valid_mask]
    if boxes.size == 0:
        return []

    x_center = boxes[:, 0]
    y_center = boxes[:, 1]
    width = boxes[:, 2]
    height = boxes[:, 3]
    x1 = (x_center - width / 2.0) / ratio
    y1 = (y_center - height / 2.0) / ratio
    x2 = (x_center + width / 2.0) / ratio
    y2 = (y_center + height / 2.0) / ratio

    h, w = image_shape
    boxes_xyxy = np.stack(
        [
            np.clip(x1, 0, w - 1),
            np.clip(y1, 0, h - 1),
            np.clip(x2, 0, w - 1),
            np.clip(y2, 0, h - 1),
        ],
        axis=1,
    )

    keep_indices = _nms(boxes_xyxy, confidences, nms_threshold)
    results: list[dict[str, Any]] = []
    for idx in keep_indices:
        bbox = boxes_xyxy[idx].tolist()
        results.append(
            {
                "class_id": int(class_ids[idx]),
                "confidence": float(confidences[idx]),
                "bbox": [round(float(v), 2) for v in bbox],
            }
        )
    return results


def _make_grids_and_strides(*, input_size: int) -> tuple[np.ndarray, np.ndarray]:
    strides = [8, 16, 32]
    grids = []
    expanded_strides = []
    for stride in strides:
        feat_h = input_size // stride
        feat_w = input_size // stride
        xv, yv = np.meshgrid(np.arange(feat_w), np.arange(feat_h))
        grid = np.stack((xv, yv), axis=2).reshape(-1, 2)
        grids.append(grid)
        expanded_strides.append(np.full((grid.shape[0], 1), stride))
    return np.concatenate(grids, axis=0), np.concatenate(expanded_strides, axis=0)


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> list[int]:
    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]

    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = scores.argsort()[::-1]
    keep: list[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        width = np.maximum(0.0, xx2 - xx1 + 1)
        height = np.maximum(0.0, yy2 - yy1 + 1)
        intersection = width * height
        union = areas[i] + areas[order[1:]] - intersection
        iou = np.where(union > 0, intersection / union, 0)
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]
    return keep
