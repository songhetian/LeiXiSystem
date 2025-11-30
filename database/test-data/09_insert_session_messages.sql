-- ==========================================
-- 质检聊天消息测试数据插入脚本
-- ==========================================

USE leixin_customer_service;

-- 获取会话ID
SET @session1_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130001' LIMIT 1);
SET @session2_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130002' LIMIT 1);
SET @session3_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130003' LIMIT 1);
SET @session4_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130004' LIMIT 1);
SET @session5_id = (SELECT id FROM `quality_sessions` WHERE `session_no` = 'QS20251130005' LIMIT 1);

-- 获取客服ID
SET @agent1_id = (SELECT id FROM `users` WHERE `username` = 'service1' LIMIT 1);
SET @agent2_id = (SELECT id FROM `users` WHERE `username` = 'service2' LIMIT 1);
SET @agent3_id = (SELECT id FROM `users` WHERE `username` = 'service3' LIMIT 1);

-- 清理已存在的测试数据
DELETE FROM `session_messages` WHERE `session_id` IN (@session1_id, @session2_id, @session3_id, @session4_id, @session5_id);

-- 为会话1插入聊天消息（订单查询场景）
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

-- 为会话2插入聊天消息（退货场景）
INSERT INTO `session_messages` (`session_id`, `sender_type`, `sender_id`, `content`, `content_type`, `timestamp`) VALUES
(@session2_id, 'customer', 'CUST002', '我要退货', 'text', '2025-11-30 11:00:00'),
(@session2_id, 'agent', @agent1_id, '您好，请问是什么原因需要退货呢？', 'text', '2025-11-30 11:00:20'),
(@session2_id, 'customer', 'CUST002', '商品质量有问题', 'text', '2025-11-30 11:00:40'),
(@session2_id, 'agent', @agent1_id, '非常抱歉，能详细说明一下是什么质量问题吗？', 'text', '2025-11-30 11:01:00'),
(@session2_id, 'customer', 'CUST002', '包装破损，商品有划痕', 'text', '2025-11-30 11:01:30'),
(@session2_id, 'agent', @agent1_id, '真的很抱歉给您带来这样的体验，我们会为您处理退货', 'text', '2025-11-30 11:02:00'),
(@session2_id, 'customer', 'CUST002', '什么时候能退款？', 'text', '2025-11-30 11:02:30'),
(@session2_id, 'agent', @agent1_id, '您申请退货后，我们会安排上门取件，收到货后3-5个工作日退款', 'text', '2025-11-30 11:03:00'),
(@session2_id, 'customer', 'CUST002', '好的', 'text', '2025-11-30 11:03:20'),
(@session2_id, 'agent', @agent1_id, '感谢您的理解，如有其他问题随时联系我们', 'text', '2025-11-30 11:03:40'),
(@session2_id, 'customer', 'CUST002', '嗯', 'text', '2025-11-30 11:04:00'),
(@session2_id, 'agent', @agent1_id, '祝您生活愉快！', 'text', '2025-11-30 11:04:15'),
(@session2_id, 'customer', 'CUST002', '再见', 'text', '2025-11-30 11:04:30'),
(@session2_id, 'agent', @agent1_id, '再见！', 'text', '2025-11-30 11:04:45'),
(@session2_id, 'system', 'SYSTEM', '会话已结束', 'text', '2025-11-30 11:05:00');

-- 为会话3插入聊天消息（优惠活动咨询场景）
INSERT INTO `session_messages` (`session_id`, `sender_type`, `sender_id`, `content`, `content_type`, `timestamp`) VALUES
(@session3_id, 'customer', 'CUST003', '请问这款产品有什么优惠活动吗？', 'text', '2025-11-30 14:00:00'),
(@session3_id, 'agent', @agent2_id, '您好！目前这款产品正在参加满减活动，满300减50', 'text', '2025-11-30 14:00:15'),
(@session3_id, 'customer', 'CUST003', '可以叠加优惠券吗？', 'text', '2025-11-30 14:00:35'),
(@session3_id, 'agent', @agent2_id, '可以的，优惠券和满减活动可以叠加使用', 'text', '2025-11-30 14:00:50'),
(@session3_id, 'customer', 'CUST003', '太好了，那我现在下单', 'text', '2025-11-30 14:01:10'),
(@session3_id, 'agent', @agent2_id, '好的，祝您购物愉快！如有任何问题随时联系我们', 'text', '2025-11-30 14:01:25'),
(@session3_id, 'customer', 'CUST003', '谢谢', 'text', '2025-11-30 14:01:40'),
(@session3_id, 'agent', @agent2_id, '不客气！', 'text', '2025-11-30 14:01:50');

-- 为会话4插入聊天消息（邮件咨询场景）
INSERT INTO `session_messages` (`session_id`, `sender_type`, `sender_id`, `content`, `content_type`, `timestamp`) VALUES
(@session4_id, 'customer', 'CUST004', '您好，我想了解一下贵公司的售后服务政策', 'text', '2025-11-30 15:00:00'),
(@session4_id, 'agent', @agent2_id, '您好！感谢您的咨询。我们的售后服务政策如下：\n1. 7天无理由退换货\n2. 15天质量问题免费换货\n3. 1年保修服务\n4. 终身技术支持', 'text', '2025-11-30 15:05:00'),
(@session4_id, 'customer', 'CUST004', '如果超过7天发现质量问题怎么办？', 'text', '2025-11-30 15:10:00'),
(@session4_id, 'agent', @agent2_id, '如果在15天内发现质量问题，我们提供免费换货服务。超过15天但在1年保修期内，我们会提供免费维修服务。', 'text', '2025-11-30 15:15:00'),
(@session4_id, 'customer', 'CUST004', '明白了，谢谢您的详细解答', 'text', '2025-11-30 15:20:00'),
(@session4_id, 'agent', @agent2_id, '不客气！如有其他问题，欢迎随时联系我们。祝您生活愉快！', 'text', '2025-11-30 15:25:00');

-- 为会话5插入聊天消息（产品使用咨询场景）
INSERT INTO `session_messages` (`session_id`, `sender_type`, `sender_id`, `content`, `content_type`, `timestamp`) VALUES
(@session5_id, 'customer', 'CUST005', '这个产品怎么使用？', 'text', '2025-11-30 16:00:00'),
(@session5_id, 'agent', @agent3_id, '您好！请问您具体想了解哪方面的使用方法？', 'text', '2025-11-30 16:00:20'),
(@session5_id, 'customer', 'CUST005', '如何开机', 'text', '2025-11-30 16:00:40'),
(@session5_id, 'agent', @agent3_id, '长按电源键3秒即可开机，首次使用需要充电2小时', 'text', '2025-11-30 16:01:00'),
(@session5_id, 'customer', 'CUST005', '充电用什么充电器？', 'text', '2025-11-30 16:01:30'),
(@session5_id, 'agent', @agent3_id, '包装盒内有配套的充电器，使用Type-C接口', 'text', '2025-11-30 16:02:00'),
(@session5_id, 'customer', 'CUST005', '可以用其他充电器吗？', 'text', '2025-11-30 16:02:30'),
(@session5_id, 'agent', @agent3_id, '可以的，只要是5V/2A的Type-C充电器都可以使用', 'text', '2025-11-30 16:03:00'),
(@session5_id, 'customer', 'CUST005', '明白了，谢谢', 'text', '2025-11-30 16:03:20'),
(@session5_id, 'agent', @agent3_id, '不客气，如有其他问题随时联系我们。祝您使用愉快！', 'text', '2025-11-30 16:03:40'),
(@session5_id, 'customer', 'CUST005', '好的', 'text', '2025-11-30 16:04:00'),
(@session5_id, 'system', 'SYSTEM', '会话已结束', 'text', '2025-11-30 16:04:15');

-- 输出确认信息
SELECT '聊天消息数据插入完成' AS 'Status';
SELECT
  qs.session_no,
  COUNT(sm.id) AS message_count,
  MIN(sm.timestamp) AS first_message,
  MAX(sm.timestamp) AS last_message
FROM `quality_sessions` qs
LEFT JOIN `session_messages` sm ON qs.id = sm.session_id
WHERE qs.session_no LIKE 'QS2025%'
GROUP BY qs.session_no
ORDER BY qs.session_no;
