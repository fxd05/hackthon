from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any

import dashscope
from dashscope import MultiModalConversation
from dotenv import load_dotenv


DEFAULT_MODEL = "qwen3.6-flash"
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1"

PROMPT = """
你是一个视频内容分析助手。请分析用户提供的视频，并且只返回严格 JSON，不要返回 Markdown、解释文字或代码块。

必须严格按照下面 JSON 结构返回：
{
  "summary": "约150字的视频内容概要",
  "tags": ["标签1", "标签2", "标签3"],
  "category": "干货类",
  "visual_summary": [
    {
      "text": "关键步骤或知识点的文字说明，20~50字",
      "timestamp": "00:15"
    }
  ]
}

字段约束：
1. summary：中文，约150字，概括视频主要内容,至少100字，不得过少。
2. tags：3~5个中文标签。
3. category：只能是 "干货类"、"创意类" 或 "抽象类"。
4. visual_summary：只有 category 为 "干货类" 时才有值，值为数组；如果 category 为 "创意类" 或 "抽象类"，必须为 null。
5. visual_summary 数组中的每一项：
   - text：关键步骤或知识点的文字说明，20~50字。
   - timestamp：视频中对应内容出现的时间，优先使用 HH:MM:SS 格式。
6. 如果视频无法分析，请返回：
   {"error": true, "message": "原因"}
""".strip()


class VideoAnalysisError(RuntimeError):
    """Raised when video analysis cannot produce valid output."""


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )


def get_api_key() -> str:
    load_dotenv()
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise VideoAnalysisError("未在 .env 中找到 DASHSCOPE_API_KEY。")
    return api_key


def extract_json_text(text: str) -> str:
    stripped = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", stripped, flags=re.DOTALL | re.IGNORECASE)
    if fence_match:
        stripped = fence_match.group(1).strip()

    first_obj = stripped.find("{")
    last_obj = stripped.rfind("}")
    if first_obj == -1 or last_obj == -1 or last_obj < first_obj:
        raise VideoAnalysisError("AI 返回内容中未找到 JSON 对象。")

    return stripped[first_obj : last_obj + 1]


def is_timestamp(value: str) -> bool:
    return bool(re.fullmatch(r"\d{2}:\d{2}:\d{2}", value))


def seconds_to_timestamp(total_seconds: int) -> str:
    total_seconds = max(total_seconds, 0)
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def normalize_timestamp(value: Any) -> str:
    if value is None:
        logging.warning("Timestamp is missing, using empty string.")
        return ""

    raw = str(value).strip()
    if not raw:
        return raw

    if is_timestamp(raw):
        return raw

    seconds_match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(?:s|秒|sec|secs|second|seconds)", raw, re.IGNORECASE)
    if seconds_match:
        return seconds_to_timestamp(int(float(seconds_match.group(1))))

    minute_second_match = re.fullmatch(
        r"(\d+)\s*(?:分|m|min|mins|minute|minutes)\s*(\d+)?\s*(?:秒|s|sec|secs)?",
        raw,
        re.IGNORECASE,
    )
    if minute_second_match:
        minutes = int(minute_second_match.group(1))
        seconds = int(minute_second_match.group(2) or 0)
        return seconds_to_timestamp(minutes * 60 + seconds)

    parts = re.split(r"[:：]", raw)
    if 2 <= len(parts) <= 3 and all(part.strip().isdigit() for part in parts):
        numbers = [int(part.strip()) for part in parts]
        if len(numbers) == 2:
            minutes, seconds = numbers
            return seconds_to_timestamp(minutes * 60 + seconds)
        hours, minutes, seconds = numbers
        return seconds_to_timestamp(hours * 3600 + minutes * 60 + seconds)

    logging.warning("Timestamp could not be normalized, keeping AI value: %s", raw)
    return raw


def validate_result(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise VideoAnalysisError("AI 返回的 JSON 顶层必须是对象。")

    if data.get("error") is True:
        message = data.get("message")
        if not isinstance(message, str) or not message.strip():
            raise VideoAnalysisError("error 为 true 时必须包含非空 message。")
        return {"error": True, "message": message.strip()}

    required_keys = {"summary", "tags", "category", "visual_summary"}
    missing = required_keys - set(data)
    if missing:
        raise VideoAnalysisError(f"AI 返回缺少字段：{', '.join(sorted(missing))}。")

    summary = data["summary"]
    tags = data["tags"]
    category = data["category"]
    visual_summary = data["visual_summary"]

    if not isinstance(summary, str) or not summary.strip():
        raise VideoAnalysisError("summary 必须是非空字符串。")

    if not isinstance(tags, list) or not 3 <= len(tags) <= 5:
        raise VideoAnalysisError("tags 必须是包含 3~5 个标签的数组。")
    for tag in tags:
        if not isinstance(tag, str):
            raise VideoAnalysisError("每个 tag 必须是字符串。")

    if category not in {"干货类", "创意类", "抽象类"}:
        raise VideoAnalysisError('category 只能是 "干货类"、"创意类" 或 "抽象类"。')

    if category in {"创意类", "抽象类"}:
        if visual_summary is not None:
            raise VideoAnalysisError('category 为 "创意类" 或 "抽象类" 时 visual_summary 必须为 null。')
    else:
        if not isinstance(visual_summary, list) or len(visual_summary) == 0:
            raise VideoAnalysisError('category 为 "干货类" 时 visual_summary 必须是非空数组。')
        for item in visual_summary:
            if not isinstance(item, dict):
                raise VideoAnalysisError("visual_summary 的每一项都必须是对象。")
            text = item.get("text")
            timestamp = item.get("timestamp")
            if not isinstance(text, str) or not 20 <= len(text.strip()) <= 50:
                raise VideoAnalysisError("visual_summary.text 必须是 20~50 字字符串。")
            item["timestamp"] = normalize_timestamp(timestamp)

    return {
        "summary": summary.strip(),
        "tags": [tag.strip() for tag in tags],
        "category": category,
        "visual_summary": visual_summary,
    }


def parse_and_validate_ai_text(text: str) -> dict[str, Any]:
    try:
        data = json.loads(extract_json_text(text))
    except json.JSONDecodeError as exc:
        raise VideoAnalysisError(f"AI 返回 JSON 解析失败：{exc.msg}。") from exc
    return validate_result(data)


def extract_qwen_text(response: Any) -> str:
    try:
        content = response.output.choices[0].message.content
    except Exception as exc:
        raise VideoAnalysisError(f"Qwen 返回结构异常：{response}") from exc

    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                text_parts.append(item["text"])
            elif isinstance(item, str):
                text_parts.append(item)
        text = "\n".join(text_parts)
    else:
        text = str(content)

    if not text.strip():
        raise VideoAnalysisError("Qwen 未返回文本内容。")
    return text


def call_qwen(api_key: str, video_path: Path, prompt: str) -> str:
    model = os.getenv("DASHSCOPE_MODEL", DEFAULT_MODEL)
    dashscope.base_http_api_url = DASHSCOPE_BASE_URL
    video_uri = f"file://{video_path.resolve()}"
    logging.info("Calling Qwen model: %s.", model)

    messages = [
        {
            "role": "user",
            "content": [
                {"video": video_uri, "fps": 1},
                {"text": prompt},
            ],
        }
    ]
    response = MultiModalConversation.call(
        api_key=api_key,
        model=model,
        messages=messages,
    )

    status_code = getattr(response, "status_code", None)
    if status_code and status_code != 200:
        code = getattr(response, "code", "")
        message = getattr(response, "message", "")
        raise VideoAnalysisError(f"Qwen 调用失败：{status_code} {code} {message}".strip())

    return extract_qwen_text(response)


def analyze_video(api_key: str, video_path: Path) -> dict[str, Any]:
    last_error: Exception | None = None
    last_ai_text: str | None = None

    for attempt in range(2):
        if attempt == 0:
            prompt = PROMPT
        else:
            prompt = (
                f"{PROMPT}\n\n"
                f"上一次返回无法通过本地校验，错误原因：{last_error}\n"
                "请重新分析并只返回一个严格合法的 JSON 对象。"
            )

        try:
            last_ai_text = call_qwen(api_key, video_path, prompt)
            return parse_and_validate_ai_text(last_ai_text)
        except Exception as exc:
            last_error = exc
            logging.warning("Qwen response validation failed on attempt %s: %s", attempt + 1, exc)

    fallback: dict[str, Any] = {
        "error": True,
        "message": f"AI 返回结果解析失败，已重试一次：{last_error}",
    }
    if last_ai_text:
        fallback["raw_ai_response"] = last_ai_text
    return fallback


def save_json(data: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    logging.info("JSON saved to %s.", output_path)
