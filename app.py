from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, status
from pydantic import BaseModel, Field, HttpUrl, field_validator

from douyin_video_assets import extract_first_url
from process_douyin_video_with_ai import build_parser, resolve_and_save_assets
from qwen_video_analysis import analyze_video, get_api_key


BASE_DIR = Path(__file__).resolve().parent
STORE_PATH = BASE_DIR / "memorials-store.json"
DEFAULT_OUTPUT_DIR = BASE_DIR / "outputs"

AiCategory = Literal["干货类", "创意类", "抽象类"]
FrontendCategory = Literal["经略阁", "创意坊", "寻乐记"]
MemorialStatus = Literal["pending", "approved", "rejected"]

CATEGORY_TO_FRONTEND: dict[str, FrontendCategory] = {
    "干货类": "经略阁",
    "创意类": "创意坊",
    "抽象类": "寻乐记",
}

DEFAULT_SENDER = "钦天监 抖音巡检"
DEFAULT_SEVERITY_LEVEL = "微臣急奏"
DEFAULT_ENTERTAINMENT_RATIO: dict[str, int] = {
    "干货类": 62,
    "创意类": 82,
    "抽象类": 92,
}


class VisualSummaryItem(BaseModel):
    text: str
    timestamp: str


class AiAnalysisPayload(BaseModel):
    summary: str
    tags: list[str] = Field(min_length=1)
    category: AiCategory
    visual_summary: list[VisualSummaryItem] | None = None


class Memorial(BaseModel):
    id: str
    title: str
    url: str
    rawText: str
    sender: str
    category: FrontendCategory
    summary: str
    keywords: list[str]
    entertainmentRatio: int = Field(ge=0, le=100)
    severityLevel: str
    status: MemorialStatus
    createdTime: datetime
    imperialComment: str | None = None
    approvedTime: datetime | None = None


class AnalyzeMemorialRequest(BaseModel):
    rawText: str = Field(description="抖音短链、分享页链接，或包含链接的完整分享文案。")
    sender: str | None = Field(default=None, description="前端展示的上奏人，不传则使用后端默认值。")
    status: MemorialStatus = Field(default="pending", description="新建奏章状态，默认 pending。")
    severityLevel: str | None = Field(default=None, description="前端展示的紧急程度，不传则使用默认值。")
    entertainmentRatio: int | None = Field(default=None, ge=0, le=100, description="娱乐指数，不传则按 AI 分类生成默认值。")

    @field_validator("rawText")
    @classmethod
    def raw_text_must_contain_url(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("rawText 不能为空。")
        try:
            extract_first_url(stripped)
        except Exception as exc:
            raise ValueError("rawText 必须包含 URL。") from exc
        return stripped


class CreateMemorialRequest(BaseModel):
    rawText: str
    title: str
    url: HttpUrl | str
    sender: str = DEFAULT_SENDER
    analysis: AiAnalysisPayload
    status: MemorialStatus = "pending"
    severityLevel: str | None = None
    entertainmentRatio: int | None = Field(default=None, ge=0, le=100)

    @field_validator("rawText", "title")
    @classmethod
    def must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("字段不能为空。")
        return stripped


class UpdateMemorialRequest(BaseModel):
    status: MemorialStatus | None = None
    imperialComment: str | None = None
    severityLevel: str | None = None
    entertainmentRatio: int | None = Field(default=None, ge=0, le=100)


class ErrorResponse(BaseModel):
    detail: str


app = FastAPI(
    title="Memorials Backend API",
    version="1.0.0",
    description="抖音视频分析结果到前端奏章字段的 FastAPI 后端。",
)


def now_utc() -> datetime:
    return datetime.now(UTC)


def load_memorials() -> list[Memorial]:
    if not STORE_PATH.exists():
        return []
    try:
        raw = json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"存储文件 JSON 解析失败：{exc.msg}") from exc
    if not isinstance(raw, list):
        raise HTTPException(status_code=500, detail="存储文件顶层必须是数组。")
    return [Memorial.model_validate(item) for item in raw]


def save_memorials(memorials: list[Memorial]) -> None:
    STORE_PATH.write_text(
        json.dumps([item.model_dump(mode="json", exclude_none=True) for item in memorials], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def frontend_category(ai_category: AiCategory) -> FrontendCategory:
    return CATEGORY_TO_FRONTEND[ai_category]


def create_memorial_record(
    *,
    title: str,
    url: str,
    raw_text: str,
    sender: str | None,
    analysis: AiAnalysisPayload,
    status_value: MemorialStatus,
    severity_level: str | None,
    entertainment_ratio: int | None,
) -> Memorial:
    category = frontend_category(analysis.category)
    created_at = now_utc()
    return Memorial(
        id=f"mem-{uuid.uuid4().hex[:12]}",
        title=title.strip(),
        url=url.strip(),
        rawText=raw_text.strip(),
        sender=(sender or DEFAULT_SENDER).strip(),
        category=category,
        summary=analysis.summary.strip(),
        keywords=[tag.strip() for tag in analysis.tags if tag.strip()],
        entertainmentRatio=entertainment_ratio
        if entertainment_ratio is not None
        else DEFAULT_ENTERTAINMENT_RATIO[analysis.category],
        severityLevel=(severity_level or DEFAULT_SEVERITY_LEVEL).strip(),
        status=status_value,
        createdTime=created_at,
        approvedTime=created_at if status_value == "approved" else None,
    )


def persist_new_memorial(memorial: Memorial) -> Memorial:
    memorials = load_memorials()
    memorials.insert(0, memorial)
    save_memorials(memorials)
    return memorial


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/memorials", response_model=list[Memorial], tags=["memorials"])
def list_memorials(
    status_filter: MemorialStatus | None = Query(default=None, alias="status"),
    category: FrontendCategory | None = None,
) -> list[Memorial]:
    memorials = load_memorials()
    if status_filter:
        memorials = [item for item in memorials if item.status == status_filter]
    if category:
        memorials = [item for item in memorials if item.category == category]
    return memorials


@app.get(
    "/api/memorials/{memorial_id}",
    response_model=Memorial,
    responses={404: {"model": ErrorResponse}},
    tags=["memorials"],
)
def get_memorial(memorial_id: str) -> Memorial:
    for item in load_memorials():
        if item.id == memorial_id:
            return item
    raise HTTPException(status_code=404, detail="未找到对应奏章。")


@app.post(
    "/api/memorials",
    response_model=Memorial,
    status_code=status.HTTP_201_CREATED,
    tags=["memorials"],
)
def create_memorial(request: CreateMemorialRequest) -> Memorial:
    memorial = create_memorial_record(
        title=request.title,
        url=str(request.url),
        raw_text=request.rawText,
        sender=request.sender,
        analysis=request.analysis,
        status_value=request.status,
        severity_level=request.severityLevel,
        entertainment_ratio=request.entertainmentRatio,
    )
    return persist_new_memorial(memorial)


@app.post(
    "/api/memorials/analyze",
    response_model=Memorial,
    status_code=status.HTTP_201_CREATED,
    responses={502: {"model": ErrorResponse}},
    tags=["analysis"],
)
def analyze_and_create_memorial(request: AnalyzeMemorialRequest) -> Memorial:
    parser = build_parser()
    args = parser.parse_args(
        [
            request.rawText,
            "--output-dir",
            str(DEFAULT_OUTPUT_DIR),
        ]
    )
    args.url = args.input

    try:
        api_key = get_api_key()
        assets = resolve_and_save_assets(args)
        analysis_result = analyze_video(api_key, assets["video_path"])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"视频解析或 AI 分析失败：{exc}") from exc

    if analysis_result.get("error") is True:
        raise HTTPException(status_code=502, detail=str(analysis_result.get("message") or "AI 分析失败。"))

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
    url = str(metadata.get("source_url") or metadata.get("share_url") or extract_first_url(request.rawText))

    memorial = create_memorial_record(
        title=title,
        url=url,
        raw_text=request.rawText,
        sender=request.sender,
        analysis=analysis,
        status_value=request.status,
        severity_level=request.severityLevel,
        entertainment_ratio=request.entertainmentRatio,
    )
    return persist_new_memorial(memorial)


@app.patch(
    "/api/memorials/{memorial_id}",
    response_model=Memorial,
    responses={404: {"model": ErrorResponse}},
    tags=["memorials"],
)
def update_memorial(memorial_id: str, request: UpdateMemorialRequest) -> Memorial:
    memorials = load_memorials()
    for index, item in enumerate(memorials):
        if item.id != memorial_id:
            continue

        patch = request.model_dump(exclude_unset=True)
        data = item.model_dump()
        data.update(patch)
        if patch.get("status") == "approved" and item.approvedTime is None:
            data["approvedTime"] = now_utc()
        if patch.get("status") and patch["status"] != "approved":
            data["approvedTime"] = None

        updated = Memorial.model_validate(data)
        memorials[index] = updated
        save_memorials(memorials)
        return updated

    raise HTTPException(status_code=404, detail="未找到对应奏章。")
