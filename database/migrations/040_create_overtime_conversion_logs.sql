-- 创建加班转假期转换记录表
CREATE TABLE IF NOT EXISTS overtime_conversion_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  overtime_hours DECIMAL(10,2) NOT NULL COMMENT '原始加班时长（小时）',
  converted_days DECIMAL(10,2) NOT NULL COMMENT '转换后的假期天数',
  conversion_rate DECIMAL(10,2) NOT NULL COMMENT '使用的转换比例（小时/天）',
  conversion_rule_id INT COMMENT '使用的转换规则ID',
  operator_id INT NOT NULL COMMENT '操作人ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  notes TEXT COMMENT '备注',
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (conversion_rule_id) REFERENCES conversion_rules(id) ON DELETE SET NULL,
  FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='加班转假期转换记录表';
