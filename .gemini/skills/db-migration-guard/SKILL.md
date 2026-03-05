name: db-migration-guard
description: 【强制执行】数据库变更自动化同步。任何对数据库结构的修改（ALTER, CREATE, DROP）必须立即触发此技能，将 SQL 语句追加到 database/migrations/update.sql 中。这是确保生产环境一致性的核心红线。

# Database Migration Guard (High Priority)

## 强制性触发准则
**本技能属于“自动触发”类别。** 只要检测到执行了 DDL（数据定义语言）操作，必须在命令成功后立即执行以下记录流程，无需用户再次提醒。

## 核心流程
1.  **即时捕获**: 在 `run_shell_command` 执行 SQL 修改成功后，立即提取该 SQL 语句。
2.  **增量追加**: 将语句追加至 `database/migrations/update.sql` 末尾。
3.  **标准化注释**: 必须包含时间戳和变更简述。
4.  **幂等性保证**: 确保 `update.sql` 文件始终存在且内容持续增长。

## 记录格式
```sql
-- [YYYY-MM-DD HH:mm:ss] 自动记录：<变更描述>
ALTER TABLE ...;
```

## 注意事项

- 不要记录具体的 DML 数据操作（如 INSERT INTO 业务数据），仅记录 DDL 结构变更。
- 确保 SQL 语句以分号 `;` 结尾。
- 优先保持 update.sql 的增量记录，不要清空历史记录。
