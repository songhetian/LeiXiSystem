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
- [ ] 文章端到端可用；附件点击打开 KKFileView 预览（doc/xls/pdf 样例验证）
- [ ] 预览 URL 带签名时效，未授权访问返回拒绝
- [ ] 阅读统计正确累计

## Blocked by
- S02 认证与权限
- （部署项：KKFileView 服务 + LibreOffice，见 step-5）
