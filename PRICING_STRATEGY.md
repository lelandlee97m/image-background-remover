# Pricing Strategy — Image Background Remover
# 定价策略 — 在线去背景工具

> Last Updated: 2026-04-10 | 最后更新：2026-04-10

---

## 1. Overview / 概述

This document defines the permission tiers, pricing plans, and conversion strategy for the Image Background Remover website. The site targets international users; all UI copy should be in English by default.

本文档定义了在线去背景工具网站的用户权限分层、定价方案和付费转化策略。网站面向海外用户，所有界面文案默认使用英文。

### Core Principle / 核心原则

**1 Credit = 1 Background Removal** / **1 积分 = 1 次去背景**

Target API cost: **≤ $0.01 per removal** / 目标 API 成本：**每次 ≤ $0.01**

---

## 2. User Tiers / 用户分层

| Tier / 层级 | Identity / 身份 | Description / 说明 |
|-------------|-----------------|-------------------|
| **Guest** / 游客 | Not logged in / 未登录 | Trial users, identified by device fingerprint / 试用用户，通过设备指纹识别 |
| **Free** / 免费用户 | Registered (Google OAuth) / 已注册 | Retained users with bonus credits / 留存用户，有注册赠送积分 |
| **Paid** / 付费用户 | Credit Pack or Pro Subscriber / 积分包或订阅用户 | Revenue source, full features / 收入来源，完整功能 |

---

## 3. Permission Matrix / 权限矩阵

| Feature / 功能 | Guest / 游客 | Free / 免费用户 | Paid (Pro / Credit Pack) / 付费用户 |
|---------------|:---:|:---:|:---:|
| **Starting credits / 初始额度** | 3 (device-level / 设备级) | +3 bonus on signup / 注册再送 3 次 | — |
| **Max file size / 最大文件** | 2 MB | 5 MB | 25 MB |
| **Output quality / 输出质量** | Preview + watermark / 预览尺寸+水印 | Original + watermark / 原尺寸+水印 | Original, no watermark / 原尺寸，无水印 |
| **Output format / 输出格式** | PNG | PNG | PNG / PSD |
| **Batch processing / 批量处理** | ❌ | ❌ | ✅ (Pro subscription only / 仅限订阅用户) |
| **History / 历史记录** | ❌ | 7 days / 7 天 | Permanent / 永久 |
| **API access / API 接入** | ❌ | ❌ | ✅ (Pro subscription only / 仅限订阅用户) |

> 💡 **Watermark is the #1 conversion driver.** / **水印是第一转化驱动力。**
> Free users get watermarked results; paid users get clean outputs. / 免费用户结果带水印，付费用户无水印。

---

## 4. Pricing Plans / 定价方案

### 4.1 Credit Packs / 积分包 (One-time Purchase, Never Expire / 一次性购买，永不过期)

| Pack / 套餐 | Credits / 积分 | Price / 价格 | Cost per Credit / 单次成本 |
|-------------|:---:|:---:|:---:|
| **Starter / 入门包** | 50 | **$2.99** | $0.060 |
| **Popular / 热门包** ⭐ | 200 | **$9.99** | $0.050 |
| **Value / 超值包** | 500 | **$19.99** | $0.040 |
| **Bulk / 批量包** | 2000 | **$59.99** | $0.030 |

> 🔥 The **Popular** pack (200 credits / $9.99) is the recommended entry point — highlight with a "Most Popular" badge on the pricing page.
>
> 🔥 **Popular 包**（200 积分 / $9.99）是推荐的入门选择——在定价页用 "Most Popular" 标签高亮展示。

### 4.2 Monthly Subscription / 月度订阅

| Plan / 方案 | Price / 价格 | Credits/Month / 每月积分 | Key Features / 核心权益 |
|-------------|:---:|:---:|---------|
| **Pro Lite** | **$4.99/mo** | 100 | No watermark, HD output / 无水印，高清输出 |
| **Pro** | **$9.99/mo** | 300 | Batch, API, PSD export / 批量处理、API 接入、PSD 导出 |
| **Pro Annual** | **$79/yr** | 300/mo | Save $40, all Pro features / 省 $40，全部 Pro 功能 |

> ⚠️ **Subscription credits reset monthly.** Credit pack credits never expire.
>
> ⚠️ **订阅积分月底清零，不累计。** 积分包积分永不过期。

---

## 5. Conversion Flow / 转化路径

```
Guest / 游客 (3 free uses, device-level / 设备级 3 次免费)
  │ quota exhausted → signup prompt / 额度用完 → 引导注册
  ▼
Registered User / 注册用户 (+3 bonus = 6 total / 注册送 3 次，共 6 次)
  │ quota exhausted → purchase prompt / 额度用完 → 引导购买
  ▼
┌──────────────────────────────────────────────┐
│  "You've used all your free credits"         │
│  "你的免费额度已用完"                          │
│                                               │
│  💳 Buy Credits (never expire / 永不过期)     │
│  · 50 credits    $2.99                       │
│  · 200 credits   $9.99  ← Most Popular       │
│  · 500 credits   $19.99                      │
│  · 2000 credits  $59.99                      │
│                                               │
│  🔄 Or Subscribe Monthly / 或按月订阅         │
│  · Pro Lite  $4.99/mo (100 credits)          │
│  · Pro        $9.99/mo (300 credits)         │
└──────────────────────────────────────────────┘
```

### Conversion Touchpoints / 转化触点

| Touchpoint / 触点 | Trigger / 触发条件 | Message / 提示信息 |
|---|---|---|
| **Homepage / 首页** | Guest visit / 游客访问 | "Try free — no signup required" / "免费试用，无需注册" |
| **Usage progress / 使用进度** | 2nd use (guest) / 第 2 次使用（游客） | "1 free use remaining — sign up for more" / "还剩 1 次免费额度——注册获取更多" |
| **File size limit / 文件限制** | Upload > 2MB (guest) or > 5MB (free) | "Upgrade to support up to 25MB files" / "升级支持最大 25MB 文件" |
| **Result page / 结果页** | After download / 下载后 | Watermark on free, clean for paid / 免费带水印，付费无水印 |
| **Quota exhausted / 额度用完** | 0 credits remaining / 积分归零 | Full purchase modal (see above) / 完整购买弹窗（见上方） |

---

## 6. Required Pages & Modules / 需要新增的页面和模块

| Priority / 优先级 | Page/Module / 页面或模块 | Description / 说明 |
|:---:|---|---|
| **P0** | Credit System / 积分系统 | D1 database tables: `users`, `credits`, `usage_log` |
| **P0** | Watermark System / 水印系统 | Overlay semi-transparent watermark for free users / 免费用户叠加半透明水印 |
| **P0** | Conversion Modal / 转化弹窗 | Show purchase options when quota is exhausted / 额度用完时展示购买选项 |
| **P1** | Pricing Page / 定价页 | `/pricing` — display all plans with comparison table / 展示所有方案及对比表 |
| **P1** | User Dashboard / 用户仪表盘 | Remaining credits, history, purchase records / 剩余积分、历史记录、购买记录 |
| **P2** | Payment Integration / 支付接入 | PayPal integration (deferred to later phase) / PayPal 接入（后期阶段） |
| **P2** | FAQ Page / FAQ 页 | Common questions in English / 英文常见问题 |
| **P3** | Referral System / 邀请奖励 | Invite friends → both get 5 free credits / 邀请好友双方各得 5 次免费额度 |

---

## 7. Database Schema / 数据库设计

```sql
-- Users table / 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT,
  tier TEXT DEFAULT 'free',        -- 'guest' | 'free' | 'pro'
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- Credits table / 积分表
CREATE TABLE credits (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  balance INTEGER DEFAULT 0,        -- remaining credits / 剩余积分
  source TEXT,                      -- 'gift_signup' | 'purchase' | 'subscription'
  pack_type TEXT,                   -- 'starter' | 'popular' | 'value' | 'bulk' | 'pro_lite' | 'pro'
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- Usage log table / 使用记录表
CREATE TABLE usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,                     -- NULL for guests / 游客为 NULL
  device_fingerprint TEXT,          -- for guest tracking / 用于追踪游客
  ip_address TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
```

---

## 8. Guest Identification / 游客识别

- **Client-side:** `localStorage` to store remaining free uses
- **Server-side:** IP + device fingerprint (Canvas fingerprint / User-Agent hash) as fallback to prevent abuse
- **客户端：** `localStorage` 存储剩余免费次数
- **服务端：** IP + 设备指纹（Canvas 指纹 / User-Agent 哈希）作为兜底防止滥用

---

## 9. Cost Estimate / 成本预估

Target API cost: **≤ $0.01 per removal** / 目标 API 成本：**每次 ≤ $0.01**

| Scenario / 场景 | DAU | API Cost/Month / 月 API 成本 | Est. Revenue/Month / 预估月收入 |
|---|:---:|:---:|:---:|
| All free users / 全部免费 | 100 | ~$15 | $0 |
| 30% convert / 30% 转化付费 | 100 | ~$10 | $300–$500 |
| 20% convert / 20% 转化付费 | 500 | ~$30 | $600–$1,000 |

---

## 10. Open Questions / 待确认事项

- [ ] Confirm Remove.bg API pricing tier to hit ≤ $0.01/call target / 确认 Remove.bg API 计费档位，达到 ≤ $0.01/次的目标
- [ ] Evaluate alternative APIs (rembg self-hosted, Clipdrop, etc.) for cost optimization / 评估替代 API（rembg 自部署、Clipdrop 等）以优化成本
- [ ] PayPal integration timeline / PayPal 接入时间线
- [ ] Brand name & domain improvement (current domain is long) / 品牌名和域名优化（当前域名较长）
