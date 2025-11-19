-- 假期余额表
CREATE TABLE IF NOT EXISTS vacation_balances (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  employee_id INT NOT NULL COMMENT '员工ID',
  user_id INT NOT NULL COMMENT '用户ID',
  year INT NOT NULL COMMENT '年度',
  annual_leave_total DECIMAL(5,2) DEFAULT 5.00 COMMENT '年假总额度(天)',
  annual_leave_used DECIMAL(5,2) DEFAULT 0.00 COMMENT '年假已用(天)',
  sick_leave_total DECIMAL(5,2) DEFAULT 10.00 COMMENT '病假总额度(天)',
  sick_leave_used DECIMAL(5,2) DEFAULT 0.00 COMMENT '病假已用(天)',
  compensatory_leave_total DECIMAL(5,2) DEFAULT 0.00 COMMENT '调休总额度(天)',
  compensatory_leave_used DECIMAL(5,2) DEFAULT 0.00 COMMENT '调休已用(天)',
  overtime_hours_total DECIMAL(6,2) DEFAULT 0.00 COMMENT '加班总时长(小时)',
  overtime_hours_converted DECIMAL(6,2) DEFAULT 0.00 COMMENT '已转调休的加班时长(小时)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY unique_employee_year (employee_id, year),
  KEY idx_user_year (user_id, year),
  KEY idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='假期余额表';
