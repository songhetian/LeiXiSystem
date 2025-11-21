-- Add expiry_date field to vacation_balances table
-- This allows tracking when vacation quotas expire

-- Check if column exists before adding
SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vacation_balances'
    AND COLUMN_NAME = 'expiry_date'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vacation_balances ADD COLUMN expiry_date DATE NULL AFTER last_updated',
  'SELECT "Column expiry_date already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for expiry_date queries
SET @idx_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vacation_balances'
    AND INDEX_NAME = 'idx_expiry_date'
);

SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_expiry_date ON vacation_balances(expiry_date)',
  'SELECT "Index idx_expiry_date already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Set default expiry dates for existing records (end of current year)
UPDATE vacation_balances
SET expiry_date = CONCAT(year, '-12-31')
WHERE expiry_date IS NULL;
