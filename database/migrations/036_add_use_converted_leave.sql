-- Add use_converted_leave column to leave_records table
ALTER TABLE leave_records ADD COLUMN use_converted_leave BOOLEAN DEFAULT FALSE COMMENT '是否优先使用转换假期';
