from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException


def load_json(path: Path, fallback: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    if fallback is None:
        fallback = []
    if not path.exists():
        return list(fallback)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"{path.name} JSON 解析失败：{exc.msg}") from exc
    if not isinstance(raw, list):
        raise HTTPException(status_code=500, detail=f"{path.name} 顶层必须是数组。")
    return raw


def save_json(path: Path, data: list[dict[str, Any]]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

