# 后端说明

后端是一个 FastAPI 服务，入口为根目录 `app.py`，实际应用在 `backend/main.py` 中创建。

## 运行

```bash
uvicorn app:app --reload --port 8000
```

## 组成

- `backend/main.py`：应用创建、CORS、异常处理、路由挂载
- `backend/routers/auth.py`：注册、登录、当前用户
- `backend/routers/friends.py`：用户搜索、好友请求、好友列表
- `backend/routers/memorials.py`：奏折创建、列表、批阅、简报、画像
- `backend/models.py`：请求体和数据模型
- `backend/services/memorials.py`：奏折生成、解析、存储、列表聚合
- `backend/services/text_ai.py`：文本生成任务封装
- `backend/store.py`：JSON 读写

## 存储

后端直接读写项目根目录下的 JSON 文件：

- `memorials-store.json`
- `users-store.json`
- `friends-store.json`

## 接口

实际提供的接口以 `backend/routers/` 为准，包含：

- 认证：`/api/register`、`/api/login`、`/api/me`
- 好友：`/api/users/search`、`/api/friends`、`/api/friends/request`、`/api/friends/{friend_id}/accept`、`/api/friends/{friend_id}/reject`
- 奏折：`/api/memorials`、`/api/memorials/sent`、`/api/memorials/{memorial_id}`、`/api/memorials/from-url`、`/api/memorials/analyze`、`/api/memorials/analyzed`、`/api/memorials/{memorial_id}/approve`、`/api/memorials/{memorial_id}` `PATCH`
- 辅助：`/api/generate-comment`、`/api/briefing`、`/api/profile`

## 备注

项目目前是本地 JSON 持久化，不依赖数据库。AI 接口在模型不可用时会回退到本地模板逻辑，保证流程可用。
