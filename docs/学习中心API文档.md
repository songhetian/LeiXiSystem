# 学习中心 API 文档

## 概述

学习中心 API 提供了完整的个人学习管理功能，包括学习任务、学习计划和学习统计等。

## API 端点

所有学习中心 API 端点都以 `/api/learning-center` 为前缀。

### 学习任务

#### GET /api/learning-center/tasks

获取学习任务列表

**请求参数**
- `status` (可选): 任务状态筛选 (pending, in_progress, completed, cancelled)

**响应格式**
```json
[
  {
    "id": 1,
    "title": "学习新功能",
    "description": "学习并掌握新功能的使用方法",
    "assigned_to": 1,
    "assigned_by": 1,
    "status": "pending",
    "priority": "medium",
    "due_date": "2024-12-31T00:00:00.000Z",
    "completed_at": null,
    "created_at": "2024-11-16T10:00:00.000Z",
    "updated_at": "2024-11-16T10:00:00.000Z",
    "assigned_to_name": "张三",
    "assigned_by_name": "张三"
  }
]
```

#### POST /api/learning-center/tasks

创建学习任务

**请求体**
```json
{
  "title": "学习新功能",
  "description": "学习并掌握新功能的使用方法",
  "priority": "medium",
  "due_date": "2024-12-31"
}
```

**响应格式**
```json
{
  "success": true,
  "message": "任务创建成功",
  "data": {
    "id": 1,
    "title": "学习新功能",
    "description": "学习并掌握新功能的使用方法",
    "assigned_to": 1,
    "assigned_by": 1,
    "status": "pending",
    "priority": "medium",
    "due_date": "2024-12-31T00:00:00.000Z",
    "completed_at": null,
    "created_at": "2024-11-16T10:00:00.000Z",
    "updated_at": "2024-11-16T10:00:00.000Z"
  }
}
```

#### PUT /api/learning-center/tasks/:id

更新学习任务

**请求体**
```json
{
  "title": "更新后的任务标题",
  "description": "更新后的任务描述",
  "priority": "high",
  "due_date": "2024-12-31",
  "status": "completed"
}
```

**响应格式**
```json
{
  "success": true,
  "message": "任务更新成功",
  "data": {
    "id": 1,
    "title": "更新后的任务标题",
    "description": "更新后的任务描述",
    "assigned_to": 1,
    "assigned_by": 1,
    "status": "completed",
    "priority": "high",
    "due_date": "2024-12-31T00:00:00.000Z",
    "completed_at": "2024-11-16T11:00:00.000Z",
    "created_at": "2024-11-16T10:00:00.000Z",
    "updated_at": "2024-11-16T11:00:00.000Z"
  }
}
```

#### DELETE /api/learning-center/tasks/:id

删除学习任务

**响应格式**
```json
{
  "success": true,
  "message": "任务已删除"
}
```

### 学习计划

#### GET /api/learning-center/plans

获取学习计划列表

**请求参数**
- `status` (可选): 计划状态筛选 (draft, active, completed, cancelled)

**响应格式**
```json
[
  {
    "id": 1,
    "title": "月度学习计划",
    "description": "本月需要完成的学习任务",
    "created_by": 1,
    "assigned_to": null,
    "department_id": null,
    "status": "active",
    "start_date": "2024-11-01T00:00:00.000Z",
    "end_date": "2024-11-30T00:00:00.000Z",
    "completed_at": null,
    "created_at": "2024-11-01T10:00:00.000Z",
    "updated_at": "2024-11-01T10:00:00.000Z",
    "created_by_name": "张三"
  }
]
```

#### POST /api/learning-center/plans

创建学习计划

**请求体**
```json
{
  "title": "月度学习计划",
  "description": "本月需要完成的学习任务",
  "start_date": "2024-11-01",
  "end_date": "2024-11-30"
}
```

**响应格式**
```json
{
  "success": true,
  "message": "学习计划创建成功",
  "data": {
    "id": 1,
    "title": "月度学习计划",
    "description": "本月需要完成的学习任务",
    "created_by": 1,
    "assigned_to": null,
    "department_id": null,
    "status": "draft",
    "start_date": "2024-11-01T00:00:00.000Z",
    "end_date": "2024-11-30T00:00:00.000Z",
    "completed_at": null,
    "created_at": "2024-11-01T10:00:00.000Z",
    "updated_at": "2024-11-01T10:00:00.000Z"
  }
}
```

#### GET /api/learning-center/plans/:id

获取学习计划详情

**响应格式**
```json
{
  "id": 1,
  "title": "月度学习计划",
  "description": "本月需要完成的学习任务",
  "created_by": 1,
  "assigned_to": null,
  "department_id": null,
  "status": "active",
  "start_date": "2024-11-01T00:00:00.000Z",
  "end_date": "2024-11-30T00:00:00.000Z",
  "completed_at": null,
  "created_at": "2024-11-01T10:00:00.000Z",
  "updated_at": "2024-11-01T10:00:00.000Z",
  "created_by_name": "张三",
  "details": [
    {
      "id": 1,
      "plan_id": 1,
      "article_id": 1,
      "exam_id": null,
      "title": "学习新功能",
      "description": "学习并掌握新功能的使用方法",
      "order_num": 1,
      "status": "pending",
      "completed_at": null,
      "created_at": "2024-11-01T10:00:00.000Z",
      "updated_at": "2024-11-01T10:00:00.000Z"
    }
  ]
}
```

#### PUT /api/learning-center/plans/:id

更新学习计划

**请求体**
```json
{
  "title": "更新后的学习计划",
  "description": "更新后的计划描述",
  "start_date": "2024-11-01",
  "end_date": "2024-11-30",
  "status": "completed"
}
```

**响应格式**
```json
{
  "success": true,
  "message": "学习计划更新成功",
  "data": {
    "id": 1,
    "title": "更新后的学习计划",
    "description": "更新后的计划描述",
    "created_by": 1,
    "assigned_to": null,
    "department_id": null,
    "status": "completed",
    "start_date": "2024-11-01T00:00:00.000Z",
    "end_date": "2024-11-30T00:00:00.000Z",
    "completed_at": "2024-11-16T11:00:00.000Z",
    "created_at": "2024-11-01T10:00:00.000Z",
    "updated_at": "2024-11-16T11:00:00.000Z"
  }
}
```

#### DELETE /api/learning-center/plans/:id

删除学习计划

**响应格式**
```json
{
  "success": true,
  "message": "学习计划已删除"
}
```

### 学习统计

#### GET /api/learning-center/statistics

获取学习统计

**请求参数**
- `time_range` (可选): 时间范围 (week, month, year)，默认为 week

**响应格式**
```json
{
  "totalTasks": 15,
  "completedTasks": 12,
  "totalPlans": 3,
  "completedPlans": 1,
  "articlesRead": 28,
  "examsTaken": 5,
  "examsPassed": 4,
  "totalDuration": 72000
}
```

## 错误处理

所有 API 错误都会返回以下格式的响应：

```json
{
  "error": "错误描述"
}
```

或者

```json
{
  "success": false,
  "message": "错误描述"
}
```

## 认证

所有 API 端点都需要通过 JWT Token 进行认证。在请求头中添加：

```
Authorization: Bearer <token>
```

## 使用示例

### 获取学习任务列表
```javascript
const response = await fetch('http://localhost:3001/api/learning-center/tasks', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const tasks = await response.json();
```

### 创建学习任务
```javascript
const response = await fetch('http://localhost:3001/api/learning-center/tasks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: '新任务',
    description: '任务描述',
    priority: 'medium',
    due_date: '2024-12-31'
  })
});
const result = await response.json();
```

### 更新学习任务
```javascript
const response = await fetch('http://localhost:3001/api/learning-center/tasks/1', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'completed'
  })
});
const result = await response.json();
```
