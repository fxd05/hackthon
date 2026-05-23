# 批阅奏折 — API 接口文档

> 服务默认运行在 `http://localhost:3000`

## 认证方式

除特别标注外，所有接口均需在 HTTP Header 中携带 Bearer Token：

```
Authorization: Bearer <token>
```

Token 通过登录/注册接口获取。

---

## 1. 用户系统

### POST /api/register — 注册

**请求体：**
```json
{
  "username": "myuser",
  "password": "mypassword",
  "displayName": "李太白",
  "avatarTitle": "翰林学士"
}
```

**返回：**
```json
{
  "success": true,
  "data": {
    "token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "user": {
      "id": "...",
      "username": "myuser",
      "displayName": "李太白",
      "avatarTitle": "翰林学士",
      "createdAt": "2026-05-23T..."
    }
  }
}
```

### POST /api/login — 登录

**请求体：**
```json
{
  "username": "myuser",
  "password": "mypassword"
}
```

**返回：** 同注册，包含 `token` 和 `user`。

### GET /api/me — 获取当前用户信息

需认证。返回当前登录用户的基本信息。

---

## 2. 好友系统

### GET /api/users/search?q=关键词 — 搜索用户

需认证。按 username 或 displayName 搜索。

### POST /api/friends/request — 发送好友请求

```json
{ "toUserId": "目标用户id" }
```

### POST /api/friends/respond — 响应好友请求

```json
{ "requestId": "请求id", "action": "accept" | "reject" }
```

### GET /api/friends — 获取好友列表

返回 `friends`（已接受）、`pendingReceived`（收到的待处理）、`pendingSent`（发出的待处理）。

---

## 3. 奏折系统

### POST /api/memorials — 提交奏折（文案模式）

需认证。粘贴抖音文案，后端调用 AI 生成古风奏折。

```json
{
  "rawText": "复制打开抖音，看看xxx...",
  "customSender": "九门提督 张三",
  "toUserId": "接收者用户id"
}
```

### POST /api/memorials/from-url — 提交奏折（URL 模式）

需认证。粘贴视频链接，后端解析视频内容并生成奏折。

```json
{
  "url": "https://v.douyin.com/xxxxx/",
  "toUserId": "接收者用户id"
}
```

**返回：**
```json
{
  "success": true,
  "data": { "...完整的 Memorial 对象..." }
}
```

> 当前视频解析为占位实现（返回模拟数据），后续对接真实解析服务后自动生效。

### GET /api/memorials — 获取收到的奏折

需认证。返回发送给当前用户的所有奏折。

### GET /api/memorials/sent — 获取已发送的奏折

需认证。返回当前用户发出的所有奏折。

### POST /api/memorials/:id/approve — 批阅奏折

```json
{
  "status": "approved" | "rejected" | "held",
  "imperialComment": "朕已阅，甚好！"
}
```

### DELETE /api/memorials/:id — 删除奏折

### POST /api/memorials/reset — 重置奏折数据

---

## 4. AI 辅助

### POST /api/generate-comment — AI 生成批阅评语

```json
{
  "title": "奏折标题",
  "category": "经略阁",
  "sender": "翰林学士 李太白",
  "tone": "pleased" | "angry" | "laugh" | "reward" | "held"
}
```

### GET /api/briefing — 获取每日简报

需认证。返回 AI 生成的朝政总览报告。

---

## 5. Webhook 外部回调（无需认证）

### POST /api/webhook/video-parsed

此接口供外部视频解析服务回调使用，**不需要认证**。

外部服务解析完视频后，将结果 POST 到此端点，系统会自动创建或更新对应奏折。

**请求体 JSON 模板：**

```json
{
  "memorialId": "（可选）已有奏折 ID，填写则更新该奏折",
  "toUserId": "（创建新奏折时必填）接收者用户 ID",
  "videoInfo": {
    "url": "https://v.douyin.com/xxxxx/",
    "title": "视频标题",
    "author": "视频作者昵称",
    "description": "视频描述/文案",
    "coverUrl": "https://p3.douyinpic.com/xxx.jpeg",
    "duration": 30,
    "likeCount": 12000,
    "commentCount": 500,
    "shareCount": 200
  },
  "memorial": {
    "title": "奏折标题（AI 生成或手工填写）",
    "sender": "呈递大臣名号",
    "category": "经略阁",
    "summary": "奏折正文摘要（古风文言）",
    "keywords": ["关键词1", "关键词2", "关键词3"],
    "entertainmentRatio": 85,
    "severityLevel": "日常请安"
  }
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `memorialId` | string | 否 | 已有奏折 ID，用于更新现有奏折 |
| `toUserId` | string | 创建时必填 | 接收奏折的用户 ID |
| `videoInfo.url` | string | 是 | 视频原始链接 |
| `videoInfo.title` | string | 是 | 视频标题 |
| `videoInfo.author` | string | 是 | 视频作者 |
| `videoInfo.description` | string | 是 | 视频描述文案 |
| `videoInfo.coverUrl` | string | 否 | 封面图 URL |
| `videoInfo.duration` | number | 否 | 视频时长（秒） |
| `videoInfo.likeCount` | number | 否 | 点赞数 |
| `videoInfo.commentCount` | number | 否 | 评论数 |
| `videoInfo.shareCount` | number | 否 | 转发数 |
| `memorial.title` | string | 是 | 奏折标题 |
| `memorial.sender` | string | 是 | 呈折人名号 |
| `memorial.category` | string | 是 | `经略阁` / `寻乐记` / `创意坊` |
| `memorial.summary` | string | 是 | 古风正文摘要 |
| `memorial.keywords` | string[] | 是 | 关键词标签数组 |
| `memorial.entertainmentRatio` | number | 是 | 娱乐指数 0-100 |
| `memorial.severityLevel` | string | 是 | `日常请安` / `微臣急奏` / `十万火急` / `弹劾奏章` |

**调用示例 (curl)：**

```bash
curl -X POST http://localhost:3000/api/webhook/video-parsed \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "user-id-here",
    "videoInfo": {
      "url": "https://v.douyin.com/abc123/",
      "title": "哈士奇偷吃事件",
      "author": "铲屎官日记",
      "description": "我家二哈又偷吃了隔壁的鸡腿...",
      "duration": 15,
      "likeCount": 50000
    },
    "memorial": {
      "title": "二哈盗食案·隔壁鸡腿失踪之谜",
      "sender": "巡城御史 铲屎官",
      "category": "寻乐记",
      "summary": "启禀圣上，臣家豢养之哈士奇犬于今晨趁臣不备，飞身越墙，将邻舍鸡腿叼走。现已人赃并获，恳请圣裁。",
      "keywords": ["哈士奇", "偷吃", "搞笑宠物"],
      "entertainmentRatio": 92,
      "severityLevel": "日常请安"
    }
  }'
```

**返回：**
```json
{
  "success": true,
  "data": { "...创建/更新后的 Memorial 对象..." }
}
```

---

## 对接流程

1. 用户在前端"粘贴链接"模式输入视频 URL → 调用 `POST /api/memorials/from-url`
2. 后端当前使用占位解析（返回模拟数据），可替换为真实视频解析服务
3. 若采用异步解析，外部服务解析完成后通过 `POST /api/webhook/video-parsed` 回调写入结果
4. 前端自动刷新奏折列表，展示新奏折
