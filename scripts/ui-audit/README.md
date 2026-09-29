# 前端 UI 设计规范审计工具集

配套报告：`docs/reviews/2026-09-29-ui-design-review.md`

用于对 `frontend/src` 的 UI 代码做**客观取证**（对比度、无障碍语义、点击目标、设计 token 健康度），
修复后复跑同一套脚本即可验证收敛情况——不要依赖肉眼判断。

## 运行

```bash
# 一键全部
bash scripts/ui-audit/run-all.sh

# 或单独运行（需 managed Python）
"C:/Users/Song/.workbuddy/binaries/python/versions/3.13.12/python.exe" scripts/ui-audit/01-color-contrast.py
```

## 各脚本职责

| 脚本 | 检测内容 | 判定基准 |
|---|---|---|
| `01-color-contrast.py` | 全部文字/语义色/点缀色/暗色底色的对比度，含 8% 透明底混色合成 | WCAG SC 1.4.3 (AA ≥4.5:1)、SC 1.4.11 (≥3:1) |
| `02-clickable-semantics.py` | `div`/`span`/`li`/`td` 上的 `onClick`，排除已有 `role`/`tabIndex`/`onKeyDown` 者 | WCAG SC 2.1.1 Keyboard (A) |
| `03-icon-button-labels.py` | `<button>` 无可访问名称（无 `aria-label`/`title` 且无文本） | WCAG SC 4.1.2 (A) |
| `04-target-size.py` | 含 `cursor:pointer` 规则的尺寸，标出 < 24px / < 44px | WCAG SC 2.5.8 (AA ≥24×24) |
| `05-design-token-audit.py` | `--lx-*` token 的定义数 / 引用数 / 死项 / 取值重复 | 设计系统一致性（无规范，属卫生指标） |

## 已知注意事项

- **`05` 的死 token 判定需交叉验证 Tailwind**：仅通过 Tailwind 类名（如 `bg-quick-monthly`）使用的
  token，源码里看不到 `var()` 引用，会被误判为死项。判定前先查 `frontend/tailwind.config.ts`
  的 `theme.extend.colors` 是否映射了该变量。
- **`02` 只覆盖单文件扫描**：跨组件的可点击元素（如从 props 传入 `onClick` 的 `<div>`）无法识别。
- **`01` 的底色为理论合成值**：`backdrop-filter` 元素的真实合成底色需浏览器实测（如 `.app-header`）。
