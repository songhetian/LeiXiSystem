# Ticket: step-3 — 前端（Next.js + Arco Pro + Refine）

> 对应 REFACTOR_PLAN.md 第 7.3 节 + **第 11 章 UI 规范（强制）**
> 状态核对：2026-09-29。逐条按仓库实际证据核对，不是计划口径。
> 标记约定：`[x]` 已达成 ｜ `[ ]` 未达成或无法从仓库核实（行尾注明原因）。

## 背景

前端从 antd + Vite 重写为 Next.js + Arco Design Pro + Refine。**先建公共组件库，再写页面**——这是第 11 章的硬性要求。

## 待办

### 3.1 骨架

- [x] Next.js App Router 项目 —— `frontend/src/app/`，(dashboard) 分组下 **57 个 page.tsx**
- [x] 固定 React 18（Arco 兼容性）
- [x] 全局布局：左侧菜单（路由+权限动态生成）+ 顶栏 + 多标签页签
      —— `components/`: `AppSider.tsx` / `AppHeader.tsx` / `AppLayout.tsx` / `PageTabs.tsx`
      + 附带 `KeepAliveHost.tsx`（页签保活）/ `TitleSync.tsx` / `RouteProgress.tsx` / `CommandPalette.tsx`
- [x] 主题 Token —— `app/providers.tsx`（ConfigProvider）+ `lib/design-tokens.ts`，
      含 `design-tokens-a11y.test.ts` 对比度守护
- [ ] ~~Refine 接入：AuthProvider + @refinedev/nestjsx-crud dataProvider + resources~~
      —— **未采用**：仓库未安装 Refine，改为自写 ProTable 适配层（ADR-0007）。
      菜单权限由 `AppSider` + `PermissionGate` 自行实现。
- [x] JWT 存 cookie（httpOnly），401 统一跳登录 —— `store/auth.ts`：token 为 HttpOnly `access_token`，
      前端经 `/auth/me` 校验，`AppLayout.tsx:140` 用 `ProtectedRoute` 包裹，Socket 经 `withCredentials` 复用 cookie

### 3.2 公共组件库（第 11.5 节清单，先建齐）

- [x] `PageContainer` — 页面容器
- [x] `ProTable` — 搜索+表格+分页+导出 一体（自实现，非 Refine）
- [x] `SearchForm` — 查询区表单
- [x] `ModalForm` — 弹窗表单
- [x] `StatusTag` — 状态→语义色标签
- [ ] `AsyncSelect` — 远程下拉 —— **未按此名落地**：存在 `EmployeeSelect.tsx`（远程员工选择），
      无通用 AsyncSelect 抽象
- [ ] `UploadImage` — OSS 图片上传 —— **未落地**：文件上传走 knowledge 模块附件；前端无通用图片上传组件
- [x] 空态/结果页 —— 合并为 `EmptyState.tsx` + `DataState.tsx`（加载/空/错误三态统一）
- [x] `ConfirmButton` — 危险操作确认
- [x] 额外：`ErrorBoundary.tsx` / `NotificationDropdown.tsx` / `PermissionGate.tsx`

### 3.3 页面移植（按模块，优先级同后端）

- [x] 登录 → 工作台 Dashboard（Statistic + 图表卡片）
- [x] 员工：列表（ProTable）/详情/新增编辑（ModalForm）
- [x] 考勤：班次/排班/请假/加班/调休/休假额度 页面
- [x] 薪资：薪资项目/工资条
- [x] 报销：申请/列表/审批（前端 `features/expense`）
- [x] 系统：用户/角色/权限/审批流/日志
- [x] 培训/知识库：文章列表/详情/编辑 —— **附件预览为浏览器原生方案**（ADR-0015），非 KKFileView iframe
- [x] 通知公告待办
- [x] 额外：`finance` / `performance`（含 `okr` 路由）/ `helpdesk` / `reports` / `profile`

### 3.4 强制检查（每个页面走第 11.7 验收清单）

- [ ] 无手写基础组件、无其他 UI 库 —— 大体遵守；但存在自写组件（ProTable/ModalForm 等），
      属第 11 章允许的「公共组件库」范畴，需人工抽查是否有越界手写
- [x] 颜色/间距/字号全部来自 token —— `lib/design-tokens.ts` + `globals.css` / `arco-overrides.css`
- [x] 重复结构已抽组件，无复制粘贴
- [x] 加载态/空态/错误态齐全；危险操作有确认 —— `DataState` + `ConfirmButton`
- [x] 菜单+按钮权限经 PermissionGate

## 完成标准

- [x] 登录 → 员工 → 考勤 → 工资条全链路可用（57 路由，`next build` 36 条静态路由编译通过）
- [x] 公共组件库建齐并被页面实际复用（抽查无重复实现）
- [ ] 第 11.7 验收清单全部通过 —— 需人工按清单抽查，仓库无法自证

## 与计划不一致 / 遗留

1. **Refine 未采用**（最关键偏差）：计划以 Refine 承载 dataProvider/resources/authProvider，
   实际全部自写（ADR-0007）。后果是「Refine 生态能力」（自动 CRUD/数据缓存/表单）需自行补齐，
   好处是去掉了一层重依赖、与 Arco 更贴合。文档与切片 S01 里的「Refine 接入」措辞需清理。
2. **AsyncSelect / UploadImage 两个组件未落地**：若后续页面出现第三处远程下拉或图片上传，
   应抽成通用组件，避免就地重复。
3. **验收仍是人工项**：第 11.7 清单是「视觉/交互」验收，无法用单测覆盖，需在 step-5 走查时补。
