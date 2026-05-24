from __future__ import annotations

import logging
import time
import base64
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse

from backend.config import MINISTRIES
from backend.models import (
    ApproveMemorialRequest,
    CreateAnalyzedMemorialRequest,
    CreateTextMemorialRequest,
    CreateUrlMemorialRequest,
    GenerateCommentRequest,
    UpdateMemorialRequest,
)
from backend.responses import fail, ok
from backend.services.auth import CurrentUser, load_users, safe_user
from backend.services.memorials import (
    create_from_analysis,
    create_text_memorial,
    list_received,
    list_sent,
    load_memorials,
    normalize_memorial,
    persist_new_memorial,
    process_video_url,
    save_memorials,
    save_voice_comment,
    sender_for_user,
    user_seed_memorials,
)
from backend.services.text_ai import call_text_model, extract_json


router = APIRouter(tags=["memorials"])
logger = logging.getLogger(__name__)


def fallback_comment(title: str, tone: str | None) -> str:
    pre = "【御笔亲批】 \n"
    if tone == "angry":
        return pre + f"放肆！大不敬！此等荒谬奇葩之事《{title}》，竟也敢公然呈递御前？来人，罚其零食包，钦此！"
    if tone == "laugh":
        return pre + f"哈哈哈哈！朕生平未见《{title}》这等离谱绝活。爱卿此奏立了大功，今日赐群臣同乐，钦此！"
    if tone == "reward":
        return pre + f"大赏！此部视频《{title}》深刻反映民间整活战力，着户部拨款两文，重重有赏，钦此！"
    if tone == "held":
        return pre + f"留中不发。此折《{title}》情节跌宕，朕疑心其中有诈，暂且记下，择日复阅，钦此！"
    return pre + f"朕阅毕此《{title}》，深觉此乃国之祥瑞。此等奇人，甚合朕心。准奏，钦此！"


def fallback_briefing(memorials: list[dict]) -> dict:
    pending = [item for item in memorials if item.get("status") == "pending"]
    approved = [item for item in memorials if item.get("status") == "approved"]
    stats = []
    for category in MINISTRIES:
        rows = [item for item in memorials if item.get("category") == category]
        avg = round(sum(int(item.get("entertainmentRatio") or 0) for item in rows) / len(rows)) if rows else 0
        stats.append({"category": category, "count": len(rows), "avgEntertainment": avg})
    senders = list(dict.fromkeys(str(item.get("sender", "")).split(" ")[0] for item in memorials if item.get("sender")))
    return {
        "id": f"brief-{int(time.time() * 1000)}",
        "date": time.strftime("%Y-%m-%d", time.gmtime()),
        "overallHealth": "四海升平，逗趣之风盛行。朝野之中，逗笑恶搞与手工强人成鼎足之势，社稷稳如泰山。",
        "imperialReport": f"【内阁密奏大典】\n昨日，御书房共裁夺折子 {len(memorials)} 封。待奉朱笔御批者尚余 {len(pending)} 封，已有 {len(approved)} 封奉旨施行。\n\n臣等建议，陛下今晚需加紧督察批阅，以免折子堆积如山，扰乱朝纲。钦此！",
        "categoryStatistics": stats,
        "activeSenders": senders[:5],
    }


@router.get("/api/memorials")
def get_memorials(user: dict = CurrentUser) -> dict:
    return ok(list_received(user["id"]))


@router.get("/api/memorials/sent")
def sent_memorials(user: dict = CurrentUser) -> dict:
    return ok(list_sent(user["id"]))


@router.get("/api/memorials/{memorial_id}")
def get_memorial(memorial_id: str, user: dict = CurrentUser) -> JSONResponse:
    for item in load_memorials():
        if item.get("id") == memorial_id:
            logger.info("memorial detail fetched user_id=%s memorial_id=%s", user["id"], memorial_id)
            return JSONResponse(ok(normalize_memorial(item)))
    logger.info("memorial detail missing user_id=%s memorial_id=%s", user["id"], memorial_id)
    return JSONResponse(fail("未找到对应奏章。"), status_code=404)


@router.post("/api/memorials")
async def create_memorial(raw_request: Request, user: dict = CurrentUser) -> JSONResponse:
    payload = await raw_request.json()
    if isinstance(payload, dict) and "analysis" in payload:
        analyzed = CreateAnalyzedMemorialRequest.model_validate(payload)
        item = create_from_analysis(
            title=analyzed.title,
            url=analyzed.url,
            raw_text=analyzed.rawText,
            sender=analyzed.sender or sender_for_user(user),
            analysis=analyzed.analysis,
            status=analyzed.status,
            severity_level=analyzed.severityLevel,
            entertainment_ratio=analyzed.entertainmentRatio,
            from_user_id=user["id"],
            to_user_id=user["id"],
        )
        persisted = persist_new_memorial(item)
        logger.info("analyzed memorial created user_id=%s memorial_id=%s", user["id"], persisted.get("id"))
        return JSONResponse(ok(persisted), status_code=201)

    request = CreateTextMemorialRequest.model_validate(payload)
    raw_text = request.rawText.strip()
    if not raw_text:
        return JSONResponse(fail("奏章原文不可为空。"), status_code=400)
    to_user_id = request.toUserId or user["id"]
    sender = (request.customSender or sender_for_user(user)).strip()
    item, source = create_text_memorial(raw_text, sender, user["id"], to_user_id)
    logger.info("memorial created from text user_id=%s memorial_id=%s source=%s", user["id"], item.get("id"), source)
    return JSONResponse(ok(item, source=source))


@router.patch("/api/memorials/{memorial_id}")
def update_memorial(memorial_id: str, request: UpdateMemorialRequest, user: dict = CurrentUser) -> JSONResponse:
    rows = load_memorials()
    for index, item in enumerate(rows):
        if item.get("id") != memorial_id:
            continue
        patch = request.model_dump(exclude_unset=True)
        item.update(patch)
        if patch.get("status") == "approved" and not item.get("approvedTime"):
            item["approvedTime"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        if patch.get("status") and patch.get("status") != "approved":
            item["approvedTime"] = None
        rows[index] = normalize_memorial(item)
        save_memorials(rows)
        logger.info("memorial patched user_id=%s memorial_id=%s fields=%s", user["id"], memorial_id, sorted(patch))
        return JSONResponse(ok(rows[index]))
    logger.info("memorial patch missing user_id=%s memorial_id=%s", user["id"], memorial_id)
    return JSONResponse(fail("未找到对应奏章。"), status_code=404)


@router.post("/api/memorials/from-url")
def create_from_url(request: CreateUrlMemorialRequest, user: dict = CurrentUser) -> JSONResponse:
    url = request.url.strip()
    if not url:
        return JSONResponse(fail("视频链接不可为空。"), status_code=400)
    logger.info("memorial from-url received user_id=%s url_prefix=%r", user["id"], url[:80])
    item, source = process_video_url(url, sender_for_user(user), user["id"], request.toUserId or user["id"])
    logger.info("memorial created from url user_id=%s memorial_id=%s source=%s", user["id"], item.get("id"), source)
    return JSONResponse(ok(item, source=source))


@router.post("/api/memorials/analyze")
def analyze_compat(request: CreateUrlMemorialRequest, user: dict = CurrentUser) -> JSONResponse:
    url = request.url.strip()
    logger.info("memorial analyze compat received user_id=%s url_prefix=%r", user["id"], url[:80])
    item, source = process_video_url(url, sender_for_user(user), user["id"], request.toUserId or user["id"])
    logger.info("memorial analyzed compat user_id=%s memorial_id=%s source=%s", user["id"], item.get("id"), source)
    return JSONResponse(ok(item, source=source), status_code=201)


@router.post("/api/memorials/analyzed")
def create_analyzed(request: CreateAnalyzedMemorialRequest, user: dict = CurrentUser) -> JSONResponse:
    item = create_from_analysis(
        title=request.title,
        url=request.url,
        raw_text=request.rawText,
        sender=request.sender or sender_for_user(user),
        analysis=request.analysis,
        status=request.status,
        severity_level=request.severityLevel,
        entertainment_ratio=request.entertainmentRatio,
        from_user_id=user["id"],
        to_user_id=user["id"],
    )
    persisted = persist_new_memorial(item)
    logger.info("analyzed memorial created user_id=%s memorial_id=%s", user["id"], persisted.get("id"))
    return JSONResponse(ok(persisted), status_code=201)


@router.post("/api/generate-comment")
def generate_comment(_: GenerateCommentRequest, user: dict = CurrentUser) -> JSONResponse:
    return JSONResponse(fail("已禁用 AI 朱批，请直接手写或语音输入。"), status_code=410)


@router.post("/api/memorials/{memorial_id}/mark-read")
def mark_memorial_read(memorial_id: str, user: dict = CurrentUser) -> JSONResponse:
    rows = load_memorials()
    for index, item in enumerate(rows):
        if item.get("id") != memorial_id:
            continue
        if item.get("fromUserId") != user["id"]:
            return JSONResponse(fail("此折不是你发出的。"), status_code=403)
        item["senderReadAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        rows[index] = normalize_memorial(item)
        save_memorials(rows)
        return JSONResponse(ok(rows[index]))
    return JSONResponse(fail("未找到对应奏章。"), status_code=404)


@router.get("/api/memorials/{memorial_id}/voice-comment")
def get_voice_comment(memorial_id: str, user: dict = CurrentUser):
    rows = load_memorials()
    target = next((item for item in rows if item.get("id") == memorial_id), None)
    if not target or not target.get("voiceCommentPath"):
        return JSONResponse(fail("未找到语音朱批。"), status_code=404)
    path = Path(str(target["voiceCommentPath"]))
    if not path.exists():
        return JSONResponse(fail("语音文件已失效。"), status_code=404)
    return FileResponse(path, media_type=str(target.get("voiceCommentMime") or "audio/webm"))


@router.post("/api/memorials/{memorial_id}/approve")
async def approve_memorial(memorial_id: str, raw_request: Request, user: dict = CurrentUser) -> JSONResponse:
    rows = load_memorials()
    content_type = raw_request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await raw_request.form()
        payload = {
            "status": form.get("status"),
            "imperialComment": form.get("imperialComment"),
            "voiceCommentBase64": None,
            "voiceCommentMime": form.get("voiceCommentMime"),
            "voiceCommentDurationMs": int(form.get("voiceCommentDurationMs") or 0),
        }
        audio = form.get("audio")
        if audio is not None:
            audio_bytes = await audio.read()
            payload["voiceCommentBase64"] = base64.b64encode(audio_bytes).decode("utf-8")
            payload["voiceCommentMime"] = getattr(audio, "content_type", None) or "audio/webm"
            if not payload["voiceCommentDurationMs"]:
                payload["voiceCommentDurationMs"] = int(form.get("recordSeconds") or 0) * 1000
    else:
        payload = await raw_request.json()

    request = ApproveMemorialRequest.model_validate(payload)
    for index, item in enumerate(rows):
        if item.get("id") == memorial_id:
            if request.voiceCommentBase64:
                audio_bytes = base64.b64decode(request.voiceCommentBase64.split(",", 1)[-1])
                voice_path = save_voice_comment(memorial_id, audio_bytes, request.voiceCommentMime or "audio/webm")
                item["voiceCommentPath"] = voice_path
                item["voiceCommentMime"] = request.voiceCommentMime or "audio/webm"
                item["voiceCommentDurationMs"] = request.voiceCommentDurationMs
            item["status"] = request.status
            item["imperialComment"] = request.imperialComment or "朕已阅，退下。"
            item["approvedTime"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            item["senderReadAt"] = None
            rows[index] = normalize_memorial(item)
            save_memorials(rows)
            logger.info("memorial approved user_id=%s memorial_id=%s status=%s", user["id"], memorial_id, request.status)
            return JSONResponse(ok(rows[index]))
    logger.info("memorial approve missing user_id=%s memorial_id=%s", user["id"], memorial_id)
    return JSONResponse(fail("未找到该御前折子。"), status_code=404)


@router.post("/api/memorials/reset")
def reset_memorials(user: dict = CurrentUser) -> dict:
    rows = [item for item in load_memorials() if item.get("toUserId") != user["id"]]
    seeds = user_seed_memorials(user["id"])
    updated = [*seeds, *rows]
    save_memorials(updated)
    logger.info("memorials reset user_id=%s seeds=%s kept=%s", user["id"], len(seeds), len(rows))
    return ok(seeds)


@router.delete("/api/memorials/{memorial_id}")
def delete_memorial(memorial_id: str, user: dict = CurrentUser) -> dict:
    rows = load_memorials()
    filtered = [item for item in rows if item.get("id") != memorial_id]
    save_memorials(filtered)
    logger.info("memorial deleted user_id=%s memorial_id=%s deleted=%s", user["id"], memorial_id, len(filtered) != len(rows))
    return ok()


@router.get("/api/briefing")
def briefing(user: dict = CurrentUser) -> dict:
    rows = list_received(user["id"])
    if not rows:
        logger.info("briefing generated user_id=%s source=mock count=0", user["id"])
        return ok(fallback_briefing(rows), source="mock")

    brief_titles = "\n".join(
        f"- [{item.get('category')}] {item.get('title')} (呈递者: {item.get('sender')}, 严重度: {item.get('severityLevel')}, 搞笑分: {item.get('entertainmentRatio')}, 状态: {item.get('status')})"
        for item in rows
    )
    prompt = f"""你现在是当朝备受倚重、饱读诗书的内阁首辅大学士。在一天结束之际，你必须要给日理万机的皇帝陛下呈上一份【内阁御书房整顿逗笑朝纲简报】。

今日呈进的搞笑折子名录：
{brief_titles}

请生成如下结构的合法JSON：
{{ "overallHealth": "用八个字总结今日搞笑江山的状态", "imperialReport": "内阁大学士上疏正文，约150-180字" }}"""
    generated = call_text_model(prompt, task="briefing", system="你是内阁首辅大学士，只输出合法JSON。", json_mode=True)
    parsed = extract_json(generated or "") or {}
    report = fallback_briefing(rows)
    source = "mock"
    if parsed:
        report["overallHealth"] = parsed.get("overallHealth") or report["overallHealth"]
        report["imperialReport"] = parsed.get("imperialReport") or report["imperialReport"]
        source = "ai"
    logger.info("briefing generated user_id=%s source=%s count=%s", user["id"], source, len(rows))
    return ok(report, source=source)


@router.get("/api/profile")
def profile(user: dict = CurrentUser) -> dict:
    rows = list_received(user["id"])
    reviewed = [item for item in rows if item.get("status") != "pending"]
    approved = [item for item in reviewed if item.get("status") == "approved"]
    rejected = [item for item in reviewed if item.get("status") == "rejected"]
    held = [item for item in reviewed if item.get("status") == "held"]
    total_received = len(rows)
    total_reviewed = len(reviewed)
    stats = {
        "totalReceived": total_received,
        "totalReviewed": total_reviewed,
        "approveRate": round(len(approved) / total_reviewed * 100) if total_reviewed else 0,
        "rejectRate": round(len(rejected) / total_reviewed * 100) if total_reviewed else 0,
        "holdRate": round(len(held) / total_reviewed * 100) if total_reviewed else 0,
        "favCategory": "未知",
        "avgEntertainment": round(sum(int(item.get("entertainmentRatio") or 0) for item in rows) / len(rows)) if rows else 0,
    }
    cat_counts = {}
    for item in rows:
        cat_counts[item.get("category")] = cat_counts.get(item.get("category"), 0) + 1
    if cat_counts:
        stats["favCategory"] = sorted(cat_counts.items(), key=lambda pair: pair[1], reverse=True)[0][0]

    sample_comments = [f"「{str(item.get('imperialComment'))[:40]}」" for item in reviewed if item.get("imperialComment")][:5]
    prompt = f"""你是一位宫廷史官，根据以下皇帝的批阅记录，撰写一段古风人物志（100-150字），评价其执政风格。

皇帝信息：{user.get('avatarTitle')} {user.get('displayName')}
统计：共收折{total_received}封，已批{total_reviewed}封，准奏率{stats['approveRate']}%，驳回率{stats['rejectRate']}%，留中率{stats['holdRate']}%
偏好分类：{stats['favCategory']}，平均娱乐指数{stats['avgEntertainment']}
代表性朱批：{"；".join(sample_comments) or "暂无批语"}

直接输出人物志正文，不要标题和Markdown。"""
    portrait = call_text_model(prompt, task="profile")
    if not portrait:
        if stats["approveRate"] >= 70:
            portrait = f"{user.get('displayName')}帝，性宽厚仁慈，凡呈折者多蒙准奏。朝臣称其为笑面天子，最好{stats['favCategory']}一脉奇闻。"
        elif stats["rejectRate"] >= 50:
            portrait = f"{user.get('displayName')}帝，御下甚严，弹劾驳回不留情面。尤重{stats['favCategory']}事务，凡不合心意者一律驳回。"
        else:
            portrait = f"{user.get('displayName')}帝，批阅奏章不急不躁，留中观望居多。偏爱{stats['favCategory']}之趣闻，对朝政持审慎态度。"
    logger.info(
        "profile generated user_id=%s total=%s reviewed=%s avg=%s",
        user["id"],
        stats["totalReceived"],
        stats["totalReviewed"],
        stats["avgEntertainment"],
    )
    return ok({"user": safe_user(user), "stats": stats, "portrait": portrait})
