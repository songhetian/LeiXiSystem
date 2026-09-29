# 雷犀管理系统 · 前端 UI 设计规范审查报告

- **审查日期**：2026-09-29
- **审查范围**：`frontend/src` 全部 UI 代码（布局外壳 / 设计 token / 页面样式 / 核心组件），共 4 个手写 CSS 文件 3931 行 + 关键 TSX 组件
- **审查基准**：WCAG 2.2 AA、W3C Web Interface Guidelines、Arco Design 企业级后台规范、项目内 `docs/adr/` 与 `AGENTS.md`
- **审查性质**：**只读审查，未修改任何代码**

---

## 一、总体结论

**整体水平：良好偏上（B+）。设计 token 体系、动效克制度、组件无障碍名称的完成度都明显高于一般业务后台**，但存在一类系统性缺陷——**暗色主题只覆盖了 token，没有覆盖主题化样式**，导致「切换深色模式后外壳与登录页仍是浅色」这种一眼可见的破绽。

| 维度 | 评价 | 说明 |
|---|---|---|
| 布局结构 | 🟡 中 | 桌面端结构清晰（IDE 风多页签 + 折叠侧栏）；**但全站零响应式媒体查询**，靠 JS 切换抽屉 |
| 颜色搭配 | 🔴 差 | token 体系设计得不错，**但 23 项配色不达 WCAG AA**，状态标签是最集中的灾区 |
| 特效操作 | 🟡 中 | 克制、有品味、无堆砌；但暗色适配、焦点可见性、动效简写有具体缺陷 |
| 无障碍 | 🟡 中 | 图标按钮 aria-label **零缺失**（优秀）；键盘可达性与对比度是短板 |
| 设计系统一致性 | 🔴 差 | **三套样式系统（手写 CSS / Tailwind / Arco）真值分裂**，30 个 token 死项 |

**问题总量 30 项：🔴 关键 8 项 / 🟡 重要 12 项 / 🔵 建议 10 项。**

---

## 二、🔴 关键问题（P0 — 影响可用性或明显破坏视觉）

### C1. 暗色主题下顶栏与页签栏仍是浅色

```
frontend/src/app/arco-overrides.css:1462   .app-header { background: rgba(255, 255, 255, 0.85); }
frontend/src/app/arco-overrides.css:1678   .page-tabs  { background: rgba(255, 255, 255, 0.7); }
```

`arco-overrides.css` 全文 **0 处** `[data-theme="dark"]` / `.arco-theme-dark` 覆盖（实测 `grep -c` = 0），而它承载了全部应用外壳样式。两处硬编码半透明白的合成结果：

| 元素 | 暗色下实际合成底色 | 与浅色文字对比度 |
|---|---|---|
| `.app-header` | `rgb(218,219,221)` 浅灰 | **1.26:1** |
| `.page-tabs` | `rgb(182,183,186)` 中灰 | **1.83:1** |

规范依据：WCAG 2.1 SC 1.4.3 Contrast (Minimum) AA — 需 ≥ 4.5:1。

**修复建议**：把这两处换成 token，并在 `globals.css` 的暗色块中补 `--lx-header-bg` / `--lx-tabs-bg`：

```css
/* globals.css :root */
--lx-header-bg: rgba(255, 255, 255, 0.85);
--lx-tabs-bg:   rgba(255, 255, 255, 0.7);
/* globals.css [data-theme="dark"] */
--lx-header-bg: rgba(21, 26, 40, 0.85);
--lx-tabs-bg:   rgba(16, 21, 39, 0.7);
```

### C2. 暗色主题下滚动条不可见

```
frontend/src/app/globals.css:320        ::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); }
frontend/src/app/arco-overrides.css:1221 .side-menu::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.08); }
```

黑色滑块叠在深色底上：实测对比度 **1.01:1**（侧栏 1.02:1），等于完全看不见。暗色块（globals.css:201-288）未覆盖滚动条。

规范依据：WCAG 2.2 SC 1.4.11 Non-text Contrast AA — 需 ≥ 3:1。

**修复建议**：改用 token 并在暗色下反转明度。

```css
::-webkit-scrollbar-thumb { background: var(--lx-scrollbar); }
/* :root  rgba(0,0,0,.1)  →  [data-theme="dark"]  rgba(255,255,255,.18) */
```

### C3. 登录页完全不响应暗色模式

```
frontend/src/app/globals.css:109   --lx-login-bg: linear-gradient(160deg, #f5f7ff 0%, #eaf0ff 100%);  /* 仅 :root */
frontend/src/app/globals.css:110   --lx-login-card-shadow: ...;                                     /* 仅 :root */
frontend/src/app/login/page.tsx:54  className="... w-[420px] px-9 py-11 rounded-2xl bg-white ..."
```

两个登录页专属 token **只在 `:root` 定义**，暗色块（201-288）未覆盖；卡片又用 Tailwind `bg-white` 写死纯白。结果：暗色用户访问 `/login` 会看到「浅色渐变页 + 纯白卡片」，与全局主题断裂。此外 `bg-white` 是 Tailwind 字面量而非 token，属于同一类根因。

**修复建议**：补暗色 token + 卡片底色改 `bg-surface`（Tailwind 已映射 `--lx-bg-card`）。

### C4. 登录卡片在手机端被裁切，且用户无法缩放救场

```
frontend/src/app/login/page.tsx:43  className="lx-login-page min-h-screen ... relative overflow-hidden"
frontend/src/app/login/page.tsx:54  className="lx-login-card relative z-10 w-[420px] ..."
```

卡片固定 `420px`，父容器 `overflow-hidden`。视口 < 420px（iPhone SE 375px、多数安卓 360px）时**卡片右侧被直接裁掉，登录按钮可能点不到**。

规范依据：WCAG 2.2 SC 1.4.10 Reflow AA（320px 宽度下不得出现双向滚动 / 内容丢失）。

**修复建议**：

```diff
- className="lx-login-card relative z-10 w-[420px] px-9 py-11 rounded-2xl bg-white"
+ className="lx-login-card relative z-10 w-full max-w-[420px] mx-4 px-6 sm:px-9 py-11 rounded-2xl bg-surface"
```

### C5. viewport 禁用了页面缩放

```
frontend/src/app/layout.tsx:26-28   initialScale: 1, maximumScale: 1, userScalable: false
```

规范依据：**WCAG 2.1 SC 1.4.4 Resize Text AA** — 文本必须可放大至 200% 而不丢失内容。这是**明确的 AA 违规**，且本项目是给内部员工用的考勤/薪资系统（表格密集、含中老年用户），禁用缩放的代价很高。常见辩护理由是"防止 iOS 表单聚焦自动放大"，但正确做法是给输入框设定 `font-size: 16px`，而非全局禁用缩放。

**修复建议**：删除 `maximumScale` 与 `userScalable`（保留 `initialScale: 1`），并为移动端输入框设 `font-size: 16px`。

### C6. 状态标签配色全面不达 AA —— 最集中的配色灾区

实现位置：`frontend/src/components/StatusTag.tsx:14-34`（20 种状态映射）+ `frontend/src/app/globals.css:456-461`（同色文字 + 同色 8% 底）。

实测对比度（脚本按 WCAG 相对亮度公式计算）：

| 标签 | 前景 | 实测 | 判定 |
|---|---|---|---|
| 警告 / 请假 / 休假 / 待处理 | `#f59e0b` | **2.02:1** | FAIL |
| 成功 / 在职 / 已通过 / 正常 / 已发布 | `#22c55e` | **2.12:1** | FAIL |
| 危险 / 迟到 / 早退 / 缺勤 / 已拒绝 | `#ef4444` | **3.39:1** | FAIL（12px 正文需 4.5:1） |
| 加班（purple） | `#8b5cf6` | **3.84:1** | FAIL |
| 默认 / 离职 / 草稿 / 已取消 | `--lx-text-3` `#64748b` | ~4.4:1 | 边界 |

规范依据：WCAG 2.1 SC 1.4.3 AA。标签文字是 12px 小字，**必须按正文标准 4.5:1 判定，不能用大字号 3:1 豁免**。

讽刺的是：**橙色（请假/休假）和绿色（在职/已通过）是全系统最高频的两个标签，也是对比度最差的两个**——「在职/离职」这类关键人事状态在浅色背景上最难辨认。

**修复建议**：语义色的「文字态」与「图形态」分离。保留亮色作图标/圆点，另建深一档的文字 token：

```css
/* globals.css :root — 新增“文字级”语义色（保证 ≥4.5:1） */
--lx-success-text: #15803d;   /* 4.5:1 on 8% 绿底 */
--lx-warning-text: #b45309;   /* 4.6:1 on 8% 橙底 */
--lx-danger-text:  #b91c1c;   /* 5.9:1 */
--lx-purple-text:  #6d28d9;   /* 5.4:1 */
```

```css
.lx-tag-success { background: var(--lx-success-bg); color: var(--lx-success-text); }
```

### C7. 17 处交互元素键盘不可达

扫描结果（`div` / `span` / `li` 带 `onClick`，且无 `role` / `tabIndex` / `onKeyDown`）：

| 文件:行 | 元素 | 业务含义 |
|---|---|---|
| `app/(dashboard)/page.tsx:277` | `.dsh-quick-item` | **工作台四个快捷入口**（打卡月报/在线请假/加班申请/数据统计） |
| `app/(dashboard)/page.tsx:300,332,357,388` | `.dsh-panel-more` | "查看全部"入口 |
| `app/(dashboard)/page.tsx:306,338` | `.dsh-feed-item` | 待办 / 通知列表项 |
| `features/approval/pages/settings.tsx:384,507` | div | 审批流程配置 |
| `features/attendance/pages/ShiftForm.tsx:260` | div | 班次表单交互块 |
| `features/knowledge/pages/list.tsx:222,267` | div | 知识库分类导航 |
| `features/notification/pages/list.tsx:170` | div | 通知列表项 |
| `features/system/pages/roles.tsx:326` | div | 角色权限勾选 |
| `components/AppLayout.tsx:147` / `PageTabs.tsx:300` | 遮罩 | 关闭浮层（键盘需 Escape） |

规范依据：**WCAG 2.1 SC 2.1.1 Keyboard A**（Level A，最基础要求）。

工作台那四个入口尤其严重——它们是移动端/新手用户的主路径，键盘用户（含外接键鼠的办公场景、以及依赖辅助技术的用户）完全无法触发。

**修复建议**：优先把 `dsh-quick-item` 改为 `<button>`（语义正确、天然可聚焦、天然支持 Enter/Space）：

```diff
- <div className="dsh-quick-item" onClick={() => router.push(a.path)}>
+ <button type="button" className="dsh-quick-item" onClick={() => router.push(a.path)}>
```

其余若不便改标签，至少补 `role="button" tabIndex={0} onKeyDown={e => (e.key==='Enter'||e.key===' ') && fn()}`。**并同时补 `:focus-visible` 样式**（见 W1）。

### C8. 应用外壳零响应式：0 条媒体查询 + 硬编码布局尺寸

```
frontend/src/app/arco-overrides.css   @media 总数 = 0
frontend/src/app/arco-overrides.css:1143  width: 240px;    /* 侧栏 */
frontend/src/app/arco-overrides.css:1461  height: 60px;    /* 顶栏 */
frontend/src/app/arco-overrides.css:1665  padding: 24px 28px;  /* 内容区 */
frontend/src/app/arco-overrides.css:1676  height: 42px;    /* 页签栏 */
```

承载整个应用外壳 + 知识库/班次/员工详情等页面样式的 `arco-overrides.css` **一条媒体查询都没有**。响应式完全依赖 JS 的 `useResponsive` hook（`hooks/use-responsive.ts`），而它只做一件事：把侧栏从固定栏换成抽屉。**其余全部尺寸在任意视口下不变。**

后果：360px 手机上，顶栏左右各 28px + 内容区左右各 28px = **视口宽度的 15.6% 被 padding 吃掉**；42px 页签栏 + 60px 顶栏在 640px 高的屏幕上占掉 16% 高度。

`globals.css:517-529` 确实定义了移动端的 `--lx-space-*` 降档，但 `.app-content` 用的是字面量 `24px 28px` 而非 `var(--lx-space-*)`，**所以这套移动端 token 降档基本是空转的**（`--lx-space-*` 在 arco-overrides.css 中仅被引用 1 次）。

**修复建议**：把外壳尺寸改走 token，并在 arco-overrides.css 末尾补一个移动端收口块：

```css
@media (max-width: 767px) {
  .app-header { height: 52px; padding: 0 14px; }
  .app-content { padding: 12px 14px; }
  .page-tabs { height: 38px; padding: 0 8px; }
}
```

### C9. 未映射的 Tailwind 色在暗色下失效

```
features/attendance/pages/vacation-audit.tsx    bg-gray-50  × 9 处
features/attendance/pages/schedule-calendar.tsx:1032  bg-white/50
features/attendance/pages/schedule-calendar.tsx:1264  bg-white/80 ... border-black/10
```

`tailwind.config.ts` 用 `theme.extend.colors` 映射了 `brand / text-1~4 / border-1~3 / surface / bg-*` 等 token，**设计上是正确的**。但 Tailwind 的**默认调色板依然可用**，`bg-gray-50`（`#f9fafb`）、`bg-white/50` 都是字面量、不随主题变化。

后果：考勤申请审计页在深色模式下会出现 9 块刺眼的浅灰底色；排班日历的加载遮罩与拖拽手柄变成亮白色块。

**修复建议**：在 `tailwind.config.ts` 中显式**清空默认调色板**，从源头杜绝越权取色：

```ts
theme: {
  colors: { /* 只保留 token 映射，不含 gray/white/black */ ...tokenColors },
}
```
或至少禁止 `bg-gray-*` / `bg-white` 出现在暗色敏感区域（可加 ESLint 规则 `no-restricted-syntax` 配合 `tailwindcss/no-custom-classname`）。

---

## 三、🟡 重要问题（P1 — 影响体验、规范符合性或可维护性）

### W1. 焦点可见性近乎为零，且用了「错误的品牌蓝」

```
frontend/src/app/arco-overrides.css:108,615,626,881   box-shadow: 0 0 0 3px rgba(22, 93, 255, 0.1);
frontend/src/app/globals.css:991                      box-shadow: 0 0 0 2px var(--lx-primary-weak);  /* = rgba(36,85,217,.18) */
```

三个问题叠加：

1. **颜色是错的**：`rgba(22, 93, 255)` = `#165DFF`，是 **Arco 默认蓝**，不是本项目品牌蓝 `#2455D9`。全站品牌色是 `#2455D9`，偏偏焦点环用了另一个蓝。
2. **透明度太低**：10% 环叠在白色上实测 **1.15:1**（暗色卡片 1.09:1）。规范依据：**WCAG 2.2 SC 2.4.13 Focus Appearance** / SC 1.4.11 需 ≥ 3:1。
3. **两处实现不一致**：`globals.css` 搜索区用 `--lx-primary-weak`（18%），`arco-overrides.css` 用硬编码 10% —— 同一个「聚焦」状态在页面不同区域视觉不同。

唯一还算能用的指示是同时改变的 `border-color: var(--lx-primary)`（1px），但 WCAG 2.2 SC 2.4.11/2.4.13 期望 ≥ 2px 等效周长。

另外全站 **`focus-visible` 定义数 = 0**，自定义按钮（`.menu-toggle-btn`、`.header-search-trigger`、`.breadcrumb-link`、`.page-tab`、`.dsh-quick-item`）全部依赖浏览器默认 outline——这些元素带 `border-radius` / `overflow: hidden`，默认轮廓在部分浏览器会被裁切。

**修复建议**：建立统一焦点 token，一处定义全站生效。

```css
:root { --lx-focus-ring: 0 0 0 3px rgba(36, 85, 217, 0.35); }   /* 品牌蓝，35% 达 3:1+ */
[data-theme="dark"] { --lx-focus-ring: 0 0 0 3px rgba(125, 154, 224, 0.5); }

:focus-visible { outline: 2px solid var(--lx-primary); outline-offset: 2px; }
.arco-input:focus, .arco-select-view-focused, .arco-picker-focused { box-shadow: var(--lx-focus-ring); }
```

### W2. 点击目标小于 24×24px 下限

```
frontend/src/app/arco-overrides.css:1756  .page-tab-close     16 × 16   ← 关闭页签
frontend/src/app/globals.css:1749         .shift-swatch       22 × 22   ← 班次颜色选择
frontend/src/app/arco-overrides.css:1810  .page-tabs-nav-btn  24 × 24   ← 页签滚动（无间距余量）
frontend/src/app/arco-overrides.css:1789  .page-tabs-more-btn 26 × 26
frontend/src/app/globals.css:1050         .lx-search-preset-btn  height 28px
```

规范依据：**WCAG 2.2 SC 2.5.8 Target Size (Minimum) AA** 要求 ≥ 24×24 CSS px（或周边有足够间距）。`.page-tab-close` 是 16px——**这是全站最容易被误触的按钮，而它紧贴着页签本体**，误触会直接关闭页面标签，属于「小目标 + 高代价」组合。

`.shift-swatch` 是色块选择器，22px 且多个色块密集排列，误选率会很高。

**修复建议**：视觉尺寸可保留，**用 `::before` 扩大命中区**（不影响观感）：

```css
.page-tab-close { width: 16px; height: 16px; }
.page-tab-close::before { content: ''; position: absolute; inset: -4px; }  /* 命中区 24×24 */
.shift-swatch { position: relative; }
.shift-swatch::before { content: ''; position: absolute; inset: -5px; }   /* 命中区 32×32 */
```

### W3. 搜索表单 label 对多数控件是悬空的

```
frontend/src/components/SearchForm.tsx:203   <label className="lx-search-item-label" htmlFor={field.key}>
frontend/src/components/SearchForm.tsx:124   <Select id={field.key} ...>          ← 仅 Select 绑定了 id
```

`renderField()` 渲染 5 类控件，**只有 `<Select>` 传了 `id={field.key}`**：

| 控件 | 行号 | 是否有 id |
|---|---|---|
| `Select` | 124 | ✅ |
| `DatePicker` | ~139 / ~149 | ❌ |
| `EmployeeSelect` | ~169 | ❌（组件本身也不接收 id 属性） |
| `Input` | 179 | ❌ |

后果：对日期、员工、文本类筛选项，点击 label 无法聚焦控件，屏幕阅读器**不会朗读字段名称**（只播报 placeholder）。日期与员工筛选在考勤/审批模块是高频操作。

规范依据：WCAG 2.1 SC 1.3.1 Info and Relationships (A) + SC 3.3.2 Labels or Instructions (A) + SC 4.1.2 Name, Role, Value (A)。

**修复建议**：给四类控件补 `id={field.key}`，并给 `EmployeeSelect` 增加 `id` prop 透传。

### W4. 表格行可点击但键盘无法触达

```
frontend/src/components/ProTable.tsx:380-383
onRow={(record) => ({ onClick: () => handleRowClick(record), style: { cursor: onRowClick ? 'pointer' : 'default' } })}
```

行点击（进入详情/编辑）是后台最高频交互，但 `<tr>` 不可聚焦、不响应 Enter。规范依据：WCAG 2.1 SC 2.1.1 Keyboard (A)。

**修复建议**：行内保留一个"查看"文字按钮/链接作为键盘通路（成本最低），或给 `tr` 加 `tabIndex={0}` + `onKeyDown`。**推荐前者**——不要给大量表格行加 tabIndex，会让 Tab 序列爆炸（这本身违反 SC 2.4.3 Focus Order 的精神）。

### W5. Tab 角色结构不完整 + 页签右键菜单无键盘支持

```
frontend/src/components/PageTabs.tsx:252   role="tab"  aria-selected={active}   ← 缺父级 role="tablist"
frontend/src/components/PageTabs.tsx:239   <div className="page-tabs-scroll">    ← 无 role
frontend/src/components/PageTabs.tsx:233   onContextMenu={(e) => e.preventDefault()}
frontend/src/components/PageTabs.tsx:301-324  菜单无 role/focus trap/Escape 关闭
```

`role="tab"` **必须**有 `role="tablist"` 父级并提供 `aria-controls` 指向 `role="tabpanel"`，否则屏幕阅读器无法理解这是一组页签。全项目 `role="tablist"` / `role="tabpanel"` 出现次数：实测 **0**。

另两个问题：
- 页签的「刷新/关闭其他/关闭所有」菜单**只能通过右键或"更多"按钮打开**，打开后无法用方向键导航、无 Escape 关闭、无焦点管理——虽然"更多"按钮可聚焦（有 `aria-label="更多操作"`，👍），但菜单本身键盘不可用。
- `onContextMenu` 的 `preventDefault()` 挂在整条页签栏上，**屏蔽了浏览器原生右键菜单**（用户无法"在新标签打开""复制链接"）。这是拿掉了标准能力去换自定义能力，代价偏高。

**修复建议**：外层加 `role="tablist"`；菜单加 `role="menu"` + 方向键导航 + Escape 关闭 + 打开时焦点移入；`preventDefault` 收窄到仅 Tab 元素上（`e.preventDefault()` 已如此，但外层还有一层，建议去掉外层的）。

### W6. 设计系统「双源真值」——CSS token 与 Tailwind 同名不同值

这是**最容易长期腐化**的一项。同一语义名在两套系统里取值不同：

| 语义 | CSS token | Tailwind config | 差异 |
|---|---|---|---|
| 侧栏宽 | `--lx-sider-width: 240px` (globals.css:178) | `spacing.sider: 216px` | **差异 24px** |
| 顶栏高 | `--lx-header-height: 60px` (:180) | `spacing.header: 56px` | **差异 4px** |
| 字号 lg | `--lx-font-lg: 18px` (:135) | `fontSize.lg: 15px` | **差异 3px** |
| 字号 2xl/3xl | 26px / 32px | 24px / 28px | 不一致 |
| 字号 sm | 13px | 13.5px | 0.5px |
| 圆角 xl | `--lx-radius-xl: 14px` (:156) | `borderRadius.xl: '12px'` | 差异 2px |
| 阴影色基 | `rgba(15, 23, 42, …)` | `rgba(16, 24, 40, …)` | 色基不同 |
| 过渡缓动 | fast/base/slow **三档同值** | fast/base/slow **三档同值** | token 冗余 |

后果举例：写 `className="text-sm"` 得 13.5px，写 `font-size: var(--lx-font-sm)` 得 13px；写 `w-sider` 得 216px，而实际侧栏渲染 240px（硬编码）。**"一处修改，全站生效"的承诺在这几个维度上是失效的。**

**修复建议**：Tailwind config 不再写字面量，全部改为引用 CSS 变量（该文件对 `colors` 已经这么做了，把 `fontSize` / `spacing` / `borderRadius` / `boxShadow` 也补上即可）：

```ts
fontSize: {
  xs: 'var(--lx-font-xs)', sm: 'var(--lx-font-sm)', base: 'var(--lx-font-md)',
  lg: 'var(--lx-font-lg)', xl: 'var(--lx-font-xl)',
},
spacing: { sider: 'var(--lx-sider-width)', header: 'var(--lx-header-height)' },
borderRadius: { sm: 'var(--lx-radius-sm)', md: 'var(--lx-radius-md)',
                lg: 'var(--lx-radius-lg)', xl: 'var(--lx-radius-xl)' },
```

### W7. 「字号 token」形同虚设：178 处硬编码 vs 2 处 token

实测 `font-size` 声明分布：

| 走 `var(--lx-font-*)` | **2 处** |
|---|---|
| 硬编码 `px` | **178 处** |

其中：`13px` × 46（正是 `--lx-font-sm` 的值）、`12px` × 31（正是 `--lx-font-xs`），**但都写成字面量**；另有 **7 处 11px、2 处 10px** 属设计系统之外的越阶字号。

后果：想整体放大字号（无障碍常见的"文本放大"诉求）需要改 178 处；且 10–11px 中文在 1080p 屏上已接近可读性下限。

规范依据：WCAG 2.1 SC 1.4.4 Resize Text AA。

**修复建议**：批量替换 `font-size: 13px` → `var(--lx-font-sm)`、`12px` → `var(--lx-font-xs)`（纯机械替换，零视觉变化，可安全批量提交）；`10px/11px` 两处提升至 12px 或纳入 token 阶。

### W8. z-index 层级混乱，移动端遮罩盖不住顶栏

```
frontend/src/app/arco-overrides.css:1936  .drawer-mask        z-index: 9
frontend/src/app/arco-overrides.css:1472  .app-header         z-index: 20
frontend/src/app/arco-overrides.css:1142  .lx-sider-drawer    z-index: 1030
frontend/src/app/arco-overrides.css:1854  .page-tabs-menu-mask  z-index: 3999
frontend/src/app/arco-overrides.css:1860  .page-tabs-menu       z-index: 4000
```

问题：
1. **遮罩(9) < 顶栏(20) < 抽屉(1030)**：移动端打开抽屉时，抽屉压住顶栏，但**遮罩压不住顶栏**——顶栏保持高亮、不被调暗。层级关系自相矛盾。
2. `3999/4000` 是魔数，而项目**已定义完整的 z-index token 阶**（`--lx-z-dropdown:1000` … `--lx-z-toast:1060`，globals.css:170-175），但其中 `dropdown/fixed/popover/toast` 四个**从未被引用**（死 token），实际代码用魔数。

**修复建议**：`.drawer-mask` 改用 `var(--lx-z-fixed)`（1030 与抽屉同级）或 `calc(var(--lx-z-fixed) - 1)`；页签菜单改用 `var(--lx-z-popover)`；`.app-header` 用 `var(--lx-z-sticky)`。

### W9. 两个组件级 CSS 文件从未被引入（死文件 122 行）

```
frontend/src/components/ProTable.css    81 行 / 14 个选择器   ← 全项目零 import
frontend/src/components/StatusTag.css   41 行 /  7 个选择器   ← 全项目零 import
```

实测 `grep -rn "ProTable.css\|StatusTag.css"` 在 `src` 下**没有任何 import 语句**（Next.js 不会自动引入）。且它们定义的类名在 TSX 中也**完全没有使用**（`lx-pro-table*`、`lx-status-tag` 出现次数均为 0）。

更麻烦的是 `StatusTag.css` 与 `globals.css:456-461` **重复定义了 `.lx-tag-*` 且值不一致**：

| 选择器 | `globals.css:461`（生效） | `StatusTag.css:38`（死） |
|---|---|---|
| `.lx-tag-default` | `background: var(--lx-bg-secondary)` + `border: 1px solid var(--lx-border-1)` | `background: var(--lx-border-2)`，无 border |

而 `StatusTag.tsx:85` 用了 Tailwind `border-none`，与 `globals.css` 的 `border: 1px solid` **同为单类选择器、同优先级**，后者因源码位置更靠后而胜出 → **组件想表达"无边框"，实际渲染出 1px 边框**（与其余 5 个标签不一致）。

**修复建议**：删除两个死文件；把 `.lx-tag-*` 收敛到唯一来源；`StatusTag.tsx` 去掉 `border-none` 或改 `globals.css` 去掉 border（二选一，保持一致）。

### W10. 动画简写误把「时长 token」塞进「缓动函数」槽位

```
frontend/src/app/globals.css:1441  animation: dsh-rise 0.4s var(--lx-transition-fast) both;
frontend/src/app/globals.css:1444  animation: dsh-rise 0.34s var(--lx-transition-fast) both;
```

`--lx-transition-fast` = `150ms cubic-bezier(0.4, 0, 0.2, 1)`（**时长 + 缓动**的复合值）。塞进 `animation` 简写后展开为：

```css
animation: dsh-rise 0.4s 150ms cubic-bezier(0.4,0,0.2,1) both;
/*                     ↑ 被解析成 delay（而非缓动） */
```

语法合法但语义错误：**每个入场动画被额外插入了 150ms 延迟**。工作台 `.dsh-quick-item` 因为有内联 `animationDelay: ${idx*30}ms`（page.tsx:280）覆盖而侥幸无碍，但 `.dsh-hero / .dsh-stat / .dsh-panel` 会实打实多等 150ms——首屏"点击即反馈"的手感被拖慢了。

**修复建议**：

```diff
- animation: dsh-rise 0.4s var(--lx-transition-fast) both;
+ animation: dsh-rise 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
/* 或新增纯缓动 token */
+ --lx-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
+ animation: dsh-rise 0.4s var(--lx-ease-standard) both;
```

### W11. `100vh` 在移动端会被地址栏裁切

```
frontend/src/app/arco-overrides.css:1067,1647   height: 100vh;
frontend/src/app/globals.css:1279               max-height: calc(100vh - 200px);
components/ProtectedRoute.tsx:75,82             className="h-screen ..."   /* Tailwind = 100vh */
app/login/page.tsx:43                           className="min-h-screen"
```

`.app-layout { height: 100vh; overflow: hidden }` —— 移动端浏览器 `100vh` 含地址栏区域，会导致**底部内容被推出视口且无法滚动**（父级 `overflow: hidden` 封死了滚动）。登录页 `min-h-screen` + `overflow-hidden` 同理。

**修复建议**：改用 `100dvh`（动态视口高度，现代浏览器已广泛支持），并保留 `100vh` 作为降级：

```css
.app-layout { height: 100vh; height: 100dvh; }
```

### W12. 右键屏蔽、hover-only 反馈等交互细节

```
frontend/src/app/arco-overrides.css:1514  .breadcrumb-item:hover { color: var(--lx-primary); }
frontend/src/app/arco-overrides.css:1578  .header-search-kbd { font-size: 10px; color: var(--lx-text-4); }
```

- `.breadcrumb-item` 是**容器**，hover 变蓝但不可点（只有内层 `.breadcrumb-link` 可点）→ 误导性交互暗示。
- `Ctrl K` 快捷键提示用 `10px` + `--lx-text-4`（实测 2.56:1）→ 几乎看不清，而它是"命令面板"这个重要功能的**唯一发现入口**（用户不知道有 Ctrl+K 就永远找不到命令面板）。
- 移动端无 hover 概念，`.dsh-quick-item` / `.page-tab` 等**只靠 hover 提供状态反馈**，触屏设备上点按无任何反馈（`active` 态仅 `punch.tsx:401` 一处有）。**规范依据：WCAG 2.2 SC 2.4.7 Focus Visible 精神 + 移动端触控反馈最佳实践。**

**修复建议**：快捷键提示提到 `11px/12px` 并改 `--lx-text-3`；补 `:active` 态（如 `transform: scale(0.98)` 或 `filter: brightness(0.96)`）；面包屑容器 hover 去掉或仅在 `.breadcrumb-link:hover` 保留。

---

## 四、🔵 建议（P2 — 工程化与体验打磨）

| # | 问题 | 位置 | 建议 |
|---|---|---|---|
| S1 | **设计 token 死项约 30 个** | `globals.css` | 实测 129 个 `--lx-*` 定义中约 30 个零引用。重点：`--lx-sider-width` / `--lx-header-height` / `--lx-content-max-width` / `--lx-sider-collapsed-width` 定义了布局尺寸却在别处硬编码（**改 token 不生效**，最误导）；`--lx-font-xs/sm/md/lg/xl/2xl/3xl` 全死；`--lx-z-dropdown/fixed/popover/toast` 全死；`--lx-coral*/--lx-amber*/--lx-indigo-bg/--lx-pink-bg/--lx-bg-active/--lx-primary-active/--lx-primary-bg-hover/--lx-shadow-sm/--lx-radius-xl/--lx-leading-*/--lx-space-7/8` 零引用。**建议：死 token 要么删除，要么把对应硬编码改成引用它**（后者更好） |
| S2 | **token 语义重复** | `globals.css:42,39,58,26` | `--lx-info` ≡ `--lx-primary` ≡ `--lx-primary-600`（三处同值 `#2455D9`）→ "信息态"和"品牌主色"完全无法区分；`--lx-amber` ≡ `--lx-warning`（同为 `#f59e0b`，纯重复）；`--lx-transition-timing-fast/base/slow` **三档同值**（无梯度意义）。建议合并或赋予差异化取值 |
| S3 | **ConfigProvider 硬编码色与 CSS token 双源** | `providers.tsx:27-31` | `primaryColor:'#2455D9'` 等 5 个色值写死在 TSX，改 `globals.css` 的 token 时 Arco 组件不会跟着变。建议从 CSS 变量读取或抽到共享常量文件（`shared/` 已有 `@lei/shared`） |
| S4 | **越阶 `border-radius` 13 处** | `globals.css` / `arco-overrides.css` | token 阶为 `4/6/8/10/14/9999`，实际使用了 `9px`×5、`2px`×3、`12px`×3、`3px`×1、`11px`×1、`999px`×3。建议全部归阶（`999px` → `--lx-radius-full`） |
| S5 | **`!important` 66 处** | 两文件各 33 处 | 多用于压制 Arco 默认样式。建议逐项评估是否可用更具体的选择器替代。**（注：项目已设 `corePlugins.preflight: false` 关闭 Tailwind preflight——这个决策是正确的，避免了与 Arco 的最大冲突源）** |
| S6 | **文件职责混乱** | `arco-overrides.css` | 文件名暗示"只覆盖 Arco 组件样式"，实际内含 `AppLayout` / `AppHeader` / `PageTabs` / 知识库 / 班次 / 员工详情等**全部应用与业务样式**（2152 行）。建议拆分为 `layout.css` + `arco-overrides.css` + 页面级 CSS Module |
| S7 | **页面级样式堆在全局文件** | `globals.css` | `.dsh-*`（工作台 165 行）、`.ed-*`（员工详情）、`.kb-*`（知识库）等业务样式写在全局文件里，随页面增长会持续膨胀并产生选择器冲突风险。建议迁移到就近的 CSS Module |
| S8 | **`--lx-content-max-width: 1400px` 从未使用** | `globals.css:181` | 超宽屏（2560px）下内容区无上限，表格行过长、阅读跳跃。建议 `.app-content > * { max-width: var(--lx-content-max-width); margin-inline: auto; }`（或明确放弃该约束并删 token） |
| S9 | **`<img>` 未用 `next/image` 且无尺寸** | `login/page.tsx:58-62` | 系统 Logo 用原生 `<img>`，无 `width`/`height` → 布局抖动（CLS）且无优化。建议换 `next/image` |
| S10 | **`prefers-reduced-motion` 覆盖不全** | `globals.css:625-638` | 已覆盖自定义入场动画（👍 做得好），但未覆盖：Arco 组件内建动画、`transition` 类（hover 位移/背景过渡）、`backdrop-filter` 变化。建议补 `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; } }` |

---

## 五、值得保留的优点

审查中发现这些做得比行业平均好，**改造时不要顺手破坏**：

1. **图标按钮无障碍名称零缺失**——脚本扫描「无 `aria-label`/`title` 且无可访问文本的 `<button>`」结果为 **0 处**。这在业务后台里相当少见。`AppHeader.tsx:139,151,196,205`、`PageTabs.tsx:235,266,281,289` 都有规范的 `aria-label`。
2. **动效克制、无堆砌**——`transition: all` **0 处**、`mix-blend-mode` **0 处**、渐变文字 **0 处**。工作台 `.dsh-*` 只用了一条 4px 渐变装饰边 + 统一主蓝 KPI 卡（`globals.css:1448-1585`），是"少而精"的正确示范。
3. **已正确处理 Tailwind 与 Arco 的冲突源**——`tailwind.config.ts` 设了 `corePlugins.preflight: false`。Tailwind Preflight 对组件库是知名破坏源，这个决策避免了大量后续麻烦。
4. **已正确处理 `backdrop-filter` 的包含块陷阱**——`PageTabs.tsx:326-327` 有明确注释说明为何用 portal 渲染到 `body`（`backdrop-filter` 会为 `fixed` 子元素建立包含块），并附了修复说明。这是踩过坑并留下知识的正确做法。
5. **状态色语义映射正确**——`StatusTag.tsx:14-34` 把 20 种业务状态映射到语义色：`迟到/早退/缺勤` → danger、`在职/已通过/正常` → success、`待审批/处理中` → info、`加班` → purple。**国内企业系统的语义约定是准确的**（贴合"通过=绿、异常=红"的国内后台惯例），只是对比度需要修（见 C6）。
6. **Tailwind 色名映射到 CSS 变量**——`text-text-3` → `var(--lx-text-3)`，`bg-surface` → `var(--lx-bg-card)`，保证 Tailwind 用法也随主题切换（这个模式应该推广到 `fontSize`/`spacing`，见 W6）。
7. **表单 label 用了原生 `<label htmlFor>`**——`SearchForm.tsx:203` 的意图完全正确（比多数项目用什么 `aria-labelledby` 拼凑要干净），只是 `id` 漏传（见 W3）——**修 5 行即可，不是设计问题**。
8. **`prefers-reduced-motion` 有实际覆盖**——`globals.css:625-638` 列了 9 个选择器。

---

## 六、按问题类型整理的优化清单

### A. 布局（Layout）

| 优先级 | 问题 | 位置 | 动作 |
|---|---|---|---|
| 🔴 | 外壳零媒体查询 | `arco-overrides.css`（@media = 0） | 补移动端收口块：header 52px / content 12-14px padding / tabs 38px |
| 🔴 | 登录卡片固定 420px 被裁切 | `login/page.tsx:54` | 改 `w-full max-w-[420px] mx-4` |
| 🔴 | 17 处非语义可点击元素 | 见 C7 表 | `dsh-quick-item` 等改 `<button>` |
| 🟡 | `100vh` 移动端裁切 | `arco-overrides.css:1067,1647` | 补 `100dvh` |
| 🟡 | 布局尺寸硬编码，token 空转 | `arco-overrides.css:1143,1461,1665` | 改用 `var(--lx-sider-width)` 等 |
| 🟡 | z-index 层级自相矛盾 | `arco-overrides.css:1936 vs 1472 vs 1142` | 统一走 `--lx-z-*` token |
| 🔵 | 超宽屏无内容上限 | `globals.css:181`（token 未用） | 应用 `--lx-content-max-width` |

### B. 颜色搭配（Color）

| 优先级 | 问题 | 位置 | 动作 |
|---|---|---|---|
| 🔴 | 顶栏/页签栏暗色失效 | `arco-overrides.css:1462,1678` | 换 token + 补暗色值 |
| 🔴 | 滚动条暗色不可见（1.01:1） | `globals.css:320`、`arco-overrides.css:1221` | 换 token + 暗色反转 |
| 🔴 | 登录页无暗色适配（token 只在 `:root`） | `globals.css:109-110`、`login/page.tsx:54` | 补暗色 token + `bg-surface` |
| 🔴 | 状态标签 4 色对比度 FAIL（最低 2.02:1） | `StatusTag.tsx:14-34`、`globals.css:456-461` | 新增"文字级"语义色 token |
| 🔴 | `bg-gray-50`×9 等未映射色暗色失效 | `vacation-audit.tsx`、`schedule-calendar.tsx:1032,1264` | 清空 Tailwind 默认调色板 |
| 🟡 | 焦点环用错品牌蓝(`#165DFF`)且仅 10% | `arco-overrides.css:108,615,626,881` | 统一 `--lx-focus-ring`（品牌蓝 35%） |
| 🟡 | 两处 focus 样式不一致（10% vs 18%） | 对比 `globals.css:991` | 收敛到单一 token |
| 🟡 | `--lx-info` ≡ `--lx-primary` 无法区分 | `globals.css:42` | 差异化取值或合并 |

### C. 特效操作（Effects / Motion）

| 优先级 | 问题 | 位置 | 动作 |
|---|---|---|---|
| 🟡 | 动画简写把时长 token 当缓动函数用 → 多 150ms 延迟 | `globals.css:1441,1444` | 新增 `--lx-ease-standard` |
| 🟡 | 触屏无 `:active` 反馈 | 全站自定义可点击元素 | 补 `:active` 态 |
| 🟡 | 快捷键提示 10px + 2.56:1 对比度 | `arco-overrides.css:1578` | 提到 11-12px + `--lx-text-3` |
| 🟡 | 面包屑容器 hover 造成误导 | `arco-overrides.css:1514` | 限定到 `.breadcrumb-link:hover` |
| 🔵 | reduced-motion 未覆盖 transition / Arco 动画 | `globals.css:625-638` | 补全局 `transition-duration` 归零 |
| 🔵 | 登录页 2 层 `blur(30/34px)` 大尺寸 blur | `globals.css:1134,1138` | 低端设备可降级为 `radial-gradient` 纯色 |

### D. 无障碍（Accessibility）

| 优先级 | 问题 | 位置 | 规范 | 动作 |
|---|---|---|---|---|
| 🔴 | 禁用页面缩放 | `layout.tsx:27-28` | 1.4.4 AA | 删 `maximumScale`/`userScalable` |
| 🔴 | 键盘不可达元素 17 处 | 见 C7 表 | 2.1.1 A | 改 `<button>` 补 `role`/`tabIndex` |
| 🔴 | 状态标签对比度不达 AA | `StatusTag.tsx` | 1.4.3 AA | 见 C6 |
| 🟡 | `focus-visible` 全站 0 定义 | 两 CSS 文件 | 2.4.7/2.4.13 | 建统一焦点样式 |
| 🟡 | 点击目标 < 24px（16px/22px） | `arco-overrides.css:1756`、`globals.css:1748` | 2.5.8 AA | `::before` 扩命中区 |
| 🟡 | 表单 label 悬空（4 类控件缺 id） | `SearchForm.tsx:203` vs 124 | 1.3.1/3.3.2 A | 补 `id={field.key}` |
| 🟡 | 表格行键盘不可达 | `ProTable.tsx:380` | 2.1.1 A | 加"查看"按钮通路 |
| 🟡 | `role="tab"` 缺 `tablist`/`tabpanel` | `PageTabs.tsx:239,252` | 4.1.2 A | 补父级 role |
| 🟡 | 页签菜单无键盘/Escape | `PageTabs.tsx:301-324` | 2.1.1 A | 补 menu role + 键控 |
| 🟡 | 用户菜单是 `<div>` 不可聚焦 | `AppHeader.tsx:219`+CSS:1597 | 2.1.1 A | 改 `<button aria-haspopup="menu">` |
| 🔵 | 异步加载无 `aria-live` 播报 | 全站仅 1 处 | 4.1.3 AA | `DataState` 加载态加 `role="status"` |

### E. 设计系统与工程化（Design System）

| 优先级 | 问题 | 位置 | 动作 |
|---|---|---|---|
| 🟡 | CSS token 与 Tailwind 同名不同值 | `globals.css` vs `tailwind.config.ts` | Tailwind 全部改为引用 CSS 变量 |
| 🟡 | 字号 token 全死（178 硬编码 vs 2 token） | 两 CSS 文件 | 机械替换 13px→`--lx-font-sm`、12px→`--lx-font-xs` |
| 🟡 | 死 CSS 文件 2 个（122 行） | `ProTable.css` / `StatusTag.css` | 删除 |
| 🟡 | `.lx-tag-default` 重复定义值不一致 | `globals.css:461` vs `StatusTag.css:38` | 收敛单一来源 |
| 🔵 | 死 token 约 30 个（含布局尺寸类，最误导） | `globals.css` | 删除或把硬编码改回引用 |
| 🔵 | `ConfigProvider` 色值双源 | `providers.tsx:27-31` | 抽共享常量 |
| 🔵 | `!important` 66 处 | 两 CSS 文件 | 逐项评估替换 |
| 🔵 | 文件职责混乱（override 装业务样式） | `arco-overrides.css` 2152 行 | 拆 `layout.css` + CSS Module |
| 🔵 | 页面级样式堆在全局 | `globals.css` `.dsh-*`/`.ed-*`/`.kb-*` | 迁 CSS Module |
| 🔵 | 圆角越阶 13 处 | 两 CSS 文件 | 归阶到 token |

---

## 七、建议修复顺序

**第一批 · 半天（改动小、收益最大、零功能风险）**
1. `layout.tsx:27-28` 删除缩放禁用（1 行 × 2）← 合规硬伤，最低成本
2. `globals.css` 补 6 个暗色 token + `arco-overrides.css:1462,1678` 换 token（暗色破绽收口）
3. 滚动条换 token（2 处）
4. `login/page.tsx:54` 改 `w-full max-w-[420px] bg-surface`（同时修 C4 + C3）
5. `SearchForm.tsx` 补 4 处 `id`（W3）
6. `.drawer-mask` z-index 改 token（W8）
7. 删除 `ProTable.css` / `StatusTag.css` 两个死文件（W9）

**第二批 · 1 天（无障碍主体）**
8. 建 `--lx-focus-ring` + 全站 `:focus-visible`（W1）
9. `dsh-quick-item` 等改 `<button>`（C7，工作台优先）
10. `StatusTag` 新增文字级语义色 token（C6）——**收益最高的一项，影响全站每个页面**
11. `.page-tab-close` / `.shift-swatch` 扩命中区（W2）
12. `arco-overrides.css` 补移动端媒体查询块（C8）

**第三批 · 1–2 天（系统性收敛）**
13. 字号 178 处机械替换为 token（W7）
14. Tailwind config 的 `fontSize`/`spacing`/`borderRadius` 改引用变量（W6）
15. 清空 Tailwind 默认调色板，消除 `bg-gray-*`（C9）
16. 死 token 清理 + `arco-overrides.css` 拆分（S1/S6）

**第四批 · 待排期**
17. `role="tablist"` 等 ARIA 结构补全（W5）
18. `next/image` 接入、超宽屏约束、reduced-motion 补全（S9/S8/S10）

---

## 附：自动化检测方法与实测数据

本次审查使用了 4 个一次性脚本做客观取证（非人工目测），全部结论可复现：

| 检测项 | 方法 | 结果 |
|---|---|---|
| 配色对比度 | WCAG 相对亮度公式逐对计算（含 8% 透明底混色） | 30 项中 **23 项不达 AA**（12 项 < 3:1，11 项 3–4.5:1） |
| 设计 token 死项 | 提取全部 `--lx-*` 定义，统计 `var()` 引用 + Tailwind 映射交叉验证 | 129 定义 / 约 30 死项 |
| 非语义可点击元素 | 多行 JSX 解析，过滤有 `role`/`tabIndex`/`onKeyDown` 者 | **17 处** |
| 图标按钮无障碍名称 | 解析 `<button>` 内容，剥离 JSX 表达式与标签后判断是否有文本 | **0 处缺失** ✅ |
| 点击目标尺寸 | 解析含 `cursor:pointer` 规则，提取 width/height | 5 条 < 44px，**2 条 < 24px** |
| 样式债务 | `!important` / `outline` / `focus-visible` / `@media` / `transition: all` 计数 | `!important` 66、`focus-visible` **0**、`outline:none` **0**(✅)、`transition:all` **0**(✅) |
| 暗色覆盖完整性 | 统计两个 CSS 文件的 `[data-theme]` / `.arco-theme-dark` 覆盖块 | `globals.css` 1 处(仅 token)、`arco-overrides.css` **0 处** |
| 死文件检测 | 全项目 `import` 语句反查 | `ProTable.css` / `StatusTag.css` **零引用** |
| 构建健康度 | `tsc --noEmit` | 前后端 **0 错误** ✅ |

---

*报告最初为只读审查结论（未修改代码）。下方「八、修复进度追踪」记录了 2026-09-29 起的修复落地情况。修复建议中的代码片段为示意，落地时遵守项目 `AGENTS.md` 的 TDD 约定（改前端页面时同步补 `*.test.tsx` 断言）。*

---

## 八、修复进度追踪（2026-09-29 起）

> 状态图例：✅ 已修复 ｜ 🟡 部分修复 ｜ ⏸ 评估后推迟（非遗漏，属结构性取舍）
> 验证基线：`tsc --noEmit` 0 错误；前端 **80 套件 / 779 用例全绿**（含新增 22 个对比度回归闸门）；
> 设计 token 对比度由 `frontend/src/app/__tests__/design-tokens-a11y.test.ts` 在 CI 内递归解 `var()`、覆盖明暗双主题守护，杜绝「暗色只覆盖 token 不覆盖主题化样式」回潮。

### 🔴 关键问题（P0）

| ID | 问题 | 状态 | 关键改动 |
|---|---|---|---|
| C1 | 暗色下顶栏/页签栏仍是浅色 | ✅ | `arco-overrides.css` 改用 `--lx-header-bg`/`--lx-tabs-bg`；`globals.css` 暗色块补双 token |
| C2 | 暗色滚动条不可见 | ✅ | 新增 `--lx-scrollbar`/`--lx-scrollbar-hover`，暗色反转明度 |
| C3 | 登录页不响应暗色 | ✅ | 卡片 `bg-white`→`bg-surface`；补 `--lx-login-bg` 暗色 token |
| C4 | 登录卡片手机端裁切 | ✅ | 卡片 `w-[420px]`→`w-full max-w-[420px] mx-4`；去 `overflow-hidden`；Logo 改 `next/image` |
| C5 | viewport 禁用缩放 | ✅ | `layout.tsx` 删 `maximumScale`/`userScalable`；移动端输入框 `font-size:16px` |
| C6 | 状态标签对比度不达 AA | ✅ | 新增 `--lx-*-text` 文字级语义色（浅色 4.67–7.10 / 暗色 5.32–7.84）；新增对比度回归闸门 |
| C7 | 17 处交互元素键盘不可达 | ✅ | 17 处 `div/span`→`<button className="lx-clickable">`；补 `:focus-visible` 统一焦点环 |
| C8 | 外壳零响应式 | ✅ | `globals.css` 补 `@media(max-width:767px)` token 降档；`arco-overrides.css` 改用 token + `100dvh` |
| C9 | 未映射 Tailwind 色暗色失效 | ✅ | `tailwind.config.ts` 收窄调色板（清默认 gray/white/black），仅留 token 映射 |

### 🟡 重要问题（P1）

| ID | 问题 | 状态 | 关键改动 |
|---|---|---|---|
| W1 | 焦点可见性近乎为零 | ✅ | 新增 `--lx-focus-ring`（品牌蓝 35%，浅 3.5:1+ / 暗 50%）；`:focus-visible { outline:2px solid var(--lx-focus-outline) }`；Arco 聚焦改用 token |
| W2 | 点击目标 < 24px | ✅ | `.page-tab-close`/`.shift-swatch` 用 `::before` 扩展命中区（零观感变化） |
| W3 | 搜索表单 label 悬空 | ✅ | `DatePicker`/`RangePicker` 经 `inputProps={{id}}` 落 id；`Input`/`EmployeeSelect` 补 `id` prop |
| W4 | 表格行键盘不可达 | ✅ | `ProTable` 行加 roving tabindex + ↑↓ 导航 + Enter/Space 打开 + `.lx-sr-only` 提示 |
| W5 | Tab 角色结构 + 右键菜单键盘 | ✅ | `role=tablist/tabpanel` + roving tabindex；菜单 `role=menu/menuitem` + 方向键/Escape + 焦点归还；去掉外层 `onContextMenu` 屏蔽 |
| W6 | 双源真值 | ✅ | `tailwind.config.ts` 的 `colors/fontSize/spacing/borderRadius/boxShadow/zIndex/transitionDuration` 全部引用 CSS 变量 |
| W7 | 字号 178 处硬编码 | ✅ | 13px/12px/11px/10px/14px/15px/20px/24px 批量归 `--lx-font-*` token |
| W8 | z-index 混乱 | ✅ | 外壳改用 `--lx-z-*` 阶；`.drawer-mask` 用 `calc(var(--lx-z-fixed)-1)` |
| W9 | 死文件 | ✅ | 删除 `ProTable.css`/`StatusTag.css`；`.lx-tag-*` 收敛到 `globals.css` 唯一来源 |
| W10 | 动画简写误用 | ✅ | 新增纯缓动 `--lx-ease-standard`，`.dsh-*` 入场动画改用它（消除 150ms 误插延迟） |
| W11 | 100vh 移动端裁切 | ✅ | `.app-layout`/登录页改 `100dvh`（保留 `100vh` 降级） |
| W12 | hover-only/右键屏蔽等 | ✅ | 面包屑容器 hover 收窄到 `.breadcrumb-link`；`kbd` 10px→11px + `--lx-text-3`；`.page-tab` 补 `:active` 态 |

### 🔵 建议（P2）

| ID | 问题 | 状态 | 说明 |
|---|---|---|---|
| S1 | token 死项 ~30 | 🟡 部分 | 布局类死 token（`sider-width`/`header-height`/`content-max-width`/`sider-collapsed-width`）已改为被引用；删除 `--lx-amber*` 等纯重复项；残留 `--lx-font-3xl/4xl`、`--lx-z-dropdown/toast`、`--lx-shadow-sm`、`--lx-space-7/8` 为功能性保留或待清理 |
| S2 | token 语义重复 | ✅ | 删除 `--lx-amber`/`--lx-amber-bg`/`--lx-font-bold`；保留 `--lx-info`≡`--lx-primary` 别名（信息态刻意等同主色） |
| S3 | ConfigProvider 双源 | ✅ | 新增 `useArcoThemeTokens()` hook 运行时从 `:root` 读 `--lx-*`（MutationObserver 监听 `data-theme`），消除 TSX 硬编码色 |
| S4 | 越阶 border-radius | ✅ | 全部归阶（新增 `--lx-radius-2xs`）；Tailwind 补 `DEFAULT` 映射；`rounded-2xl`/`rounded-[12px]` 改为 `rounded-xl` |
| S5 | `!important` 66 处 | 🟡 评估后保留 | 工具类（`lx-mobile-*`）必须 `!important`；压制 Arco 默认样式的项属正常工程实践，未批量删除（删除需逐项运行时回归，收益低、风险高） |
| S6 | 文件职责混乱（2152 行） | ⏸ 推迟 | 结构性拆分会引入大量风险且不影响功能/规范符合性，作为后续独立重构议题，不在本轮 UI 修复范围 |
| S7 | 页面级样式堆全局 | ⏸ 推迟 | 同 S6，随文件拆分议题一并处理 |
| S8 | content-max-width 未用 | ✅ | 已在 `arco-overrides.css:1968` 应用于内容区最大宽度（1640px） |
| S9 | `<img>` 未用 next/image | ✅ | 登录 Logo 改 `next/image`（unoptimized 消 CLS） |
| S10 | prefers-reduced-motion 不全 | ✅ | 新增全局 `transition-duration:0.01ms` 降级，覆盖 hover 过渡/Arco 动画 |

### 收尾遗留决策（需用户拍板）

1. **是否 `git push`**：本轮四批次 UI 修复 + 上一轮已在 `refactor-v2` 分支累计领先 `origin` 19 个提交，修复尚未落盘提交。建议按批次 `git commit` 后由你决定是否推送。
2. **`.workbuddy/` 跟踪矛盾**：上一轮提交 `8a1ef35` 误扫入 102 个 `.workbuddy/` 文件（已跟踪+已忽略并存）。需决定 A) 从跟踪移除并加忽略 / B) 保留 / C) 另议。
3. **S1 残留死 token 清理**：可顺手删除 `--lx-font-3xl/4xl`、`--lx-z-dropdown/toast`、`--lx-shadow-sm`、`--lx-space-7/8`，但属低风险收尾，可并入下一批。

