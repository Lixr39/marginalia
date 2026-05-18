# Marginalia · 手机版

一个带 AI 角色伴读的 EPUB PWA 阅读器。

## 本地开发

```bash
npm install
npm run dev
```

打开 `http://localhost:5173/`。

## 构建

```bash
npm run build
```

输出在 `dist/`。包含 PWA manifest + service worker。

## 部署

最简单：**Cloudflare Pages** 或 **Vercel**。两者都自动检测 vite 项目，零配置部署。

### Cloudflare Pages

1. 推到 GitHub（`git remote add origin <repo> && git push -u origin main`）
2. cloudflare.com → Pages → Connect to Git → 选这个 repo
3. Build command: `npm run build`，Output directory: `dist`
4. 保存后自动部署。给个免费的 `*.pages.dev` 域名。

### Vercel

1. 推到 GitHub
2. vercel.com → New Project → Import → 选这个 repo
3. Framework: Vite（自动识别），其他默认
4. Deploy

### 注意

- PWA 需要 **HTTPS**（两个平台都默认给）
- 用户 iOS Safari 打开 → 加到主屏幕，就会是 standalone App
- AI Key 是**用户自己填**的，存在他们手机本地 IndexedDB，不会上传

## 功能

✅ EPUB 阅读、翻页、章节追踪、位置持久化
✅ 长按选段：高亮 / 写笔记 / 召唤 AI / 书签
✅ AI 单聊 + 圆桌（多角色轮流回应）
✅ 5 种 Provider 预设（Custom / Claude / DeepSeek / Gemini / GLM 免费）
✅ 6 个预设角色 + 自定义角色（手动 / AI 提取材料）
✅ 自由笔记（Markdown）
✅ 年度统计 + 观点卡片 + 角色召唤排行
✅ Markdown 导出（含高亮、笔记、对话、观点）
✅ 日 / 夜双主题

⏳ AI 全书预读 / 章节概要（v2）
⏳ 书评打分 + 角色评价（v2）
⏳ 图片卡片导出（v2，目前有 Markdown 导出）

## 视觉风格

杂志编辑式排版。Marginalia 字面意思是"书页边的批注"——整个 App 像一本被排过版的文学杂志。每本书在书架里都有自己的折页页码、批注引文；每个 AI 角色像一篇专栏的撰稿人介绍；设置页是版权页。
