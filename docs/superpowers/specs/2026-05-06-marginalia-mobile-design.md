# Marginalia 手机版 · 设计规格

**日期**：2026-05-06
**状态**：Draft，待用户审阅
**作者**：lixinran + Claude（brainstorming session）

---

## 0. 一句话目标

把现有的桌面 Electron AI 伴读器 **Marginalia** 改造成 PWA-first 的手机版 v1，分发给小圈子朋友使用，视觉上重做为"杂志目录页"风格的编辑式排版，同时不堵死后续 Capacitor 套壳上 Android 的可能性。

## 1. 范围与分发

| 项 | 决定 | 备注 |
|---|---|---|
| 目标用户 | 自己 + 小圈子朋友 | v1 不上架；v2 看反响再决定 |
| 主路线 | PWA（响应式 + 加到主屏幕） | iOS Safari / Android Chrome 都支持 |
| 备选路线 | 用 Capacitor 套 .apk / iOS 包 | v1 仅 Android 需要时再做；v2 可能扩到 iOS |
| 开发者账号 | v1 不需要 | iOS 朋友走 Safari 加主屏 |
| 后端 | 无 | AI Key 由用户自备 |

## 2. v1 功能清单（13 项）

**阅读核心 (5)**
- 阅读器（EPUB 渲染、翻页、字体大小、行距、日/夜双主题）
- 书架（导入 EPUB、封面、进度、最近阅读）
- 高亮 + 笔记（长按选段 → 上色 + 写笔记）
- 书签（任意位置打书签 + 列表跳转，与 highlights 共用 cfi 锚点机制）
- 自由笔记（每本书一份 Markdown 笔记）

**AI 伴读 (5)**
- 角色单聊（基于选段 + 上下文，流式输出）
- 自定义角色（用户写自己的 prompt 创建新角色）
- AI 圆桌（多角色群聊式讨论，详见 §6.2）
- 观点卡片（AI 发言可保存为可滑动卡片，记录同意/反对）
- AI 全书预读（章节概要 / 全书脉络 / 人物档案）

**输出与回顾 (3)**
- 书评打分（含角色书评：给陪读角色单独打星 + 短评）
- 年报（年度阅读统计卡片）
- 卡片导出（高亮 / 观点 / 书评一键生成可保存图片）

**v2 推迟**
- 思维导图（手机窄屏体验天然差，等 v2 重新设计移动端图形交互方案）

## 3. 视觉语言

**核心隐喻**：整个 App 像一本被精心排版的文学杂志。Marginalia 这个名字字面意思是"书页边的批注"，视觉上要能传达印刷品 / 编辑式排版 / 用户手写痕迹的氛围。

### 3.1 配色系统

| 角色 | 日间（粉） | 夜间（黑） |
|---|---|---|
| 背景 | `#faf0ee` 奶油裸粉 | `#0c0a10` 微紫近黑 |
| 主文字 | `#2d1620` 深紫黑 | `#ebd9de` 暖白 |
| 强调（玫瑰） | `#c87a8e` 柔玫瑰 | `#d8889e` 柔粉 |
| 暖色第三色（仅封面） | `#d4b08c` 暖驼 | `#b89a78` 暖驼 |

**禁用**：渐变、box-shadow、backdrop-filter / blur、彩色 emoji 图标。所有层次靠字号对比 + 1px 分隔线 + 留白完成。

### 3.2 字体三层

| 用途 | 字体 |
|---|---|
| 标题、书名缩写、折页页码、引用 | `Georgia, "Source Han Serif", serif` |
| 中文书名 | `"Songti SC", "Source Han Serif", Georgia, serif` |
| 元信息、状态、罗马数字、Tab 文字 | `'Courier New', monospace` |

字体之间不混用 weight 装饰，依靠 italic / size / 全大写 + 字间距来制造层次。

### 3.3 排版语法

- **Masthead**：居中 `MARGINALIA` wordmark（letter-spacing: 7px）+ 左侧 `NO. 047` + 右侧日期。下方 1px 横线被一个 ◆ 钻石装饰物贯穿。
- **分节标题**：罗马数字 + 等宽全大写词组 + 右侧大写计数。例：`I. IN PROGRESS  ·  FOUR VOLUMES`。强调色玫瑰。
- **书条目**：三列网格 = 36px 封面 / 弹性正文 / 38px 折页页码。entry 间用**点线**（dotted）分割。
- **折页页码**：每本书右侧 27px Georgia 斜体百分数 + 1px 短杠 + `PCT` 小标签。
- **元信息行**：`§ VOL III — 38 NOTES — 2D` 全大写等宽 + 玫瑰色 + em-dash 节奏。
- **🎯 灵魂细节·marginalia**：每本书可选择性显示一行从 highlights 抽出的"用户最爱批注"，斜体小字 + 左侧 1px 玫瑰色短线。这是 Marginalia 名字的字面落地，**非装饰、是产品身份**。

### 3.4 封面

- 默认：纯色矩形 + Georgia 斜体单首字母（P / G / R / T 等）。
- 用户导入 EPUB 自带封面：用图片，但仍是纯矩形、无投影、无圆角增强。
- 颜色池：玫瑰、深紫黑、描线、暖驼。第三色（暖驼）只在封面出现，不进 UI 系统。

## 4. 信息架构

### 4.1 顶层导航

底部 Tab Bar，编辑式风格（非彩色 emoji 图标）。

```
─────────────────────────────────
 I. LIBRARY  II. VOICES  III. STATS  IV. SETUP
─────────────────────────────────
```

- 等宽全大写，玫瑰色激活态（文字色 + 上方 2px 短杠）
- 1px 顶边线（与 masthead-rule 一致）
- **阅读页内 Tab Bar 自动隐藏**，保持零 chrome

### 4.2 五个视图

| 视图 | 用途 | 默认入口 |
|---|---|---|
| `Library` (I) | 书架 / 书的元数据 / 进入阅读 | App 启动默认 |
| `Reader` | 阅读 + 选段 + 召唤 AI（详见 §6.1） | 从 Library 点书进入 |
| `Voices` (II) | 角色管理（预设 + 自定义） | Tab |
| `Stats` (III) | 年报 / 卡片导出入口 / 阅读统计 | Tab |
| `Setup` (IV) | API Provider + Key + 主题切换 + 关于 | Tab |

注：`Reader` 不是底部 Tab，是从 Library 进入的子视图。Library 的 entry 点击后整页推入 Reader，从 Reader 返回回 Library。

## 5. 关键交互 — 阅读页

### 5.1 默认阅读

- 整页只有书。**没有**浮动按钮、底部 Tab、顶部工具栏。
- 顶部一行极简 chapter info（章节名 + 进度百分比），底部一行翻页提示，全部 9px 左右极淡。
- 翻页：左右滑（移动端 epubjs 的 paginated 模式）。

### 5.2 长按选段

选段上方冒出黑色气泡（`#2c2820` 深背景 + 奶油色文字），三个动作横向排列：

```
🖍️ │ 📝 │ 问 虚无主义者 →
```

- 第一个：高亮（默认黄色，可切换四色）
- 第二个：写笔记（弹起小输入框，存到该高亮）
- 第三个：召唤 AI（动作主色 = 玫瑰色，文字显示当前选定角色名）

气泡尾巴指向选段。气泡位置自适应（选段在屏幕上半 → 气泡在选段下方；下半 → 上方）。

### 5.3 召唤 AI 后

**侧滑面板规格**：

- 宽度：78%（左侧 22% 留出原文暗化层，能瞥见自己选了哪段）
- 高度：100%
- 滑入动画：从右侧滑入，缓动 200ms
- 圆角：仅左上 + 左下 18px

**面板内部从上到下**：

1. **Header tag**：角色头像 emoji + 角色名（10px 玫瑰色 + 等宽小字）
2. **Quote block**：
   - `ORIGINAL` 7.5px 等宽小标签
   - 选中文本：Georgia 斜体 10px，左侧 2px 玫瑰色竖线
   - `第三章 · 雪 · p.62` 7px 等宽小字
3. **Conversation**：AI 气泡（白底 65%）+ 用户气泡（玫瑰色实底白字）。流式输出时尾部加 `▎` 闪烁光标。无衬线（PingFang）。
4. **Input row**：圆角胶囊输入框 + 玫瑰色圆形发送按钮

**关闭方式**：
- 右滑面板（边缘有一根 3px 玫瑰色细把手 + 脉动 ‹ 提示）
- 点左侧暗化区
- **没有返回按钮**

## 6. 关键交互 — AI 圆桌

### 6.1 触发

- 在 `Voices` Tab 选择"圆桌模式"，勾 2-5 个角色
- 或者在阅读页选段气泡里长按"问 XX"，弹出"+ 加入更多角色"

### 6.2 视觉

跟单聊面板**同一个侧滑面板**，但 conversation 区变为群聊样式：

- Header tag：列出所有参与角色头像 + "圆桌 · 三位"小字
- Quote block：不变
- Conversation：每条 AI 气泡左侧带角色头像 + 角色名（粗体玫瑰色 8.5px）。不同角色之间隔 6px 间距，节奏感像群聊
- 用户气泡仍然右对齐玫瑰底白字

### 6.3 行为

- 用户提一个问题 → 后端按角色顺序流式调用 LLM，**逐个角色出气泡**（不是同时）
- 每个角色独立的 system prompt + 该角色的对话历史子集
- 一轮回答完后用户可以追问，仍然按顺序逐个回复

复杂度评估：UI 层基本就是"在群聊样式里渲染每个角色的气泡"，逻辑层桌面端已经有 `roundtableMessages` 字段和相关代码，主要工作量是手机版排版。

## 7. AI Provider 系统

### 7.1 Provider 列表（按显示顺序）

```
PROVIDER · 选一个
  ▢ Custom (OpenAI-compatible)       主入口 · 默认 · 老练用户首选
  ▢ Claude (Anthropic 官方)            预设 · 付费
  ▢ DeepSeek                          预设 · 中文好
  ▢ Gemini                            预设 · 需梯子
  ▢ 智谱 GLM-4-Flash                   免费 · 五分钟拿 Key →
```

### 7.2 配置字段

| Provider | baseURL | 默认 model | 备注 |
|---|---|---|---|
| Custom | 用户填 | 用户填 | OpenAI 兼容协议 |
| Claude | `https://api.anthropic.com` | `claude-sonnet-4-6` | 走原生 Anthropic API |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` | OpenAI 兼容 |
| Gemini | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.0-flash` | Google 原生 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` | OpenAI 兼容 |

### 7.3 第一次进 App 引导

未配置 Key 时弹引导页：

```
━━━━━━━━━━━━━━━━━━
 选一个 AI 开始读书
━━━━━━━━━━━━━━━━━━

 没有 Key？
 → 五分钟拿到智谱免费 Key

 已经有 Key？
 → 直接配置 Custom / Claude / DeepSeek / Gemini
```

文案保持编辑式语言（衬线 + 等宽混排）。

### 7.4 Key 存储

- 仍存 IndexedDB（沿用桌面端 `getLLMConfig` / `saveLLMConfig`）
- **不**存到 localStorage（避免 XSS 通过 document.cookie 读取的攻击面，IndexedDB 至少需要 origin）
- Settings 显示的 Key 默认 mask 为 `sk-***...***abc`，点击眼睛切换显示

## 8. 数据模型

**结论**：v1 完全沿用桌面端 `src/types/index.ts` 现有模型，除了一个新增字段。

### 8.1 复用（不动）

`Character`、`LLMConfig`、`BookMeta`、`ChapterContext`、`Message`、`OpinionCard`、`Highlight`、`Bookmark`、`PreReadData`、`ReadingSession`、`BookCharacterProfile`、`BookRating`、`CharacterReview`、`BookState` — 全部保留。

### 8.2 新增

`BookState.featuredHighlightId?: string`：在 Library 视图显示的"用户最爱批注"对应的 highlight id。

设置方式：在阅读页或 BookProfile 的 highlights 列表里长按某条高亮 → 弹出菜单 → "设为本书代表批注"。

读取规则：
1. 如果 `featuredHighlightId` 指定且对应的 highlight 仍存在 → 显示该条
2. 否则取最新一条 highlight 作 fallback
3. 该书无任何 highlight → Library 不渲染这一行（entry 高度自动收紧）

### 8.3 IndexedDB

`reading-companion-db` 数据库 + `books` object store 完全沿用。手机浏览器原生支持，不需要迁移。

## 9. 技术架构

### 9.1 保留

- React 19 + TypeScript + Vite
- `src/store/` IndexedDB 层
- `src/services/llm.ts` + `src/services/prompt.ts`
- `src/types/`
- `src/characters/presets.ts`
- `epubjs` 依赖（但需要触屏适配，详见 §11.2）
- `react-markdown`、`html2canvas`、`jszip` 这些跨平台库

### 9.2 移除

- `electron/` 整个目录
- `package.json` 里：`electron`、`electron-builder` 依赖；`electron:preview` / `electron:mac` / `electron:win` / `electron:all` scripts；`build` 字段（mac/win/nsis 配置）
- `package.json` 的 `main` 字段（不再需要 Electron entry）

### 9.3 新增

- `vite-plugin-pwa`：自动生成 manifest.json + service worker，处理离线 shell 缓存
- `public/manifest-icons/`：粉/黑两套图标，192/512px
- `public/manifest.json`：name=Marginalia, theme_color, display=standalone, start_url=/, scope=/
- `react-router` v6：路径 `/` → Library；`/read/:bookId` → Reader；`/voices`、`/stats`、`/setup`。不自己写 router

### 9.4 重构 — App.tsx 拆分

现有 `App.tsx` 1925 行单巨型组件。拆为：

```
src/
├── App.tsx                      // 路由 + 全局 layout shell + 主题 token 注入（< 200 行）
├── views/
│   ├── Library/                 // 书架页（杂志目录主入口）
│   │   ├── Library.tsx
│   │   ├── BookEntry.tsx        // 单条书条目（封面 + 正文 + 折页页码）
│   │   ├── Masthead.tsx
│   │   └── Library.css
│   ├── Reader/                  // 阅读页
│   │   ├── Reader.tsx           // epubjs 容器、翻页、章节
│   │   ├── SelectionBubble.tsx  // 长按弹出气泡
│   │   ├── AIPanel.tsx          // 78% 侧滑面板
│   │   ├── Conversation.tsx     // 单聊 + 圆桌共用
│   │   └── Reader.css
│   ├── Voices/                  // 角色管理（原 CharacterSelect + CharacterCreate 合并）
│   ├── Stats/                   // 年报 + 卡片导出入口
│   └── Setup/                   // API Provider + Key + 主题
├── components/
│   ├── shared/                  // 跨视图复用：TabBar、SectionHeader、Folio
│   └── (legacy 桌面组件保持不动暂不引用，迁移完再删)
├── store/                       // 不动
├── services/                    // 不动
├── types/                       // 加 featuredHighlightId 字段
├── characters/                  // 不动
├── styles/
│   ├── tokens.css               // 设计 token：颜色、字号、间距
│   ├── themes.css               // .theme-day / .theme-night
│   └── reset.css
└── main.tsx
```

桌面端 `src_backup_20260312_211541/` 保持原样作参考，**不删**。

### 9.5 CSS 重写

桌面端 `src/App.css` 1900 多行（含星空粒子、6 主题数据等）**全部归档**，不在新移动端引用。

新建 `src/styles/tokens.css` 用 CSS variables 定义所有设计 token（参考 §3.1 配色表 + §3.2 字体）；`themes.css` 提供 `.theme-day` / `.theme-night` 两个 class，挂在 `<html>` 上自动切换。

### 9.6 不堵死 Capacitor 套壳

- 文件读取走 `<input type="file" accept=".epub">`（Capacitor 兼容）
- 不直接调用 `navigator.fileSystem` 等浏览器独有 API
- 所有 fetch 用配置化 baseURL（已经如此）
- 任何依赖浏览器特性的代码（vibration / wake-lock / share）用 try-catch + feature detection
- 不在 v1 实装 Capacitor，只是写代码时遵循以上规则

### 9.7 部署

- v1：Vercel / Cloudflare Pages / Netlify 任选
- 域名：用户提供一个二级域名（例如 `marginalia.lixinran.dev`）
- HTTPS 强制（PWA 必需）
- iOS 朋友打开 Safari → 加到主屏；Android 朋友 Chrome → 安装

## 10. 触屏交互细节

### 10.1 epubjs 触屏坑

- iOS Safari 选段后系统会弹自带工具条（拷贝 / 查找等），需要监听 `selectionchange` 后**抢在系统工具条之前**渲染我们的气泡
- 长按阈值：500ms（iOS 默认 750ms 略长，缩短到 500ms 体验更脆）
- 翻页手势：epubjs `paginated` 模式 + `swipeLeft` / `swipeRight` 监听，但要避开和文本选段冲突（只在没有 selection 时识别翻页）

### 10.2 AI 面板手势

- 关闭：右滑超过面板宽度 30% 即关闭，否则回弹
- 打开后焦点不自动跳到输入框（避免键盘弹起遮挡内容）
- 输入框聚焦时自动 scroll 对话区到底部

## 11. 风险与权衡

| 风险 | 影响 | 缓解 |
|---|---|---|
| epubjs 在 iOS Safari 触屏选段不稳 | 阅读体验核心受损 | v1 实施前先做 1-2 天触屏 PoC（仅长按选段 + 翻页这两个动作），如果 epubjs 修不动则触发"重新选型"决策点（候选：readium-js / 自研 paginator），不在 v1 默默兜底 |
| iOS PWA 限制（无后台、无推送、Safari only） | 朋友体验受限 | v1 接受；v2 视情况 Capacitor 套壳 |
| AI Key 由用户自填门槛偏高 | 朋友放弃使用 | 引导页强推 GLM 免费 Key（5 分钟） |
| App.tsx 拆分动作大可能引入 bug | 回归风险 | 拆分前 commit 现状；拆分后跑一遍现有 happy path |
| 字体在不同手机上 fallback 不一致 | 视觉 token 失真 | 用 webfont（CDN 加载 EB Garamond / Source Han Serif）作 v2 优化；v1 接受系统 fallback |
| 中文用户对 wordmark `MARGINALIA` 全英陌生 | 品牌识别成本 | App 名仍用英文，加载页 + Tab 仍英；中文留给书名/批注 |

## 12. v2 候选（不在 v1 范围）

- 思维导图（重新设计移动端图形交互）
- Capacitor 出 .apk / TestFlight 内测包 / App Store 上架（视 v1 反响决定）
- 后端代理 + 账号体系（仅在打算上架时引入；v1 仍是用户自带 Key）
- 多设备同步（暂无云端，本地为主）
- iOS 加自定义启动画面（splash）
- 自定义 webfont（衬线品质提升）
- 圆桌"角色之间互相回应"模式（高级，v2）

## 13. 不做的事（v1 明确否决）

- **不**给阅读页加底部 Tab Bar / 顶部工具栏
- **不**用渐变 / 玻璃 / 投影 / blur
- **不**用彩色 emoji 图标
- **不**搭后端服务（v1 不需要任何 server）
- **不**做账号体系
- **不**保留桌面端的 6 主题机制（仅日/夜双主题）
- **不**保留桌面端的星空 / 闪粉粒子动画
