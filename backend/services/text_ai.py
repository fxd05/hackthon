from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import dashscope
from dashscope import Generation
from dotenv import load_dotenv


DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1"
logger = logging.getLogger(__name__)


def extract_json(text: str) -> dict[str, Any] | None:
    stripped = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", stripped, flags=re.DOTALL | re.IGNORECASE)
    if fence_match:
        stripped = fence_match.group(1).strip()
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        return json.loads(stripped[start : end + 1])
    except json.JSONDecodeError:
        return None


def call_text_model(prompt: str, *, task: str, system: str | None = None, json_mode: bool = False) -> str | None:
    load_dotenv()
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        logger.info("text model skipped task=%s reason=missing DASHSCOPE_API_KEY", task)
        return None

    env_name = f"DASHSCOPE_{task.upper()}_MODEL"
    model = os.getenv(env_name) or os.getenv("DASHSCOPE_TEXT_MODEL") or "qwen-plus"
    dashscope.base_http_api_url = DASHSCOPE_BASE_URL

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        logger.info("text model call task=%s model=%s json_mode=%s", task, model, json_mode)
        response = Generation.call(
            api_key=api_key,
            model=model,
            messages=messages,
            result_format="message",
            temperature=0.8,
        )
        status_code = getattr(response, "status_code", None)
        if status_code and status_code != 200:
            logger.warning(
                "text model failed task=%s model=%s status=%s code=%s message=%s",
                task,
                model,
                status_code,
                getattr(response, "code", ""),
                getattr(response, "message", ""),
            )
            return None
        content = response.output.choices[0].message.content
        text = content if isinstance(content, str) else str(content)
        if json_mode and extract_json(text) is None:
            logger.warning("text model returned invalid json task=%s model=%s", task, model)
            return None
        logger.info("text model succeeded task=%s model=%s chars=%s", task, model, len(text.strip()))
        return text.strip() or None
    except Exception as exc:
        logger.warning("text model exception task=%s model=%s error=%s", task, model, exc)
        return None
