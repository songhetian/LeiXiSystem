# 功能对标文档：当前系统 vs 旧项目(LeiXiSystem-main)

> **编制目的**：当前系统与旧项目 `LeiXiSystem-main` 做全量功能对标，明确两者的差异，为后续"逻辑/页面逐项对齐参考实现"提供依据。所有"参考怎么展示/实现"均来自对旧项目 `src/App.jsx`、`src/components/Sidebar.jsx` 及对应组件/后端路由的实际代码分析。
>
> **不在本文档范围内**（用户明确不需要跟进）：
> - 客服案例库 / 案例推荐（案例管理）
> - 质检全家（quality-inspection、质检报表/统计/规则、quality-inspection.js）
> - 即时通讯 / 群组
> - 考核 / 考试全家（Exam* / Assessment*）
> - 后勤与设备（设备管理 / 实机明细 / 申请审批 / 库存管理）

## 状态标记说明

| 标记 | 含义 |
|---|---|
| **对齐** | 当前系统与参考实现基本一致 |
| **简化** | 当前系统有该功能，但更简单或维度/素材更少，需参照补全 |
| **新增** | 旧项目没有该功能，属于当前系统新功能（按约定暂不跟进） |
| **当前缺** | 旧项目有该功能，当前系统还没有，需评估是否补齐 |

---

## 一、工作台 / 仪表盘

| 当前系统 | 参考对应 | 参考怎么展示/实现 | 状态 |
|---|---|---|---|
| 工作台 `/` | 控制面板 `Dashboard`（Dashboard.jsx）+ 企业看板 `AdminDashboard`（AdminDashboard.jsx） | 参考有**两个**看板：个人 `Dashboard`（我的待办/出勤/通知）+ 管理 `AdminDashboard`（组织/出勤统计看板，后端 `server/routes/admin-dashboard.js`） | **对齐**（指标卡真实数据 + 管理员可见组织看板 `OrgOverview`：部门人力分布 + 近 7 日考勤趋势） |
| 组织概况指标（在职/出勤/待审批/工资） | — | 参考 `admin-dashboard.js` 提供统计汇总与图表 | **对齐**（`GET /dashboard/stats` 返回真实统计：在职/今日出勤/待审批/本月工资/今日迟到/本月加班） |

---

## 二、人事 / 组织架构

| 当前系统 | 参考对应 | 参考怎么展示/实现 | 状态 |
|---|---|---|---|
| 员工列表 `/employees` | 员工管理 `EmployeeManagement` | 参考：**表格**（员工/部门/岗位/状态/考勤摘要）+ `AdvancedSearch` **多维度搜索**（部门/岗位/状态/关键字等），非仅关键字；支持员工详情抽屉、入职流程 | **对齐**（员工列表已支持 姓名/工号/状态/部门/岗位 多维多条件搜索，见 employee/pages/list.tsx） |
| 员工详情 `/employees/[id]` | `EmployeeDetail.jsx` | 参考：资料卡片 + 多维度 Tab（考勤/薪资/假期/履历） | **对齐**（资料卡片 + `EmployeeDetailTabs` 补多维度 Tab：考勤月报/假期余额/履历 Timeline，批次十一） |
| 员工事务 `/employees/transactions` | `EmployeeChanges` 变动记录 | 参考：员工入职/调动/离职等**变动流水** + 审核 | **对齐**（覆盖 9 类事务：入职/离职/转正/合同/考勤申诉/证明/奖惩/培训/调动，含增删改 + 提交审批 + 状态流转 draft→pending→approved→rejected→cancelled，见 employee/pages/transactions.tsx） |
| 员工变动流水 `/employees/change-logs` | `EmployeeChanges` 变动记录 / `EmployeeApproval` | 参考：集中查看全员工变动（入职/调动/晋升/调薪/离职等）**变动流水**，支持**部门维度**筛选 + 变动类型 + 关键字，分页展示，经数据范围隔离 | **对齐**（后端 `GET /employees/change-logs` 支持 `departmentId` 部门过滤 + `changeType`/`keyword` + 分页 join 员工信息，前端独立页 + 部门筛选 + 本地 Excel 导出） |
| 人员履历 `/employees/timeline` | — | — | **新增** |
| 员工标签 `/employees/tags` | — | 参考无"员工标签"概念（标签在质检模块，已排除） | **新增** |
| 组织架构 `/system/departments` | 部门管理 `DepartmentManagement` | 参考：部门**树/表格**，支持上级部门层级 | **对齐** |
| 岗位管理（独立页缺失） | 岗位管理 `PositionManagement` | 参考有独立**岗位管理**页 | **对齐**（独立页 `/system/positions`，见 system/pages/positions.tsx） |
| 用户管理 `/system/users` | 角色分配 `UserRoleManagement` | 参考：用户-角色绑定管理 | **部分**（当前"所有用户都是员工"约束是参考没有的**新增**逻辑） |
| 角色权限 `/system/roles` | 角色管理 `RoleManagement` + 权限管理 `PermissionManagement` | 参考分**权限管理**与**角色分配**两块 | **对齐**（独立权限页 `/system/permissions` 按模块分组展示各权限点角色引用数，见 system/pages/permissions.tsx） |

---

## 三、考勤管理

| 当前系统 | 参考对应 | 参考怎么展示/实现 | 状态 |
|---|---|---|---|
| 打卡 `/attendance/punch` | 考勤打卡 `AttendanceHome` | 参考：打卡按钮 + 今日记录，支持地理位置校验 | **对齐** |
| 班次管理 `/attendance/shifts` | 班次管理 `ShiftManagement` | 参考：班次表格（名称/时段/状态）+ `is_active` 开关 + 按部门筛选，接口 `/api/shifts` | **对齐** |
| 排班管理 `/attendance/schedules` | 智能调度中心 `SchedulingHub` | 参考：**Tabs 双视图**（排班流水 `ScheduleManagement` + AI 智能 `SmartSchedule`），按**部门 × 月份**渲染班次表格，单元格显示班次名/"休"，保存走 `/api/schedules` | **对齐**（已实现部门×月份矩阵：`GET /schedules/matrix` + 前端矩阵表格 + 极速印章/单元格编辑） |
| 我的排班 `/attendance/my-schedule` | 我的排班 `MySchedule` | 参考：个人排班视图 | **对齐** |
| 考勤日报 `/attendance/daily` | 部门考勤报表 `DepartmentStats` | 参考：部门维度考勤报表（出勤/迟到/缺勤） | **对齐**（后端 `GET /attendance/daily` 支持 `departmentId` 部门维度过滤，前端新增部门筛选 + 本地 Excel 导出） |
| 考勤月报 `/attendance/monthly` | `AttendanceStats` + 导出 | 参考支持导出（`server/routes/attendance-export.js`） | **对齐**（后端 `GET /attendance/monthly` 支持 `departmentId` 部门维度过滤，前端新增部门筛选 + 本地 Excel 导出；部门级统计/导出沿用 `reports/attendance-monthly`） |
| 请假 / 加班 / 休假额度 `/attendance/vacation/*` | 假期自助中心 `VacationManagementHub` | 参考：整合假期额度/请假/加班/转调休 | **对齐**（`/attendance/vacation/audit` 考勤申请审计：聚合请假/加班，部门数据隔离 + 状态/类型/关键字/日期筛选 + 详情弹窗审批，复用审批实例端点） |
| 补卡 `/attendance/punch-makeup` | —（考勤有补卡逻辑） | | **对齐**（补卡申请增删改查 + 提交审批 + 状态流转 + 本地 Excel 导出，见 punch-makeup.tsx） |
| 打卡设备 / 定位 / 异常 / 扣款 / 设置 `/attendance/{devices,locations,exception-rules,deduction-rules,settings}` | 考勤设置 `AttendanceSettings` | 参考有考勤设置（含地理围栏配置） | **新增**（多数为参考没有的细分项） |

---

## 四、审批 / 报销 / 薪资

| 当前系统 | 参考对应 | 参考怎么展示/实现 | 状态 |
|---|---|---|---|
| 待办 / 已办 / 我的申请 / 流程设置 / 职责授权 `/approval/*` | 报销相关的 `Reimbursement(Apply/List/Approval)` + 审批中心 | 参考以**报销审批流**为核心，含 `ApproverManagement 审批人管理`、`ApprovalWorkflowConfig 报销流程`、`RoleWorkflowConfig 职责授权`、`WorkflowSettings 资产流程` | **对齐** 已补可配置审批流程 + 按角色授权：新增 `/approval/role-workflow` 职责授权页（角色↔审批流程绑定），发起审批时按申请人角色优先解析绑定流程 |
| 我的报销 `/expense/my`、报销审批 `/expense/approval` | `ReimbursementApply/List/Approval` | 参考：报销申请表单 + 审批链 | **对齐** |
| 报销配置 `/expense/settings`、审批人管理 `/approval/approvers`、职责授权 `/approval/role-workflow` | `ReimbursementSettings`、`ApproverManagement`、`RoleWorkflowConfig` | 参考：报销类型/审批组/角色流程绑定配置 | **对齐** 已拆独立页 |
| 算薪批次 `/payroll/runs` | 工资条管理 `PayslipManagement` | 参考：工资条生成/发放管理 | **对齐**（批次按员工聚合工资构成明细项 + 调整项，`GET /payroll/runs/:id/details` 经数据范围隔离；前端运行批次列表 + `RunDetailsModal` 钻取单员工工资构成/调整项可展开查看 + draft 批次添加调整项，对齐参考单员工薪资构成展示） |
| 我的工资条 `/payroll/my-payslips` | 我的薪资 `MyPayslips` | 参考：个人工资条解析 | **对齐** |

---

## 五、知识库 & 文件预览

| 当前系统 | 参考对应 | 参考怎么展示/实现 | 状态 |
|---|---|---|---|
| 知识库 `/knowledge` | 公共知识库 `Win11KnowledgeBase` / `KnowledgeFolderView` | 参考：**Win11 文件夹/树形结构**展示文章；附件预览用 `FilePreviewModal`（**原生** iframe/img/video + Office 在线） | **对齐**（已改为左侧分类树导航 + 右侧文章列表：`getKnowledgeView` 构建分类树与内容过滤，前端 Arco `Tree` + `List`，关键字/分类筛选 + 分页） |
| 知识库管理 `/knowledge/admin` | 知识库管理 `KnowledgeManagement` + 分类管理 `CategoryManagement` | 参考：文章增删改、分类管理 | **对齐**（分类管理 Tab + 文章管理 Tab：增删改 + 分页；文章编辑弹窗内嵌**附件管理**（列表/新增/删除，批次十二补 `deleteAttachment` + `DELETE /knowledge/articles/:id/attachments/:attId`）） |
| 预览 `/knowledge/preview/[id]` | `FilePreviewModal.jsx` | 参考用**原生弹窗**，零第三方预览依赖 | **对齐**（已改为列表内嵌 `FilePreviewModal`：`getPreviewMode` 分类 image/video/audio/pdf/office/unsupported，原生 img/video/iframe + Office 在线，不支持则下载兜底；移除 `preview/[id]` 路由；Office 仍用 `@open-file-viewer` 客户端渲染，依赖未移除，见 ADR-0015 修订记录） |

---

## 六、绩效 / OKR / 财务 / 工单 / 通知 / 系统

| 当前系统 | 参考对应 | 参考怎么展示/实现 | 状态 |
|---|---|---|---|
| 绩效管理 `/performance/cycles` | — | — | **新增** |
| OKR `/okr` | — | — | **新增** |
| 财务预算 `/finance/budgets`、费用标准 `/finance/expense-standards` | —（参考无预算模块） | — | **新增** |
| 工单客服 `/helpdesk` | —（旧案例库/案例推荐已排除） | | **新增** |
| 我的通知 `/notifications` | 我的通知 `MyNotifications` + 通知中心 `NotificationCenter` | 参考：通知列表 + 未读弹窗 + 发送（`server/routes/notifications.js`） | **对齐**（`/notifications` 列表页：未读数/单条与全部已读/类型标签/发送通知弹窗；顶栏 `NotificationDropdown` 未读弹窗 5 条预览 + 查看全部；后端 `GET /notifications` 支持 read/type 过滤 + unread-count + markRead + read-all + send，批次十一核对） |
| 公告管理 `/system/broadcasts` / 公告查看 `/broadcasts` | 系统广播/发布广播 `BroadcastList`/`BroadcastManagement` | 参考分查看 + 发布 | **对齐**（发布端 `/system/broadcasts`（管理+发布）+ 普通用户公开查看 `/broadcasts`：仅已发布+接收人可见，未读标记/详情/已读；后端 `BroadcastPublicController` + 单测覆盖公开链路） |
| 系统设置 `/settings` | 系统配置 `SystemConfigPage` | 参考为**转换规则(加班转调休比例) + 假期类型**配置 | **对齐**（补可配置项：加班转调休比例 `overtime_to_leave_hours` 接入后端换算替换硬编码 8，前端设置页动态渲染；转换/假期类型其余由考勤模块管理） |
| 个人资料 `/profile` | 个人信息 `PersonalInfo` + 改密 `ChangePassword` | 参考：个人资料 + **重置密码/改密** | **对齐**（`/profile` 含个人信息 Tab + 修改密码 Tab；后端 `POST /auth/change-password` + 限流 + 强度校验/密码不得与用户名混淆，前端 service `authApi.changePassword`） |

---

## 七、缺口清单（旧项目有、当前没有）

> 以下为旧项目有、当前系统尚不具备的功能，若需对齐可参考其实现。已排除用户明确不需要继续跟进的功能（质检、考核/考试、即时通讯/群组、案例库/案例推荐、后勤与设备）。

| 缺口功能 | 参考实现（文件 / 路由） | 说明 |
|---|---|---|
| 员工变动记录独立页 / 入职审批 | `EmployeeChanges` / `EmployeeApproval` | 员工入职/调动/离职流水与审批 `已对齐 /employees/change-logs 员工变动流水（部门维度筛选 + 变动类型 + 关键字 + 分页）` |
| 独立岗位管理页 | `PositionManagement` / `server/routes/positions.js` | 岗位维护 |
| 独立权限管理页 | `PermissionManagement` / `server/routes/permissions.js` | 权限与角色分离 |
| 审批人管理 | `ApproverManagement` / `server/routes/approvers.js` | 报销审批人配置 `已对齐 /approval/approvers` |
| 报销配置 | `ReimbursementSettings` / `server/routes/reimbursement-settings.js` | 报销规则/配置 `已对齐 /expense/settings` |
| 可配置审批流程 / 职责授权 / 资产流程 | `ApprovalWorkflowConfig` / `RoleWorkflowConfig` / `WorkflowSettings`（`server/routes/approval-workflow.js`、`approval-groups.js`） | 按角色/流程定义审批链 `已对齐 /approval/role-workflow` |
| 假期审计 | `CompensatoryApproval` / `server/routes/compensatory-leave.js` | 假期/调休审批 `已对齐 /attendance/vacation/audit 考勤申请审计：GET /attendance/audit 聚合请假/加班 + 状态/类型/部门/关键字/日期筛选（部门数据隔离）+ 详情弹窗审批（通过/驳回）` |
| 通知设置独立页 | `NotificationSettings` / `server/routes/notification-settings.js` | 通知渠道/订阅配置 `已对齐 /notifications/settings`（后端 TDD + 前端分组 Tab，剔除学习考试组） |
| 通知中心发送 | `NotificationSender` / `server/routes/notifications.js` | 全员/部门/指定用户发送 `已对齐 /notifications/send`（后端 `NotificationService.send` + 前端发送弹窗，`system:notification:send` 权限） |
| 汇总 / 导出能力 | `attendance-export` / `excel-export.js` | 报表导出 `已对齐 /reports/employee-list/export（员工列表导出 xlsx/csv）+ 报表中心补员工结构卡片与导出入口` |

---

## 八、关键结论

1. **当前系统大部分功能在参考中都有对应**，但普遍处于**"简化"**状态。差异最明显的三处：
   - **搜索维度**：员工列表参考支持部门/岗位/状态等多维搜索；当前仅"关键字"。
   - **排班**：参考是"部门 × 月份"矩阵视图 + 班次表格；当前是简单表单。
   - **预览**：参考用**原生零依赖弹窗**（img/video/iframe/Office在线）；当前用 @open-file-viewer。
2. **"新增"（参考没有的当前功能）**：员工标签、人员履历、绩效/OKR、财务预算/费用标准、工单客服、考勤的设备/定位/异常/扣款等——按约定暂不跟进。
3. **缺口**集中在审批配置、假期审计、独立岗位/权限/通知设置、报表导出等，参考均有**可复用实现**可照搬。

---

## 九、建议的后续对齐优先级

| 优先级 | 事项 | 参考依据 |
|---|---|---|
| P0 | 员工列表搜索维度补全（部门/岗位/状态） | `AdvancedSearch.jsx` |
| P0 | 文件预览对齐参考原生方案 | `FilePreviewModal.jsx` |
| P1 | 排班改为"部门×月份"矩阵视图 | `SchedulingHub.jsx` / `ScheduleManagement.jsx` |
| P2 | 独立岗位/权限/通知设置/假期审计/审批配置补齐 | 见缺口清单 |