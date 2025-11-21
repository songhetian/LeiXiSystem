-- 确保存在"休息"班次
-- 如果不存在则创建，如果已存在则跳过

INSERT INTO work_shifts (name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active, department_id, description)
SELECT '休息', '00:00:00', '00:00:00', 0, 0, 0, 1, NULL, '休息日班次，用于标记员工休息'
WHERE NOT EXISTS (
  SELECT 1 FROM work_shifts WHERE name = '休息' AND department_id IS NULL
);
