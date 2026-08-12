# 雷犀客服管理系统 · 重构方案 v2.0（技术栈换血版）

> 编写日期：2026-08-12（v2 修订同日）
> 目标读者：开发者本人（后续按本文档逐阶段执行重构）
> 核心原则：**先定数据，再造后端，再搭前端，最后加新功能**。每一步可交付、可回滚，不搞一次性大爆炸。

---

## 目录

1. [v2 变更记录](#1-v2-变更记录)
2. [现状诊断：问题清单](#2-现状诊断问题清单)
3. [目标技术栈（已确认 + 补全）](#3-目标技术栈已确认--补全)
4. [可行性评估（逐项结论）](#4-可行性评估逐项结论)
5. [功能去留决策表（v2）](#5-功能去留决策表v2)
6. [新增功能设计（不变）](#6-新增功能设计不变)
7. [新架构设计](#7-新架构设计)
8. [数据库重构](#8-数据库重构)
9. [分阶段实施路线图（v2）](#9-分阶段实施路线图v2)
10. [风险与注意事项（v2）](#10-风险与注意事项v2)
11. [UI 规范（Arco Design Pro 企业级标准 · 强制执行）](#11-ui-规范arco-design-pro-企业级标准--强制执行)

---

## 1. v2 变更记录

| 项 | v1 决策 | v2 决策（本次） |
|---|---|---|
| UI 组件库 | Ant Design 5 | **Arco Design Pro**（字节跳动） |
| 前端框架 | React + Vite（沿用） | **Next.js（App Router）+ TypeScript** |
| 数据请求 | 自研 API 层 | **Refine + React Query（Refine 内置）** |
| 后端框架 | Fastify（沿用） | **NestJS + Fastify adapter** |
| 数据库访问 | mysql2 裸 SQL | **Prisma ORM** |
| 参数校验 | 无统一方案 | **Zod（前后端共用）** |
| 案例库 | 保留 | **删除** |
| 库存/设备 | 随资产删除 | **确认删除** |
| 公告 | 保留 | **确认保留** |
| 部署形态 | Electron 桌面端 | **改纯 Web（已拍板）**：Node 服务 + 浏览器访问，放弃 Electron 壳 |
| 生产环境 | — | **阿里云 RDS（MySQL 8）+ 阿里云 OSS**（原"res 和 oss"实为 RDS + OSS） |
| Refine | — | **确认保留**（官方 @refinedev/nestjsx-crud 专配 NestJS） |

---

## 2. 现状诊断：问题清单

（同 v1，结论不变：UI 三库混用、双主题、90+ 页面、91 路由、150+ 表、废弃文件。详见 git 历史 v1 文档第 1 章。）

补充一条：**现有全部代码将按 v2 技术栈重写**，因此 v1 的"渐进替换 antd"路线作废，改为"新架构从零搭建 + 业务逻辑移植"。

---

## 3. 目标技术栈（已确认 + 补全）

### 3.1 前端 `apps/web`（Next.js + TypeScript）

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | **Next.js（App Router）+ TypeScript 5** | 服务端组件 + 客户端组件混合 |
| UI | **Arco Design（@arco-design/web-react）** | 字节出品，配合 Pro 布局模板 |
| 脚手架 | **Arco Design Pro（arco-cli 生成 Next.js 模板）** | 官方支持 Next 模板，自带布局/主题/i18n/mock |
| 数据层 | **Refine（@refinedev/core + @refinedev/nextjs-router + @refinedev/nestjsx-crud）** | Refine 内部基于 React Query；nestjsx-crud 专配 NestJS 后端 |
| 表单 | Refine useForm（基于 react-hook-form）+ @hookform/resolvers/zod | |
| 校验 | **Zod** | schema 放共享包，前后端共用 |
| 状态管理 | zustand | 仅存 UI 级全局状态（侧边栏、主题等） |
| 图表 | **bizcharts**（跟 Arco Pro 模板，G2 生态） | 已拍板（原"或 recharts 二选一"作废） |
| 日期 | dayjs | Arco 默认日期库，无冲突 |
| Markdown | react-markdown + remark-gfm | 知识库用 |
| 文档预览 | **KKFileView**（iframe 嵌入在线预览，doc/xls/ppt/pdf 等 30+ 格式） | 知识库附件预览，自托管服务，见 ADR-0012 |
| 实时通知 | socket.io-client | 公告/通知/待办推送 |
| 样式 | Arco 主题变量（DesignLab 定制），**不再引入 Tailwind** | 消灭样式双轨 |
| 表格 | **ProTable（Refine useTable → Arco Table 自写适配层）** | Refine 官方无 Arco 包，见 ADR-0007 |

### 3.2 后端 `apps/server`（NestJS + TypeScript）

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | **NestJS + @nestjs/platform-fastify** | 官方 Fastify 适配器，性能优于默认 Express |
| ORM | **Prisma + MySQL 8** | schema 即文档，迁移可追踪，类型安全 |
| 校验 | **Zod**（封装 ZodValidationPipe 全局管道） | 替代 NestJS 惯用的 class-validator，与前端共享 schema |
| 认证 | @nestjs/jwt + 自定义 JwtAuthGuard | RBAC 沿用现有权限模型，权限点照搬 |
| 实时 | @nestjs/websockets + socket.io | 通知/公告推送 |
| 定时任务 | @nestjs/schedule | 替代 node-cron，用于打卡机定时同步 |
| 配置 | @nestjs/config | 读取 .env |
| 日志 | **pino**（配合 Fastify） | 已拍板（原"或 Nest Logger 二选一"作废） |
| 缓存 | ioredis（现有 Redis） | **生产暂不引入**（B6）：JWT 无状态 + 黑名单落库 + 同步状态落库；有明确需求再引入 |
| 对象存储 | **ali-oss（保留现有）** | 图片前端直传（STS）+ 附件后端代理，见 ADR-0009 |
| Excel | exceljs（保留） | 报表导出 |
| 文件上传 | multipart（后端代理附件）+ OSS STS（图片直传） | 混合策略见 ADR-0009 |

### 3.3 共享包 `packages/shared`

- **Zod schemas**（员工/考勤/薪资/审批等 DTO，前后端共用，类型自动推导）
- 常量、枚举、工具函数（金额计算、日期处理）

### 3.4 基础设施

| 项 | 选型 |
|---|---|
| 缓存/实时 | Redis（本地开发用；**生产暂不引入**，见 B6） |
| 对象存储 | 阿里云 OSS（现有） |
| 数据库（生产） | **阿里云 RDS（MySQL 8）**——用户确认生产环境为 RDS + OSS |
| 部署 | **已拍板：纯 Web** = Node 服务（pm2/Docker）+ Nginx 反代 + HTTPS |
| 文档预览服务 | **KKFileView**（独立 Java 服务，LibreOffice 转换，默认端口 8012） | 知识库附件在线预览，见 ADR-0012 |

### 3.5 工程化

| 项 | 选型 |
|---|---|
| 包管理 | **pnpm workspace 单仓库**（apps/web + apps/server + packages/shared） |
| 代码规范 | ESLint + Prettier |
| 提交规范 | husky + lint-staged + commitlint |
| 测试 | Vitest（单测）+ Playwright（E2E，现有依赖可复用） |
| 版本管理 | git，每阶段独立 commit |

---

## 4. 可行性评估（逐项结论）

### 4.1 ✅ 已拍板：Electron 桌面端 × Next.js 冲突 → 改纯 Web

Next.js 是**服务端渲染框架**，与 Electron 桌面壳天然冲突。原三种出路：

| 方案 | 做法 | 评价 |
|---|---|---|
| **A. 改纯 Web（已选定）** | 部署 Node 服务，浏览器访问 | ✅ 最省事，Next.js/Refine 全部特性可用；内网系统浏览器访问即可 |
| B. Electron 壳 + 本地 Next 服务 | Electron 启动时拉起 Next standalone 服务再加载 | 打包体积大、升级繁琐、双进程调试痛苦 |
| C. Next 静态导出塞 Electron | `output: 'export'` 打包 | ❌ 失去 SSR/API 意义，等于白换 Next.js |

**结论：选 A（纯 Web），已拍板。** 内部管理后台用浏览器访问即可；打卡机是独立硬件（走网络/数据库直连，由后端定时拉取），不需要桌面端本地能力。部署形态 = Node 服务（pm2/Docker）+ Nginx 反代 + HTTPS。

### 4.2 逐项结论

| 你的选型 | 结论 | 依据 / 注意点 |
|---|---|---|
| **Arco Design Pro** | ✅ 可行 | arco-cli 官方支持 Next.js 模板（arco-design-pro-next）；字节自用（火山引擎/头条），生态活跃，中文文档完整。⚠️ 注意：① 其 Next 模板基于旧版 Pages Router，需自行升级 App Router 或直接用 Vite 模板改造；② 对 React 19 的兼容跟进慢于 antd，建议 Next.js 固定 React 18；③ "Pro"提供的是布局/模板，Refine 是数据层，两者不冲突 |
| **NestJS + Fastify** | ✅ 可行 | 官方适配器 @nestjs/platform-fastify。⚠️ 注意：这是**后端重写**（现有 91 个 Fastify 路由文件需按 Nest 的模块/控制器/服务结构重写）；学习曲线比裸 Fastify 陡（DI/装饰器/模块），但长期工程收益大 |
| **Prisma + MySQL** | ✅ 强烈支持 | 相对 mysql2 裸 SQL 是巨大改进：schema 即文档、迁移可追踪、类型安全。⚠️ 顺序：先删表（第 8 章）再造 schema，否则 150+ 张废弃表全进 Prisma |
| **Refine + Next.js** | ✅ 可行（官方支持） | Refine v4/v5 官方支持 Next.js App Router（@refinedev/nextjs-router），SSR 可用；且有 @refinedev/nestjsx-crud 专配 NestJS 后端，官方推荐组合。⚠️ 注意：Refine **内部就是基于 React Query** 的，无需再显式引入 @tanstack/react-query 重复写数据层；统一用 Refine 的 useList/useTable 即可 |
| **Zod** | ✅ 可行 | 前端表单校验 + 后端 DTO 校验统一用 Zod，schema 放 packages/shared 前后端共享。NestJS 侧封装一个 ZodValidationPipe（官方文档有 zod 示例） |
| **RDS + OSS** | ✅ 保留 | 生产环境为**阿里云 RDS（MySQL 8）+ 阿里云 OSS**（已确认）；Prisma 直连 RDS 连接串即可；OSS 继续用于文件存储 |

> 注：原"res 和 oss"已确认为**阿里云 RDS（云数据库 MySQL）+ OSS（对象存储）**，不是 Redis 也不是阿里云 RES。Redis 仅本地开发/按需引入。

### 4.3 总体结论

**方案可行，且是"正规军"路线**——NestJS + Prisma + Refine + Next.js 均有官方支持或官方推荐配对，Arco 也有 Next 模板，不是天马行空。

但必须认清一点：
1. **这是重写，不是重构**：存量代码（antd 页面、Fastify 路由、mysql2 SQL）大部分作废。工作量约为渐进重构的 2~3 倍。好在删除 4 大功能后，实际要移植的业务模块约剩一半，且新功能（打卡机/算薪）本就要新写。

> ✅ **Electron 冲突已解决**：已拍板改纯 Web（见 4.1），部署 = Node 服务（pm2/Docker）+ Nginx 反代 + HTTPS，浏览器访问。

---

## 5. 功能去留决策表（v2）

### 5.1 删除（已确认）

| 功能模块 | 涉及前端 | 涉及后端路由 | 涉及数据库表（示例） |
|---|---|---|---|
| **聊天功能** | `pages/Messaging/*`、`WeChatPage`、`GroupManagement`、`CreateGroup`、聊天 hooks | `chat.js` 等 | `chat_*`、`conversations`、`conversation_members`、`session_messages`、`messages`、`message_status`、`groups`、`group_members`、`collected_messages` |
| **质检功能** | `QualityInspection`、`QualityReportPage`、`QualityStatisticsPage`、`QualityRuleManagementPage` | `quality-*.js`（约 6 个） | `quality_*` 全部（约 15 张） |
| **资产管理** | `pages/Finance/Assets/*`、`pages/Finance/Inventory/*`、`pages/Logistics/DeviceList`、`MyAssets` | `assets.js` 等 | `assets`、`asset_*`、`inventory_*`、`device_*`、`devices` |
| **案例库** | `CaseLibraryPage`、`CaseCategoryManagementPage`、`CaseDetailPage`、`CaseRecommendationPage` | `case-categories.js`、`cases.js` 相关 | `cases`、`case_*` 全部、`crm_customers`（若仅案例库用） |
| **库存/设备** | 见资产管理 | 见资产管理 | `inventory_*`、`devices`、`device_*` |
| **考试/测评**（新增删除） | `pages/Assessment/*`（19 页）、`components/Exam*`、`QuestionNav`、`PaperSelectorModal` | `assessment-plans.js`、`assessment-results.js`、`exams.js`、`exam-categories.js` | `assessment_plans`、`assessment_results`、`answer_records`、`exams`、`exam_categories`、`exam_category_audit_logs`、`questions` |

### 5.2 保留（核心主线）

| 模块 | 说明 |
|---|---|
| 员工管理 / 部门 / 职位 | 算薪基础数据 |
| 考勤（班次、排班、打卡、请假、加班、调休、休假额度） | **第一主线**，打卡机接入后全串起来 |
| 报销 | 财务闭环，保留 |
| 工资条（导入式） | 保留，后续升级为自动算薪生成 |
| 知识库 | 保留，独立为"培训中心"（**考试模块已删除**；在线文档用 **KKFileView** 预览） |
| **公告**（确认保留） | 独立于聊天，保留 |
| 通知 / 待办 / 个人中心 | 保留 |
| 系统管理（角色权限、审批流、操作日志、用户管理） | 保留，重构期整理规范 |

### 5.3 新增（见第 6 章）

1. 打卡机接入（核心）
2. 自动算薪引擎（核心）
3. 报表中心（考勤月报 / 人力成本 / 工时统计）

---

## 6. 新增功能设计（已确认细节）

### 6.1 打卡机接入（三档渐进 + adapter）

```
打卡机 ──(档位1 CSV导入 / 档位2 DB直连定时同步 / 档位3 SDK-API)──► 采集适配层(server/services/punch)
   ──► punch_logs 原始流水 ──► 考勤规则引擎（班次匹配/迟到/早退/缺卡/加班）
   ──► attendance_daily 日报 ──► attendance_monthly 月报 ──► 算薪引擎
```

- adapter 模式：每种接入方式一个 adapter，统一输出标准流水结构；@nestjs/schedule 定时同步
- **打卡机已确认：熵基科技 XFace600（A6）**：
  - 主路径：设备 **HTTP API**（局域网，官方支持标准 HTTP API + LastSyncTime 增量同步）→ Node 定时任务（15 分钟增量拉取 + 每日凌晨完整性校验）
  - 兜底：U 盘导出 CSV 导入（档位 1）
  - 不需要数据库直连档位；WebSocket 实时推送留作后续增强

### 6.2 自动算薪引擎（工资计算规则 · 已确认 A1）

| 薪资项目 | 计算规则 |
|---|---|
| 基本工资 | 固定值（employees.salary） |
| 加班费 | 平日 1.5 / 休息日 2 / 法定节假日 3 倍（按小时，**基数=基本工资÷21.75÷8**，min(申请,实际)，C5） |
| 缺勤扣款 | 基本工资 ÷ 当月应出勤天数 × 缺勤天数（**请假计入缺勤扣款**；C2：入职/离职按实际出勤折算） |
| 全勤奖 | 当月无迟到、无缺卡、无请假（有薪假除外）→ 固定金额 |
| 补贴（餐补等） | 固定金额或按出勤天数 |
| 社保/公积金代扣 | 按员工档案配置的固定金额 |
| 调休转换 | 1:1（1 小时加班 = 1 小时调休） |

> ✅ 2026-08-12 原型验证补充：加班基数 21.75、请假计入缺勤、跨天班次加班按班次结束时间判定（详见 6.3）。

**计算流程（试算 → 确认 → 发布）：**

```
月结 ──► 汇总考勤/请假/加班 ──► 按 salary_items 逐项计算 ──► 试算（逐人核对，D1）
   ──► 确认（强制人工抽检 3 人）──► 发布生成工资条 ──► 员工自助查看
```

- 试算人工调整：写 `payroll_adjustments` 表（员工/项目/金额/原因/操作人），不覆盖计算明细（C6）
- 发布后撤回：仅限员工未查看状态；已查看走"补发/更正"流程（C7）
- **结账前后双通道（ADR-0011）**：算薪引擎只消费**已确认（confirmed）的考勤月报快照**，不读实时打卡数据；结账前漏卡/迟到走补卡审批修正日报，结账后发现的例外**不回头改月报**，走 `payroll_adjustments` 调整项修正工资（工资 = 锁定快照 + 调整项，留痕可审计）
- 新增表字段见 `docs/schema/new-tables.md`

### 6.3 考勤边界场景（已确认 C1-C5）

| 场景 | 规则 |
|---|---|
| 跨天班次（夜班） | 班次支持"次日结束"标志，考勤按班次归属日期归集；**加班按班次结束时间判定，超时分钟数计加班（原型已验证）** |
| 同日多次打卡 | 早班取首次为上班卡、最后一次为下班卡；次数 > 4 标记异常复核 |
| 打卡机故障/补卡 | 补卡走审批流，批准后人工写入日报并留痕（补卡人/原因） |
| 加班与打卡不一致 | 加班时长 = min(申请时长, 实际超出下班后的打卡时长) |
| 请假与缺勤 | 请假天数计入缺勤扣款（统一口径，后续可按休假类型细分） |

### 6.4 报表中心

- 考勤月报 / 人力成本报表 / 工时统计
- 导出：<1 万行同步导出；大数据走异步任务 + 完成通知下载（D3）

### 6.5 API 契约与错误码（已确认 A3/A4）

见 `docs/api/core-contracts.md`（统一响应 `{code,message,data}`、4 位业务码、分页/排序规范、四核心模块契约）。

---

## 7. 新架构设计

### 7.1 单仓库结构（pnpm workspace）

```
lei-system/
  apps/
    web/                 # Next.js + Arco + Refine（前端）
    server/              # NestJS + Fastify + Prisma（后端）
  packages/
    shared/              # Zod schemas、常量、工具（前后端共用）
  pnpm-workspace.yaml
```

### 7.2 后端模块划分（NestJS Modules）

```
server/src/
  main.ts                # bootstrap（Fastify adapter + ZodValidationPipe + 日志）
  app.module.ts
  modules/
    auth/                # 登录、JWT、权限守卫（RBAC）
    employees/           # 员工、部门、职位
    attendance/          # 考勤：班次、排班、请假、加班、调休、休假
    punch/               # 打卡机采集 adapter（CSV/DB直连/API）+ 打卡流水
    payroll/             # 薪资项目、算薪引擎、工资条、报表
    expense/             # 报销
    training/            # 知识库（文章/分类/附件，在线预览对接 KKFileView）
    notifications/       # 通知、公告、待办
    system/              # 用户、角色、权限点、审批流、操作日志
  prisma/                # schema.prisma + migrations
```

### 7.3 前端结构（Next.js App Router + Refine）

```
web/src/
  app/                   # App Router 路由（layout、login、dashboard、各模块页）
  components/            # 业务组件
  features/              # 各模块（attendance/payroll/...）内的页面 + hooks
  providers/             # Refine Provider、Arco ConfigProvider、AuthProvider
  lib/                   # api client、工具
```

- Refine 的 `resources` 与 NestJS 后端通过 `@refinedev/nestjsx-crud` 对接；
- 菜单由 Refine resources + 权限动态生成；
- 认证：前端 AuthProvider 对接 NestJS `/auth` 接口，JWT 存 cookie/httpOnly；
- **认证细节（E1）**：access token 2h（httpOnly + SameSite=Lax）+ refresh token 7d 旋转；写操作接口 CSRF token 校验；登出后 token 黑名单落库（B6 不依赖 Redis）。

---

## 8. 数据库重构

1. **随功能删除表**：聊天、质检、资产/库存/设备、案例库相关表全部删除（见 5.1）。
2. **删除备份表**：`shift_schedules_backup` 系列 6 张。
3. **合并冗余**：`vacation-balance` 与 `vacation-type-balances` 二选一。
4. **新增表**：`punch_logs`、`attendance_daily`、`attendance_monthly`、`salary_items`、`payroll_runs`、`payroll_details`、`payroll_adjustments` —— **字段草案见 `docs/schema/new-tables.md`（v0.1，已确认 A2）**。
5. **数据迁移（A5 / ADR-0008）**：保留全部员工、全部工资条历史、近 12 个月考勤与报销；写 legacy→新库映射脚本（字段映射表），迁移后抽样对账。
6. **Prisma 化**：清理 + 迁移完成后，用 `prisma db pull` 生成 schema，再手工整理命名/关系/索引，后续一律 `prisma migrate`。
7. **纪律**：所有变更走迁移文件；每次重构前 mysqldump 备份。

---

## 9. 分阶段实施路线图（v2）

> 每个阶段结束系统必须可运行、可回滚。一次只做一件事。
> 注意：v2 是"新架构从零搭建 + 业务移植"，旧代码仓库建议**保留为独立分支**，新架构另起（或同仓库新建 apps/ 目录），不要原地改动旧代码。

### Step 0 · 决策与准备（0.5 天）
- [x] **拍板 4.1：改纯 Web**（已确认，放弃 Electron）
- [x] 确认生产环境：**阿里云 RDS（MySQL 8）+ 阿里云 OSS**（已确认）
- [ ] git 分支 `refactor-v2`，mysqldump 全量备份
- [ ] 安装 pnpm；用 arco-cli 生成 Next 模板体验；NestJS CLI 起一个最小骨架跑通 Fastify adapter

### Step 1 · 数据层（1-2 天）
- [ ] 按第 8 章删表（写 SQL 迁移，备份先行）
- [ ] 清理后 `prisma db pull` 生成 schema，整理命名/关系/索引
- [ ] `prisma migrate` 建立基线
- [ ] 编写核心 Zod schemas（员工/考勤/薪资/审批）到 packages/shared

### Step 2 · 后端移植（1-2 周）
- [ ] NestJS 骨架：Fastify adapter、ZodValidationPipe、日志、配置、JWT 认证 + RBAC 守卫
- [ ] 按模块逐个移植（优先级：auth → employees → attendance → payroll → expense → system）
- [ ] 通知/公告 Socket.IO 网关
- [ ] 验收：核心接口用 Postman/Apifox 跑通

### Step 3 · 前端搭建（1-2 周）
- [ ] Next.js + Arco Pro 布局（侧边栏/顶栏/主题）
- [ ] Refine 接入：AuthProvider + nestjsx-crud dataProvider + resources 定义
- [ ] 页面移植（优先级同后端：考勤 → 员工 → 薪资 → 报销）
- [ ] 验收：登录 → 员工 → 考勤 → 工资条全链路可用

### Step 4 · 新功能（打卡机 + 算薪，2-4 周按需分步）
- [ ] 打卡流水：先 CSV 导入（兜底），再按实际机器接 DB 直连 / API
- [ ] 考勤规则引擎：班次匹配、迟到/早退/缺卡/加班，出日报/月报
- [ ] 算薪引擎：薪资项目配置 → 试算 → 确认 → 工资条发布
- [ ] 报表中心：考勤月报 + 人力成本（Excel 导出）
- [ ] 验收：打卡数据 → 工资条全链路跑通，抽 3 名员工人工对账一致

### Step 5 · 收尾
- [ ] 旧代码清理确认（不再需要后删除分支）
- [ ] 部署上线（纯 Web：pm2/Docker + Nginx；HTTPS）

---

## 10. 风险与注意事项（v2）

1. **Electron × Next.js 冲突**：已拍板改纯 Web，此风险解除（旧桌面端停止维护，不迁移）。
2. **这是重写**：工作量按渐进重构的 2~3 倍预估；好处是旧债（混乱组件/重复代码）一次性清零。
3. **NestJS 学习曲线**：先读官方 Overview（模块/控制器/服务/守卫/管道），不求全懂，边写边查。
4. **Arco 注意点**：Pro 模板是旧版 Pages Router，升级 App Router 时布局/鉴权代码要重写；React 19 兼容未跟进，固定 React 18；图表跟模板走 bizcharts，不再混 recharts。
5. **Refine 别叠加 React Query**：Refine 内置 React Query，统一用 Refine hooks，避免两套数据写法。
6. **Prisma 顺序**：先删表再 pull schema，否则垃圾表全进来。
7. **数据备份优先**：任何删表先 mysqldump；删表写迁移文件而非手动 DROP。
8. **对账验证**：算薪上线前必须与人工工资表对账，宁可慢一周，不可错发一次。
9. **删除边界已确认**：聊天/质检/资产/库存/设备/案例库删除；公告保留。

---

## 11. UI 规范（Arco Design Pro 企业级标准 · 强制执行）

> 本章为**强制性规范**（MUST），重构期间所有页面/组件必须遵守。违反本章规范的代码视为缺陷，验收不过。

### 11.1 总原则

1. **唯一 UI 库**：组件一律使用 `@arco-design/web-react`。禁止手写基础组件（Modal/Confirm/Toast/Loading/Tag 等）、禁止引入任何其他 UI 库、禁止内联 style 堆砌实现布局。
2. **以 Arco Design Pro 为骨架**：布局、导航、页面结构严格以 arco-cli 生成的 Pro 模板（Next 版）为标准，不在其外另造一套布局。
3. **样式走 Token**：颜色、字号、间距、圆角全部来自主题变量（DesignLab / ConfigProvider token），**禁止散落硬编码色值、字号、间距**。
4. **新增任何可复用组件前**，先查 Arco 是否已有现成能力 + 是否已有公共组件，避免再造轮子。

### 11.2 布局与导航（Pro 标准）

| 元素 | 规范 |
|---|---|
| 整体布局 | 左侧可折叠菜单 + 顶部栏（面包屑/搜索/用户区）+ 内容区 + 多标签页签，采用 Pro 模板标准结构 |
| 菜单 | 由路由表 + 权限动态生成，层级 ≤ 3 级；无权限的菜单不渲染 |
| 页面容器 | 统一 `PageContainer`（页面标题 + 操作区 + 内容区），不直接在页面里拼布局 |
| 路由 | Next.js App Router；业务页面统一放 `features/<module>/` 下，页面文件名即路由路径 |

### 11.3 主题 Token（Design Token 强制）

| 类别 | 标准值（Arco 语义色） | 说明 |
|---|---|---|
| 主色 | `#165DFF` | Arco 品牌蓝，后续仅通过 DesignLab 定制，不改散落代码 |
| 成功 / 警告 / 错误 / 信息 | `#00B42A` / `#FF7D00` / `#F53F3F` / `#165DFF` | 状态色语义化，禁止自造颜色表达状态 |
| 间距 | 8px 基准网格：8 / 12 / 16 / 24 / 32 | 布局间距只用这 5 档 |
| 圆角 | 表单控件 4px；卡片/容器 8px | 不出现其他圆角值 |
| 字号层级 | 12 / 14 / 16 / 20 / 24 | 正文 14，标题 16/20，页面大标题 24 |
| 字体 | 系统字体栈（Arco 默认），不引入自定义字体 | 中英文混排正常 |

### 11.4 页面级规范（企业级）

| 页面类型 | 必须遵守 |
|---|---|
| **列表页** | 三区结构：搜索区（Card 内 Form，展开/收起）→ 工具栏（新增/导出/批量操作）→ `ProTable`（列配置 + 分页）；空数据用 Empty，加载用 Skeleton，失败用 Result |
| **表单页/弹窗表单** | 栅格布局、label 右对齐、必填标 `*`、提交即时校验（Zod）、提交按钮 loading、成功/失败 message 反馈；编辑页回填后再次校验 |
| **详情页** | Descriptions / 分栏卡片，字段超长省略 + Tooltip |
| **Dashboard** | Statistic 统计卡片 + 图表卡片，一屏一业务主题，数据加载统一骨架屏 |
| **全局反馈** | 任何操作 3 秒内有反馈（loading / toast / message）；危险操作（删除、清空、发工资）必须 Modal 二次确认 |

### 11.5 组件复用规范（统一调用 · 强制执行）

**原则：**
1. **禁止复制粘贴重复 UI 代码**。同一 UI 结构出现 ≥ 3 次（或预计会 3 次），必须抽取为公共组件。
2. 组件分层（严格，不允许越层）：
   - `web/src/components/`（shared）：与业务无关的通用组件（Arco 二次封装）
   - `web/src/features/<module>/components/`：模块内业务组件
   - 页面：只做组装与数据接入，**不写大段 UI 逻辑**（超过 50 行的 JSX 段落必须拆组件）
3. 命名：组件名 PascalCase；props 必须用 TypeScript `interface` 定义，**禁止 `any`**。

**统一公共组件清单（`web/src/components/`，重构时先建齐再写页面）：**

| 组件 | 封装内容 | 用途 |
|---|---|---|
| `PageContainer` | 页面标题 + 面包屑 + 操作区 + 内容区 | 所有页面最外层容器 |
| `ProTable` | SearchForm + Table + 分页 + 列配置 + 导出 一体化 | 所有列表页（最重要的公共组件） |
| `SearchForm` | 查询区表单（字段声明式配置、展开/收起、重置/查询） | 列表页搜索区 |
| `ModalForm` | 弹窗 + 表单 + 校验 + 提交 loading + 关闭 封装 | 所有新增/编辑弹窗 |
| `StatusTag` | status 值 → 语义色 Tag 映射 | 状态列统一显示 |
| `AsyncSelect` | 远程数据下拉（防抖搜索、值/标签映射） | 员工、部门、班次等选择 |
| `UploadImage` | 图片上传（OSS 直传、预览、压缩） | 头像/凭证/附件 |
| `EmptyState` / `ResultState` | 空态 / 结果页统一封装 | 空数据、404、403、异常 |
| `ConfirmButton` | 危险操作确认按钮（二次确认 + loading） | 删除、清空等 |

> 以上组件在 **Step 3 前端搭建阶段必须先建齐**，之后所有页面只允许调用这些公共组件，页面内不得再出现重复的搜索区/弹窗/状态标签实现。

### 11.6 企业级 UI 标准

1. **一致性**：全站 token 驱动，同一含义的 UI 元素（按钮、标签、状态色）全站唯一实现。
2. **反馈**：所有操作有明确反馈；网络错误统一拦截提示（401 跳登录、403 无权限、5xx 服务错误）。
3. **权限**：**RBAC（菜单级 + 按钮级）+ 部门数据隔离（行级，C8/ADR-0010）**。菜单/按钮无权限不渲染，统一 `<PermissionGate>` 控制；列表/详情/报表按"可见部门范围"过滤（超管/HR 全量、部门经理本部门含子部门、普通员工仅本人），过滤在后端 Service 层完成，禁止前端过滤。
4. **可访问性**：表单 label 关联控件、Tab 键盘可达、文字对比度符合 WCAG AA。
5. **性能**：长列表虚拟滚动、图片懒加载、路由级 code splitting（Next.js 自动）、大数据表格列裁剪。
6. **数据展示**：金额一律两位小数、日期统一 dayjs 格式、超长文本省略 + Tooltip、负数红色标注（财务场景按国内习惯：涨/正收益红色）。
7. **桌面优先**：基准宽度 1440px，最小支持 1280px，不做移动端适配（内部系统）。

### 11.7 页面验收清单（每个新页面必须自查通过）

- [ ] 只用 Arco 组件 + 公共组件，无手写基础组件、无其他 UI 库
- [ ] 布局符合 Pro 标准（PageContainer + 标准三区）
- [ ] 颜色/字号/间距/圆角全部来自 token，无散落硬编码
- [ ] 重复结构已抽公共组件，无复制粘贴
- [ ] 有加载态 / 空态 / 错误态
- [ ] 危险操作有二次确认
- [ ] 按钮级权限通过 PermissionGate 控制
- [ ] 表单提交有 loading + 成功/失败反馈
- [ ] 金额/日期/超长文本处理符合 11.6-6

---

*本文档为重构执行的唯一依据，执行过程中如发现与实际情况不符，先更新本文档再动手。*
