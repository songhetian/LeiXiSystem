-- 添加假期类型排序和置顶功能
ALTER TABLE vacation_types
ADD COLUMN sort_order INT DEFAULT 999 COMMENT '排序顺序，数字越小越靠前',
ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE COMMENT '是否置顶';

-- 为现有数据设置默认排序
UPDATE vacation_types SET sort_order = id * 10 WHERE sort_order IS NULL OR sort_order = 999;

-- 添加索引以优化排序查询
CREATE INDEX idx_vacation_types_sort ON vacation_types(is_pinned DESC, sort_order ASC);
