-- ==========================================
-- 质检标签分类测试数据插入脚本
-- ==========================================

USE leixin_customer_service;

-- 清理已存在的测试数据
DELETE FROM `tag_categories` WHERE `name` IN ('服务质量', '沟通技巧', '问题类型', '客户满意度', '专业能力');

-- 插入标签分类数据（一级分类）
INSERT INTO `tag_categories` (`parent_id`, `level`, `path`, `name`, `description`, `color`, `sort_order`, `is_active`) VALUES
(NULL, 0, '1', '服务质量', '评估客服的服务质量相关标签', '#FF6B6B', 1, 1),
(NULL, 0, '2', '沟通技巧', '评估客服的沟通能力相关标签', '#4ECDC4', 2, 1),
(NULL, 0, '3', '问题类型', '客户问题分类相关标签', '#45B7D1', 3, 1),
(NULL, 0, '4', '客户满意度', '客户满意度评价相关标签', '#96CEB4', 4, 1),
(NULL, 0, '5', '专业能力', '客服专业能力评估相关标签', '#FFEAA7', 5, 1);

-- 获取一级分类ID
SET @cat_service_id = (SELECT id FROM `tag_categories` WHERE `name` = '服务质量' LIMIT 1);
SET @cat_comm_id = (SELECT id FROM `tag_categories` WHERE `name` = '沟通技巧' LIMIT 1);
SET @cat_problem_id = (SELECT id FROM `tag_categories` WHERE `name` = '问题类型' LIMIT 1);
SET @cat_satisfaction_id = (SELECT id FROM `tag_categories` WHERE `name` = '客户满意度' LIMIT 1);
SET @cat_skill_id = (SELECT id FROM `tag_categories` WHERE `name` = '专业能力' LIMIT 1);

-- 插入二级分类
INSERT INTO `tag_categories` (`parent_id`, `level`, `path`, `name`, `description`, `color`, `sort_order`, `is_active`) VALUES
-- 服务质量子分类
(@cat_service_id, 1, CONCAT('1/', @cat_service_id + 1), '服务态度', '客服服务态度评估', '#FF6B6B', 1, 1),
(@cat_service_id, 1, CONCAT('1/', @cat_service_id + 2), '响应速度', '客服响应速度评估', '#FF8787', 2, 1),
(@cat_service_id, 1, CONCAT('1/', @cat_service_id + 3), '服务规范', '服务流程规范性评估', '#FFA3A3', 3, 1),

-- 沟通技巧子分类
(@cat_comm_id, 1, CONCAT('2/', @cat_comm_id + 1), '表达能力', '语言表达清晰度评估', '#4ECDC4', 1, 1),
(@cat_comm_id, 1, CONCAT('2/', @cat_comm_id + 2), '倾听能力', '理解客户需求能力评估', '#6FD9D1', 2, 1),

-- 问题类型子分类
(@cat_problem_id, 1, CONCAT('3/', @cat_problem_id + 1), '产品咨询', '产品相关问题', '#45B7D1', 1, 1),
(@cat_problem_id, 1, CONCAT('3/', @cat_problem_id + 2), '售后服务', '售后相关问题', '#67C5DE', 2, 1),
(@cat_problem_id, 1, CONCAT('3/', @cat_problem_id + 3), '投诉建议', '客户投诉和建议', '#89D3EB', 3, 1);

-- 输出确认信息
SELECT '标签分类数据插入完成' AS 'Status';
SELECT
  CASE
    WHEN level = 0 THEN name
    ELSE CONCAT('  └─ ', name)
  END AS category_tree,
  color,
  description
FROM `tag_categories`
ORDER BY path;
