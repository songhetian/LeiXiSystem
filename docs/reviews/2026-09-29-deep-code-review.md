# 雷犀管理系统 · 深度代码审查报告（双轴 + 扩大范围）

- **审查日期**：2026-09-29（续 `2026-09-29-ui-design-review.md`）
- **审查方法**：`code-review` 技能双轴（**Standards** 是否符合仓库文档化标准 + **Spec** 是否忠实实现规格），并行子代理；外加一个「扩大范围」前端扫描代理（整个 `frontend/src`）。
- **固定点**：`d675763`（UI 修复 4 提交之前）；差异范围 `git diff d675763...HEAD`
- **性质**：审查 + **逐项修复**（本次已修复，附验证）

---

## 一、Standards 轴（仓库标准 + Fowler 坏味）

**结论：无新增硬性违规。** 本批改动整体提升符合度：

- **TDD**：4 个 `*.service.ts` 改动均同步 `*.spec.ts`；前端 UI 改动均补 `*.test.tsx`。
- **数据隔离（ADR-0010）**：IDOR 修复为既有越权补 fail-closed / 取交集，方向正确。
- **时区**：`attendance-daily` 建 map 与查 map 均用 UTC 口径。
- **模块边界（ADR-0013）**：无跨模块 import Service；`module-boundary.spec.ts` / `di-injection.spec.ts` 未破坏。

**基线坏味（判断题）→ 已收口：**

| 坏味 | 位置 | 修复 |
|---|---|---|
| Duplicated Code / Repeated Switch | `vacation.service.ts`（2 处）+ `payroll.service.ts`（1 处）+ `attendance-monthly.service.ts`（2 处）三连布尔空范围守卫重复 | 抽 `scopeIsEmpty(scope)` 单一来源（`common/data-scope.service.ts`），5 处统一 |
| Primitive Obsession | 同上，「无可见范围」用内联布尔表达 | 命名谓词 `scopeIsEmpty` + 单测 |
| Duplicated Code（文件内） | `attendance-daily.service.ts` UTC 匹配键在建/查 map 各写一份 | 抽 `makeupMatchKey(employeeId, date)` |
| Divergent Change（保留） | `employee-tx.service.ts` 的「显式 employeeId ∩ 可见范围」是**另一种**守卫（非空范围判定），语义不同、已有注释与测试，**不做强行统一**（避免过度工程） | 保留 |

---

## 二、Spec 轴（30 项 UI 审查报告的实现忠实度）

核对「30 项修复进度追踪」的 ✅ 声称，发现 **3 项「声称 ✅ 实际部分未达」**，均已补齐：

| 项 | 原声称 | 实际 | 本次补齐 |
|---|---|---|---|
| **W11** | `.app-layout`/登录页改 `100dvh` | `ProtectedRoute.tsx:75,82` 的 `h-screen` **未改** | 改 `min-h-dvh` + 测试 |
| **W12** | 面包屑容器 hover 收窄 | `.breadcrumb-item:hover { color: var(--lx-primary) }` **仍保留**（误导性变色，仅 `.breadcrumb-link` 可点） | 移除容器级 hover，改注释说明 |
| **C9** | 清默认调色板 gray/white/black | 实际删了 gray/black，**`white` 有意保留**（彩色底文字用，带注释） | 修正报告措辞（代码本身正确） |

**范围蔓延**：`50ee0b3` 后端 IDOR 提交与 UI 规格无关（已在独立提交中，属合理分治）。

---

## 三、扩大范围扫描（30 项之外的新发现）

对 `frontend/src` 274 个文件系统扫描，发现 13 类新缺陷。**本次修复情况：**

### 🔴 全站级（WCAG A 级）

| # | 问题 | 位置 | 修复 |
|---|---|---|---|
| 1 | 全站无 `<h1>`，标题层级从 `<h3>` 起跳（SC 1.3.1 / 2.4.6） | `PageContainer.tsx:42` 写死 `heading={3}` | 改 `heading={1}`（页标题 = 该页唯一 h1；字号由 `.page-title` CSS 承载，观感不变）+ 测试 |
| 2 | 无「跳到主内容」跳过块（SC 2.4.1, A） | `AppLayout.tsx` | 新增 `.lx-skip-link`（聚焦浮出）+ `main tabIndex={-1}` + 测试 |

### 🟡 重要

| # | 问题 | 位置 | 修复 |
|---|---|---|---|
| 3 | `NotificationDropdown` 键盘不可关、无 `aria-expanded`、魔法 z-index 9999 | `components/NotificationDropdown.tsx` | 补 Escape 关闭 + 焦点移入/归还 + `aria-haspopup/expanded/controls` + `role=region` + z-index 改 `var(--lx-z-popover)` + 测试 |
| 4 | 参考接口静默失败 → 必填下拉变空、无法提交且无提示 | `use-departments.ts`、`vacation-leave.tsx`、`knowledge/admin.tsx`、`ReimbursementForm.tsx` | 统一 `notifyError` 显式提示（保留空数组兜底不阻断渲染）+ 测试 |
| 6 | 报销明细表 `<th>` 缺 `scope`、行 `key={idx}` | `expense/pages/approval.tsx` | 补 `scope="col"`；`key={item.id ?? idx}` |
| 7 | 知识库附件删除无二次确认（与同页其他删除不一致） | `knowledge/pages/admin.tsx:572` | 包 `Popconfirm` + 测试 |
| 12 | `main[role=tabpanel]` 缺 `aria-labelledby`（SC 4.1.2） | `AppLayout.tsx` | 关联到当前激活页签 id + 测试 |

### 🔵 建议

| # | 问题 | 修复 |
|---|---|---|
| 10 | 内联硬编码色绕过 token（`#3B82F6` 非品牌蓝、`rgba(0,0,0,.08)`、`#fff`、`#f7f8fa`、4 组浅底状态色） | 改语义 token：`punch.tsx` 状态提醒用 `--lx-*-text/-bg`；`ShiftForm` 兜底改品牌 hex `#2455D9`；okr/cycles 边框 `--lx-border-2`；profile/vacation-audit `--lx-text-white`；notification/settings `--lx-bg-card`；my-schedule `--lx-overlay-soft`；FilePreviewModal `--lx-bg-secondary` |
| 11 | `key={index}` 反模式 | `ModalForm` 月份网格改 `month-${i+1}`；`EmployeeDetailTabs` 时间线改用记录 `id`（`DataState` 骨架屏为占位列表惯用法，保留） |

### 未在本次修复（有意保留 / 待排期）

| # | 问题 | 原因 |
|---|---|---|
| 5 | next-intl 已配置但全仓零使用（文案硬编码中文） | 国际化改造面极大（几乎每个文件），属独立工程议题，需单独立项 |
| 8 | ProTable 表头 `scope`/`aria-sort` 依赖 Arco 默认 | 需先运行时验证 Arco 输出，避免重复添加；列为后续 |
| 9 | `as any` / 非空断言 `!` / `catch (e: any)` 残留 | 类型债，属「类型安全专项」，风险低但面广，另行排期 |
| 13 | 密集表 `scroll={{ x: true }}` 触屏横向滚（SC 1.4.10） | 需模式级（窄屏隐藏次要列/卡片化）改造，影响面大，另行设计 |

---

## 四、验证基线

| 项 | 结果 |
|---|---|
| 后端 `tsc --noEmit` | **0 错误** |
| 后端 `jest` | **112 套件 / 1474 用例全绿**（+13：`scopeIsEmpty` 等） |
| 前端 `tsc --noEmit` | **0 错误** |
| 前端 `jest` | **80 套件 / 786 用例全绿**（+7：h1/skip-link/tabpanel/Escape/删除确认/静默失败提示） |

## 五、改动文件（34）

- **后端（6）**：`common/data-scope.service.ts`(+spec)、`attendance/attendance-daily.service.ts`、`attendance/attendance-monthly.service.ts`、`attendance/vacation.service.ts`、`payroll/payroll.service.ts`
- **前端全站无障碍（8）**：`components/{PageContainer,AppLayout,ProtectedRoute,NotificationDropdown,ModalForm}.tsx`、`app/globals.css`、`app/arco-overrides.css` + 4 个 `__tests__`
- **前端页面（14）**：`hooks/use-departments.ts`、`features/attendance/pages/{ShiftForm,my-schedule,punch,vacation-audit,vacation-leave}.tsx`、`features/knowledge/pages/admin.tsx`(+test)、`features/knowledge/components/FilePreviewModal.tsx`、`features/expense/pages/approval.tsx`、`features/expense/components/ReimbursementForm.tsx`、`features/employee/components/EmployeeDetailTabs.tsx`、`features/notification/pages/settings.tsx`、`features/performance/pages/{okr,cycles}.tsx`、`app/(dashboard)/profile/page.tsx`
- **文档（1）**：`docs/reviews/2026-09-29-ui-design-review.md`（修正 C9/W11/W12 措辞）
