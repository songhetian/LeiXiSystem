-- 假期系统配置表
CREATE TABLE IF NOT EXISTS vacation_settings (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  setting_key VARCHAR(100) UNIQUE NOT NULL COMMENT '配置键',
  setting_value TEXT COMMENT '配置值',
  description VARCHAR(255) COMMENT '配置说明',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='假期系统配置';

-- 插入默认配置
INSERT INTO vacation_settings (setting_key, setting_value, description) VALUES
('overtime_to_leave_ratio', '8', '加班转调休比例(小时:天)'),
('annual_leave_default', '5', '默认年假天数'),
('sick_leave_default', '10', '默认病假天数'),
('approval_levels', '1', '审批级别(1=单级,2=两级,3=三级)')
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  description = VALUES(description);
