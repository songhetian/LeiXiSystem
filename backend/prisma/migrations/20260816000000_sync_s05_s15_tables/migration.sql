-- P2-10: 同步 S05-S15 新增表与字段（补全 prisma db push 遗漏的迁移文件）
-- 由 `prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script` 生成
--
-- 新增表：
--   punch_makeups(补卡)、attendance_daily_recalc_tasks(考勤重算任务)、
--   broadcast_reads(公告已读)、broadcast_recipients(公告接收人)、
--   notifications(站内通知)、approval_groups(审批组)、approval_group_members(审批组成员)
-- 字段调整：DateTime 精度统一、部分列放宽为可空、broadcasts 增加 recipient_type、
--   payroll_runs 增加 checked_at/checked_by/checked_employee_ids（抽检闸门）
-- 无 DROP 语句，不丢失数据。

-- AlterTable
ALTER TABLE `attendance_daily` MODIFY `first_punch` DATETIME NULL,
    MODIFY `last_punch` DATETIME NULL;

-- AlterTable
ALTER TABLE `broadcasts` ADD COLUMN `recipient_type` ENUM('all', 'department', 'user') NOT NULL DEFAULT 'all';

-- AlterTable
ALTER TABLE `overtime_records` MODIFY `start_time` DATETIME NOT NULL,
    MODIFY `end_time` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `payroll_runs` ADD COLUMN `checked_at` DATETIME(3) NULL,
    ADD COLUMN `checked_by` INTEGER NULL,
    ADD COLUMN `checked_employee_ids` JSON NULL;

-- AlterTable
ALTER TABLE `punch_devices` MODIFY `last_sync_time` DATETIME NULL;

-- AlterTable
ALTER TABLE `punch_logs` MODIFY `punch_time` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `punch_sync_state` MODIFY `last_sync_time` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `punch_makeups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `punch_date` DATE NOT NULL,
    `punch_type` VARCHAR(20) NOT NULL,
    `original_time` DATETIME(3) NULL,
    `makeup_time` DATETIME(3) NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` ENUM('pending', 'approving', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `approval_instance_id` INTEGER NULL,
    `approver_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `approval_note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `punch_makeups_employee_id_idx`(`employee_id`),
    INDEX `punch_makeups_status_idx`(`status`),
    INDEX `punch_makeups_punch_date_idx`(`punch_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_daily_recalc_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
    `record_count` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `triggered_by` INTEGER NULL,
    `trigger_type` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `duration_ms` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,

    INDEX `attendance_daily_recalc_tasks_created_at_idx`(`created_at`),
    INDEX `attendance_daily_recalc_tasks_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_reads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `broadcast_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `broadcast_reads_user_id_idx`(`user_id`),
    UNIQUE INDEX `broadcast_reads_broadcast_id_user_id_key`(`broadcast_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `broadcast_id` INTEGER NOT NULL,
    `recipient_type` ENUM('all', 'department', 'user') NOT NULL,
    `department_id` INTEGER NULL,
    `user_id` INTEGER NULL,

    INDEX `broadcast_recipients_broadcast_id_idx`(`broadcast_id`),
    INDEX `broadcast_recipients_recipient_type_idx`(`recipient_type`),
    INDEX `broadcast_recipients_department_id_idx`(`department_id`),
    INDEX `broadcast_recipients_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NULL,
    `type` VARCHAR(30) NOT NULL DEFAULT 'system',
    `read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `related_id` INTEGER NULL,
    `related_type` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    INDEX `notifications_user_id_read_idx`(`user_id`, `read`),
    INDEX `notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `approval_groups_code_key`(`code`),
    INDEX `approval_groups_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_group_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `approval_group_members_user_id_idx`(`user_id`),
    UNIQUE INDEX `approval_group_members_group_id_user_id_key`(`group_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `punch_makeups` ADD CONSTRAINT `punch_makeups_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_reads` ADD CONSTRAINT `broadcast_reads_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_recipients` ADD CONSTRAINT `broadcast_recipients_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_recipients` ADD CONSTRAINT `broadcast_recipients_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_group_members` ADD CONSTRAINT `approval_group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `approval_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
