# 知识库回收站 API 实现说明

## 概述

本文档说明了知识库回收站功能的后端 API 实现，包括软删除、查询、还原和永久删除功能。

## 实现的 API 端点

### 1. 软删除 API

#### 1.1 软删除分类
- **端点**: `POST /api/knowledge/categories/:id/soft-delete`
- **功能**: 将分类及其下所有文档移至回收站
- **事务处理**: 使用数据库事务确保分类和文档同时删除
- **响应示例**:
```json
{
  "success": true,
  "message": "分类已移至回收站",
  "deletedArticles": 5
}
```

#### 1.2 软删除文档
- **端点**: `POST /api/knowledge/articles/:id/soft-delete`
- **功能**: 将单个文档移至回收站
- **响应示例**:
```json
{
  "success": true,
  "message": "文档已移至回收站"
}
```

### 2. 回收站查询 API

#### 2.1 获取回收站中的分类
- **端点**: `GET /api/knowledge/recycle-bin/categories`
- **查询参数**:
  - `page`: 页码（默认: 1）
  - `pageSize`: 每页数量（默认: 20）
  - `sortBy`: 排序字段（默认: deleted_at）
  - `sortOrder`: 排序方向（默认: desc）
- **功能**:
  - 分页查询回收站中的分类
  - 显示删除时间、删除者、文档数量
  - 支持排序
- **响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "产品知识",
      "icon": "📚",
      "description": "产品相关知识",
      "deleted_at": "2024-11-11 10:30:00",
      "deleted_by": 1,
      "deleted_by_name": "张三",
      "article_count": 5
    }
  ],
  "total": 10,
  "page": 1,
  "pageSize": 20
}
```

#### 2.2 获取回收站中的文档
- **端点**: `GET /api/knowledge/recycle-bin/articles`
- **查询参数**: 同上
- **功能**:
  - 分页查询回收站中的文档
  - 显示删除时间、删除者、分类、作者
  - 支持排序
- **响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "产品使用指南",
      "summary": "详细的产品使用说明",
      "category_id": 1,
      "category_name": "产品知识",
      "deleted_at": "2024-11-11 10:30:00",
      "deleted_by": 1,
      "deleted_by_name": "张三",
      "author_name": "李四"
    }
  ],
  "total": 50,
  "page": 1,
  "pageSize": 20
}
```

### 3. 还原 API

#### 3.1 还原分类
- **端点**: `POST /api/knowledge/recycle-bin/categories/:id/restore`
- **请求体**:
```json
{
  "restoreArticles": true
}
```
- **功能**:
  - 还原分类状态
  - 可选择是否同时还原该分类下的所有文档
  - 使用事务确保数据一致性
- **响应示例**:
```json
{
  "success": true,
  "message": "分类已还原",
  "restoredArticles": 5
}
```

#### 3.2 还原文档
- **端点**: `POST /api/knowledge/recycle-bin/articles/:id/restore`
- **功能**:
  - 还原单个文档
  - 检查分类状态，如果分类也在回收站中则提示
- **响应示例**:
```json
{
  "success": true,
  "message": "文档已还原"
}
```
- **错误响应**（分类也在回收站中）:
```json
{
  "error": "该文档的分类也在回收站中，请先还原分类",
  "needRestoreCategory": true,
  "categoryId": 1
}
```

### 4. 永久删除 API

#### 4.1 永久删除分类
- **端点**: `DELETE /api/knowledge/recycle-bin/categories/:id/permanent`
- **功能**:
  - 从数据库中永久删除分类
  - 同时永久删除该分类下的所有已删除文档
  - 使用事务确保数据一致性
- **响应示例**:
```json
{
  "success": true,
  "message": "分类已永久删除",
  "deletedArticles": 5
}
```

#### 4.2 永久删除文档
- **端点**: `DELETE /api/knowledge/recycle-bin/articles/:id/permanent`
- **功能**: 从数据库中永久删除文档
- **响应示例**:
```json
{
  "success": true,
  "message": "文档已永久删除"
}
```

#### 4.3 清空回收站
- **端点**: `POST /api/knowledge/recycle-bin/empty`
- **请求体**:
```json
{
  "type": "all"
}
```
- **type 参数**:
  - `all`: 清空所有（分类和文档）
  - `categories`: 只清空分类
  - `articles`: 只清空文档
- **功能**:
  - 批量永久删除回收站中的项目
  - 使用事务确保数据一致性
- **响应示例**:
```json
{
  "success": true,
  "message": "回收站已清空",
  "deletedCategories": 3,
  "deletedArticles": 15
}
```

## 数据库字段

### knowledge_categories 表
- `status`: ENUM('active', 'deleted') - 分类状态
- `deleted_at`: DATETIME - 删除时间
- `deleted_by`: INT - 删除者ID

### knowledge_articles 表
- `status`: ENUM('draft', 'published', 'archived', 'deleted') - 文档状态
- `deleted_at`: DATETIME - 删除时间
- `deleted_by`: INT - 删除者ID

## 技术特点

### 1. 事务处理
所有涉及多表操作的 API 都使用数据库事务，确保数据一致性：
- 软删除分类时同时删除文档
- 还原分类时可选择同时还原文档
- 永久删除分类时同时删除文档
- 清空回收站时批量删除

### 2. 软删除机制
- 不直接从数据库删除记录
- 通过 `status` 字段标记为 'deleted'
- 记录删除时间 `deleted_at` 和删除者 `deleted_by`
- 可以随时还原

### 3. 数据完整性检查
- 还原文档时检查分类状态
- 如果分类也在回收站中，提示用户先还原分类
- 防止数据不一致

### 4. 分页和排序
- 回收站查询支持分页
- 支持按删除时间等字段排序
- 提高大数据量下的性能

## 测试

运行测试脚本验证所有 API 功能：

```bash
cd customer-service-desktop
node test-recycle-bin-api.js
```

测试脚本会依次测试：
1. 创建测试分类和文档
2. 软删除文档
3. 查询回收站中的文档
4. 还原文档
5. 软删除分类（包括文档）
6. 查询回收站中的分类
7. 还原分类（包括文档）
8. 永久删除文档
9. 永久删除分类
10. 清空回收站

## 错误处理

所有 API 都包含完善的错误处理：
- 捕获数据库错误
- 事务回滚机制
- 返回详细的错误信息
- 记录错误日志

## 下一步

前端实现：
- 创建回收站模态框组件
- 实现还原和永久删除功能 UI
- 集成到知识文档管理页面
- 添加确认对话框和成功提示

## 相关文档

- [需求文档](.kiro/specs/knowledge-base-enhancements/requirements.md)
- [设计文档](.kiro/specs/knowledge-base-enhancements/design.md)
- [任务列表](.kiro/specs/knowledge-base-enhancements/tasks.md)
