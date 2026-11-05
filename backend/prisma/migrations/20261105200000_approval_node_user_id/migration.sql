-- 审批节点：支持「直接指定某个人」作为审批人（node.type = 'user'）
--
-- 此前 approval_workflow_nodes 只有 role_code / approval_group_id 两种委派方式，
-- 引擎（engine/routing-engine.ts）虽然已经实现了 `case 'user'`，但表里没有落库
-- 字段，前端也从未提供入口，导致「点名叫某人审批」无法配置。
--
-- 语义：
--   user_id 非空且 type='user' —— 该用户即为该节点唯一审批人；
--   user_id 为空              —— 节点未配置审批人，待办与通知均不会产生（fail-closed）。
--
-- 不加外键：users 表存在软删除/停用账号，节点配置需要在账号停用后仍然可读，
-- 审批人失效由前端提示「用户已不存在」，而不是让整个流程保存失败。
ALTER TABLE `approval_workflow_nodes`
  ADD COLUMN `user_id` INTEGER NULL AFTER `approval_group_id`;
