-- 通知设置：新增节点级通知开关列（对应「通知设置」页改为按审批流程节点配置）
--
-- 语义（发送侧 NotificationSettingService.getPolicy 消费）：
--   NULL  —— 该事件从未配置过，按默认策略发送（流程所有节点都通知、终态通知申请人）；
--   []    —— 显式关闭（一个节点都不通知 / 终态不通知申请人）；
--   [..]  —— 只通知数组内的节点（元素为 approval_workflow_nodes.node_key）。
--
-- 保留 target_roles 承接非流程事件（迟到/早退/缺勤/资产领用）的收件人语义，
-- 语义同上：NULL=未配置、[]=关闭、['applicant'|'dept_manager'|角色名]=指定收件方。
ALTER TABLE `notification_settings`
  ADD COLUMN `target_nodes` JSON NULL AFTER `target_roles`;
