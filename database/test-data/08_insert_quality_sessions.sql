-- ==========================================
-- 质检会话测试数据插入脚本
-- ==========================================

USE leixin_customer_service;

-- 获取相关ID
SET @platform_jd_id = (SELECT id FROM `platforms` WHERE `name` = '京东' LIMIT 1);
SET @platform_tb_id = (SELECT id FROM `platforms` WHERE `name` = '淘宝' LIMIT 1);
SET @shop_jd1_id = (SELECT id FROM `shops` WHERE `name` = '京东旗舰店' LIMIT 1);
SET @shop_jd2_id = (SELECT id FROM `shops` WHERE `name` = '京东专营店' LIMIT 1);
SET @shop_tb1_id = (SELECT id FROM `shops` WHERE `name` = '淘宝旗舰店' LIMIT 1);

SET @agent1_id = (SELECT id FROM `users` WHERE `username` = 'service1' LIMIT 1);
SET @agent2_id = (SELECT id FROM `users` WHERE `username` = 'service2' LIMIT 1);
SET @agent3_id = (SELECT id FROM `users` WHERE `username` = 'service3' LIMIT 1);
SET @qa1_id = (SELECT id FROM `users` WHERE `username` = 'qa1' LIMIT 1);

-- 清理已存在的测试数据
DELETE FROM `quality_sessions` WHERE `session_no` LIKE 'QS2025%';

-- 插入质检规则（如果不存在）
INSERT INTO `quality_rules` (`name`, `category`, `description`, `criteria`, `score_weight`, `is_active`)
SELECT '服务态度', '服务质量', '评估客服人员的服务态度', '{"excellent": "态度热情，耐心细致", "good": "态度良好，较为耐心", "average": "态度一般，有待改进", "poor": "态度恶劣，需要培训"}', 30.00, 1
WHERE NOT EXISTS (SELECT 1 FROM `quality_rules` WHERE `name` = '服务态度');

INSERT INTO `quality_rules` (`name`, `category`, `description`, `criteria`, `score_weight`, `is_active`)
SELECT '问题解决能力', '专业技能', '评估客服人员解决问题的能力', '{"excellent": "快速准确解决问题", "good": "能够解决问题", "average": "解决问题较慢", "poor": "无法解决问题"}', 40.00, 1
WHERE NOT EXISTS (SELECT 1 FROM `quality_rules` WHERE `name` = '问题解决能力');

INSERT INTO `quality_rules` (`name`, `category`, `description`, `criteria`, `score_weight`, `is_active`)
SELECT '沟通技巧', '沟通能力', '评估客服人员的沟通表达能力', '{"excellent": "表达清晰，逻辑性强", "good": "表达清楚，易于理解", "average": "表达一般，偶有不清", "poor": "表达混乱，难以理解"}', 30.00, 1
WHERE NOT EXISTS (SELECT 1 FROM `quality_rules` WHERE `name` = '沟通技巧');

-- 获取规则ID
SET @rule1_id = (SELECT id FROM `quality_rules` WHERE `name` = '服务态度' LIMIT 1);
SET @rule2_id = (SELECT id FROM `quality_rules` WHERE `name` = '问题解决能力' LIMIT 1);
SET @rule3_id = (SELECT id FROM `quality_rules` WHERE `name` = '沟通技巧' LIMIT 1);

-- 插入质检会话数据
INSERT INTO `quality_sessions`
(`session_no`, `agent_id`, `customer_id`, `customer_name`, `channel`, `start_time`, `end_time`, `duration`, `message_count`, `status`, `inspector_id`, `score`, `grade`, `comment`, `reviewed_at`, `platform_id`, `shop_id`)
VALUES
-- 已完成的质检会话
('QS20251130001', @agent1_id, 'CUST001', '张三', 'chat', '2025-11-30 10:00:00', '2025-11-30 10:15:00', 900, 10, 'completed', @qa1_id, 93.00, 'S', '服务态度优秀，问题解决及时', NOW(), @platform_jd_id, @shop_jd1_id),
('QS20251130002', @agent1_id, 'CUST002', '李四', 'phone', '2025-11-30 11:00:00', '2025-11-30 11:20:00', 1200, 15, 'completed', @qa1_id, 84.00, 'B', '服务良好，沟通顺畅', NOW(), @platform_jd_id, @shop_jd2_id),
('QS20251130003', @agent2_id, 'CUST003', '王五', 'chat', '2025-11-30 14:00:00', '2025-11-30 14:10:00', 600, 8, 'completed', @qa1_id, 100.00, 'S', '完美的服务体验', NOW(), @platform_jd_id, @shop_jd1_id),
('QS20251130004', @agent2_id, 'CUST004', '赵六', 'email', '2025-11-30 15:00:00', '2025-11-30 15:30:00', 1800, 6, 'completed', @qa1_id, 78.00, 'C', '邮件回复及时，内容详细', NOW(), @platform_tb_id, @shop_tb1_id),
('QS20251130005', @agent3_id, 'CUST005', '孙七', 'chat', '2025-11-30 16:00:00', '2025-11-30 16:25:00', 1500, 12, 'completed', @qa1_id, 89.00, 'A', '服务专业，态度友好', NOW(), @platform_jd_id, @shop_jd2_id),

-- 待质检的会话
('QS20251201001', @agent1_id, 'CUST006', '周八', 'phone', '2025-12-01 09:30:00', '2025-12-01 10:00:00', 1800, 20, 'pending', NULL, NULL, NULL, NULL, NULL, @platform_jd_id, @shop_jd1_id),
('QS20251201002', @agent3_id, 'CUST007', '吴九', 'chat', '2025-12-01 11:00:00', '2025-12-01 11:15:00', 900, 9, 'pending', NULL, NULL, NULL, NULL, NULL, @platform_tb_id, @shop_tb1_id),

-- 质检中的会话
('QS20251201003', @agent2_id, 'CUST008', '郑十', 'video', '2025-12-01 13:00:00', '2025-12-01 13:45:00', 2700, 18, 'in_review', @qa1_id, NULL, NULL, NULL, NULL, @platform_jd_id, @shop_jd1_id),
('QS20251201004', @agent1_id, 'CUST009', '钱十一', 'chat', '2025-12-01 15:00:00', '2025-12-01 15:20:00', 1200, 11, 'in_review', @qa1_id, NULL, NULL, NULL, NULL, @platform_jd_id, @shop_jd2_id),
('QS20251201005', @agent3_id, 'CUST010', '陈十二', 'phone', '2025-12-01 16:30:00', '2025-12-01 17:00:00', 1800, 16, 'in_review', @qa1_id, NULL, NULL, NULL, NULL, @platform_tb_id, @shop_tb1_id);

-- 获取已完成会话的ID
SET @session1_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130001' LIMIT 1);
SET @session2_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130002' LIMIT 1);
SET @session3_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130003' LIMIT 1);
SET @session4_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130004' LIMIT 1);
SET @session5_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130005' LIMIT 1);

-- 插入质检评分数据
-- 会话1的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`) VALUES
(@session1_id, @rule1_id, 28.00, 30.00, '服务态度良好，耐心回答客户问题'),
(@session1_id, @rule2_id, 38.00, 40.00, '问题解决能力较强，能快速定位问题'),
(@session1_id, @rule3_id, 27.00, 30.00, '沟通表达清晰，逻辑性较好');

-- 会话2的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`) VALUES
(@session2_id, @rule1_id, 25.00, 30.00, '服务态度较好，但稍显急躁'),
(@session2_id, @rule2_id, 35.00, 40.00, '问题解决能力良好'),
(@session2_id, @rule3_id, 24.00, 30.00, '沟通表达基本清楚');

-- 会话3的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`) VALUES
(@session3_id, @rule1_id, 30.00, 30.00, '服务态度热情，非常耐心'),
(@session3_id, @rule2_id, 40.00, 40.00, '问题解决能力优秀，快速准确'),
(@session3_id, @rule3_id, 30.00, 30.00, '沟通表达非常清晰');

-- 会话4的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`) VALUES
(@session4_id, @rule1_id, 24.00, 30.00, '邮件回复态度良好'),
(@session4_id, @rule2_id, 32.00, 40.00, '问题解答详细'),
(@session4_id, @rule3_id, 22.00, 30.00, '文字表达清晰');

-- 会话5的评分
INSERT INTO `quality_scores` (`session_id`, `rule_id`, `score`, `max_score`, `comment`) VALUES
(@session5_id, @rule1_id, 27.00, 30.00, '服务态度友好'),
(@session5_id, @rule2_id, 36.00, 40.00, '专业能力强'),
(@session5_id, @rule3_id, 26.00, 30.00, '沟通顺畅');

-- 输出确认信息
SELECT '质检会话数据插入完成' AS 'Status';
SELECT
  qs.session_no,
  u.real_name AS agent_name,
  qs.customer_name,
  qs.channel,
  qs.status,
  qs.score,
  qs.grade,
  p.name AS platform,
  s.name AS shop
FROM `quality_sessions` qs
LEFT JOIN `users` u ON qs.agent_id = u.id
LEFT JOIN `platforms` p ON qs.platform_id = p.id
LEFT JOIN `shops` s ON qs.shop_id = s.id
WHERE qs.session_no LIKE 'QS2025%'
ORDER BY qs.session_no;
