from __future__ import annotations

import base64
import json
import mimetypes
import re
from pathlib import Path


def encode_image_to_data_url(image_path: str) -> str:
    path = Path(image_path)
    content = path.read_bytes()
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    encoded = base64.b64encode(content).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def encode_image_to_base64(image_path: str) -> str:
    return base64.b64encode(Path(image_path).read_bytes()).decode("utf-8")


def ensure_object_json(value) -> dict | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    return {"result": value}


def extract_json_payload(value: str | None):
    if not value:
        return None

    text = str(value).strip()
    if not text:
        return None

    candidates = [text]
    if text.startswith("```"):
        stripped = text.strip("`").strip()
        if stripped.startswith("json"):
            stripped = stripped[4:].strip()
        candidates.append(stripped)

    object_start = text.find("{")
    object_end = text.rfind("}")
    if object_start != -1 and object_end != -1 and object_end > object_start:
        candidates.append(text[object_start : object_end + 1])

    array_start = text.find("[")
    array_end = text.rfind("]")
    if array_start != -1 and array_end != -1 and array_end > array_start:
        candidates.append(text[array_start : array_end + 1])

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def strip_think_blocks(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def normalize_openai_json_schema(schema: dict | None) -> dict:
    if not schema:
        return {"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]}

    schema_copy = json.loads(json.dumps(schema))
    return _normalize_schema_node(schema_copy)


def build_schema_instruction(schema: dict | None) -> str:
    if not schema:
        return "你必须只返回一个合法 JSON 对象，不要输出解释、Markdown、代码块或额外文本。"

    schema_text = json.dumps(schema, ensure_ascii=False)
    return (
        "你必须只返回一个合法 JSON 对象，不要输出解释、Markdown、代码块或额外文本。"
        f" 输出结果必须满足以下 JSON Schema：{schema_text}"
    )


def _normalize_schema_node(node):
    if not isinstance(node, dict):
        return node

    schema_type = node.get("type")
    if isinstance(schema_type, list):
        non_null_types = [item for item in schema_type if item != "null"]
        schema_type = non_null_types[0] if non_null_types else (schema_type[0] if schema_type else None)

    if schema_type == "object":
        properties = node.get("properties") or {}
        node["properties"] = {key: _normalize_schema_node(value) for key, value in properties.items()}
        node.setdefault("required", list(properties.keys()))
        node.setdefault("additionalProperties", False)
    elif schema_type == "array" and "items" in node:
        node["items"] = _normalize_schema_node(node["items"])

    return node
