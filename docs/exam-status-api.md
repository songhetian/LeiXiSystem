# 试卷状态更新 API 文档

## 接口信息

**接口路径:** `PUT /api/exams/:id/status`

**功能描述:** 更新试卷的状态，支持草稿、发布和归档之间的状态转换

**认证要求:** 需要 Bearer Token 认证

## 请求参数

### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | Integer | 是 | 试卷ID |

### 请求体参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| status | String | 是 | 目标状态，可选值：`draft`、`published`、`archived` |

## 状态转换规则

系统支持以下状态转换：

1. **draft → published** (草稿 → 发布)
   - 要求：试卷必须至少包含一道题目
   - 要求：试卷总分必须与题目分值总和匹配

2. **published → archived** (发布 → 归档)
   - 无特殊要求

3. **archived → published** (归档 → 发布)
   - 要求：试卷必须至少包含一道题目
   - 要求：试卷总分必须与题目分值总和匹配

### 不允许的状态转换

- draft → archived
- published → draft
- archived → draft

## 请求示例

### 发布试卷

```bash
curl -X PUT http://localhost:3000/api/exams/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'
```

### 归档试卷

```bash
curl -X PUT http://localhost:3000/api/exams/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "archived"}'
```

## 响应示例

### 成功响应

**HTTP 状态码:** 200

```json
{
  "success": true,
  "message": "试卷状态已更新为 published",
  "data": {
    "exam_id": 1,
    "exam_title": "客服基础知识测试",
    "previous_status": "draft",
    "new_status": "published",
    "updated_by": 1,
    "updated_at": "2024-11-13T10:30:00.000Z"
  }
}
```

### 错误响应

#### 1. 试卷不存在

**HTTP 状态码:** 404

```json
{
  "success": false,
  "message": "试卷不存在"
}
```

#### 2. 无效的状态值

**HTTP 状态码:** 400

```json
{
  "success": false,
  "message": "无效的状态值，必须是 draft, published 或 archived"
}
```

#### 3. 不允许的状态转换

**HTTP 状态码:** 400

```json
{
  "success": false,
  "message": "不允许从 published 状态转换到 draft 状态",
  "data": {
    "current_status": "published",
    "requested_status": "draft",
    "allowed_transitions": ["archived"]
  }
}
```

#### 4. 发布验证失败 - 没有题目

**HTTP 状态码:** 400

```json
{
  "success": false,
  "message": "无法发布试卷：试卷必须至少包含一道题目",
  "data": {
    "question_count": 0
  }
}
```

#### 5. 发布验证失败 - 总分不匹配

**HTTP 状态码:** 400

```json
{
  "success": false,
  "message": "无法发布试卷：试卷总分与题目分值总和不匹配",
  "data": {
    "exam_total_score": 100,
    "calculated_total_score": 85,
    "difference": 15
  }
}
```

#### 6. 未授权

**HTTP 状态码:** 401

```json
{
  "success": false,
  "message": "未提供认证令牌"
}
```

## 状态变更日志

每次状态变更都会在服务器日志中记录，格式如下：

```
[Exam Status Change] Exam ID: 1, Title: "客服基础知识测试", User: 1, From: draft, To: published, Time: 2024-11-13T10:30:00.000Z
```

## 测试脚本

项目提供了完整的测试脚本，位于 `customer-service-desktop/test-exam-status-api.js`

运行测试：

```bash
cd customer-service-desktop
node test-exam-status-api.js
```

测试脚本会自动执行以下测试场景：

1. 创建测试试卷（draft 状态）
2. 尝试发布没有题目的试卷（预期失败）
3. 添加题目后发布试卷（预期成功）
4. 尝试从 published 转为 draft（预期失败）
5. 归档试卷（预期成功）
6. 从 archived 重新发布（预期成功）
7. 测试无效的状态值（预期失败）
8. 清理测试数据

## 注意事项

1. **发布前验证**
   - 发布试卷前，系统会自动验证题目数量和总分
   - 如果验证失败，需要先修正问题再发布

2. **状态转换限制**
   - 已发布的试卷不能直接改回草稿状态
   - 如需修改已发布的试卷，应先归档，修改后重新发布

3. **权限控制**
   - 所有状态更新操作都需要认证
   - 建议只允许管理员执行状态更新操作

4. **日志记录**
   - 所有状态变更都会记录在服务器日志中
   - 包含操作用户、时间、前后状态等信息

## 相关接口

- `POST /api/exams` - 创建试卷
- `PUT /api/exams/:id` - 更新试卷信息
- `GET /api/exams/:id` - 获取试卷详情
- `DELETE /api/exams/:id` - 删除试卷
