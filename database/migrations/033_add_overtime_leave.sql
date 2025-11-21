-- Check and add overtime_leave columns if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'leixin_customer_service'
  AND TABLE_NAME = 'vacation_balances'
  AND COLUMN_NAME = 'overtime_leave_total');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vacation_balances ADD COLUMN overtime_leave_total DECIMAL(5,1) DEFAULT 0 AFTER compensatory_leave_used',
  'SELECT "Column overtime_leave_total already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'leixin_customer_service'
  AND TABLE_NAME = 'vacation_balances'
  AND COLUMN_NAME = 'overtime_leave_used');

SET @sql2 = IF(@col_exists2 = 0,
  'ALTER TABLE vacation_balances ADD COLUMN overtime_leave_used DECIMAL(5,1) DEFAULT 0 AFTER overtime_leave_total',
  'SELECT "Column overtime_leave_used already exists" AS message');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Insert new vacation type 'overtime_leave' if not exists
INSERT IGNORE INTO vacation_types (code, name, base_days, included_in_total, description, enabled)
VALUES ('overtime_leave', 'Overtime Leave', 0, 1, 'Leave converted from overtime hours', 1);

-- Update 'compensatory' type to NOT be included in total
UPDATE vacation_types SET included_in_total = 0 WHERE code = 'compensatory';

-- Update conversion rules to target 'overtime_leave' instead of 'annual_leave'
UPDATE conversion_rules
SET target_type = 'overtime_leave'
WHERE source_type = 'overtime' AND target_type = 'annual_leave';
