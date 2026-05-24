from __future__ import annotations

import logging
import random
import re
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from backend.config import (
    DEFAULT_OUTPUT_DIR,
    DEFAULT_SENDER,
    DEFAULT_SEVERITY_LEVEL,
    MINISTRIES,
    VOICE_COMMENT_DIR,
    STORE_PATH,
    USERS_STORE_PATH,
)
from backend.models import AiAnalysisPayload, Memorial
from backend.seeds import seed_memorials
from backend.services.auth import load_users
from backend.services.text_ai import call_text_model, extract_json
from backend.store import load_json, save_json
from backend.video.douyin_video_assets import extract_first_url
from backend.video.process_douyin_video_with_ai import build_parser, resolve_and_save_assets
from backend.video.qwen_video_analysis import analyze_video, get_api_key


logger = logging.getLogger(__name__)

CATEGORY_TO_FRONTEND = {
    "干货类": "经略阁",
    "创意类": "创意坊",
    "抽象类": "寻乐记",
}
DEFAULT_ENTERTAINMENT_RATIO = {
    "干货类": 62,
    "创意类": 82,
    "抽象类": 92,
}


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def load_memorials() -> list[dict[str, Any]]:
    if not STORE_PATH.exists():
        seeds = seed_memorials()
        save_json(STORE_PATH, seeds)
        return seeds
    return load_json(STORE_PATH)


def save_memorials(memorials: list[dict[str, Any]]) -> None:
    save_json(STORE_PATH, memorials)


def clean_url(text: str) -> str:
    match = re.search(r"https?://[^\s]+", text)
    return match.group(0).rstrip(".,，。)") if match else "https://www.douyin.com"


def normalize_frontend_category(category: str | None) -> str:
    if category in MINISTRIES:
        return category
    if category in CATEGORY_TO_FRONTEND:
        return CATEGORY_TO_FRONTEND[category]
    return "经略阁"


def normalize_memorial(item: dict[str, Any]) -> dict[str, Any]:
    item = dict(item)
    item["category"] = normalize_frontend_category(item.get("category"))
    if item.get("status") not in {"pending", "approved", "rejected", "held"}:
        item["status"] = "pending"
    item.setdefault("keywords", [])
    item.setdefault("entertainmentRatio", 70)
    item.setdefault("severityLevel", DEFAULT_SEVERITY_LEVEL)
    item.setdefault("createdTime", now_iso())
    item.setdefault("senderReadAt", None)
    item.setdefault("voiceCommentPath", None)
    item.setdefault("voiceCommentMime", None)
    item.setdefault("voiceCommentDurationMs", None)
    return Memorial.model_validate(item).model_dump(exclude_none=True)


def fallback_analysis(raw_text: str) -> dict[str, Any]:
    douyin_url = clean_url(raw_text)
    is_code = bool(re.search(r"码|程序员|代码|技术|电脑|算法|软件", raw_text))
    is_animal = bool(re.search(r"猫|狗|宠物|橘猫|哈士奇|二哈|萌宠", raw_text))
    is_food_or_money = bool(re.search(r"省钱|美食|做菜|做饭|省|花钱|金币|穷", raw_text))
    is_music_or_craft = bool(re.search(r"音乐|艺术|手工|画画|唱歌|乐器|曲子", raw_text))
    is_fail = bool(re.search(r"失败|摔跤|搞笑|沙雕|翻车|撞车|惨", raw_text))

    title = "民间奇闻视频呈递"
    sender = "地方按察使"
    category = "经略阁"
    summary = "御前密呈：近日市井喧嚣，微臣于里弄探得一奇异短剧。百姓争相传看。臣恐其荒废朝政，特抄送御前简报。"
    keywords = ["民间奇闻", "短视频"]
    severity = "日常请安"

    if is_code:
        title = "工科匠人夜观天象用代码炼金"
        sender = "工部侍郎 科研总监"
        category = "创意坊"
        summary = "工部密报：有刁钻程序员引天地灵气（死循环）催化计算机，至其极热以御冬寒。此法甚妙，惜废旧电脑甚多。"
        keywords = ["科技", "程序员", "炼金", "死循环"]
        severity = "微臣急奏"
    elif is_animal:
        title = "番邦灵兽大闹天廷请拨兵解救"
        sender = "御马监 飞禽走兽特使"
        category = "寻乐记"
        summary = "兵部急奏：番邦金丝胖橘或蠢朋哈狗身负重力真气，于京城瓦舍摧梁毁栋。因索取金枪鱼与罐头，形势万分凶险。"
        keywords = ["灵兽", "拆家", "小鱼干", "超重"]
        severity = "弹劾奏章"
    elif is_food_or_money:
        title = "奇人施展两毛钱造熔炉神技"
        sender = "户部仓曹 钱米督办"
        category = "经略阁"
        summary = "户部秉奏：有草根铁匠在瓦舍利用废铜炼气，耗资仅两分即可制作香气四溢之烤炉。民富且会省，实乃社稷之大幸。"
        keywords = ["省钱", "米其林", "省开支"]
    elif is_music_or_craft:
        title = "乐师合奏惊世骇俗魔性绝音"
        sender = "礼部侍郎 乐府校书"
        category = "经略阁"
        summary = "礼部奏呈：番邦奇才于街头摇骰打击，曲风邪道魅惑，引万千白丁群聚。此等魔音洗脑，臣恐扰乱儒门正乐。"
        keywords = ["魔性洗脑", "音乐", "民乐大赏"]
    elif is_fail:
        title = "市井壮士惊天翻车喜剧大赏"
        sender = "刑部郎中 司狱典狱"
        category = "寻乐记"
        summary = "刑部急报：有刁民在街头展现飞天大胯，却不慎倾覆于下水道中。画面悲壮惨烈，引人哄堂大笑。"
        keywords = ["沙雕", "惊天大跨", "下水道"]
        severity = "十万火急"

    match = re.search(r"【(.*?)】", raw_text)
    if match and match.group(1):
        title = match.group(1)

    return {
        "id": f"mem-{int(time.time() * 1000)}",
        "title": title,
        "url": douyin_url,
        "rawText": raw_text,
        "sender": sender,
        "category": category,
        "summary": summary,
        "keywords": keywords,
        "entertainmentRatio": random.randint(70, 99),
        "severityLevel": severity,
        "status": "pending",
        "createdTime": now_iso(),
    }


def create_from_analysis(
    *,
    title: str,
    url: str,
    raw_text: str,
    sender: str | None,
    analysis: AiAnalysisPayload,
    status: str = "pending",
    severity_level: str | None = None,
    entertainment_ratio: int | None = None,
    from_user_id: str | None = None,
    to_user_id: str | None = None,
    video_info: dict[str, Any] | None = None,
) -> dict[str, Any]:
    created_at = now_iso()
    category = CATEGORY_TO_FRONTEND[analysis.category]
    item = {
        "id": f"mem-{uuid.uuid4().hex[:12]}",
        "title": title.strip(),
        "url": url.strip(),
        "rawText": raw_text.strip(),
        "sender": (sender or DEFAULT_SENDER).strip(),
        "category": category,
        "summary": analysis.summary.strip(),
        "keywords": [tag.strip() for tag in analysis.tags if tag.strip()],
        "entertainmentRatio": entertainment_ratio if entertainment_ratio is not None else DEFAULT_ENTERTAINMENT_RATIO[analysis.category],
        "severityLevel": (severity_level or DEFAULT_SEVERITY_LEVEL).strip(),
        "status": status,
        "createdTime": created_at,
        "approvedTime": created_at if status == "approved" else None,
        "fromUserId": from_user_id,
        "toUserId": to_user_id,
        "senderReadAt": None,
        "voiceCommentPath": None,
        "voiceCommentMime": None,
        "voiceCommentDurationMs": None,
        "videoInfo": video_info,
    }
    return normalize_memorial(item)


def persist_new_memorial(item: dict[str, Any]) -> dict[str, Any]:
    memorials = load_memorials()
    memorials.insert(0, normalize_memorial(item))
    save_memorials(memorials)
    logger.info(
        "memorial persisted memorial_id=%s from=%s to=%s category=%s status=%s",
        memorials[0].get("id"),
        memorials[0].get("fromUserId"),
        memorials[0].get("toUserId"),
        memorials[0].get("category"),
        memorials[0].get("status"),
    )
    return memorials[0]


def sender_for_user(user: dict[str, Any]) -> str:
    return f"{user.get('avatarTitle') or '御前侍卫'} {user.get('displayName') or user.get('username') or ''}".strip()


def create_text_memorial(raw_text: str, sender: str, from_user_id: str, to_user_id: str) -> tuple[dict[str, Any], str]:
    logger.info("text memorial create started from=%s to=%s chars=%s", from_user_id, to_user_id, len(raw_text))
    prompt = f"""你是一个皇宫里的翰林院大学士，负责把皇帝的朋友/大臣发过来的抖音搞笑/日常视频分享文案翻译并整理成一封呈递给皇帝的"奏章折子"。
将下方输入的视频文本进行深入解读并分析，归档分类在三个内容分类之一，写成一封幽默、极其搞笑却又保持皇家古物格调的"奏折概要"。

分类准则：
- 经略阁: 知识科普、实用窍门、教程、技能学习、深度分享、生活妙招等。
- 寻乐记: 沙雕爆笑、神仙打架、猫狗宠物整活、大型翻车、惊天大搞笑、无厘头整蛊或幽默奇葩事。
- 创意坊: 奇思妙想的发明、手工达人神奇改造、DIY、程序员自制好玩产品。

输入内容: "{raw_text}"
默认微臣称呼："{sender}"

生成JSON: {{ "title": "折子标题4-10字", "sender": "幽默古代大臣名称", "category": "经略阁|寻乐记|创意坊", "summary": "半文言半幽默奏本内容约120字", "keywords": ["标签不超过4个"], "entertainmentRatio": 搞笑程度1-100, "severityLevel": "日常请安|微臣急奏|十万火急|弹劾奏章" }}"""
    ai_text = call_text_model(prompt, task="memorial_text", system="你是翰林院大学士，只输出合法JSON，不要Markdown包裹。", json_mode=True)
    item: dict[str, Any] | None = None
    if ai_text:
        parsed = extract_json(ai_text)
        if parsed:
            item = {
                "id": f"mem-{int(time.time() * 1000)}",
                "title": parsed.get("title") or "民间奇闻视频呈递",
                "url": clean_url(raw_text),
                "rawText": raw_text,
                "sender": parsed.get("sender") or sender,
                "category": normalize_frontend_category(parsed.get("category")),
                "summary": parsed.get("summary") or "此折尚待翰林院详审。",
                "keywords": parsed.get("keywords") or [],
                "entertainmentRatio": int(parsed.get("entertainmentRatio") or 70),
                "severityLevel": parsed.get("severityLevel") or "日常请安",
                "status": "pending",
                "createdTime": now_iso(),
                "fromUserId": from_user_id,
                "toUserId": to_user_id,
            }
    source = "ai" if item else "mock"
    if not item:
        logger.info("text memorial using fallback from=%s to=%s", from_user_id, to_user_id)
        item = fallback_analysis(raw_text)
        item["sender"] = sender
        item["fromUserId"] = from_user_id
        item["toUserId"] = to_user_id
    persisted = persist_new_memorial(item)
    logger.info("text memorial create finished memorial_id=%s source=%s", persisted.get("id"), source)
    return persisted, source


def process_video_url(url: str, sender: str, from_user_id: str, to_user_id: str) -> tuple[dict[str, Any], str]:
    raw_text = f"[视频链接] {url}"
    try:
        logger.info("video memorial create started from=%s to=%s url=%s", from_user_id, to_user_id, url)
        parser = build_parser()
        args = parser.parse_args([url, "--output-dir", str(DEFAULT_OUTPUT_DIR)])
        args.url = args.input
        api_key = get_api_key()
        assets = resolve_and_save_assets(args)
        analysis_result = analyze_video(api_key, assets["video_path"])
        if analysis_result.get("error") is True:
            raise RuntimeError(str(analysis_result.get("message") or "AI 分析失败。"))
        analysis = AiAnalysisPayload.model_validate(
            {
                "summary": analysis_result["summary"],
                "tags": analysis_result["tags"],
                "category": analysis_result["category"],
                "visual_summary": analysis_result.get("visual_summary"),
            }
        )
        metadata = assets["metadata"]
        title = str(metadata.get("title") or metadata.get("desc") or "未命名抖音视频")
        source_url = str(metadata.get("source_url") or metadata.get("share_url") or extract_first_url(url))
        video_info = {
            "url": source_url,
            "title": title,
            "author": (metadata.get("author") or {}).get("nickname") or "未知作者",
            "description": metadata.get("desc") or "",
            "coverUrl": metadata.get("cover_url") or "",
            "duration": (metadata.get("video") or {}).get("duration_ms") or 0,
            "likeCount": (metadata.get("statistics") or {}).get("digg_count") or 0,
            "commentCount": (metadata.get("statistics") or {}).get("comment_count") or 0,
            "shareCount": (metadata.get("statistics") or {}).get("share_count") or 0,
        }
        item = create_from_analysis(
            title=title,
            url=source_url,
            raw_text=raw_text,
            sender=sender,
            analysis=analysis,
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            video_info=video_info,
        )
        persisted = persist_new_memorial(item)
        logger.info("video memorial create finished memorial_id=%s source=qwen-video", persisted.get("id"))
        return persisted, "qwen-video"
    except Exception as exc:
        logger.warning("video memorial fallback from=%s to=%s url=%s error=%s", from_user_id, to_user_id, url, exc)
        fallback = fallback_analysis(raw_text)
        fallback["sender"] = sender
        fallback["fromUserId"] = from_user_id
        fallback["toUserId"] = to_user_id
        fallback["url"] = url
        fallback["videoInfo"] = {
            "url": url,
            "title": "待解析视频",
            "author": "未知作者",
            "description": "视频内容待解析",
            "coverUrl": "",
            "duration": 0,
            "likeCount": 0,
            "commentCount": 0,
            "shareCount": 0,
        }
        persisted = persist_new_memorial(fallback)
        logger.info("video memorial create finished memorial_id=%s source=mock", persisted.get("id"))
        return persisted, "mock"


def list_received(user_id: str) -> list[dict[str, Any]]:
    users = load_json(USERS_STORE_PATH)
    raw = [item for item in load_memorials() if item.get("toUserId") == user_id]
    result = []
    for item in raw:
        from_user = next((user for user in users if user.get("id") == item.get("fromUserId")), None)
        normalized = normalize_memorial(item)
        normalized["fromUserDisplayName"] = (from_user or {}).get("displayName") or normalized.get("sender")
        result.append(normalized)
    logger.info("received memorials listed user_id=%s count=%s", user_id, len(result))
    return result


def list_sent(user_id: str) -> list[dict[str, Any]]:
    users = load_json(USERS_STORE_PATH)
    raw = [item for item in load_memorials() if item.get("fromUserId") == user_id]
    result = []
    for item in raw:
        to_user = next((user for user in users if user.get("id") == item.get("toUserId")), None)
        normalized = normalize_memorial(item)
        normalized["toUserDisplayName"] = (to_user or {}).get("displayName") or "未知"
        result.append(normalized)
    logger.info("sent memorials listed user_id=%s count=%s", user_id, len(result))
    return result


def user_seed_memorials(user_id: str) -> list[dict[str, Any]]:
    base = datetime.now(UTC)
    seed_templates = seed_memorials(base)
    total = len(seed_templates)
    seeds = []
    for index, seed in enumerate(seed_templates, start=1):
        item = dict(seed)
        item["id"] = f"seed-{user_id}-{index}-{int(time.time() * 1000)}"
        item["toUserId"] = user_id
        item["fromUserId"] = None
        item["createdTime"] = (base - timedelta(hours=total + 1 - index)).isoformat()
        item["senderReadAt"] = None
        item["voiceCommentPath"] = None
        item["voiceCommentMime"] = None
        item["voiceCommentDurationMs"] = None
        seeds.append(item)
    return seeds


def save_voice_comment(memorial_id: str, content: bytes, mime_type: str | None) -> str:
    VOICE_COMMENT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = "webm"
    if mime_type:
        if "wav" in mime_type:
            suffix = "wav"
        elif "ogg" in mime_type:
            suffix = "ogg"
        elif "mp4" in mime_type or "m4a" in mime_type:
            suffix = "m4a"
    path = VOICE_COMMENT_DIR / f"{memorial_id}-{int(time.time() * 1000)}.{suffix}"
    path.write_bytes(content)
    return str(path)
