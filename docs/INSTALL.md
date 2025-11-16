# 安装指南

## 系统要求

### 必需软件
- **Node.js** >= 18.0.0 ([下载地址](https://nodejs.org/))
- **MySQL** >= 8.0 ([下载地址](https://dev.mysql.com/downloads/mysql/))
- **Git** (可选) ([下载地址](https://git-scm.com/))

### 推荐配置
- 操作系统：Windows 10/11, macOS 10.15+, Ubuntu 20.04+
- 内存：8GB 以上
- 硬盘：至少 2GB 可用空间

## 安装步骤

### 1. 安装 Node.js

#### Windows
1. 访问 https://nodejs.org/
2. 下载 LTS 版本
3. 运行安装程序
4. 验证安装：
```bash
node --version
npm --version
```

#### Mac
使用 Homebrew：
```bash
brew install node
```

#### Linux
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. 安装 MySQL

#### Windows
1. 访问 https://dev.mysql.com/downloads/mysql/
2. 下载 MySQL Installer
3. 运行安装程序
4. 设置 root 密码（记住这个密码！）
5. 启动 MySQL 服务

#### Mac
使用 Homebrew：
```bash
brew install mysql
brew services start mysql
mysql_secure_installation
```

#### Linux
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo mysql_secure_installation
```

### 3. 下载项目

#### 方式一：使用 Git
```bash
git clone https://github.com/leixi/customer-service-desktop.git
cd customer-service-desktop
```

#### 方式二：下载 ZIP
1. 下载项目 ZIP 文件
2. 解压到目标目录
3. 打开终端/命令提示符，进入项目目录

### 4. 安装项目依赖

```bash
npm install
```

如果安装速度慢，可以使用国内镜像：
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 5. 配置数据库

#### 步骤 1：创建配置文件
```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

#### 步骤 2：编辑配置文件
打开 `.env` 文件，修改以下内容：

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=leixin_customer_service
```

#### 步骤 3：初始化数据库

**方式一：使用命令行**
```bash
mysql -u root -p < database/init.sql
```
输入 MySQL 密码后回车。

**方式二：使用 MySQL Workbench**
1. 打开 MySQL Workbench
2. 连接到本地 MySQL
3. 打开 `database/init.sql` 文件
4. 点击执行（闪电图标）

**方式三：手动执行**
```bash
mysql -u root -p
```
输入密码后：
```sql
source /path/to/database/init.sql;
```

### 6. 启动应用

#### Windows
双击运行 `start.bat` 文件

或者在命令提示符中：
```bash
npm run dev
```

#### Mac/Linux
```bash
chmod +x start.sh
./start.sh
```

或者：
```bash
npm run dev
```

### 7. 验证安装

应用启动后，会自动打开三个窗口：
1. **Fastify Server** - 后端 API 服务（端口 3001）
2. **Vite Dev Server** - 前端开发服务器（端口 5173）
3. **Electron App** - 桌面应用窗口

如果一切正常，你应该能看到客服管理系统的主界面。

## 常见问题

### 问题 1：npm install 失败

**解决方案：**
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules
rm -rf node_modules package-lock.json

# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 重新安装
npm install
```

### 问题 2：MySQL 连接失败

**可能原因：**
- MySQL 服务未启动
- 密码错误
- 数据库不存在

**解决方案：**
1. 检查 MySQL 服务状态：
```bash
# Windows
net start MySQL80

# Mac
brew services list

# Linux
sudo systemctl status mysql
```

2. 测试连接：
```bash
mysql -u root -p
```

3. 检查 `.env` 配置是否正确

### 问题 3：端口被占用

**解决方案：**

**Windows:**
```bash
# 查看占用端口的进程
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# 结束进程
taskkill /PID <进程ID> /F
```

**Mac/Linux:**
```bash
# 查看占用端口的进程
lsof -i :3001
lsof -i :5173

# 结束进程
kill -9 <进程ID>
```

或者修改 `.env` 文件中的端口配置。

### 问题 4：Electron 窗口无法打开

**解决方案：**
1. 确保 Vite 开发服务器已启动（http://localhost:5173）
2. 等待 5-10 秒后再启动 Electron
3. 检查控制台错误信息
4. 尝试清除 Electron 缓存：
```bash
rm -rf ~/.electron
```

### 问题 5：数据库初始化失败

**解决方案：**
1. 检查 SQL 文件路径是否正确
2. 确保有足够的权限
3. 手动创建数据库：
```sql
CREATE DATABASE leixin_customer_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
4. 然后逐步执行 SQL 语句

## 卸载

### 1. 停止所有服务
关闭所有运行的终端窗口和 Electron 应用。

### 2. 删除项目文件
```bash
rm -rf customer-service-desktop
```

### 3. 删除数据库（可选）
```sql
DROP DATABASE leixin_customer_service;
```

### 4. 清除 npm 缓存（可选）
```bash
npm cache clean --force
```

## 升级

### 升级项目依赖
```bash
npm update
```

### 升级到新版本
1. 备份数据库
2. 下载新版本
3. 运行 `npm install`
4. 检查配置文件变化
5. 运行数据库迁移脚本（如有）

## 技术支持

如果遇到其他问题：

1. 查看 [README.md](./README.md)
2. 查看 [开发指南.md](./开发指南.md)
3. 搜索 GitHub Issues
4. 联系技术支持：support@leixi.com

## 下一步

安装完成后，建议阅读：
- [启动说明.md](./启动说明.md) - 了解如何启动应用
- [开发指南.md](./开发指南.md) - 学习如何开发和扩展功能
- [项目说明.md](./项目说明.md) - 深入了解项目架构

---

祝你使用愉快！🎉
