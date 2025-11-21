-- 创建转换规则表
CREATE TABLE IF NOT EXISTS conversion_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  source_type VARCHAR(50) NOT NULL COMMENT '来源类型（如：overtime）',
  target_type VARCHAR(50) NOT NULL COMMENT '目标类型（如：annual_leave）',
  conversion_rate DECIMAL(10,2) NOT NULL COMMENT '转换比例（如：8小时=1天）',
  enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_source_target (source_type, target_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='额度转换规则表';

-- 插入默认规则：8小时加班 = 1天假期
INSERT INTO conversion_rules (source_type, target_type, conversion_rate, enabled)
VALUES ('overtime', 'annual_leave', 8.00, TRUE)
ON DUPLICATE KEY UPDATE conversion_rate = 8.00;

-- 创建假期类型表
CREATE TABLE IF NOT EXISTS vacation_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT '类型代码',
  name VARCHAR(100) NOT NULL COMMENT '类型名称',
  base_days DECIMAL(5,2) DEFAULT 0 COMMENT '基准天数',
  included_in_total BOOLEAN DEFAULT TRUE COMMENT '是否计入总额度',
  description TEXT COMMENT '描述',
  enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='假期类型表';

-- 插入默认假期类型
INSERT INTO vacation_types (code, name, base_days, included_in_total, description, enabled)
VALUES
  ('annual_leave', '年假', 10.00, TRUE, '法定年假', TRUE),
  ('compensatory', '调休假', 0.00, TRUE, '加班调休', TRUE),
  ('sick_leave', '病假', 0.00, FALSE, '病假', TRUE),
  ('personal_leave', '事假', 0.00, FALSE, '个人事假', TRUE),
  ('marriage_leave', '婚假', 3.00, FALSE, '婚假', TRUE),
  ('maternity_leave', '产假', 98.00, FALSE, '产假', TRUE),
  ('paternity_leave', '陪产假', 15.00, FALSE, '陪产假', TRUE),
  ('bereavement_leave', '丧假', 3.00, FALSE, '丧假', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  base_days = VALUES(base_days),
  included_in_total = VALUES(included_in_total),
  description = VALUES(description);

-- 创建额度变更历史表
CREATE TABLE IF NOT EXISTS vacation_balance_changes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL COMMENT '员工ID',
  year INT NOT NULL COMMENT '年份',
  change_type ENUM('addition', 'deduction', 'conversion', 'adjustment') NOT NULL COMMENT '变更类型',
  leave_type VARCHAR(50) COMMENT '假期类型',
  amount DECIMAL(5,2) NOT NULL COMMENT '变更数量（正数为增加，负数为扣减）',
  balance_before DECIMAL(5,2) COMMENT '变更前余额',
  balance_after DECIMAL(5,2) COMMENT '变更后余额',
  reason TEXT COMMENT '变更原因',
  reference_id INT COMMENT '关联ID（审批单号/转换记录ID）',
  reference_type VARCHAR(50) COMMENT '关联类型（leave_request/overtime_conversion/manual_adjustment）',
  approval_number VARCHAR(50) COMMENT '审批单号',
  created_by INT COMMENT '操作人ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_employee_year (employee_id, year),
  INDEX idx_change_type (change_type),
  INDEX idx_reference (reference_type, reference_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='假期余额变更历史表';

-- 修改 vacation_balances 表，添加总天数字段
ALTER TABLE vacation_balances
ADD COLUMN total_days DECIMAL(5,2) DEFAULT 0 COMMENT '总假期天数',
ADD COLUMN last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间';

-- 更新现有数据的 total_days（年假 + 调休假）
UPDATE vacation_balances
SET total_days = COALESCE(annual_leave_total, 0) + COALESCE(compensatory_leave_total, 0)
WHERE total_days = 0 OR total_days IS NULL;
