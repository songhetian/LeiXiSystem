-- ============================================================================
-- 回填 approval_instances.workflow_code（ADR-0020 修订）
-- ============================================================================
--
-- 背景
--   修复前 startInstance 把 instance.workflow_code 写成「实际使用的流程定义编码」。
--   当业务未单独配置流程、走「角色职责授权」兜底时，实际流程是同分组的另一条流程
--   （例：加班申请兜底到请假流程），于是实例上记的是 'leave' 而不是 'overtime'。
--   审批通过/拒绝事件按 instance.workflow_code 分派业务回调，存量在途单审批通过后
--   会被错误的监听器消费（或没有监听器消费），业务单据永久停在 approving。
--
-- 处理
--   业务单据与审批实例一一对应（各业务单表的 approval_instance_id 指向实例），
--   以业务单表为准反查真实业务编码并回填，共 11 张表 / 11 个业务码。
--
-- 约束
--   1. 幂等：仅更新 workflow_code 与业务码不一致的行；已修复后的新单不会被触碰。
--   2. 只改 workflow_code，不触碰 updated_at —— 该列由 Prisma 客户端维护、无
--      ON UPDATE 子句，raw UPDATE 不会改写它；这样 ApprovalReconciler 的
--      「最近 1 小时终态单」扫描窗口不会被历史数据撑大而重放陈年事件。
--   3. 不新增索引、不改表结构，故与 schema.prisma 无 diff（migration 只含 DML）。
--
-- 未覆盖
--   'procurement' / 'general'（通用审批）没有业务单表，若历史上兜底到同分组其它
--   流程则无法反查；这两类流程当前没有任何业务回调监听器，不影响入账与状态流转。
--   如需人工核对，可执行文末的核查语句列出 workflow_code 与 workflow.module 不一致
--   的实例。
-- ============================================================================

-- 请假
UPDATE `approval_instances` ai
JOIN `leave_records` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'leave'
WHERE ai.`workflow_code` <> 'leave';

-- 加班
UPDATE `approval_instances` ai
JOIN `overtime_records` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'overtime'
WHERE ai.`workflow_code` <> 'overtime';

-- 补卡
UPDATE `approval_instances` ai
JOIN `punch_makeups` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'punch_makeup'
WHERE ai.`workflow_code` <> 'punch_makeup';

-- 考勤申诉
UPDATE `approval_instances` ai
JOIN `attendance_appeals` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'attendance_appeal'
WHERE ai.`workflow_code` <> 'attendance_appeal';

-- 报销
UPDATE `approval_instances` ai
JOIN `reimbursements` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'reimbursement'
WHERE ai.`workflow_code` <> 'reimbursement';

-- 入职
UPDATE `approval_instances` ai
JOIN `onboarding` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'onboarding'
WHERE ai.`workflow_code` <> 'onboarding';

-- 转正
UPDATE `approval_instances` ai
JOIN `probations` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'probation'
WHERE ai.`workflow_code` <> 'probation';

-- 离职
UPDATE `approval_instances` ai
JOIN `resignations` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'resignation'
WHERE ai.`workflow_code` <> 'resignation';

-- 调动
UPDATE `approval_instances` ai
JOIN `employee_transfers` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'transfer'
WHERE ai.`workflow_code` <> 'transfer';

-- 奖惩
UPDATE `approval_instances` ai
JOIN `employee_rewards` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'reward_punishment'
WHERE ai.`workflow_code` <> 'reward_punishment';

-- 证明开具
UPDATE `approval_instances` ai
JOIN `certificate_requests` b ON b.`approval_instance_id` = ai.`id`
SET ai.`workflow_code` = 'cert_request'
WHERE ai.`workflow_code` <> 'cert_request';

-- 核查（不执行，仅供上线后人工抽查）：列出 workflow_code 与流程定义编码不一致、
-- 且没有业务单表可反查的实例（预期只剩 procurement / general 的兜底历史单）。
-- SELECT ai.`id`, ai.`workflow_code`, w.`code` AS actual_code, ai.`status`
--   FROM `approval_instances` ai
--   JOIN `approval_workflows` w ON w.`id` = ai.`workflow_id`
--  WHERE ai.`workflow_code` <> w.`code`
--    AND ai.`status` = 'pending';
