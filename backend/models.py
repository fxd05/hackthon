from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


AiCategory = Literal["干货类", "创意类", "抽象类"]
FrontendCategory = Literal["经略阁", "创意坊", "寻乐记"]
MemorialStatus = Literal["pending", "approved", "rejected", "held"]
FriendStatus = Literal["pending", "accepted", "rejected"]


class User(BaseModel):
    id: str
    username: str
    passwordHash: str
    displayName: str
    avatarTitle: str
    createdAt: str


class SafeUser(BaseModel):
    id: str
    username: str
    displayName: str
    avatarTitle: str
    createdAt: str


class FriendRequest(BaseModel):
    id: str
    fromUserId: str
    toUserId: str
    status: FriendStatus
    createdAt: str


class VisualSummaryItem(BaseModel):
    text: str
    timestamp: str


class AiAnalysisPayload(BaseModel):
    summary: str
    tags: list[str] = Field(default_factory=list)
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
    keywords: list[str] = Field(default_factory=list)
    entertainmentRatio: int = Field(ge=0, le=100)
    severityLevel: str
    status: MemorialStatus
    createdTime: str
    imperialComment: str | None = None
    approvedTime: str | None = None
    fromUserId: str | None = None
    toUserId: str | None = None
    fromUserDisplayName: str | None = None
    toUserDisplayName: str | None = None
    senderReadAt: str | None = None
    voiceCommentPath: str | None = None
    voiceCommentMime: str | None = None
    voiceCommentDurationMs: int | None = Field(default=None, ge=0)
    videoInfo: dict | None = None


class RegisterRequest(BaseModel):
    username: str
    password: str
    displayName: str | None = None
    avatarTitle: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class FriendRequestCreate(BaseModel):
    toUserId: str


class CreateTextMemorialRequest(BaseModel):
    rawText: str
    customSender: str | None = None
    toUserId: str | None = None


class CreateUrlMemorialRequest(BaseModel):
    url: str
    toUserId: str | None = None


class GenerateCommentRequest(BaseModel):
    title: str
    category: str | None = None
    sender: str | None = None
    tone: str | None = None


class ApproveMemorialRequest(BaseModel):
    status: MemorialStatus
    imperialComment: str | None = None
    voiceCommentBase64: str | None = None
    voiceCommentMime: str | None = None
    voiceCommentDurationMs: int | None = Field(default=None, ge=0)


class UpdateMemorialRequest(BaseModel):
    status: MemorialStatus | None = None
    imperialComment: str | None = None
    severityLevel: str | None = None
    entertainmentRatio: int | None = Field(default=None, ge=0, le=100)


class CreateAnalyzedMemorialRequest(BaseModel):
    rawText: str
    title: str
    url: str
    sender: str | None = None
    analysis: AiAnalysisPayload
    status: MemorialStatus = "pending"
    severityLevel: str | None = None
    entertainmentRatio: int | None = Field(default=None, ge=0, le=100)
