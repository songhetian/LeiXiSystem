# ADR-0018: 前端响应错误统一语义（business code ≠ 0 拦截器即 reject）

- 状态：已接受（Accepted）
- 日期：2026-10-26
- 关联：ADR-0006（Arco Design Pro UI 标准）、`frontend/src/lib/request.ts`、`frontend/src/lib/api-error.ts`

## 背景

前端 axios 响应拦截器（`lib/request.ts`）对带 `code` 字段的后端响应约定为：

- `code === 0` → 直接 resolve（返回整个响应体 `res`，调用方取 `res.data`）；
- `code !== 0` → 构造 `ApiError`，非 mock 用户且非 code=5003（会话过期）时**由拦截器统一弹出错误 toast**，标记 `surfaced = true` 后 `Promise.reject(err)`。

由此得出关键结论：**services 层（`frontend/src/services/*.ts`）所有请求都经该实例且无自行 catch 分支，因此"resolve 出来的响应其 `code` 必为 0"**。调用方形如：

```tsx
if (res.code === 0) { /* 使用 res.data */ } else { Message.error(res.message || '…'); }
```

的 `else` 分支在真实运行时**不可达**（死分支）：toast 已由拦截器弹出，调用方再弹一次的写法永不执行。存量代码（约 100+ 处）为历史遗留，量大且有部分 `else` 兼任 `res.data` 缺失兜底，一次性盲删风险大于收益。

## 决策

1. **统一语义**：调用方只处理 `code === 0` 的成功路径；业务失败（`code !== 0`）与网络/异常一律走 `catch`，错误 toast 由拦截器统一负责，调用方仅在做**二次差异化提示**（如需在表单字段上、Modal 顶部展示自定义文案）时才用 `notifyError(e, fallback)` / `getApiErrorMessage(e, fallback)`，并**不再重复** `Message.error`。
2. **新代码禁写 `else` 死分支**：不再新增 `if (res.code === 0) … else Message.error(res.message)` 形态；预期失败（如审批被驳回、唯一键冲突要做字段级提示）用 try/catch + `getApiErrorMessage` 取 `ApiError.message`。
3. **存量死分支处置**：触碰（改版/迁移）某文件时顺手把该文件的 `res.code === 0` 外层判断收掉；不做专项批量删除。
4. **例外路径**：文件下载、blob 请求等非 JSON 响应不走该拦截器的 `code` 判断（无 `code` 字段直接 resolve），调用方按原值处理。

## 后果

- 正向：错误提示只有一处来源（拦截器），避免同一次失败弹两个 toast；调用方逻辑更直白（成功路径 + catch）。
- 成本：依赖拦截器语义的隐式约定，新人需读本 ADR；`res.message` 字段在 resolve 分支下无意义（成功时 code=0，message 通常为空）。
- 验证方式：`frontend/src/services/__tests__/*.test.ts` 中 `expect(result.code).toBe(0/3001/…)` 的非零断言均基于测试内对 request 模块的 mock，不改变真实运行时语义。
