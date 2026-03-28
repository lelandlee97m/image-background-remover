# Image Background Remover — 部署全流程指南

> 记录从零搭建到 CI/CD 全自动部署的完整过程，含踩坑记录。  
> 最终方案：**GitHub Actions → Wrangler → Cloudflare Pages**

---

## 目录

1. [项目结构](#项目结构)
2. [技术栈](#技术栈)
3. [前提条件](#前提条件)
4. [Cloudflare 配置](#cloudflare-配置)
5. [GitHub Secrets 配置](#github-secrets-配置)
6. [GitHub Actions 工作流](#github-actions-工作流)
7. [Next.js 关键配置](#nextjs-关键配置)
8. [踩坑记录（必读）](#踩坑记录必读)
9. [日常部署流程](#日常部署流程)
10. [排障 Checklist](#排障-checklist)

---

## 项目结构

```
image-background-remover/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD 工作流
├── project/
│   ├── frontend/               # Next.js 前端（部署到 Cloudflare Pages）
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── next.config.ts      # ⚠️ 必须开启 output: "export"
│   │   ├── package.json        # ⚠️ 必须声明 packageManager: pnpm
│   │   └── pnpm-lock.yaml      # ⚠️ 必须用 pnpm lockfile，不能用 package-lock.json
│   └── worker/                 # Cloudflare Worker（AI 后端）
│       ├── index.ts
│       └── wrangler.toml
└── README.md
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16（静态导出模式） |
| 样式 | Tailwind CSS v4 |
| 语言 | TypeScript |
| 包管理器 | pnpm |
| AI 推理 | Cloudflare Workers AI（背景移除模型） |
| 托管 | Cloudflare Pages（前端）+ Cloudflare Workers（后端） |
| CI/CD | GitHub Actions + Wrangler CLI |

---

## 前提条件

- Node.js 20+
- pnpm（`npm install -g pnpm`）
- Cloudflare 账号
- GitHub 账号，仓库已创建

---

## Cloudflare 配置

### 1. 创建 Cloudflare Pages 项目

在 [Cloudflare Dashboard](https://dash.cloudflare.com/pages) 创建项目：

> ⚠️ **重要**：推荐用 **GitHub Actions + Wrangler** 部署（本指南方案），而不是 Cloudflare 原生 GitHub 集成。  
> 原因见[踩坑记录](#踩坑1cloudflare-原生-github-集成-npm-报错)。

**创建空项目（不绑定 Git）：**

```bash
npx wrangler@3.60.3 pages project create image-background-remover
```

或在 Dashboard → Pages → Create a project → Direct Upload 手动创建。

### 2. 获取必要凭证

需要两个值，用于 GitHub Actions：

**Account ID：**
Dashboard 右侧边栏 → "Account ID"（复制）

**API Token：**
https://dash.cloudflare.com/profile/api-tokens → Create Token  
选择模板：**Edit Cloudflare Workers**  
确保包含权限：
- `Cloudflare Pages: Edit`
- `Account: Read`

---

## GitHub Secrets 配置

在 GitHub 仓库 → Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 值 |
|------------|---|
| `CLOUDFLARE_API_TOKEN` | 上一步获取的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

---

## GitHub Actions 工作流

文件路径：`.github/workflows/deploy.yml`

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  deployments: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        working-directory: project/frontend
        run: pnpm install

      - name: Build
        working-directory: project/frontend
        run: pnpm run build

      - name: Deploy to Cloudflare Pages
        working-directory: project/frontend
        run: npx wrangler@3.60.3 pages deploy out --project-name=image-background-remover
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**说明：**
- `working-directory: project/frontend` — 前端代码在子目录，必须指定
- `pages deploy out` — `out` 是 Next.js 静态导出的输出目录
- `wrangler@3.60.3` — 固定版本，避免 bug（见踩坑记录）

---

## Next.js 关键配置

### next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",        // ⚠️ 必须：开启静态导出
  images: { unoptimized: true },  // ⚠️ 必须：Cloudflare Pages 不支持 Next.js Image Optimization
};

export default nextConfig;
```

### package.json

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@10.32.1",  // ⚠️ 必须声明包管理器
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

**⚠️ Lock file 必须用 pnpm-lock.yaml，不能有 package-lock.json（详见踩坑记录）**

---

## 踩坑记录（必读）

### 踩坑1：Cloudflare 原生 GitHub 集成 — npm 报错

**现象：**
```
npm error Exit handler never called!
npm error This is an error with npm itself.
```

**根本原因：**  
Cloudflare Pages 通过检测 lock 文件来判断包管理器：
- 有 `package-lock.json` → 用 npm → npm 10.9.2 在 Cloudflare 的构建环境中有内部 bug，概率性崩溃
- 有 `pnpm-lock.yaml` → 用 pnpm ✅

项目原本只有 `package-lock.json`，所以 Cloudflare 一直走 npm，一直崩。

**解决：**  
1. 用 `pnpm import` 从 package-lock.json 生成 pnpm-lock.yaml
2. 删除 package-lock.json
3. package.json 中声明 `"packageManager": "pnpm@x.x.x"`

> 但即使修了这个，Cloudflare 原生集成还有其他不稳定问题。  
> **最终放弃原生集成，改用 GitHub Actions + Wrangler，更可控更稳定。**

---

### 踩坑2：GitHub Actions 中 pnpm 找不到

**现象：**
```
pnpm: command not found
```

**原因：**  
`actions/setup-node` 的 `cache: 'pnpm'` 选项要求系统已有 pnpm，但 Ubuntu runner 默认没有。

**错误做法：**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'   # ❌ 会报错，因为 pnpm 还没装
```

**正确做法：** 单独先装 pnpm，不依赖 setup-node 的 cache 参数：
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'

- name: Install pnpm
  run: npm install -g pnpm   # ✅ 单独安装
```

---

### 踩坑3：wrangler 的 --yes 参数不存在

**现象：**
```
✘ [ERROR] Unknown argument: yes
```

**原因：**  
`wrangler pages deploy` 命令**不支持** `--yes` 参数，这个参数是其他 wrangler 子命令的（如 `wrangler deploy`）。

**修复：** 直接删掉 `--yes`，`pages deploy` 不需要交互确认。

```bash
# ❌ 错误
npx wrangler@3.60.0 pages deploy out --project-name=xxx --yes

# ✅ 正确
npx wrangler@3.60.3 pages deploy out --project-name=xxx
```

---

### 踩坑4：wrangler 3.60.0 有 >1000 assets 的 bug

**现象：**  
wrangler 自身 warning：
```
bug affecting usage of `wrangler pages deploy` with > 1000 assets in wrangler@3.60.0, fixed in wrangler@3.60.1
```

**修复：** 升级到 3.60.1+（我们用 3.60.3）。

---

### 踩坑5：Next.js 忘开静态导出模式

**现象：** 构建成功但 Cloudflare Pages 部署后页面空白或路由 404。

**原因：** Next.js 默认输出是 Node.js server 模式，Cloudflare Pages 需要纯静态文件。

**修复：** `next.config.ts` 加上：
```typescript
output: "export",
images: { unoptimized: true },
```

---

## 日常部署流程

### 自动部署（推荐）

```bash
git add .
git commit -m "feat: 你的改动"
git push origin main
# GitHub Actions 自动触发，~40秒完成
```

### 手动触发

GitHub → Actions → "Deploy to Cloudflare Pages" → Run workflow

### 查看部署状态

```bash
GH_TOKEN=<your_token> gh run list --repo <owner>/image-background-remover --limit 5
```

---

## 排障 Checklist

| 症状 | 检查项 |
|------|--------|
| `npm error Exit handler never called` | 检查是否有 `package-lock.json`，必须改用 `pnpm-lock.yaml` |
| `pnpm: command not found` | workflow 中是否有独立的 `npm install -g pnpm` 步骤 |
| `Unknown argument: yes` | 删掉 `wrangler pages deploy` 里的 `--yes` |
| 部署成功但页面空白 | 检查 `next.config.ts` 是否有 `output: "export"` |
| 图片不显示 | 检查 `next.config.ts` 是否有 `images: { unoptimized: true }` |
| Wrangler 认证失败 | 检查 GitHub Secrets 中 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 是否正确 |
| Actions 一直没触发 | 检查 workflow 文件路径是否为 `.github/workflows/deploy.yml` |

---

## 最终部署产物

| 资源 | 地址 |
|------|------|
| 前端（Cloudflare Pages） | `image-background-remover-8ic.pages.dev` |
| 后端（Cloudflare Worker） | 通过 Worker API 提供背景移除能力 |
| 源码仓库 | `github.com/lelandlee97m/image-background-remover` |

---

*文档生成时间：2026-03-28*  
*最终工作 commit：`d78d43c`*
