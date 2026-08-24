-- CreateTable: 职责授权 · 角色↔审批流程绑定
CREATE TABLE `role_workflows` (
    `role_id` INTEGER NOT NULL,
    `workflow_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `role_workflows_role_id_workflow_id_key`(`role_id`, `workflow_id`),
    INDEX `role_workflows_workflow_id_idx`(`workflow_id`),
    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: 角色
ALTER TABLE `role_workflows` ADD CONSTRAINT `role_workflows_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: 审批流程
ALTER TABLE `role_workflows` ADD CONSTRAINT `role_workflows_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;