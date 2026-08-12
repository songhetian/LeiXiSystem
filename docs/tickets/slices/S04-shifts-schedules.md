# S04 · 班次与排班

## What to build
考勤基础配置：班次维护（含跨天标志 isNextDay，C1）+ 排班分配（员工×日期×班次，月历视图 + 批量排班），排班数据可查可导。

## 五维清单
- **数据库**：shifts/schedules（保留表迁移；uk(employee_id, work_date) 排班唯一）
- **后端接口**：GET/POST /shifts、GET/POST /schedules、POST /schedules/batch；错误码 2001（班次冲突）/2002（排班重复）
- **业务算法**：跨天班次时间校验（isNextDay）；批量排班冲突检测
- **前端页面**：attendance feature 班次管理页 + 排班**月历视图**（D2，批量排班；拖拽留后续迭代）
- **单元测试**：API e2e（班次 CRUD/重复排班 2002/批量排班）

## Acceptance criteria
- [ ] 班次支持跨天（22:00-06:00）配置
- [ ] 月历视图显示员工排班，可批量排班
- [ ] 重复排班被拒绝（2002）

## Blocked by
- S03 员工档案
