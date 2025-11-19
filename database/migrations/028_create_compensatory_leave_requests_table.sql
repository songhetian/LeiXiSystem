-- 调休申请表
CREATE TABLE IF NOT EXISTS compensatory_leave_requests (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  employee_id INT NOT NULL COMMENT '员工ID',
  user_id INT NOT NULL COMMENT '用户ID',
  request_type ENUM('schedule_change', 'compensatory_leave') DEFAULT 'compensatory_leave' COMMENT '申请类型',
  original_schedule_date DATE COMMENT '原排班日期',
  original_shift_id INT COMMENT '原班次ID',
  new_schedule_date DATE COMMENT '新排班日期',
  new_shift_id INT COMMENT '新班次ID',
  reason TEXT COMMENT '申请理由',
  status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending' COMMENT '状态',
  approver_id INT COMMENT '审批人ID',
  approval_note TEXT COMMENT '审批备注',
  approved_at TIMESTAMP NULL COMMENT '审批时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_employee_id (employee_id),
  KEY idx_user_id (user_id),
  KEY idx_status (status),
  KEY idx_approver_id (approver_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='调休申请表';
