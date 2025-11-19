-- 假期操作审计日志表
CREATE TABLE IF NOT EXISTS vacation_audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  employee_id INT NOT NULL COMMENT '员工ID',
  user_id INT NOT NULL COMMENT '用户ID',
  operation_type ENUM('leave_apply', 'leave_approve', 'leave_reject', 'overtime_apply', 'overtime_approve', 'compensatory_request', 'compensatory_approve', 'balance_adjust', 'overtime_convert') COMMENT '操作类型',
  operation_detail JSON COMMENT '操作详情(JSON格式)',
  balance_before JSON COMMENT '操作前余额快照',
  balance_after JSON COMMENT '操作后余额快照',
  operator_id INT COMMENT '操作人ID',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  KEY idx_employee_id (employee_id),
  KEY idx_user_id (user_id),
  KEY idx_operation_type (operation_type),
  KEY idx_operator_id (operator_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='假期操作审计日志';
