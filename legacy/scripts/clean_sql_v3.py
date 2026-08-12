import re

input_file = 'database/migrations/leixin_customer_service_2026-03-06.sql'
output_file = 'database/migrations/init_v2.sql'

def final_clean():
    with open(input_file, 'r', encoding='utf8') as f:
        content = f.read()

    # 1. 正则移除所有 INSERT 语句块 (处理多行 VALUES)
    # 匹配 INSERT INTO ... VALUES 开头到分号结束，包含换行
    content = re.sub(r'INSERT INTO `[^`]+` VALUES.*?;', '', content, flags=re.DOTALL | re.IGNORECASE)
    
    # 2. 移除所有 LOCK TABLES 和 UNLOCK TABLES
    content = re.sub(r'LOCK TABLES `[^`]+` WRITE;', '', content)
    content = re.sub(r'UNLOCK TABLES;', '', content)
    content = re.sub(r'/\*.*?\*/;', '', content) # 移除辅助注释块

    # 3. 清理多余空行
    content = re.sub(r'\n\s*\n', '\n', content)

    # 4. 物理追加核心运行数据 (闭环保障)
    # 强制插入 admin 账号 (密码 123456)
    admin_sql = "\n\n# 核心元数据闭环\n# ------------------------------------------------------------\n"
    admin_sql += "INSERT INTO `users` (`id`, `username`, `password_hash`, `real_name`, `status`, `created_at`) VALUES (1, 'admin', '$2b$10$Gg7I/ImQq/BdLJpaHHVTC.ASi5QcoQg9JymoZJqfaT/O2O.Jz1tQG', '超级管理员', 'active', NOW());\n"
    
    # 这里建议在服务器部署后通过 v2-web 的 db:migrate 或手动补全 roles/permissions
    # 为了保证 100% 成功，我们目前仅保留这一行最关键的账号
    
    with open(output_file, 'w', encoding='utf8') as f:
        f.write(content)
        f.write(admin_sql)

    print(f"✅ 终极结构清洗完成。输出文件: {output_file}")

if __name__ == "__main__":
    final_clean()
