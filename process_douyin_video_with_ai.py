#!/usr/bin/env python
"""
Resolve a Douyin share URL, save metadata and cover, download the video, then
send the video to Qwen video understanding and save the AI JSON result.

Usage:
  python process_douyin_video_with_ai.py "https://v.douyin.com/xxxx/"
  python process_douyin_video_with_ai.py "复制出来的一整段分享文案，里面只要包含链接即可" -o outputs

Required .env:
  DASHSCOPE_API_KEY=your_api_key

Optional .env:
  DASHSCOPE_MODEL=qwen3.6-flash
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

from douyin_video_assets import (
    DouyinDownloadError,
    build_metadata,
    choose_cover_url,
    download_cover_image,
    download_file,
    fetch_share_page,
    find_aweme_item,
    get_video_urls,
    make_opener,
    parse_router_data,
    resolve_aweme_id,
    safe_filename,
    save_metadata,
)
from qwen_video_analysis import analyze_video, configure_logging, get_api_key, save_json


DEFAULT_OUTPUT_DIR = Path("outputs")


class DouyinAiPipelineError(RuntimeError):
    """Raised when the combined Douyin + AI pipeline cannot continue."""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="解析抖音分享链接，保存封面/视频/元数据，并生成 AI 分析 JSON。")
    parser.add_argument("input", nargs="?", help="抖音短链、分享页链接，或包含链接的整段分享文案")
    parser.add_argument("-url", default=None, help="抖音短链、分享页链接，或包含链接的整段分享文案")
    parser.add_argument("-o", "--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="输出目录，默认 outputs")
    parser.add_argument("--overwrite", action="store_true", help="覆盖已存在的视频文件")
    parser.add_argument("--no-cover", dest="cover", action="store_false", help="不下载封面图，只在 JSON 中保留封面 URL")
    parser.add_argument("--no-video", dest="keep_video", action="store_false", help="AI 分析完成后删除本地视频文件")
    parser.add_argument("--print-urls", action="store_true", help="打印全部候选视频地址")
    parser.set_defaults(cover=True, keep_video=True)
    return parser


def write_pipeline_summary(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def resolve_and_save_assets(args: argparse.Namespace) -> dict[str, Any]:
    opener = make_opener()
    aweme_id, source_url = resolve_aweme_id(opener, args.url)
    logging.info("视频 ID：%s", aweme_id)

    page, share_url = fetch_share_page(opener, aweme_id)
    data = parse_router_data(page)
    item = find_aweme_item(data, aweme_id)
    urls = get_video_urls(item)
    if not urls:
        raise DouyinAiPipelineError("没有在页面数据中找到可下载的视频地址。")

    metadata = build_metadata(
        aweme_id=aweme_id,
        source_url=source_url,
        share_url=share_url,
        page=page,
        item=item,
        urls=urls,
    )
    title = metadata.get("title") or metadata.get("desc") or aweme_id
    basename = safe_filename(f"{aweme_id}_{title}", f"douyin_{aweme_id}")
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    metadata_path = output_dir / f"{basename}.metadata.json"
    analysis_path = output_dir / f"{basename}.analysis.json"
    summary_path = output_dir / f"{basename}.pipeline.json"
    cover_base_path = output_dir / f"{basename}_cover"
    video_path = output_dir / f"{basename}.mp4"

    metadata["metadata_path"] = str(metadata_path)
    metadata["analysis_path"] = str(analysis_path)
    metadata["pipeline_path"] = str(summary_path)
    metadata["video_path"] = str(video_path)

    cover_url = choose_cover_url(metadata)
    if cover_url and args.cover:
        try:
            cover_path = download_cover_image(opener, cover_url, cover_base_path, referer=share_url)
            metadata["cover_url"] = cover_url
            metadata["cover_path"] = str(cover_path)
            logging.info("封面图：%s", cover_path)
        except DouyinDownloadError as exc:
            metadata["cover_url"] = cover_url
            metadata["cover_error"] = str(exc)
            logging.warning("封面图保存失败：%s", exc)
    elif cover_url:
        metadata["cover_url"] = cover_url

    save_metadata(metadata_path, metadata)
    logging.info("元数据 JSON：%s", metadata_path)

    if args.print_urls:
        for index, video_url in enumerate(urls, start=1):
            logging.info("候选视频地址 %s/%s：%s", index, len(urls), video_url)

    last_error: Exception | None = None
    for index, video_url in enumerate(urls, start=1):
        try:
            logging.info("下载视频地址 %s/%s", index, len(urls))
            download_file(opener, video_url, video_path, referer=share_url, overwrite=args.overwrite)
            if video_path.stat().st_size == 0:
                raise DouyinAiPipelineError("下载到的视频文件为空。")
            break
        except Exception as exc:
            last_error = exc
            logging.warning("这个视频地址失败：%s", exc)
    else:
        raise DouyinAiPipelineError(f"所有视频地址都下载失败。最后错误：{last_error}")

    return {
        "metadata": metadata,
        "metadata_path": metadata_path,
        "analysis_path": analysis_path,
        "summary_path": summary_path,
        "video_path": video_path,
    }


def run(args: argparse.Namespace) -> int:
    assets: dict[str, Any] | None = None
    analysis_result: dict[str, Any]

    try:
        api_key = get_api_key()
        assets = resolve_and_save_assets(args)
        analysis_result = analyze_video(api_key, assets["video_path"])
    except Exception as exc:
        logging.exception("流程执行失败。")
        analysis_result = {"error": True, "message": str(exc)}

        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        fallback_path = output_dir / "douyin_ai_pipeline_error.analysis.json"
        if assets:
            analysis_path = assets["analysis_path"]
        else:
            analysis_path = fallback_path
        save_json(analysis_result, analysis_path)
        print(json.dumps(analysis_result, ensure_ascii=False, indent=2))
        return 1

    save_json(analysis_result, assets["analysis_path"])

    summary = {
        "aweme_id": assets["metadata"].get("aweme_id"),
        "title": assets["metadata"].get("title"),
        "metadata_path": str(assets["metadata_path"]),
        "cover_path": assets["metadata"].get("cover_path"),
        "video_path": str(assets["video_path"]) if args.keep_video else None,
        "analysis_path": str(assets["analysis_path"]),
        "analysis": analysis_result,
    }
    write_pipeline_summary(assets["summary_path"], summary)

    if not args.keep_video:
        assets["video_path"].unlink(missing_ok=True)

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    configure_logging()
    parser = build_parser()
    args = parser.parse_args()
    args.url = args.url or args.input
    if not args.url:
        parser.error("请传入抖音短链、分享页链接，或包含链接的整段分享文案。")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
