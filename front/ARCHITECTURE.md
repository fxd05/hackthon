# 前端架构说明

前端使用 React + TypeScript + Vite + Tailwind CSS，页面以“御书房卷轴”风格组织。

## 目录

```
front/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts
│   ├── utils/
│   │   └── api.ts
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── LoginPage.tsx
│   │   ├── SubmitMemorial.tsx
│   │   ├── MemorialDetail.tsx
│   │   ├── BriefingView.tsx
│   │   ├── FriendsPanel.tsx
│   │   └── ProfilePanel.tsx
│   └── assets/
│       └── images/
└── vite.config.ts
```

## 组件分工

- `App.tsx`：入口壳层
- `AuthContext.tsx`：登录态管理
- `Dashboard.tsx`：主工作台、统计、分类、搜索、栏目切换
- `SubmitMemorial.tsx`：提交新折子
- `MemorialDetail.tsx`：查看与批阅奏折
- `BriefingView.tsx`：每日简报
- `FriendsPanel.tsx`：好友管理
- `ProfilePanel.tsx`：个人信息与统计

## 当前栏目

- 御案待批
- 已批御案
- 已发折件
- 内阁简报

其中“御案待批”和“已批御案”共用分类与搜索逻辑。

## 数据来源

前端通过 `authFetch` 调后端接口，登录 token 存在 `localStorage` 的 `imperial-token` 中。

## 构建

```bash
npm run build
```

开发环境默认运行在 `http://localhost:3000`，并代理 `/api` 到后端。
