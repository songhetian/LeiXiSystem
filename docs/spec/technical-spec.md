# 雷犀客服管理系统 · 技术规格说明书（Technical Spec）v1.0

> 生成：2026-08-12 ｜ 来源：REFACTOR_PLAN.md + CONTEXT.md + docs/schema + docs/api + ADR 系列
> 定位：本 spec 描述**系统长什么样**（重构后目标态），与 REFACTOR_PLAN（怎么重构）配套。所有内容均已决策确认，未脑补。
> 发布方式：本地 Markdown（docs/agents/issue-tracker.md 配置为 Local Markdown 模式）

---

## 1. 业务说明（Problem Statement / Solution / User Stories）

### 1.1 Problem Statement

旧系统（antd+Vite+Fastify）UI 混乱（三套图标、双主题、手写组件）、功能冗余（15+ 模块、90+ 页面、150+ 表），考勤靠人工统计、工资靠人工计算，无法支撑打卡机自动采集与自动算薪。作为管理员，我无法从"打卡机原始数据"自动得到"员工的正确工资"，导致每月对账耗时且易错。

### 1.2 Solution

从零重构为**纯 Web 内部管理系统**，核心链路：打卡机（熵基 XFace600 HTTP API）→ 打卡流水 → 考勤规则引擎 → 月报结账（锁定快照）→ 自动算薪（试算→确认→发布）→ 工资条员工自助。统一 Arco Design Pro 企业级 UI，公共组件强制复用。

### 1.3 User Stories

**员工（普通用户）**
1. 作为员工，我希望通过打卡机人脸打卡，以便自动记录出勤，无需手动登记。
2. 作为员工，我希望查看我的打卡流水与考勤日报，以便核对出勤是否有异常。
3. 作为员工，我希望在忘记打卡时提交补卡申请并走审批，以便修正考勤记录。
4. 作为员工，我希望在线提交请假/加班申请并跟踪审批状态，以便安排工作与休假。
5. 作为员工，我希望查看我的休假额度余额，以便规划休假。
6. 作为员工，我希望每月查看我的工资条（明细+调整项），以便核对工资构成。
7. 作为员工，我希望在知识库在线预览文档（KKFileView，无需下载），以便快速查阅。

**部门经理**
8. 作为经理，我希望对本部门员工进行排班（月历+批量），以便安排班次。
9. 作为经理，我希望审批本部门员工的请假/加班/补卡申请，以便管理出勤。
10. 作为经理，我希望只看到本部门（含子部门）的考勤与工资数据，以便履行管理职责而不越权。
11. 作为经理，我希望导出本部门考勤月报，以便向 HR 汇报。

**HR / 薪资专员**
12. 作为 HR，我希望维护员工档案（入职/离职/薪资），以便算薪有准确基础数据。
13. 作为 HR，我希望配置班次与考勤规则，以便规则引擎正确判定迟到/早退/加班。
14. 作为 HR，我希望在每月结账前核对考勤异常（缺卡/迟到/申诉中），处理完毕后确认月报，以便锁定结账。
15. 作为 HR，我希望配置薪资项目与计算规则，以便引擎自动计算工资。
16. 作为 HR，我希望发起算薪（试算→抽检→确认→发布），以便工资可复现、可对账。
17. 作为 HR，我希望对个别员工工资做调整项修正（留痕），以便处理结账后的例外情况。
18. 作为 HR，我希望撤回未查看的工资条，以便纠正发布错误。
19. 作为 HR，我希望导出人力成本/考勤月报报表（Excel），以便财务核算。

**系统管理员**
20. 作为管理员，我希望配置角色与权限点（菜单+按钮），以便控制功能可见性。
21. 作为管理员，我希望配置部门数据隔离范围，以便薪资等敏感数据按组织边界收敛。
22. 作为管理员，我希望配置审批流与审批组，以便业务审批按规则路由。
23. 作为管理员，我希望查看操作日志，以便审计追溯。
24. 作为管理员，我希望发布公告/通知，以便触达全员。

---

## 2. 业务算法描述

### 2.1 打卡采集（考勤上下文）

- **输入**：XFace600 设备（HTTP API 增量拉取，LastSyncTime 游标）或 U 盘 CSV 文件。
- **处理**：定时任务（@nestjs/schedule）15 分钟增量拉取 + 每日 00:30 完整性校验；CSV 导入兜底（重复导入报错误码 2003）。
- **输出**：`punch_logs` 原始流水（employee_no/device_no/punch_time/source/status）。
- **边界**：采集层**只落原始流水，不做业务解释**（迟到/早退判定属于规则引擎，防重复实现）。

### 2.2 考勤规则引擎（考勤上下文）

- **输入**：`punch_logs` × 排班（班次规则，含跨天标志 isNextDay）。
- **判定规则**（已确认）：
  - 上班卡 = 当日首次打卡，下班卡 = 当日最后一次打卡；当日打卡 > 4 次标记异常待人工复核（C3）
  - 迟到/早退 = 与班次时间的分钟差（late_minutes/early_minutes）
  - 加班分钟 = min(加班申请时长, 实际超出班次下班后的打卡时长)（C5）
  - 缺卡/请假/补卡状态由审批与补录决定（C4：补卡走审批流，批准后修正日报并留痕）
  - 跨天班次按**班次归属日期**归集（C1）
- **输出**：`attendance_daily` 日报（员工+日期唯一）→ 聚合 `attendance_monthly` 月报（出勤天数/迟到次数/加班小时；入职/离职按实际出勤折算 C2）。
- **结账**：月报确认（confirmed）后锁定，作为算薪快照（ADR-0011）。

### 2.3 算薪引擎（薪资上下文）

- **输入**：已确认的 `attendance_monthly` 快照 + 请假/加班记录 + `salary_items` 配置 + 员工工资档案（employees.salary 等）。
- **计算规则**（已确认 A1）：

| 项目 | 规则 |
|---|---|
| 基本工资 | 固定值（employees.salary） |
| 加班费 | 平日 1.5 / 休息日 2 / 法定节假日 3 倍（按小时）；**小时基数 = 基本工资 ÷ 21.75 ÷ 8（标准月计薪天数，已确认）**；时长取 min(申请,实际) |
| 缺勤扣款 | 基本工资 ÷ 当月应出勤天数 × 缺勤天数；**请假天数计入缺勤扣款（统一口径，后续可按休假类型细分，已确认）** |
| 全勤奖 | 当月无迟到/无缺卡/无请假（有薪假除外）→ 固定金额 |
| 补贴（餐补等） | 固定金额或按出勤天数 |
| 社保/公积金代扣 | 按员工档案配置固定金额 |
| 调休转换 | 1:1（加班 1 小时 = 调休 1 小时） |

> ✅ 2026-08-12 经原型验证补充：加班小时基数 21.75、请假计入缺勤扣款、跨天班次加班按班次结束时间判定（超时分钟数计加班）——均由原型 engine-demo.mjs 23 项断言验证。

- **流程**：月结 → 汇总 → 逐项计算 → **试算**（逐人核对，差异高亮）→ **确认**（强制人工抽检 3 人）→ **发布**生成工资条 → 员工自助查看。
- **例外通道**（ADR-0011）：结账后发现的漏卡等**不回头改月报**，走 `payroll_adjustments` 调整项（员工/项目/金额/原因/操作人）；**最终工资 = 锁定快照计算值 + 调整项**。
- **状态机**：payroll_runs：`draft → confirmed → published / recalled`；撤回仅限员工未查看（C7），已查看走补发/更正。

### 2.4 额度换算（考勤上下文）

- 请假扣减休假额度；调休 1:1 兑换；加班转换产生调休额度；余额不可为负。

### 2.5 审批路由（协同上下文）

- 补卡、请假、加班、报销、员工异动发起审批；按审批流（角色/审批组）路由；审批记录留痕。

---

## 3. 数据库 Schema

### 3.1 新增表（7 张）

| 表 | 用途 | 关键字段（详见 docs/schema/new-tables.md） |
|---|---|---|
| punch_logs | 原始打卡流水 | employee_no, device_no, punch_time, punch_type, source, status |
| attendance_daily | 考勤日报（聚合根） | employee_id+work_date 唯一, shift_id, first/last_punch, late/early/overtime_minutes, status, makeup_reason |
| attendance_monthly | 考勤月报（快照） | employee_id+month 唯一, work_days, late_count, absent_days, overtime_hours, status(draft/confirmed) |
| salary_items | 薪资项目 | code 唯一, type(fixed/per_day/per_hour/formula/deduction), amount/rate/formula |
| payroll_runs | 算薪批次（聚合根） | month 唯一, status(draft/confirmed/published/recalled), 确认/发布人 |
| payroll_details | 工资明细 | run_id+employee_id+item_code 唯一, amount, source_ref（项目快照防改名影响历史） |
| payroll_adjustments | 算薪调整项 | run_id, employee_id, item_code, amount(可正负), reason, created_by |

### 3.2 保留核心表（Step 1 prisma db pull 后整理命名/索引）

- **组织**：users、employees、departments、positions、roles、permissions、user_roles、role_permissions、user_departments
- **考勤**：shifts、schedules、shift_schedules、leave_records、overtime_records、compensatory_leave_requests、vacation_balances、vacation_types、vacation_balance_changes、makeup_records、holidays
- **薪资**：payslips（导入式保留为兜底，B5）
- **审批**：approval_workflows、approval_workflow_nodes、approvers、approval_records、approval_groups
- **财务**：reimbursements、reimbursement_items、reimbursement_types
- **培训**：knowledge_articles、knowledge_categories、knowledge_attachments、knowledge_learning_*（学习计划/任务保留）
- **系统**：notifications、notification_*、broadcasts、broadcast_recipients、operation_logs、todo_*

### 3.3 删除表（随功能删除，ADR-0005）

- 聊天（chat_*/conversation*/messages/groups 等）、质检（quality_* 约 15 张）、资产/库存/设备（asset_*/inventory_*/device_*/devices）、案例库（cases/case_*）、考试（assessment_*/exam_*/answer_records/questions）、备份表（shift_schedules_backup* 6 张）

### 3.4 数据迁移（A5/ADR-0008）

- 保留：全部员工、全部工资条历史、近 12 个月考勤与报销；更早考勤归档不迁。映射脚本 + 迁移后抽样对账。

---

## 4. 后端接口（REST 契约摘要，完整见 docs/api/core-contracts.md）

- **通用**：Base `/api/v1`；响应 `{ code, message, data }`；分页 `?page&pageSize`；排序 `?sort=-field`；错误码 4 位（10xx 员工/20xx 考勤/30xx 薪资/40xx 报销/50xx 认证/60xx 文件）。
- **auth**：`POST /auth/login`、`POST /auth/refresh`、`GET /auth/me`、`POST /auth/logout`；JWT httpOnly cookie + CSRF token（E1）。
- **employees**：CRUD、`POST /employees/:id/resign`（离职）、`POST /employees/import`、`GET /employees/export`；工号唯一（1001）、手机号格式（1003）。
- **attendance**：`GET /attendance/daily|monthly`（范围筛选）、`POST /attendance/makeup`（补卡）、`GET|POST /shifts`、`GET|POST /schedules`（+`/batch` 批量）、`GET|POST /leave-records`、`GET|POST /overtime-records`、`POST /attendance/punch/import`、`POST /attendance/punch/sync`（XFace600 增量拉取）。
- **payroll**：`GET|POST /payroll/items`（+PATCH）、`POST /payroll/runs`（月份唯一 3001）、`GET /payroll/runs`、`GET /payroll/runs/:id/details`（试算明细）、`POST /payroll/runs/:id/adjust`、`POST /payroll/runs/:id/confirm|publish|recall`、`GET /payslips/me`（员工自助）、`GET /payslips`（管理）。
- **数据隔离**（ADR-0010）：所有列表/详情/报表在 Service 层注入"可见部门范围"过滤（超管/HR 全量、经理本部门含子部门、员工仅本人）；越权返回 5003。

---

## 5. 前端页面功能交互

### 5.1 布局（Arco Pro 标准，第 11 章强制）

左侧可折叠菜单 + 顶部栏（面包屑/用户区）+ 内容区 + 多标签页签；页面统一 `PageContainer`；列表统一 `ProTable`（搜索/表格/分页/导出一体，内部为 Refine useTable → Arco Table 适配层，ADR-0007）。

### 5.2 页面清单

| 模块 | 页面 |
|---|---|
| 认证 | 登录（403/404/500 统一 Result） |
| 工作台 | Dashboard（Statistic 卡片 + bizcharts 图表） |
| 员工 | 员工列表（部门过滤）、员工详情、新增/编辑（ModalForm）、导入导出 |
| 考勤 | 班次管理、排班（**月历视图 + 批量排班**，拖拽后续迭代）、打卡流水（筛选+异常标记+补卡入口）、请假、加班、补卡审批、休假额度 |
| 薪资 | 薪资项目配置、**算薪批次（试算页：逐员工行明细/展开/差异高亮/抽检 3 人确认/发布/撤回）**、工资条管理、工资条自助 |
| 报销 | 申请、列表、审批 |
| 培训 | 知识库（列表/详情/编辑，附件 **KKFileView iframe 预览**） |
| 系统 | 用户、角色、权限点、审批流、操作日志、公告、通知、个人中心 |

### 5.3 关键交互约定

- 危险操作（删除、清空、**发工资**）Modal 二次确认。
- 表单：Zod 即时校验、提交 loading、成功/失败 message。
- 报表导出：<1 万行同步下载；>1 万行异步任务 + 完成通知（D3）。
- 空态/加载态（Skeleton）/错误态（Result）全站统一。
- 按钮级权限经统一 `<PermissionGate>`，页面不散写权限判断。

### 5.4 公共组件（Step 3 先建齐再写页面）

PageContainer、ProTable、SearchForm、ModalForm、StatusTag、AsyncSelect、UploadImage、EmptyState/ResultState、ConfirmButton。

---

## 6. 非功能需求

### 6.1 性能
- 列表页首屏 ≤ 2s（P75，内网环境）；长列表虚拟滚动；图片懒加载；路由级 code splitting。
### 6.2 安全
- 认证：JWT access 2h（httpOnly + SameSite=Lax）+ refresh 7d 旋转；写操作 CSRF token 校验（E1）。
- 权限：RBAC（菜单+按钮）+ 部门数据隔离（后端过滤，ADR-0010）。
- 文件：图片 OSS 直传（STS 临时凭证）；附件后端代理鉴权（ADR-0009）；KKFileView 预览 URL 后端签发签名（ADR-0012）。
- 敏感：工资条仅本人/HR 可见；操作日志留痕；.env 凭据不入库。
### 6.3 可用性与一致性
- 全站 token 驱动；操作 3s 内反馈；错误信息统一（错误码体系）。
### 6.4 数据
- 金额 decimal 两位小数（禁浮点）；日期统一 dayjs/ISO；打卡流水保留 3 年、考勤月报与工资条永久（E3）。
### 6.5 部署
- 纯 Web：Node 服务（pm2/Docker）+ KKFileView（Java+LibreOffice，端口 8012）+ Nginx 反代 + HTTPS；生产库阿里云 RDS、文件阿里云 OSS。
### 6.6 合规与审计
- 算薪批次状态机全程留痕（确认/发布/撤回人+时间）；调整项必填原因与操作人；操作日志覆盖核心写操作。

---

## 7. 测试决策（Testing Decisions）

- **好测试标准**：只测外部行为（输入 → 输出），不测实现细节。
- **测试 seams**（由高到低，尽量复用，理想 1 处核心）：
  1. **算薪引擎**（最高 seam，纯函数）：输入 = 已确认月报快照 + salary_items 配置 + 员工档案 → 输出明细/汇总。**对账样例作为回归基线**（3 名员工的已知期望结果）。
  2. **考勤规则引擎**（纯函数）：输入 = 打卡流水 × 排班 → 输出日报（含迟到/早退/加班/跨天/多次打卡样例）。
  3. **API 层**（NestJS supertest e2e）：auth 流程、RBAC 403、**部门数据隔离**（经理越权查他人数据 → 5003）。
  4. **前端 E2E**（Playwright）：登录 → 员工 → 考勤 → 算薪 → 工资条 全链路。
- 工具：Vitest（引擎单测）+ supertest（API e2e）+ Playwright（前端 E2E）。
- ✅ **测试 seams 已于 2026-08-12 经用户确认**：算薪引擎为最高核心 seam，3 名员工对账样例作为回归基线；考勤规则引擎、API e2e（含部门数据隔离用例）、前端 Playwright E2E 一并确认。

---

## 8. Out of Scope（不包含）

- 移动端适配（桌面优先 1440px/1280px）
- 已删除功能：聊天、质检、资产/库存/设备、案例库、考试
- 拖拽排班、实时在线人数、多语言 i18n、Redis 缓存、消息队列
- 人脸数据管理（打卡机本地完成，系统只接收考勤结果）

## 9. Further Notes

- 本 spec 与 REFACTOR_PLAN.md 同步演进；任何变更先更新源头文档（CONTEXT.md / ADR / schema / api），再改 spec。
- 实现顺序按 docs/tickets/（step-0 → step-5）执行。
