#!/usr/bin/env python
"""
Resolve a Douyin share/video URL and save its video URL plus metadata.

Usage:
  python download_douyin_video.py "https://v.douyin.com/xxxx/"
  python download_douyin_video.py "复制出来的一整段分享文案，里面只要包含链接即可" -o outputs
  python download_douyin_video.py -url "https://v.douyin.com/xxxx/" --download
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
from http.cookiejar import CookieJar
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import (
    HTTPCookieProcessor,
    HTTPRedirectHandler,
    Request,
    build_opener,
)


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


def request_url(opener, url: str, *, referer: str | None = None, headers: dict[str, str] | None = None, timeout: int = 30):
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
    metadata = {
        "aweme_id": aweme_id,
        "source_url": source_url,
        "share_url": share_url,
        "video_url": urls[0],
        "video_urls": urls,
        "desc": item.get("desc"),
        "hashtags": extract_hashtags(item),
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


def safe_filename(text: str, fallback: str) -> str:
    text = re.sub(r"[\\/:*?\"<>|\r\n\t]+", "_", text).strip(" ._")
    text = re.sub(r"\s+", " ", text)
    return (text[:80] or fallback).strip()


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


def run(args: argparse.Namespace) -> Path:
    opener = make_opener()
    aweme_id, source_url = resolve_aweme_id(opener, args.url)
    print(f"视频 ID：{aweme_id}")

    page, share_url = fetch_share_page(opener, aweme_id)
    data = parse_router_data(page)
    item = find_aweme_item(data, aweme_id)
    urls = get_video_urls(item)
    if not urls:
        raise DouyinDownloadError("没有在页面数据中找到可下载的视频地址。")

    desc = item.get("desc") or aweme_id
    author = ((item.get("author") or {}).get("nickname")) or ""
    duration_ms = (item.get("video") or {}).get("duration")
    basename = safe_filename(f"{aweme_id}_{desc}", f"douyin_{aweme_id}")
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = output_dir / f"{basename}.json"
    video_path = output_dir / f"{basename}.mp4"
    metadata = build_metadata(
        aweme_id=aweme_id,
        source_url=source_url,
        share_url=share_url,
        page=page,
        item=item,
        urls=urls,
    )

    print(f"标题：{desc}")
    if author:
        print(f"作者：{author}")
    if duration_ms:
        print(f"时长：{duration_ms / 1000:.1f} 秒")
    print(f"video_url：{urls[0]}")
    print(f"JSON 输出：{metadata_path}")

    if args.metadata:
        save_metadata(metadata_path, metadata)

    if not args.download:
        print(f"可用视频地址数：{len(urls)}")
        if args.print_urls:
            for index, video_url in enumerate(urls, start=1):
                print(f"[{index}] {video_url}")
        return metadata_path

    last_error: Exception | None = None
    for index, video_url in enumerate(urls, start=1):
        try:
            print(f"尝试下载地址 {index}/{len(urls)}")
            result = download_file(opener, video_url, video_path, referer=share_url, overwrite=args.overwrite)
            return result
        except Exception as exc:
            last_error = exc
            print(f"这个地址失败：{exc}")

    raise DouyinDownloadError(f"所有视频地址都下载失败。最后错误：{last_error}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="解析抖音分享链接，保存 video_url 和视频元数据。")
    parser.add_argument("-url", default=None, help="抖音短链、分享页链接，或包含链接的整段分享文案")
    parser.add_argument("-o", "--output-dir", default="outputs", help="输出目录，默认 outputs")
    parser.add_argument("--download", action="store_true", help="额外下载视频文件到本地")
    parser.add_argument("--overwrite", action="store_true", help="覆盖已存在文件")
    parser.add_argument("--no-metadata", dest="metadata", action="store_false", help="不保存 JSON 元数据，只打印解析结果")
    parser.add_argument("--print-urls", action="store_true", help="打印全部候选视频地址")
    parser.set_defaults(metadata=True)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    args.url = "4.12 复制打开抖音，看看【HIGUY官方旗舰店的作品】不是哥们 黑色肌理感短袖就是爽啊! # 夏季新款 ... https://v.douyin.com/fUxmwgzKZtM/ W@m.DH zGv:/ :7pm 04/28 "
    if not args.url:
        parser.error("请传入抖音短链、分享页链接，或包含链接的整段分享文案。")
    try:
        path = run(args)
        if args.download:
            print(f"下载完成：{path.resolve()}")
        else:
            print(f"解析完成：{path.resolve()}")
        return 0
    except DouyinDownloadError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
