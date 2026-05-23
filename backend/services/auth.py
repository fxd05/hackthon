from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from typing import Any

from fastapi import Depends, Header, HTTPException

from backend.config import USERS_STORE_PATH
from backend.models import SafeUser, User
from backend.responses import fail
from backend.store import load_json, save_json


sessions: dict[str, str] = {}


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return "pbkdf2_sha256$120000$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_text, digest_text = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_text)
        expected = base64.b64decode(digest_text)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def new_token(user_id: str) -> str:
    token = f"tok-{secrets.token_urlsafe(24)}{int(time.time() * 1000)}"
    sessions[token] = user_id
    return token


def load_users() -> list[dict[str, Any]]:
    return load_json(USERS_STORE_PATH)


def save_users(users: list[dict[str, Any]]) -> None:
    save_json(USERS_STORE_PATH, users)


def safe_user(user: dict[str, Any]) -> dict[str, Any]:
    return SafeUser.model_validate(user).model_dump()


def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = (authorization or "").replace("Bearer ", "", 1)
    user_id = sessions.get(token)
    if not token or not user_id:
        raise HTTPException(status_code=401, detail=fail("未登录，请先报名登殿。"))
    for user in load_users():
        if user.get("id") == user_id:
            return User.model_validate(user).model_dump()
    sessions.pop(token, None)
    raise HTTPException(status_code=401, detail=fail("用户不存在，请重新登录。"))


CurrentUser = Depends(get_current_user)

