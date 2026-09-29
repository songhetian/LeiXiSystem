-- 基线迁移（baseline）· 0_init
--
-- 【生成方式】
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- 【背景】
--   本仓库历史上所有 87 张表均由 `prisma db push` 直接建成，21 个历史迁移从未在任何数据库生效过
--   （真实库 leixin_v2 的 _prisma_migrations 表不存在），且迁移链本身存在缺口：
--   20260827000000_add_contract_enhance_fields 引用了从未被任何迁移创建的 contracts 表。
--   后果：`prisma migrate deploy` 在空库上必定失败，在既有库上会因重复建表而失败 —— 即迁移链已不可用。
--
-- 【处理策略】
--   1. 将 21 个历史迁移压缩为单一基线（本文件），其内容与 schema.prisma 逐字对齐；
--   2. 既有数据库（由 db push 建成、含真实数据）由 backend/entrypoint.sh 自动执行
--      `prisma migrate resolve --applied 0_init` 打基线标记 —— 不执行本文件的 DDL，不触碰既有数据；
--   3. 空数据库直接 `prisma migrate deploy`，由本文件一次性建全；
--   4. 此后所有 schema 变更一律新增迁移文件，禁止再使用 `prisma db push`。
--
-- 【内容构成】
--   第一部分：全量 DDL（87 张表 + 索引 + 外键），由 schema.prisma 反向生成；
--   第二部分：历史迁移中不可由 schema.prisma 表达的种子数据（系统参数默认值 + 系统设置管理权限）。

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `real_name` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `avatar` VARCHAR(1024) NULL,
    `department_id` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `approval_note` TEXT NULL,
    `last_login` DATETIME NULL,
    `session_token` VARCHAR(500) NULL,
    `session_created_at` DATETIME NULL,
    `is_department_manager` BOOLEAN NOT NULL DEFAULT false,
    `id_card_front_url` VARCHAR(500) NULL,
    `id_card_back_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_real_name_idx`(`real_name`),
    INDEX `users_department_id_idx`(`department_id`),
    INDEX `users_status_idx`(`status`),
    INDEX `users_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(200) NULL,

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_workflows` (
    `role_id` INTEGER NOT NULL,
    `workflow_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `role_workflows_workflow_id_idx`(`workflow_id`),
    UNIQUE INDEX `role_workflows_role_id_workflow_id_key`(`role_id`, `workflow_id`),
    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `module` VARCHAR(50) NOT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'menu',

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,

    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_setting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group` VARCHAR(50) NOT NULL DEFAULT 'general',
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `label` VARCHAR(100) NULL,
    `description` VARCHAR(255) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `system_setting_key_key`(`key`),
    INDEX `system_setting_group_idx`(`group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_setting_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setting_key` VARCHAR(100) NOT NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `changed_by` INTEGER NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_setting_history_setting_key_idx`(`setting_key`),
    INDEX `system_setting_history_changed_by_idx`(`changed_by`),
    INDEX `system_setting_history_changed_at_idx`(`changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dict_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'enabled',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dict_type_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dict_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_id` INTEGER NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `value` VARCHAR(100) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'enabled',
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dict_item_type_id_idx`(`type_id`),
    INDEX `dict_item_value_idx`(`value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `parent_id` INTEGER NULL,
    `manager_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME NULL,

    INDEX `departments_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `positions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_no` VARCHAR(20) NOT NULL,
    `user_id` INTEGER NULL,
    `name` VARCHAR(50) NOT NULL,
    `department_id` INTEGER NOT NULL,
    `position_id` INTEGER NULL,
    `hire_date` DATE NOT NULL,
    `resign_date` DATE NULL,
    `phone` VARCHAR(20) NULL,
    `salary` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` ENUM('active', 'probation', 'resigned', 'retired') NOT NULL DEFAULT 'active',
    `emergency_contact` VARCHAR(50) NULL,
    `emergency_phone` VARCHAR(20) NULL,
    `address` VARCHAR(200) NULL,
    `education` VARCHAR(20) NULL,
    `skills` TEXT NULL,
    `remark` TEXT NULL,
    `rating` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_employee_no_key`(`employee_no`),
    UNIQUE INDEX `employees_user_id_key`(`user_id`),
    INDEX `employees_department_id_idx`(`department_id`),
    INDEX `employees_status_idx`(`status`),
    INDEX `employees_department_id_status_idx`(`department_id`, `status`),
    INDEX `employees_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_change_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `field` VARCHAR(50) NOT NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `changed_by` INTEGER NULL,
    `change_type` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_change_logs_employee_id_idx`(`employee_id`),
    INDEX `employee_change_logs_field_idx`(`field`),
    INDEX `employee_change_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_departments` (
    `user_id` INTEGER NOT NULL,
    `department_id` INTEGER NOT NULL,

    PRIMARY KEY (`user_id`, `department_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `start_time` VARCHAR(5) NOT NULL,
    `end_time` VARCHAR(5) NOT NULL,
    `is_next_day` BOOLEAN NOT NULL DEFAULT false,
    `rest_duration` INTEGER NOT NULL DEFAULT 0,
    `late_threshold` INTEGER NOT NULL DEFAULT 0,
    `early_threshold` INTEGER NOT NULL DEFAULT 0,
    `use_global_threshold` BOOLEAN NOT NULL DEFAULT true,
    `color` VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    `is_rest` BOOLEAN NOT NULL DEFAULT false,
    `department_id` INTEGER NULL,
    `description` VARCHAR(200) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shifts_name_key`(`name`),
    INDEX `shifts_department_id_idx`(`department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `shift_id` INTEGER NOT NULL,
    `work_date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `schedules_work_date_idx`(`work_date`),
    UNIQUE INDEX `schedules_employee_id_work_date_key`(`employee_id`, `work_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `punch_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_no` VARCHAR(20) NOT NULL,
    `device_no` VARCHAR(50) NOT NULL,
    `punch_time` DATETIME NOT NULL,
    `punch_type` VARCHAR(10) NULL,
    `source` ENUM('import', 'db', 'api', 'manual') NOT NULL DEFAULT 'import',
    `raw_data` VARCHAR(500) NULL,
    `status` ENUM('pending', 'matched', 'abnormal', 'ignored') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `punch_logs_punch_time_idx`(`punch_time`),
    INDEX `punch_logs_status_idx`(`status`),
    UNIQUE INDEX `punch_logs_employee_no_punch_time_device_no_key`(`employee_no`, `punch_time`, `device_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    `carry_over_max_days` INTEGER NULL,
    `carry_over_ratio` DOUBLE NULL,
    `seniority_rule` JSON NULL,
    `monthly_days` JSON NULL,
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
    `month` INTEGER NOT NULL DEFAULT 0,
    `totalDays` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `usedDays` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vacation_balances_employee_id_year_idx`(`employee_id`, `year`),
    UNIQUE INDEX `vacation_balances_employee_id_vacation_type_id_year_month_key`(`employee_id`, `vacation_type_id`, `year`, `month`),
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
    `month` INTEGER NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('draft', 'pending', 'approving', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `approval_instance_id` INTEGER NULL,
    `approver_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `approval_note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_records_employee_id_idx`(`employee_id`),
    INDEX `leave_records_status_idx`(`status`),
    INDEX `leave_records_approval_instance_id_idx`(`approval_instance_id`),
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
    `status` ENUM('draft', 'pending', 'approving', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
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
    INDEX `overtime_records_approval_instance_id_idx`(`approval_instance_id`),
    INDEX `overtime_records_overtime_date_idx`(`overtime_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `punch_makeups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `punch_date` DATE NOT NULL,
    `punch_type` VARCHAR(20) NOT NULL,
    `original_time` DATETIME(3) NULL,
    `makeup_time` DATETIME(3) NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` ENUM('draft', 'pending', 'approving', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `approval_instance_id` INTEGER NULL,
    `approver_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `approval_note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `punch_makeups_employee_id_idx`(`employee_id`),
    INDEX `punch_makeups_status_idx`(`status`),
    INDEX `punch_makeups_approval_instance_id_idx`(`approval_instance_id`),
    INDEX `punch_makeups_punch_date_idx`(`punch_date`),
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
    `absent_minutes` INTEGER NOT NULL DEFAULT 0,
    `overtime_minutes` INTEGER NOT NULL DEFAULT 0,
    `leave_days` DECIMAL(5, 2) NOT NULL DEFAULT 0,
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
CREATE TABLE `attendance_monthly` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `month` CHAR(7) NOT NULL,
    `work_days` DECIMAL(5, 1) NOT NULL,
    `late_count` INTEGER NOT NULL DEFAULT 0,
    `early_count` INTEGER NOT NULL DEFAULT 0,
    `total_late_minutes` INTEGER NOT NULL DEFAULT 0,
    `total_early_minutes` INTEGER NOT NULL DEFAULT 0,
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
    `checked_employee_ids` JSON NULL,
    `checked_by` INTEGER NULL,
    `checked_at` DATETIME(3) NULL,
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
CREATE TABLE `salary_adjustments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `effective_month` VARCHAR(7) NOT NULL,
    `remark` VARCHAR(255) NULL,
    `changed_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `salary_adjustments_employee_id_effective_month_idx`(`employee_id`, `effective_month`),
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
    `summary` TEXT NULL,
    `content` TEXT NULL,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'published',
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME NULL,

    INDEX `knowledge_articles_category_id_idx`(`category_id`),
    INDEX `knowledge_articles_status_idx`(`status`),
    INDEX `knowledge_articles_deleted_at_idx`(`deleted_at`),
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

    INDEX `operation_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `operation_logs_module_created_at_idx`(`module`, `created_at`),
    INDEX `operation_logs_action_created_at_idx`(`action`, `created_at`),
    INDEX `operation_logs_status_created_at_idx`(`status`, `created_at`),
    INDEX `operation_logs_ip_created_at_idx`(`ip`, `created_at`),
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
    `recipient_type` ENUM('all', 'department', 'user') NOT NULL DEFAULT 'all',
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
    `channels` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    INDEX `notifications_user_id_read_idx`(`user_id`, `read`),
    INDEX `notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_type` VARCHAR(50) NOT NULL,
    `target_roles` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_settings_event_type_key`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_workflows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `module` VARCHAR(50) NOT NULL,
    `status` ENUM('draft', 'active', 'inactive') NOT NULL DEFAULT 'draft',
    `max_resubmits` INTEGER NOT NULL DEFAULT 3,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME NULL,

    UNIQUE INDEX `approval_workflows_code_key`(`code`),
    INDEX `approval_workflows_module_idx`(`module`),
    INDEX `approval_workflows_deleted_at_idx`(`deleted_at`),
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
    `cc_employee_ids` VARCHAR(500) NULL,
    `resubmit_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `approval_instances_applicant_id_idx`(`applicant_id`),
    INDEX `approval_instances_status_idx`(`status`),
    INDEX `approval_instances_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_comment_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `type` ENUM('approve', 'reject') NOT NULL DEFAULT 'approve',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `approval_comment_templates_type_idx`(`type`),
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
CREATE TABLE `expense_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `unit` VARCHAR(50) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `expense_types_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_no` VARCHAR(32) NULL,
    `type_id` INTEGER NOT NULL,
    `type_code` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `applicant_id` INTEGER NOT NULL,
    `applicant_name` VARCHAR(50) NOT NULL,
    `department_id` INTEGER NULL,
    `status` ENUM('draft', 'pending', 'approving', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'draft',
    `approval_instance_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reimbursements_reimbursement_no_key`(`reimbursement_no`),
    INDEX `reimbursements_applicant_id_idx`(`applicant_id`),
    INDEX `reimbursements_status_idx`(`status`),
    INDEX `reimbursements_approval_instance_id_idx`(`approval_instance_id`),
    INDEX `reimbursements_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursement_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_id` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reimbursement_attachments_reimbursement_id_idx`(`reimbursement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursement_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_id` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `item_type` VARCHAR(100) NULL,
    `expense_date` DATE NULL,
    `attachment_url` VARCHAR(500) NULL,
    `description` VARCHAR(500) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reimbursement_items_reimbursement_id_idx`(`reimbursement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursement_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_id` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_date` DATE NULL,
    `status` ENUM('pending', 'paid', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    `pay_method` ENUM('bank', 'cash', 'other') NULL,
    `remark` VARCHAR(500) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paid_at` DATETIME NULL,

    UNIQUE INDEX `reimbursement_payments_reimbursement_id_key`(`reimbursement_id`),
    INDEX `reimbursement_payments_status_idx`(`status`),
    INDEX `reimbursement_payments_created_at_idx`(`created_at`),
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
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `max_retries` INTEGER NOT NULL DEFAULT 3,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `export_tasks_created_by_idx`(`created_by`),
    INDEX `export_tasks_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `gender` VARCHAR(10) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `email` VARCHAR(100) NULL,
    `id_card` VARCHAR(20) NULL,
    `department_id` INTEGER NOT NULL,
    `position_id` INTEGER NULL,
    `hire_date` DATE NOT NULL,
    `probation_months` INTEGER NOT NULL DEFAULT 3,
    `salary` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` ENUM('draft', 'pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'draft',
    `approver_id` INTEGER NULL,
    `approval_instance_id` INTEGER NULL,
    `created_by` INTEGER NOT NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `onboarding_department_id_idx`(`department_id`),
    INDEX `onboarding_status_idx`(`status`),
    INDEX `onboarding_approval_instance_id_idx`(`approval_instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resignations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `resign_date` DATE NOT NULL,
    `status` ENUM('draft', 'pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'draft',
    `approval_instance_id` INTEGER NULL,
    `handover_remark` TEXT NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `resignations_employee_id_idx`(`employee_id`),
    INDEX `resignations_status_idx`(`status`),
    INDEX `resignations_approval_instance_id_idx`(`approval_instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `probations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `probation_start_date` DATE NOT NULL,
    `probation_end_date` DATE NOT NULL,
    `performance` TEXT NULL,
    `status` ENUM('draft', 'pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'draft',
    `approval_instance_id` INTEGER NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `probations_employee_id_idx`(`employee_id`),
    INDEX `probations_status_idx`(`status`),
    INDEX `probations_approval_instance_id_idx`(`approval_instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contracts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `contract_no` VARCHAR(50) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `termination_date` DATE NULL,
    `salary` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `position` VARCHAR(100) NULL,
    `attachment_url` VARCHAR(500) NULL,
    `renewal_count` INTEGER NOT NULL DEFAULT 0,
    `terminated_by` VARCHAR(100) NULL,
    `status` ENUM('active', 'expired', 'terminated', 'draft') NOT NULL DEFAULT 'active',
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contracts_contract_no_key`(`contract_no`),
    INDEX `contracts_employee_id_idx`(`employee_id`),
    INDEX `contracts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_appeals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `appeal_date` DATE NOT NULL,
    `appeal_type` VARCHAR(30) NOT NULL,
    `original_status` VARCHAR(30) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` ENUM('draft', 'pending', 'approving', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'draft',
    `approval_instance_id` INTEGER NULL,
    `handled_by` INTEGER NULL,
    `handled_at` DATETIME(3) NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_appeals_employee_id_idx`(`employee_id`),
    INDEX `attendance_appeals_status_idx`(`status`),
    INDEX `attendance_appeals_appeal_date_idx`(`appeal_date`),
    INDEX `attendance_appeals_approval_instance_id_idx`(`approval_instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_certificates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `issuer` VARCHAR(100) NULL,
    `issue_date` DATE NULL,
    `expire_date` DATE NULL,
    `cert_no` VARCHAR(50) NULL,
    `level` VARCHAR(30) NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_certificates_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `type` ENUM('employment', 'income', 'resignation', 'other') NOT NULL,
    `purpose` VARCHAR(200) NOT NULL,
    `remark` TEXT NULL,
    `status` ENUM('draft', 'pending', 'approved', 'rejected', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
    `approval_instance_id` INTEGER NULL,
    `handled_by` INTEGER NULL,
    `delivered_at` DATETIME NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `certificate_requests_employee_id_idx`(`employee_id`),
    INDEX `certificate_requests_type_idx`(`type`),
    INDEX `certificate_requests_status_idx`(`status`),
    INDEX `certificate_requests_approval_instance_id_idx`(`approval_instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_rewards` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `type` ENUM('reward', 'punishment') NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `amount` DECIMAL(10, 2) NULL,
    `reward_date` DATE NOT NULL,
    `status` ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'draft',
    `approval_instance_id` INTEGER NULL,
    `handled_by` INTEGER NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_rewards_employee_id_idx`(`employee_id`),
    INDEX `employee_rewards_type_idx`(`type`),
    INDEX `employee_rewards_status_idx`(`status`),
    INDEX `employee_rewards_approval_instance_id_idx`(`approval_instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `category` VARCHAR(50) NULL,
    `trainer` VARCHAR(50) NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `hours` INTEGER NULL,
    `score` VARCHAR(20) NULL,
    `certificate` BOOLEAN NOT NULL DEFAULT false,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `training_records_employee_id_idx`(`employee_id`),
    INDEX `training_records_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recruitment_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `department_id` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `cost_date` DATE NOT NULL,
    `category` VARCHAR(50) NULL,
    `description` VARCHAR(500) NULL,
    `remark` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `recruitment_costs_department_id_idx`(`department_id`),
    INDEX `recruitment_costs_cost_date_idx`(`cost_date`),
    INDEX `recruitment_costs_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `department_id` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `cost_date` DATE NOT NULL,
    `category` VARCHAR(50) NULL,
    `description` VARCHAR(500) NULL,
    `remark` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `training_costs_department_id_idx`(`department_id`),
    INDEX `training_costs_cost_date_idx`(`cost_date`),
    INDEX `training_costs_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `type` ENUM('transfer', 'promotion', 'demotion', 'salary_adjust') NOT NULL,
    `from_department_id` INTEGER NULL,
    `to_department_id` INTEGER NULL,
    `from_position_id` INTEGER NULL,
    `to_position_id` INTEGER NULL,
    `from_salary` DECIMAL(10, 2) NULL,
    `to_salary` DECIMAL(10, 2) NULL,
    `effective_date` DATE NOT NULL,
    `reason` VARCHAR(500) NULL,
    `status` ENUM('draft', 'pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'draft',
    `approval_instance_id` INTEGER NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_transfers_employee_id_idx`(`employee_id`),
    INDEX `employee_transfers_type_idx`(`type`),
    INDEX `employee_transfers_status_idx`(`status`),
    INDEX `employee_transfers_approval_instance_id_idx`(`approval_instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sequences` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `current_value` INTEGER NOT NULL DEFAULT 0,
    `step` INTEGER NOT NULL DEFAULT 1,
    `description` VARCHAR(200) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sequences_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_cycles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `self_review_deadline` DATE NULL,
    `manager_review_deadline` DATE NULL,
    `calibration_deadline` DATE NULL,
    `status` ENUM('draft', 'active', 'closed') NOT NULL DEFAULT 'draft',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_cycles_status_idx`(`status`),
    INDEX `performance_cycles_start_date_idx`(`start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_goals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cycle_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `weight` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `target_value` VARCHAR(200) NULL,
    `actual_value` VARCHAR(200) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `due_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_goals_cycle_id_idx`(`cycle_id`),
    INDEX `performance_goals_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cycle_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `reviewer_id` INTEGER NULL,
    `self_score` DECIMAL(5, 2) NULL,
    `manager_score` DECIMAL(5, 2) NULL,
    `final_score` DECIMAL(5, 2) NULL,
    `rating` VARCHAR(20) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `self_comment` TEXT NULL,
    `manager_comment` TEXT NULL,
    `development_plan` TEXT NULL,
    `promotion_recommendation` BOOLEAN NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_reviews_cycle_id_idx`(`cycle_id`),
    INDEX `performance_reviews_employee_id_idx`(`employee_id`),
    INDEX `performance_reviews_reviewer_id_idx`(`reviewer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `okr_objectives` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'personal',
    `period` VARCHAR(50) NOT NULL,
    `owner_id` INTEGER NULL,
    `department_id` INTEGER NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `okr_objectives_type_idx`(`type`),
    INDEX `okr_objectives_owner_id_idx`(`owner_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `okr_key_results` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `objective_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `initial_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `target_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `current_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `unit` VARCHAR(20) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `okr_key_results_objective_id_idx`(`objective_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_exception_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `department_id` INTEGER NULL,
    `threshold` INTEGER NOT NULL DEFAULT 0,
    `threshold_max` INTEGER NULL,
    `auto_resolve` BOOLEAN NOT NULL DEFAULT false,
    `auto_resolve_type` VARCHAR(20) NULL,
    `deduct_minutes` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'enabled',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_exception_rules_type_idx`(`type`),
    INDEX `attendance_exception_rules_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_exceptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `work_date` DATE NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `resolve_type` VARCHAR(20) NULL,
    `deduct_minutes` INTEGER NULL,
    `handled_by` INTEGER NULL,
    `handled_at` DATETIME(3) NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_exceptions_employee_id_idx`(`employee_id`),
    INDEX `attendance_exceptions_work_date_idx`(`work_date`),
    INDEX `attendance_exceptions_type_idx`(`type`),
    INDEX `attendance_exceptions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deduction_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `method` VARCHAR(20) NOT NULL,
    `amount` DECIMAL(10, 2) NULL,
    `percentage` DECIMAL(5, 2) NULL,
    `multiplier` DECIMAL(5, 2) NULL,
    `leave_type` VARCHAR(20) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `deduction_rules_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `department_id` INTEGER NULL,
    `category` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `used_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `budgets_year_idx`(`year`),
    INDEX `budgets_department_id_idx`(`department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_standards` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(20) NULL,
    `description` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'enabled',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `expense_standards_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `helpdesk_slas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `priority` VARCHAR(20) NOT NULL,
    `first_response_minutes` INTEGER NOT NULL DEFAULT 60,
    `resolution_minutes` INTEGER NOT NULL DEFAULT 480,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `helpdesk_slas_priority_idx`(`priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `helpdesk_tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticket_no` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(50) NULL,
    `priority` VARCHAR(20) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(20) NOT NULL DEFAULT 'open',
    `requester_id` INTEGER NULL,
    `assignee_id` INTEGER NULL,
    `sla_id` INTEGER NULL,
    `due_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `helpdesk_tickets_status_idx`(`status`),
    INDEX `helpdesk_tickets_requester_id_idx`(`requester_id`),
    INDEX `helpdesk_tickets_assignee_id_idx`(`assignee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `color` VARCHAR(20) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_tag_relations` (
    `employeeId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    PRIMARY KEY (`employeeId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `address` VARCHAR(255) NULL,
    `latitude` DECIMAL(10, 6) NOT NULL,
    `longitude` DECIMAL(10, 6) NOT NULL,
    `radius` INTEGER NOT NULL DEFAULT 100,
    `work_type` VARCHAR(20) NOT NULL DEFAULT 'office',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_workflows` ADD CONSTRAINT `role_workflows_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_workflows` ADD CONSTRAINT `role_workflows_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dict_item` ADD CONSTRAINT `dict_item_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `dict_type`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_change_logs` ADD CONSTRAINT `employee_change_logs_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_departments` ADD CONSTRAINT `user_departments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_departments` ADD CONSTRAINT `user_departments_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `punch_makeups` ADD CONSTRAINT `punch_makeups_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `salary_adjustments` ADD CONSTRAINT `salary_adjustments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `broadcast_reads` ADD CONSTRAINT `broadcast_reads_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_recipients` ADD CONSTRAINT `broadcast_recipients_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_recipients` ADD CONSTRAINT `broadcast_recipients_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_group_members` ADD CONSTRAINT `approval_group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `approval_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `reimbursement_attachments` ADD CONSTRAINT `reimbursement_attachments_reimbursement_id_fkey` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursement_items` ADD CONSTRAINT `reimbursement_items_reimbursement_id_fkey` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursement_payments` ADD CONSTRAINT `reimbursement_payments_reimbursement_id_fkey` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resignations` ADD CONSTRAINT `resignations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `probations` ADD CONSTRAINT `probations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_appeals` ADD CONSTRAINT `attendance_appeals_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_certificates` ADD CONSTRAINT `employee_certificates_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate_requests` ADD CONSTRAINT `certificate_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_rewards` ADD CONSTRAINT `employee_rewards_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_records` ADD CONSTRAINT `training_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruitment_costs` ADD CONSTRAINT `recruitment_costs_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_costs` ADD CONSTRAINT `training_costs_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_transfers` ADD CONSTRAINT `employee_transfers_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_goals` ADD CONSTRAINT `performance_goals_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `performance_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `performance_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `okr_key_results` ADD CONSTRAINT `okr_key_results_objective_id_fkey` FOREIGN KEY (`objective_id`) REFERENCES `okr_objectives`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_tag_relations` ADD CONSTRAINT `employee_tag_relations_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_tag_relations` ADD CONSTRAINT `employee_tag_relations_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `employee_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 第二部分：种子数据
-- 来源：历史迁移 20260813213000_add_system_setting（该迁移同时建表 + 写入默认参数与权限）
-- 说明：这是数据而非结构，无法由 schema.prisma 表达，故随基线一起保留。
--       既有数据库打基线标记时不会执行本段（其数据由历史上的 db push + seed 流程写入）。
-- ============================================================

-- 默认系统参数
INSERT INTO `system_setting` (`group`, `key`, `value`, `label`, `description`, `is_public`, `updated_at`) VALUES
  ('general', 'companyName', '雷犀科技', '公司名称', NULL, 0, NOW()),
  ('general', 'companyLogo', '', '公司Logo地址', NULL, 1, NOW()),
  ('attendance', 'workTimeStart', '09:00', '上班时间', NULL, 1, NOW()),
  ('attendance', 'workTimeEnd', '18:00', '下班时间', NULL, 1, NOW()),
  ('security', 'passwordMinLength', '8', '密码最小长度', NULL, 0, NOW()),
  ('security', 'loginFailMax', '5', '登录失败上限(次)', NULL, 0, NOW()),
  ('security', 'jwtExpiresIn', '2h', '登录Token有效期', NULL, 0, NOW());

-- 设置管理权限 + 绑定 admin 角色（幂等：仅当 admin 角色存在时绑定，避免依赖硬编码 role_id）
INSERT INTO `permissions` (`code`, `name`, `module`, `type`) VALUES
  ('system:setting:update', '系统设置管理', 'system', 'api');
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
  SELECT r.`id`, LAST_INSERT_ID() FROM `roles` r WHERE r.`code` = 'admin' LIMIT 1;


