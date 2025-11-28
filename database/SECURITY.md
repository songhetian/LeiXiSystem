# 数据库安全配置指南

## 为什么需要专用数据库账号？

即使 `db-config.json` 在打包后可以被看到，使用**最小权限原则**的专用账号可以大大降低安全风险。

---

## 🔐 安全层级对比

### ❌ 当前配置（高风险）
```json
{
  "user": "tian",  // 可能有管理员权限
  "password": "root"  // 弱密码
}
```

**风险**：
- 如果配置文件泄露，攻击者可能拥有完整数据库控制权
- 可以删除整个数据库
- 可以修改表结构
- 可以创建后门账号

---

### ✅ 推荐配置（低风险）
```json
{
  "user": "leixi_app",  // 专用账号
  "password": "LeiXi@2024!SecurePass"  // 强密码
}
```

**优势**：
- 只有 SELECT, INSERT, UPDATE, DELETE 权限
- 无法删除数据库或表
- 无法修改表结构
- 无法创建新账号
- 即使泄露，损失可控

---

## 📋 配置步骤

### 1. 创建专用数据库账号

在数据库服务器上执行：

```bash
# 使用 root 或管理员账号登录 MySQL
mysql -u root -p

# 执行安全配置脚本
source database/setup-secure-user.sql
```

或者直接执行 SQL：

```sql
-- 创建专用账号
CREATE USER 'leixi_app'@'%' IDENTIFIED BY 'LeiXi@2024!SecurePass';

-- 只授予必要权限
GRANT SELECT, INSERT, UPDATE, DELETE ON leixin_customer_service.* TO 'leixi_app'@'%';

-- 刷新权限
FLUSH PRIVILEGES;
```

### 2. 更新配置文件

修改 `config/db-config.json`：

```json
{
  "database": {
    "host": "192.168.2.3",
    "port": 3306,
    "user": "leixi_app",  // ← 改为专用账号
    "password": "LeiXi@2024!SecurePass",  // ← 改为强密码
    "database": "leixin_customer_service"
  }
}
```

### 3. 测试连接

重启应用，确认可以正常连接数据库。

---

## 🛡️ 进一步的安全加固

### 1. IP 白名单限制

只允许特定 IP 访问数据库：

```sql
-- 删除允许所有IP的账号
DROP USER IF EXISTS 'leixi_app'@'%';

-- 创建只允许特定IP的账号
CREATE USER 'leixi_app'@'192.168.2.3' IDENTIFIED BY 'LeiXi@2024!SecurePass';
GRANT SELECT, INSERT, UPDATE, DELETE ON leixin_customer_service.* TO 'leixi_app'@'192.168.2.3';
FLUSH PRIVILEGES;
```

### 2. 防火墙配置

在数据库服务器上配置防火墙，只允许应用服务器访问 3306 端口：

```bash
# Linux (iptables)
sudo iptables -A INPUT -p tcp -s 192.168.2.3 --dport 3306 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3306 -j DROP

# Windows 防火墙
# 在 Windows 防火墙高级设置中创建入站规则
# 只允许来自 192.168.2.3 的 TCP 3306 连接
```

### 3. 定期更换密码

建议每 3-6 个月更换一次数据库密码：

```sql
ALTER USER 'leixi_app'@'%' IDENTIFIED BY 'NewStrongPassword@2024';
FLUSH PRIVILEGES;
```

### 4. 启用 MySQL 审计日志

记录所有数据库操作，便于安全审计：

```sql
-- 启用审计日志（需要 MySQL Enterprise 或插件）
SET GLOBAL general_log = 'ON';
SET GLOBAL general_log_file = '/var/log/mysql/mysql.log';
```

---

## 📊 权限对比表

| 权限 | 专用账号 (leixi_app) | 管理员账号 (root/tian) | 说明 |
|------|---------------------|----------------------|------|
| SELECT | ✅ | ✅ | 查询数据 |
| INSERT | ✅ | ✅ | 插入数据 |
| UPDATE | ✅ | ✅ | 更新数据 |
| DELETE | ✅ | ✅ | 删除数据 |
| DROP | ❌ | ✅ | 删除表/数据库（危险） |
| CREATE | ❌ | ✅ | 创建表/数据库（危险） |
| ALTER | ❌ | ✅ | 修改表结构（危险） |
| GRANT | ❌ | ✅ | 授权给其他用户（危险） |
| SUPER | ❌ | ✅ | 超级管理员权限（危险） |

---

## ⚠️ 重要提醒

1. **不要在生产环境使用 root 账号**
2. **使用强密码**（至少 12 位，包含大小写字母、数字、特殊字符）
3. **定期审查数据库账号和权限**
4. **启用数据库审计日志**
5. **定期备份数据库**

---

## 🔍 验证权限

执行以下命令验证账号权限：

```sql
SHOW GRANTS FOR 'leixi_app'@'%';
```

应该看到类似输出：
```
GRANT SELECT, INSERT, UPDATE, DELETE ON `leixin_customer_service`.* TO `leixi_app`@`%`
```

如果看到 `ALL PRIVILEGES` 或 `GRANT OPTION`，说明权限过高，需要重新配置。
