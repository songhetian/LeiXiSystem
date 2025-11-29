-- ==========================================
-- 质检标签测试数据插入脚本
-- 创建时间: 2024-11-29
-- 功能: 插入质检标签分类、标签及关联数据
-- ==========================================

-- ==========================================
-- 0. 清理已存在的测试数据（如果有）
-- ==========================================
-- 注意：由于外键约束，删除顺序很重要
-- 1) 先删除标签关联
-- 2) 再删除标签
-- 3) 最后删除标签分类

-- 删除质检标签关联（会话和消息）
DELETE FROM `quality_session_tags` WHERE `tag_id` IN (
  SELECT id FROM `tags` WHERE `tag_type` = 'quality'
);
DELETE FROM `quality_message_tags` WHERE `tag_id` IN (
  SELECT id FROM `tags` WHERE `tag_type` = 'quality'
);

-- 删除质检类型的标签
DELETE FROM `tags` WHERE `tag_type` = 'quality';

-- 删除测试用的标签分类（通过名称识别）
DELETE FROM `tag_categories` WHERE `name` IN (
  '服务质量', '沟通技巧', '业务处理', '问题类型',
  '态度问题', '响应速度', '专业能力', '语气不当', '不耐烦'
);

-- ==========================================

-- 1. 插入质检标签分类（支持多级分类）
-- 一级分类
INSERT INTO `tag_categories` (`name`, `description`, `color`, `parent_id`, `level`, `path`, `sort_order`, `is_active`) VALUES
('服务质量', '客服服务质量相关标签分类', '#3B82F6', NULL, 0, '1', 1, 1),
('沟通技巧', '客服沟通技巧相关标签分类', '#10B981', NULL, 0, '2', 2, 1),
('业务处理', '业务处理能力相关标签分类', '#F59E0B', NULL, 0, '3', 3, 1),
('问题类型', '客户问题类型分类', '#EF4444', NULL, 0, '4', 4, 1);

-- 获取一级分类ID
SET @cat_service_id = (SELECT id FROM `tag_categories` WHERE `name` = '服务质量' AND `level` = 0 LIMIT 1);
SET @cat_communication_id = (SELECT id FROM `tag_categories` WHERE `name` = '沟通技巧' AND `level` = 0 LIMIT 1);
SET @cat_business_id = (SELECT id FROM `tag_categories` WHERE `name` = '业务处理' AND `level` = 0 LIMIT 1);
SET @cat_problem_id = (SELECT id FROM `tag_categories` WHERE `name` = '问题类型' AND `level` = 0 LIMIT 1);

-- 二级分类（服务质量下的子分类）
INSERT INTO `tag_categories` (`name`, `description`, `color`, `parent_id`, `level`, `path`, `sort_order`, `is_active`) VALUES
('态度问题', '服务态度相关问题', '#60A5FA', @cat_service_id, 1, CONCAT(@cat_service_id, '/5'), 1, 1),
('响应速度', '响应时效相关', '#93C5FD', @cat_service_id, 1, CONCAT(@cat_service_id, '/6'), 2, 1),
('专业能力', '专业知识和能力', '#BFDBFE', @cat_service_id, 1, CONCAT(@cat_service_id, '/7'), 3, 1);

-- 获取二级分类ID
SET @cat_attitude_id = (SELECT id FROM `tag_categories` WHERE `name` = '态度问题' LIMIT 1);
SET @cat_response_id = (SELECT id FROM `tag_categories` WHERE `name` = '响应速度' LIMIT 1);
SET @cat_professional_id = (SELECT id FROM `tag_categories` WHERE `name` = '专业能力' LIMIT 1);

-- 三级分类（态度问题下的子分类）
INSERT INTO `tag_categories` (`name`, `description`, `color`, `parent_id`, `level`, `path`, `sort_order`, `is_active`) VALUES
('语气不当', '说话语气问题', '#DBEAFE', @cat_attitude_id, 2, CONCAT(@cat_service_id, '/', @cat_attitude_id, '/8'), 1, 1),
('不耐烦', '表现出不耐烦情绪', '#DBEAFE', @cat_attitude_id, 2, CONCAT(@cat_service_id, '/', @cat_attitude_id, '/9'), 2, 1);

-- 2. 插入质检标签（type='quality'）
-- 服务质量相关标签
INSERT INTO `tags` (`name`, `tag_type`, `category_id`, `color`, `description`, `parent_id`, `level`, `path`, `is_active`) VALUES
('态度优秀', 'quality', @cat_service_id, '#10B981', '服务态度非常好', NULL, 0, '1', 1),
('态度良好', 'quality', @cat_service_id, '#34D399', '服务态度较好', NULL, 0, '2', 1),
('态度一般', 'quality', @cat_service_id, '#FCD34D', '服务态度一般', NULL, 0, '3', 1),
('态度较差', 'quality', @cat_service_id, '#F87171', '服务态度需要改进', NULL, 0, '4', 1);

-- 沟通技巧相关标签
INSERT INTO `tags` (`name`, `tag_type`, `category_id`, `color`, `description`, `parent_id`, `level`, `path`, `is_active`) VALUES
('表达清晰', 'quality', @cat_communication_id, '#3B82F6', '表达清晰准确', NULL, 0, '5', 1),
('逻辑性强', 'quality', @cat_communication_id, '#60A5FA', '逻辑思维清晰', NULL, 0, '6', 1),
('善于引导', 'quality', @cat_communication_id, '#93C5FD', '善于引导客户', NULL, 0, '7', 1),
('倾听能力强', 'quality', @cat_communication_id, '#BFDBFE', '善于倾听客户需求', NULL, 0, '8', 1);

-- 业务处理相关标签
INSERT INTO `tags` (`name`, `tag_type`, `category_id`, `color`, `description`, `parent_id`, `level`, `path`, `is_active`) VALUES
('处理及时', 'quality', @cat_business_id, '#F59E0B', '问题处理及时', NULL, 0, '9', 1),
('解决方案合理', 'quality', @cat_business_id, '#FBBF24', '提供的解决方案合理', NULL, 0, '10', 1),
('流程规范', 'quality', @cat_business_id, '#FCD34D', '按照规范流程处理', NULL, 0, '11', 1),
('主动跟进', 'quality', @cat_business_id, '#FDE68A', '主动跟进问题', NULL, 0, '12', 1);

-- 问题类型相关标签
INSERT INTO `tags` (`name`, `tag_type`, `category_id`, `color`, `description`, `parent_id`, `level`, `path`, `is_active`) VALUES
('订单咨询', 'quality', @cat_problem_id, '#EF4444', '订单相关咨询', NULL, 0, '13', 1),
('退换货', 'quality', @cat_problem_id, '#F87171', '退换货问题', NULL, 0, '14', 1),
('物流查询', 'quality', @cat_problem_id, '#FCA5A5', '物流信息查询', NULL, 0, '15', 1),
('产品咨询', 'quality', @cat_problem_id, '#FECACA', '产品使用咨询', NULL, 0, '16', 1),
('投诉建议', 'quality', @cat_problem_id, '#FEE2E2', '客户投诉或建议', NULL, 0, '17', 1);

-- 3. 为质检会话关联标签
-- 获取一个实际存在的用户ID作为创建人
SET @creator_id = (SELECT id FROM `users` LIMIT 1);

-- 获取会话ID
SET @session1_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'JD20251130001' LIMIT 1);
SET @session2_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'JD20251130002' LIMIT 1);
SET @session3_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'JD20251130003' LIMIT 1);

-- 获取标签ID
SET @tag_attitude_excellent_id = (SELECT id FROM `tags` WHERE `name` = '态度优秀' AND `tag_type` = 'quality' LIMIT 1);
SET @tag_clear_expression_id = (SELECT id FROM `tags` WHERE `name` = '表达清晰' AND `tag_type` = 'quality' LIMIT 1);
SET @tag_order_inquiry_id = (SELECT id FROM `tags` WHERE `name` = '订单咨询' AND `tag_type` = 'quality' LIMIT 1);
SET @tag_return_id = (SELECT id FROM `tags` WHERE `name` = '退换货' AND `tag_type` = 'quality' LIMIT 1);
SET @tag_product_inquiry_id = (SELECT id FROM `tags` WHERE `name` = '产品咨询' AND `tag_type` = 'quality' LIMIT 1);
SET @tag_timely_id = (SELECT id FROM `tags` WHERE `name` = '处理及时' AND `tag_type` = 'quality' LIMIT 1);

-- 为会话添加标签
INSERT INTO `quality_session_tags` (`session_id`, `tag_id`, `created_by`) VALUES
(@session1_id, @tag_attitude_excellent_id, @creator_id),
(@session1_id, @tag_clear_expression_id, @creator_id),
(@session1_id, @tag_order_inquiry_id, @creator_id),
(@session2_id, @tag_return_id, @creator_id),
(@session2_id, @tag_timely_id, @creator_id),
(@session3_id, @tag_product_inquiry_id, @creator_id),
(@session3_id, @tag_attitude_excellent_id, @creator_id);

-- 4. 为聊天消息关联标签
-- 获取消息ID（会话1的部分消息）
SET @msg1_id = (SELECT id FROM `session_messages` WHERE `session_id` = @session1_id AND `sender_type` = 'agent' ORDER BY `timestamp` ASC LIMIT 1);
SET @msg2_id = (SELECT id FROM `session_messages` WHERE `session_id` = @session1_id AND `sender_type` = 'agent' ORDER BY `timestamp` ASC LIMIT 1 OFFSET 1);

-- 获取消息ID（会话2的部分消息）
SET @msg3_id = (SELECT id FROM `session_messages` WHERE `session_id` = @session2_id AND `sender_type` = 'agent' ORDER BY `timestamp` ASC LIMIT 1);

-- 为消息添加标签
INSERT INTO `quality_message_tags` (`message_id`, `tag_id`, `created_by`) VALUES
(@msg1_id, @tag_attitude_excellent_id, @creator_id),
(@msg1_id, @tag_clear_expression_id, @creator_id),
(@msg2_id, @tag_timely_id, @creator_id),
(@msg3_id, @tag_attitude_excellent_id, @creator_id);

-- 5. 输出确认信息
SELECT '质检标签测试数据插入完成' AS 'Status';
SELECT COUNT(*) AS '标签分类数量' FROM `tag_categories`;
SELECT COUNT(*) AS '质检标签数量' FROM `tags` WHERE `tag_type` = 'quality';
SELECT COUNT(*) AS '会话标签关联数量' FROM `quality_session_tags`;
SELECT COUNT(*) AS '消息标签关联数量' FROM `quality_message_tags`;
