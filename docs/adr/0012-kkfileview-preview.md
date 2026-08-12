# ADR-0012: 知识库在线文档预览采用 KKFileView

- 状态：已接受（Accepted）
- 日期：2026-08-12

## 背景

知识库附件（doc/xls/ppt/pdf 等）需要在线预览，不能要求用户下载后本地打开。需要选择预览方案。

## 决策

采用 **KKFileView**（kekingcn/file-online-preview，开源自托管）作为在线文档预览服务：

- 独立 Java 服务（内置 LibreOffice 转换），部署为内网单独进程（默认端口 8012），Nginx 反代 `/preview` 路径
- 前端集成方式：`<iframe src="/preview/onlinePreview?url=<带签名文件地址>">` 嵌入预览
- 文件源：OSS 文件地址（附件走后端代理鉴权，ADR-0009）；预览地址由后端生成带签名/时效的 URL，避免未授权访问（KKFileView 本身无鉴权）
- 支持格式：doc/docx/xls/xlsx/ppt/pptx/pdf/图片/文本等 30+ 种

## 备选（已排除）

- 在线转换 API（WPS/微软 Office Online 预览）：需上传文件到第三方、有格式与隐私风险，内网场景不合适
- 自研预览（pdf.js + 前端解析 office）：office 格式解析复杂度高，不值得自研

## 后果

- 正向：开箱即用、支持格式全、可完全内网部署（数据不出内网）。
- 成本：多维护一个 Java 服务（JRE + LibreOffice 依赖，首次转换慢，需预热/缓存策略）；部署与运维复杂度 +1。
- 约束：预览 URL 必须带鉴权签名（后端签发，时效内有效）；文件权限仍遵循部门数据隔离（ADR-0010）。
