-- 职责授权方向翻转
--
-- 旧模型：角色 → 流程（主键 role_id），一个角色**全局只能绑一条**流程。
--   请假绑了流程，该角色的报销就没得绑；而发起审批是按业务模块解析绑定流程的，
--   于是这个角色在其它业务上永远走不到绑定流程，页面上也只能看到「每种角色只有一个流程」。
--
-- 新模型：流程 → 角色（主键 workflow_id + role_id），一条流程可适用于多个角色，
--   同一角色可以在请假、报销等不同模块各自绑定（同模块内仍只允许一条，由服务层校验）。
--
-- 存量数据不需要转换：旧行本就是 (role_id, workflow_id) 且 role_id 唯一，
-- 换主键顺序后仍是合法的一对绑定关系，不丢数据、不需要回填。
--
-- role_workflows_workflow_id_idx 随主键前缀（workflow_id）失去意义，一并删除；
-- 角色维度反查仍走 role_workflows_role_id_workflow_id_key。
ALTER TABLE `role_workflows`
    DROP PRIMARY KEY,
    DROP INDEX `role_workflows_workflow_id_idx`,
    ADD PRIMARY KEY (`workflow_id`, `role_id`);
