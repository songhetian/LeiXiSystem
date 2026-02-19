-- [2026-02-19] 扩展 departments 表的 status 字段定义，支持 'deleted' 状态以实现软删除。
ALTER TABLE departments MODIFY COLUMN status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active';
