# 更新试卷 API 实现文档

## 概述

实现了 `PUT /api/exams/:id` 接口，用于更新试卷信息。

## API 端点

**URL:** `PUT /api/exams/:id`

**认证:** 需要 Bearer Token

## 功能特性

### 1. 状态验证
- 检查试卷是否存在
- 验证试卷状态，已发布（published）的试卷不允许修改
- 返回 403 错误并提示用户先将状态改为草稿

### 2. 可更新字段
- `title` - 试卷标题（不能为空）
- `description` - 试卷描述（可选）
- `category` - 试卷分类（可选）
- `difficulty` - 难度等级（easy/medium/hard）
- `duration` - 考试时长（分钟，必须大于0）
- `total_score` - 总分（必须大于0）
- `pass_score` - 及格分（必须大于等于0，不能大于总分）

### 3. 不可更新字段
- `question_count` - 题目数量（自动计算）
- `status` - 状态（需要使用专门的状态更新接口）
- `created_by` - 创建人
- `created_at` - 创建时间

### 4. 数据验证
- 标题不能为空
- 难度必须是 easy、medium 或 hard
- 时长必须是大于0的数字
- 总分必须是大于0的数字
- 及格分必须是大于等于0的数字
- 及格分不能大于总分（考虑同时更新的情况）

### 5. 自动更新
- 自动更新 `updated_at` 时间戳为当前时间

## 请求示例

```javascript
PUT /api/exams/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "客服基础知识考试-更新版",
  "description": "更新后的描述",
  "difficulty": "hard",
  "duration": 90,
  "total_score": 150,
  "pass_score": 90
}
```

## 响应示例

### 成功响应 (200)
```json
{
  "success": true,
  "message": "试卷更新成功"
}
```

### 错误响应

#### 未认证 (401)
```json
{
  "success": false,
  "message": "未提供认证令牌"
}
```

#### 试卷不存在 (404)
```json
{
  "success": false,
  "message": "试卷不存在"
}
```

#### 已发布试卷不可修改 (403)
```json
{
  "success": false,
  "message": "已发布的试卷不允许修改，请先将试卷状态改为草稿"
}
```

#### 验证失败 (400)
```json
{
  "success": false,
  "message": "及格分不能大于总分"
}
```

## 实现细节

### 1. 动态字段更新
- 只更新请求中提供的字段
- 使用动态 SQL 构建，避免覆盖未提供的字段
- 如果没有提供任何字段，返回 400 错误

### 2. 及格分验证逻辑
```javascript
// 如果同时更新 total_score 和 pass_score，需要验证关系
const finalTotalScore = total_score !== undefined ? total_score : exam.total_score
if (pass_score > finalTotalScore) {
  return reply.code(400).send({
    success: false,
    message: '及格分不能大于总分'
  })
}
```

### 3. SQL 更新语句
```sql
UPDATE exams
SET title = ?, description = ?, difficulty = ?, duration = ?,
    total_score = ?, pass_score = ?, updated_at = NOW()
WHERE id = ?
```

## 测试

### 测试文件
- `test-update-exam-simple.js` - 基本功能测试
- `test-update-exam-api.js` - 完整测试套件（包含边界情况）

### 运行测试
```bash
# 确保服务器正在运行
node customer-service-desktop/test-update-exam-simple.js
```

### 测试覆盖
- ✅ 更新单个字段
- ✅ 更新多个字段
- ✅ 验证及格分不能大于总分
- ✅ 验证空标题
- ✅ 验证无效难度
- ✅ 验证不存在的试卷
- ✅ 验证未认证请求
- ✅ 验证已发布试卷不能修改

## 安全性

1. **认证检查** - 所有请求必须提供有效的 JWT token
2. **状态保护** - 已发布的试卷不能修改，防止影响正在进行的考试
3. **数据验证** - 严格的输入验证，防止无效数据
4. **SQL 注入防护** - 使用参数化查询

## 后续优化建议

1. **权限控制** - 添加角色权限检查，只有管理员或创建者可以修改
2. **审计日志** - 记录修改历史，包括修改人、修改时间、修改内容
3. **版本控制** - 保存试卷的历史版本
4. **批量更新** - 支持批量更新多个试卷
5. **部分更新优化** - 使用 PATCH 方法支持部分更新

## 相关任务

- ✅ 2.1.3 创建试卷 (POST /api/exams)
- ✅ 2.1.2 获取试卷详情 (GET /api/exams/:id)
- ✅ 2.1.4 更新试卷 (PUT /api/exams/:id)
- ⏳ 2.1.5 删除试卷 (DELETE /api/exams/:id)
- ⏳ 2.1.6 更新试卷状态 (PUT /api/exams/:id/status)

## 更新日期

2024-11-13
