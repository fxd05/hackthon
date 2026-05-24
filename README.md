# 批阅奏折 - 抖音短视频脑洞简报

这是一个带“皇宫御书房”风格的全栈 Web 应用。用户把抖音分享文案或视频链接呈递进来，系统会生成奏折卡片，并支持批阅、归档、好友流转和每日简报。

## 项目结构

- `app.py`：后端入口
- `backend/`：FastAPI 服务、数据模型、路由、持久化逻辑
- `front/`：React + Vite 前端
- `memorials-store.json`：奏折数据
- `users-store.json`：用户数据
- `friends-store.json`：好友关系数据
- `outputs/`：视频解析或处理输出

## 运行方式

### 本地或 Cloudflare Tunnel

先构建前端：

```bash
cd front
npm install
npm run build
```

再启动后端：

```bash
uvicorn app:app --reload --port 8000
```

现在后端会直接托管前端静态文件，外网访问只需要把 Cloudflare Tunnel 指向 `http://127.0.0.1:8000`。

开发时如果还想单独跑前端：

```bash
cd front
npm run dev
```

前端开发地址默认是 `http://localhost:3000`，并把 `/api` 和 `/health` 代理到 `http://127.0.0.1:8000`。

## 主要功能

- 注册、登录、查看当前用户
- 搜索用户、发送和处理好友请求
- 录入抖音分享文案或链接生成奏折
- 御案待批、已批御案、已发折件、内阁简报四个栏目
- 对奏折进行准奏、驳回、留中和朱批
- 查看每日简报与分类统计

## 数据持久化

项目使用本地 JSON 文件保存数据，不依赖数据库。

- `memorials-store.json`
- `users-store.json`
- `friends-store.json`

## 接口概览

- `POST /api/register`
- `POST /api/login`
- `GET /api/me`
- `GET /api/users/search`
- `POST /api/friends/request`
- `GET /api/friends`
- `POST /api/friends/{friend_id}/accept`
- `POST /api/friends/{friend_id}/reject`
- `GET /api/memorials`
- `GET /api/memorials/sent`
- `GET /api/memorials/{memorial_id}`
- `POST /api/memorials`
- `POST /api/memorials/from-url`
- `POST /api/memorials/analyze`
- `POST /api/memorials/analyzed`
- `PATCH /api/memorials/{memorial_id}`
- `POST /api/memorials/{memorial_id}/approve`
- `DELETE /api/memorials/{memorial_id}`
- `POST /api/memorials/reset`
- `POST /api/generate-comment`
- `GET /api/briefing`
- `GET /api/profile`

更完整的接口说明见 `API.md`。
