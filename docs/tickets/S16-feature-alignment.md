# S16 · 功能对齐批次（对齐补全 · 以 feature-compare.md 为准）

## What to build

基于 `docs/feature-compare.md` 逐批对齐旧项目 `LeiXiSystem-main` 的功能。**只借参考的字段清单与信息层级，组件结构与状态管理一律按本仓库新标准（Arco Design Pro、ADR-0013/0014）编写，禁止照搬旧代码实现。** 每批独立可运行、可 commit。

## 对齐原则（grill 已收敛）

- 范围：只对齐 `feature-compare.md` 中标记为**简化 / 当前缺** 的行；`新增` 项参考没有，不跟进；`对齐` 项核对细节。
- 样式：沿用当前系统样式（深蓝 `#2455D9`、Arco），**不采用旧项目视觉**。
- 预览：文件预览以参考原生方案为主（浏览器原生 `img/video/iframe` + Office 在线，见批次九），已移除 `@open-file-viewer` 与 `pdfjs-dist` 依赖。

## 进度

### 批次一 · 工作台 + 组织架构（第一刀 ✅ 排定，部分完成）
- [x] **工作台指标真实化**（TDD）：`GET /dashboard/stats` 补 `todayLateCount`（今日迟到）与 `monthOvertimeHours`（本月加班，overtimeMinutes/60 保留 1 位）真数据；前端工作台替换写死 mock `'3'`/`'128'`。单一后端 TDD seam，4 单测绿；前端构建通过（详见 dashboard.service.ts/spec.ts + page.tsx）。
- [x] **组织管理看板（AdminDashboard）**：纯前端装配（getDepartmentStats/getAttendanceTrend），见 frontend/src/app/(dashboard)/page.tsx OrgOverview
- [x] **组织架构**：核对部门树/表格层级展示（parentId 建树与上级部门展示均已有）
- [x] **岗位管理独立页**（当前缺）：新增前端独立页 `/system/positions`（复用 PositionList 组件），样式规范一致
- [x] **权限独立页**（当前缺）：拆分角色内嵌权限为独立权限页 `/system/permissions`，按模块分组展示各权限点的角色引用数
- [x] **员工列表搜索维度**（简化）：参考 `AdvancedSearch` 补多维度搜索（部门/岗位/状态/关键字）——后端 TDD red→green + 前端字段（backend/src/employees/employees.service.ts）
- [x] 本批次验收：每子项功能可运行、无回归、独立 commit

### 批次二 · 审批 / 报销 / 薪资 对齐（✅ 已排定并完成）

- [x] **待办/已办/我的申请**：补**可配置审批流程/按角色授权**（参考 `ApprovalWorkflowConfig` / `RoleWorkflowConfig`）——新增 `RoleWorkflowService`（role⇄workflow 绑定 list/set，TDD=`role-workflow.service.spec.ts`）；`ApprovalService.startInstance` 按申请人角色**优先解析绑定流程**、无绑定时回落入参编码（TDD=`approval-role-resolution.unit.test.ts`）；前端职责授权独立页 `/approval/role-workflow`
- [x] **报销配置 / 审批人管理独立页**（当前缺）：参考 `ReimbursementSettings` / `ApproverManagement`——报销类型 CRUD（`reimbursement.service/controller`，TDD=`reimbursement-type.service.spec.ts`）+ 前端 `/expense/settings`；审批人管理 `/approval/approvers`（复用 `approval-group`）

### 批次三 · 考勤排班对齐（✅ 已排定并完成）

- [x] **排班管理**：对齐 `SchedulingHub` 的**部门×月份矩阵视图**（后端 `SchedulesService.matrix` + `GET /schedules/matrix`，前端重写 schedules.tsx 为矩阵表格 + 极速印章/单元格编辑，TDD 全绿）
- [x] **考勤日报/月报**：补**部门维度报表与导出**——后端 daily/monthly `list` 支持 `departmentId` 部门维度过滤（叠加 data-scope，交集不越权，TDD red→green）；前端每日/月报页新增部门筛选下拉，导出沿用本地 Excel 与后端 `reports/attendance-monthly` 部门级统计

### 批次四 · 员工变动 / 入职审批对齐（✅ 已排定并完成）

- [x] **员工变动流水独立页**（当前缺 / `EmployeeChanges`）：对齐参考集中查看全员工变动的**变动流水 + 部门维度筛选**。后端 `EmployeesService.listChangeLogs` 集中分页返回全员工变动流水（join 员工/部门/岗位），支持 `changeType`/`keyword`/`departmentId` 过滤并叠加 data-scope（交集不越权），开 `GET /employees/change-logs`（TDD red→green，listChangeLogs 6 项单测绿）；前端新增独立页 `/employees/change-logs`（部门下拉 + 变动类型 + 关键字 + 分页 + 本地 Excel 导出），并登记菜单元数据（AppSider/CommandPalette/PageTabs/面包屑/路由映射）。后端测试 40 通过、前端 `tsc --noEmit` 通过。

### 批次五 · 通知设置独立页对齐（✅ 已排定并完成）

- [x] **通知设置独立页**（当前缺 / `NotificationSettings`）：对齐参考**按事件类型配置业务通知的推送目标角色**。后端新增 `NotificationSettingService`（`GET /notification-settings` 读取、`PUT /notification-settings/:eventType {targetRoles}` upsert、`GET /notification-settings/roles` 可选目标=伪角色 + 系统角色去重），新增 Prisma `notification_settings` 表 + `system:notification:settings` 权限点，控制器以 `@RequirePermission` 保护（TDD red→green，6 项单测绿）；前端新增独立页 `/notifications/settings`（分组 Tab：考勤流转/财务资产/异常告警，剔除参考的『学习考试』组；每组事件多选目标角色 + 按组批量保存 + 伪角色高亮），并登记菜单元数据（AppSider/CommandPalette/PageTabs/面包屑/路由映射）。后端 `tsc` 通过、前端 `tsc --noEmit` 通过、AppLayout 测试 16/16 通过。

### 批次六 · 假期审计对齐（✅ 已排定并完成）

- [x] **考勤申请审计页**（当前缺 / `CompensatoryApproval`）：对齐参考**审批人按申请聚合审计**（假期/加班申请）。后端新增 `AttendanceAuditService`（`GET /attendance/audit` 聚合请假/加班记录并归一化为统一行，支持 `status`/`recordType`/`departmentId`/`keyword`/`vacationTypeId`/`startDate`/`endDate` 过滤 + 分页，title=AD-0010 叠加 data-scope，交集不越权；复用审批实例 approve/reject 端点，不引入参考的排班交换缺陷），控制器以 `@RequirePermission('attendance:view')` 保护（TDD red→green，8 项单测绿）；前端新增独立页 `/attendance/vacation/audit`（部门/类型/状态/关键字/日期筛选 + 表格 + 本地 Excel 导出 + 详情弹窗审计：申请人身份/业务内容/原因/状态，`approving` 关联审批实例可通过/驳回，驳回必填理由），并登记菜单元数据（AppSider/CommandPalette/PageTabs/面包屑/路由映射）。后端 `tsc` 通过、前端 `tsc --noEmit` 通过、AppLayout 测试 16/16 通过、audit 单测 8/8 通过。

### 批次七 · 公告查看 / 发布分离 + 个人改密对齐（✅ 已排定并完成）

- [x] **公告查看页（与发布端分离）**（对齐 / `BroadcastList`）：对齐参考「查看 + 发布」分离。后端新增 `BroadcastPublicController`（`GET /broadcasts` 仅已发布 + `getPublicDetail` 校验发布状态/接收人范围 + `GET /broadcasts/unread-count` 未读数 + `POST /broadcasts/:id/read` 标记已读），复用 `BroadcastService.list(onlyPublished,userId)/getPublicDetail/markRead/unreadCount`；新增 Prisma `broadcast_read` 表 + `broadcast_recipient` 接收人（all/department/user）可见性校验（TDD red→green，markRead 与公开链路共 12 项单测绿）；前端新增 `broadcastApi.getPublicList/getPublicUnreadCount/getPublicDetail/markBroadcastRead` + 独立公开查看页 `/broadcasts`（announcements.tsx，含未读标记、优先级/接收范围、详情弹窗、sanitizeHtml 安全渲染、读后未读刷新），并登记菜单元数据（AppSider 常用组/CommandPalette/PageTabs/面包屑/路由映射 PATH_TO_MENU/PATH_TO_TITLE）。后端 `tsc` 通过、前端 `tsc --noEmit` 通过、broadcast.service.spec 12/12 通过。
- [x] **个人资料 + 改密入口核对**（对齐 / `PersonalInfo` + `ChangePassword`）：后端 `POST /auth/change-password`（限流 + 强度校验 + 禁与用户名混淆 + 改成功清 session）与单测已存在；前端 `/profile` 已含个人信息 Tab + 修改密码 Tab（form 校验 + 成功后登出），`authApi.changePassword` 已接线——核对为已对齐，无需补开。

### 批次八 · 通知发送 / 角色绑定 / 汇总导出 / 系统设置 对齐（✅ 已排定并完成）

- [x] **① 通知中心发送能力**（对齐 / `NotificationSender` + `server/routes/notifications.js`）：后端 `NotificationService.send` 支持按**全员 / 部门 / 指定用户**三类目标解析接收人并批量落库（标题必填、空目标校验，TDD `notification.service.spec`），开 `POST /notifications/send` 以 `system:notification:send` 权限保护；前端通知列表页新增**发送通知弹窗**（目标类型切换 + 部门/用户多选 + 表单校验 + 发送后刷新）。`system:notification:send` 权限点已入 `prisma/seed.ts`（需 `db:seed` 生效）。
- [x] **② 用户-角色绑定对齐**（对齐 / `UserRoleManagement`）：核对现有 `SystemUserService.assignRoles`（先清空旧绑定再批量创建 + 权限缓存失效），补齐 TDD 单测（不存在抛 404、空数组仅清空并清缓存、正常绑定）于 `system-user.service.spec`。
- [x] **③ 汇总/导出中心补全**（对齐 / `excel-export.js`/`attendance-export.js` 员工导出）：新增**员工列表导出** `ReportsService.exportEmployeeListXlsx/Csv`（按数据范围查询员工 + 部门/职位/邮箱 join，TDD red→green，数据范围断言 + xlsx Buffer + csv 表头 3 项单测绿），开 `GET /reports/employee-list/export?format=`；前端报表中心补全**员工结构统计卡片** + Excel/CSV 导出按钮（收敛零散导出入口）。
- [x] **④ 系统设置补字段**（对齐 / `SystemConfigPage` 转换比例）：将加班转调休的硬编码 `dividedBy(8)` 改为读系统设置 `overtime_to_leave_hours`（多少加班小时=1天，缺省 8，读取失败兜底 8），`convertOvertimeToCompensatory`/`Mine` 共用（TDD red→green：按比例换算 + 缺省两用例于 `vacation.service.spec`）；seed 补该 `attendance` 分组设置项（前端设置页自动渲染，需 `db:seed` 生效）。
- 验收：后端 `tsc --noEmit` 通过、前端 `tsc --noEmit` 通过；reports.service.spec 13/13、vacation.service.spec 27/27 通过。

### 批次九 · 知识库树形导航 + 文件原生预览对齐（✅ 已排定并完成）

- [x] **知識库 Win11 树形导航**（对齐 / `Win11KnowledgeBase` + `KnowledgeFolderView`）：纯前端对齐——新增 `getKnowledgeView`（`buildCategoryNodes` 构建分类树节点 + 按 activeCategoryId 过滤，含 `uncat` 未分类/`all` 全部 + 关键字命中过滤，TDD red→green，`view.test.ts`）；重写知识库页 `list.tsx` 为**左侧分类树导航（Arco `Tree`，根=全部 + 各分类节点计数）+ 右侧文章 `List`**，支持分类/关键字筛选 + 分页。
- [x] **文件预览对齐参考原生方案**（对齐 / `FilePreviewModal.jsx`）：新增 `getPreviewMode`（按扩展名/MIME 分类 `image`/`video`/`audio`/`pdf`/`office`/`unsupported`）与 `FilePreviewModal`（列表内嵌模态：`<img>`/`<video>`/`<iframe>`(pdf) + Office 在线预览，不支持则下载兜底，TDD `preview.test.ts`/`file-preview-modal.test.tsx`）；移除 `preview/[id]` 路由、`@open-file-viewer` 与 `pdfjs-dist` 依赖（package.json / next.config.mjs / public/pdfjs 清理）。
- 验收：前端 `tsc --noEmit` 通过；knowledge 4 套件 31/31 通过。

### 批次十 · 算薪批次明细 + 员工事务页核对（✅ 已排定并完成）

- [x] **① 算薪批次明细**（对齐 / `PayslipManagement` 单员工薪资构成+调整项展示）：后端 `PayrollService.getRunDetails` 聚合批次内每员工**工资构成明细项 + 调整项**（items=payrollDetail、adjustments=payrollAdjustment），按员工分组合计，且叠加 **data-scope 隔离**（all/self/部门交集，防 IDOR），开 `GET /payroll/runs/:id/details`（TDD red→green：404 批次不存在 / 雇员明细与调整项聚合 / 部门范围过滤不在范围员工 3 项单测绿）；前端新增 `RunDetailsModal`（批次状态/员工数/总金额概况 + 员工表可展开行查看工资构成与调整项 + `draft` 批次经 ModalForm 添加调整项 `POST /payroll/runs/:id/adjust` 后刷新），集成进运行批次页 `runs.tsx` 替换占位「明细」按钮（前端 TDD：明细拉取与展示、draft 可加调整并调 `adjustPayrollRun` 后 `onChanged`、published 不出现加调整按钮、非 visible 不渲染 5 项单测绿）。
- [x] **② 员工事务页核对**（对齐 / `EmployeeChanges`）：核对 `employee/pages/transactions.tsx` 覆盖 9 类事务（入职/离职/转正/合同/考勤申诉/证明/奖惩/培训/调动），含增删改 + 提交审批 + 状态流转 draft→pending→approved→rejected→cancelled——核对为已对齐，无需补开。
- 验收：后端 `tsc --noEmit` 通过、前端 `tsc --noEmit` 通过；payroll.service.spec 9/9、前端 payroll 35/35 通过；后端单测（排除需 DB 的 e2e）831/831 通过。

### 批次十一 · 员工详情多维度 Tab + 知识库管理 + 我的通知核对（✅ 已排定并完成）

- [x] **① 员工详情页多维度 Tab**（对齐 / `EmployeeDetail.jsx`）：在 `/employees/[id]` 资料卡片下补 `EmployeeDetailTabs` 组件，`Tabs` 三 Tab——**考勤**（该员工月度考勤记录 `getMonthlyList(employeeId)`）、**假期**（假期额度 `getBalanceList(employeeId)`：类型/总额/已用/剩余）、**履历**（`getTimeline(employeeId)` Timeline）；TDD `employee-detail-tabs.test.tsx`（Arco Tabs/Table/Timeline 组件 mock + API 拉取断言随 employeeId 变化），集成进 `detail.tsx`（资料卡下方第二张 Card）。
- [x] **② 知识库管理核对**（对齐 / `KnowledgeAdmin`）：核对 `employee`/`knowledge` 的「文章增删改 + 分类管理」——`knowledge/pages/admin.tsx` 已含**分类管理** Tab（列表 + 新增/编辑/删除弹窗 + 排序）与**文章管理** Tab（标题/分类/状态/浏览量表格 + 分页 + 新增/编辑/删除弹窗），`services/knowledge.ts` 覆盖 `getCategories/createCategory/updateCategory/deleteCategory` 与 `getArticles/createArticle/updateArticle/deleteArticle` ——核对为已对齐，无需补开。
- [x] **③ 我的通知核对**（对齐 / `MyNotifications` + `NotificationCenter`）：核对 `/notifications` **列表页**（未读数 Badge、单条与全部已读、类型标签、管理员发送通知弹窗 全/部门/用户）与顶栏 **NotificationDropdown 未读弹窗**（5 条未读预览、单条已读、全部已读、查看全部）；后端 `GET /notifications` 支持 `read`/`type` 过滤 + `unread-count`/`markRead`/`read-all`/`send`（`system:notification:send` 保护）——核对为已对齐，无需补开。
- 验收：`feature-compare.md` 员工详情、我的通知两行走状态更新为已对齐。

### 批次十二 · 知识库管理文章附件完善（✅ 已排定并完成）

- [x] **文章附件管理**（对齐 / `KnowledgeManagement` 文章附件）：当前系统附件为独立模型（`KnowledgeAttachment`），已有 `listAttachments`/`addAttachment` 但**缺删除能力**、admin 文章弹窗未内嵌附件管理——本次补全。后端：`KnowledgeService.deleteAttachment` 补 2 项单测（附件不存在抛 404 `5003` 不触发 delete、存在则删除并返回 `{success}`，TDD red→green），控制器新增 `DELETE /knowledge/articles/:id/attachments/:attId`（`knowledge:manage` 权限保护）暴露删除（`knowledge.service.spec` 21/21 绿）；前端：`knowledgeApi` 补 `addAttachment`/`deleteAttachment`，`KnowledgeAttachment` 类型补 `mimeType`（与后端一致），admin `ArticleManage` 文章编辑弹窗内嵌**附件管理区**（编辑时拉取附件列表 + 行内新增表单（文件名/地址/大小）+ 行删除 + 添加后刷新、删除本地过滤）。验收：后端 `tsc --noEmit` 通过、前端 `tsc --noEmit` 通过；knowledge.service.spec 21/21、前端 knowledge 5 套件 52/52 通过（e2e 需真实 DB 不影响）。`feature-compare.md` 知识库管理行走「对齐」。

### 批次十三 · 生产构建验收（✅ 通过）

- [x] **前端生产构建**：`pnpm build`（Next.js 14.2.35）通过——59 页全部生成，Lint/类型校验通过；`output: standalone` 的 symlink EPERM 提示为可选的 traced-files 复制，非致命。
- [x] **后端生产构建**：`pnpm build`（`tsc -p tsconfig.json`）通过，无类型错误。
- [x] **全量单测**：后端 `jest src` 42 套件 609 用例全绿；前端 `jest` 57 套件 556 用例全绿。（需真实 DB 的 e2e 除外，属既有环境依赖。）
- [x] 结论：新建/变更（批次十一、十二）与既有功能均通过生产构建与单测，验收通过。

## Acceptance criteria

- [x] 每个对齐项均源自 `feature-compare.md` 明确行号/状态，改动不引入旧项目脏实现
- [x] 对齐项完成后回到 `feature-compare.md` 将该行状态更新为「对齐」
- [x] 无新增测试回归；涉及后端 service 的改动遵循 TDD

## Blocked by

- 无（工作台与组织架构依赖现有认证/员工模块，均已就绪）

