-- 添加假期类型关联到节假日表
ALTER TABLE holidays
ADD COLUMN vacation_type_id INT NULL COMMENT '关联的假期类型ID',
ADD INDEX idx_vacation_type (vacation_type_id);

-- 注意：不添加外键约束，因为假期类型是可选的
-- 如果需要外键约束，取消下面注释
-- ADD FOREIGN KEY (vacation_type_id) REFERENCES vacation_types(id) ON DELETE SET NULL;
