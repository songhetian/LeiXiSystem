-- [2026-02-19] 扩展 departments 表的 status 字段定义，支持 'deleted' 状态以实现软删除。
ALTER TABLE departments MODIFY COLUMN status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active';

-- 2026-02-20 数据库索引深度优化
-- 优化原因：加速员工搜索、考勤报表聚合以及质检统计查询性能

-- 1. 加速员工姓名搜索
ALTER TABLE users ADD INDEX idx_real_name (real_name);

-- 2. 优化考勤统计：支持按员工、状态和日期范围的覆盖索引查询
ALTER TABLE attendance_records ADD INDEX idx_emp_status_date (employee_id, status, record_date);

-- 3. 优化质检报表：支持按客服、质检状态和时间的复合筛选
ALTER TABLE quality_sessions ADD INDEX idx_agent_status_time (agent_id, status, start_time);


-- 2026-02-20 数据库索引深度加固（巡检后补录）
-- 优化原因：确保 IM 历史消息分页及最后消息预览的高效查询

-- 1. 加速 IM 消息分页与预览
ALTER TABLE chat_messages ADD INDEX idx_group_id_id (group_id, id);

