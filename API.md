# Memorials Backend API

FastAPI 服务入口：`app.py`。

启动方式：

```bash
uvicorn app:app --reload
```

服务会读写项目根目录下的 `memorials-store.json`，返回字段对齐前端现有结构。

## 分类转换

后端 AI 分析分类会转换为前端分类：

| AI category | 前端 category |
| --- | --- |
| `干货类` | `经略阁` |
| `创意类` | `创意坊` |
| `抽象类` | `寻乐记` |

已确认：前端分类名使用 `寻乐记`。

## 前端奏章字段

所有返回给前端的奏章对象均为：

```json
{
  "id": "mem-xxxxxxxxxxxx",
  "title": "标题",
  "url": "https://www.douyin.com/...",
  "rawText": "原始分享文案",
  "sender": "钦天监 抖音巡检",
  "category": "经略阁",
  "summary": "约150字概要",
  "keywords": ["标签1", "标签2", "标签3"],
  "entertainmentRatio": 62,
  "severityLevel": "微臣急奏",
  "status": "pending",
  "createdTime": "2026-05-24T12:00:00Z",
  "imperialComment": "可选批注",
  "approvedTime": "2026-05-24T12:05:00Z"
}
```

字段类型：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 后端生成，格式为 `mem-` 加 12 位随机字符。 |
| `title` | string | 是 | 抖音元数据标题，或创建接口传入标题。 |
| `url` | string | 是 | 原始抖音链接或解析后的分享链接。 |
| `rawText` | string | 是 | 用户提交的原始分享文本。 |
| `sender` | string | 是 | 上奏人；不传时为 `钦天监 抖音巡检`。 |
| `category` | `经略阁`/`创意坊`/`寻乐记` | 是 | 由 AI 分类转换得到。 |
| `summary` | string | 是 | AI 生成摘要。 |
| `keywords` | string[] | 是 | AI `tags` 字段转换得到。 |
| `entertainmentRatio` | number | 是 | 0 到 100；不传时按分类默认生成。 |
| `severityLevel` | string | 是 | 不传时为 `微臣急奏`。 |
| `status` | `pending`/`approved`/`rejected` | 是 | 默认 `pending`。 |
| `createdTime` | ISO datetime | 是 | 后端创建时间。 |
| `imperialComment` | string/null | 否 | 批注。 |
| `approvedTime` | ISO datetime/null | 否 | 状态变为 `approved` 时自动写入。 |

## 接口

### GET `/health`

健康检查。

响应：

```json
{ "status": "ok" }
```

### GET `/api/memorials`

获取奏章列表。

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `status` | `pending`/`approved`/`rejected` | 否 | 按状态筛选。 |
| `category` | `经略阁`/`创意坊`/`寻乐记` | 否 | 按前端分类筛选。 |

响应：`Memorial[]`。

### GET `/api/memorials/{memorial_id}`

获取单条奏章。

响应：`Memorial`。

404：

```json
{ "detail": "未找到对应奏章。" }
```

### POST `/api/memorials/analyze`

接收抖音分享文本，后端解析视频、调用 Qwen 分析，并持久化为前端奏章对象。

请求体：

```json
{
  "rawText": "https://v.douyin.com/xxxx/ 这里可以是整段分享文案",
  "sender": "工部侍郎 科技达人",
  "status": "pending",
  "severityLevel": "微臣急奏",
  "entertainmentRatio": 88
}
```

必填字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `rawText` | string | 是 | 必须包含 URL。 |
| `sender` | string/null | 否 | 不传使用默认值。 |
| `status` | `pending`/`approved`/`rejected` | 否 | 默认 `pending`。 |
| `severityLevel` | string/null | 否 | 不传使用默认值。 |
| `entertainmentRatio` | number/null | 否 | 0 到 100；不传按 AI 分类默认生成。 |

响应：`Memorial`。

失败：

```json
{ "detail": "视频解析或 AI 分析失败：错误原因" }
```

### POST `/api/memorials`

不调用视频解析，直接把已知分析结果转换并保存为前端奏章对象。适合调试或接入其它分析来源。

请求体：

```json
{
  "rawText": "https://v.douyin.com/xxxx/ 原始分享文案",
  "title": "标题",
  "url": "https://www.douyin.com/video/xxxx",
  "sender": "工部侍郎 科技达人",
  "analysis": {
    "summary": "视频概要",
    "tags": ["标签1", "标签2", "标签3"],
    "category": "创意类",
    "visual_summary": null
  },
  "status": "pending",
  "severityLevel": "微臣急奏",
  "entertainmentRatio": 88
}
```

响应：`Memorial`。

### PATCH `/api/memorials/{memorial_id}`

更新状态、批注、紧急程度或娱乐指数。

请求体：

```json
{
  "status": "approved",
  "imperialComment": "朕已阅。",
  "severityLevel": "日常请安",
  "entertainmentRatio": 78
}
```

说明：

- `status` 更新为 `approved` 时，如果还没有 `approvedTime`，后端会自动写入当前时间。
- `status` 更新为 `pending` 或 `rejected` 时，后端会清空 `approvedTime`。

响应：`Memorial`。
