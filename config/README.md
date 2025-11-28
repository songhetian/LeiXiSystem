# 配置文件说明

## 数据库配置

### 首次部署设置

1. 复制模板文件：
   ```bash
   cp db-config.example.json db-config.json
   ```

2. 编辑 `db-config.json`，填入实际的配置信息：
   - `host`: 数据库服务器IP地址
   - `port`: 数据库端口（默认3306）
   - `user`: 数据库用户名
   - `password`: 数据库密码
   - `database`: 数据库名称
   - `sharedDirectory`: 文件上传目录
   - `publicUrl`: 文件访问的公共URL

### 安全提示

⚠️ **重要**: `db-config.json` 包含敏感信息，已被添加到 `.gitignore`，不会被提交到代码仓库。

#### 推荐的安全措施：

1. **数据库账户安全**
   - 不要使用 root 账户
   - 创建专用数据库账户，只授予必要权限
   - 使用强密码（至少12位，包含大小写字母、数字、特殊字符）

2. **网络安全**
   - 配置数据库只允许特定IP访问
   - 使用防火墙限制3306端口访问

3. **文件权限**
   - Windows: 右键 → 属性 → 安全 → 只允许管理员读取
   - Linux: `chmod 600 config/db-config.json`

### 示例配置

```json
{
  "database": {
    "host": "192.168.1.100",
    "port": 3306,
    "user": "leixi_app",
    "password": "StrongP@ssw0rd123!",
    "database": "leixin_customer_service"
  },
  "upload": {
    "sharedDirectory": "\\\\FileServer\\Uploads",
    "publicUrl": "http://192.168.1.100:3001"
  }
}
```

## 打包后的配置

打包后的应用中，配置文件位于：
- Windows: `resources/config/db-config.json`
- 修改此文件后，重启应用即可生效
