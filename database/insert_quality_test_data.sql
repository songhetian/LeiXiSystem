-- 插入质检会话测试数据脚本
-- 包含京东平台、部门1和多条质检会话记录

-- ==========================================
-- 0. 清理已存在的测试数据（如果有）
-- ==========================================
-- 删除可能已存在的测试会话（通过session_no识别）
DELETE FROM `quality_sessions` WHERE `session_no` IN (
  'JD20251130001', 'JD20251130002', 'JD20251130003', 'JD20251130004', 'JD20251130005',
  'JD20251201001', 'JD20251201002', 'JD20251201003', 'JD20251201004', 'JD20251201005'
);

-- ==========================================
-- 1. 插入京东平台（如果不存在）
-- ==========================================
INSERT INTO `platforms` (`name`, `created_at`)
SELECT '京东', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `platforms` WHERE `name` = '京东');

-- 2. 插入部门1（如果不存在）
INSERT INTO `departments` (`name`, `description`, `status`, `sort_order`, `created_at`)
SELECT '部门1', '测试部门1', 'active', 7, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `departments` WHERE `name` = '部门1');

-- 3. 获取相关ID
SET @platform_id = (SELECT id FROM `platforms` WHERE `name` = '京东');
SET @department_id = (SELECT id FROM `departments` WHERE `name` = '部门1');

-- 4. 确保部门1有员工（使用现有客服部员工）
-- 如果部门1是新创建的，我们需要为它分配一些员工
-- 但在这个脚本中，我们直接使用已有的客服人员

-- 5. 获取现有用户ID作为客服人员
-- 使用现有的用户而不是假设存在的service用户
SET @agent1_id = (SELECT id FROM `users` WHERE `username` = 'user1' LIMIT 1);
SET @agent2_id = (SELECT id FROM `users` WHERE `username` = 'user2' LIMIT 1);
SET @agent3_id = (SELECT id FROM `users` WHERE `username` = 'user3' LIMIT 1);

-- 如果用户不存在，则使用admin用户
SET @agent1_id = COALESCE(@agent1_id, (SELECT id FROM `users` WHERE `username` = 'admin' LIMIT 1));
SET @agent2_id = COALESCE(@agent2_id, @agent1_id);
SET @agent3_id = COALESCE(@agent3_id, @agent1_id);

-- 显示分配的用户信息
SELECT
  'Agent IDs assigned successfully' as status_message,
  @agent1_id as agent1_id,
  @agent2_id as agent2_id,
  @agent3_id as agent3_id;

-- 6. 插入多条质检会话测试数据
-- 使用京东平台和现有的客服人员
-- 首先获取京东平台的ID
SET @jd_platform_id = (SELECT id FROM `platforms` WHERE `name` = '京东' LIMIT 1);

-- 然后获取各个店铺的ID
SET @shop1_id = (SELECT id FROM `shops` WHERE `name` = '店铺1' AND `platform_id` = @jd_platform_id LIMIT 1);
SET @shop2_id = (SELECT id FROM `shops` WHERE `name` = '店铺2' AND `platform_id` = @jd_platform_id LIMIT 1);
SET @shop3_id = (SELECT id FROM `shops` WHERE `name` = '店铺3' AND `platform_id` = @jd_platform_id LIMIT 1);

-- 显示获取的ID
SELECT
  'Platform and Shop IDs' as info,
  @jd_platform_id as jd_platform_id,
  @shop1_id as shop1_id,
  @shop2_id as shop2_id,
  @shop3_id as shop3_id;

INSERT INTO `quality_sessions`
(`session_no`, `agent_id`, `customer_id`, `channel`, `start_time`, `end_time`, `duration`, `message_count`, `status`, `platform_id`, `shop_id`)
VALUES
('JD20251130001', @agent1_id, 'CUST001', 'chat', '2025-11-30 10:00:00', '2025-11-30 10:15:00', 900, 25, 'completed', @jd_platform_id, @shop1_id),
('JD20251130002', @agent1_id, 'CUST002', 'phone', '2025-11-30 11:00:00', '2025-11-30 11:20:00', 1200, 40, 'completed', @jd_platform_id, @shop2_id),
('JD20251130003', @agent2_id, 'CUST003', 'chat', '2025-11-30 14:00:00', '2025-11-30 14:10:00', 600, 15, 'completed', @jd_platform_id, @shop1_id),
('JD20251130004', @agent2_id, 'CUST004', 'email', '2025-11-30 15:00:00', '2025-11-30 15:30:00', 1800, 8, 'pending', @jd_platform_id, @shop3_id),
('JD20251130005', @agent3_id, 'CUST005', 'chat', '2025-11-30 16:00:00', '2025-11-30 16:25:00', 1500, 35, 'in_review', @jd_platform_id, @shop2_id),
('JD20251201001', @agent1_id, 'CUST006', 'phone', '2025-12-01 09:30:00', '2025-12-01 10:00:00', 1800, 50, 'pending', @jd_platform_id, @shop1_id),
('JD20251201002', @agent3_id, 'CUST007', 'chat', '2025-12-01 11:00:00', '2025-12-01 11:15:00', 900, 20, 'completed', @jd_platform_id, @shop3_id),
('JD20251201003', @agent2_id, 'CUST008', 'video', '2025-12-01 13:00:00', '2025-12-01 13:45:00', 2700, 60, 'completed', @jd_platform_id, @shop1_id),
('JD20251201004', @agent1_id, 'CUST009', 'chat', '2025-12-01 15:00:00', '2025-12-01 15:20:00', 1200, 30, 'in_review', @jd_platform_id, @shop2_id),
('JD20251201005', @agent3_id, 'CUST010', 'phone', '2025-12-01 16:30:00', '2025-12-01 17:00:00', 1800, 45, 'pending', @jd_platform_id, @shop3_id);

-- 7. 为已完成的质检会话添加评分数据（示例）
-- 获取质检会话ID
SET @session1_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'JD20251130001');
SET @session2_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'JD20251130002');
SET @session3_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'JD20251130003');
SET @session7_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'JD20251201002');
SET @session8_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'JD20251201003');

-- 检查会话ID是否获取成功
SELECT
  @session1_id as session1_id,
  @session2_id as session2_id,
  @session3_id as session3_id,
  @session7_id as session7_id,
  @session8_id as session8_id;

-- 假设我们有一些质检规则（使用现有的规则或插入新规则）
-- 如果没有质检规则，我们需要先插入一些规则
INSERT INTO `quality_rules` (`name`, `category`, `description`, `criteria`, `score_weight`, `is_active`, `created_at`)
SELECT '服务态度', '服务质量', '评估客服人员的服务态度', '{"excellent": "态度热情，耐心细致", "good": "态度良好，较为耐心", "average": "态度一般，有待改进", "poor": "态度恶劣，需要培训"}', 30.00, 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `quality_rules` WHERE `name` = '服务态度');

INSERT INTO `quality_rules` (`name`, `category`, `description`, `criteria`, `score_weight`, `is_active`, `created_at`)
SELECT '问题解决能力', '专业技能', '评估客服人员解决问题的能力', '{"excellent": "快速准确解决问题", "good": "能够解决问题", "average": "解决问题较慢", "poor": "无法解决问题"}', 40.00, 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `quality_rules` WHERE `name` = '问题解决能力');

INSERT INTO `quality_rules` (`name`, `category`, `description`, `criteria`, `score_weight`, `is_active`, `created_at`)
SELECT '沟通技巧', '沟通能力', '评估客服人员的沟通表达能力', '{"excellent": "表达清晰，逻辑性强", "good": "表达清楚，易于理解", "average": "表达一般，偶有不清", "poor": "表达混乱，难以理解"}', 30.00, 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `quality_rules` WHERE `name` = '沟通技巧');

-- 获取规则ID
SET @rule1_id = (SELECT id FROM `quality_rules` WHERE `name` = '服务态度');
SET @rule2_id = (SELECT id FROM `quality_rules` WHERE `name` = '问题解决能力');
SET @rule3_id = (SELECT id FROM `quality_rules` WHERE `name` = '沟通技巧');

-- 插入质检评分（为已完成的会话）
-- 会话1的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`, `created_at`) VALUES
(@session1_id, @rule1_id, 28.00, 30.00, '服务态度良好，耐心回答客户问题', NOW()),
(@session1_id, @rule2_id, 38.00, 40.00, '问题解决能力较强，能快速定位问题', NOW()),
(@session1_id, @rule3_id, 27.00, 30.00, '沟通表达清晰，逻辑性较好', NOW());

-- 更新会话1的总评分和状态
UPDATE `quality_sessions` SET
`score` = 93.00,
`grade` = 'excellent',
`status` = 'completed',
`reviewed_at` = NOW()
WHERE `id` = @session1_id;

-- 会话2的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`, `created_at`) VALUES
(@session2_id, @rule1_id, 25.00, 30.00, '服务态度较好，但稍显急躁', NOW()),
(@session2_id, @rule2_id, 35.00, 40.00, '问题解决能力良好', NOW()),
(@session2_id, @rule3_id, 24.00, 30.00, '沟通表达基本清楚', NOW());

-- 更新会话2的总评分和状态
UPDATE `quality_sessions` SET
`score` = 84.00,
`grade` = 'good',
`status` = 'completed',
`reviewed_at` = NOW()
WHERE `id` = @session2_id;

-- 会话3的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`, `created_at`) VALUES
(@session3_id, @rule1_id, 30.00, 30.00, '服务态度热情，非常耐心', NOW()),
(@session3_id, @rule2_id, 40.00, 40.00, '问题解决能力优秀，快速准确', NOW()),
(@session3_id, @rule3_id, 30.00, 30.00, '沟通表达非常清晰', NOW());

-- 更新会话3的总评分和状态
UPDATE `quality_sessions` SET
`score` = 100.00,
`grade` = 'excellent',
`status` = 'completed',
`reviewed_at` = NOW()
WHERE `id` = @session3_id;

-- 会话7的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`, `created_at`) VALUES
(@session7_id, @rule1_id, 27.00, 30.00, '服务态度良好', NOW()),
(@session7_id, @rule2_id, 36.00, 40.00, '问题解决能力较强', NOW()),
(@session7_id, @rule3_id, 26.00, 30.00, '沟通表达清晰', NOW());

-- 更新会话7的总评分和状态
UPDATE `quality_sessions` SET
`score` = 89.00,
`grade` = 'excellent',
`status` = 'completed',
`reviewed_at` = NOW()
WHERE `id` = @session7_id;

-- 会话8的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`, `created_at`) VALUES
(@session8_id, @rule1_id, 29.00, 30.00, '服务态度非常好', NOW()),
(@session8_id, @rule2_id, 39.00, 40.00, '问题解决能力优秀', NOW()),
(@session8_id, @rule3_id, 28.00, 30.00, '沟通表达清晰流畅', NOW());

-- 更新会话8的总评分和状态
UPDATE `quality_sessions` SET
`score` = 96.00,
`grade` = 'excellent',
`status` = 'completed',
`reviewed_at` = NOW()
WHERE `id` = @session8_id;

-- 7. 为质检会话插入测试聊天消息数据
-- 为会话1插入聊天消息
INSERT INTO `session_messages` (`session_id`, `sender_type`, `sender_id`, `content`, `content_type`, `timestamp`) VALUES
(@session1_id, 'customer', 'CUST001', '你好，我想咨询一下订单问题', 'text', '2025-11-30 10:00:00'),
(@session1_id, 'agent', @agent1_id, '您好！很高兴为您服务，请问有什么可以帮助您的？', 'text', '2025-11-30 10:00:15'),
(@session1_id, 'customer', 'CUST001', '我的订单已经3天了还没发货', 'text', '2025-11-30 10:00:45'),
(@session1_id, 'agent', @agent1_id, '非常抱歉给您带来不便，请提供一下您的订单号，我帮您查询一下', 'text', '2025-11-30 10:01:00'),
(@session1_id, 'customer', 'CUST001', 'JD2025113000001', 'text', '2025-11-30 10:01:20'),
(@session1_id, 'agent', @agent1_id, '好的，请稍等，我帮您查询...', 'text', '2025-11-30 10:01:30'),
(@session1_id, 'agent', @agent1_id, '您好，我已经帮您查询到了，您的订单因为仓库备货延迟，预计明天就会发货', 'text', '2025-11-30 10:02:00'),
(@session1_id, 'customer', 'CUST001', '好的，谢谢', 'text', '2025-11-30 10:02:15'),
(@session1_id, 'agent', @agent1_id, '不客气，还有其他问题吗？', 'text', '2025-11-30 10:02:30'),
(@session1_id, 'customer', 'CUST001', '没有了', 'text', '2025-11-30 10:02:45');

-- 为会话2插入聊天消息
INSERT INTO `session_messages` (`session_id`, `sender_type`, `sender_id`, `content`, `content_type`, `timestamp`) VALUES
(@session2_id, 'customer', 'CUST002', '我要退货', 'text', '2025-11-30 11:00:00'),
(@session2_id, 'agent', @agent1_id, '您好，请问是什么原因需要退货呢？', 'text', '2025-11-30 11:00:20'),
(@session2_id, 'customer', 'CUST002', '商品质量有问题', 'text', '2025-11-30 11:00:40'),
(@session2_id, 'agent', @agent1_id, '非常抱歉，能详细说明一下是什么质量问题吗？', 'text', '2025-11-30 11:01:00'),
(@session2_id, 'customer', 'CUST002', '包装破损，商品有划痕', 'text', '2025-11-30 11:01:30'),
(@session2_id, 'agent', @agent1_id, '真的很抱歉给您带来这样的体验，我们会为您处理退货', 'text', '2025-11-30 11:02:00'),
(@session2_id, 'customer', 'CUST002', '什么时候能退款？', 'text', '2025-11-30 11:02:30'),
(@session2_id, 'agent', @agent1_id, '您申请退货后，我们会安排上门取件，收到货后3-5个工作日退款', 'text', '2025-11-30 11:03:00'),
(@session2_id, 'customer', 'CUST002', '好的', 'text', '2025-11-30 11:03:20');

-- 为会话3插入聊天消息
INSERT INTO `session_messages` (`session_id`, `sender_type`, `sender_id`, `content`, `content_type`, `timestamp`) VALUES
(@session3_id, 'customer', 'CUST003', '请问这款产品有什么优惠活动吗？', 'text', '2025-11-30 14:00:00'),
(@session3_id, 'agent', @agent2_id, '您好！目前这款产品正在参加满减活动，满300减50', 'text', '2025-11-30 14:00:15'),
(@session3_id, 'customer', 'CUST003', '可以叠加优惠券吗？', 'text', '2025-11-30 14:00:35'),
(@session3_id, 'agent', @agent2_id, '可以的，优惠券和满减活动可以叠加使用', 'text', '2025-11-30 14:00:50'),
(@session3_id, 'customer', 'CUST003', '太好了，那我现在下单', 'text', '2025-11-30 14:01:10'),
(@session3_id, 'agent', @agent2_id, '好的，祝您购物愉快！', 'text', '2025-11-30 14:01:25');

-- 为会话7插入聊天消息
INSERT INTO `session_messages` (`session_id`, `sender_type`, `sender_id`, `content`, `content_type`, `timestamp`) VALUES
(@session7_id, 'customer', 'CUST007', '我的快递到哪里了？', 'text', '2025-12-01 11:00:00'),
(@session7_id, 'agent', @agent3_id, '您好，请提供您的订单号，我帮您查询物流信息', 'text', '2025-12-01 11:00:20'),
(@session7_id, 'customer', 'CUST007', 'JD2025120100002', 'text', '2025-12-01 11:00:40'),
(@session7_id, 'agent', @agent3_id, '好的，查询中...', 'text', '2025-12-01 11:00:50'),
(@session7_id, 'agent', @agent3_id, '您的快递目前在配送中，预计今天下午送达', 'text', '2025-12-01 11:01:20'),
(@session7_id, 'customer', 'CUST007', '好的，谢谢', 'text', '2025-12-01 11:01:35');

-- 为会话8插入聊天消息
INSERT INTO `session_messages` (`session_id`, `sender_type`, `sender_id`, `content`, `content_type`, `timestamp`) VALUES
(@session8_id, 'customer', 'CUST008', '这个产品怎么使用？', 'text', '2025-12-01 13:00:00'),
(@session8_id, 'agent', @agent2_id, '您好！请问您具体想了解哪方面的使用方法？', 'text', '2025-12-01 13:00:20'),
(@session8_id, 'customer', 'CUST008', '如何开机', 'text', '2025-12-01 13:00:40'),
(@session8_id, 'agent', @agent2_id, '长按电源键3秒即可开机，首次使用需要充电2小时', 'text', '2025-12-01 13:01:00'),
(@session8_id, 'customer', 'CUST008', '充电用什么充电器？', 'text', '2025-12-01 13:01:30'),
(@session8_id, 'agent', @agent2_id, '包装盒内有配套的充电器，使用Type-C接口', 'text', '2025-12-01 13:02:00'),
(@session8_id, 'customer', 'CUST008', '明白了，谢谢', 'text', '2025-12-01 13:02:20'),
(@session8_id, 'agent', @agent2_id, '不客气，如有其他问题随时联系我们', 'text', '2025-12-01 13:02:40');

-- 输出确认信息
SELECT '测试数据插入完成' AS 'Status';
SELECT COUNT(*) AS '新增质检会话数量' FROM `quality_sessions` WHERE `platform_id` = @jd_platform_id;
SELECT COUNT(*) AS '新增聊天消息数量' FROM `session_messages` WHERE `session_id` IN (@session1_id, @session2_id, @session3_id, @session7_id, @session8_id);
