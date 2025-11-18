# 聊天系统功能清单与集成说明

## 提取的功能需求与技术要点
- 会话：列表、详情、创建、更新、删除、置顶、免打扰；成员关联、未读、最后消息预览
- 消息：分页列表、发送、撤回、删除、转发、标记已读、搜索；状态 sent/delivered/read；收藏与取消收藏
- 群组与聊天室：创建、获取、更新、删除、成员管理、加入/退出；房间分类与在线人数
- WebSocket：连接管理、房间管理（以会话ID为房间）、心跳与重连；事件：用户在线/离线、消息收发/撤回/已读、正在输入、会话更新、群事件、聊天室消息
- 文件上传：图片/文件/语音/视频上传与进度、失败重试、类型与大小校验
- 高级功能：消息搜索、引用回复、消息转发、表情功能、消息通知、聊天记录导出/备份/清空、离线消息
- 性能与安全：虚拟滚动、懒加载、分页、缓存；敏感词、XSS、防刷屏、文件验证

## 前端集成范围
- 页面入口：App 导航“聊天通讯”→ ChatPage
- 组件：
  - 会话：`ConversationList`
  - 窗口：`ChatWindow`
  - 输入：`MessageInput`
  - 消息类型：`TextMessage`、`ImageMessage`、`FileMessage`、`VoiceMessage`、`VideoMessage`、`SystemMessage`
  - 收藏侧栏：`CollectedMessagesSidebar`
- Socket 管理：`src/utils/socket.js` 提供连接、事件发送/监听、断线重连
- API 对接（后端前缀 `/api/chat`）：
  - 会话列表：GET `/api/chat/conversations`
  - 会话消息：GET `/api/chat/conversations/:id/messages`
  - 搜索：GET `/api/chat/messages/search`
  - 收藏：POST `/api/chat/messages/:id/collect`、DELETE `/api/chat/messages/:id/uncollect`、GET `/api/chat/collected-messages`
  - 转发：POST `/api/chat/messages/:id/forward`
  - 清空会话消息：DELETE `/api/chat/conversations/:id/messages`

## 已实现的UI交互
- 会话选择、消息加载与分页、上拉加载更多
- 文本/图片/文件/视频消息发送（上传接口 `/api/upload`）
- 消息收藏与取消收藏、收藏侧栏展示
- 消息搜索（会话内/全局）
- 正在输入提示（Socket `message:typing`）
- 消息已读上报（Socket `message:read`）
- 浏览器通知与提示音（占位实现）

## 待完善项（后续迭代）
- 群组/聊天室管理页面入口与完整交互（当前由 ChatPage 覆盖会话与消息）
- 撤回与删除消息的前端交互与后端实现
- 未读数实时更新与离线消息同步
- 虚拟滚动与大列表性能优化
- 敏感词过滤与表情包管理

## 测试与验证
- 集成测试脚本：`tests/chat/api.test.js`、`tests/chat/socket.test.js`
- 覆盖范围：会话与消息API请求、收藏/取消收藏、Socket连接与基本事件
- 建议：引入 Vitest/RTL 提升单元测试覆盖率；端到端测试可采用 Playwright/Cypress（后续）

更新时间：自动生成