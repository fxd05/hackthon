from __future__ import annotations

import html
import json
import mimetypes
import re
import time
from http.cookiejar import CookieJar
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener


MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)
DEFAULT_HEADERS = {
    "User-Agent": MOBILE_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


class TrackingRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: N802
        redirect_urls = getattr(req, "redirect_urls", [])
        next_req = super().redirect_request(req, fp, code, msg, headers, newurl)
        if next_req is not None:
            next_req.redirect_urls = redirect_urls + [newurl]
        return next_req


class DouyinDownloadError(RuntimeError):
    pass


def make_opener():
    return build_opener(HTTPCookieProcessor(CookieJar()), TrackingRedirectHandler())


def request_url(
    opener,
    url: str,
    *,
    referer: str | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 30,
):
    merged = dict(DEFAULT_HEADERS)
    if referer:
        merged["Referer"] = referer
    if headers:
        merged.update(headers)
    req = Request(url, headers=merged)
    req.redirect_urls = []
    return opener.open(req, timeout=timeout)


def extract_first_url(text: str) -> str:
    match = re.search(r"https?://[^\s，。；;]+", text)
    if not match:
        raise DouyinDownloadError("没有在输入中找到 URL。")
    return match.group(0).rstrip(".,，。)")


def extract_aweme_id_from_text(text: str) -> str | None:
    patterns = [
        r"/video/(\d{15,25})",
        r"/share/video/(\d{15,25})",
        r"aweme_id[=:\"']+(\d{15,25})",
        r"modal_id[=:\"']+(\d{15,25})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def resolve_aweme_id(opener, user_input: str) -> tuple[str, str]:
    url = extract_first_url(user_input)
    direct_id = extract_aweme_id_from_text(url)
    if direct_id:
        return direct_id, url

    try:
        with request_url(opener, url, timeout=30) as resp:
            final_url = resp.geturl()
            redirects = getattr(resp, "redirect_urls", [])
            body = resp.read(300_000).decode("utf-8", "ignore")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise DouyinDownloadError(f"解析短链失败：{exc}") from exc

    haystack = "\n".join([url, *redirects, final_url, body])
    aweme_id = extract_aweme_id_from_text(haystack)
    if not aweme_id:
        raise DouyinDownloadError("短链已打开，但没有解析到视频 ID。")
    return aweme_id, final_url


def fetch_share_page(opener, aweme_id: str) -> tuple[str, str]:
    share_url = f"https://www.iesdouyin.com/share/video/{aweme_id}/"
    try:
        with request_url(opener, share_url, timeout=30) as resp:
            page = resp.read().decode("utf-8", "ignore")
            return page, resp.geturl()
    except (HTTPError, URLError, TimeoutError) as exc:
        raise DouyinDownloadError(f"获取分享页失败：{exc}") from exc


def parse_router_data(page: str) -> dict[str, Any]:
    match = re.search(r"window\._ROUTER_DATA\s*=\s*(\{.*?\})</script>", page, re.S)
    if not match:
        raise DouyinDownloadError("分享页中没有找到 _ROUTER_DATA，可能需要登录或页面结构已变化。")

    raw = html.unescape(match.group(1))
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise DouyinDownloadError(f"_ROUTER_DATA JSON 解析失败：{exc}") from exc


def walk_dicts(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_dicts(child)


def find_aweme_item(data: dict[str, Any], aweme_id: str) -> dict[str, Any]:
    for node in walk_dicts(data):
        if node.get("aweme_id") == aweme_id:
            return node
    raise DouyinDownloadError("页面数据中没有找到对应的视频条目。")


def unique_urls(urls: list[str]) -> list[str]:
    result = []
    seen = set()
    for url in urls:
        if isinstance(url, str) and url.startswith("http") and url not in seen:
            result.append(url)
            seen.add(url)
    return result


def get_video_urls(item: dict[str, Any]) -> list[str]:
    video = item.get("video") or {}
    play_addr = video.get("play_addr") or {}
    download_addr = video.get("download_addr") or {}

    urls: list[str] = []
    urls.extend(play_addr.get("url_list") or [])
    urls.extend(download_addr.get("url_list") or [])
    return unique_urls(urls)


def first_url(value: Any) -> str | None:
    if isinstance(value, str) and value.startswith("http"):
        return value
    if isinstance(value, dict):
        return first_url(value.get("url_list"))
    if isinstance(value, list):
        for item in value:
            url = first_url(item)
            if url:
                return url
    return None


def compact(value: Any) -> Any:
    if isinstance(value, dict):
        result = {}
        for key, child in value.items():
            cleaned = compact(child)
            if cleaned not in (None, "", [], {}):
                result[key] = cleaned
        return result
    if isinstance(value, list):
        return [cleaned for item in value if (cleaned := compact(item)) not in (None, "", [], {})]
    return value


def simplify_author(author: dict[str, Any]) -> dict[str, Any]:
    return compact(
        {
            "uid": author.get("uid"),
            "sec_uid": author.get("sec_uid"),
            "short_id": author.get("short_id"),
            "unique_id": author.get("unique_id"),
            "nickname": author.get("nickname"),
            "signature": author.get("signature"),
            "avatar": first_url(author.get("avatar_thumb") or author.get("avatar_medium") or author.get("avatar_larger")),
        }
    )


def simplify_text_extra(items: list[Any]) -> list[dict[str, Any]]:
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        result.append(
            compact(
                {
                    "hashtag_name": item.get("hashtag_name"),
                    "cid": item.get("cid"),
                    "type": item.get("type"),
                    "start": item.get("start"),
                    "end": item.get("end"),
                    "user_id": item.get("user_id"),
                    "sec_uid": item.get("sec_uid"),
                }
            )
        )
    return compact(result)


def extract_hashtags(item: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    for extra in item.get("text_extra") or []:
        if isinstance(extra, dict):
            tag = extra.get("hashtag_name")
            if tag:
                tags.append(str(tag))
    for challenge in item.get("cha_list") or []:
        if isinstance(challenge, dict):
            tag = challenge.get("cha_name") or challenge.get("hashtag_name")
            if tag:
                tags.append(str(tag))
    return list(dict.fromkeys(tags))


def clean_title(desc: str, hashtags: list[str]) -> str:
    title = desc or ""
    for tag in sorted(hashtags, key=len, reverse=True):
        escaped = re.escape(tag)
        title = re.sub(rf"(?<!\S)#\s*{escaped}(?=\s|#|$)", " ", title, flags=re.I)
        title = re.sub(rf"#\s*{escaped}(?=\s|#|$)", " ", title, flags=re.I)

    title = re.sub(r"#\S+", " ", title)
    title = re.sub(r"\s+", " ", title).strip(" -_，,。；;：:")
    return title or desc


def simplify_challenges(items: list[Any]) -> list[dict[str, Any]]:
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        result.append(
            compact(
                {
                    "cid": item.get("cid"),
                    "cha_name": item.get("cha_name"),
                    "desc": item.get("desc"),
                    "user_count": item.get("user_count"),
                    "view_count": item.get("view_count"),
                }
            )
        )
    return compact(result)


def simplify_anchors(items: list[Any]) -> list[dict[str, Any]]:
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        result.append(
            compact(
                {
                    "id": item.get("id"),
                    "type": item.get("type"),
                    "title": item.get("title"),
                    "keyword": item.get("keyword"),
                    "description": item.get("description"),
                    "extra": item.get("extra"),
                }
            )
        )
    return compact(result)


def simplify_music(music: dict[str, Any]) -> dict[str, Any]:
    return compact(
        {
            "id": music.get("id"),
            "mid": music.get("mid"),
            "title": music.get("title"),
            "author": music.get("author"),
            "album": music.get("album"),
            "duration": music.get("duration"),
            "cover": first_url(music.get("cover_thumb") or music.get("cover_medium") or music.get("cover_large")),
            "play_url": first_url(music.get("play_url")),
        }
    )


def simplify_video(video: dict[str, Any]) -> dict[str, Any]:
    return compact(
        {
            "duration_ms": video.get("duration"),
            "width": video.get("width"),
            "height": video.get("height"),
            "ratio": video.get("ratio"),
            "format": video.get("format"),
            "cover": first_url(video.get("cover")),
            "origin_cover": first_url(video.get("origin_cover")),
            "dynamic_cover": first_url(video.get("dynamic_cover")),
        }
    )


def parse_page_meta(page: str) -> dict[str, str]:
    meta: dict[str, str] = {}
    title_match = re.search(r"<title[^>]*>(.*?)</title>", page, re.I | re.S)
    if title_match:
        meta["title"] = html.unescape(re.sub(r"\s+", " ", title_match.group(1)).strip())

    for match in re.finditer(r"<meta\b[^>]*>", page, re.I):
        tag = match.group(0)
        attrs = {
            key.lower(): html.unescape(value)
            for key, _, value in re.findall(r"([:\w-]+)\s*=\s*([\"'])(.*?)\2", tag, re.S)
        }
        key = attrs.get("name") or attrs.get("property")
        content = attrs.get("content")
        if key and content:
            meta[key] = content
    return meta


def build_metadata(
    *,
    aweme_id: str,
    source_url: str,
    share_url: str,
    page: str,
    item: dict[str, Any],
    urls: list[str],
) -> dict[str, Any]:
    page_meta = parse_page_meta(page)
    keywords = [
        keyword.strip()
        for keyword in re.split(r"[,，]", page_meta.get("keywords", ""))
        if keyword.strip()
    ]
    hashtags = extract_hashtags(item)
    desc = item.get("desc") or ""
    metadata = {
        "aweme_id": aweme_id,
        "source_url": source_url,
        "share_url": share_url,
        "video_url": urls[0],
        "video_urls": urls,
        "title": clean_title(desc, hashtags),
        "desc": desc,
        "hashtags": hashtags,
        "page_keywords": keywords,
        "author": simplify_author(item.get("author") or {}),
        "statistics": item.get("statistics") or {},
        "video": simplify_video(item.get("video") or {}),
        "music": simplify_music(item.get("music") or {}),
        "text_extra": simplify_text_extra(item.get("text_extra") or []),
        "challenges": simplify_challenges(item.get("cha_list") or []),
        "anchors": simplify_anchors(item.get("anchors") or []),
        "share_info": compact(item.get("share_info") or {}),
        "page_meta": page_meta,
        "create_time": item.get("create_time"),
    }
    return compact(metadata)


def choose_cover_url(metadata: dict[str, Any]) -> str | None:
    video = metadata.get("video") or {}
    page_meta = metadata.get("page_meta") or {}
    for value in (
        video.get("cover"),
        video.get("origin_cover"),
        video.get("dynamic_cover"),
        page_meta.get("og:image"),
        page_meta.get("twitter:image"),
    ):
        if isinstance(value, str) and value.startswith("http"):
            return value
    return None


def safe_filename(text: str, fallback: str) -> str:
    text = re.sub(r"[\\/:*?\"<>|\r\n\t]+", "_", text).strip(" ._")
    text = re.sub(r"\s+", " ", text)
    return (text[:80] or fallback).strip()


def extension_from_response(url: str, content_type: str | None) -> str:
    if content_type:
        media_type = content_type.split(";", 1)[0].strip().lower()
        extension = mimetypes.guess_extension(media_type)
        if extension:
            return ".jpg" if extension == ".jpe" else extension

    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return suffix
    return ".jpg"


def download_cover_image(opener, url: str, target_without_suffix: Path, *, referer: str | None) -> Path:
    headers = {"Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"}
    try:
        with request_url(opener, url, referer=referer, headers=headers, timeout=30) as resp:
            content = resp.read()
            if not content:
                raise DouyinDownloadError("封面图片响应为空。")
            extension = extension_from_response(url, resp.headers.get("Content-Type"))
    except (HTTPError, URLError, TimeoutError) as exc:
        raise DouyinDownloadError(f"封面图片下载失败：{exc}") from exc

    target = target_without_suffix.with_suffix(extension)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return target


def content_length_from_head(opener, url: str, referer: str | None) -> int | None:
    try:
        req = Request(url, method="HEAD", headers={**DEFAULT_HEADERS, "Referer": referer or ""})
        req.redirect_urls = []
        with opener.open(req, timeout=30) as resp:
            value = resp.headers.get("Content-Length")
            return int(value) if value and value.isdigit() else None
    except Exception:
        return None


def download_file(
    opener,
    url: str,
    target: Path,
    *,
    referer: str | None,
    overwrite: bool = False,
    chunk_size: int = 1024 * 1024,
) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    expected_size = content_length_from_head(opener, url, referer)

    if target.exists() and not overwrite:
        current_size = target.stat().st_size
        if expected_size and current_size == expected_size:
            print(f"已存在完整文件，跳过下载：{target}")
            return target
        if expected_size and current_size > expected_size:
            print(
                f"本地文件大小 {current_size} 字节超过远端声明大小 {expected_size} 字节，"
                "将重新下载。"
            )
            resume_from = 0
        else:
            resume_from = current_size if current_size > 0 else 0
    else:
        resume_from = 0

    headers = {"Accept": "*/*"}
    if resume_from:
        headers["Range"] = f"bytes={resume_from}-"
        print(f"检测到未完成文件，从 {resume_from} 字节继续下载。")

    mode = "ab" if resume_from else "wb"
    try:
        with request_url(opener, url, referer=referer, headers=headers, timeout=60) as resp:
            status = getattr(resp, "status", resp.getcode())
            if resume_from and status == 200:
                mode = "wb"
                resume_from = 0
                print("服务器不支持续传，重新下载。")

            total = expected_size or int(resp.headers.get("Content-Length") or 0) + resume_from
            done = resume_from
            started = time.time()
            with target.open(mode) as file:
                while True:
                    chunk = resp.read(chunk_size)
                    if not chunk:
                        break
                    file.write(chunk)
                    done += len(chunk)
                    if total:
                        percent = done / total * 100
                        speed = done / max(time.time() - started, 0.1) / 1024 / 1024
                        print(f"\r下载中：{percent:6.2f}%  {done}/{total} bytes  {speed:.2f} MB/s", end="")
                    else:
                        print(f"\r下载中：{done} bytes", end="")
            print()
    except (HTTPError, URLError, TimeoutError) as exc:
        raise DouyinDownloadError(f"下载失败：{exc}") from exc

    if expected_size and target.stat().st_size != expected_size:
        raise DouyinDownloadError(
            f"文件大小不完整：当前 {target.stat().st_size} 字节，期望 {expected_size} 字节。请重新运行脚本续传。"
        )
    return target


def save_metadata(path: Path, metadata: dict[str, Any]) -> None:
    path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
