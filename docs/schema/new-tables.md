# 新增表字段草案 v0.1（已确认 A2）

> 对应 REFACTOR_PLAN.md 第 8 章新增表。Step 1 建 Prisma schema 时以此为基础，可微调命名（保持 snake_case）。
> 通用约定：所有表含 `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`、`created_at`、`updated_at`；金额一律 `DECIMAL`；时间统一 `DATETIME`。

## 1. punch_logs — 原始打卡流水

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| employee_no | VARCHAR(20) | NOT NULL | 打卡机工号（需与员工表映射） |
| device_no | VARCHAR(50) | NOT NULL | 设备编号 |
| punch_time | DATETIME | NOT NULL | 打卡时间 |
| punch_type | ENUM('in','out') | NULL | 上班/下班（可为空，由规则引擎判定） |
| source | ENUM('import','db','api','manual') | NOT NULL | 数据来源 |
| raw_data | VARCHAR(500) | NULL | 原始记录留档 |
| status | ENUM('pending','matched','abnormal','ignored') | NOT NULL DEFAULT 'pending' | 处理状态 |

- 索引：`uk(employee_no, punch_time, device_no)`、`idx(punch_time)`、`idx(status)`
- 保留期限：3 年（E3）

## 2. attendance_daily — 考勤日报

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| employee_id | INT | FK→employees | 员工 |
| work_date | DATE | NOT NULL | 归属日期（按班次归属日，C1） |
| shift_id | INT | FK→shifts | 班次 |
| schedule_id | INT | FK→schedules | 排班 |
| first_punch | DATETIME | NULL | 上班卡（C3：取当日首次） |
| last_punch | DATETIME | NULL | 下班卡（C3：取最后一次） |
| late_minutes | INT | NOT NULL DEFAULT 0 | 迟到分钟 |
| early_minutes | INT | NOT NULL DEFAULT 0 | 早退分钟 |
| overtime_minutes | INT | NOT NULL DEFAULT 0 | 加班分钟（C5：min(申请,实际)） |
| status | ENUM('normal','late','early','absent','half_absent','makeup','holiday','leave','weekend') | NOT NULL | 考勤结果 |
| makeup_reason | VARCHAR(255) | NULL | 补卡原因（C4） |
| operated_by | INT | NULL | 补卡/修正操作人（留痕） |

- 索引：`uk(employee_id, work_date)`

## 3. attendance_monthly — 考勤月报

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| employee_id | INT | FK→employees | 员工 |
| month | CHAR(7) | NOT NULL | 'YYYY-MM' |
| work_days | DECIMAL(5,1) | NOT NULL | 出勤天数（C2：入职/离职折算） |
| late_count | INT | DEFAULT 0 | 迟到次数 |
| early_count | INT | DEFAULT 0 | 早退次数 |
| absent_days | DECIMAL(5,1) | DEFAULT 0 | 缺勤天数 |
| leave_minutes | INT | DEFAULT 0 | 请假分钟 |
| overtime_hours | DECIMAL(6,2) | DEFAULT 0 | 加班小时 |
| status | ENUM('draft','confirmed') | NOT NULL | 月结状态 |

- 索引：`uk(employee_id, month)`；保留期限：永久（E3）

## 4. salary_items — 薪资项目

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| code | VARCHAR(30) | UNIQUE NOT NULL | 编码（base_salary / overtime_15x / absent_deduct ...） |
| name | VARCHAR(50) | NOT NULL | 名称 |
| type | ENUM('fixed','per_day','per_hour','formula','deduction') | NOT NULL | 计算类型 |
| amount | DECIMAL(10,2) | NULL | type=fixed 固定金额 |
| rate | DECIMAL(10,4) | NULL | per_day/per_hour 单价 |
| formula | TEXT | NULL | formula 表达式（引用其他项目 code，如 `base_salary / work_days * absent_days`） |
| enabled | BOOLEAN | DEFAULT TRUE | 是否启用 |
| sort | INT | DEFAULT 0 | 展示顺序 |

- 说明：加班费按 A1 规则由引擎按倍率计算（overtime_15x/overtime_2x/overtime_3x 三档倍率在配置中定义）

## 5. payroll_runs — 算薪批次

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| month | CHAR(7) | UNIQUE NOT NULL | 'YYYY-MM' |
| status | ENUM('draft','confirmed','published','recalled') | NOT NULL DEFAULT 'draft' | 草稿→确认→发布/撤回 |
| total_employees | INT | NULL | 批次人数 |
| total_amount | DECIMAL(14,2) | NULL | 总金额 |
| confirmed_by / confirmed_at | INT / DATETIME | NULL | 确认人/时间 |
| published_by / published_at | INT / DATETIME | NULL | 发布人/时间 |
| remark | VARCHAR(255) | NULL | 备注 |

## 6. payroll_details — 工资明细

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| run_id | INT | FK→payroll_runs | 批次 |
| employee_id | INT | FK→employees | 员工 |
| item_code / item_name | VARCHAR(30) / VARCHAR(50) | NOT NULL | 项目快照（防项目改名影响历史） |
| amount | DECIMAL(10,2) | NOT NULL | 金额 |
| source_ref | VARCHAR(100) | NULL | 来源引用（attendance_monthly:12 / overtime:34 / adjustment） |

- 索引：`uk(run_id, employee_id, item_code)`

## 7. payroll_adjustments — 算薪调整项（C6）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| run_id | INT | FK→payroll_runs | 批次 |
| employee_id | INT | FK→employees | 员工 |
| item_code | VARCHAR(30) | NOT NULL | 被调整项目 |
| amount | DECIMAL(10,2) | NOT NULL | 调整金额（可正可负） |
| reason | VARCHAR(255) | NOT NULL | 调整原因 |
| created_by | INT | NOT NULL | 操作人（留痕） |

- 调整项独立存表，**不覆盖** payroll_details 计算值；工资条展示 = 计算值 + 调整值
