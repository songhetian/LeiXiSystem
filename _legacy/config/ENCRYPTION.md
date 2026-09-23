# 配置文件加密使用指南

## 📋 概述

为了提高安全性，我们提供了配置文件加密功能。加密后的配置文件即使被他人获取，也无法直接读取其中的敏感信息（如数据库密码）。

---

## 🔐 加密原理

- **加密算法**: AES-256-GCM（高强度对称加密）
- **密钥长度**: 256位
- **认证加密**: 包含完整性验证，防止篡改

---

## 🚀 使用方法

### 1. 加密配置文件

```bash
# 加密 db-config.json
node scripts/encrypt-config.js
```

这将生成 `config/db-config.encrypted.json` 文件，内容类似：

```json
{
  "encrypted": "a1b2c3d4e5f6...",
  "iv": "1234567890abcdef...",
  "authTag": "fedcba0987654321..."
}
```

### 2. 替换配置文件

```bash
# 备份原始配置
cp config/db-config.json config/db-config.backup.json

# 使用加密配置
mv config/db-config.encrypted.json config/db-config.json

# 删除备份（可选，建议保留在安全位置）
# rm config/db-config.backup.json
```

### 3. 启动应用

应用会自动检测配置文件是否加密，并自动解密：

```bash
npm run server
```

输出示例：
```
尝试加载数据库配置: D:\...\config\db-config.json
🔓 检测到加密配置，正在解密...
✅ 数据库初始化成功
```

---

## 🔧 解密配置文件（仅用于调试）

如果需要查看或编辑加密的配置：

```bash
# 解密配置文件
node scripts/decrypt-config.js
```

这将生成 `config/db-config.decrypted.json`，您可以编辑后重新加密。

---

## 🔑 自定义加密密钥（推荐）

默认情况下，加密使用内置密钥。为了提高安全性，建议设置自定义密钥：

### Windows (PowerShell)
```powershell
$env:CONFIG_ENCRYPTION_KEY = "YourCustomSecretKey123!@#"
node scripts/encrypt-config.js
```

### Linux/Mac
```bash
export CONFIG_ENCRYPTION_KEY="YourCustomSecretKey123!@#"
node scripts/encrypt-config.js
```

### 永久设置（生产环境）

**Windows:**
```powershell
# 系统环境变量
[System.Environment]::SetEnvironmentVariable('CONFIG_ENCRYPTION_KEY', 'YourKey', 'Machine')
```

**Linux:**
```bash
# 添加到 /etc/environment
echo 'CONFIG_ENCRYPTION_KEY="YourKey"' | sudo tee -a /etc/environment
```

---

## 📊 安全性对比

| 方案 | 明文可见 | Git泄露风险 | 打包泄露风险 | 安全等级 |
|------|---------|-----------|------------|---------|
| 明文配置 | ✅ | 🔴 高 | 🔴 高 | ⭐ |
| .gitignore | ✅ | 🟢 低 | 🔴 高 | ⭐⭐ |
| 最小权限账号 | ✅ | 🟡 中 | 🟡 中 | ⭐⭐⭐ |
| 加密配置 | ❌ | 🟢 低 | 🟢 低 | ⭐⭐⭐⭐ |
| 加密+自定义密钥 | ❌ | 🟢 低 | 🟢 低 | ⭐⭐⭐⭐⭐ |

---

## ⚠️ 重要提醒

### 1. 密钥管理

- ❌ **不要**将加密密钥提交到代码仓库
- ✅ **应该**使用环境变量存储密钥
- ✅ **应该**在不同环境使用不同密钥

### 2. 备份

- ✅ 加密前备份原始配置文件
- ✅ 将备份存储在安全位置（不要提交到Git）

### 3. 密钥丢失

如果丢失加密密钥，**无法恢复**加密的配置文件！请务必：
- 备份原始配置文件
- 记录加密密钥

---

## 🔄 完整工作流程

### 开发环境

```bash
# 1. 编辑明文配置
vim config/db-config.json

# 2. 测试
npm run dev

# 3. 加密配置（部署前）
node scripts/encrypt-config.js
```

### 生产环境

```bash
# 1. 设置加密密钥
export CONFIG_ENCRYPTION_KEY="ProductionSecretKey"

# 2. 部署加密的配置文件
# 只部署 db-config.json（已加密），不部署 .backup 文件

# 3. 启动应用
npm run prod:server
```

### 打包应用

```bash
# 1. 加密配置
node scripts/encrypt-config.js

# 2. 替换配置
mv config/db-config.encrypted.json config/db-config.json

# 3. 打包
npm run package:win

# 打包后的应用会自动解密配置
```

---

## 🛡️ 多层安全防护建议

结合多种安全措施，达到最佳安全效果：

1. ✅ **配置文件加密** - 防止明文泄露
2. ✅ **自定义加密密钥** - 提高破解难度
3. ✅ **最小权限数据库账号** - 限制损失范围
4. ✅ **IP白名单** - 限制访问来源
5. ✅ **强密码** - 防止暴力破解
6. ✅ **.gitignore** - 防止代码仓库泄露

---

## 🔍 验证加密

查看加密后的配置文件：

```bash
cat config/db-config.json
```

应该看到类似内容：
```json
{
  "encrypted": "f3a8b2c1d4e5...",
  "iv": "9876543210fedcba...",
  "authTag": "abcdef1234567890..."
}
```

而不是明文的数据库密码。

---

## 📞 故障排除

### 问题1: 解密失败

**错误**: `❌ 配置解密失败`

**原因**:
- 加密密钥不正确
- 配置文件已损坏

**解决**:
```bash
# 使用备份恢复
cp config/db-config.backup.json config/db-config.json

# 或重新加密
node scripts/encrypt-config.js
```

### 问题2: 应用无法启动

**错误**: `数据库连接失败`

**原因**: 配置解密后数据不正确

**解决**:
```bash
# 解密查看配置
node scripts/decrypt-config.js

# 检查解密后的配置是否正确
cat config/db-config.decrypted.json
```

---

## 📚 相关文件

- `server/utils/config-crypto.js` - 加密/解密核心代码
- `scripts/encrypt-config.js` - 加密工具
- `scripts/decrypt-config.js` - 解密工具
- `config/db-config.json` - 配置文件（可以是明文或加密）
- `config/db-config.example.json` - 配置模板
