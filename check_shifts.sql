-- 检查 shifts 表数据
SELECT * FROM shifts LIMIT 10;

-- 检查最近的调休申请记录
SELECT id, employee_id, user_id, new_shift_id, new_schedule_date, status
FROM compensatory_leave_requests
ORDER BY created_at DESC
LIMIT 5;
