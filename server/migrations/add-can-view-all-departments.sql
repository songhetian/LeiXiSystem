-- 在角色表中添加"是否能查看全部部门"字段
ALTER TABLE roles
ADD COLUMN can_view_all_departments TINYINT(1) DEFAULT 0 COMMENT '是否能查看全部部门（0=否，1=是）';

-- 更新管理员角色，允许查看全部部门
UPDATE roles
SET can_view_all_departments = 1
WHERE name = 'admin' OR name = '管理员' OR name = '超级管理员';
