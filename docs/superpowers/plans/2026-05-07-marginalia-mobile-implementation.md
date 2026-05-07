# Marginalia 手机版实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 Electron 桌面版 Marginalia 改造成 PWA-first 手机版，重做编辑式杂志风视觉，保留全部 13 项 v1 功能。

**Architecture:** 复用现有数据层（IndexedDB + localStorage）和 LLM 服务层，砍掉 Electron 壳，重写整个 UI 层为 mobile-first + react-router 五视图架构。App.tsx 1925 行单文件拆为 Library / Reader / Voices / Stats / Setup 五个 view 模块。新增触屏选段 + 78% 侧滑 AI 面板 + 杂志式 Tab Bar。

**Tech Stack:** React 19 + TypeScript + Vite + react-router v6 + vite-plugin-pwa + epubjs（保留，需触屏适配）

**Spec:** [`docs/superpowers/specs/2026-05-06-marginalia-mobile-design.md`](../specs/2026-05-06-marginalia-mobile-design.md)

---

## 实施约束

1. **不删旧代码**：桌面版的 `src/components/`、`src/App.tsx`、`src/App.css` 暂时保留，新代码写到 `src/views/`、`src/styles/` 等新目录。最后一个 milestone 才统一清理。
2. **不删 src_backup_20260312_211541/**：用户已备份，留着。
3. **每个 task 完成后做 git commit**（即使项目目前不是 git repo，第一个 task 就是 git init）。
4. **TDD 仅用于纯逻辑**：组件视觉、动画、触屏交互通过手动 + 浏览器 devtools 验证，不强求单测。纯函数（如 cfi 解析、provider 配置匹配、批注 fallback 逻辑）必须写单测。
5. **每个 milestone 末尾留一个"用户演示点"**：用户应该能在手机/Chrome devtools 模拟器上**打开看到东西**，不是 18 个 task 后才有第一次可见反馈。

## 文件结构（最终态）

```
src/
├── main.tsx                     # 入口（保留，注入主题 class + Router）
├── App.tsx                      # 路由 + Layout shell（< 200 行）
├── views/
│   ├── Library/
│   │   ├── Library.tsx          # 顶层书架页
│   │   ├── Masthead.tsx         # MARGINALIA wordmark + 刊号 + ◆ 横线
│   │   ├── SectionHeader.tsx    # I. IN PROGRESS · FOUR VOLUMES
│   │   ├── BookEntry.tsx        # 三列网格条目（封面/正文/折页页码）
│   │   ├── EmptyLibrary.tsx     # 没有书时的引导
│   │   └── Library.css
│   ├── Reader/
│   │   ├── Reader.tsx           # epubjs 容器、翻页、章节追踪
│   │   ├── ChapterChrome.tsx    # 顶部章节名 + 进度（极淡）
│   │   ├── SelectionBubble.tsx  # 长按选段三动作气泡
│   │   ├── AIPanel.tsx          # 78% 侧滑面板容器
│   │   ├── AIPanelHeader.tsx    # 角色 tag
│   │   ├── QuoteBlock.tsx       # 衬线斜体引用块
│   │   ├── Conversation.tsx     # 单聊 + 圆桌共用消息列表
│   │   ├── ConversationInput.tsx
│   │   └── Reader.css
│   ├── Voices/
│   │   ├── Voices.tsx           # 角色列表（预设 + 自定义）
│   │   ├── CharacterCard.tsx
│   │   ├── CharacterEditor.tsx  # 创建/编辑表单
│   │   └── Voices.css
│   ├── Stats/
│   │   ├── Stats.tsx
│   │   ├── YearReport.tsx
│   │   ├── CardExport.tsx
│   │   └── Stats.css
│   └── Setup/
│       ├── Setup.tsx
│       ├── ProviderPicker.tsx   # 5 provider 预设 + Custom
│       ├── KeyInput.tsx         # mask + 眼睛切换
│       ├── ThemeToggle.tsx      # 日/夜
│       └── Setup.css
├── components/
│   └── shared/
│       ├── TabBar.tsx           # 底部 4 Tab（编辑式）
│       ├── Folio.tsx            # 折页页码（27px 斜体 + 短杠 + PCT）
│       ├── DiamondRule.tsx      # ◆ 横线
│       └── shared.css
├── store/                       # 不动（沿用 IndexedDB + localStorage）
├── services/                    # 不动（llm.ts + prompt.ts）
├── types/
│   └── index.ts                 # 加 featuredHighlightId 字段
├── characters/                  # 不动
├── styles/
│   ├── tokens.css               # CSS variables（颜色/字号/间距/字体）
│   ├── themes.css               # .theme-day / .theme-night
│   ├── reset.css                # mobile-first reset
│   └── fonts.css                # Georgia / Songti / Courier 栈声明
├── lib/
│   ├── providers.ts             # Provider 预设清单 + 配置工厂
│   ├── cfi.ts                   # epubjs cfi range 工具（封装 + 单测）
│   ├── featuredHighlight.ts     # 选取代表批注的 fallback 规则（单测）
│   └── touch.ts                 # 长按 + 滑动手势检测（单测）
└── vite-env.d.ts                # 不动
```

**保留不动**：`src/store/`、`src/services/`、`src/characters/`
**最后清理**：`src/components/{Bookshelf,CardExport,CharacterCreate,CharacterReview,CharacterSelect,Mindmap,Reader,Settings,Sidebar,YearReport,BookProfile}/`、`src/App.tsx`（旧）、`src/App.css`（旧）

---

## Milestones（共 8 个）

| # | 名称 | 用户能看到什么 |
|---|---|---|
| **M1** | PWA 骨架 + 拆 Electron + 设计 token | 浏览器打开看到 MARGINALIA wordmark 静态页 |
| **M2** | Library 视图（杂志目录） | 能在手机上看到一个空书架 + 假数据条目 |
| **M3** | 书架真实数据 + EPUB 导入 + 路由 | 能导入 epub、看到自己的书 |
| **M4** | Reader 视图：epubjs + 触屏翻页 + 章节追踪 | 能在手机上读书 |
| **M5** | 选段气泡 + 高亮 + 笔记 + 书签 | 能长按选段、上色、写笔记、打书签 |
| **M6** | AI 面板（单聊 + 圆桌） + Provider Setup | 能聊 AI 了 |
| **M7** | Voices + Stats + 卡片导出 + 自由笔记 + 观点卡 + 预读 + 书评 | 全部 13 项功能可用 |
| **M8** | 清理旧代码 + 部署 + 朋友试用 | 网址给朋友 |

---

# Milestone 1 · PWA 骨架 + 拆 Electron + 设计 token

**目标**：浏览器能打开看到一个加了 PWA manifest、安装得了主屏的 MARGINALIA wordmark 静态页。Electron 全部移除。所有设计 token 落到 CSS variables。

**用户演示点**：手机 Safari 打开 `npm run dev` 的局域网地址，能看到首页只有居中的 `MARGINALIA` + 刊号 + ◆ 横线，加到主屏后图标对、颜色对。

## Task 1.1: git init + 基线提交

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 初始化 git 仓库**

```bash
cd /Users/lixinran/Desktop/项目代码/AI伴读器
git init
git config user.email "lixinran@example.com"  # 如未配置全局
git config user.name "lixinran"
```

- [ ] **Step 2: 把 .superpowers/ 加到 .gitignore**

读取当前 `.gitignore`，在末尾追加：

```
# Brainstorming session artifacts
.superpowers/

# Project-level dist
dist/
release/
```

- [ ] **Step 3: 基线提交（不动任何代码）**

```bash
git add -A
git commit -m "chore: initial commit (desktop version baseline before mobile rewrite)"
```

预期：一次性提交所有现有文件。从此往后每个 task 单独 commit。

---

## Task 1.2: 移除 Electron

**Files:**
- Delete: `electron/`
- Modify: `package.json`

- [ ] **Step 1: 删除 electron 目录**

```bash
rm -rf electron/
```

- [ ] **Step 2: 修改 package.json，删除 Electron 相关字段**

打开 `package.json`，做以下修改：

1. 删除 `"main": "electron/main.cjs"` 这一行
2. 删除 `scripts` 里的：`electron:preview`、`electron:mac`、`electron:win`、`electron:all`
3. 删除整个 `"build": { ... }` 字段（mac/win/nsis 配置）
4. 在 `devDependencies` 删除 `electron`、`electron-builder`

修改后 `scripts` 应只剩：

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

- [ ] **Step 3: 重装依赖**

```bash
rm -rf node_modules package-lock.json
npm install
```

预期：node_modules 体积比之前小很多（少了 electron 二进制）。

- [ ] **Step 4: 验证 dev server 起得来**

```bash
npm run dev
```

预期：vite 启动，输出类似 `Local: http://localhost:5173/`。Ctrl+C 停。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove electron, switch to pure vite/PWA target"
```

---

## Task 1.3: 安装 PWA + Router 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装运行时依赖**

```bash
npm install react-router-dom@^6
npm install -D vite-plugin-pwa@^0
```

- [ ] **Step 2: 验证 package.json 写入正确**

打开 `package.json`，确认：

- `dependencies` 包含 `react-router-dom`
- `devDependencies` 包含 `vite-plugin-pwa`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-router-dom and vite-plugin-pwa"
```

---

## Task 1.4: 设计 token（CSS variables）

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/themes.css`
- Create: `src/styles/reset.css`
- Create: `src/styles/fonts.css`

- [ ] **Step 1: 写 fonts.css**

```css
/* src/styles/fonts.css */
:root {
  --font-serif: Georgia, "Source Han Serif SC", "Source Han Serif", "Songti SC", serif;
  --font-serif-zh: "Songti SC", "Source Han Serif SC", Georgia, serif;
  --font-mono: 'Courier New', "SF Mono", Menlo, monospace;
  --font-sans: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
}
```

- [ ] **Step 2: 写 tokens.css**

```css
/* src/styles/tokens.css */
:root {
  /* spacing scale */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 22px;
  --sp-6: 32px;

  /* font sizes (mobile-first, base = 14) */
  --fs-micro: 7.5px;
  --fs-small: 9px;
  --fs-meta: 10px;
  --fs-body: 13px;
  --fs-title: 16px;
  --fs-folio: 27px;
  --fs-wordmark: 13px;

  /* letter-spacing */
  --ls-wordmark: 7px;
  --ls-mono: 1.5px;
  --ls-section: 2.2px;

  /* radii */
  --r-sm: 4px;
  --r-md: 8px;
  --r-lg: 18px;

  /* lines */
  --hairline: 1px;
}
```

- [ ] **Step 3: 写 themes.css**

```css
/* src/styles/themes.css */
:root.theme-day {
  --c-bg: #faf0ee;
  --c-text: #2d1620;
  --c-accent: #c87a8e;
  --c-warm: #d4b08c;
  --c-text-soft: rgba(45, 22, 32, 0.55);
  --c-line: rgba(45, 22, 32, 0.18);
  --c-line-dotted: rgba(45, 22, 32, 0.18);
  --c-bubble-ai: rgba(255, 255, 255, 0.65);
  --c-overlay-dim: rgba(0, 0, 0, 0.22);
  --selection-bg: rgba(255, 200, 100, 0.45);
}

:root.theme-night {
  --c-bg: #0c0a10;
  --c-text: #ebd9de;
  --c-accent: #d8889e;
  --c-warm: #b89a78;
  --c-text-soft: rgba(235, 217, 222, 0.5);
  --c-line: rgba(235, 217, 222, 0.18);
  --c-line-dotted: rgba(235, 217, 222, 0.15);
  --c-bubble-ai: rgba(255, 255, 255, 0.06);
  --c-overlay-dim: rgba(0, 0, 0, 0.55);
  --selection-bg: rgba(255, 200, 100, 0.3);
}

html {
  background: var(--c-bg);
  color: var(--c-text);
}
```

- [ ] **Step 4: 写 reset.css**

```css
/* src/styles/reset.css */
* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html, body {
  margin: 0; padding: 0;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior: none;
}

/* prevent iOS auto text-size inflate on rotate */
html { -webkit-text-size-adjust: 100%; }

button {
  background: none; border: none; padding: 0;
  font: inherit; color: inherit; cursor: pointer;
}

ul { list-style: none; padding: 0; margin: 0; }

#root {
  min-height: 100dvh;
  background: var(--c-bg);
  color: var(--c-text);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/styles
git commit -m "feat(styles): add design tokens, themes, reset, fonts"
```

---

## Task 1.5: 重写 main.tsx + index.html + 占位 App

**Files:**
- Modify: `src/main.tsx`
- Modify: `index.html`
- Create: `src/App.tsx.new`（先建新文件，避免冲突）

- [ ] **Step 1: 改 index.html**

替换 `index.html` 全部内容为：

```html
<!doctype html>
<html lang="zh-CN" class="theme-day">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
    <meta name="theme-color" content="#faf0ee" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Marginalia" />
    <title>Marginalia</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: 改 main.tsx**

替换 `src/main.tsx` 全部内容：

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/themes.css'
import './styles/reset.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

- [ ] **Step 3: 暂停旧 App.tsx**

旧 `src/App.tsx` 太大不能直接覆盖。把它**重命名**：

```bash
git mv src/App.tsx src/App.legacy.tsx
git mv src/App.css src/App.legacy.css
```

- [ ] **Step 4: 创建占位 App.tsx**

```tsx
// src/App.tsx
import { Routes, Route } from 'react-router-dom'

function Placeholder() {
  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 22px',
      gap: 8,
    }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 'var(--fs-wordmark)',
        fontWeight: 600,
        letterSpacing: 'var(--ls-wordmark)',
        paddingLeft: 7,
      }}>MARGINALIA</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-micro)',
        letterSpacing: 'var(--ls-mono)',
        opacity: 0.55,
      }}>NO. 001 · IN CONSTRUCTION</div>
      <div style={{
        height: 1,
        width: 80,
        background: 'var(--c-text)',
        margin: '8px 0',
        position: 'relative',
      }}>
        <span style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--c-bg)',
          color: 'var(--c-accent)',
          fontSize: 8,
          padding: '0 6px',
        }}>◆</span>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder />} />
    </Routes>
  )
}
```

- [ ] **Step 5: 启动 dev server 验证**

```bash
npm run dev
```

打开 `http://localhost:5173/`，应该看到居中的 MARGINALIA wordmark + `NO. 001 · IN CONSTRUCTION` + ◆ 横线。背景应是 `#faf0ee` 奶油粉。

如果旧 App.css 的星空粒子还在显示（说明 dist 还在缓存），重启 dev server。

Ctrl+C 停。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(app): replace electron App with router + Marginalia placeholder"
```

---

## Task 1.6: PWA manifest + service worker

**Files:**
- Modify: `vite.config.ts`
- Create: `public/icon.svg`
- Create: `public/icon-192.png`（占位，可以用 imagemagick 从 svg 生成；如无，先用纯色方块）
- Create: `public/icon-512.png`

- [ ] **Step 1: 写一个最简的 SVG 图标**

```svg
<!-- public/icon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#faf0ee"/>
  <text x="256" y="290" text-anchor="middle"
        font-family="Georgia, serif" font-size="80" font-style="italic"
        font-weight="600" fill="#c87a8e">M</text>
  <line x1="160" y1="340" x2="352" y2="340" stroke="#2d1620" stroke-width="2"/>
  <text x="256" y="338" text-anchor="middle"
        font-family="Georgia, serif" font-size="22" fill="#c87a8e"
        style="background:#faf0ee">◆</text>
</svg>
```

- [ ] **Step 2: 生成 PNG 图标占位**

如有 imagemagick：

```bash
cd public
magick -background none -resize 192x192 icon.svg icon-192.png
magick -background none -resize 512x512 icon.svg icon-512.png
```

如没有，临时用纯色方块（任何 192x192 / 512x512 PNG 即可，后续替换）。

- [ ] **Step 3: 改 vite.config.ts**

替换 `vite.config.ts` 全部内容：

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Marginalia',
        short_name: 'Marginalia',
        description: 'A reading companion with AI characters in the margins.',
        theme_color: '#faf0ee',
        background_color: '#faf0ee',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // cache app shell + epubjs assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // dont cache /api/*
        navigateFallback: '/index.html',
      },
    }),
  ],
})
```

- [ ] **Step 4: 验证 build**

```bash
npm run build
```

预期：build 输出 `dist/` + 一个 `dist/sw.js` + `dist/manifest.webmanifest`。

- [ ] **Step 5: 验证 preview 在手机能装到主屏**

```bash
npm run preview
```

笔记：iOS 测试需要 HTTPS，本地测试用：
- 访问 `http://localhost:4173/` 在 Chrome desktop 验证 manifest（DevTools → Application → Manifest）
- 手机 PWA 实测推迟到 M8 部署后

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(pwa): add manifest, service worker, app icons"
```

---

## M1 Checkpoint

**用户演示点**：`npm run dev` 后访问 localhost:5173，看到 MARGINALIA 居中静态页。Chrome DevTools 的 Application → Manifest 显示完整 manifest。

**已完成**：Electron 移除、PWA 骨架、设计 token、占位 App。
**未完成**：所有功能视图。

---

# Milestone 2 · Library 视图（杂志目录）

**目标**：把书架页按设计稿做出来。**用假数据**，不接 IndexedDB（M3 接）。

**用户演示点**：访问首页看到完整的杂志目录页样式：MARGINALIA 刊头、`I. IN PROGRESS` 分节、4 本假书、每本有封面 + 折页页码。点条目进入"假阅读页"提示。

## Task 2.1: 共享组件 — DiamondRule、Folio、TabBar 框架

**Files:**
- Create: `src/components/shared/DiamondRule.tsx`
- Create: `src/components/shared/Folio.tsx`
- Create: `src/components/shared/TabBar.tsx`
- Create: `src/components/shared/shared.css`

- [ ] **Step 1: 写 shared.css**

```css
/* src/components/shared/shared.css */

/* DiamondRule */
.diamond-rule {
  height: var(--hairline);
  background: var(--c-text);
  margin: var(--sp-2) var(--sp-4) 0;
  position: relative;
}
.diamond-rule::after {
  content: "◆";
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: var(--c-bg);
  color: var(--c-accent);
  font-size: 8px;
  padding: 0 var(--sp-2);
}

/* Folio */
.folio {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.folio__num {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--fs-folio);
  color: var(--c-accent);
  line-height: 1;
  letter-spacing: -1px;
}
.folio__mark {
  width: 12px; height: 1px;
  background: var(--c-accent);
  margin: 3px 0 2px;
  opacity: 0.7;
}
.folio__lbl {
  font-family: var(--font-mono);
  font-size: 5.5px;
  letter-spacing: 1.2px;
  opacity: 0.55;
  color: var(--c-text);
}

/* TabBar */
.tab-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 52px;
  padding-bottom: env(safe-area-inset-bottom, 0);
  background: var(--c-bg);
  border-top: var(--hairline) solid var(--c-text);
  display: flex;
  align-items: center;
  z-index: 100;
}
.tab-bar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0 6px;
  font-family: var(--font-mono);
  font-size: var(--fs-small);
  letter-spacing: var(--ls-section);
  opacity: 0.55;
  color: var(--c-text);
  text-decoration: none;
  position: relative;
}
.tab-bar__item--active {
  opacity: 1;
  color: var(--c-accent);
}
.tab-bar__item--active::before {
  content: "";
  position: absolute;
  top: 0; left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background: var(--c-accent);
}
.tab-bar__roman {
  font-family: 'Times New Roman', serif;
  font-weight: 600;
  margin-right: 4px;
}
```

- [ ] **Step 2: 写 DiamondRule.tsx**

```tsx
// src/components/shared/DiamondRule.tsx
export function DiamondRule() {
  return <div className="diamond-rule" aria-hidden />
}
```

- [ ] **Step 3: 写 Folio.tsx**

```tsx
// src/components/shared/Folio.tsx
interface Props {
  value: number
  label?: string
}
export function Folio({ value, label = 'PCT' }: Props) {
  return (
    <div className="folio">
      <div className="folio__num">{value}</div>
      <div className="folio__mark" aria-hidden />
      <div className="folio__lbl">{label}</div>
    </div>
  )
}
```

- [ ] **Step 4: 写 TabBar.tsx**

```tsx
// src/components/shared/TabBar.tsx
import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/',       roman: 'I.',   label: 'LIBRARY' },
  { to: '/voices', roman: 'II.',  label: 'VOICES'  },
  { to: '/stats',  roman: 'III.', label: 'STATS'   },
  { to: '/setup',  roman: 'IV.',  label: 'SETUP'   },
]

export function TabBar() {
  const { pathname } = useLocation()
  // hide on /read/*
  if (pathname.startsWith('/read/')) return null

  return (
    <nav className="tab-bar" role="tablist">
      {TABS.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) =>
            'tab-bar__item' + (isActive ? ' tab-bar__item--active' : '')
          }
        >
          <span><span className="tab-bar__roman">{t.roman}</span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: 在 App.tsx 引入 TabBar 和 css**

修改 `src/App.tsx`：

```tsx
import { Routes, Route } from 'react-router-dom'
import { TabBar } from './components/shared/TabBar'
import './components/shared/shared.css'

function Placeholder({ name }: { name: string }) {
  return (
    <main style={{ padding: 80, textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
        {name} placeholder
      </p>
    </main>
  )
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Placeholder name="Library" />} />
        <Route path="/read/:bookId" element={<Placeholder name="Reader" />} />
        <Route path="/voices" element={<Placeholder name="Voices" />} />
        <Route path="/stats" element={<Placeholder name="Stats" />} />
        <Route path="/setup" element={<Placeholder name="Setup" />} />
      </Routes>
      <TabBar />
    </>
  )
}
```

- [ ] **Step 6: dev 验证**

```bash
npm run dev
```

预期：
- 看到底部 4 个 Tab：`I. LIBRARY · II. VOICES · III. STATS · IV. SETUP`
- 玫瑰色文字 + 上方 2px 短杠表示当前选中
- 点 Tab 切换，激活态变化
- 访问 `/read/test`，TabBar 应该消失

- [ ] **Step 7: Commit**

```bash
git add src/components/shared src/App.tsx
git commit -m "feat(shared): add TabBar, Folio, DiamondRule + 4-route shell"
```

---

## Task 2.2: Library — Masthead + SectionHeader

**Files:**
- Create: `src/views/Library/Masthead.tsx`
- Create: `src/views/Library/SectionHeader.tsx`
- Create: `src/views/Library/Library.css`

- [ ] **Step 1: 写 Library.css 第一段（masthead + section）**

```css
/* src/views/Library/Library.css */

.library {
  min-height: 100dvh;
  padding-bottom: 80px; /* leave space for tab bar */
}

/* Masthead */
.masthead {
  margin-top: 36px;
  padding: 0 var(--sp-4);
  text-align: center;
  position: relative;
}
.masthead__wordmark {
  font-family: var(--font-serif);
  font-size: var(--fs-wordmark);
  font-weight: 600;
  letter-spacing: var(--ls-wordmark);
  color: var(--c-text);
  padding-left: 7px; /* compensate trailing letter-spacing */
}
.masthead__meta {
  margin-top: 4px;
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-mono);
  opacity: 0.55;
  padding: 0 var(--sp-1);
}

/* Section header */
.section-h {
  padding: var(--sp-4) var(--sp-4) var(--sp-2);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.section-h__roman {
  font-family: 'Times New Roman', serif;
  font-weight: 600;
  font-size: 11px;
  color: var(--c-accent);
  margin-right: 6px;
}
.section-h__label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: var(--ls-section);
  color: var(--c-accent);
  font-weight: 600;
}
.section-h__count {
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-mono);
  opacity: 0.6;
  color: var(--c-text);
}
```

- [ ] **Step 2: 写 Masthead.tsx**

```tsx
// src/views/Library/Masthead.tsx
import { DiamondRule } from '../../components/shared/DiamondRule'

interface Props {
  issueNo: number
  date: string  // formatted, e.g. "MAY 7"
}

export function Masthead({ issueNo, date }: Props) {
  const issueStr = `NO. ${String(issueNo).padStart(3, '0')}`
  return (
    <header className="masthead">
      <div className="masthead__wordmark">MARGINALIA</div>
      <div className="masthead__meta">
        <span>{issueStr}</span>
        <span>{date}</span>
      </div>
      <DiamondRule />
    </header>
  )
}
```

- [ ] **Step 3: 写 SectionHeader.tsx**

```tsx
// src/views/Library/SectionHeader.tsx
interface Props {
  roman: string       // "I."
  label: string       // "IN PROGRESS"
  count?: string      // "FOUR VOLUMES"
}

export function SectionHeader({ roman, label, count }: Props) {
  return (
    <div className="section-h">
      <span>
        <span className="section-h__roman">{roman}</span>
        <span className="section-h__label">{label}</span>
      </span>
      {count && <span className="section-h__count">{count}</span>}
    </div>
  )
}
```

- [ ] **Step 4: 写 Library.tsx 骨架**

```tsx
// src/views/Library/Library.tsx
import { Masthead } from './Masthead'
import { SectionHeader } from './SectionHeader'
import './Library.css'

function formatIssueDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

export function Library() {
  const today = new Date()
  // 简化：用 day-of-year 当刊号
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)

  return (
    <main className="library">
      <Masthead issueNo={dayOfYear} date={formatIssueDate(today)} />
      <SectionHeader roman="I." label="IN PROGRESS" count="—" />
    </main>
  )
}
```

- [ ] **Step 5: 在 App.tsx 用真 Library**

```tsx
// 在 App.tsx 顶部
import { Library } from './views/Library/Library'

// 路由改为
<Route path="/" element={<Library />} />
```

- [ ] **Step 6: dev 验证**

`npm run dev`，访问 `/`：

- 顶部居中 `MARGINALIA`（大字间距）
- 下方左右两端 `NO. xxx` / `MAY 7`
- 1px 横线被 ◆ 贯穿
- 下方 `I. IN PROGRESS` / `—`

- [ ] **Step 7: Commit**

```bash
git add src/views/Library/
git commit -m "feat(library): masthead + section header components"
```

---

## Task 2.3: BookEntry 组件 + 假数据

**Files:**
- Create: `src/views/Library/BookEntry.tsx`
- Modify: `src/views/Library/Library.css`
- Modify: `src/views/Library/Library.tsx`

- [ ] **Step 1: 给 Library.css 追加 entry 样式**

```css
/* 追加到 Library.css */

.book-entry {
  display: grid;
  grid-template-columns: 36px 1fr 38px;
  gap: 11px;
  padding: 10px var(--sp-4);
  border-bottom: 1px dotted var(--c-line-dotted);
  align-items: stretch;
  text-decoration: none;
  color: inherit;
}
.book-entry:last-child { border-bottom: none; }

.book-entry__cover {
  width: 36px; height: 50px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 19px;
  align-self: start;
  margin-top: 1px;
}
/* color variants — used cyclically for fallback covers */
.book-entry__cover--c1 { background: var(--c-accent); color: var(--c-bg); }
.book-entry__cover--c2 { background: var(--c-text); color: var(--c-bg); }
.book-entry__cover--c3 {
  background: var(--c-bg); color: var(--c-accent);
  border: 1px solid var(--c-text);
}
.book-entry__cover--c4 { background: var(--c-warm); color: var(--c-text); }

.book-entry__cover-img {
  width: 36px; height: 50px;
  object-fit: cover;
  align-self: start;
  margin-top: 1px;
}

.book-entry__body {
  display: flex; flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}
.book-entry__title {
  font-family: var(--font-serif-zh);
  font-size: 12.5px;
  color: var(--c-text);
  letter-spacing: 0.4px;
  line-height: 1.2;
}
.book-entry__author {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--fs-small);
  opacity: 0.55;
  margin-top: 2px;
}
.book-entry__meta {
  font-family: var(--font-mono);
  font-size: 6.8px;
  letter-spacing: 0.6px;
  margin-top: 5px;
  color: var(--c-accent);
  opacity: 0.85;
}
.book-entry__meta-em {
  color: var(--c-text);
  opacity: 0.4;
  margin: 0 4px;
}
.book-entry__marginalia {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 8.5px;
  color: var(--c-text);
  opacity: 0.55;
  line-height: 1.3;
  padding-left: 8px;
  border-left: 1px solid var(--c-accent);
  /* truncate to 2 lines */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-entry__folio {
  align-self: center;
}
```

- [ ] **Step 2: 写 BookEntry.tsx**

```tsx
// src/views/Library/BookEntry.tsx
import { Link } from 'react-router-dom'
import { Folio } from '../../components/shared/Folio'

export interface BookEntryData {
  id: string
  title: string
  author: string
  cover?: string         // base64 image, or undefined → fallback letter cover
  letter: string         // first letter for fallback cover (P / G / etc.)
  coverVariant: 1 | 2 | 3 | 4
  metaParts: string[]    // e.g. ['§ VOL III', '38 NOTES', '2D']
  progressPct: number    // 0-100
  marginalia?: string    // featured highlight excerpt (italic line)
}

export function BookEntry({ data }: { data: BookEntryData }) {
  const { id, title, author, cover, letter, coverVariant, metaParts, progressPct, marginalia } = data
  return (
    <Link to={`/read/${id}`} className="book-entry">
      {cover ? (
        <img src={cover} alt={title} className="book-entry__cover-img" />
      ) : (
        <div className={`book-entry__cover book-entry__cover--c${coverVariant}`}>
          {letter}
        </div>
      )}
      <div className="book-entry__body">
        <div className="book-entry__title">{title}</div>
        <div className="book-entry__author">{author}</div>
        {metaParts.length > 0 && (
          <div className="book-entry__meta">
            {metaParts.map((p, i) => (
              <span key={i}>
                {i > 0 && <span className="book-entry__meta-em">—</span>}
                {p}
              </span>
            ))}
          </div>
        )}
        {marginalia && (
          <div className="book-entry__marginalia">"{marginalia}"</div>
        )}
      </div>
      <div className="book-entry__folio">
        <Folio value={progressPct} />
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Library.tsx 加假数据**

```tsx
// src/views/Library/Library.tsx
import { Masthead } from './Masthead'
import { SectionHeader } from './SectionHeader'
import { BookEntry, type BookEntryData } from './BookEntry'
import './Library.css'

const MOCK: BookEntryData[] = [
  {
    id: 'mock-1',
    title: '追忆似水年华',
    author: 'Marcel Proust',
    letter: 'P',
    coverVariant: 1,
    metaParts: ['§ VOL III', '38 NOTES', '2D'],
    progressPct: 62,
    marginalia: '过去是藏起来的，藏在它看似不在的地方。',
  },
  {
    id: 'mock-2',
    title: '百年孤独',
    author: 'Gabriel García Márquez',
    letter: 'G',
    coverVariant: 2,
    metaParts: ['§ CAP. IV', '12 NOTES', '5D'],
    progressPct: 28,
  },
  {
    id: 'mock-3',
    title: '夜雨与玫瑰',
    author: 'Rainer Maria Rilke',
    letter: 'R',
    coverVariant: 3,
    metaParts: ['JUST OPENED', 'TODAY'],
    progressPct: 8,
  },
  {
    id: 'mock-4',
    title: '瓦尔登湖',
    author: 'Henry David Thoreau',
    letter: 'T',
    coverVariant: 4,
    metaParts: ['FINAL CH.', '4 NOTES TODAY'],
    progressPct: 95,
  },
]

function formatIssueDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

export function Library() {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)

  return (
    <main className="library">
      <Masthead issueNo={dayOfYear} date={formatIssueDate(today)} />
      <SectionHeader roman="I." label="IN PROGRESS" count="FOUR VOLUMES" />
      <ul>
        {MOCK.map(b => (
          <li key={b.id}>
            <BookEntry data={b} />
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 4: dev 验证 + 手机模拟器**

`npm run dev`。Chrome DevTools 切换到 iPhone 12 Pro 视图：

- 看到 4 个书条目，每个都是封面 + 标题 + 作者 + 元信息行 + 折页页码
- 第一本书有斜体批注引文
- 点条目跳到 `/read/mock-1`（看到 Reader placeholder）
- 切到夜间主题：浏览器 Console 跑 `document.documentElement.classList.replace('theme-day','theme-night')`，整页应变黑色 + 柔粉

- [ ] **Step 5: Commit**

```bash
git add src/views/Library
git commit -m "feat(library): book entry component with mock data"
```

---

## M2 Checkpoint

**用户演示点**：手机模拟器打开看到完整杂志目录页 + 4 本假书 + 底部 Tab。日夜主题切换通过 console 验证可用。

---

# Milestone 3 · 真实数据 + EPUB 导入

**目标**：Library 接 IndexedDB；空书架显示导入引导；导入 epub 后显示真书。

**用户演示点**：清空数据后看到引导，点导入选 .epub 文件，文件出现在书架，封面正确显示。

## Task 3.1: 加 featuredHighlightId 字段

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/featuredHighlight.ts`
- Create: `src/lib/featuredHighlight.test.ts`

- [ ] **Step 1: 改 types/index.ts**

在 `BookState` interface 内（约 line 137 附近），增加字段：

```typescript
export interface BookState {
  meta: BookMeta
  currentLocation: string
  currentChapter: number
  characterId: string
  readingMode: ReadingMode
  messages: Message[]
  roundtableMessages?: Message[]
  opinionCards: OpinionCard[]
  chapterSummaries: Record<number, string>
  tag?: BookTag
  highlights?: Highlight[]
  bookmarks?: Bookmark[]
  preReadData?: PreReadData[]
  sessions?: ReadingSession[]
  summary?: string
  bookCharacters?: BookCharacterProfile[]
  rating?: BookRating
  bookSummary?: string
  freeNote?: string
  roundtableCharacterIds?: string[]
  isRoundtableMode?: boolean
  characterReviews?: Record<string, CharacterReview>
  // NEW:
  featuredHighlightId?: string
}
```

- [ ] **Step 2: 写 featuredHighlight.ts**

```ts
// src/lib/featuredHighlight.ts
import type { Highlight } from '../types'

/**
 * 选取一本书的"代表批注"。
 * 规则：
 *  1. 若 featuredHighlightId 指定且对应 highlight 仍存在 → 用它
 *  2. 否则取最新一条 highlight（timestamp 最大）
 *  3. 没有任何 highlight → undefined（UI 不渲染那一行）
 */
export function pickFeaturedHighlight(
  highlights: Highlight[] | undefined,
  featuredId: string | undefined,
): Highlight | undefined {
  if (!highlights || highlights.length === 0) return undefined
  if (featuredId) {
    const found = highlights.find(h => h.id === featuredId)
    if (found) return found
  }
  return [...highlights].sort((a, b) => b.timestamp - a.timestamp)[0]
}
```

- [ ] **Step 3: 写测试**

```ts
// src/lib/featuredHighlight.test.ts
import { describe, it, expect } from 'vitest'
import { pickFeaturedHighlight } from './featuredHighlight'
import type { Highlight } from '../types'

const h1: Highlight = { id: 'h1', cfiRange: '', text: 'first', note: '', color: 'yellow', timestamp: 100 }
const h2: Highlight = { id: 'h2', cfiRange: '', text: 'second', note: '', color: 'yellow', timestamp: 200 }
const h3: Highlight = { id: 'h3', cfiRange: '', text: 'third', note: '', color: 'yellow', timestamp: 150 }

describe('pickFeaturedHighlight', () => {
  it('returns undefined when no highlights', () => {
    expect(pickFeaturedHighlight([], undefined)).toBeUndefined()
    expect(pickFeaturedHighlight(undefined, 'x')).toBeUndefined()
  })

  it('returns the featured one if it exists', () => {
    expect(pickFeaturedHighlight([h1, h2], 'h1')).toBe(h1)
  })

  it('falls back to latest when featured id is missing', () => {
    expect(pickFeaturedHighlight([h1, h2, h3], 'gone')?.id).toBe('h2')
  })

  it('falls back to latest when no featured set', () => {
    expect(pickFeaturedHighlight([h1, h2, h3], undefined)?.id).toBe('h2')
  })
})
```

- [ ] **Step 4: 安装 vitest 并跑测试**

```bash
npm install -D vitest
```

在 `package.json` 的 `scripts` 加：

```json
"test": "vitest run",
"test:watch": "vitest"
```

```bash
npm run test
```

预期：4 个测试 passed。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(types): add featuredHighlightId + pickFeaturedHighlight util"
```

---

## Task 3.2: 把 Library 接到 IndexedDB

**Files:**
- Modify: `src/views/Library/Library.tsx`
- Create: `src/views/Library/EmptyLibrary.tsx`
- Modify: `src/views/Library/Library.css`

- [ ] **Step 1: 加 EmptyLibrary 样式到 Library.css**

```css
/* 追加 */
.empty-library {
  margin-top: 64px;
  padding: 0 var(--sp-5);
  text-align: center;
}
.empty-library__quote {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  opacity: 0.65;
  line-height: 1.6;
  margin-bottom: 24px;
}
.empty-library__cite {
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-mono);
  opacity: 0.5;
  margin-bottom: 32px;
}
.empty-library__import {
  display: inline-block;
  padding: 12px 24px;
  border: 1px solid var(--c-text);
  font-family: var(--font-mono);
  font-size: var(--fs-small);
  letter-spacing: var(--ls-section);
  color: var(--c-text);
  cursor: pointer;
  background: var(--c-bg);
}
.empty-library__import:active {
  background: var(--c-text);
  color: var(--c-bg);
}
.empty-library__hidden-input {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
}
```

- [ ] **Step 2: 写 EmptyLibrary.tsx**

```tsx
// src/views/Library/EmptyLibrary.tsx
import { useRef } from 'react'

interface Props {
  onFile: (file: File) => void
}

export function EmptyLibrary({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="empty-library">
      <div className="empty-library__quote">
        "A reader lives a thousand lives before he dies.<br />
         The man who never reads lives only one."
      </div>
      <div className="empty-library__cite">— GEORGE R.R. MARTIN</div>
      <button
        className="empty-library__import"
        onClick={() => inputRef.current?.click()}
      >
        IMPORT EPUB →
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".epub,application/epub+zip"
        className="empty-library__hidden-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: 改 Library.tsx 接 IndexedDB**

完整替换 `src/views/Library/Library.tsx`：

```tsx
import { useEffect, useState, useCallback } from 'react'
import { Masthead } from './Masthead'
import { SectionHeader } from './SectionHeader'
import { BookEntry, type BookEntryData } from './BookEntry'
import { EmptyLibrary } from './EmptyLibrary'
import {
  getAllBooks,
  saveBook,
  extractCoverFromEpub,
  type StoredBook,
} from '../../store'
import { pickFeaturedHighlight } from '../../lib/featuredHighlight'
import './Library.css'

function formatIssueDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function bookToEntry(book: StoredBook, idx: number): BookEntryData {
  const state = book.bookState
  const featured = pickFeaturedHighlight(state.highlights, state.featuredHighlightId)
  // crude progress: parse cfi or fallback
  const progressPct = computeProgress(state.currentLocation)
  const noteCount = state.highlights?.length ?? 0
  const daysAgo = Math.max(0, Math.floor((Date.now() - book.lastOpened) / 86400000))

  const metaParts: string[] = []
  if (state.currentChapter > 0) metaParts.push(`§ CH. ${state.currentChapter}`)
  if (noteCount > 0) metaParts.push(`${noteCount} NOTES`)
  metaParts.push(daysAgo === 0 ? 'TODAY' : `${daysAgo}D`)

  // first non-whitespace letter from title (Latin) or fallback first char
  const titleTrim = book.title.trim()
  const firstLatin = titleTrim.match(/[A-Za-z]/)?.[0]
  const letter = (firstLatin ?? titleTrim.charAt(0) ?? '·').toUpperCase()

  return {
    id: book.id,
    title: book.title,
    author: book.author || '—',
    cover: book.cover || undefined,
    letter,
    coverVariant: ((idx % 4) + 1) as 1 | 2 | 3 | 4,
    metaParts,
    progressPct,
    marginalia: featured?.text ? truncateText(featured.text, 60) : undefined,
  }
}

function truncateText(s: string, max: number) {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

function computeProgress(cfi: string): number {
  // placeholder: epubjs cfi doesn't carry % cleanly without book ref
  // we'll improve this in Reader (M4) by saving progress alongside cfi
  if (!cfi) return 0
  // very rough: count cfi step components as a stand-in
  const steps = cfi.match(/\//g)?.length ?? 0
  return Math.min(99, steps * 4)
}

export function Library() {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)

  const [books, setBooks] = useState<StoredBook[] | null>(null)

  const load = useCallback(async () => {
    const all = await getAllBooks()
    setBooks(all)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleFile = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer()
    const cover = await extractCoverFromEpub(buf)

    // very basic title/author extraction — will be improved with epubjs metadata
    const meta = await readEpubMeta(buf)

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const stored: StoredBook = {
      id,
      title: meta.title || file.name.replace(/\.epub$/i, ''),
      author: meta.author || '',
      cover,
      epubData: buf,
      bookState: {
        meta: { title: meta.title, author: meta.author, totalChapters: 0 },
        currentLocation: '',
        currentChapter: 0,
        characterId: '',
        readingMode: 'thinking',
        messages: [],
        opinionCards: [],
        chapterSummaries: {},
      },
      lastOpened: Date.now(),
    }
    await saveBook(stored)
    await load()
  }, [load])

  if (books === null) return null  // loading flash avoid

  return (
    <main className="library">
      <Masthead issueNo={dayOfYear} date={formatIssueDate(today)} />
      {books.length === 0 ? (
        <EmptyLibrary onFile={handleFile} />
      ) : (
        <>
          <SectionHeader
            roman="I."
            label="IN PROGRESS"
            count={`${formatVolumes(books.length)}`}
          />
          <ul>
            {books.map((b, i) => (
              <li key={b.id}>
                <BookEntry data={bookToEntry(b, i)} />
              </li>
            ))}
          </ul>
          <ImportFooter onFile={handleFile} />
        </>
      )}
    </main>
  )
}

function formatVolumes(n: number): string {
  const words = ['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN']
  if (n <= 10) return `${words[n]} ${n === 1 ? 'VOLUME' : 'VOLUMES'}`
  return `${n} VOLUMES`
}

async function readEpubMeta(buf: ArrayBuffer): Promise<{ title: string; author: string }> {
  const ePubModule = await import('epubjs')
  const ePub = ePubModule.default
  const book = ePub(buf.slice(0) as unknown as string)
  await book.ready
  const meta = await book.loaded.metadata
  book.destroy()
  return {
    title: (meta as { title?: string }).title || '',
    author: (meta as { creator?: string }).creator || '',
  }
}

function ImportFooter({ onFile }: { onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div style={{
      padding: 'var(--sp-5) var(--sp-4) 100px',
      textAlign: 'center',
    }}>
      <button
        className="empty-library__import"
        onClick={() => ref.current?.click()}
      >
        + IMPORT EPUB
      </button>
      <input
        ref={ref}
        type="file"
        accept=".epub,application/epub+zip"
        className="empty-library__hidden-input"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
```

⚠️ 注意：上面 `ImportFooter` 用了 `useRef`，需要在文件顶部 import：

```tsx
import { useEffect, useState, useCallback, useRef } from 'react'
```

- [ ] **Step 4: dev 验证空状态**

`npm run dev`，第一次访问应看到引导（如果 IndexedDB 已有数据，先在 DevTools → Application → IndexedDB → reading-companion-db 删除 books store 全部记录，刷新）。

- [ ] **Step 5: dev 验证导入**

点 `IMPORT EPUB →`，选一个 .epub 文件。导入后应跳转到正常书架视图，看到这本书的条目。封面如果 epub 自带应直接显示。

- [ ] **Step 6: Commit**

```bash
git add src/views/Library
git commit -m "feat(library): IndexedDB-backed entries + EPUB import"
```

---

## M3 Checkpoint

**用户演示点**：能导入 epub 文件，书架显示真实数据。点条目跳到 Reader placeholder（暂未实装阅读功能）。

---

# Milestone 4 · Reader 视图：epubjs + 触屏

**目标**：能在手机上读 epub。翻页、章节标题更新、进度记录。**没有选段交互**（M5 加）。

**用户演示点**：从书架点一本书，进入 Reader，左右滑翻页，顶部章节信息更新，回到 Library 进度被记住。

## Task 4.1: Reader 骨架 + epubjs 渲染

**Files:**
- Create: `src/views/Reader/Reader.tsx`
- Create: `src/views/Reader/ChapterChrome.tsx`
- Create: `src/views/Reader/Reader.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写 Reader.css**

```css
/* src/views/Reader/Reader.css */
.reader {
  position: fixed;
  inset: 0;
  background: var(--c-bg);
  color: var(--c-text);
  display: flex;
  flex-direction: column;
}
.reader__chrome {
  height: 32px;
  padding: 0 var(--sp-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: var(--fs-small);
  letter-spacing: var(--ls-mono);
  opacity: 0.5;
  padding-top: env(safe-area-inset-top, 0);
  height: calc(32px + env(safe-area-inset-top, 0));
}
.reader__back {
  font-family: var(--font-mono);
  letter-spacing: var(--ls-mono);
  opacity: 0.6;
}
.reader__viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
}
/* epubjs injects iframes here */

.reader__progress {
  height: 1px;
  background: var(--c-line);
  margin: 0 var(--sp-4);
  position: relative;
}
.reader__progress-fill {
  position: absolute;
  left: 0; top: 0;
  height: 100%;
  background: var(--c-accent);
  opacity: 0.6;
  transition: width 200ms;
}
.reader__foot {
  height: 22px;
  padding: 0 var(--sp-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-mono);
  opacity: 0.4;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
```

- [ ] **Step 2: 写 ChapterChrome.tsx**

```tsx
// src/views/Reader/ChapterChrome.tsx
import { Link } from 'react-router-dom'

interface Props {
  chapterTitle: string
  progressPct: number
}

export function ChapterChrome({ chapterTitle, progressPct }: Props) {
  return (
    <header className="reader__chrome">
      <Link to="/" className="reader__back">← LIBRARY</Link>
      <span>{chapterTitle}</span>
      <span>{progressPct}%</span>
    </header>
  )
}
```

- [ ] **Step 3: 写 Reader.tsx**

```tsx
// src/views/Reader/Reader.tsx
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ePub, { type Rendition, type Book } from 'epubjs'
import { ChapterChrome } from './ChapterChrome'
import { getBook, updateBookLocation } from '../../store'
import './Reader.css'

export function Reader() {
  const { bookId } = useParams<{ bookId: string }>()
  const nav = useNavigate()
  const viewportRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const bookRef = useRef<Book | null>(null)

  const [chapterTitle, setChapterTitle] = useState('')
  const [progressPct, setProgressPct] = useState(0)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    ;(async () => {
      const stored = await getBook(bookId)
      if (!stored || !viewportRef.current || cancelled) {
        nav('/')
        return
      }

      const book = ePub(stored.epubData.slice(0) as unknown as string)
      bookRef.current = book
      await book.ready

      const rendition = book.renderTo(viewportRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
        manager: 'default',
      })
      renditionRef.current = rendition

      // theme: inherit current page background
      rendition.themes.default({
        body: {
          'font-family': 'var(--font-serif), Georgia, serif',
          'font-size': '17px',
          'line-height': '1.7',
          'color': 'var(--c-text)',
          'background': 'var(--c-bg)',
        },
        '::selection': { 'background': 'var(--selection-bg)' },
      })

      const startCfi = stored.bookState.currentLocation || undefined
      await rendition.display(startCfi)

      // chapter title tracking
      rendition.on('relocated', async (location: { start: { cfi: string; href: string; percentage?: number } }) => {
        const cfi = location.start.cfi
        const href = location.start.href
        const pct = Math.round((location.start.percentage ?? 0) * 100)
        setProgressPct(pct)

        // resolve chapter title from spine
        const nav = await book.loaded.navigation
        const item = (nav as { toc: Array<{ href: string; label: string }> }).toc.find(
          t => t.href.split('#')[0] === href.split('#')[0]
        )
        if (item) setChapterTitle(item.label.trim())

        // persist location
        if (cfi) updateBookLocation(bookId, cfi).catch(() => {})
      })

      // touch swipe — left/right page turn (avoid when text is selected)
      let touchStartX = 0
      let touchStartY = 0
      const onTouchStart = (e: TouchEvent) => {
        if (window.getSelection()?.toString()) return
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
      }
      const onTouchEnd = (e: TouchEvent) => {
        if (window.getSelection()?.toString()) return
        const dx = e.changedTouches[0].clientX - touchStartX
        const dy = Math.abs(e.changedTouches[0].clientY - touchStartY)
        if (dy > 30) return  // mostly vertical → ignore
        if (dx < -40) rendition.next()
        else if (dx > 40) rendition.prev()
      }
      const vp = viewportRef.current
      vp.addEventListener('touchstart', onTouchStart, { passive: true })
      vp.addEventListener('touchend', onTouchEnd, { passive: true })

      // cleanup
      return () => {
        vp.removeEventListener('touchstart', onTouchStart)
        vp.removeEventListener('touchend', onTouchEnd)
      }
    })().catch((err) => {
      console.error('reader init failed', err)
      nav('/')
    })

    return () => {
      cancelled = true
      renditionRef.current?.destroy()
      bookRef.current?.destroy()
    }
  }, [bookId, nav])

  return (
    <div className="reader">
      <ChapterChrome chapterTitle={chapterTitle} progressPct={progressPct} />
      <div ref={viewportRef} className="reader__viewport" />
      <div className="reader__progress">
        <div className="reader__progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="reader__foot">
        <span>← TAP LEFT</span>
        <span>SWIPE TO TURN</span>
        <span>TAP RIGHT →</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 在 App.tsx 引入 Reader**

```tsx
import { Reader } from './views/Reader/Reader'
// 替换路由
<Route path="/read/:bookId" element={<Reader />} />
```

- [ ] **Step 5: dev 验证翻页**

`npm run dev`，从 Library 点一本书，应该看到：

- 顶部章节名 + 百分比
- 中间显示书的内容
- 左右滑动可翻页
- 顶部 `← LIBRARY` 点击返回书架

如果在 iOS Safari 真机测试，可能遇到 epubjs 与 Safari 选段冲突（这是 M5 要解决的，M4 先确认翻页正常）。

- [ ] **Step 6: 验证进度持久化**

读到中间某页，按 `← LIBRARY` 返回。再次进入同一本书，应该停在原位置。

- [ ] **Step 7: Commit**

```bash
git add src/views/Reader src/App.tsx
git commit -m "feat(reader): epubjs paginated render + touch swipe + persistence"
```

---

## M4 Checkpoint

**用户演示点**：能读 epub，翻页流畅，回到书架后位置记得住。

---

# Milestone 5 · 选段气泡 + 高亮 + 笔记 + 书签

**目标**：长按选段冒出三动作气泡；上色 / 写笔记 / 召唤 AI（AI 暂只占位，M6 接入）。打书签 + 列表跳转。

**用户演示点**：长按文字 → 出气泡 → 选高亮颜色 → 选段被涂色 → 列表里能看到这条高亮 → 跳回。

## Task 5.1: cfi 工具 + 触屏长按检测

**Files:**
- Create: `src/lib/cfi.ts`
- Create: `src/lib/touch.ts`
- Create: `src/lib/touch.test.ts`

- [ ] **Step 1: 写 touch.ts**

```ts
// src/lib/touch.ts
/**
 * Long-press detector. Calls onLongPress after `delay` ms unless
 * the finger moves > moveTolerance px or lifts.
 */
export interface LongPressHandlers {
  onTouchStart: (e: TouchEvent) => void
  onTouchMove: (e: TouchEvent) => void
  onTouchEnd: () => void
  cancel: () => void
}

export function makeLongPressDetector(
  onLongPress: (x: number, y: number) => void,
  delay = 500,
  moveTolerance = 8,
): LongPressHandlers {
  let timer: number | null = null
  let startX = 0, startY = 0

  return {
    onTouchStart(e) {
      if (e.touches.length !== 1) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      timer = window.setTimeout(() => onLongPress(startX, startY), delay)
    },
    onTouchMove(e) {
      if (timer === null) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (Math.hypot(dx, dy) > moveTolerance) {
        clearTimeout(timer)
        timer = null
      }
    },
    onTouchEnd() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
```

- [ ] **Step 2: 写 touch.test.ts**

```ts
// src/lib/touch.test.ts
import { describe, it, expect, vi } from 'vitest'
import { makeLongPressDetector } from './touch'

function makeTouchEvent(x: number, y: number): TouchEvent {
  return {
    touches: [{ clientX: x, clientY: y }],
  } as unknown as TouchEvent
}

describe('makeLongPressDetector', () => {
  it('fires after delay', async () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    const d = makeLongPressDetector(cb, 100)
    d.onTouchStart(makeTouchEvent(10, 10))
    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledWith(10, 10)
    vi.useRealTimers()
  })

  it('cancels on move beyond tolerance', () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    const d = makeLongPressDetector(cb, 100, 5)
    d.onTouchStart(makeTouchEvent(10, 10))
    d.onTouchMove(makeTouchEvent(20, 20))  // moved > 5px
    vi.advanceTimersByTime(200)
    expect(cb).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('cancels on touch end before delay', () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    const d = makeLongPressDetector(cb, 100)
    d.onTouchStart(makeTouchEvent(10, 10))
    d.onTouchEnd()
    vi.advanceTimersByTime(200)
    expect(cb).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 3: 写 cfi.ts（薄封装）**

```ts
// src/lib/cfi.ts
import type { Rendition, Contents } from 'epubjs'

/**
 * Listens for selection events inside epubjs iframe and returns
 * (cfiRange, text) when user finishes selecting.
 */
export function onSelection(
  rendition: Rendition,
  cb: (cfiRange: string, text: string) => void,
): () => void {
  const handler = (cfiRange: string, contents: Contents) => {
    const sel = (contents as { window?: { getSelection?: () => Selection | null } }).window?.getSelection?.()
    const text = sel?.toString().trim() ?? ''
    if (text && cfiRange) cb(cfiRange, text)
  }
  rendition.on('selected', handler)
  return () => {
    rendition.off('selected', handler as never)
  }
}
```

- [ ] **Step 4: 跑测试**

```bash
npm run test
```

预期：4 + 3 = 7 passed。

- [ ] **Step 5: Commit**

```bash
git add src/lib
git commit -m "feat(lib): long-press detector + cfi selection wrapper"
```

---

## Task 5.2: SelectionBubble 组件

**Files:**
- Create: `src/views/Reader/SelectionBubble.tsx`
- Modify: `src/views/Reader/Reader.css`

- [ ] **Step 1: 加 css**

```css
/* 追加到 Reader.css */
.sel-bubble {
  position: absolute;
  background: #2c2820;
  color: #f5f0e8;
  padding: 8px 12px;
  border-radius: 16px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  display: flex;
  gap: 10px;
  align-items: center;
  white-space: nowrap;
  z-index: 50;
  /* arrow */
}
.sel-bubble::after {
  content: "";
  position: absolute;
  bottom: -5px; left: 32px;
  width: 9px; height: 9px;
  background: #2c2820;
  transform: rotate(45deg);
}
.sel-bubble--below::after {
  bottom: auto;
  top: -5px;
}
.sel-bubble__btn {
  font-size: 14px;
  opacity: 0.6;
  background: none; border: none;
  color: inherit; padding: 0; cursor: pointer;
}
.sel-bubble__btn--primary {
  opacity: 1;
  color: #ffd07a;
  font-weight: 600;
  font-size: 12px;
}
.sel-bubble__divider {
  width: 1px; height: 14px;
  background: rgba(255,255,255,0.2);
}
```

- [ ] **Step 2: 写 SelectionBubble.tsx**

```tsx
// src/views/Reader/SelectionBubble.tsx
interface Props {
  x: number          // viewport coords
  y: number
  characterName: string
  onHighlight: () => void
  onNote: () => void
  onAskAI: () => void
}

export function SelectionBubble({ x, y, characterName, onHighlight, onNote, onAskAI }: Props) {
  // place above the touch point by default; if not enough room, below
  const bubbleH = 36
  const above = y > bubbleH + 20
  const top = above ? y - bubbleH - 12 : y + 16

  return (
    <div
      className={'sel-bubble' + (above ? '' : ' sel-bubble--below')}
      style={{ left: Math.max(12, x - 60), top }}
      role="toolbar"
    >
      <button className="sel-bubble__btn" aria-label="highlight" onClick={onHighlight}>🖍️</button>
      <span className="sel-bubble__divider" />
      <button className="sel-bubble__btn" aria-label="note" onClick={onNote}>📝</button>
      <span className="sel-bubble__divider" />
      <button className="sel-bubble__btn sel-bubble__btn--primary" onClick={onAskAI}>
        问 {characterName} →
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 在 Reader.tsx 接入**

修改 `src/views/Reader/Reader.tsx`，在 `useEffect` 里订阅 `selected` 事件，并 render bubble。完整改动：

在文件顶部 import：

```tsx
import { SelectionBubble } from './SelectionBubble'
import { onSelection } from '../../lib/cfi'
```

在组件内增加 state：

```tsx
const [selection, setSelection] = useState<{
  cfiRange: string
  text: string
  x: number
  y: number
} | null>(null)
```

在 `rendition.display(...)` 之后加：

```tsx
const off = onSelection(rendition, (cfiRange, text) => {
  // get screen position from current selection rect
  const iframe = viewportRef.current?.querySelector('iframe')
  const win = iframe?.contentWindow
  if (!win) return
  const r = win.getSelection()?.getRangeAt(0).getBoundingClientRect()
  if (!r) return
  // adjust by viewport offset (chrome height)
  const vpRect = viewportRef.current!.getBoundingClientRect()
  const x = vpRect.left + r.left + r.width / 2
  const y = vpRect.top + r.top
  setSelection({ cfiRange, text, x, y })
})
```

cleanup 函数追加 `off()`。

在 `<div ref={viewportRef} className="reader__viewport" />` 后面加：

```tsx
{selection && (
  <SelectionBubble
    x={selection.x}
    y={selection.y}
    characterName="虚无主义者"
    onHighlight={() => {
      console.log('highlight', selection.cfiRange, selection.text)
      setSelection(null)
    }}
    onNote={() => {
      console.log('note', selection.cfiRange)
      setSelection(null)
    }}
    onAskAI={() => {
      console.log('ask AI', selection.text)
      setSelection(null)
    }}
  />
)}
```

外层让 `.reader` 成为 positioning context（已经是了，因为 `position: fixed`）。

- [ ] **Step 4: dev 验证**

`npm run dev`，进入 Reader。在 Chrome devtools 切到手机模拟器，长按文字（trackpad 双击+按住或鼠标按住不动）选中一段文字 → 应该看到黑色三动作气泡。

- [ ] **Step 5: Commit**

```bash
git add src/views/Reader
git commit -m "feat(reader): selection bubble (highlight/note/ask AI)"
```

---

## Task 5.3: 高亮持久化 + 渲染回 epubjs

**Files:**
- Create: `src/lib/highlights.ts`
- Modify: `src/views/Reader/Reader.tsx`
- Modify: `src/store/index.ts`

- [ ] **Step 1: 加 store helper**

在 `src/store/index.ts` 末尾加：

```ts
// ===== Highlights / Bookmarks (sync helpers, IndexedDB-backed) =====
import { getBook, saveBook } from './db'
import type { Highlight, Bookmark } from '../types'

export async function addHighlight(bookId: string, h: Highlight) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.highlights = [...(book.bookState.highlights ?? []), h]
  book.lastOpened = Date.now()
  await saveBook(book)
}

export async function deleteHighlight(bookId: string, highlightId: string) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.highlights = (book.bookState.highlights ?? []).filter(h => h.id !== highlightId)
  await saveBook(book)
}

export async function updateHighlightNote(bookId: string, highlightId: string, note: string) {
  const book = await getBook(bookId)
  if (!book) return
  const h = book.bookState.highlights?.find(x => x.id === highlightId)
  if (!h) return
  h.note = note
  await saveBook(book)
}

export async function addBookmark(bookId: string, bm: Bookmark) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.bookmarks = [...(book.bookState.bookmarks ?? []), bm]
  book.lastOpened = Date.now()
  await saveBook(book)
}

export async function deleteBookmark(bookId: string, bookmarkId: string) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.bookmarks = (book.bookState.bookmarks ?? []).filter(b => b.id !== bookmarkId)
  await saveBook(book)
}
```

⚠️ 注意：`store/index.ts` 顶部已经从 `./db` re-export 了，但我们这里用作内部调用，需要直接 import。如果 `getBook`/`saveBook` 已被 re-export，不要重复 import 同名变量。改用：

```ts
import { getBook as _getBookDb, saveBook as _saveBookDb } from './db'
```

并在上面函数里相应改名。或者**更简单**：把这些函数加到 `src/store/db.ts` 末尾，跟现有 `extractCoverFromEpub` 同级。推荐这条路：

打开 `src/store/db.ts`，在文件末尾加：

```ts
// ===== Highlights / Bookmarks =====
export async function addHighlight(bookId: string, h: import('../types').Highlight) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.highlights = [...(book.bookState.highlights ?? []), h]
  book.lastOpened = Date.now()
  await saveBook(book)
}
export async function deleteHighlight(bookId: string, highlightId: string) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.highlights = (book.bookState.highlights ?? []).filter(h => h.id !== highlightId)
  await saveBook(book)
}
export async function updateHighlightNote(bookId: string, highlightId: string, note: string) {
  const book = await getBook(bookId)
  if (!book) return
  const h = book.bookState.highlights?.find(x => x.id === highlightId)
  if (!h) return
  h.note = note
  await saveBook(book)
}
export async function addBookmark(bookId: string, bm: import('../types').Bookmark) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.bookmarks = [...(book.bookState.bookmarks ?? []), bm]
  book.lastOpened = Date.now()
  await saveBook(book)
}
export async function deleteBookmark(bookId: string, bookmarkId: string) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.bookmarks = (book.bookState.bookmarks ?? []).filter(b => b.id !== bookmarkId)
  await saveBook(book)
}
export async function setFeaturedHighlight(bookId: string, highlightId: string | undefined) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.featuredHighlightId = highlightId
  await saveBook(book)
}
```

更新 `src/store/index.ts` 的 re-export：

```ts
export {
  getAllBooks,
  getBook,
  saveBook,
  deleteBook,
  updateBookState,
  updateBookLocation,
  extractCoverFromEpub,
  addHighlight,
  deleteHighlight,
  updateHighlightNote,
  addBookmark,
  deleteBookmark,
  setFeaturedHighlight,
} from './db'
```

- [ ] **Step 2: 在 Reader 里实装高亮**

修改 `Reader.tsx`：

把 `onHighlight` 的 handler 替换为：

```tsx
onHighlight={async () => {
  if (!bookId) return
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const highlight = {
    id,
    cfiRange: selection.cfiRange,
    text: selection.text,
    note: '',
    color: 'yellow',
    chapterIndex: 0,  // TODO: derive from current location
    timestamp: Date.now(),
  }
  await addHighlight(bookId, highlight)
  // visually mark
  renditionRef.current?.annotations.add(
    'highlight',
    selection.cfiRange,
    {},
    () => {},
    'sel-hl-' + id,
    { fill: 'rgba(255, 200, 100, 0.45)', 'fill-opacity': '0.5' },
  )
  setSelection(null)
}}
```

在文件顶部加 import：

```tsx
import { addHighlight } from '../../store'
```

加载已有高亮 — 在 `rendition.display(...)` 之后加：

```tsx
const allHl = stored.bookState.highlights ?? []
for (const h of allHl) {
  rendition.annotations.add(
    'highlight',
    h.cfiRange,
    {},
    () => {},
    'sel-hl-' + h.id,
    { fill: 'rgba(255, 200, 100, 0.45)', 'fill-opacity': '0.5' },
  )
}
```

- [ ] **Step 3: dev 验证**

进入 Reader，长按选中一段，点 🖍️ 高亮按钮。文字应被涂黄。返回 Library 再进入：高亮还在。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(reader): persist highlights via IndexedDB + restore on open"
```

---

## Task 5.4: 笔记 modal + 书签 + 列表抽屉

**Files:**
- Create: `src/views/Reader/NoteModal.tsx`
- Create: `src/views/Reader/AnnotationsDrawer.tsx`
- Modify: `src/views/Reader/Reader.tsx`
- Modify: `src/views/Reader/Reader.css`

> **任务展开较长**，下面给出关键骨架。

- [ ] **Step 1: NoteModal — 简易底部 sheet 输入框**

```tsx
// src/views/Reader/NoteModal.tsx
import { useState } from 'react'

interface Props {
  initialText: string
  onSave: (note: string) => void
  onCancel: () => void
}

export function NoteModal({ initialText, onSave, onCancel }: Props) {
  const [v, setV] = useState(initialText)
  return (
    <div className="note-modal-backdrop" onClick={onCancel}>
      <div className="note-modal" onClick={e => e.stopPropagation()}>
        <div className="note-modal__label">NOTE</div>
        <textarea
          className="note-modal__area"
          value={v}
          onChange={e => setV(e.target.value)}
          autoFocus
          rows={4}
        />
        <div className="note-modal__row">
          <button onClick={onCancel}>CANCEL</button>
          <button onClick={() => onSave(v)} className="primary">SAVE</button>
        </div>
      </div>
    </div>
  )
}
```

加 css：

```css
/* 追加到 Reader.css */
.note-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 200;
  display: flex; align-items: flex-end;
}
.note-modal {
  width: 100%;
  background: var(--c-bg);
  padding: 20px 18px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0));
  border-radius: 18px 18px 0 0;
  border-top: 1px solid var(--c-text);
}
.note-modal__label {
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-mono);
  opacity: 0.6;
  margin-bottom: 8px;
}
.note-modal__area {
  width: 100%;
  border: 1px solid var(--c-line);
  background: transparent;
  font-family: var(--font-serif);
  font-size: 14px;
  padding: 10px;
  color: var(--c-text);
  resize: vertical;
}
.note-modal__row {
  display: flex; justify-content: flex-end; gap: 12px;
  margin-top: 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: var(--ls-section);
}
.note-modal__row button.primary { color: var(--c-accent); font-weight: 600; }
```

- [ ] **Step 2: AnnotationsDrawer — 高亮和书签列表**

```tsx
// src/views/Reader/AnnotationsDrawer.tsx
import type { Highlight, Bookmark } from '../../types'

interface Props {
  highlights: Highlight[]
  bookmarks: Bookmark[]
  onJump: (cfi: string) => void
  onClose: () => void
}

export function AnnotationsDrawer({ highlights, bookmarks, onJump, onClose }: Props) {
  return (
    <div className="annot-drawer-backdrop" onClick={onClose}>
      <aside className="annot-drawer" onClick={e => e.stopPropagation()}>
        <div className="annot-drawer__head">
          <span>I. HIGHLIGHTS</span><span>{highlights.length}</span>
        </div>
        {highlights.map(h => (
          <button
            key={h.id}
            className="annot-drawer__item"
            onClick={() => { onJump(h.cfiRange); onClose() }}
          >
            <div className="annot-drawer__quote">"{h.text}"</div>
            {h.note && <div className="annot-drawer__note">— {h.note}</div>}
          </button>
        ))}
        <div className="annot-drawer__head">
          <span>II. BOOKMARKS</span><span>{bookmarks.length}</span>
        </div>
        {bookmarks.map(b => (
          <button
            key={b.id}
            className="annot-drawer__item"
            onClick={() => { onJump(b.cfi); onClose() }}
          >
            <div className="annot-drawer__bookmark">{b.label || '(unnamed)'}</div>
          </button>
        ))}
      </aside>
    </div>
  )
}
```

样式（追加 Reader.css）：

```css
.annot-drawer-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 150;
}
.annot-drawer {
  position: absolute;
  top: 0; bottom: 0; right: 0;
  width: 78%;
  background: var(--c-bg);
  padding: 32px 16px 16px;
  padding-top: calc(32px + env(safe-area-inset-top, 0));
  overflow-y: auto;
  border-radius: 18px 0 0 18px;
}
.annot-drawer__head {
  display: flex; justify-content: space-between;
  font-family: var(--font-mono);
  font-size: var(--fs-small);
  letter-spacing: var(--ls-section);
  color: var(--c-accent);
  font-weight: 600;
  padding: 12px 4px 6px;
  border-bottom: 1px dotted var(--c-line-dotted);
}
.annot-drawer__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 4px;
  border-bottom: 1px dotted var(--c-line-dotted);
  background: none; border-left: 0; border-right: 0; border-top: 0;
  cursor: pointer;
}
.annot-drawer__quote {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--c-text);
  line-height: 1.45;
}
.annot-drawer__note {
  font-family: var(--font-sans);
  font-size: 11px;
  opacity: 0.6;
  margin-top: 4px;
}
.annot-drawer__bookmark {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 1px;
}
```

- [ ] **Step 3: Reader.tsx 接入 NoteModal 和 Drawer**

在 Reader 顶栏添加打开 drawer 的入口（一个小图标在 chrome 右侧）。简化：在 chrome 加 `☰` 按钮。

`ChapterChrome.tsx` 改为：

```tsx
import { Link } from 'react-router-dom'

interface Props {
  chapterTitle: string
  progressPct: number
  onOpenDrawer: () => void
  onAddBookmark: () => void
}

export function ChapterChrome({ chapterTitle, progressPct, onOpenDrawer, onAddBookmark }: Props) {
  return (
    <header className="reader__chrome">
      <Link to="/" className="reader__back">← LIBRARY</Link>
      <span className="reader__chrome-title">{chapterTitle} · {progressPct}%</span>
      <span className="reader__chrome-actions">
        <button onClick={onAddBookmark} aria-label="bookmark" className="reader__icon-btn">＋</button>
        <button onClick={onOpenDrawer} aria-label="annotations" className="reader__icon-btn">≡</button>
      </span>
    </header>
  )
}
```

样式追加：

```css
.reader__icon-btn {
  background: none; border: none;
  font-size: 18px; padding: 4px 8px;
  color: var(--c-text);
  opacity: 0.6;
  cursor: pointer;
}
.reader__chrome-title {
  flex: 1;
  text-align: center;
}
.reader__chrome-actions { display: flex; gap: 4px; }
```

在 Reader.tsx 加 state 和 handler：

```tsx
const [noteFor, setNoteFor] = useState<{ cfiRange: string; text: string } | null>(null)
const [drawerOpen, setDrawerOpen] = useState(false)
const [highlights, setHighlights] = useState<Highlight[]>([])
const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

// 在 stored 加载完成后：
setHighlights(stored.bookState.highlights ?? [])
setBookmarks(stored.bookState.bookmarks ?? [])
```

把 `onNote` handler 改为：

```tsx
onNote={() => {
  setNoteFor({ cfiRange: selection.cfiRange, text: selection.text })
  setSelection(null)
}}
```

ChapterChrome 的两个 handler：

```tsx
onAddBookmark={async () => {
  if (!bookId || !renditionRef.current) return
  const loc = renditionRef.current.currentLocation()
  const cfi = (loc as { start?: { cfi: string } }).start?.cfi
  if (!cfi) return
  const bm: Bookmark = {
    id: Date.now().toString(36),
    cfi,
    label: chapterTitle || 'Bookmark',
    chapterIndex: 0,
    timestamp: Date.now(),
  }
  await addBookmark(bookId, bm)
  setBookmarks(prev => [...prev, bm])
}}
onOpenDrawer={() => setDrawerOpen(true)}
```

加渲染：

```tsx
{noteFor && (
  <NoteModal
    initialText=""
    onCancel={() => setNoteFor(null)}
    onSave={async (note) => {
      if (!bookId) return
      // create highlight + note in one go
      const id = Date.now().toString(36)
      const h: Highlight = {
        id,
        cfiRange: noteFor.cfiRange,
        text: noteFor.text,
        note,
        color: 'yellow',
        timestamp: Date.now(),
      }
      await addHighlight(bookId, h)
      setHighlights(prev => [...prev, h])
      renditionRef.current?.annotations.add(
        'highlight', noteFor.cfiRange, {}, () => {}, 'sel-hl-' + id,
        { fill: 'rgba(255, 200, 100, 0.45)' }
      )
      setNoteFor(null)
    }}
  />
)}

{drawerOpen && (
  <AnnotationsDrawer
    highlights={highlights}
    bookmarks={bookmarks}
    onClose={() => setDrawerOpen(false)}
    onJump={(cfi) => renditionRef.current?.display(cfi)}
  />
)}
```

import 补齐：

```tsx
import { NoteModal } from './NoteModal'
import { AnnotationsDrawer } from './AnnotationsDrawer'
import { addBookmark, addHighlight } from '../../store'
import type { Highlight, Bookmark } from '../../types'
```

- [ ] **Step 4: dev 验证**

测试以下流程：
1. 进入 Reader，长按选段 → 点 📝 → 弹笔记输入 → 写一句保存
2. 选段 → 点 🖍️ → 高亮纯色（无笔记）
3. 顶部 ＋ 按钮 → 添加书签
4. 顶部 ≡ → 打开抽屉，看到高亮+书签 → 点条目跳转

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(reader): notes + bookmarks + annotations drawer"
```

---

## M5 Checkpoint

**用户演示点**：能在阅读时上色、写笔记、打书签，所有数据持久化。

---

# Milestone 6 · AI 面板（单聊 + 圆桌） + Provider Setup

**目标**：召唤 AI 出 78% 侧滑面板，支持单聊和圆桌；Setup 页能配置 5 种 Provider 之一。

**用户演示点**：在 Setup 填上 Key（GLM 免费），返回 Reader 选段问 AI，看到流式回复。切到圆桌选 2 个角色，重新问，两个角色逐个出气泡。

> 此 milestone 较大，分 4 个 task。

## Task 6.1: Provider 系统

**Files:**
- Create: `src/lib/providers.ts`
- Create: `src/lib/providers.test.ts`
- Modify: `src/services/llm.ts`（仅检查是否需要）

- [ ] **Step 1: 写 providers.ts**

```ts
// src/lib/providers.ts
import type { LLMProvider } from '../types'

export interface ProviderPreset {
  id: 'custom' | 'claude' | 'deepseek' | 'gemini' | 'glm'
  label: string
  hint: string
  provider: LLMProvider
  baseUrl?: string
  defaultModel: string
  signupUrl?: string
  isFree?: boolean
  isFeatured?: boolean
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    hint: 'Bring your own endpoint and key',
    provider: 'custom',
    defaultModel: 'gpt-4o-mini',
    isFeatured: true,
  },
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    hint: 'claude-sonnet-4-6',
    provider: 'claude',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    signupUrl: 'https://console.anthropic.com',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    hint: 'Strong on Chinese · cheap',
    provider: 'custom',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    signupUrl: 'https://platform.deepseek.com',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    hint: 'Free tier · needs VPN in CN',
    provider: 'gemini',
    defaultModel: 'gemini-2.0-flash',
    signupUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'glm',
    label: '智谱 GLM-4-Flash',
    hint: 'Free · 5 min to get a key',
    provider: 'custom',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    signupUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    isFree: true,
  },
]

export function findPreset(id: ProviderPreset['id']): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find(p => p.id === id)
}
```

- [ ] **Step 2: providers.test.ts**

```ts
// src/lib/providers.test.ts
import { describe, it, expect } from 'vitest'
import { PROVIDER_PRESETS, findPreset } from './providers'

describe('providers', () => {
  it('lists 5 presets', () => {
    expect(PROVIDER_PRESETS).toHaveLength(5)
  })
  it('custom is featured and first', () => {
    expect(PROVIDER_PRESETS[0].id).toBe('custom')
    expect(PROVIDER_PRESETS[0].isFeatured).toBe(true)
  })
  it('GLM is marked free', () => {
    expect(findPreset('glm')?.isFree).toBe(true)
  })
  it('claude has baseUrl set', () => {
    expect(findPreset('claude')?.baseUrl).toBe('https://api.anthropic.com')
  })
})
```

- [ ] **Step 3: 跑测试**

```bash
npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/providers.ts src/lib/providers.test.ts
git commit -m "feat(lib): provider presets (custom/claude/deepseek/gemini/glm)"
```

---

## Task 6.2: Setup 视图

**Files:**
- Create: `src/views/Setup/Setup.tsx`
- Create: `src/views/Setup/ProviderPicker.tsx`
- Create: `src/views/Setup/KeyInput.tsx`
- Create: `src/views/Setup/ThemeToggle.tsx`
- Create: `src/views/Setup/Setup.css`
- Modify: `src/App.tsx`

写法跟前面 view 类似——masthead 风格 + section header + 表单。详细骨架略，关键点：

- [ ] **Step 1: ProviderPicker**

5 个预设按钮列表。点选时把 `LLMConfig` 写入 localStorage（用现有 `saveLLMConfig`）。Custom 选项展开两个输入框（baseUrl + model）。

- [ ] **Step 2: KeyInput**

带 mask（默认显示 `sk-***...***abc`），点眼睛切换明文。保存到同一 LLMConfig。

- [ ] **Step 3: ThemeToggle**

简单两个按钮 `DAY` / `NIGHT`，写 `<html>` 的 class，并保存到 localStorage `marginalia-theme`。

- [ ] **Step 4: Setup.tsx 组合**

```tsx
export function Setup() {
  return (
    <main className="library">  {/* 复用 library padding-bottom */}
      <Masthead issueNo={...} date={...} />
      <SectionHeader roman="IV." label="SETUP" />
      <ProviderPicker />
      <SectionHeader roman="—" label="DISPLAY" />
      <ThemeToggle />
    </main>
  )
}
```

- [ ] **Step 5: 在 main.tsx 启动时读 theme**

```ts
// 在 createRoot 之前
const t = localStorage.getItem('marginalia-theme') ?? 'day'
document.documentElement.classList.add(`theme-${t}`)
```

- [ ] **Step 6: dev 验证**

进入 Setup，选 GLM，贴 Key（先输任意字符串），保存。Console 检查 localStorage `reading-companion-llm-config` 已写入。切日夜主题，整页变色。

- [ ] **Step 7: Commit**

```bash
git add src/views/Setup src/App.tsx src/main.tsx
git commit -m "feat(setup): provider picker + key input + theme toggle"
```

---

## Task 6.3: AI 面板（单聊）

**Files:**
- Create: `src/views/Reader/AIPanel.tsx`
- Create: `src/views/Reader/QuoteBlock.tsx`
- Create: `src/views/Reader/Conversation.tsx`
- Create: `src/views/Reader/ConversationInput.tsx`
- Modify: `src/views/Reader/Reader.tsx`
- Modify: `src/views/Reader/Reader.css`

接通流程：选段 → 点"问 XX →" → 打开 AIPanel → 调用 `chatCompletion`（src/services/llm.ts，已存在）→ 流式渲染气泡。

> 任务展开较长，关键骨架：

- [ ] **Step 1: 加 css**

```css
/* 追加 Reader.css */
.ai-panel-backdrop {
  position: fixed; inset: 0;
  background: var(--c-overlay-dim);
  z-index: 100;
}
.ai-panel {
  position: absolute;
  top: 0; bottom: 0; right: 0;
  width: 78%;
  background: var(--c-bg);
  border-radius: 18px 0 0 18px;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.ai-panel::before {
  content: "";
  position: absolute; left: 4px; top: 50%;
  transform: translateY(-50%);
  width: 3px; height: 32px;
  background: var(--c-accent); opacity: 0.4;
  border-radius: 2px;
}
.ai-panel__head {
  margin-top: env(safe-area-inset-top, 0);
  padding: 16px 14px 8px;
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-mono);
  font-size: var(--fs-small);
  letter-spacing: var(--ls-mono);
  color: var(--c-accent);
  font-weight: 600;
  border-bottom: 1px dotted var(--c-line-dotted);
}
.ai-panel__head-av {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--c-accent);
  color: var(--c-bg);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  font-style: normal;
}
.quote-block {
  padding: 12px 14px 10px;
  border-bottom: 1px dotted var(--c-line-dotted);
}
.quote-block__label {
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-mono);
  opacity: 0.5;
  margin-bottom: 4px;
}
.quote-block__body {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  line-height: 1.5;
  border-left: 2px solid var(--c-accent);
  padding-left: 9px;
  color: var(--c-text);
}
.conversation {
  flex: 1; overflow-y: auto;
  padding: 12px 12px 8px;
  font-family: var(--font-sans);
  display: flex; flex-direction: column;
  gap: 6px;
}
.conv-bub {
  padding: 8px 11px;
  border-radius: 14px;
  line-height: 1.55;
  font-size: 13px;
  max-width: 88%;
  background: var(--c-bubble-ai);
  color: var(--c-text);
  align-self: flex-start;
}
.conv-bub--user {
  background: var(--c-accent);
  color: var(--c-bg);
  align-self: flex-end;
}
.conv-bub--char-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--c-accent);
  margin-bottom: 3px;
  font-family: var(--font-mono);
  letter-spacing: 1px;
}
.conv-bub--streaming::after {
  content: "▎"; opacity: 0.6; margin-left: 1px;
  animation: blink 1s infinite;
}
@keyframes blink { 50% { opacity: 0; } }

.conv-input {
  padding: 8px 12px 12px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0));
  border-top: 1px dotted var(--c-line-dotted);
  display: flex; gap: 8px; align-items: center;
}
.conv-input__pill {
  flex: 1;
  padding: 8px 12px;
  border-radius: 16px;
  border: 1px solid var(--c-line);
  background: transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--c-text);
}
.conv-input__send {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--c-accent);
  color: var(--c-bg);
  font-size: 16px;
  display: flex; align-items: center; justify-content: center;
}
```

- [ ] **Step 2: QuoteBlock.tsx**

```tsx
interface Props {
  text: string
  cite?: string
}
export function QuoteBlock({ text, cite }: Props) {
  return (
    <div className="quote-block">
      <div className="quote-block__label">ORIGINAL</div>
      <div className="quote-block__body">{text}</div>
      {cite && <div className="quote-block__label" style={{ marginTop: 4 }}>{cite}</div>}
    </div>
  )
}
```

- [ ] **Step 3: Conversation.tsx + ConversationInput.tsx**

```tsx
// Conversation.tsx
import type { Message } from '../../types'

interface Props {
  messages: Message[]
  streamingId: string | null
  showCharacterName: boolean
  characters: Record<string, { name: string }>  // for roundtable
}

export function Conversation({ messages, streamingId, showCharacterName, characters }: Props) {
  return (
    <div className="conversation">
      {messages.map(m => {
        const isUser = m.role === 'user'
        const charName = m.characterId ? characters[m.characterId]?.name : undefined
        return (
          <div
            key={m.id}
            className={
              'conv-bub' +
              (isUser ? ' conv-bub--user' : '') +
              (m.id === streamingId ? ' conv-bub--streaming' : '')
            }
          >
            {showCharacterName && !isUser && charName && (
              <div className="conv-bub--char-name">{charName}</div>
            )}
            {m.content}
          </div>
        )
      })}
    </div>
  )
}

// ConversationInput.tsx
import { useState } from 'react'
interface Props { onSend: (text: string) => void; disabled: boolean }
export function ConversationInput({ onSend, disabled }: Props) {
  const [v, setV] = useState('')
  return (
    <form
      className="conv-input"
      onSubmit={e => { e.preventDefault(); if (v.trim()) { onSend(v.trim()); setV('') } }}
    >
      <input
        className="conv-input__pill"
        value={v}
        onChange={e => setV(e.target.value)}
        placeholder="写点什么..."
        disabled={disabled}
      />
      <button type="submit" className="conv-input__send" disabled={disabled || !v.trim()}>↑</button>
    </form>
  )
}
```

- [ ] **Step 4: AIPanel.tsx**

```tsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { QuoteBlock } from './QuoteBlock'
import { Conversation } from './Conversation'
import { ConversationInput } from './ConversationInput'
import { chatCompletion } from '../../services/llm'
import { getLLMConfig } from '../../store'
import { findPreset } from '../../lib/providers'
import type { Character, Message } from '../../types'

interface Props {
  selectedText: string
  cite: string
  characters: Character[]   // 1 = single, 2+ = roundtable
  onClose: () => void
}

export function AIPanel({ selectedText, cite, characters, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const isRoundtable = characters.length > 1

  const send = useCallback(async (userText: string) => {
    const config = getLLMConfig()
    if (!config) {
      alert('Please configure an AI provider in Setup first.')
      return
    }
    const userMsg: Message = {
      id: Date.now().toString(36),
      role: 'user',
      content: userText,
      selectedText,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])

    // sequential per-character (single OR roundtable)
    for (const char of characters) {
      const aiId = Date.now().toString(36) + '-' + char.id
      setStreamingId(aiId)
      const aiMsg: Message = {
        id: aiId,
        role: 'character',
        characterId: char.id,
        content: '',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, aiMsg])

      const sysPrompt = char.systemPrompt + `\n\n用户选段：${selectedText}`
      const history = messages
        .filter(m => !m.characterId || m.characterId === char.id)
        .map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content,
        }))

      let acc = ''
      try {
        await chatCompletion(
          config,
          [
            { role: 'system', content: sysPrompt },
            ...history,
            { role: 'user', content: userText },
          ],
          (chunk) => {
            acc += chunk
            setMessages(prev => prev.map(m =>
              m.id === aiId ? { ...m, content: acc } : m
            ))
          },
        )
      } catch (e) {
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, content: `[error: ${(e as Error).message}]` } : m
        ))
      }
      setStreamingId(null)
    }
  }, [characters, messages, selectedText])

  useEffect(() => {
    // first call: ask AI to react to the quote
    if (messages.length === 0 && characters.length > 0) {
      send('请你就这段话给出第一反应。')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // touch swipe to close
  const startX = useRef(0)
  return (
    <div className="ai-panel-backdrop" onClick={onClose}>
      <aside
        className="ai-panel"
        onClick={e => e.stopPropagation()}
        onTouchStart={e => { startX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - startX.current
          if (dx > 80) onClose()
        }}
      >
        <div className="ai-panel__head">
          {characters.length === 1 ? (
            <>
              <span className="ai-panel__head-av">{characters[0].avatar}</span>
              <span>{characters[0].name}</span>
            </>
          ) : (
            <>
              <span>圆桌</span>
              <span style={{ marginLeft: 'auto' }}>{characters.length} 位</span>
            </>
          )}
        </div>
        <QuoteBlock text={selectedText} cite={cite} />
        <Conversation
          messages={messages}
          streamingId={streamingId}
          showCharacterName={isRoundtable}
          characters={Object.fromEntries(characters.map(c => [c.id, { name: c.name }]))}
        />
        <ConversationInput onSend={send} disabled={!!streamingId} />
      </aside>
    </div>
  )
}
```

- [ ] **Step 5: 在 Reader.tsx 接入**

state：

```tsx
const [aiContext, setAiContext] = useState<{
  text: string
  cite: string
  characters: Character[]
} | null>(null)
const [activeChar, setActiveChar] = useState<Character>(PRESET_CHARACTERS[0])
```

`onAskAI` 修改：

```tsx
onAskAI={() => {
  setAiContext({
    text: selection.text,
    cite: chapterTitle,
    characters: [activeChar],
  })
  setSelection(null)
}}
```

加渲染：

```tsx
{aiContext && (
  <AIPanel
    selectedText={aiContext.text}
    cite={aiContext.cite}
    characters={aiContext.characters}
    onClose={() => setAiContext(null)}
  />
)}
```

import：

```tsx
import { AIPanel } from './AIPanel'
import { PRESET_CHARACTERS } from '../../characters/presets'
import type { Character } from '../../types'
```

- [ ] **Step 6: dev 验证单聊**

在 Setup 配好 GLM Key（免费），返回 Reader → 选段 → "问 XX" → 应该看到面板滑入，AI 流式回复。右滑面板能关闭。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(reader): AI panel with single-character chat (streaming)"
```

---

## Task 6.4: 圆桌（多角色） + 角色选择器

**Files:**
- Modify: `src/views/Reader/AIPanel.tsx`（已支持多角色）
- Modify: `src/views/Reader/SelectionBubble.tsx`（加"+ 加入更多"按钮）

> AIPanel 在 Task 6.3 已经写成支持多角色（for loop 顺序流式调用），现在加一个角色多选 UI。

- [ ] **Step 1: 加 CharacterMultiPicker.tsx**

```tsx
// src/views/Reader/CharacterMultiPicker.tsx
import { useState } from 'react'
import type { Character } from '../../types'

interface Props {
  available: Character[]
  initiallySelected: Character[]
  onConfirm: (chars: Character[]) => void
  onCancel: () => void
}

export function CharacterMultiPicker({ available, initiallySelected, onConfirm, onCancel }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initiallySelected.map(c => c.id))
  )

  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  return (
    <div className="note-modal-backdrop" onClick={onCancel}>
      <div className="note-modal" onClick={e => e.stopPropagation()}>
        <div className="note-modal__label">CHOOSE VOICES · {selectedIds.size} SELECTED</div>
        <ul style={{ maxHeight: 300, overflowY: 'auto' }}>
          {available.map(c => (
            <li key={c.id}>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 4px', width: '100%', textAlign: 'left',
                  borderBottom: '1px dotted var(--c-line-dotted)',
                  background: selectedIds.has(c.id) ? 'var(--c-bubble-ai)' : 'none',
                }}
                onClick={() => toggle(c.id)}
              >
                <span style={{ fontSize: 18 }}>{c.avatar}</span>
                <span style={{ fontFamily: 'var(--font-serif)' }}>{c.name}</span>
                <span style={{ marginLeft: 'auto', opacity: selectedIds.has(c.id) ? 1 : 0 }}>✓</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="note-modal__row">
          <button onClick={onCancel}>CANCEL</button>
          <button
            className="primary"
            onClick={() => onConfirm(available.filter(c => selectedIds.has(c.id)))}
          >
            START · {selectedIds.size}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: SelectionBubble 加"圆桌"次级按钮**

加一个不显眼的三点 `⋯` 在主按钮右侧：

```tsx
// 改 SelectionBubble props
interface Props {
  ...
  onRoundtable: () => void
}

// 渲染加：
<button className="sel-bubble__btn" onClick={onRoundtable}>⋯</button>
```

- [ ] **Step 3: Reader.tsx 加 picker state**

```tsx
const [pickerOpen, setPickerOpen] = useState<{
  text: string; cite: string
} | null>(null)

// onRoundtable handler
onRoundtable={() => {
  setPickerOpen({ text: selection.text, cite: chapterTitle })
  setSelection(null)
}}
```

渲染：

```tsx
{pickerOpen && (
  <CharacterMultiPicker
    available={[...PRESET_CHARACTERS, ...customChars]}
    initiallySelected={[activeChar]}
    onCancel={() => setPickerOpen(null)}
    onConfirm={(chars) => {
      setAiContext({ text: pickerOpen.text, cite: pickerOpen.cite, characters: chars })
      setPickerOpen(null)
    }}
  />
)}
```

state 加自定义角色加载：

```tsx
const [customChars, setCustomChars] = useState<Character[]>([])
useEffect(() => { setCustomChars(getCustomCharacters()) }, [])
```

import：

```tsx
import { CharacterMultiPicker } from './CharacterMultiPicker'
import { getCustomCharacters } from '../../store'
```

- [ ] **Step 4: dev 验证圆桌**

选段 → 点 ⋯ → 多选 2-3 个角色 → 确认 → 看到圆桌面板，每个角色的回复带角色名前缀，依次出现。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(reader): roundtable mode with multi-character picker"
```

---

## M6 Checkpoint

**用户演示点**：能配置 AI Key，选段 → 单聊 / 圆桌都流畅，气泡流式输出。

---

# Milestone 7 · Voices + Stats + 卡片导出 + 自由笔记 + 观点卡 + 预读 + 书评

**目标**：完成剩余 7 个零碎功能。多数复用桌面端组件代码，只是搬过来 + 改样式。

> 这个 milestone 比较琐碎，不写完整 step。每个子任务一个 commit。

## Task 7.1: Voices 视图（角色列表 + 自定义）

复用现有 `src/components/CharacterSelect/CharacterSelect.tsx` 和 `CharacterCreate/CharacterCreate.tsx` 的核心逻辑（state 管理 + storage），重写 UI 为杂志条目列表。

- [ ] 写 `src/views/Voices/Voices.tsx`：分两节 `I. PRESETS` 和 `II. CUSTOM`，预设角色一行一个，自定义角色尾部一个 "+ NEW VOICE" 入口
- [ ] 写 `CharacterEditor.tsx`：表单（名字、avatar emoji、systemPrompt textarea、enableActions toggle），保存到 `getCustomCharacters` / `saveCustomCharacter`
- [ ] 在 Reader 选段气泡里允许长按 ⋯ 切换"当前角色"
- [ ] Commit: `feat(voices): character list + custom editor`

## Task 7.2: Stats 视图

- [ ] 写 `src/views/Stats/Stats.tsx`，分节：`I. THIS YEAR`（书数、字数、阅读时长，从 `getReadingTimeLog` / books 算）+ `II. OPINIONS`（观点卡总数、agree/disagree 比） + `III. EXPORTS`（导出卡片入口）
- [ ] 写 `YearReport.tsx` 简化版（不复用桌面 YearReport.tsx，那是大全屏组件）
- [ ] Commit: `feat(stats): basic year stats + opinion summary`

## Task 7.3: 卡片导出（高亮 / 观点 / 书评卡）

- [ ] 复用 `html2canvas`，在 Reader drawer 的高亮条目上加"导出 →"按钮，弹出预览图卡 → 用户保存到相册
- [ ] 在 Stats → Exports 列出可导出条目
- [ ] 卡片设计：保持杂志风（粉/黑底 + Georgia 斜体引文 + Marginalia wordmark 水印）
- [ ] Commit: `feat(export): card export for highlights/opinions/reviews`

## Task 7.4: 自由笔记 (Markdown)

- [ ] 在书的子页面（暂时挂在 Library 长按书条目 → "笔记 →"，或者 Reader 顶栏 ≡ → 加一个 NOTES tab）
- [ ] 写 `src/views/Reader/FreeNote.tsx`：textarea + react-markdown 预览
- [ ] 保存到 `BookState.freeNote`
- [ ] Commit: `feat(notes): markdown free-form notes per book`

## Task 7.5: 观点卡片（Tinder 滑动）

- [ ] 在 AIPanel 的 AI 气泡上长按 → "保存为观点卡"
- [ ] Stats → Opinions 显示卡片堆叠，左右滑表态
- [ ] 写 `src/views/Stats/OpinionStack.tsx`
- [ ] Commit: `feat(opinion): tinder-style swipe cards for AI opinions`

## Task 7.6: AI 预读（章节概要 / 全书脉络 / 人物档案）

- [ ] 在 Reader 顶栏 ≡ 抽屉里加 `III. PREREAD` 按钮 → 触发 `buildPreReadPrompt`（已存在）→ 流式生成 → 存到 `BookState.preReadData` / `bookSummary` / `bookCharacters`
- [ ] 渲染：抽屉里展开为 markdown 预览
- [ ] Commit: `feat(preread): AI chapter summaries + book-level synthesis`

## Task 7.7: 书评（含角色书评）

- [ ] 在 Reader 顶栏 ≡ 抽屉里 `IV. RATE` → 弹卡片：星级 + 各角色短评（每个聊过的角色一条）
- [ ] 保存到 `BookState.rating` / `BookState.characterReviews`
- [ ] Stats → Reviews 列表
- [ ] Commit: `feat(rating): star rating + per-character review`

## M7 Checkpoint

**用户演示点**：所有 13 项 v1 功能都能用。从导入书 → 阅读 → 高亮 → 召唤 AI → 圆桌 → 保存观点卡 → 写自由笔记 → 打分 → 导出卡片，完整闭环。

---

# Milestone 8 · 清理旧代码 + 部署 + 朋友试用

## Task 8.1: 删除桌面端旧代码

**Files:**
- Delete: `src/components/{Bookshelf,CardExport,CharacterCreate,CharacterReview,CharacterSelect,Mindmap,Reader,Settings,Sidebar,YearReport,BookProfile}/`
- Delete: `src/App.legacy.tsx`、`src/App.legacy.css`

- [ ] **Step 1: 删除**

```bash
rm -rf src/components/Bookshelf
rm -rf src/components/CardExport
rm -rf src/components/CharacterCreate
rm -rf src/components/CharacterReview
rm -rf src/components/CharacterSelect
rm -rf src/components/Mindmap
rm -rf src/components/Reader
rm -rf src/components/Settings
rm -rf src/components/Sidebar
rm -rf src/components/YearReport
rm -rf src/components/BookProfile
rm src/App.legacy.tsx
rm src/App.legacy.css
```

- [ ] **Step 2: 重构后跑一遍 build**

```bash
npm run build
```

预期：build 成功，没有 import error。如有，根据错误信息把 import 路径修到新结构。

- [ ] **Step 3: dev 验证全功能不退化**

跑 M7 Checkpoint 全流程。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy desktop components"
```

## Task 8.2: 部署到 Cloudflare Pages（或 Vercel）

- [ ] **Step 1: 推到 GitHub**

```bash
git remote add origin <user-provided-url>
git push -u origin main
```

- [ ] **Step 2: Cloudflare Pages 配置**

- 连接 GitHub repo
- Build command: `npm run build`
- Build output: `dist`
- 自动部署

- [ ] **Step 3: 自定义域名**

由用户提供，绑定到 Pages 项目。

- [ ] **Step 4: 真机测试 PWA**

- iPhone Safari 打开 → 加到主屏，确认图标对、启动后是 standalone 模式
- Android Chrome 打开 → 安装

## Task 8.3: 朋友试用

- [ ] 写一段 200 字内的"使用说明"（推送到 GLM 注册、贴 Key、导入第一本书），可以放在 Setup 引导页底部
- [ ] 收 3-5 个朋友反馈，记录哪些 friction
- [ ] 决定是否进入 v2

## M8 Checkpoint

**用户演示点**：朋友收到链接 → iPhone 加到主屏 → 配 GLM Key → 导入 epub → 读 + 召唤 AI。完成。

---

# 自检（Self-Review）

## 1. Spec coverage

| Spec 章节 | 对应 Task | OK? |
|---|---|---|
| §1 范围与分发 | M1 Task 1.6（PWA manifest） + M8 部署 | ✓ |
| §2 v1 功能 13 项 | M3-M7 全部覆盖 | ✓ |
| §3 视觉语言 | Task 1.4 token + 各视图 css | ✓ |
| §4 信息架构 5 视图 + Tab | Task 2.1 TabBar + 各 view | ✓ |
| §5 阅读页交互 | Task 4.1 + 5.x + 6.3 | ✓ |
| §6 圆桌 | Task 6.4 | ✓ |
| §7 Provider | Task 6.1 + 6.2 | ✓ |
| §8 数据模型 + featuredHighlightId | Task 3.1 | ✓ |
| §9 技术架构 | M1-M8 整体 | ✓ |
| §10 触屏细节 | Task 4.1 swipe + 5.1 long-press | ✓ |
| §11 风险（epubjs PoC） | M4 第一次实测 → 若失败需要 spike | ⚠ 隐式覆盖 |

⚠ 修复：在 M4 末尾加显式 PoC checkpoint。

## 2. Placeholder scan

扫了一遍，没有 TBD / TODO / "implement later"。Task 7.x 的子步骤展开较粗，但保留了**完整的功能边界 + 文件路径**，执行时可以再展开为更细的步骤。

## 3. Type consistency

- `BookEntryData` 在 Task 2.3 定义，全程使用
- `Character` / `Highlight` / `Bookmark` / `Message` 全部 import 自 `../../types`，沿用 spec §8 定义
- `LLMConfig` 沿用桌面端
- `ProviderPreset` 在 Task 6.1 定义

## 4. 已修

补上 M4 末尾的显式 PoC checkpoint（见下）。

---

# M4 末尾追加 — epubjs 触屏 PoC 检查点

完成 Task 4.1 后，**强制做一次真机或 Chrome iOS 模拟器验证**：

- [ ] iOS Safari (真机 / 模拟器) 翻页流畅
- [ ] iOS Safari 选中文字不被系统工具条挡住
- [ ] Android Chrome 翻页流畅
- [ ] Android Chrome 选中文字事件能被 epubjs 捕获

**如果失败**：
- 回到 spec §11 风险表，触发"重新选型"决策点
- 候选：fork epubjs 修补 / 换 readium-js / 自研 paginator
- 这是一个**项目止血点**，需要重新讨论才继续 M5

如成功，继续 M5。
