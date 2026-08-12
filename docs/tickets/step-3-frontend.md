# Ticket: step-3 — 前端（Next.js + Arco Pro + Refine）

> 对应 REFACTOR_PLAN.md 第 7.3 节 + **第 11 章 UI 规范（强制）**

## 背景

前端从 antd + Vite 重写为 Next.js + Arco Design Pro + Refine。**先建公共组件库，再写页面**——这是第 11 章的硬性要求。

## 待办

### 3.1 骨架
- [ ] Next.js（App Router）项目基于 arco-cli 生成的 Pro 模板（如模板为 Pages Router，升级到 App Router）
- [ ] 固定 React 18（Arco 兼容性）
- [ ] 全局布局：左侧菜单（路由+权限动态生成）+ 顶栏（面包屑/用户区）+ 多标签页签
- [ ] 主题 Token：ConfigProvider 配置主色/间距/圆角（对齐 11.3 节）
- [ ] Refine 接入：AuthProvider + @refinedev/nestjsx-crud dataProvider + resources 定义
- [ ] JWT 存 cookie（httpOnly），401 统一跳登录

### 3.2 公共组件库（第 11.5 节清单，先建齐）
- [ ] `PageContainer` — 页面容器
- [ ] `ProTable` — 搜索+表格+分页+导出 一体
- [ ] `SearchForm` — 查询区表单
- [ ] `ModalForm` — 弹窗表单
- [ ] `StatusTag` — 状态→语义色标签
- [ ] `AsyncSelect` — 远程下拉
- [ ] `UploadImage` — OSS 图片上传
- [ ] `EmptyState` / `ResultState` — 空态/结果页
- [ ] `ConfirmButton` — 危险操作确认

### 3.3 页面移植（按模块，优先级同后端）
- [ ] 登录 → 工作台 Dashboard（Statistic + 图表卡片）
- [ ] 员工：列表（ProTable）/详情/新增编辑（ModalForm）
- [ ] 考勤：班次/排班/请假/加班/调休/休假额度 页面
- [ ] 薪资：薪资项目/工资条（先导入式）
- [ ] 报销：申请/列表/审批
- [ ] 系统：用户/角色/权限/审批流/日志
- [ ] 培训：知识库（文章列表/详情/编辑，附件 KKFileView iframe 预览）
- [ ] 通知公告待办

### 3.4 强制检查（每个页面走第 11.7 验收清单）
- [ ] 无手写基础组件、无其他 UI 库
- [ ] 颜色/间距/字号全部来自 token
- [ ] 重复结构已抽组件，无复制粘贴
- [ ] 加载态/空态/错误态齐全；危险操作有确认
- [ ] 菜单+按钮权限经 PermissionGate

## 完成标准

- [ ] 登录 → 员工 → 考勤 → 工资条全链路可用
- [ ] 公共组件库建齐并被页面实际复用（抽查无重复实现）
- [ ] 第 11.7 验收清单全部通过
