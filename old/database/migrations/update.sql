-- 雷犀旗舰版 数据库变更记录流水 (V2 - 2026)

-- [2026-03-07 15:30:00] 考勤报表引擎 V4 全量升级
-- --------------------------------------------------
-- 1. 个人月报统计逻辑重构：
--    关联 overtime_records (字段: overtime_date, hours)
--    关联 leave_records (字段: leave_type, days)
--    关联 makeup_records (字段: record_date, status='approved')
--    修正：解决了当 record_date 无打卡记录时子查询崩溃的问题。

-- 2. 新增每日流水接口 (/api/attendance/daily-details)：
--    采用排班驱动 (schedules LEFT JOIN attendance_records)。
--    支持自动补全全月日历日期。

-- 3. 新增部门驾驶舱接口 (/api/attendance/dashboard)：
--    聚合统计部门总人数、全员出勤率、日均工时。
--    集成加班 Top 5 龙虎榜数据查询。

-- [2026-03-07 15:45:00] RBAC 权限同步
-- --------------------------------------------------
-- 录入考勤报表管理相关权限
INSERT INTO permissions (name, code, resource, action, module) 
VALUES ('考勤效能看板-查看', 'attendance:stats:view', 'stats', 'view', 'attendance')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 自动授权给超级管理员 (ID: 33)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 33, id FROM permissions WHERE code = 'attendance:stats:view'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    JOIN permissions p ON rp.permission_id = p.id 
    WHERE rp.role_id = 33 AND p.code = 'attendance:stats:view'
);
-- [2026-03-08 11:12:11] 考勤报表引擎 V5：重构每日明细 SQL，解决排班关联失效问题，实现数据库级日历对齐
-- 无需 DDL 变更。

-- [2026-03-08 11:16:52] 考勤引擎 V6 升级：修正排班表为 shift_schedules，物理删除冗余表 schedules
DROP TABLE IF EXISTS schedules;

-- [2026-03-08 11:20:38] 考勤引擎 V7 升级：加固 shift_schedules 日期匹配，确保 DATE 格式在所有时区下的一致性
-- 无需 DDL 变更。

-- [2026-03-08 11:28:04] 考勤引擎 V8 升级：全量引入 CAST AS DATE 逻辑，彻底解决时区偏移导致的排班关联失效
-- 无需 DDL 变更。

-- [2026-03-08 11:52:41] 考勤引擎 V9 终极加固：修正排班表(shift_schedules)与请假表(leave_records)的关联键为 user_id，彻底解决数据无法匹配导致的漏排假象
-- 无需 DDL 变更。

-- [2026-03-08 12:13:37] 核心物理重构 V13：废弃冗余表 shifts，全量切换考勤引擎至 work_shifts 真实班次表
DROP TABLE IF EXISTS shifts;
