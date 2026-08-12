# S05 · 打卡采集（punch_logs 端到端）

## What to build
打卡数据进入系统的完整通道：**XFace600 HTTP API 增量拉取**（LastSyncTime，15min 定时 + 每日 00:30 完整性校验）+ **U 盘 CSV 导入兜底** → 统一落 `punch_logs`（去重、来源标记）→ 打卡流水查询页（筛选/异常标记/补卡入口占位）。

## 五维清单
- **数据库**：punch_logs（新表，字段见 docs/schema/new-tables.md；uk(employee_no,punch_time,device_no)）
- **后端接口**：POST /attendance/punch/import（CSV）、POST /attendance/punch/sync（触发拉取）、GET /attendance/punch（流水查询）；错误码 2003（重复导入）
- **业务算法**：XFace600 HTTP adapter（增量游标 LastSyncTime）；CSV adapter（解析+工号映射+去重）；@nestjs/schedule 定时任务
- **前端页面**：打卡流水页（员工/日期/设备筛选，异常标记，补卡按钮占位——S09 后接入）
- **单元测试**：punch adapter 单测（HTTP 增量/CSV 解析/去重）+ API e2e（导入/同步）

## Acceptance criteria
- [ ] CSV 导入 100 条样例：正确入库、重复导入报 2003
- [ ] XFace600 HTTP 拉取接口可配置设备地址并增量同步（mock 验证）
- [ ] 定时任务配置存在且可手动触发
- [ ] 流水页筛选 + 异常（>4 次/缺卡）标记可见

## Blocked by
- S03 员工档案（工号映射）
