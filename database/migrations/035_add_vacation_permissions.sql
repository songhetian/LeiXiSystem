-- 添加假期管理相关权限
INSERT INTO permissions (name, code, description, module, resource, action) VALUES
('查看所有假期', 'vacation.view_all', '允许查看所有员工的假期数据', 'vacation', 'vacation', 'view_all'),
('编辑假期额度', 'vacation.edit_quota', '允许修改员工的假期额度', 'vacation', 'vacation_quota', 'edit'),
('导出假期报表', 'vacation.export', '允许导出假期相关报表', 'vacation', 'vacation_report', 'export'),
('审批假期申请', 'vacation.approve', '允许审批假期和调休申请', 'vacation', 'vacation_request', 'approve'),
('假期配置管理', 'vacation.settings', '允许管理假期类型和转换规则', 'vacation', 'vacation_settings', 'manage');
