# 前端说明

本目录是批阅奏折项目的前端，使用 React、TypeScript、Vite 和 Tailwind CSS 构建。

## 运行

```bash
npm install
npm run dev
```

默认开发地址为 `http://localhost:3000`。

## 功能

- 登录和注册
- 奏折列表、筛选、搜索
- 御案待批、已批御案、已发折件、内阁简报
- 奏折详情批阅与盖章
- 新奏折提交
- 好友面板与个人面板

## 代理

Vite 会把这些请求代理到后端：

- `/api`
- `/health`

后端默认地址是 `http://127.0.0.1:8000`。

## 说明

前端使用本地 token 作为登录态，存储键为 `imperial-token`。
