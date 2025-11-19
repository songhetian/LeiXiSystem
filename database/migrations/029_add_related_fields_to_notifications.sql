-- 为 notifications 表添加 related_id 和 related_type 字段
-- 用于关联具体的业务对象(如调休申请、考勤记录等)

ALTER TABLE notifications
ADD COLUMN related_id INT NULL COMMENT '关联对象ID',
ADD COLUMN related_type VARCHAR(50) NULL COMMENT '关联对象类型: compensatory_leave, attendance, etc.';

-- 为关联字段添加索引以提高查询性能
CREATE INDEX idx_related ON notifications(related_type, related_id);
