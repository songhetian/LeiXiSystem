import re

input_file = 'database/migrations/leixin_customer_service_2026-03-06.sql'
output_file = 'database/migrations/init_v2.sql'

def ultimate_clean():
    with open(input_file, 'r', encoding='utf8') as f:
        lines = f.readlines()

    clean_lines = [
        "SET NAMES utf8mb4;\n",
        "SET FOREIGN_KEY_CHECKS = 0;\n\n"
    ]
    
    current_table = None
    in_insert = False

    for line in lines:
        # 1. 过滤掉所有 INSERT、LOCK、UNLOCK 语句
        if line.startswith('INSERT INTO') or 'VALUES' in line:
            continue
        if any(x in line for x in ['LOCK TABLES', 'UNLOCK TABLES', 'DISABLE KEYS', 'ENABLE KEYS']):
            continue
        # 2. 保留 DDL 结构 (CREATE, DROP, ALTER)
        clean_lines.append(line)

    # 3. 物理注入唯一的初始化数据 (超级管理员 admin/123456)
    clean_lines.append("\n\n# 系统初始化闭环存证\n# ------------------------------------------------------------\n")
    clean_lines.append("INSERT INTO `users` (`id`, `username`, `password_hash`, `real_name`, `status`, `created_at`) VALUES (1, 'admin', '$2b$10$Gg7I/ImQq/BdLJpaHHVTC.ASi5QcoQg9JymoZJqfaT/O2O.Jz1tQG', '超级管理员', 'active', NOW());\n")
    
    # 物理恢复外键检查
    clean_lines.append("\nSET FOREIGN_KEY_CHECKS = 1;\n")

    with open(output_file, 'w', encoding='utf8') as f:
        f.writelines(clean_lines)

    print(f"✅ 最终全闭环重构完成。输出文件: {output_file}")

if __name__ == "__main__":
    ultimate_clean()
