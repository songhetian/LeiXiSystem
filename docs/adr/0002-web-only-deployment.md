# ADR-0002: 部署形态改为纯 Web（放弃 Electron）

- 状态：已接受（Accepted）
- 日期：2026-08-12

## 背景

旧项目是 Electron 桌面应用（dev:all 同时启动后端 + Vite + Electron 壳）。新技术栈选定的 Next.js 是**服务端渲染框架**，与 Electron 桌面壳天然冲突——Electron 壳 + 本地 Next 服务会带来打包体积膨胀、双进程调试、升级繁琐；静态导出进 Electron 则失去 SSR/API 意义。

## 决策

**改纯 Web**：部署 Node 服务（pm2/Docker）+ Nginx 反代 + HTTPS，用户浏览器访问。放弃 Electron 桌面端。

## 后果

- 正向：Next.js/Refine 全部特性可用；部署与升级大幅简化；打卡机是独立硬件（走网络/数据库直连，由后端定时拉取），不需要桌面端本地能力。
- 成本：用户需通过浏览器访问（内网系统无碍）；旧桌面端停止维护、不迁移。
