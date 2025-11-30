-- ==========================================
-- 职位测试数据插入脚本
-- ==========================================

USE leixin_customer_service;

-- 获取部门ID
SET @dept_admin_id = (SELECT id FROM `departments` WHERE `name` = '管理部' LIMIT 1);
SET @dept_service_id = (SELECT id FROM `departments` WHERE `name` = '客服部' LIMIT 1);
SET @dept_tech_id = (SELECT id FROM `departments` WHERE `name` = '技术部' LIMIT 1);
SET @dept_qa_id = (SELECT id FROM `departments` WHERE `name` = '质检部' LIMIT 1);
SET @dept_ops_id = (SELECT id FROM `departments` WHERE `name` = '运营部' LIMIT 1);

-- 清理已存在的测试数据
DELETE FROM `positions` WHERE `department_id` IN (@dept_admin_id, @dept_service_id, @dept_tech_id, @dept_qa_id, @dept_ops_id);

-- 插入职位数据
INSERT INTO `positions` (`name`, `department_id`, `description`, `requirements`, `responsibilities`, `salary_min`, `salary_max`, `level`, `status`, `sort_order`) VALUES
-- 管理部职位
('总经理', @dept_admin_id, '公司最高管理职位', '10年以上管理经验，本科及以上学历', '负责公司整体战略规划和运营管理', 30000.00, 50000.00, 'expert', 'active', 1),
('行政主管', @dept_admin_id, '行政管理职位', '5年以上行政管理经验', '负责公司行政事务管理', 8000.00, 12000.00, 'middle', 'active', 2),

-- 客服部职位
('客服部经理', @dept_service_id, '客服部门管理职位', '5年以上客服管理经验', '负责客服团队管理和业务指导', 12000.00, 18000.00, 'senior', 'active', 1),
('高级客服专员', @dept_service_id, '高级客服职位', '3年以上客服经验，优秀的沟通能力', '处理复杂客户问题，指导初级客服', 6000.00, 9000.00, 'middle', 'active', 2),
('客服专员', @dept_service_id, '基础客服职位', '良好的沟通能力和服务意识', '处理客户咨询和售后服务', 4000.00, 6000.00, 'junior', 'active', 3),

-- 技术部职位
('技术总监', @dept_tech_id, '技术部门最高管理职位', '8年以上技术管理经验', '负责技术团队管理和技术架构设计', 25000.00, 40000.00, 'expert', 'active', 1),
('高级工程师', @dept_tech_id, '高级技术职位', '5年以上开发经验', '负责核心系统开发和技术攻关', 15000.00, 25000.00, 'senior', 'active', 2),
('系统工程师', @dept_tech_id, '中级技术职位', '2年以上开发经验', '负责系统功能开发和维护', 8000.00, 15000.00, 'middle', 'active', 3),

-- 质检部职位
('质检主管', @dept_qa_id, '质检部门管理职位', '3年以上质检经验', '负责质检团队管理和质检标准制定', 10000.00, 15000.00, 'senior', 'active', 1),
('质检专员', @dept_qa_id, '质检职位', '良好的分析能力和责任心', '负责客服质量检查和评估', 5000.00, 8000.00, 'middle', 'active', 2),

-- 运营部职位
('运营经理', @dept_ops_id, '运营部门管理职位', '5年以上运营经验', '负责业务运营和数据分析', 12000.00, 20000.00, 'senior', 'active', 1),
('数据分析师', @dept_ops_id, '数据分析职位', '熟练掌握数据分析工具', '负责业务数据分析和报表制作', 7000.00, 12000.00, 'middle', 'active', 2);

-- 输出确认信息
SELECT '职位数据插入完成' AS 'Status';
SELECT p.name AS position_name, d.name AS department_name, p.level, p.salary_min, p.salary_max
FROM `positions` p
LEFT JOIN `departments` d ON p.department_id = d.id
ORDER BY d.sort_order, p.sort_order;
