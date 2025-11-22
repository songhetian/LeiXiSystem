# 数据库部署说明

## 文件说明

- **leixin_customer_service_complete.sql** - 完整的数据库导出文件
  - 包含所有表结构
  - 包含测试数据
  - 文件大小: 294KB
  - 总行数: 3487行
  - 导出时间: 2025-11-21

## 快速部署

### 方法一:使用 MySQL 命令行

```bash
mysql -u root -p < database/leixin_customer_service_complete.sql
```

### 方法二:使用 MySQL Workbench

1. 打开 MySQL Workbench
2. 连接到你的 MySQL 服务器
3. 选择 File > Run SQL Script
4. 选择 `leixin_customer_service_complete.sql` 文件
5. 点击 Run

### 方法三:使用 phpMyAdmin

1. 登录 phpMyAdmin
2. 点击 "Import" 标签
3. 选择 `leixin_customer_service_complete.sql` 文件
4. 点击 "Go"

## 数据库信息

- **数据库名称**: `leixin_customer_service`
- **字符集**: utf8mb4
- **排序规则**: utf8mb4_unicode_ci
- **MySQL 版本**: 8.0.43+

## 包含的表 (部分列表)

### 核心业务表
- `users` - 用户表
- `employees` - 员工表
- `departments` - 部门表
- `positions` - 职位表

### 考勤管理
- `attendance_records` - 考勤记录
- `attendance_settings` - 考勤设置
- `leave_requests` - 请假申请
- `overtime_requests` - 加班申请
- `shifts` - 班次管理
- `schedules` - 排班表

### 假期管理
- `vacation_balances` - 假期余额
- `compensatory_leave_requests` - 调休申请
- `vacation_settings` - 假期设置
- `holidays` - 节假日设置

### 质检系统
- `quality_sessions` - 质检会话
- `quality_rules` - 质检规则
- `quality_scores` - 质检评分
- `quality_cases` - 质检案例
- `platforms` - 平台管理
- `shops` - 店铺管理

### 知识库
- `knowledge_articles` - 知识文章
- `knowledge_folders` - 知识文件夹
- `article_comments` - 文章评论
- `article_likes` - 文章点赞

### 考核系统
- `exams` - 试卷表
- `questions` - 题目表
- `assessment_plans` - 考核计划
- `assessment_results` - 考核结果
- `answer_records` - 答题记录

### 通知系统
- `notifications` - 通知表
- `notification_recipients` - 通知接收者
- `user_notification_settings` - 通知设置

### 权限系统
- `roles` - 角色表
- `permissions` - 权限表
- `role_permissions` - 角色权限关联
- `user_roles` - 用户角色关联

## 测试数据说明

导出文件包含以下测试数据:

- **用户**: 多个测试用户账号
- **部门**: 总经理办公室、人事部、客服部、技术部、财务部、市场部、销售部
- **考勤记录**: 近期的考勤打卡数据
- **考核计划**: 多个考核计划示例
- **知识文章**: 部分测试文章

## 注意事项

1. **备份现有数据**: 导入前请备份现有数据库
2. **权限检查**: 确保 MySQL 用户有 CREATE DATABASE 权限
3. **字符集**: 确保 MySQL 服务器支持 utf8mb4 字符集
4. **版本兼容**: 建议使用 MySQL 8.0+ 版本

## 环境配置

导入数据库后,请配置 `.env` 文件:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=leixin_customer_service
```

## 默认登录账号

请查看数据库中的 `users` 表获取测试账号信息。

## 故障排除

### 导入失败

如果导入失败,请检查:
1. MySQL 服务是否正常运行
2. 用户权限是否足够
3. 磁盘空间是否充足
4. 字符集设置是否正确

### 字符集问题

如果出现乱码,请确保:
```sql
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
```

## 更新日志

- 2025-11-21: 初始版本,包含完整数据库结构和测试数据
