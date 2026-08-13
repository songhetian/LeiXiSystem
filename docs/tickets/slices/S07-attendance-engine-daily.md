# S07 · 考勤规则引擎 + 日报（核心曳光弹）

## What to build
**核心算法切片**：打卡流水 × 排班 → 考勤日报。规则引擎为 domain 纯函数（原型已验证，23 项断言），生产化实现并接入：定时重算日报、查询日报（异常标记）、单测回归基线。

## 五维清单
- **数据库**：attendance_daily（uk(employee_id, work_date)）
- **后端接口**：GET /attendance/daily（日期范围/员工/部门筛选，异常标记）、POST /attendance/daily/recalc（重算，供定时/手动）
- **业务算法**：**考勤规则引擎**（domain 纯函数，spec 2.2）：首次/末次打卡取值、>4 次异常、迟到/早退分钟、加班计算、跨天班次归属（C1）
- **前端页面**：考勤日报页（员工日报列表、异常高亮、详情展开）
- **单元测试**：引擎单测 11 项 + API e2e 7 项

## Acceptance criteria
- [x] 引擎生产实现，原型 11 用例全部 PASS
- [x] 日报按员工+日期唯一，跨天/多次打卡/加班判定正确
- [x] 日报页展示异常标记，重算按钮可用
- [x] 引擎零框架依赖（可独立跑单测）

## Blocked by
- S04 班次与排班（排班数据）✅
- S05 打卡采集（流水数据）✅
- S06 请假/加班（状态合并）✅

## 进度 · TDD 后端实现（已完成增强）

### 完成项
- [x] **考勤规则引擎纯函数**：`src/attendance/engine/attendance-engine.ts`
  - 正常/迟到/早退/加班/缺勤判定
  - 跨天班次（夜班）正确处理
  - >4 次打卡标记异常
  - 首次/末次打卡取值逻辑
- [x] **引擎单元测试**：11 项全部 PASS
  - 正常班次、迟到、早退、加班、迟到+早退
  - 5次打卡异常、无打卡缺勤
  - 跨天班次：正常/加班/迟到/早退
- [x] **日报重算 API**：`POST /attendance/daily/recalc`
  - 从排班 + 打卡流水生成日报
  - 幂等：重算覆盖旧数据
- [x] **日报查询 API**：`GET /attendance/daily`
  - 分页 + 按员工/日期/状态筛选
  - 数据隔离：经理只见本部门
- [x] **权限控制**：attendance:view 可查看、attendance:manage 可重算
- [x] **e2e 测试**：7 项全部 PASS

### 增强项（S07 扩展）
- [x] **请假/补卡状态合并引擎**：`src/attendance/engine/daily-status-merger.ts`
  - 优先级：holiday > weekend > leave > makeup > 打卡状态
  - approved 请假才生效，pending/rejected 不影响
  - 全天请假 → status=leave，leaveDays 累加
  - 补卡修正异常状态
- [x] **状态合并单元测试**：17 项全部 PASS
  - 正常合并、全天请假、半天请假、多段请假
  - pending/rejected 过滤、周末/节假日优先级
  - 补卡修正异常、边界值、空输入
- [x] **重算服务集成请假数据**：`AttendanceDailyService.recalculate`
  - 批量查询 approved 请假记录
  - 按员工+日期维度合并到日报
  - leaveDays 字段持久化到数据库
- [x] **增强 e2e 测试**：6 项全部 PASS
  - 全天请假后重算 status=leave
  - 非请假日保持原打卡状态
  - pending 请假不影响日报
  - 重算接口返回处理条数
  - 重算幂等性验证
  - 无权限用户 403

### 测试数据
- 引擎单测：`tests/attendance-engine.unit.test.ts`（11 单测）
- 状态合并单测：`tests/daily-status-merger.unit.test.ts`（17 单测）
- e2e 测试：`tests/attendance-daily.e2e.test.ts`（7 e2e）
- 增强 e2e：`tests/attendance-daily-enhanced.e2e.test.ts`（6 e2e）
- 总计：41 项测试全部通过

### 未实现（后续切片）
- [x] 定时重算任务（@nestjs/schedule，每日凌晨）
- [ ] 日报详情页（展开打卡明细）
- [ ] 前端考勤日报页
- [ ] 日报导出（Excel）

---

## 迭代三 · 定时重算任务 + 重算历史（TDD 完成）

### 完成项
- [x] **定时重算服务**：`AttendanceDailyRecalcService`
  - 每日凌晨 2:00 自动重算昨日日报（`@Cron('0 0 2 * * *')`）
  - `runDailyRecalc()` 方法可手动调用
  - 成功/失败均记录历史
- [x] **重算任务历史表**：`attendance_daily_recalc_tasks`
  - 字段：startDate/endDate/status/recordCount/errorMessage/triggeredBy/triggerType/durationMs
  - 状态：running → success / failed
- [x] **重算任务记录 API**：
  - `GET /attendance/daily/recalc/tasks` — 重算历史列表（分页 + 状态筛选）
  - `POST /attendance/daily/recalc` 自动创建任务记录
- [x] **e2e 测试**：`tests/attendance-daily-recalc.e2e.test.ts` — 6 项全部 PASS
  - 任务列表查询、重算创建记录、失败记录、权限控制
  - 服务可注入、cron 方法记录历史

### 测试数据
- 引擎单测：`tests/attendance-engine.unit.test.ts`（11 单测）
- 状态合并单测：`tests/daily-status-merger.unit.test.ts`（17 单测）
- e2e 测试：`tests/attendance-daily.e2e.test.ts`（7 e2e）
- 增强 e2e：`tests/attendance-daily-enhanced.e2e.test.ts`（6 e2e）
- 重算任务 e2e：`tests/attendance-daily-recalc.e2e.test.ts`（6 e2e）
- **总计：47 项测试全部通过**
