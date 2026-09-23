# ADR-0016: 附件存储策略可配置（本地磁盘默认 / 生产接 OSS）

- 状态：已接受（Accepted）
- 日期：2026-08-26
- 修订：取代 ADR-0009 第 2 条关于附件后端的落地方式（ADR-0009 的"直传 vs 代理"框架仍有效，本记录明确开发默认实现）

## 背景

ADR-0009 要求附件"后端代理转发 → 落 OSS 并登记"。但开发环境无真实 OSS 凭据，若强行走 OSS 会导致本地上传不可用、每次开发阻塞。开发环境需要先能用本地磁盘，上线后再切 OSS。

## 决策

文件存储抽为 **`StorageDriver` 接口**（`save(buffer, originalName, bizType) → { url, fileName }`），由 `FilesService` 统一委托，避免业务层感知底层存储差异：

1. **开发环境（默认）**：`FILE_STORAGE=local`，使用 `LocalStorageDriver`，写入 `uploads/{bizType}/` 目录，读取走 `GET /files/serve`（鉴权 + 防目录穿越）。
2. **生产环境**：`FILE_STORAGE=oss`（上线前接好），以 `OssStorageDriver` 实现同一接口并在构造处切换注入，上传写入 OSS、读取走预签名/私有下载。OSS 凭据只存后端（沿用 ADR-0009）。

## 后果

- 正向：开发零配置可用本地；业务与上传/读取代码不感知存储形态；上线只需实现并切换 OSS 驱动 + 配置 `OSS_*`，无重构。
- 成本：`/files/serve` 当前仅支持本地读取；接 OSS 后需为下载实现签名 URL 或后端代理读取。
- 约束：上传接口仍经 `@RequirePermission('file:upload')`；入库 URL 保持 `/uploads/{bizType}/{name}` 形态，前端与表数据不变。