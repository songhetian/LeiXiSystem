# ADR-0021: 样式覆盖以「真实 DOM 类名」为准，并用闸门兜住

- 状态：已接受（Accepted）
- 日期：2026-10-31
- 关联：ADR-0006（Arco Design Pro UI 标准）、`frontend/src/app/globals.css`、`frontend/src/app/arco-overrides.css`、`frontend/src/app/__tests__/arco-classnames.test.ts`

## 背景

一次样式审计（逐条比对 `node_modules/@arco-design/web-react/dist/css/arco.css` 与自有 CSS）发现 **50 余条覆盖规则的类名在 Arco 里根本不存在**，包括：

| 写的 | Arco 真名 | 后果 |
|---|---|---|
| `.arco-form-item-label` | `.arco-form-label-item` | 全站表单标签 13px/text-1 从未生效，落回 14px |
| `.arco-modal-header-title` / `.arco-modal-body` | `.arco-modal-title` / `.arco-modal-content` | 弹窗标题字重、正文内边距全未生效 |
| `.arco-table-tr-checked` | `.arco-table-row-checked` | 4 个带 rowSelection 的页面选中行底色不生效 |
| `.arco-select-view-focused` | `.arco-select-focused`（且边框在 `.arco-select-view` 上） | Select 只有 1px 变色，没有统一 3px 焦点环 |
| `.arco-input-wrapper` | `.arco-input-inner-wrapper` | 控件统一最小宽度对 Input/Password 不生效 |
| `.arco-dropdown-item` / `-list` / `-option` | `.arco-dropdown-menu-item` / `-menu` | 顶栏用户菜单的圆角/内边距/投影全未生效 |
| `.arco-tag-default` / `.arco-btn-default` | 不存在（Tag 无 color 不加类；Button `type="default"` 渲染为 `-secondary`） | 纯死代码 |

CSS **选不中元素不会报错**，因此这类缺陷可以长期静默存在，且无法靠「调数值」修复——因为改的那条规则本身没生效。

进一步还发现两类「类名对了但位置不对」的问题，仅比对类名表查不出来：

1. 属性写在了错误的层级：字号/颜色在 `.arco-form-label-item > label`（(0,1,1)），只写容器 (0,1,0) 压不住；
2. 特异性不足：Arco 用 `.arco-select.arco-select-focused .arco-select-view`(0,3,0) 设焦点边框，我们写 (0,2,0) 时即使类名正确也会输。

## 决策

1. **只写 Arco 真实存在的类名**。取证两条路径：`dist/css/arco.css`（有样式的类）与 `es/<Component>/*.js`（DOM 上真正拼出的类，如 `prefixCls + "-range"`）。两者不一致时（DOM 有、CSS 无）该规则有效，但要加注释说明来源。
2. **不加 `!important` 除非特异性真的不够**。本文件在 `arco.css` 之后加载，同权重自然胜出；只有 Arco 用更高特异性时（如 `thead > .arco-table-tr > .arco-table-th`、`.arco-statistic-content .arco-statistic-value`）才允许，且注释里必须写明是哪条规则、特异性多少。当前 `arco-overrides.css` 的 `!important` 声明数由 41 降到 18。
3. **主题化颜色一律走 token**。`--lx-*` 在 `:root` 与 `[data-theme="dark"]` 成对定义；不允许在组件样式里硬编码只适用于浅色的色值（本轮修掉的是登录卡片 `rgba(255,255,255,.88)` 在暗色下导致的「浅字压白卡」）。
4. **不用的组件不留覆写**。Ribbon / Countdown / Steps / Transfer / Cascader / BackTop / AutoComplete / VirtualList / 独立 Menu 在本项目 0 处使用，对应覆写整段删除；侧栏是自研 `.side-item`，唯一的 `<Menu>` 出现在 Dropdown 内（prefixCls 已被改成 `arco-dropdown-menu`），所以 `.arco-menu-*` 一条都命中不了。
5. **闸门固化**（`src/app/__tests__/arco-classnames.test.ts`）：
   - 自有 CSS 里的每个 `.arco-*` 必须存在于 `arco.css`，或落在带取证说明的 `DOM_ONLY` 白名单（现 4 条）；
   - 每个 `.lx-*` 必须至少被一处 `src/**/*.{ts,tsx}` 引用（防止工具类残骸回流）；
   - 若 Arco 后续给白名单类补了样式，测试会失败提示移出白名单。

## 后果

- 正向：设计值（13px 标签、统一焦点环、选中行底色、弹窗内边距）真正生效；新增覆盖不可能再静默失效。
- 成本：改动 `arco-overrides.css` 前需先取证，不能再凭印象写类名；升级 Arco 大版本时需重跑闸门（类名可能变更）。
- 验证：`npx jest src/app/__tests__/arco-classnames.test.ts src/app/__tests__/design-tokens-a11y.test.ts`；暗色登录卡片另用 Chromium 无头截图人工确认过一次（浅/深两套均通过）。
