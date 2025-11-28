# 数据库迁移说明

## 纯净数据库初始化

本目录包含一个纯净版的数据库初始化 SQL 文件，用于快速部署生产环境。

### 文件说明

- **001_init_clean_database.sql** - 纯净数据库初始化脚本
  - 包含所有 97 个表的完整结构
  - 仅包含一个超级管理员账号
  - 无测试数据，适合生产环境部署

### 超级管理员账号

初始化后会自动创建一个超级管理员账号：

- **用户名**: `admin`
- **密码**: `admin123`
- **角色**: 超级管理员（拥有所有权限）

⚠️ **重要**: 首次登录后请立即修改密码！

### 使用方法

#### 方法一：使用 npm 脚本（推荐）

```bash
# 执行数据库迁移
npm run db:migrate
```

这个命令会自动执行 `database/migrations` 目录下的所有 SQL 文件。

#### 方法二：手动执行

```bash
# 使用 MySQL 命令行
mysql -u your_username -p < database/migrations/001_init_clean_database.sql

# 或者使用 Node.js 脚本
node scripts/run-migrations.js
```

### 数据库信息

- **数据库名**: `leixin_customer_service`
- **字符集**: `utf8mb4`
- **排序规则**: `utf8mb4_unicode_ci`
- **表数量**: 97 个

### 表结构概览

数据库包含以下主要功能模块的表：

1. **用户与权限**
   - users, employees, departments
   - roles, permissions, user_roles, role_permissions
   - role_departments

2. **考勤管理**
   - attendance_records, attendance_rules, attendance_settings
   - leave_records, overtime_records, makeup_records
   - holidays, vacation_types, vacation_balances

3. **考核系统**
   - exams, exam_categories, questions
   - assessment_plans, assessment_results, answer_records

4. **知识库**
   - knowledge_articles, knowledge_categories
   - article_comments, article_likes
   - knowledge_learning_plans, learning_statistics

5. **质检系统**
   - quality_sessions, quality_scores, quality_rules
   - quality_cases, case_comments, case_tags

6. **消息系统**
   - messages, conversations, groups
   - notifications, message_status

7. **排班管理**
   - shifts, schedules, shift_schedules
   - work_shifts

8. **其他**
   - platforms, shops, positions
   - tags, tag_categories

### 注意事项

1. **数据库权限**: 确保 MySQL 用户有创建数据库和表的权限
2. **字符集**: 使用 utf8mb4 以支持 emoji 和特殊字符
3. **外键约束**: 已启用外键约束，删除数据时会级联删除相关数据
4. **索引优化**: 所有表都已添加适当的索引以提升查询性能

### 重新生成 SQL 文件

如果需要根据当前数据库重新生成纯净 SQL 文件：

```bash
node scripts/generate-clean-sql.js
```

这将会：
1. 连接到当前数据库
2. 导出所有表结构
3. 生成新的 `001_init_clean_database.sql` 文件
4. 包含超级管理员账号

### 故障排除

**问题**: 执行 SQL 时报错 "Table already exists"

**解决**: SQL 文件会自动删除已存在的表，但如果有外键约束问题，请先手动删除数据库：

```sql
DROP DATABASE IF EXISTS leixin_customer_service;
```

然后重新执行初始化脚本。

**问题**: 无法登录管理员账号

**解决**: 确认密码是 `admin123`，如果仍无法登录，可以手动重置密码：

```sql
UPDATE users
SET password_hash = '$2b$10$ya3vuqq/jDVDl20Lir84N.3rjxwKgcq25aWJpaZstEkttcRApbFRm'
WHERE username = 'admin';
```

### 生产环境部署建议

1. **备份**: 部署前务必备份现有数据库
2. **测试**: 先在测试环境验证 SQL 文件
3. **权限**: 使用专用数据库用户，不要使用 root
4. **安全**: 部署后立即修改管理员密码
5. **监控**: 配置数据库监控和日志

### 更新日志

- **2025-11-25**: 初始版本，包含 97 个表结构和超级管理员账号
- **2025-11-28**: 重新生成 `001_init_clean_database.sql`，包含所有最新表结构（含假期余额表）
