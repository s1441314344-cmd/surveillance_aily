import base64
from typing import Any, Dict, List

import requests


class LLMService:
    ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

    @staticmethod
    def _request(payload: Dict[str, Any], api_key: str, timeout: int = 120, base_url: str = None) -> Dict[str, Any]:
        if not api_key:
            return {"success": False, "error": "未配置智谱 API Key"}

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(
                base_url or LLMService.ZHIPU_API_URL,
                headers=headers,
                json=payload,
                timeout=timeout,
            )
            response.raise_for_status()
            data = response.json()
            choices = data.get("choices") or []
            if not choices:
                return {"success": False, "error": "模型未返回可用结果"}

            content = choices[0].get("message", {}).get("content", "")
            return {"success": True, "result": content, "raw_response": data}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "模型请求超时"}
        except requests.exceptions.RequestException as exc:
            detail = getattr(exc.response, "text", str(exc))
            return {"success": False, "error": detail}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    @staticmethod
    def analyze_image(
        image_path: str,
        prompt: str,
        api_key: str,
        model: str = "glm-4v-plus",
        timeout: int = 120,
        base_url: str = None,
    ) -> Dict[str, Any]:
        with open(image_path, "rb") as file:
            image_base64 = base64.b64encode(file.read()).decode("utf-8")

        return LLMService.analyze_image_base64(
            image_base64=image_base64,
            prompt=prompt,
            api_key=api_key,
            model=model,
            timeout=timeout,
            base_url=base_url,
        )

    @staticmethod
    def analyze_image_base64(
        image_base64: str,
        prompt: str,
        api_key: str,
        model: str = "glm-4v-plus",
        timeout: int = 120,
        base_url: str = None,
    ) -> Dict[str, Any]:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是专业的智能巡检图像分析助手，请严格根据巡检规则输出结论、问题、证据和建议。",
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                        },
                    ],
                },
            ],
            "temperature": 0.2,
        }
        return LLMService._request(payload, api_key=api_key, timeout=timeout, base_url=base_url)

    @staticmethod
    def analyze_images_base64(
        image_base64_list: List[str],
        prompt: str,
        api_key: str,
        model: str = "glm-4v-plus",
        timeout: int = 120,
        base_url: str = None,
    ) -> Dict[str, Any]:
        image_contents = []
        for image_base64 in image_base64_list:
            image_contents.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                }
            )

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是专业的智能巡检图像分析助手。请按要求返回严格 JSON，不要返回任何额外文本。"
                    ),
                },
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}] + image_contents,
                },
            ],
            "temperature": 0.2,
        }
        return LLMService._request(payload, api_key=api_key, timeout=timeout, base_url=base_url)

    @staticmethod
    def text_complete(prompt: str, api_key: str, model: str = "glm-4-flash") -> Dict[str, Any]:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }
        return LLMService._request(payload, api_key=api_key, timeout=60)


class LocalLLMService:
    OLLAMA_API_URL = "http://localhost:11434/api/generate"

    @staticmethod
    def analyze_with_ollama(image_path: str, prompt: str, model: str = "llava") -> Dict[str, Any]:
        try:
            with open(image_path, "rb") as file:
                image_data = base64.b64encode(file.read()).decode("utf-8")

            payload = {
                "model": model,
                "prompt": prompt,
                "images": [image_data],
                "stream": False,
            }

            response = requests.post(LocalLLMService.OLLAMA_API_URL, json=payload, timeout=120)
            if response.status_code == 200:
                result = response.json()
                return {"success": True, "result": result.get("response", ""), "raw_response": result}

            return {"success": False, "error": f"HTTP {response.status_code}: {response.text}"}
        except Exception as exc:
            return {"success": False, "error": str(exc)}


def get_llm_service():
    return LLMService


def get_local_llm_service():
    return LocalLLMService
