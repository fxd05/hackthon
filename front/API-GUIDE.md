# 前端对接接口说明

本项目的前端通过统一的 JSON 包装调用后端：

```json
{ "success": true, "data": {} }
```

失败时返回：

```json
{ "success": false, "error": "错误信息" }
```

## 认证

前端把 token 存在 `localStorage` 的 `imperial-token` 中，并通过：

```http
Authorization: Bearer <token>
```

访问需要登录的接口。

## 认证接口

### POST `/api/register`

注册并返回用户与 token。

### POST `/api/login`

登录并返回用户与 token。

### GET `/api/me`

获取当前用户。

## 好友接口

### GET `/api/users/search?q=关键词`

按 `username` 或 `displayName` 搜索用户。

### POST `/api/friends/request`

发送好友请求。

请求体：

```json
{ "toUserId": "user-id" }
```

### GET `/api/friends`

返回：

- `friends`
- `pendingReceived`
- `pendingSent`

### POST `/api/friends/{friend_id}/accept`

接受好友请求。

### POST `/api/friends/{friend_id}/reject`

拒绝好友请求。

## 奏折接口

### GET `/api/memorials`

获取当前用户收到的奏折。

### GET `/api/memorials/sent`

获取当前用户发出的奏折。

### GET `/api/memorials/{memorial_id}`

获取单条奏折详情。

### POST `/api/memorials`

粘贴抖音文案创建奏折。

请求体：

```json
{
  "rawText": "分享文案",
  "customSender": "翰林学士 张三",
  "toUserId": "user-id"
}
```

### POST `/api/memorials/from-url`

粘贴抖音链接创建奏折。

请求体：

```json
{
  "url": "https://v.douyin.com/xxxxx/",
  "toUserId": "user-id"
}
```

### POST `/api/memorials/analyze`

兼容分析接口，语义同 `from-url`。

### POST `/api/memorials/analyzed`

直接写入已分析好的奏折数据。

### PATCH `/api/memorials/{memorial_id}`

更新奏折字段。

### POST `/api/memorials/{memorial_id}/approve`

批阅奏折。

请求体：

```json
{
  "status": "approved",
  "imperialComment": "朕已阅。"
}
```

### DELETE `/api/memorials/{memorial_id}`

删除奏折。

### POST `/api/memorials/reset`

重置当前用户的奏折种子数据。

## 辅助接口

### POST `/api/generate-comment`

生成朱批。

### GET `/api/briefing`

获取每日简报。

### GET `/api/profile`

获取个人画像和统计。
