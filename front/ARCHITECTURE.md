# 批阅奏折 - 抖音短视频脑洞简报 · 前端架构文档

## 项目概述

一个**皇宫御书房模拟器**风格的 Web 应用，用户可以将抖音短视频分享文案"呈递"给系统，由 Gemini 大模型自动将其翻译成古风奏折形式，然后以"皇帝批阅奏章"的交互方式进行浏览、分类、AI 辅助批注和盖章审批。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React (TSX) | 19.x |
| 构建工具 | Vite | 6.x |
| CSS 方案 | Tailwind CSS (Vite 插件模式) | 4.x |
| 动画库 | Motion (Framer Motion) | 12.x |
| 图标库 | Lucide React | 0.546.x |
| 后端运行时 | Express (Node.js) | 4.x |
| AI 模型 | Google Gemini 3.5 Flash (`@google/genai`) | 2.4.x |
| 语言 | TypeScript | 5.8.x |
| 开发服务器 | tsx (直接运行 TS) + Vite middleware | - |

## 目录结构

```
批阅奏折---抖音短视频脑洞简报/
├── index.html                  # Vite 入口 HTML
├── package.json                # 依赖与脚本
├── vite.config.ts              # Vite 配置（React + Tailwind 插件、路径别名 @/）
├── tsconfig.json               # TypeScript 配置
├── .env.example                # 环境变量模板（GEMINI_API_KEY、APP_URL）
├── metadata.json               # AI Studio 应用元数据
├── server.ts                   # Express 后端服务器（API + Vite 中间件）
├── memorials-store.json        # 本地 JSON 文件持久化存储（奏折数据）
└── src/
    ├── main.tsx                # React 入口（挂载 <App />）
    ├── App.tsx                 # 根组件（仅渲染 Dashboard）
    ├── index.css               # 全局样式（字体导入、古风主题、滚动条、纸张纹理）
    ├── types.ts                # TypeScript 类型定义（Memorial、DailyBriefing）
    ├── assets/
    │   └── images/
    │       └── emperor_cat_scholar_*.png  # 学士猫头像图片
    └── components/
        ├── Dashboard.tsx       # 主面板（页面布局、统计、筛选、奏折列表）
        ├── SubmitMemorial.tsx  # 新奏折提交弹窗
        ├── MemorialDetail.tsx  # 奏折详情 + 批阅面板（AI 拟旨、盖章）
        └── BriefingView.tsx    # 每日内阁简报视图（AI 生成宏观汇总）
```

## 前端组件架构

```
App
 └── Dashboard ──────────────── 主控制器/页面
      ├── [统计面板]             待批数、勤政指数、政途评价
      ├── [筛选栏]               分类按钮（经略阁/寻乐记/创意坊）+ 搜索
      ├── [奏折卡片列表]          Memorial 卡片网格（2列），点击打开详情
      ├── SubmitMemorial ─────── 弹窗：录入抖音文案 → POST /api/memorials
      ├── MemorialDetail ─────── 弹窗：查看奏折 + AI 拟旨 + 盖章审批
      └── BriefingView ──────── 每日简报（内嵌在 Dashboard，当前未激活 Tab）
```

### 组件职责

#### `Dashboard.tsx`（主面板，~450 行）
- **状态管理**：`memorials` 列表、`activeTab`（desk/briefing）、`selectedCategory`、`searchQuery`、弹窗开关
- **数据获取**：`fetchMemorials()` → `GET /api/memorials`
- **统计计算**：待批数、勤政指数（已批/总数）、皇帝评级（5 档搞笑称号）
- **筛选逻辑**：按分类 + 关键字/标题/发送者搜索
- **UI 布局**：古风卷轴造型（上下木轴 + 羊皮纸主体 + 红线边距 + "密" 水印）
- **操作**：重置系统 → `POST /api/memorials/reset`、删除 → `DELETE /api/memorials/:id`、审批 → `POST /api/memorials/:id/approve`

#### `SubmitMemorial.tsx`（提交弹窗，~235 行）
- **表单**：好友名号（选填）+ 抖音文案正文（必填）
- **预设按钮**：3 个一键填充经典示例
- **提交流程**：`POST /api/memorials` → 服务端调用 Gemini 翻译成古风奏折
- **加载动画**：5 步趣味文案轮播（"驿骑已执鞭接旨..."）
- **成功反馈**：绿色动画 → 自动刷新列表并关闭弹窗

#### `MemorialDetail.tsx`（详情+批阅面板，~350 行）
- **左栏（7/12）**：奏折正文展示 — 分类标签、标题、发送者、AI 摘要、关键词、原文、"御前审看"跳转抖音链接
- **右栏（5/12）**：御笔裁夺面板
  - **AI 拟旨**：4 种语气按钮（龙颜甚悦/拂袖狂笑/圣上拍案/赏赐猫干）→ `POST /api/generate-comment`
  - **手动编辑**：朱批文本框（可在 AI 生成基础上修改）
  - **决断选择**：准奏 / 驳回
  - **盖章动画**：弹簧物理动画印章（`motion` spring transition），盖章后保存
- **印章效果**：根据状态显示不同颜色/文字的圆形双线印章

#### `BriefingView.tsx`（每日简报，~280 行）
- **数据获取**：`GET /api/briefing` → Gemini 生成宏观汇报
- **展示内容**：
  - 社稷气象一句话总结
  - 内阁大学士上疏正文（AI 生成的搞笑汇报）
  - 分部机要运转名册（分类统计柱状条 + 快捷批阅按钮）
  - 爱卿功绩单（呈折者排行榜）
  - 候批密案名册（待处理奏折快捷入口）

## 数据模型

### Memorial（奏折）
```typescript
interface Memorial {
  id: string;
  title: string;              // 奏折标题（搞笑风格）
  url: string;                // 抖音视频链接
  rawText: string;            // 用户粘贴的原始文案
  sender: string;             // 呈折者名号（古风官职）
  category: '经略阁' | '寻乐记' | '创意坊';  // 三大分类
  summary: string;            // AI 生成的古风奏折正文
  keywords: string[];         // 搞笑标签（最多 4 个）
  entertainmentRatio: number; // 搞笑指数 1-100
  severityLevel: '日常请安' | '微臣急奏' | '十万火急' | '弹劾奏章';
  status: 'pending' | 'approved' | 'rejected' | 'held';
  imperialComment?: string;   // 皇帝批语
  createdTime: string;
  approvedTime?: string;
}
```

### DailyBriefing（每日简报）
```typescript
interface DailyBriefing {
  id: string;
  date: string;
  overallHealth: string;       // 八字社稷气象
  imperialReport: string;      // AI 生成的内阁汇报正文
  categoryStatistics: { category: string; count: number; avgEntertainment: number }[];
  activeSenders: string[];     // 活跃呈折者
}
```

## 后端 API

| 方法 | 路径 | 功能 |
|------|------|------|
| `GET` | `/api/memorials` | 获取所有奏折列表 |
| `POST` | `/api/memorials` | 提交新奏折（Gemini 翻译，降级 fallback） |
| `POST` | `/api/generate-comment` | AI 生成御笔批语（5 种语气） |
| `POST` | `/api/memorials/:id/approve` | 保存批阅决断（状态 + 批语） |
| `POST` | `/api/memorials/reset` | 重置为初始种子数据 |
| `DELETE` | `/api/memorials/:id` | 删除单条奏折 |
| `GET` | `/api/briefing` | 获取 AI 生成的每日简报 |

所有 API 均具备 **Gemini 不可用时的 fallback 机制**：通过关键字匹配 + 模板生成降级内容，确保无 API Key 时仍可使用。

## 视觉设计体系

- **色彩主题**：古风宫廷配色 — 宣纸底色 `#FAF6ED`、朱砂红 `#A93226`、檀木棕 `#5C2318`、墨绿 `#2E5C50`、古铜金 `#C2B095`
- **字体**：Noto Serif SC（正文宋体）、Inter（辅助无衬线）、JetBrains Mono（等宽/数据）
- **卷轴造型**：上下木轴（渐变仿木纹）+ 两侧宽边框 + 红线边距 + "密" 字水印
- **交互动画**：Motion 库 — 卡片悬浮浮起、弹窗淡入、印章弹簧盖章、进度条平滑展开、加载旋转
- **自定义滚动条**：朱砂红滑块 + 宣纸色轨道
- **印章效果**：圆形双线边框 + 旋转 -12° + 红/绿/灰三色对应准奏/留中/驳回

## 运行方式

```bash
# 开发模式（tsx 直接运行 server.ts + Vite HMR）
npm run dev

# 生产构建（Vite 打包前端 + esbuild 打包服务端）
npm run build
npm start
```

## 数据持久化

使用本地 JSON 文件 `memorials-store.json` 存储奏折数据，通过 `fs.readFileSync` / `fs.writeFileSync` 同步读写。首次运行时自动写入 4 条种子数据。
