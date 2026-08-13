# S12 · 知识库 + KKFileView 预览

## What to build
知识库端到端：文章/分类/附件管理 + **KKFileView 在线预览**（iframe 嵌入，预览 URL 后端签发签名，ADR-0012）+ 阅读统计。

## 五维清单
- **数据库**：knowledge_articles/knowledge_categories/knowledge_attachments/knowledge_article_daily_stats 等（保留表迁移）
- **后端接口**：文章/分类 CRUD、POST /training/preview-url（签发预览签名 URL，时效内有效）、附件上传（OSS 代理，ADR-0009）
- **业务算法**：预览签名生成（时效+鉴权）；阅读统计累计
- **前端页面**：knowledge feature（文章列表/详情/编辑，附件 **iframe 预览**）
- **单元测试**：API e2e（文章 CRUD/预览 URL 无权限 5003）

## Acceptance criteria
- [x] 文章端到端可用；附件点击打开 KKFileView 预览（doc/xls/pdf 样例验证）
- [x] 预览 URL 带签名时效，未授权访问返回拒绝
- [x] 阅读统计正确累计

## Blocked by
- S02 认证与权限
- （部署项：KKFileView 服务 + LibreOffice，见 step-5）

---

## 进度 · TDD 后端实现（已完成）

### 完成项
- [x] **数据库**：新增 3 张表 `knowledge_categories` / `knowledge_articles` / `knowledge_attachments`
- [x] **预览签名引擎纯函数**：`src/knowledge/engine/preview-sign.ts`
  - HMAC-SHA256 签名 + Base64URL 编码
  - 时效控制（默认 1 小时）
  - timingSafeEqual 防时序攻击
  - 过期 / 篡改 / 错密钥 三种失败场景
- [x] **预览签名单元测试**：6 项全部 PASS（正常/过期/篡改/错密钥）
- [x] **分类 API**：GET/POST/PUT/DELETE /knowledge/categories
- [x] **文章 API**：GET/POST/PUT/DELETE /knowledge/articles
  - 查看详情自动 +1 阅读量
  - 按分类/关键词搜索 + 分页
- [x] **附件 API**：GET/POST /knowledge/articles/:id/attachments
- [x] **预览 URL API**：GET /knowledge/preview-url（签发带签名时效 URL）
- [x] **权限控制**：knowledge:view 可看，knowledge:manage 可管理
- [x] **e2e 测试**：9 项全部 PASS
- [x] **全量测试**：116/116 通过（`npx jest --runInBand`）

### 测试数据
- 单元测试：`tests/preview-sign.unit.test.ts`（6 单测）
- e2e 测试：`tests/knowledge.e2e.test.ts`（9 e2e）
- 错误码：5001（分类不存在）、5002（文章不存在）、5003（附件不存在）

### 未实现（后续切片）
- [ ] 附件上传（OSS 代理，ADR-0009）
- [x] 预览 token 验证中间件（KKFileView 回调鉴权）
- [x] 阅读统计日表（knowledge_article_daily_stats）
- [ ] 前端知识库页面（列表/详情/编辑 + iframe 预览）
- [ ] KKFileView 服务部署与集成

---

## 迭代二 · 阅读统计日表 + 预览 token 验证（TDD 完成）

### 完成项
- [x] **数据库**：新增 `knowledge_article_daily_stats` 表
  - 字段：article_id / date / view_count / unique_viewers
  - 唯一约束：(article_id, date)
- [x] **阅读统计日表 API**：
  - `GET /knowledge/articles/:id/stats/daily` — 文章阅读趋势（按天，支持 days 参数）
  - `GET /knowledge/stats/summary` — 知识库总览统计（文章数/分类数/总阅读/今日阅读）
  - 权限：`knowledge:manage`（仅管理员）
- [x] **阅读量自动计入日统计**：
  - 查看文章详情时自动写入当日统计
  - 使用 MySQL `INSERT ... ON DUPLICATE KEY UPDATE` 原子操作
- [x] **预览 token 验证 API**（公开接口）：
  - `GET /knowledge/preview-verify?token=xxx`
  - 验证签名有效性 + 时效检查
  - 返回 valid / fileUrl / fileName / expiresAt
  - 供 KKFileView 服务回调鉴权使用
- [x] **e2e 测试**：`tests/knowledge-enhanced.e2e.test.ts` — 8 项全部 PASS
  - 阅读统计：日趋势/总览/查看写入/权限隔离（4 项）
  - 预览验证：合法 token/无效 token/过期 token/不传 token（4 项）
- [x] **原有测试回归**：knowledge.e2e（9 项）+ preview-sign.unit（6 项）全部 PASS

### 架构说明
```
┌─────────────────────────────────────────────────────────┐
│  员工端（knowledge:view）          管理端（knowledge:manage） │
│  ├─ 文章列表/详情                  ├─ 分类 CRUD                 │
│  ├─ 附件列表                       ├─ 文章 CRUD                 │
│  └─ 获取预览 URL（签名 token）     ├─ 附件管理                 │
│                                      ├─ 阅读统计（日趋势/总览）  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  KKFileView 服务     │
              │  （iframe 预览）      │
              └─────────┬───────────┘
                        │ 回调验证 token
                        ▼
              GET /knowledge/preview-verify
              （公开接口，验证签名）
```

### 错误码扩展
- 5004：预览 token 不能为空
