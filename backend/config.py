from __future__ import annotations

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
STORE_PATH = BASE_DIR / "memorials-store.json"
USERS_STORE_PATH = BASE_DIR / "users-store.json"
FRIENDS_STORE_PATH = BASE_DIR / "friends-store.json"
DEFAULT_OUTPUT_DIR = BASE_DIR / "outputs"
VOICE_COMMENT_DIR = BASE_DIR / "outputs" / "voice_comments"

MINISTRIES = ["经略阁", "寻乐记", "创意坊"]
DEFAULT_SENDER = "钦天监 抖音巡检"
DEFAULT_SEVERITY_LEVEL = "微臣急奏"
