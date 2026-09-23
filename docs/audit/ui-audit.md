# 前端视觉/交互审计

> 依据：`AGENTS.md` + 历史决策（Arco 企业标准、anti-AI 判据）。
> 判据帧：**A** 命中 AI 味杀手 / **B** 偏离品牌基调 / **C** 交互一致性。
> 严重度：🟥 高（迎面可见的廉价感/违背基调）、🟧 中（局部）、🟨 低（可缓）。
> 本审计**只记录不改代码**，用于定批次优先级。

---

## 1. 品牌基调 vs AI 味（全局）

| 判据 | 现状 | 命中项 | 严重度 |
|---|---|---|---|
| 主色蓝 `#2455D9` | ✅ 到位（logo/侧栏/按钮/工作台主入口） | — | — |
| 背景浅灰白、禁暖纸色 | ✅ 全局 `--lx-bg*` 浅色系，未发现暖纸色 | — | — |
| 侧栏浅色 | ✅ `AppSider` 浅色蓝系 | — | — |
| 渐变文字 | 🚫 `globals.css#L439 .lx-text-gradient`（蓝→紫 `--lx-purple`）用于 `punch.tsx#L183` 52px 打卡大数字 | A | 🟥 |
| 玻璃拟态 | 🚫 `globals.css#L447 .lx-glass`（`backdrop-filter blur+saturate`）悬浮面板 | A | 🟧 |
| 紫色杂入 | ⚠ `--lx-purple #8b5cf6` 参与渐变文字/辉光，偏离单一蓝系 | B | 🟧 |

## 2. 页面级命中清单

### 🟥 高优先级
**2.1 登录页 `app/login/page.tsx`**
- `#L99` 四段彩虹渐变背景（`#f0f4ff → #e8f0ff → #f5f0ff → #fff0f5`，含紫粉）。
- `#L102-106+` 多彩光晕 `radial-gradient` + `blur(24px)` 辉光。
- `#L134` logo/按钮 蓝渐变（品牌，可保留）。
- 建议：背景收敛为单一浅蓝渐变或纯 `#f8faff`；光晕减到单个品牌蓝；紫粉段删。

**2.2 工作台 `app/(dashboard)/page.tsx`（55 行 + 501 行）**
- 快速入口 8 张卡片**图标彩虹色**：`#2455D9/绿#22c55e/琥珀#f59e0b/紫#8b5cf6/青#14b8a6/红#ef4444/靛#6366f1`（`L38-45`）；统计卡同样 6 色（`L50-55`）。
- `#L501` 进度条 `linear-gradient(90deg, #2455D9, #5b7cf5)`（蓝渐变，可留）。
- 建议：图标收敛为单一品牌蓝系的同系深浅，去掉紫/绿/红杂色；保留单卡强调色但减少系统内同时出现色相数量。

### 🟧 中优先级
**2.3 打卡页 `attendance/punch.tsx#L183`**：52px 渐变文字时钟（`.lx-text-gradient`）→ 改纯蓝或浅灰。
**2.4 玻璃拟态 `.lx-glass`**（全局工具类）：定位使用处（下拉/悬浮面板），改纯色卡片 + 常规阴影，去 `backdrop-filter`。

### 🟨 低优先级
**2.5 班次设置 `attendance/ShiftForm.tsx#L275`**：色块 `hover:scale-110` 放大反馈（轻微，保留亦可）。

## 3. 交互一致性（C）

| 项 | 现状 | 结论 |
|---|---|---|
| 原生 `window.alert/confirm` | ✅ 0 处，均 Arco Modal/Message + 自定义 `ConfirmButton.tsx` | 达标 |
| 自定义预览弹窗 | ✅ 员工/排班等含自定义 Modal，非原生 alert | 达标 |
| 按钮字重 | ⚠ `arco-overrides.css` 多处 `font-weight:500`（`#L1356/1390/1531/1548/1645/1734/1830/2106`）需逐项确认是否命中按钮，标题/强调文本 500 可留 | 待核对 → 按钮归一 `400` |
| 整卡可点 | ✅ 列表多为整行/整卡点击 | 达标 |
| 快捷键/发送 Enter | ✅ 已实现 | 达标 |

## 4. （非视觉范围，仅登记）数据获取规约合规面
- 41 个页面仍手写 `setLoading(true)`；9 页面直接 `listDepartments/listPositions`（含本会话新建的 `shifts`/`schedule-calendar`/`okr`/`budgets`）。
- 属于「缓存规约」方向，本审计不计分，单列待批次。

---

## 结论 & 建议批次划分
1. **UI-批一**：登录页 + 工作台（第 1 优先，迎面可见，roc 最大）→ 去彩虹/渐变文字/辉光。 ✅ **已完成**
2. **UI-批二**：`.lx-text-gradient` 与 `.lx-glass` 全局清理（punch 时钟 + 悬浮面板）。 ✅ **已完成**
3. **UI-批三**：按钮 `font-weight` 归一 400（核对后执行）。 ✅ **已核对，无违规**（8 处 500 均为侧栏标签/面包屑/表头，非按钮；按钮本就 400）
4. 数据规约迁移另列批次，与视觉解耦。 ✅ **已完成**

---

## 批次执行记录（UI-批一~三）

### 已修复/已处理
- ✅ 工作台快捷入口 9 图标 + 6 指标去彩虹 → 抽 `brandTone(index)`（`src/lib/dashboard-tone.ts`）统一品牌蓝同系深浅，TDD 4 单测（蓝系约束/确定性/层次数/bg 同源），`(dashboard)/page.tsx` 接线。
- ✅ 登录页背景四段彩虹渐变 → 纯蓝 `#f0f4ff→#e8f0ff`；4 色彩光缩 2 个单品牌蓝；卡片 `lx-glass` → 纯白卡。
- ✅ `punch` 52px 渐变时钟 → 纯品牌蓝 `#2455D9`；删除死 CSS `.lx-text-gradient`、`.lx-glass`。
- ✅ 保留：`--lx-purple`（StatusTag 语义色，非装饰）、工作台进度条蓝渐变（品牌）。

### 验收
- 前端 `tsc --noEmit` 通过；`jest` 59 套件 / 566 用例全绿（含新增 dashboard-tone）；`pnpm build` 通过。

---

## 数据规约迁移批次（AGENTS.md「前端数据获取规约」）

按 `AGENTS.md` 要求，将内联 `listDepartments`/`listPositions` 的下拉参考数据改为共享缓存 hook `useDepartments`/`usePositions`。

### 已迁移 7 页
- ✅ `attendance/pages/shifts.tsx` + `ShiftForm.tsx`（prop 类型 `SysDepartment[]` → `ReferenceItem[]`，必填）
- ✅ `attendance/pages/schedule-calendar.tsx`（移除 `departments` state 与 `fetchDepartments`）
- ✅ `system/pages/users.tsx`（部门 + 岗位）
- ✅ `employee/pages/detail.tsx`（部门 + 岗位）
- ✅ `notification/pages/list.tsx`（发送弹窗目标部门走缓存，users 仍懒加载）
- ✅ `performance/pages/okr.tsx`（`deptMap` 由 hook 数据经 `useMemo` 派生，删 `setDeptMap` state）
- ✅ `finance/pages/budgets.tsx`（筛选与表单部门走缓存）

### 验收
- 前端 `tsc --noEmit` 通过；`jest` 59 套件 / 566 用例全绿（use-departments / ShiftForm / EmployeeDetailTabs 相关套件通过）。