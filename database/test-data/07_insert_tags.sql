-- ==========================================
-- 质检标签测试数据插入脚本
-- ==========================================

USE leixin_customer_service;

-- 获取分类ID
SET @cat_service_id = (SELECT id FROM `tag_categories` WHERE `name` = '服务质量' AND level = 0 LIMIT 1);
SET @cat_comm_id = (SELECT id FROM `tag_categories` WHERE `name` = '沟通技巧' AND level = 0 LIMIT 1);
SET @cat_problem_id = (SELECT id FROM `tag_categories` WHERE `name` = '问题类型' AND level = 0 LIMIT 1);
SET @cat_satisfaction_id = (SELECT id FROM `tag_categories` WHERE `name` = '客户满意度' AND level = 0 LIMIT 1);
SET @cat_skill_id = (SELECT id FROM `tag_categories` WHERE `name` = '专业能力' AND level = 0 LIMIT 1);

-- 清理已存在的测试数据
DELETE FROM `tags` WHERE `category_id` IN (@cat_service_id, @cat_comm_id, @cat_problem_id, @cat_satisfaction_id, @cat_skill_id);

-- 插入质检类型标签
INSERT INTO `tags` (`parent_id`, `level`, `path`, `name`, `tag_type`, `category_id`, `color`, `description`, `is_active`) VALUES
-- 服务质量标签
(NULL, 0, '1', '态度热情', 'quality', @cat_service_id, '#FF6B6B', '客服态度热情友好', 1),
(NULL, 0, '2', '态度冷淡', 'quality', @cat_service_id, '#FF4757', '客服态度冷淡', 1),
(NULL, 0, '3', '响应及时', 'quality', @cat_service_id, '#5F27CD', '客服响应速度快', 1),
(NULL, 0, '4', '响应缓慢', 'quality', @cat_service_id, '#341F97', '客服响应速度慢', 1),
(NULL, 0, '5', '流程规范', 'quality', @cat_service_id, '#00D2D3', '服务流程规范', 1),

-- 沟通技巧标签
(NULL, 0, '6', '表达清晰', 'quality', @cat_comm_id, '#4ECDC4', '语言表达清晰明了', 1),
(NULL, 0, '7', '表达模糊', 'quality', @cat_comm_id, '#1ABC9C', '语言表达不够清晰', 1),
(NULL, 0, '8', '善于倾听', 'quality', @cat_comm_id, '#48C9B0', '能够理解客户需求', 1),
(NULL, 0, '9', '沟通顺畅', 'quality', @cat_comm_id, '#16A085', '沟通过程顺畅', 1),

-- 问题类型标签
(NULL, 0, '10', '产品咨询', 'quality', @cat_problem_id, '#45B7D1', '客户咨询产品信息', 1),
(NULL, 0, '11', '订单查询', 'quality', @cat_problem_id, '#3498DB', '客户查询订单状态', 1),
(NULL, 0, '12', '退换货', 'quality', @cat_problem_id, '#2980B9', '客户申请退换货', 1),
(NULL, 0, '13', '投诉', 'quality', @cat_problem_id, '#E74C3C', '客户投诉问题', 1),
(NULL, 0, '14', '建议', 'quality', @cat_problem_id, '#C0392B', '客户提出建议', 1),

-- 客户满意度标签
(NULL, 0, '15', '非常满意', 'quality', @cat_satisfaction_id, '#96CEB4', '客户非常满意', 1),
(NULL, 0, '16', '满意', 'quality', @cat_satisfaction_id, '#88D8B0', '客户满意', 1),
(NULL, 0, '17', '一般', 'quality', @cat_satisfaction_id, '#FFEAA7', '客户感觉一般', 1),
(NULL, 0, '18', '不满意', 'quality', @cat_satisfaction_id, '#FDCB6E', '客户不满意', 1),

-- 专业能力标签
(NULL, 0, '19', '专业知识扎实', 'quality', @cat_skill_id, '#FFEAA7', '客服专业知识扎实', 1),
(NULL, 0, '20', '问题解决能力强', 'quality', @cat_skill_id, '#FDD835', '能快速解决问题', 1),
(NULL, 0, '21', '需要培训', 'quality', @cat_skill_id, '#F9CA24', '专业能力需要提升', 1);

-- 输出确认信息
SELECT '标签数据插入完成' AS 'Status';
SELECT t.name AS tag_name, t.tag_type, c.name AS category_name, t.color, t.description
FROM `tags` t
LEFT JOIN `tag_categories` c ON t.category_id = c.id
ORDER BY t.category_id, t.id;
