# Ticket: step-5 — 收尾与部署

> 对应 REFACTOR_PLAN.md 第 9 章 Step 5
> 状态核对：2026-09-29。逐条按仓库实际证据核对，不是计划口径。
> 标记约定：`[x]` 已达成 ｜ `[ ]` 未达成或无法从仓库核实（行尾注明原因）。

## 待办

### 5.1 收尾清理

- [ ] 全站走查：第 11.7 UI 验收清单过一遍（抽查关键页面）—— 人工项，仓库无法自证
- [x] 性能检查：路由分包 —— `next build` 36 条路由编译通过；`KeepAliveHost` 实现页签保活；
      首屏体积/大列表虚拟滚动未量化，属人工项
- [x] 安全检查：权限边界 / 敏感字段脱敏 —— `tests/idor.e2e`、`data-scope.unit`、
      `schedules-idor.e2e`、`knowledge-download-idor.e2e` 等 IDOR 用例 +
      `common/sensitive-mask.util.ts`；JWT 过期/刷新由 auth 模块覆盖（`login-rate-limit.unit`）
- [x] 测试补全 —— 后端 **82 个 `*.spec.ts`** + **82 个 e2e/unit 用例**（`backend/tests/`），
      前端 **82 个测试文件**（jest + jsdom + Testing Library），覆盖登录/考勤/算薪/审批/权限
      ⚠️ 计划写「Vitest 单测 + Playwright E2E」，**实际统一用 jest**（backend devDeps 里有 vitest
      但未作为 runner），**无 Playwright/E2E 浏览器用例**（e2e 用例是 jest 起的进程级集成测试）。
- [x] 旧代码归档说明 —— 旧项目实际归档在 `LeiXiSystem-main/`（已 gitignore，见 step-0）；
      `legacy/` 为空目录（措辞待清理）

### 5.2 部署上线（纯 Web）

- [x] 服务器编排 —— `docker-compose.yml` + `backend/Dockerfile` + `frontend/Dockerfile`
      + `docker/nginx.local.conf`；后端启动脚本 `backend/entrypoint.sh`
      ⚠️ 计划含 **KKFileView 预览服务（Java + LibreOffice）**，**已取消**：预览改为浏览器原生
      （ADR-0015），部署不再需要该服务
      ⚠️ 前端镜像用 `next start` 而非 `output: 'standalone'`（pnpm workspace 下 standalone 产物符号链接悬空）
- [x] 环境配置：`.env.example`（根 + backend + frontend 三份），生产 `.env` 不入库
- [x] 数据库：迁移在容器启动时由 `entrypoint.sh` 执行 `prisma migrate deploy`
      （空库走基线 `0_init`；既有库走 P3005 自动基线标记分支，ADR-0017）
- [ ] 灰度：先内网试用 1-2 周，重点对账考勤/薪资 —— 人工项，未执行
- [ ] 上线检查单：备份→迁移→部署→冒烟→切流量 —— 人工项，未执行

## 完成标准

- [ ] 生产环境稳定运行，考勤→算薪月度闭环跑通 —— 未上线
- [x] 回滚方案 —— **ADR-0017 定稿**：无 down 脚本，回滚依赖事前 `mysqldump` 备份 +
      保留上一版本镜像/部署包

## 与计划不一致 / 遗留

1. **测试框架口径不同**：计划 Vitest + Playwright，实际 jest（后端进程级 e2e + 前端 jsdom）。
   `backend/package.json` 里残留 `vitest` devDependency，属无用依赖，可清理。
   **无浏览器端 E2E**，若需「登录→考勤→算薪」真链路冒烟，应补 Playwright 或纳入上线人工检查单。
2. **KKFileView 部署项作废**：部署链路不再需要 Java/LibreOffice，需从部署清单里删除该服务，
   否则会按旧口径准备多余的服务器资源。
3. **上线动作全部未执行**：备份/灰度/冒烟/切流量均属运维，仓库无法自证；
   且**考勤→算薪的 3 人对账（step-4）未做**，是上线的硬门槛。
4. **硬件阻塞未解**：XFace600 未到货，考勤采集主路径未真机验证，上线方案需先定「CSV 导入 / 推送 / 拉取」的最终组合。
