# Image Background Remover — 全流程开发指南

> 从 MVP 需求文档到支付系统上线的完整工作流记录，含技术选型、架构演进、踩坑总结。  
> 可作为后续网站项目的开发参考模板。  
> 最终方案：**Next.js 静态导出 + Cloudflare Pages + Cloudflare Workers + D1 数据库 + PayPal 支付 + 自定义域名**

---

## 目录

1. [项目概述](#1-项目概述)
2. [阶段一：MVP 需求定义](#2-阶段一mvp-需求定义)
3. [阶段二：技术选型与架构设计](#3-阶段二技术选型与架构设计)
4. [阶段三：前端开发（Next.js）](#4-阶段三前端开发nextjs)
5. [阶段四：后端开发（Cloudflare Worker）](#5-阶段四后端开发cloudflare-worker)
6. [阶段五：CI/CD 与部署](#6-阶段五cicd-与部署)
7. [阶段六：自定义域名与 HTTPS](#7-阶段六自定义域名与-https)
8. [阶段七：国际化（i18n）](#8-阶段七国际化i18n)
9. [阶段八：用户系统（Google OAuth）](#9-阶段八用户系统google-oauth)
10. [阶段九：积分与权限系统](#10-阶段九积分与权限系统)
11. [阶段十：支付系统接入（PayPal）](#11-阶段十支付系统接入paypal)
12. [项目结构与最终架构图](#12-项目结构与最终架构图)
13. [通用开发流程模板](#13-通用开发流程模板)
14. [踩坑记录（按阶段分类）](#14-踩坑记录按阶段分类)
15. [排障 Checklist](#15-排障-checklist)

---

## 1. 项目概述

| 项目信息 | 详情 |
|---------|------|
| **产品名称** | Image Background Remover（在线去背景工具） |
| **目标用户** | 设计师、内容创作者、需要快速去背景的普通用户（面向海外） |
| **核心功能** | 上传图片 → AI 去背景 → 下载结果 |
| **盈利模式** | 免费试用 + 积分包/订阅付费 |
| **开始时间** | 2026-03-23 |
| **支付上线** | 2026-04-16 |
| **总工期** | ~24 天（含非连续开发） |
| **源码仓库** | https://github.com/lelandlee97m/image-background-remover |
| **生产地址** | https://imagebackgroundremover88ic.shop |

---

## 2. 阶段一：MVP 需求定义

### 2.1 输出物

创建 MVP 需求文档（`project/image-bg-remover-mvp.md`），明确以下内容：

- **项目背景**：为什么做这个产品
- **目标用户**：谁会用
- **功能需求**：MVP 必须做什么
- **技术需求**：用什么技术
- **非功能需求**：性能、可用性、安全
- **上线标准**：什么叫"做完"

### 2.2 MVP 功能清单（第一版）

| 功能 | 优先级 | 说明 |
|------|:---:|------|
| 图片上传 | P0 | 支持 PNG、JPEG，≤5MB |
| 背景去除 | P0 | 调用 Remove.bg API |
| 预览展示 | P0 | 实时展示去背景结果 |
| 结果下载 | P0 | 透明背景 PNG 下载 |
| 错误处理 | P0 | 上传失败、API 异常的提示 |
| 批量处理 | P2 | 后续迭代 |
| 用户账户 | P2 | 后续迭代 |
| 背景替换 | P3 | 后续迭代 |

### 2.3 关键决策

- **MVP 不做用户系统**，先验证核心功能可用性
- **不做持久化存储**，图片仅内存缓存
- **先上线再迭代**，不追求完美

### 💡 经验

> **MVP 文档的作用**：不只是写给开发看的需求清单，更是"做什么/不做什么"的决策记录。后续每次需求膨胀时回头看看 MVP 文档，判断是否偏离核心目标。

---

## 3. 阶段二：技术选型与架构设计

### 3.1 技术栈选择

| 层级 | 选型 | 选择理由 |
|------|------|---------|
| **前端框架** | Next.js（静态导出模式） | 生态成熟、SSG 支持、React 组件丰富 |
| **样式方案** | Tailwind CSS v4 | 快速开发、原子化、响应式友好 |
| **后端** | Cloudflare Workers | 全球边缘部署、免服务器管理、与 Pages 同生态 |
| **AI 推理** | Remove.bg API（初期）→ Workers AI（后期） | 先用成熟 API 验证产品，后续考虑自研模型降本 |
| **数据库** | Cloudflare D1（SQLite） | 与 Workers 原生集成、Serverless、免运维 |
| **认证** | Google OAuth（Authorization Code Flow） | 海外用户友好、免注册流程 |
| **支付** | PayPal（REST API v2） | 国际支付标准、支持订阅和一次性支付 |
| **包管理器** | pnpm | 快速、省空间、lock 文件可靠 |
| **CI/CD** | GitHub Actions + Wrangler CLI | 代码即部署、版本可追溯 |
| **域名** | GoDaddy 购买 → NS 托管到 Cloudflare | 一站式 DNS + SSL + CDN |

### 3.2 架构设计（最终版）

```
用户浏览器
    │
    ├── 静态资源 ──→ Cloudflare CDN ──→ Cloudflare Pages（Next.js 静态导出）
    │
    └── API 请求 ──→ Cloudflare Workers（同一域名，反向代理）
                          │
                          ├── Remove.bg API（图片处理）
                          ├── D1 Database（用户/积分/订单）
                          └── PayPal API（支付处理）
```

### 3.3 关键架构决策

1. **前后端分离但同域部署**：Pages 托管前端，Workers 处理 API，通过自定义域名统一入口，避免跨域问题
2. **静态导出而非 SSR**：Cloudflare Pages 免费额度更大，纯静态文件性能最优
3. **D1 而非外部数据库**：零运维、与 Workers 延迟最低、免费额度足够 MVP
4. **PayPal 而非 Stripe**：先做 PayPal，后续可叠加 Stripe

### 💡 经验

> **技术选型的核心原则**：选你熟悉的，不选最热门的。能用 Serverless 就不要碰服务器管理。架构能简单就别复杂，MVP 阶段最重要的是"能跑"。

---

## 4. 阶段三：前端开发（Next.js）

### 4.1 项目初始化

```bash
mkdir -p project/frontend
cd project/frontend
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=false
```

### 4.2 关键配置

**next.config.ts**（⚠️ 必须配置）：

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",                   // 必须：开启静态导出
  images: { unoptimized: true },      // 必须：静态导出不支持 Image Optimization
};

export default nextConfig;
```

**package.json**（⚠️ 必须声明）：

```json
{
  "packageManager": "pnpm@10.32.1"    // 必须：明确包管理器版本
}
```

### 4.3 组件开发顺序

| 顺序 | 组件 | 说明 |
|:---:|------|------|
| 1 | `UploadZone.tsx` | 拖拽/点击上传区域 |
| 2 | `ImagePreview.tsx` | 去背景结果预览 |
| 3 | `DownloadButton.tsx` | 下载按钮 |
| 4 | `Navbar.tsx` | 顶部导航 |
| 5 | `Footer.tsx` | 底部信息 |
| 6 | `LanguageSelector.tsx` | 多语言切换 |
| 7 | `GoogleAuth.tsx` | Google 登录按钮 |
| 8 | `GuestQuota.tsx` | 游客免费额度显示 |
| 9 | `CreditBalance.tsx` | 积分余额显示 |
| 10 | `WatermarkOverlay.tsx` | 水印叠加（免费用户） |
| 11 | `UsageModal.tsx` | 额度用完时的转化弹窗 |

### 4.4 页面路由

```
/                    → 首页（上传 + 去背景核心功能）
/pricing             → 定价页（积分包 + 订阅方案）
/dashboard           → 用户仪表盘（积分余额 + 使用历史 + 购买记录）
```

### 💡 经验

> **静态导出的限制**：不能用 `getServerSideProps`、不能用 API Routes、不能用动态路由的 `generateStaticParams` 之外的参数。所有动态数据通过客户端 `fetch` 获取。

---

## 5. 阶段四：后端开发（Cloudflare Worker）

### 5.1 Worker 初始化

```bash
mkdir -p project/worker
cd project/worker
pnpm init
pnpm add wrangler
```

### 5.2 wrangler.toml 配置

```toml
name = "image-background-remover"
main = "index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "image-bg-remover-db"
database_id = "你的D1数据库ID"

[vars]
REMOVE_BG_API_KEY = "你的API Key"
```

### 5.3 API 路由设计

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/remove-bg` | 上传图片并去背景 |
| GET | `/api/auth/login` | Google OAuth 跳转 |
| GET | `/api/auth/callback` | OAuth 回调 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/credits/balance` | 查询积分余额 |
| GET | `/api/credits/history` | 使用历史记录 |
| POST | `/api/paypal/create-order` | 创建 PayPal 订单 |
| POST | `/api/paypal/capture-order` | 捕获支付 |
| POST | `/api/paypal/create-subscription` | 创建订阅 |
| POST | `/api/paypal/verify-webhook` | PayPal Webhook 验证 |

### 5.4 D1 数据库初始化

```bash
# 创建数据库
npx wrangler d1 create image-bg-remover-db

# 执行 Schema
npx wrangler d1 execute image-bg-remover-db --file=./schema.sql
```

### 💡 经验

> **Worker 的核心优势**：请求到达最近的边缘节点处理，延迟极低。D1 查询在同一数据中心执行，没有传统数据库的网络跳转。

---

## 6. 阶段五：CI/CD 与部署

### 6.1 部署方案选择

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| Cloudflare 原生 Git 集成 | 零配置 | 不稳定、npm bug | ❌ 放弃 |
| GitHub Actions + Wrangler | 可控、可调试、可回滚 | 需要配置 workflow | ✅ 采用 |

### 6.2 前端部署 Workflow

`.github/workflows/deploy.yml`：

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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g pnpm
      - run: pnpm install
        working-directory: project/frontend
      - run: pnpm run build
        working-directory: project/frontend
        env:
          NEXT_PUBLIC_WORKER_URL: ${{ secrets.NEXT_PUBLIC_WORKER_URL }}
      - run: npx wrangler@3.60.3 pages deploy out --project-name=image-background-remover
        working-directory: project/frontend
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 6.3 Worker 部署 Workflow

`.github/workflows/deploy-worker.yml`：

```yaml
name: Deploy Cloudflare Worker

on:
  push:
    branches: [main]
    paths:
      - 'project/worker/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx wrangler@3.60.3 deploy
        working-directory: project/worker
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 6.4 GitHub Secrets 配置

| Secret 名称 | 说明 |
|------------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需含 Pages + Workers 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `NEXT_PUBLIC_WORKER_URL` | Worker URL（后续改为同域后可省略） |

### 6.5 部署流程

```
git push origin main
    │
    ├── 前端文件变动 → deploy.yml 触发 → 构建静态文件 → 部署到 Pages
    │
    └── Worker 文件变动 → deploy-worker.yml 触发 → 部署到 Workers
```

### 💡 经验

> **CI/CD 的核心原则**：自动化一切能自动化的。部署流程应该是 `git push` 一条命令解决，任何需要手动登录 Dashboard 操作的步骤都应该被自动化。

---

## 7. 阶段六：自定义域名与 HTTPS

### 7.1 域名购买

- 域名：`imagebackgroundremover88ic.shop`（GoDaddy 购买）

### 7.2 配置步骤

```
1. Cloudflare Dashboard → Pages → Custom domains → 添加域名
2. GoDaddy → DNS → Nameservers → 改为 Cloudflare NS
3. 等待 NS 传播（10 分钟 ~ 48 小时）
4. Cloudflare 自动配置 DNS + 签发 SSL
```

### 7.3 验证

```bash
# 检查 NS
dig imagebackgroundremover88ic.shop NS +short

# 检查 HTTPS
curl -sI https://imagebackgroundremover88ic.shop | head -3
```

### 💡 经验

> **域名策略**：`.shop` 域名便宜（首年 ~$1），适合 MVP 验证。品牌稳定后再换 `.com`。NS 托管到 Cloudflare 后，DNS 管理、SSL 证书、CDN 全部自动处理。

---

## 8. 阶段七：国际化（i18n）

### 8.1 支持语言

| 语言 | 代码 | 说明 |
|------|------|------|
| English | `en` | 默认语言（海外用户） |
| 简体中文 | `zh-CN` | 国内用户 |
| 繁体中文 | `zh-TW` | 港台用户 |

### 8.2 实现方式

- 客户端语言检测 + 手动切换
- 翻译文件 JSON 存储
- `LanguageSelector` 组件切换

### 💡 经验

> **i18n 的时机**：MVP 阶段可以只做英文，等产品验证通过后再加多语言。本项目在 MVP 后很快加了 i18n，因为目标用户包含中文用户群体。

---

## 9. 阶段八：用户系统（Google OAuth）

### 9.1 为什么需要用户系统

- 从"匿名使用"到"注册留存"的转化
- 积分系统的基础（需要用户 ID 关联）
- 支付系统的前提（需要用户身份）

### 9.2 OAuth 实现流程

```
用户点击"Sign in with Google"
    │
    → Worker /api/auth/login → 302 重定向到 Google
    → Google 授权页面 → 用户同意
    → Google 回调 /api/auth/callback?code=xxx
    → Worker 用 code 换取 access_token → 获取用户信息
    → 创建/更新 D1 sessions 表 → Set-Cookie
    → 302 重定向回首页
```

### 9.3 Google Cloud Console 配置

1. 创建 OAuth 2.0 凭据
2. 配置**已授权的 JavaScript 来源**：`https://imagebackgroundremover88ic.shop`
3. 配置**已授权的重定向 URI**：`https://imagebackgroundremover88ic.shop/api/auth/callback`
4. ⚠️ **重定向 URI 必须精确匹配**，末尾斜杠都不能差

### 9.4 踩坑重点

- **redirect_uri 不要动态拼接 host**，hardcode 为固定域名
- **Cookie 的 SameSite 属性**：自定义域名下设为 `None`（跨域场景），本地开发设为 `Lax`
- **Cloudflare Workers 没有 `Buffer`**，JWT 解码用 `atob()` 替代

---

## 10. 阶段九：积分与权限系统

### 10.1 用户分层

| 层级 | 身份 | 初始额度 |
|------|------|---------|
| Guest（游客） | 未登录，设备指纹识别 | 3 次 |
| Free（免费用户） | Google 注册 | 注册再送 3 次（共 6 次） |
| Paid（付费用户） | 购买积分包或订阅 | 按购买量 |

### 10.2 权限矩阵

| 功能 | 游客 | 免费用户 | 付费用户 |
|------|:---:|:---:|:---:|
| 最大文件 | 2MB | 5MB | 25MB |
| 输出质量 | 预览+水印 | 原尺寸+水印 | 原尺寸无水印 |
| 输出格式 | PNG | PNG | PNG / PSD |
| 批量处理 | ❌ | ❌ | ✅（仅订阅） |
| 历史记录 | ❌ | 7 天 | 永久 |

### 10.3 水印系统

- **水印是第一转化驱动力**
- 免费用户结果叠加半透明水印
- 付费用户无水印，这是最直接的付费动机

### 10.4 游客识别

- **客户端**：`localStorage` 存储剩余次数
- **服务端**：IP + 设备指纹（Canvas fingerprint / User-Agent hash）防止滥用

---

## 11. 阶段十：支付系统接入（PayPal）

### 11.1 支付方案

| 类型 | 产品 | 说明 |
|------|------|------|
| 一次性购买 | Credit Packs | 积分包，永不过期 |
| 订阅 | Monthly Plans | 月度积分，月底清零 |

### 11.2 定价方案

**积分包（一次性购买，永不过期）：**

| 套餐 | 积分 | 价格 | 单次成本 |
|------|:---:|:---:|:---:|
| Starter | 50 | $2.99 | $0.060 |
| Popular ⭐ | 200 | $9.99 | $0.050 |
| Value | 500 | $19.99 | $0.040 |
| Bulk | 2000 | $59.99 | $0.030 |

**月度订阅：**

| 方案 | 价格 | 每月积分 | 核心权益 |
|------|:---:|:---:|---------|
| Pro Lite | $4.99/mo | 100 | 无水印、高清输出 |
| Pro | $9.99/mo | 300 | 批量、API、PSD 导出 |
| Pro Annual | $79/yr | 300/mo | 省 $40，全部 Pro 功能 |

### 11.3 PayPal 集成流程

```
1. PayPal Developer Dashboard 创建应用，获取 Client ID / Secret
2. Sandbox 环境测试（买家/卖家沙盒账号）
3. 前端集成 PayPal JS SDK（动态加载）
4. 后端实现：
   - create-order：创建订单
   - capture-order：捕获支付
   - webhook：处理订阅事件（支付成功/取消/退款）
5. Sandbox 测试通过后切换 Live 环境
```

### 11.4 数据库表

- `orders`：一次性积分包购买记录
- `subscriptions`：订阅记录（含周期、状态、下次扣费时间）

### 11.5 从 Sandbox 到 Live 的切换要点

1. 更换 PayPal Client ID / Secret
2. 更改 API base URL（`api-m.sandbox.paypal.com` → `api-m.paypal.com`）
3. 配置 Webhook URL（Live 环境）
4. ⚠️ 前端 SDK 的 `client-id` 也要同步更换

---

## 12. 项目结构与最终架构图

### 12.1 文件结构

```
image-background-remover/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # 前端 CI/CD
│       └── deploy-worker.yml       # Worker CI/CD
├── project/
│   ├── frontend/                   # Next.js 前端（Cloudflare Pages）
│   │   ├── app/
│   │   │   ├── page.tsx            # 首页（核心功能）
│   │   │   ├── pricing/            # 定价页
│   │   │   ├── dashboard/          # 用户仪表盘
│   │   │   └── api/                # ⚠️ 静态导出下不可用
│   │   ├── components/
│   │   │   ├── UploadZone.tsx      # 上传区域
│   │   │   ├── ImagePreview.tsx    # 结果预览
│   │   │   ├── DownloadButton.tsx  # 下载按钮
│   │   │   ├── GoogleAuth.tsx      # Google 登录
│   │   │   ├── CreditBalance.tsx   # 积分余额
│   │   │   ├── GuestQuota.tsx      # 游客额度
│   │   │   ├── WatermarkOverlay.tsx # 水印
│   │   │   ├── UsageModal.tsx      # 转化弹窗
│   │   │   ├── Navbar.tsx          # 导航栏
│   │   │   ├── Footer.tsx          # 页脚
│   │   │   └── LanguageSelector.tsx # 语言切换
│   │   ├── lib/                    # 工具函数
│   │   ├── next.config.ts
│   │   └── package.json
│   ├── worker/                     # Cloudflare Worker（后端）
│   │   ├── index.ts                # 所有 API 路由
│   │   ├── schema.sql              # D1 数据库 Schema
│   │   └── wrangler.toml           # Worker 配置
│   └── image-bg-remover-mvp.md     # MVP 需求文档
├── DEPLOYMENT_GUIDE.md             # 本文档
├── PRICING_STRATEGY.md             # 定价策略文档
└── README.md
```

### 12.2 最终架构图

```
┌─────────────────────────────────────────────────────────┐
│                   Cloudflare Edge Network               │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Custom Domain: imagebackgroundremover88ic.shop  │    │
│  │                                                  │    │
│  │  /static/*  ──→  Cloudflare Pages (CDN)          │    │
│  │  /api/*     ──→  Cloudflare Worker (Compute)     │    │
│  └──────────────┬──────────────────┬────────────────┘    │
│                 │                  │                      │
│         Static HTML/JS/CSS    API Requests              │
│                 │                  │                      │
└─────────────────┼──────────────────┼──────────────────────┘
                  │                  │
                  ▼                  ▼
            用户浏览器          Worker 处理
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
              Remove.bg API    D1 Database      PayPal API
              (图片处理)      (用户/积分/订单)   (支付处理)
```

---

## 13. 通用开发流程模板

> 以下是从本项目提炼出的通用网站开发流程，可用于后续项目参考。

### Phase 0：立项（1 天）

- [ ] 明确产品定位和目标用户
- [ ] 调研竞品（至少 3 个）
- [ ] 确定 MVP 功能范围（做什么/不做什么）
- [ ] 输出：**MVP 需求文档**

### Phase 1：技术选型（0.5 天）

- [ ] 根据需求选择技术栈
- [ ] 确定部署方案（Serverless vs VPS vs 容器）
- [ ] 确定数据库方案
- [ ] 输出：**技术选型文档**（可合并在需求文档中）

### Phase 2：核心功能开发（3-5 天）

- [ ] 搭建项目骨架
- [ ] 开发核心功能（MVP 的 P0 需求）
- [ ] 本地联调通过
- [ ] 输出：**可本地运行的最小可用版本**

### Phase 3：部署上线（1-2 天）

- [ ] 配置 CI/CD
- [ ] 首次部署成功
- [ ] 配置域名和 HTTPS
- [ ] 输出：**可通过域名访问的生产版本**

### Phase 4：用户系统（2-3 天）

- [ ] 选定认证方案（OAuth / 自建）
- [ ] 实现注册/登录流程
- [ ] 数据库用户表和会话管理
- [ ] 输出：**用户可注册登录的版本**

### Phase 5：商业化（3-5 天）

- [ ] 设计定价策略（积分/订阅）
- [ ] 实现权限分层
- [ ] 接入支付系统
- [ ] 实现转化路径（水印/额度限制）
- [ ] 输出：**可付费的完整版本**

### Phase 6：优化与迭代（持续）

- [ ] 收集用户反馈
- [ ] 性能优化
- [ ] 功能迭代
- [ ] SEO 和增长

### 各阶段产出物清单

| 阶段 | 必须产出 |
|------|---------|
| Phase 0 | MVP 需求文档 |
| Phase 1 | 技术选型说明 |
| Phase 2 | 核心功能代码 + 本地可运行 |
| Phase 3 | CI/CD 配置 + 域名可访问 |
| Phase 4 | 用户系统 + 数据库 Schema |
| Phase 5 | 定价策略文档 + 支付集成 |
| Phase 6 | 迭代日志 + 数据分析 |

---

## 14. 踩坑记录（按阶段分类）

### 部署相关

#### 踩坑1：Cloudflare 原生 Git 集成 — npm 报错
**现象**：`npm error Exit handler never called!`  
**原因**：Cloudflare 检测到 `package-lock.json` 走 npm 10.9.2，内部 bug 崩溃  
**解决**：改用 `pnpm-lock.yaml` + `packageManager` 声明，最终改用 GitHub Actions + Wrangler

#### 踩坑2：GitHub Actions 中 pnpm 找不到
**原因**：`actions/setup-node` 的 `cache: 'pnpm'` 要求系统已有 pnpm  
**解决**：单独 `npm install -g pnpm`，不依赖 setup-node 的 cache

#### 踩坑3：wrangler `--yes` 参数不存在
**原因**：`wrangler pages deploy` 不支持 `--yes`  
**解决**：删掉 `--yes`

#### 踩坑4：wrangler 3.60.0 有 >1000 assets 的 bug
**解决**：升级到 3.60.3

#### 踩坑5：Next.js 忘开静态导出
**现象**：部署后页面空白或 404  
**解决**：`next.config.ts` 加 `output: "export"` + `images: { unoptimized: true }`

#### 踩坑6：Worker 部署认证失败
**原因**：API Token 只有 Pages 权限，没有 Workers 权限  
**解决**：用 **Edit Cloudflare Workers** 模板重建 Token

#### 踩坑7：静态导出模式下 API Routes 405
**原因**：`output: "export"` 后 API Routes 不存在  
**解决**：后端逻辑独立部署为 Worker，前端通过环境变量调用

### OAuth 相关

#### 踩坑8：redirect_uri_mismatch
**原因**：动态拼接 host 导致与 Google Console 配置不匹配  
**解决**：hardcode `OAUTH_REDIRECT_URI` 为固定域名

#### 踩坑9：Cloudflare Workers 没有 Buffer
**原因**：Workers 运行时不是 Node.js，没有 `Buffer` 全局变量  
**解决**：用 `atob()` 替代 `Buffer.from(token, 'base64')`

#### 踩坑10：Cookie SameSite 导致登录态丢失
**原因**：自定义域名下 Cookie 需要 `SameSite=None; Secure`  
**解决**：根据域名动态设置 SameSite 属性

### 支付相关

#### 踩坑11：跨域 Cookie 问题
**原因**：前端调用 Worker 时用了绝对 URL（不同域），Cookie 无法传递  
**解决**：改为同域相对路径（`/api/...`），Worker 通过路由匹配处理

#### 踩坑12：PayPal SDK 加载时机
**原因**：PayPal JS SDK 需要在 DOM ready 后加载  
**解决**：动态加载 SDK，传入正确的 `client-id` 和 `currency`

#### 踩坑13：静态导出 + useSearchParams 的 Suspense 问题
**原因**：Next.js 静态导出下 `useSearchParams` 需要 Suspense 边界  
**解决**：用 `Suspense` 包裹，或避免在静态页面使用

---

## 15. 排障 Checklist

| 症状 | 检查项 |
|------|--------|
| `npm error Exit handler never called` | 检查 `package-lock.json`，改用 `pnpm-lock.yaml` |
| `pnpm: command not found` | workflow 中是否有 `npm install -g pnpm` |
| `Unknown argument: yes` | 删掉 `wrangler pages deploy` 的 `--yes` |
| 部署成功但页面空白 | `next.config.ts` 是否有 `output: "export"` |
| 图片不显示 | `next.config.ts` 是否有 `images: { unoptimized: true }` |
| Wrangler 认证失败 | Token 是否同时含 Pages + Workers 权限 |
| 背景移除 405 | 前端是否用相对路径 `/api/...` 调用 Worker |
| Google 登录 redirect_uri_mismatch | Console 配置的重定向 URI 是否精确匹配 |
| 登录态丢失 | Cookie SameSite 属性是否正确 |
| PayPal 沙盒支付失败 | 沙盒买家账号是否正确、API 凭据是否为 Sandbox |
| Live 支付不触发 | Webhook URL 是否配置为 Live 环境 |
| 自定义域名无法访问 | NS 是否已改到 Cloudflare、是否已传播 |
| Actions 没触发 | workflow 文件路径是否正确（`.github/workflows/`） |

---

## 最终部署产物

| 资源 | 地址 |
|------|------|
| 前端（自定义域名） | https://imagebackgroundremover88ic.shop |
| 前端（Pages 默认域名） | https://image-background-remover.pages.dev |
| 后端（Cloudflare Worker） | https://image-background-remover.lelandlee97m.workers.dev |
| 源码仓库 | https://github.com/lelandlee97m/image-background-remover |

---

*文档初稿：2026-03-28（部署流程）*  
*重大更新：2026-04-17（扩展为全流程开发指南，覆盖 MVP → 支付上线全阶段）*
