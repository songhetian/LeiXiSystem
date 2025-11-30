# 数据库迁移和测试数据说明

## 目录结构

```
database/
├── migrations/
│   └── 001_init_database.sql          # 数据库初始化脚本（表结构）
└── test-data/
    ├── 01_insert_departments.sql      # 部门测试数据
    ├── 02_insert_roles.sql            # 角色测试数据
    ├── 03_insert_users.sql            # 用户测试数据
    ├── 04_insert_positions.sql        # 职位测试数据
    ├── 05_insert_platforms_shops.sql  # 平台和店铺测试数据
    ├── 06_insert_tag_categories.sql   # 质检标签分类测试数据
    ├── 07_insert_tags.sql             # 质检标签测试数据
    ├── 08_insert_quality_sessions.sql # 质检会话测试数据
    └── 09_insert_session_messages.sql # 质检聊天消息测试数据
```

## 使用说明

### 1. 初始化数据库

首先执行迁移脚本创建数据库表结构：

```bash
mysql -u root -p < database/migrations/001_init_database.sql
```

### 2. 插入测试数据

按照顺序执行测试数据插入脚本：

```bash
# 基础数据
mysql -u root -p leixin_customer_service < database/test-data/01_insert_departments.sql
mysql -u root -p leixin_customer_service < database/test-data/02_insert_roles.sql
mysql -u root -p leixin_customer_service < database/test-data/03_insert_users.sql
mysql -u root -p leixin_customer_service < database/test-data/04_insert_positions.sql

# 平台数据
mysql -u root -p leixin_customer_service < database/test-data/05_insert_platforms_shops.sql

# 质检标签数据
mysql -u root -p leixin_customer_service < database/test-data/06_insert_tag_categories.sql
mysql -u root -p leixin_customer_service < database/test-data/07_insert_tags.sql

# 质检业务数据
mysql -u root -p leixin_customer_service < database/test-data/08_insert_quality_sessions.sql
mysql -u root -p leixin_customer_service < database/test-data/09_insert_session_messages.sql
```

### 3. 一键执行所有脚本

在Windows PowerShell中执行：

```powershell
# 初始化数据库
Get-Content database\migrations\001_init_database.sql | mysql -u root -p

# 插入测试数据
Get-ChildItem database\test-data\*.sql | Sort-Object Name | ForEach-Object {
    Write-Host "执行: $($_.Name)"
    Get-Content $_.FullName | mysql -u root -p leixin_customer_service
}
```

## 数据库表说明

### 基础表

| 表名 | 说明 | 记录数 |
|------|------|--------|
| departments | 部门表 | 5 |
| users | 用户表 | 8 |
| roles | 角色表 | 5 |
| permissions | 权限表 | 0（需手动添加）|
| positions | 职位表 | 12 |
| employees | 员工表 | 8 |

### 平台相关表

| 表名 | 说明 | 记录数 |
|------|------|--------|
| platforms | 平台表 | 3 |
| shops | 店铺表 | 7 |
| customers | 客户表 | 0（由业务产生）|

### 质检标签表

| 表名 | 说明 | 记录数 |
|------|------|--------|
| tag_categories | 标签分类表 | 13（5个一级分类 + 8个二级分类）|
| tags | 标签表 | 21 |

### 质检业务表

| 表名 | 说明 | 记录数 |
|------|------|--------|
| quality_rules | 质检规则表 | 3 |
| quality_sessions | 质检会话表 | 10 |
| quality_scores | 质检评分表 | 15 |
| session_messages | 会话消息表 | 56 |
| quality_session_tags | 会话标签关联表 | 0（需手动关联）|
| quality_message_tags | 消息标签关联表 | 0（需手动关联）|

## 测试账号

| 用户名 | 密码 | 角色 | 部门 | 说明 |
|--------|------|------|------|------|
| admin | 123456 | 超级管理员 | 管理部 | 系统管理员 |
| manager1 | 123456 | 部门经理 | 客服部 | 客服部经理 |
| service1 | 123456 | 客服专员 | 客服部 | 高级客服专员 |
| service2 | 123456 | 客服专员 | 客服部 | 客服专员 |
| service3 | 123456 | 客服专员 | 客服部 | 客服专员 |
| qa1 | 123456 | 质检员 | 质检部 | 质检专员 |
| qa2 | 123456 | 质检员 | 质检部 | 质检专员 |
| tech1 | 123456 | 技术人员 | 技术部 | 系统工程师 |

## 质检会话数据说明

测试数据包含10个质检会话：

- **已完成质检（5个）**: QS20251130001 ~ QS20251130005
  - 包含完整的评分数据
  - 包含聊天消息记录
  - 覆盖不同渠道（chat, phone, email）

- **待质检（2个）**: QS20251201001 ~ QS20251201002
  - 未评分
  - 可用于测试质检流程

- **质检中（3个）**: QS20251201003 ~ QS20251201005
  - 已分配质检员
  - 未完成评分
  - 可用于测试质检进度

## 注意事项

1. **密码加密**: 测试数据中的密码使用bcrypt加密，实际密码为 `123456`
2. **数据依赖**: 必须按照文件编号顺序执行，因为存在外键依赖关系
3. **数据清理**: 每个测试数据脚本都会先清理已存在的测试数据
4. **生产环境**: 这些是测试数据，生产环境请勿使用

## 数据库配置

确保数据库配置正确：

```json
{
  "host": "localhost",
  "port": 3306,
  "user": "root",
  "password": "your_password",
  "database": "leixin_customer_service"
}
```

## 常见问题

### Q: 执行脚本时出现外键约束错误？
A: 确保按照编号顺序执行脚本，先执行基础数据（部门、角色、用户），再执行业务数据。

### Q: 如何重置数据库？
A: 重新执行 `001_init_database.sql` 会删除所有表并重新创建。

### Q: 如何只重置测试数据？
A: 每个测试数据脚本都包含DELETE语句，可以单独重新执行。

### Q: 密码如何加密？
A: 使用bcrypt算法，可以使用Node.js的bcrypt库生成：
```javascript
const bcrypt = require('bcrypt');
const hash = bcrypt.hashSync('123456', 10);
```

## 更新日志

- **2025-11-30**: 初始版本
  - 创建完整的数据库表结构
  - 添加基础测试数据
  - 添加质检业务测试数据
