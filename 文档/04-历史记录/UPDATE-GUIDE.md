# 🎉 雷犀客服系统 v2.0 更新指南

## 📋 更新内容概览

### 1. 全新界面设计 ✨
- 采用清新的浅绿色主题
- 简洁的白色侧边栏
- 优化的表格和表单样式

### 2. 完整数据库架构 🗄️
- 根据设计文档重建数据库
- 新增14个数据表
- 完善的外键约束和索引

### 3. 新增功能模块 🚀
- ✅ 部门管理
- ✅ 职位管理
- ✅ 员工管理
- 🔄 考勤管理（待开发）
- 🔄 聊天通讯（待开发）

## 🚀 快速开始

### 方式一：全新安装（推荐）

```bash
# 1. 重置数据库
reset-database.bat

# 2. 一键启动所有服务
npm start

# 或者双击运行
start.bat

# 3. 访问系统
浏览器自动打开: http://localhost:5173
```

### 方式二：保留数据升级

```bash
# 1. 备份现有数据
mysqldump -u root -p leixin_customer_service > backup.sql

# 2. 执行扩展表创建
mysql -u root -p leixin_customer_service < database/extended-tables.sql

# 3. 重启服务
npm run server
npm run dev
```

## 🔑 测试账号

### 管理员账号
```
用户名: admin
密码: admin123
角色: 超级管理员
权限: 所有权限
```

### 普通用户
```
用户名: zhangsan
密码: 123456
角色: 客服主管
```

更多测试账号请查看：`测试账号.md`

## 📁 新增文件说明

### 数据库相关
- `database/extended-tables.sql` - 扩展表结构（考勤、聊天等）
- `database/UPGRADE.md` - 详细的升级指南
- `reset-database.bat` - 一键重置数据库脚本

### 前端组件
- `src/components/DepartmentManagement.jsx` - 部门管理页面
- `src/components/PositionManagement.jsx` - 职位管理页面
- `src/components/EmployeeManagement.jsx` - 员工管理页面

### 文档
- `CHANGELOG.md` - 完整更新日志
- `UPDATE-GUIDE.md` - 本文件

## 🎨 新配色方案

系统采用清新的Teal（青绿色）主题：

```css
Primary 50:  #f0fdf9  /* 背景色 */
Primary 100: #ccfbef  /* 浅色 */
Primary 500: #14b8a6  /* 主色调 */
Primary 600: #0d9488  /* 深色 */
```

## 📊 功能对比

| 功能模块 | v1.0 | v2.0 |
|---------|------|------|
| 用户管理 | ✅ | ✅ |
| 部门管理 | ❌ | ✅ |
| 职位管理 | ❌ | ✅ |
| 员工管理 | ❌ | ✅ |
| 质检管理 | ✅ | ✅ |
| 考勤管理 | ❌ | 🔄 |
| 聊天通讯 | ❌ | 🔄 |
| 权限管理 | ❌ | 🔄 |

## 🔧 API端点

### 新增API

```
GET    /api/departments       # 获取部门列表
POST   /api/departments       # 创建部门
PUT    /api/departments/:id   # 更新部门
DELETE /api/departments/:id   # 删除部门

GET    /api/positions         # 获取职位列表
POST   /api/positions         # 创建职位
PUT    /api/positions/:id     # 更新职位
DELETE /api/positions/:id     # 删除职位

GET    /api/employees         # 获取员工列表
POST   /api/employees         # 创建员工
PUT    /api/employees/:id     # 更新员工
DELETE /api/employees/:id     # 删除员工
```

## 📝 使用说明

### 部门管理
1. 点击侧边栏"组织架构" -> "部门管理"
2. 点击"新增部门"按钮
3. 填写部门信息并保存
4. 可以编辑或删除已有部门

### 职位管理
1. 点击侧边栏"组织架构" -> "职位管理"
2. 点击"新增职位"按钮
3. 填写职位信息（可关联部门）
4. 设置薪资范围和职位级别

### 员工管理
1. 点击侧边栏"组织架构" -> "员工管理"
2. 点击"新增员工"按钮
3. 填写员工基本信息
4. 设置员工评级（1-5星）
5. 关联部门和职位

## ⚠️ 注意事项

1. **数据库版本**：需要MySQL 8.0+
2. **字符集**：必须使用utf8mb4
3. **外键约束**：删除数据时注意级联关系
4. **默认密码**：新建用户默认密码为123456

## 🐛 常见问题

### Q: 数据库连接失败
A: 检查`.env`文件中的数据库配置

### Q: 外键约束错误
A: 按顺序执行SQL文件：init.sql -> extended-tables.sql

### Q: 页面显示空白
A: 清除浏览器缓存，重新加载页面

### Q: API请求失败
A: 确保后端服务已启动（端口3001）

## 📞 技术支持

如遇到问题，请查看：
1. `database/UPGRADE.md` - 数据库升级详细说明
2. `CHANGELOG.md` - 完整更新日志
3. `雷犀客服系统数据库设计文档.md` - 数据库设计文档
4. `功能介绍.md` - 系统功能说明

## 🎯 下一步计划

- [ ] 完成考勤管理模块
- [ ] 完成聊天通讯模块
- [ ] 完成权限管理模块
- [ ] 添加数据统计和报表
- [ ] 优化移动端适配

---

**祝使用愉快！** 🎊
