# T16 · 统一响应信封 + 全局异常过滤器 + 错误码中央表

> 横切基础件（已提交 `05887a8`）。所有既有/后续 ticket 的依赖。对齐 `docs/api/core-contracts.md` §1/§2。

## What to build
- 所有 HTTP 响应统一为信封：`{code, message, data}`。成功 `code:0,message:'ok'`；异常 `data:null` + 正确 HTTP 状态。
- 错误码 → message 唯一真相源（`error-messages.ts`），禁止各处硬编码 message。
- 业务码与 HTTP 状态严格分离：422 是传输层状态，**绝不**作业务码。

## 交付物
- `common/filters/all-exceptions.filter.ts`：`@Catch()` 全局过滤器，归一 `{code,message,data:null}`。
  - 业务码被误写为 HTTP 状态（如 422）→ 归位 `PARAM_INVALID=4000` / `INTERNAL_ERROR=5000`。
  - 未知异常 → 500 + 5000，服务端 `console.error` 留痕，不向客户端泄露内部信息。
- `common/interceptors/response-envelope.interceptor.ts`：成功响应补齐 `message:'ok'`。
- `common/error-messages.ts`：`ERROR_MESSAGES` 中央表（code→message）。
- `common/biz-exception.ts`：`BizException(code, httpStatus)` 携带业务码。
- `common/common.module.ts`（`@Global()`）：注册 `APP_FILTER` + `APP_INTERCEPTOR`；`AppModule` 引入。
- `common/error-codes.ts`：补 `PARAM_INVALID=4000` / `INTERNAL_ERROR=5000`；知识库 5001/5002 冲突改为独立 `5004/5005`。

## 修复的契约违规（core-contracts §2）
- `code:422` 误用（把 HTTP 状态当业务码）：`employees.controller` ×2、`punch-logs.service` ×5 → 改为 `PARAM_INVALID`。

## 测试
- `tests/response-envelope.test.ts`（隔离，不依赖 DB）：6/6。
  - 行级越权 5003→403、资源不存在 1002→404、参数校验 4000→422、BizException 自动取 message、成功信封、未捕获异常→500+5000 不泄露。
- 回归：employees 13/13、shifts-schedules 14/14 无破坏。
- 注：两个全 AppModule e2e 在同一 jest 进程内一起跑存在 bootstrap 隔离问题（非 T16 引入），单跑均绿。

## 后续
- T17（错误码治理）已随本票落地（中央表 + message + BizException），剩余工作：将各 service 散落的魔法数字逐步替换为 `ERROR_CODES.*`（渐进，不做大改写）。
- T18：补齐 S09–S15 缺失的 Prisma migration 并验证可跑。
