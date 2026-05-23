from __future__ import annotations

from typing import Any


def ok(data: Any = None, **extra: Any) -> dict[str, Any]:
    payload = {"success": True}
    payload.update(extra)
    if data is not None:
        payload["data"] = data
    return payload


def fail(error: str, **extra: Any) -> dict[str, Any]:
    payload = {"success": False, "error": error}
    payload.update(extra)
    return payload

