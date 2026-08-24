# ADR-0012: 知识库在线文档预览采用 @open-file-viewer（弃用 KKFileView）

- 状态：**已取代**（由 ADR-0015 取代，2026-08-24），本 ADR 仅作历史记录
- 原始日期：2026-08-12；修订日期：2026-08-24

## 背景

知识库附件（doc/xls/ppt/pdf/图片等）需要在线预览，不能要求用户下载后本地打开。需要选择预览方案。原方案为 KKFileView（Java + LibreOffice 转码）。

## 决策（2026-08-24 修订）

采用 **`@open-file-viewer`**（前端 npm 包）+ `pdfjs-dist` 作为在线文档预览方案：

- 前端原生集成：图片用 `<img>`，PDF 用 `@open-file-viewer/pdf`（基于 pdf.js），office 类文档经浏览器内解析/原生展示兜底
- 文件源：仍走后端代理鉴权（ADR-0009）获取文件流；预览前端拉取鉴权后的文件地址渲染
- 无独立转码进程，复用现有前端应用，减少一套 Java/LibreOffice 服务

**弃用 KKFileView 原因**：其内网转码方案存在严重 bug（文件格式兼容/转码稳定性问题），实测不可靠，不再引入该服务。

## 备选（已排除）

- KKFileView（kekingcn，Java + LibreOffice）：转码存在大 bug，已弃用
- 在线转换 API（WPS/微软 Office Online 预览）：需上传文件到第三方、有格式与隐私风险，内网场景不合适

## 后果

- 正向：前端内聚、无额外运维服务、内网数据不出系统、pdf 解析复用成熟 pdf.js。
- 成本：office 复杂格式（非 pdf/图片）浏览器原生预览能力有限；如需服务端转码则未来可评估引入，届时需重新开此 ADR。
- 约束：文件访问仍走后端鉴权（ADR-0009/ADR-0010 部门数据隔离）约束文件地址；预览实现须复用现有 `viewer.tsx` 组件，不另造轮子。
