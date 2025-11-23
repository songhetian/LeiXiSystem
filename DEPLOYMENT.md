# 客服管理系统部署说明

## 无 Node.js 环境部署方案

本方案允许在没有安装 Node.js 的目标电脑上运行客服管理系统。

**注意**：如需完整的部署安装指南，请查看 [DEPLOYMENT_FULL.md](DEPLOYMENT_FULL.md) 文件，其中包含从第一步开始的详细部署步骤。

### 部署步骤

1. **复制文件**
   - 将整个项目文件夹复制到目标电脑
   - 确保包含以下文件和文件夹：
     - `dist-app/` - 打包后的桌面应用
     - `config/` - 配置文件目录
     - `database/` - 数据库脚本
     - `uploads/` - 上传文件目录（本地存储时使用）

2. **配置数据库连接**
   - 编辑 `config/db-config.json` 文件
   - 修改数据库连接信息：
   ```json
   {
     "database": {
       "host": "your-database-server-ip",  // 数据库服务器IP地址
       "port": 3306,                       // 数据库端口
       "user": "your-username",            // 数据库用户名
       "password": "your-password",        // 数据库密码
       "database": "leixin_customer_service" // 数据库名称
     },
     "upload": {
       "sharedDirectory": "",             // 共享上传目录路径（可选）
       "publicUrl": ""                   // 公共访问URL（可选）
     }
   }
   ```

3. **运行应用**
   - 双击 `dist-app/win-unpacked/客服管理系统.exe` 运行应用
   - 或运行 `dist-app/客服管理系统 Setup 1.0.0.exe` 安装应用

### 局域网数据库配置示例

如果您的 MySQL 数据库运行在局域网中的另一台电脑上：

```json
{
  "database": {
    "host": "192.168.1.100",    // 数据库服务器IP
    "port": 3306,
    "user": "root",
    "password": "your_password",
    "database": "leixin_customer_service"
  }
}
```

### 多电脑文件共享解决方案

为了让多台电脑可以访问相同的上传文件，有以下几种方案：

#### 方案一：使用网络共享文件夹（推荐）
1. 在局域网中设置一台电脑作为文件服务器
2. 创建共享文件夹，例如：`\\SONG\SharedUploads`
3. 在每台客户端电脑上配置：
   ```json
   {
     "upload": {
       "sharedDirectory": "\\\\SONG\\SharedUploads",
       "publicUrl": "http://192.168.1.100:3001"  // 运行后台服务的电脑IP和端口
     }
   }
   ```
   注意：`publicUrl` 应该是运行 `npm run server` 命令的电脑的IP地址和端口（默认3001）

#### 方案二：使用NAS或云存储
1. 配置NAS设备或云存储服务
2. 将上传目录指向NAS或云存储挂载点
3. 配置公共访问URL

#### 方案三：使用FTP/SFTP服务器
1. 部署FTP/SFTP服务器
2. 修改上传逻辑以支持FTP/SFTP上传（需要额外开发）

### 注意事项

1. 确保目标电脑可以访问配置的数据库服务器
2. 确保数据库服务器允许来自目标电脑的连接
3. 确保防火墙允许相应的端口通信
4. 首次运行时可能需要初始化数据库结构
5. 如果使用网络共享文件夹，确保网络连接稳定且权限设置正确
6. `publicUrl` 应该设置为运行后台服务的电脑IP地址和端口（默认3001）

### 数据库初始化

如果需要初始化数据库结构，可以在有 Node.js 环境的电脑上运行：

```bash
npm run db:init
```

或者手动执行 `database/leixin_customer_service_complete.sql` 脚本。

### 配置向导

运行以下命令可以启动交互式配置向导：

```bash
npm run db:setup
```
