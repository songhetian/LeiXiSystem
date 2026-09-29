# 收口批次报告：类型债清零 + 兼容兜底 + 文档对齐（#35~#40）

> 日期：2026-09-29 ｜ 分支：`refactor-v2`（**未推送**，领先 `origin/refactor-v2` 39 提交）
> 承接指令：「把这些问题全部修复了 达到百分百」
> 本报告只记录**做了什么 / 验证到什么程度 / 还差什么**，不重复各 ticket 内的字段级细节。

## 一、六个批次总览

| # | 批次 | 核心产出 | 落盘 |
|---|---|---|---|
| 35 | 后端 Prisma/库类型债收敛 | 生产 `as any` **102 → 0**；消除两处重复口径 | 已提交 |
| 36 | 员工 email 缺口 | `Employee.user?.email` 透传，去 `as any` | 已提交 |
| 37 | 前端 `as any` 收敛 | **24 → 0**；`tsc` 0，`jest` 786 → 795 | 已提交 |
| 38 | CSS 兼容兜底 | `color-mix()` 回退 + `-webkit-backdrop-filter`；`next build` 36 路由通过 | 已提交 |
| 39 | 自定义 modal focus trap | `use-focus-trap.ts` + CommandPalette 接入；+9 用例 | 已提交 |
| 40 | 文档对齐：step-0~5 状态核对 | 6 个 ticket + README 按仓库证据重写 | `d78d047` |

## 二、本轮实际修到的「真 bug」（不是类型洁癖）

1. **考勤日报状态重算存在两份实现且行为不一致**（最重要）
   `attendance-approval.listener.ts` 与 `employee-tx.service.ts` 各带一份 `recalcDailyStatus`，
   员工侧版本漏了 `punchCount<=0 → absent`、`punchCount>4 → abnormal` 两条分支。
   后果：同一条日报经「申诉审批通过」与「其他入口」重算，结果可能不同（静默数据漂移）。
   → 抽出口径单一来源 `backend/src/attendance/daily-status.ts::resolveDailyStatus()`，两处统一调用，
   并补 4 个单测（absent 保持 / late→normal / punchCount>4→abnormal / leave 保持）。

2. **报表查询了 Employee 上不存在的列**
   `reports.service` 读 `gender/email/bankAccount/bankName` 并输出 `byGender` 维度，而 Employee 模型无这些列。
   旧测试还**断言了这个不存在的列**（等于把 bug 测成了预期）。
   → 删列 + 把测试改成「不得查询不存在的列」+「结构维度只含真实存在的列」。

3. **fastify 双版本导致的类型分裂**（根因修复，非 cast 掩盖）
   `@nestjs/platform-fastify` 钉死 fastify `4.28.1`，而 backend 写 `^4.28.1` → 装出第二份 `4.29.1`，
   `@fastify/*` 的模块类型增强只落在一份副本 → 移除 `main.ts` 的 3 处 `as any` 后类型不兼容。
   → 精确钉版 `"fastify": "4.28.1"`，副本收敛为一，`as any` 可安全移除。

## 三、踩坑与教训（可复用）

- **pnpm 重装会让 hoist 软链退化成空目录**：改依赖版本后重装，`node_modules/.pnpm/node_modules` 下
  `fastify/rollup/semver/statuses/xmlbuilder` 5 个软链变成**空目录**而非 junction，导致插件内部
  `require('fastify')` 报 MODULE_NOT_FOUND（容器起不来，tsc 却是绿的）。
  诊断用 `fs.lstatSync` / `readdirSync`；正解是**让库版本唯一**，pnpm 自己会连对，不要手工补软链。
- **`color-mix()` 不支持时会让整条声明失效**（不是只丢那一个效果），因此回退要写在**声明之前**补真 token 值。
- **验证 tsc 覆盖范围**：删 `as any` 后，往改动文件注入一条故意类型错误，确认 tsc 真的会报，再撤销——
  避免「以为 tsc 覆盖了、其实没编到该文件」。

## 四、当前实测基线（2026-09-29）

| 项目 | 结果 |
|---|---|
| 后端 `tsc --noEmit` | 0 错误 |
| 后端 jest（`src`） | 82 套件 / 全部通过 |
| 后端 `tests/` e2e·unit | 82 个文件（需真实 DB，未纳入本地快跑） |
| 前端 `tsc --noEmit` | 0 错误 |
| 前端 jest | 80 套件 / 795 用例全绿 |
| 前端 `next build` | 36 路由全部编译通过 |
| 生产源码 `as any` | 后端 0 / 前端 0 |

## 五、仍差什么（上线前必办，非本轮范围）

1. **XFace600 硬件未到货**（唯一硬功能阻塞）：打卡采集主路径未经真机验证，T21 冻结；
   需先定「CSV 导入 / 设备推送 / HTTP 拉取」的生产组合。
2. **算薪「3 名员工人工对账」未做**：代码完备 ≠ 算得对，是上线硬门槛。
3. **上线运维动作全未执行**：mysqldump 备份、灰度、冒烟、切流量。
4. **第 11.7 UI 验收清单**属人工走查，未做。
5. **待用户决策三项**：
   (a) 是否 `git push`（领先 origin 39 提交）＋ 是否打 tag；
   (b) `.workbuddy/` 的跟踪矛盾（已被跟踪，gitignore 失效）；
   (c) XFace600 设备模式 A（Push）/ B（拉取 REST）。
6. 小尾巴：backend 残留无用 `vitest` devDependency；无浏览器端 Playwright E2E。
