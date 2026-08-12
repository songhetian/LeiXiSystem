import re

input_file = 'database/migrations/leixin_customer_service_2026-03-06.sql'
output_file = 'database/migrations/init_v2.sql'

# 强力保留名单 (必须带 INSERT 数据)
KEEP_DATA_TABLES = {
    'roles', 'permissions', 'role_permissions', 'user_roles', 
    'departments', 'positions', 'asset_categories', 'asset_device_forms',
    'asset_component_types', 'asset_models', 'work_shifts', 'vacation_types',
    'vacation_settings', 'attendance_settings', 'notification_settings',
    'conversion_rules', 'case_categories', 'exam_categories', 
    'knowledge_categories', 'platforms', 'shops', 'menu_categories',
    'reimbursement_types'
}

def force_clean():
    with open(input_file, 'r', encoding='utf8') as f:
        lines = f.readlines()

    clean_lines = []
    current_table = None
    in_insert = False

    for line in lines:
        # 1. 识别当前表
        table_match = re.search(r'# 转储表 (\w+)', line)
        if table_match:
            current_table = table_match.group(1)
            in_insert = False
        
        # 2. 处理 INSERT 语句块
        if line.startswith('INSERT INTO'):
            in_insert = True
            # 特殊处理核心元数据
            if current_table in KEEP_DATA_TABLES:
                clean_lines.append(line)
                continue
            # 特殊处理 users 表 (只留 admin)
            if current_table == 'users':
                # 这里我们寻找 admin 的完整行
                if "'admin'" in line:
                    # 如果这一行包含 admin，物理保留这一整行
                    clean_lines.append(line)
                continue
            # 其他表一律物理忽略 INSERT
            continue
        
        # 3. 如果在 INSERT 块中（后续行），根据当前表决定是否保留
        if in_insert and not line.startswith('INSERT'):
            # 如果是分号结尾，标记块结束
            if ';' in line:
                in_insert = False
                if current_table in KEEP_DATA_TABLES or (current_table == 'users' and "'admin'" in line):
                    clean_lines.append(line)
                continue
            # 还在数据行中
            if current_table in KEEP_DATA_TABLES:
                clean_lines.append(line)
            continue

        # 4. 忽略 LOCK TABLES 相关的辅助语句（非核心元数据表）
        if any(x in line for x in ['LOCK TABLES', 'UNLOCK TABLES', 'ALTER TABLE', 'DISABLE KEYS', 'ENABLE KEYS']):
            if current_table not in KEEP_DATA_TABLES and current_table != 'users':
                continue

        # 5. 保留所有 DDL 结构和其他注释
        clean_lines.append(line)

    with open(output_file, 'w', encoding='utf8') as f:
        f.writelines(clean_lines)

    print(f"✅ 精准清洗完成。输出文件: {output_file}")

if __name__ == "__main__":
    force_clean()
