# ADR-0015: 知识库文件预览采用浏览器原生方案（取代 ADR-0012 的 @open-file-viewer）

- 状态：已接受（Accepted），2026-08-24；2026-09-25 修订（Office 预览保留 `@open-file-viewer`）
- 取代：ADR-0012（2026-08-24 修订后已被本 ADR 覆盖）

## 背景

ADR-0012 曾决定采用 `@open-file-viewer`（前端 npm 包）+ `pdfjs-dist` 承载知识库附件在线预览。在批量九对齐参考项目 `LeiXiSystem-main` 时，参考实现采用**浏览器原生能力**（`img`/`video`/`iframe` + Office 在线预览，零第三方预览依赖，组件即 `FilePreviewModal.jsx`）。为严格对齐参考、去除第三方预览依赖，需调整预览方案。

## 决策

采用**浏览器原生能力**作为在线文件预览方案：

- 图片/视频/音频：使用原生 `<img>` / `<video>` / 音频元素渲染
- PDF：使用 `<iframe src="{url}#toolbar=1">` 原生渲染
- Office 类文档（doc/xls/ppt 及其扩展集）：使用 **`@open-file-viewer` 在浏览器端直渲染**（理由见「修订记录」）
- 其余不支持类型：下载兜底（`<a download>`）
- 分类逻辑集中在前端 `getPreviewMode(fileName, mimeType)`，渲染统一收敛到 `FilePreviewModal` 内嵌模态组件

**移除项**：`preview/[id]` 路由、`public/pdfjs` 静态资源（`next.config.mjs` 同步清理）。

**保留项**：`@open-file-viewer/core`、`@open-file-viewer/react` 与 `pdfjs-dist` 依赖保留，仅供 Office 文档客户端渲染使用。

## 备选（已排除）

- **Office Online 查看器**（`view.officeapps.live.com`，即参考实现方案）：要求文件 URL 可被公网访问。本项目为服务器本地/局域网部署，且文件地址受后端鉴权约束（ADR-0009/ADR-0010），微软服务器无法拉取内网文件地址，生产环境必然预览失败，故排除。
- KKFileView / 在线转换 API：与 ADR-0012 相同的排除理由（服务复杂度/转码可靠性与隐私风险）。

## 后果

- 正向：图片/视频/音频/PDF 零第三方依赖，与参考 `FilePreviewModal` 的信息层级对齐；Office 预览在浏览器端完成，**无需公网出口**，内网数据不出系统。
- 成本：保留 `@open-file-viewer` / `pdfjs-dist` 依赖，前端依赖面与产物体积大于参考实现。
- 约束：文件访问仍走后端鉴权（ADR-0009/ADR-0010）约束文件地址；预览渲染必须复用 `FilePreviewModal`，不另造轮子。

## 修订记录

- **2026-09-25**：初版曾宣称「已移除 `@open-file-viewer` 与 `pdfjs-dist` 依赖」，与代码实际不符——实测两者仍被 `features/knowledge/components/ViewerPreview.tsx` 引用并用于 Office 文档渲染，依赖也确实仍在 `frontend/package.json`。根因：初版照搬参考实现的「Office 在线预览」，而参考依赖 `view.officeapps.live.com`，要求文件 URL 公网可达，与本项目「局域网部署 + 后端鉴权文件地址」的约束冲突，生产不可用。本次修订定案：**Office 预览保留 `@open-file-viewer` 客户端渲染，不再移除该依赖**；仅 `preview/[id]` 路由与 `public/pdfjs` 静态资源按原计划移除。