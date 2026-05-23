from __future__ import annotations

import logging
import secrets
import time

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend.config import FRIENDS_STORE_PATH
from backend.models import FriendRequestCreate
from backend.responses import fail, ok
from backend.services.auth import CurrentUser, load_users, safe_user
from backend.store import load_json, save_json


router = APIRouter(tags=["friends"])
logger = logging.getLogger(__name__)


def load_friends() -> list[dict]:
    return load_json(FRIENDS_STORE_PATH)


def save_friends(friends: list[dict]) -> None:
    save_json(FRIENDS_STORE_PATH, friends)


def resolve_user(users: list[dict], user_id: str | None) -> dict | None:
    user = next((item for item in users if item.get("id") == user_id), None)
    return safe_user(user) if user else None


@router.get("/api/users/search")
def search_users(q: str = Query(default=""), user: dict = CurrentUser) -> dict:
    query = q.strip().lower()
    if not query:
        return ok([])
    results = [
        safe_user(item)
        for item in load_users()
        if item.get("id") != user["id"]
        and (query in str(item.get("username", "")).lower() or query in str(item.get("displayName", "")).lower())
    ][:10]
    logger.info("user search user_id=%s query=%r results=%s", user["id"], q, len(results))
    return ok(results)


@router.post("/api/friends/request")
def request_friend(request: FriendRequestCreate, user: dict = CurrentUser) -> JSONResponse:
    from_user_id = user["id"]
    to_user_id = request.toUserId
    if not to_user_id or from_user_id == to_user_id:
        logger.info("friend request rejected invalid from=%s to=%s", from_user_id, to_user_id)
        return JSONResponse(fail("无效的好友请求。"), status_code=400)

    users = load_users()
    if not any(item.get("id") == to_user_id for item in users):
        logger.info("friend request rejected missing target from=%s to=%s", from_user_id, to_user_id)
        return JSONResponse(fail("此人不在大内名册中。"), status_code=404)

    friends = load_friends()
    existing = next(
        (
            item
            for item in friends
            if item.get("status") != "rejected"
            and {
                item.get("fromUserId"),
                item.get("toUserId"),
            }
            == {from_user_id, to_user_id}
        ),
        None,
    )
    if existing:
        logger.info("friend request rejected duplicate from=%s to=%s", from_user_id, to_user_id)
        return JSONResponse(fail("已有关联请求存在。"), status_code=409)

    friend_request = {
        "id": f"fr-{int(time.time() * 1000)}-{secrets.token_hex(2)}",
        "fromUserId": from_user_id,
        "toUserId": to_user_id,
        "status": "pending",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    friends.append(friend_request)
    save_friends(friends)
    logger.info("friend request created request_id=%s from=%s to=%s", friend_request["id"], from_user_id, to_user_id)
    return JSONResponse(ok(friend_request))


@router.get("/api/friends")
def friends(user: dict = CurrentUser) -> dict:
    user_id = user["id"]
    friend_rows = load_friends()
    users = load_users()

    accepted = [
        item
        for item in friend_rows
        if item.get("status") == "accepted" and user_id in {item.get("fromUserId"), item.get("toUserId")}
    ]
    pending_received = [item for item in friend_rows if item.get("status") == "pending" and item.get("toUserId") == user_id]
    pending_sent = [item for item in friend_rows if item.get("status") == "pending" and item.get("fromUserId") == user_id]

    friend_users = []
    for item in accepted:
        friend_id = item.get("toUserId") if item.get("fromUserId") == user_id else item.get("fromUserId")
        friend = resolve_user(users, friend_id)
        if friend:
            friend_users.append({**friend, "friendshipId": item.get("id")})

    data = {
        "friends": friend_users,
        "pendingReceived": [{**item, "fromUser": resolve_user(users, item.get("fromUserId"))} for item in pending_received],
        "pendingSent": [{**item, "toUser": resolve_user(users, item.get("toUserId"))} for item in pending_sent],
    }
    logger.info(
        "friends listed user_id=%s friends=%s pending_received=%s pending_sent=%s",
        user_id,
        len(friend_users),
        len(pending_received),
        len(pending_sent),
    )
    return ok(data)


@router.post("/api/friends/{friend_id}/accept")
def accept_friend(friend_id: str, user: dict = CurrentUser) -> JSONResponse:
    rows = load_friends()
    for item in rows:
        if item.get("id") == friend_id and item.get("toUserId") == user["id"] and item.get("status") == "pending":
            item["status"] = "accepted"
            save_friends(rows)
            logger.info("friend request accepted request_id=%s user_id=%s", friend_id, user["id"])
            return JSONResponse(ok(item))
    logger.info("friend accept failed request_id=%s user_id=%s", friend_id, user["id"])
    return JSONResponse(fail("请求不存在。"), status_code=404)


@router.post("/api/friends/{friend_id}/reject")
def reject_friend(friend_id: str, user: dict = CurrentUser) -> JSONResponse:
    rows = load_friends()
    for item in rows:
        if item.get("id") == friend_id and item.get("toUserId") == user["id"] and item.get("status") == "pending":
            item["status"] = "rejected"
            save_friends(rows)
            logger.info("friend request rejected request_id=%s user_id=%s", friend_id, user["id"])
            return JSONResponse(ok(item))
    logger.info("friend reject failed request_id=%s user_id=%s", friend_id, user["id"])
    return JSONResponse(fail("请求不存在。"), status_code=404)
