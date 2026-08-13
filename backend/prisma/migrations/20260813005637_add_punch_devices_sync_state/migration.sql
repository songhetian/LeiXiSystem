/*
  Warnings:

  - You are about to alter the column `punch_time` on the `punch_logs` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `punch_logs` MODIFY `punch_time` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `punch_devices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `device_no` VARCHAR(50) NOT NULL,
    `ip_address` VARCHAR(50) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 80,
    `api_key` VARCHAR(100) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `last_sync_time` DATETIME NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'online',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `punch_devices_device_no_key`(`device_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `punch_sync_state` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `device_no` VARCHAR(50) NOT NULL,
    `last_sync_time` DATETIME NOT NULL,
    `last_sync_count` INTEGER NOT NULL DEFAULT 0,
    `total_synced` INTEGER NOT NULL DEFAULT 0,
    `last_error` VARCHAR(500) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `punch_sync_state_device_no_key`(`device_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `baseDays` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 999,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vacation_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `vacation_type_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `totalDays` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `usedDays` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vacation_balances_employee_id_year_idx`(`employee_id`, `year`),
    UNIQUE INDEX `vacation_balances_employee_id_vacation_type_id_year_key`(`employee_id`, `vacation_type_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_balance_changes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `balance_id` INTEGER NOT NULL,
    `change_type` ENUM('addition', 'deduction', 'conversion', 'adjustment') NOT NULL,
    `amount` DECIMAL(5, 2) NOT NULL,
    `balance_before` DECIMAL(5, 2) NOT NULL,
    `balance_after` DECIMAL(5, 2) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` INTEGER NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vacation_balance_changes_employee_id_idx`(`employee_id`),
    INDEX `vacation_balance_changes_balance_id_idx`(`balance_id`),
    INDEX `vacation_balance_changes_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `vacation_type_id` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `days` DECIMAL(5, 2) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('pending', 'approving', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `approval_instance_id` INTEGER NULL,
    `approver_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `approval_note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_records_employee_id_idx`(`employee_id`),
    INDEX `leave_records_status_idx`(`status`),
    INDEX `leave_records_start_date_end_date_idx`(`start_date`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `overtime_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `overtime_date` DATE NOT NULL,
    `start_time` DATETIME NOT NULL,
    `end_time` DATETIME NOT NULL,
    `hours` DECIMAL(5, 2) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `status` ENUM('pending', 'approving', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `is_compensated` BOOLEAN NOT NULL DEFAULT false,
    `compensated_at` DATETIME(3) NULL,
    `approval_instance_id` INTEGER NULL,
    `approver_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `approval_note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `overtime_records_employee_id_idx`(`employee_id`),
    INDEX `overtime_records_status_idx`(`status`),
    INDEX `overtime_records_overtime_date_idx`(`overtime_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_daily` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `work_date` DATE NOT NULL,
    `shift_id` INTEGER NULL,
    `schedule_id` INTEGER NULL,
    `first_punch` DATETIME NULL,
    `last_punch` DATETIME NULL,
    `punch_count` INTEGER NOT NULL DEFAULT 0,
    `late_minutes` INTEGER NOT NULL DEFAULT 0,
    `early_minutes` INTEGER NOT NULL DEFAULT 0,
    `overtime_minutes` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('normal', 'late', 'early', 'late_early', 'absent', 'half_absent', 'abnormal', 'makeup', 'holiday', 'leave', 'weekend') NOT NULL DEFAULT 'normal',
    `makeup_reason` VARCHAR(255) NULL,
    `operated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_daily_work_date_idx`(`work_date`),
    INDEX `attendance_daily_status_idx`(`status`),
    UNIQUE INDEX `attendance_daily_employee_id_work_date_key`(`employee_id`, `work_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_monthly` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `month` CHAR(7) NOT NULL,
    `work_days` DECIMAL(5, 1) NOT NULL,
    `late_count` INTEGER NOT NULL DEFAULT 0,
    `early_count` INTEGER NOT NULL DEFAULT 0,
    `absent_days` DECIMAL(5, 1) NOT NULL DEFAULT 0,
    `leave_minutes` INTEGER NOT NULL DEFAULT 0,
    `overtime_hours` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `status` ENUM('draft', 'confirmed') NOT NULL DEFAULT 'draft',
    `confirmed_by` INTEGER NULL,
    `confirmed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_monthly_month_idx`(`month`),
    INDEX `attendance_monthly_status_idx`(`status`),
    UNIQUE INDEX `attendance_monthly_employee_id_month_key`(`employee_id`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `amount` DECIMAL(10, 2) NULL,
    `rate` DECIMAL(10, 4) NULL,
    `formula` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `salary_items_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_runs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `month` CHAR(7) NOT NULL,
    `status` ENUM('draft', 'confirmed', 'published', 'recalled') NOT NULL DEFAULT 'draft',
    `total_employees` INTEGER NULL,
    `total_amount` DECIMAL(14, 2) NULL,
    `confirmed_by` INTEGER NULL,
    `confirmed_at` DATETIME(3) NULL,
    `published_by` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `recalled_by` INTEGER NULL,
    `recalled_at` DATETIME(3) NULL,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payroll_runs_month_key`(`month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `run_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `item_code` VARCHAR(30) NOT NULL,
    `item_name` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `source_ref` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_details_employee_id_idx`(`employee_id`),
    UNIQUE INDEX `payroll_details_run_id_employee_id_item_code_key`(`run_id`, `employee_id`, `item_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_adjustments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `run_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `item_code` VARCHAR(30) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_adjustments_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `run_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `month` CHAR(7) NOT NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('unviewed', 'viewed') NOT NULL DEFAULT 'unviewed',
    `viewed_at` DATETIME(3) NULL,
    `items_json` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payslips_employee_id_idx`(`employee_id`),
    INDEX `payslips_month_idx`(`month`),
    UNIQUE INDEX `payslips_run_id_employee_id_key`(`run_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_articles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NULL,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'published',
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `knowledge_articles_category_id_idx`(`category_id`),
    INDEX `knowledge_articles_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `article_id` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_size` INTEGER NULL,
    `mime_type` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_attachments_article_id_idx`(`article_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_article_daily_stats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `article_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `unique_viewers` INTEGER NOT NULL DEFAULT 0,

    INDEX `knowledge_article_daily_stats_date_idx`(`date`),
    UNIQUE INDEX `knowledge_article_daily_stats_article_id_date_key`(`article_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `username` VARCHAR(50) NULL,
    `module` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `method` VARCHAR(10) NULL,
    `url` VARCHAR(255) NULL,
    `ip` VARCHAR(50) NULL,
    `params` TEXT NULL,
    `result` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'success',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `operation_logs_user_id_idx`(`user_id`),
    INDEX `operation_logs_module_idx`(`module`),
    INDEX `operation_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcasts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NULL,
    `status` ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    `type` VARCHAR(20) NOT NULL DEFAULT 'notice',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `created_by` INTEGER NOT NULL,
    `published_by` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `broadcasts_status_idx`(`status`),
    INDEX `broadcasts_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_workflows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `module` VARCHAR(50) NOT NULL,
    `status` ENUM('draft', 'active', 'inactive') NOT NULL DEFAULT 'draft',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `approval_workflows_code_key`(`code`),
    INDEX `approval_workflows_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_workflow_nodes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workflow_id` INTEGER NOT NULL,
    `node_key` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `role_code` VARCHAR(50) NULL,
    `approval_group_id` INTEGER NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `condition_field` VARCHAR(50) NULL,
    `condition_operator` VARCHAR(10) NULL,
    `condition_value` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `approval_workflow_nodes_workflow_id_idx`(`workflow_id`),
    UNIQUE INDEX `approval_workflow_nodes_workflow_id_node_key_key`(`workflow_id`, `node_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_instances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workflow_id` INTEGER NOT NULL,
    `workflow_code` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `applicant_id` INTEGER NOT NULL,
    `applicant_name` VARCHAR(50) NOT NULL,
    `department_id` INTEGER NULL,
    `form_data` TEXT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `current_node_key` VARCHAR(50) NULL,
    `current_node_name` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `approval_instances_applicant_id_idx`(`applicant_id`),
    INDEX `approval_instances_status_idx`(`status`),
    INDEX `approval_instances_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instance_id` INTEGER NOT NULL,
    `node_id` INTEGER NOT NULL,
    `node_key` VARCHAR(50) NOT NULL,
    `node_name` VARCHAR(100) NOT NULL,
    `approver_id` INTEGER NULL,
    `approver_name` VARCHAR(50) NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `comment` VARCHAR(500) NULL,
    `handled_at` DATETIME(3) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `approval_records_instance_id_idx`(`instance_id`),
    INDEX `approval_records_approver_id_idx`(`approver_id`),
    INDEX `approval_records_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursement_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reimbursement_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_id` INTEGER NOT NULL,
    `type_code` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `applicant_id` INTEGER NOT NULL,
    `applicant_name` VARCHAR(50) NOT NULL,
    `department_id` INTEGER NULL,
    `status` ENUM('draft', 'pending', 'approving', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
    `approval_instance_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reimbursements_applicant_id_idx`(`applicant_id`),
    INDEX `reimbursements_status_idx`(`status`),
    INDEX `reimbursements_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursement_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_id` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` VARCHAR(500) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reimbursement_items_reimbursement_id_idx`(`reimbursement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `export_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(50) NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `month` CHAR(7) NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    `file_name` VARCHAR(255) NULL,
    `file_path` VARCHAR(500) NULL,
    `file_size` INTEGER NULL,
    `download_url` VARCHAR(500) NULL,
    `error_msg` VARCHAR(500) NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `export_tasks_created_by_idx`(`created_by`),
    INDEX `export_tasks_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vacation_balances` ADD CONSTRAINT `vacation_balances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vacation_balances` ADD CONSTRAINT `vacation_balances_vacation_type_id_fkey` FOREIGN KEY (`vacation_type_id`) REFERENCES `vacation_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vacation_balance_changes` ADD CONSTRAINT `vacation_balance_changes_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vacation_balance_changes` ADD CONSTRAINT `vacation_balance_changes_balance_id_fkey` FOREIGN KEY (`balance_id`) REFERENCES `vacation_balances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_records` ADD CONSTRAINT `leave_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_records` ADD CONSTRAINT `leave_records_vacation_type_id_fkey` FOREIGN KEY (`vacation_type_id`) REFERENCES `vacation_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `overtime_records` ADD CONSTRAINT `overtime_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_daily` ADD CONSTRAINT `attendance_daily_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_daily` ADD CONSTRAINT `attendance_daily_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_daily` ADD CONSTRAINT `attendance_daily_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_monthly` ADD CONSTRAINT `attendance_monthly_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_details` ADD CONSTRAINT `payroll_details_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_details` ADD CONSTRAINT `payroll_details_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `knowledge_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_attachments` ADD CONSTRAINT `knowledge_attachments_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_article_daily_stats` ADD CONSTRAINT `knowledge_article_daily_stats_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_workflow_nodes` ADD CONSTRAINT `approval_workflow_nodes_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_instances` ADD CONSTRAINT `approval_instances_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_records` ADD CONSTRAINT `approval_records_instance_id_fkey` FOREIGN KEY (`instance_id`) REFERENCES `approval_instances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_records` ADD CONSTRAINT `approval_records_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `approval_workflow_nodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursements` ADD CONSTRAINT `reimbursements_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `reimbursement_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursement_items` ADD CONSTRAINT `reimbursement_items_reimbursement_id_fkey` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
