# 🎯 雷犀客服系统 v2.0

> 企业级客服管理平台 - 简洁、高效、易用

## ✨ 特性

- 🎨 清新的浅绿色主题设计
- 📊 完整的组织架构管理
- 👥 灵活的用户权限体系
- 💬 强大的聊天通讯功能
- ⏰ 智能考勤管理系统
- 📈 专业质检评估工具

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
# Windows 用户
reset-database.bat

# 或手动执行
mysql -u root -p < database/init.sql
mysql -u root -p leixin_customer_service < database/extended-tables.sql
mysql -u root -p leixin_customer_service < database/complete-test-data.sql
```

### 3. 启动服务
```bash
# 方式一：一键启动（推荐）
npm start

# 方式二：双击启动脚本
start.bat

# 方式三：分别启动
npm run server  # 后端
npm run dev     # 前端
```

### 4. 访问系统
浏览器打开：http://localhost:5173

## 🔑 测试账号

### 管理员
```
用户名：admin
密码：admin123
```

### 普通用户
```
用户名：zhangsan
密码：123456
```

更多账号请查看：[测试账号.md](测试账号.md)

## 📚 文档

- [快速启动](快速启动.md) - 3分钟快速上手
- [一键启动说明](一键启动说明.md) - 详细的启动指南
- [更新指南](UPDATE-GUIDE.md) - 完整的更新说明
- [测试账号](测试账号.md) - 所有测试账号列表
- [项目结构](项目结构.md) - 项目结构说明
- [更新日志](CHANGELOG.md) - 版本更新记录

## 🎯 功能模块

### ✅ 已实现
- [x] 用户管理 - 用户账户的增删改查
- [x] 部门管理 - 组织架构管理
- [x] 职位管理 - 职位信息管理
- [x] 员工管理 - 员工档案管理
- [x] 质检管理 - 会话质检和评分

### 🔄 开发中
- [ ] 考勤管理 - 打卡、排班、请假
- [ ] 聊天通讯 - 即时通讯、群组管理
- [ ] 权限管理 - 角色权限配置
- [ ] 数据统计 - 报表和图表

## 🛠️ 技术栈

### 前端
- React 18
- Vite
- Tailwind CSS
- React Toastify

### 后端
- Fastify
- MySQL 8.0+
- bcrypt
- JWT

### 桌面端
- Electron

## 📦 项目结构

```
customer-service-desktop/
├── database/           # 数据库文件
├── server/            # 后端服务
├── src/               # 前端源码
├── electron/          # Electron配置
├── start.bat          # 一键启动脚本
└── reset-database.bat # 数据库重置脚本
```

## 🔧 开发命令

```bash
# 一键启动
npm start

# 启动后端
npm run server

# 启动前端
npm run dev

# 完整开发模式（含Electron）
npm run dev:all

# 构建
npm run build

# 打包
npm run package:win
```

## 🎨 界面预览

- 清新的浅绿色主题
- 简洁的白色侧边栏
- 统一的表格和表单样式
- 友好的交互体验

## 📊 数据统计

- 数据表：18+
- 前端组件：8个
- API接口：23个
- 测试账号：21个
- 测试数据：完整覆盖

## ⚠️ 注意事项

1. **数据库要求**：MySQL 8.0+
2. **字符集**：utf8mb4
3. **端口**：前端5173，后端3001
4. **测试账号**：仅用于开发测试

## 🐛 常见问题

### 端口被占用
```bash
# 查找占用端口的进程
netstat -ano | findstr :5173
netstat -ano | findstr :3001

# 结束进程
taskkill /PID <进程ID> /F
```

### 数据库连接失败
1. 检查 `.env` 配置
2. 确保 MySQL 服务已启动
3. 验证用户名密码

### 页面空白
1. 清除浏览器缓存
2. 检查控制台错误
3. 确保后端已启动

## 📝 更新日志

### v2.0.0 (2024-11-09)
- ✨ 全新的浅绿色主题
- ✨ 新增部门管理功能
- ✨ 新增职位管理功能
- ✨ 新增员工管理功能
- 🗄️ 完整的数据库架构
- 📚 完善的文档体系

### v1.0.0 (2024-11-08)
- 🎉 初始版本发布

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 👥 团队

Leixi Team

---

**开始使用：** `npm start` 🚀

**遇到问题？** 查看 [一键启动说明.md](一键启动说明.md)

**需要帮助？** 查看 [UPDATE-GUIDE.md](UPDATE-GUIDE.md)
