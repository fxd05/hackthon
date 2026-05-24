from __future__ import annotations

import logging
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.models import LoginRequest, RegisterRequest
from backend.responses import fail, ok
from backend.services.auth import CurrentUser, hash_password, load_users, new_token, safe_user, save_users, verify_password
from backend.services.memorials import load_memorials, save_memorials, user_seed_memorials


router = APIRouter(tags=["auth"])
logger = logging.getLogger(__name__)


@router.post("/api/register")
def register(request: RegisterRequest) -> JSONResponse:
    username = request.username.strip()
    password = request.password
    if not username or not password:
        return JSONResponse(fail("用户名和密码不可空缺。"), status_code=400)
    if len(username) < 2 or len(username) > 20:
        return JSONResponse(fail("用户名须在2-20字之间。"), status_code=400)
    if len(password) < 3:
        return JSONResponse(fail("口令至少三位。"), status_code=400)

    users = load_users()
    if any(user.get("username") == username for user in users):
        logger.info("register rejected duplicate username=%s", username)
        return JSONResponse(fail("此名号已被他人占用。"), status_code=409)

    user = {
        "id": f"user-{int(time.time() * 1000)}",
        "username": username,
        "passwordHash": hash_password(password),
        "displayName": (request.displayName or username).strip(),
        "avatarTitle": (request.avatarTitle or "布衣百姓").strip(),
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    users.append(user)
    save_users(users)

    memorials = load_memorials()
    seeds = user_seed_memorials(user["id"])
    memorials.extend(seeds)
    save_memorials(memorials)

    token = new_token(user["id"])
    logger.info("user registered user_id=%s username=%s seeds=%s", user["id"], username, len(seeds))
    return JSONResponse(ok({"user": safe_user(user), "token": token}))


@router.post("/api/login")
def login(request: LoginRequest) -> JSONResponse:
    users = load_users()
    user = next((item for item in users if item.get("username") == request.username), None)
    if not user or not verify_password(request.password, str(user.get("passwordHash") or "")):
        logger.info("login failed username=%s", request.username)
        return JSONResponse(fail("名号或口令有误，不得入宫。"), status_code=401)
    token = new_token(user["id"])
    logger.info("login succeeded user_id=%s username=%s", user["id"], request.username)
    return JSONResponse(ok({"user": safe_user(user), "token": token}))


@router.get("/api/me")
def me(user: dict = CurrentUser) -> dict:
    return ok(safe_user(user))
