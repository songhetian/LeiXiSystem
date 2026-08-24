# ADR-0015: 知识库文件预览采用浏览器原生方案（取代 ADR-0012 的 @open-file-viewer）

- 状态：已接受（Accepted），2026-08-24
- 取代：ADR-0012（2026-08-24 修订后已被本 ADR 覆盖）

## 背景

ADR-0012 曾决定采用 `@open-file-viewer`（前端 npm 包）+ `pdfjs-dist` 承载知识库附件在线预览。在批量九对齐参考项目 `LeiXiSystem-main` 时，参考实现采用**浏览器原生能力**（`img`/`video`/`iframe` + Office 在线预览，零第三方预览依赖，组件即 `FilePreviewModal.jsx`）。为严格对齐参考、去除第三方预览依赖，需调整预览方案。

## 决策

采用**浏览器原生能力 + Office 在线预览**作为在线文件预览方案，取代 `@open-file-viewer` 与 `pdfjs-dist`：

- 图片/视频/音频：使用原生 `<img>` / `<video>` / 音频元素渲染
- PDF：使用 `<iframe src="{url}#toolbar=1">` 原生渲染
- Office 类文档（doc/xls/ppt 及其扩展集）：使用 **Office Online 查看器**在线预览
- 其余不支持类型：下载兜底（`<a download>`）
- 分类逻辑集中在前端 `getPreviewMode(fileName, mimeType)`，渲染统一收敛到 `FilePreviewModal` 内嵌模态组件

**移除项**：`preview/[id]` 路由、`@open-file-viewer/core`、`@open-file-viewer/react`、`pdfjs-dist` 依赖及 `public/pdfjs` 静态资源（`package.json` / `next.config.mjs` 同步清理）。

## 备选（已排除）

- `@open-file-viewer` + `pdfjs-dist`（ADR-0012）：第三方依赖，与参考实现偏离，本次对齐过程中移除
- KKFileView / 在线转换 API：与 ADR-0012 相同的排除理由（服务复杂度/转码可靠性与隐私风险）

## 后果

- 正向：零第三方预览依赖、与参考实现 `FilePreviewModal` 完全对齐、前端内聚、内网数据不出系统。
- 成本：Office 复杂格式浏览器原生解析能力有限，Office 在线预览依赖访问 https（内网离线场景需评估 Office 在线服务可达性）；无法覆盖时走下载兜底。
- 约束：文件访问仍走后端鉴权（ADR-0009/ADR-0010）约束文件地址；预览渲染必须复用 `FilePreviewModal`，不另造轮子。