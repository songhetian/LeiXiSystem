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
    `position_id` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `is_department_manager` BOOLEAN NOT NULL DEFAULT false,
    `last_login` DATETIME(3) NULL,
    `session_token` VARCHAR(500) NULL,
    `session_created_at` DATETIME(3) NULL,
    `session_version` INTEGER NOT NULL DEFAULT 1,
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `login_locked_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_department_id_status_idx`(`department_id`, `status`),
    INDEX `users_status_idx`(`status`),
    INDEX `users_login_locked_until_idx`(`login_locked_until`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_passwords` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT true,
    `last_changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `failed_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payslip_passwords_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_no` VARCHAR(20) NOT NULL,
    `hire_date` DATETIME(3) NOT NULL,
    `salary` DECIMAL(10, 2) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `emergency_contact` VARCHAR(50) NULL,
    `emergency_phone` VARCHAR(20) NULL,
    `address` VARCHAR(200) NULL,
    `education` VARCHAR(20) NULL,
    `skills` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `rating` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_user_id_key`(`user_id`),
    UNIQUE INDEX `employees_employee_no_key`(`employee_no`),
    INDEX `employees_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `parent_id` INTEGER NULL,
    `description` VARCHAR(191) NULL,
    `manager_id` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `positions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `department_id` INTEGER NOT NULL,
    `description` VARCHAR(191) NULL,
    `requirements` VARCHAR(191) NULL,
    `responsibilities` VARCHAR(191) NULL,
    `salary_min` DECIMAL(10, 2) NULL,
    `salary_max` DECIMAL(10, 2) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(191) NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `can_view_all_departments` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_data_scopes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `scope_type` VARCHAR(50) NOT NULL DEFAULT 'self',
    `department_ids` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `role_data_scopes_role_id_key`(`role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `resource` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `description` VARCHAR(191) NULL,
    `module` VARCHAR(50) NOT NULL,
    `parent_id` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `department_id` INTEGER NULL,
    `start_time` VARCHAR(10) NOT NULL,
    `end_time` VARCHAR(10) NOT NULL,
    `work_hours` DECIMAL(4, 2) NOT NULL,
    `is_flexible` BOOLEAN NOT NULL DEFAULT false,
    `is_cross_day` BOOLEAN NOT NULL DEFAULT false,
    `begin_checkin_minutes` INTEGER NOT NULL DEFAULT 60,
    `allow_checkout_minutes` INTEGER NOT NULL DEFAULT 60,
    `late_grace_minutes` INTEGER NOT NULL DEFAULT 0,
    `early_grace_minutes` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(20) NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shifts_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `shift_id` INTEGER NOT NULL,
    `schedule_date` DATE NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'normal',
    `note` VARCHAR(191) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `schedules_schedule_date_user_id_idx`(`schedule_date`, `user_id`),
    INDEX `schedules_schedule_date_shift_id_idx`(`schedule_date`, `shift_id`),
    INDEX `schedules_employee_id_schedule_date_idx`(`employee_id`, `schedule_date`),
    UNIQUE INDEX `schedules_user_id_schedule_date_key`(`user_id`, `schedule_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `shift_id` INTEGER NULL,
    `check_in` DATETIME(3) NULL,
    `check_out` DATETIME(3) NULL,
    `work_hours` DECIMAL(4, 2) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'normal',
    `late_minutes` INTEGER NOT NULL DEFAULT 0,
    `early_minutes` INTEGER NOT NULL DEFAULT 0,
    `location_in` VARCHAR(100) NULL,
    `location_out` VARCHAR(100) NULL,
    `remark` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_records_date_status_idx`(`date`, `status`),
    INDEX `attendance_records_user_id_date_idx`(`user_id`, `date`),
    INDEX `attendance_records_employee_id_date_idx`(`employee_id`, `date`),
    UNIQUE INDEX `attendance_records_user_id_date_key`(`user_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_checkins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `employee_id` INTEGER NOT NULL,
    `device_id` VARCHAR(100) NULL,
    `source` VARCHAR(30) NOT NULL DEFAULT 'web',
    `log_type` VARCHAR(20) NOT NULL DEFAULT 'unknown',
    `check_time` DATETIME(3) NOT NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `address` VARCHAR(255) NULL,
    `ip_address` VARCHAR(50) NULL,
    `photo_url` VARCHAR(500) NULL,
    `raw_payload` JSON NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_checkins_employee_id_check_time_idx`(`employee_id`, `check_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_daily` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `shift_id` INTEGER NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'normal',
    `first_in` DATETIME(3) NULL,
    `last_out` DATETIME(3) NULL,
    `work_minutes` INTEGER NOT NULL DEFAULT 0,
    `late_minutes` INTEGER NOT NULL DEFAULT 0,
    `early_minutes` INTEGER NOT NULL DEFAULT 0,
    `absent_minutes` INTEGER NOT NULL DEFAULT 0,
    `overtime_minutes` INTEGER NOT NULL DEFAULT 0,
    `checkin_snapshot` JSON NULL,
    `rule_snapshot` JSON NULL,
    `calculation_version` VARCHAR(50) NULL,
    `locked_at` DATETIME(3) NULL,
    `locked_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_daily_date_status_idx`(`date`, `status`),
    INDEX `attendance_daily_user_id_date_idx`(`user_id`, `date`),
    UNIQUE INDEX `attendance_daily_employee_id_date_key`(`employee_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_monthly` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `expected_work_days` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `actual_work_days` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `paid_leave_days` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `unpaid_leave_days` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `absent_days` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `late_count` INTEGER NOT NULL DEFAULT 0,
    `early_count` INTEGER NOT NULL DEFAULT 0,
    `missing_checkin_count` INTEGER NOT NULL DEFAULT 0,
    `overtime_minutes` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
    `locked_at` DATETIME(3) NULL,
    `locked_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_monthly_year_month_status_idx`(`year`, `month`, `status`),
    INDEX `attendance_monthly_user_id_year_month_idx`(`user_id`, `year`, `month`),
    UNIQUE INDEX `attendance_monthly_employee_id_year_month_key`(`employee_id`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_exceptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `related_ids` JSON NULL,
    `reason` VARCHAR(191) NULL,
    `approval_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_exceptions_employee_id_date_idx`(`employee_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_correction_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `log_type` VARCHAR(20) NOT NULL,
    `check_time` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `approver_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `opinion` VARCHAR(191) NULL,
    `checkin_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_correction_requests_employee_id_date_idx`(`employee_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `leave_type` VARCHAR(50) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `days` DECIMAL(4, 1) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `current_step` INTEGER NOT NULL DEFAULT 0,
    `workflow_id` INTEGER NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_requests_employee_id_status_start_date_idx`(`employee_id`, `status`, `start_date`),
    INDEX `leave_requests_user_id_status_start_date_idx`(`user_id`, `status`, `start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `overtime_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `overtime_type` VARCHAR(50) NOT NULL,
    `date` DATE NOT NULL,
    `start_time` VARCHAR(10) NOT NULL,
    `end_time` VARCHAR(10) NOT NULL,
    `hours` DECIMAL(4, 1) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `current_step` INTEGER NOT NULL DEFAULT 0,
    `workflow_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `overtime_requests_employee_id_status_date_idx`(`employee_id`, `status`, `date`),
    INDEX `overtime_requests_user_id_status_date_idx`(`user_id`, `status`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `expense_date` DATE NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `current_step` INTEGER NOT NULL DEFAULT 0,
    `workflow_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reimbursements_employee_id_status_expense_date_idx`(`employee_id`, `status`, `expense_date`),
    INDEX `reimbursements_user_id_status_expense_date_idx`(`user_id`, `status`, `expense_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_workflows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(50) NOT NULL DEFAULT 'leave',
    `description` VARCHAR(191) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `conditions` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_nodes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workflow_id` INTEGER NOT NULL,
    `node_order` INTEGER NOT NULL DEFAULT 1,
    `node_name` VARCHAR(100) NOT NULL,
    `approver_type` VARCHAR(50) NOT NULL,
    `approver_id` INTEGER NULL,
    `role_id` INTEGER NULL,
    `approval_mode` VARCHAR(20) NOT NULL DEFAULT 'serial',
    `can_skip` BOOLEAN NOT NULL DEFAULT false,
    `skip_conditions` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_approval_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leave_id` INTEGER NOT NULL,
    `node_id` INTEGER NULL,
    `node_order` INTEGER NOT NULL,
    `approver_id` INTEGER NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `opinion` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursement_approvals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_id` INTEGER NOT NULL,
    `node_id` INTEGER NULL,
    `node_order` INTEGER NOT NULL,
    `approver_id` INTEGER NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `opinion` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `total_days` DECIMAL(5, 1) NOT NULL DEFAULT 0,
    `unit` VARCHAR(10) NOT NULL DEFAULT 'day',
    `is_carry_over` BOOLEAN NOT NULL DEFAULT false,
    `carry_over_days` DECIMAL(5, 1) NOT NULL DEFAULT 0,
    `is_paid` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `description` VARCHAR(191) NULL,
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
    `total` DECIMAL(5, 1) NOT NULL,
    `used` DECIMAL(5, 1) NOT NULL DEFAULT 0,
    `balance` DECIMAL(5, 1) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vacation_balances_employee_id_vacation_type_id_year_key`(`employee_id`, `vacation_type_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_changes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `change_type` VARCHAR(50) NOT NULL,
    `old_value` JSON NULL,
    `new_value` JSON NULL,
    `reason` VARCHAR(191) NULL,
    `effective_date` DATE NOT NULL,
    `operator_id` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'completed',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_lifecycle_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `description` VARCHAR(191) NULL,
    `effective_date` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_lifecycle_events_employee_id_effective_date_idx`(`employee_id`, `effective_date`),
    INDEX `employee_lifecycle_events_event_type_status_idx`(`event_type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `description` VARCHAR(191) NULL,
    `due_date` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `assigned_to` INTEGER NULL,
    `created_by` INTEGER NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `onboarding_tasks_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `onboarding_tasks_assigned_to_status_idx`(`assigned_to`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offboarding_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `description` VARCHAR(191) NULL,
    `due_date` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `assigned_to` INTEGER NULL,
    `created_by` INTEGER NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `offboarding_tasks_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `offboarding_tasks_assigned_to_status_idx`(`assigned_to`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `document_type` VARCHAR(50) NOT NULL,
    `file_url` VARCHAR(500) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `expires_at` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_documents_employee_id_document_type_idx`(`employee_id`, `document_type`),
    INDEX `employee_documents_status_expires_at_idx`(`status`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_contracts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `contract_no` VARCHAR(100) NOT NULL,
    `contract_type` VARCHAR(50) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `file_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_contracts_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `employee_contracts_end_date_idx`(`end_date`),
    UNIQUE INDEX `employee_contracts_contract_no_key`(`contract_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asset_categories_code_key`(`code`),
    INDEX `asset_categories_status_sort_order_idx`(`status`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_no` VARCHAR(100) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `category_id` INTEGER NOT NULL,
    `brand` VARCHAR(100) NULL,
    `model` VARCHAR(100) NULL,
    `serial_no` VARCHAR(100) NULL,
    `purchase_date` DATE NULL,
    `purchase_amount` DECIMAL(10, 2) NULL,
    `location` VARCHAR(100) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'idle',
    `current_employee_id` INTEGER NULL,
    `remark` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asset_items_asset_no_key`(`asset_no`),
    INDEX `asset_items_category_id_status_idx`(`category_id`, `status`),
    INDEX `asset_items_current_employee_id_status_idx`(`current_employee_id`, `status`),
    INDEX `asset_items_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `action` VARCHAR(30) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `returned_at` DATETIME(3) NULL,
    `operator_id` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `asset_assignments_asset_id_assigned_at_idx`(`asset_id`, `assigned_at`),
    INDEX `asset_assignments_employee_id_assigned_at_idx`(`employee_id`, `assigned_at`),
    INDEX `asset_assignments_action_assigned_at_idx`(`action`, `assigned_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `helpdesk_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `helpdesk_categories_code_key`(`code`),
    INDEX `helpdesk_categories_status_sort_order_idx`(`status`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `helpdesk_tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticket_no` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` VARCHAR(191) NULL,
    `category_id` INTEGER NOT NULL,
    `priority` VARCHAR(30) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(30) NOT NULL DEFAULT 'open',
    `created_by` INTEGER NOT NULL,
    `assigned_to` INTEGER NULL,
    `employee_id` INTEGER NULL,
    `source_type` VARCHAR(50) NULL,
    `source_id` INTEGER NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `helpdesk_tickets_ticket_no_key`(`ticket_no`),
    INDEX `helpdesk_tickets_created_by_status_idx`(`created_by`, `status`),
    INDEX `helpdesk_tickets_assigned_to_status_idx`(`assigned_to`, `status`),
    INDEX `helpdesk_tickets_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `helpdesk_tickets_category_id_status_idx`(`category_id`, `status`),
    INDEX `helpdesk_tickets_priority_status_idx`(`priority`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `helpdesk_ticket_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticket_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `helpdesk_ticket_comments_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recruitment_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `department_id` INTEGER NOT NULL,
    `position_id` INTEGER NULL,
    `headcount` INTEGER NOT NULL DEFAULT 1,
    `reason` VARCHAR(191) NULL,
    `priority` VARCHAR(30) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
    `created_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `recruitment_requests_department_id_status_idx`(`department_id`, `status`),
    INDEX `recruitment_requests_status_priority_idx`(`status`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_openings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NULL,
    `title` VARCHAR(200) NOT NULL,
    `department_id` INTEGER NOT NULL,
    `position_id` INTEGER NULL,
    `headcount` INTEGER NOT NULL DEFAULT 1,
    `description` VARCHAR(191) NULL,
    `requirements` VARCHAR(191) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'open',
    `published_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_openings_department_id_status_idx`(`department_id`, `status`),
    INDEX `job_openings_request_id_status_idx`(`request_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_opening_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(100) NULL,
    `source` VARCHAR(50) NULL,
    `resume_url` VARCHAR(500) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'new',
    `rating` INTEGER NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `candidates_job_opening_id_status_idx`(`job_opening_id`, `status`),
    INDEX `candidates_phone_idx`(`phone`),
    INDEX `candidates_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_rounds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `candidate_id` INTEGER NOT NULL,
    `round_name` VARCHAR(100) NOT NULL,
    `interview_at` DATETIME(3) NULL,
    `interviewer_id` INTEGER NULL,
    `result` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `feedback` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `interview_rounds_candidate_id_result_idx`(`candidate_id`, `result`),
    INDEX `interview_rounds_interviewer_id_interview_at_idx`(`interviewer_id`, `interview_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `candidate_id` INTEGER NOT NULL,
    `offer_no` VARCHAR(50) NOT NULL,
    `salary` DECIMAL(10, 2) NULL,
    `start_date` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
    `created_by` INTEGER NULL,
    `accepted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offers_offer_no_key`(`offer_no`),
    INDEX `offers_candidate_id_status_idx`(`candidate_id`, `status`),
    INDEX `offers_status_start_date_idx`(`status`, `start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_cycles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `cycle_type` VARCHAR(30) NOT NULL DEFAULT 'quarter',
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_cycles_status_start_date_idx`(`status`, `start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_goals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cycle_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` VARCHAR(191) NULL,
    `metric` VARCHAR(200) NULL,
    `target_value` DECIMAL(10, 2) NULL,
    `weight` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `progress` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_goals_cycle_id_employee_id_idx`(`cycle_id`, `employee_id`),
    INDEX `performance_goals_employee_id_status_idx`(`employee_id`, `status`),
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
    `rating` VARCHAR(30) NULL,
    `self_comment` VARCHAR(191) NULL,
    `manager_comment` VARCHAR(191) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
    `created_by` INTEGER NULL,
    `submitted_at` DATETIME(3) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_reviews_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `performance_reviews_reviewer_id_status_idx`(`reviewer_id`, `status`),
    UNIQUE INDEX `performance_reviews_cycle_id_employee_id_key`(`cycle_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_review_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `review_id` INTEGER NOT NULL,
    `dimension` VARCHAR(100) NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,
    `comment` VARCHAR(191) NULL,
    `weight` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `performance_review_items_review_id_idx`(`review_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_courses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `category` VARCHAR(50) NULL,
    `description` VARCHAR(191) NULL,
    `duration_hours` DECIMAL(6, 2) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `training_courses_code_key`(`code`),
    INDEX `training_courses_status_category_idx`(`status`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NULL,
    `location` VARCHAR(200) NULL,
    `capacity` INTEGER NULL,
    `instructor_id` INTEGER NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'planned',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `training_sessions_course_id_status_idx`(`course_id`, `status`),
    INDEX `training_sessions_start_time_status_idx`(`start_time`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_enrollments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'enrolled',
    `score` DECIMAL(5, 2) NULL,
    `certificate_url` VARCHAR(500) NULL,
    `enrolled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `training_enrollments_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `training_enrollments_session_id_status_idx`(`session_id`, `status`),
    UNIQUE INDEX `training_enrollments_session_id_employee_id_key`(`session_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` VARCHAR(191) NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'system',
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `related_id` INTEGER NULL,
    `related_type` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sso_apps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `app_url` VARCHAR(500) NOT NULL,
    `logo_url` VARCHAR(500) NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sso_apps_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `amount_type` VARCHAR(30) NOT NULL DEFAULT 'fixed',
    `formula` VARCHAR(191) NULL,
    `taxable` BOOLEAN NOT NULL DEFAULT false,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `salary_components_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_structures` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `payroll_frequency` VARCHAR(30) NOT NULL DEFAULT 'monthly',
    `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_structure_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salary_structure_id` INTEGER NOT NULL,
    `component_id` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NULL,
    `formula` VARCHAR(191) NULL,
    `condition` VARCHAR(191) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `salary_structure_id` INTEGER NOT NULL,
    `base_salary` DECIMAL(12, 2) NOT NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `salary_assignments_employee_id_effective_from_idx`(`employee_id`, `effective_from`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_periods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'open',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payroll_periods_year_month_key`(`year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_runs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payroll_period_id` INTEGER NOT NULL,
    `scope_type` VARCHAR(30) NOT NULL DEFAULT 'all',
    `scope_value` JSON NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
    `created_by` INTEGER NOT NULL,
    `approved_by` INTEGER NULL,
    `locked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payroll_runs_payroll_period_id_status_idx`(`payroll_period_id`, `status`),
    INDEX `payroll_runs_created_by_status_idx`(`created_by`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payroll_run_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `gross_pay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_deduction` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `net_pay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `expected_work_days` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `paid_days` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `absent_days` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `unpaid_leave_days` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `overtime_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
    `attendance_snapshot` JSON NULL,
    `formula_snapshot` JSON NULL,
    `published_at` DATETIME(3) NULL,
    `viewed_at` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payslips_user_id_status_idx`(`user_id`, `status`),
    INDEX `payslips_employee_id_payroll_run_id_idx`(`employee_id`, `payroll_run_id`),
    INDEX `payslips_payroll_run_id_status_idx`(`payroll_run_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_adjustments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `component_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `created_by` INTEGER NOT NULL,
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `approval_opinion` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payroll_adjustments_employee_id_year_month_status_idx`(`employee_id`, `year`, `month`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_disputes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payslip_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `handler_id` INTEGER NULL,
    `handler_reply` VARCHAR(191) NULL,
    `handled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payslip_disputes_payslip_id_status_idx`(`payslip_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payslip_id` INTEGER NOT NULL,
    `component_id` INTEGER NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `formula_snapshot` VARCHAR(191) NULL,
    `source_type` VARCHAR(50) NULL,
    `source_id` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `username` VARCHAR(50) NULL,
    `action` VARCHAR(100) NOT NULL,
    `module` VARCHAR(50) NOT NULL,
    `ip_address` VARCHAR(50) NULL,
    `user_agent` VARCHAR(500) NULL,
    `request_id` VARCHAR(100) NULL,
    `request_data` JSON NULL,
    `response_data` JSON NULL,
    `before_data` JSON NULL,
    `after_data` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'success',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_logs_created_at_idx`(`created_at`),
    INDEX `system_logs_module_created_at_idx`(`module`, `created_at`),
    INDEX `system_logs_username_created_at_idx`(`username`, `created_at`),
    INDEX `system_logs_status_created_at_idx`(`status`, `created_at`),
    INDEX `system_logs_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_passwords` ADD CONSTRAINT `payslip_passwords_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `positions` ADD CONSTRAINT `positions_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_data_scopes` ADD CONSTRAINT `role_data_scopes_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permissions` ADD CONSTRAINT `permissions_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `permissions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_checkins` ADD CONSTRAINT `attendance_checkins_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_checkins` ADD CONSTRAINT `attendance_checkins_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_daily` ADD CONSTRAINT `attendance_daily_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_daily` ADD CONSTRAINT `attendance_daily_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_daily` ADD CONSTRAINT `attendance_daily_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_monthly` ADD CONSTRAINT `attendance_monthly_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_monthly` ADD CONSTRAINT `attendance_monthly_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_exceptions` ADD CONSTRAINT `attendance_exceptions_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_correction_requests` ADD CONSTRAINT `attendance_correction_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_correction_requests` ADD CONSTRAINT `attendance_correction_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `overtime_requests` ADD CONSTRAINT `overtime_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `overtime_requests` ADD CONSTRAINT `overtime_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursements` ADD CONSTRAINT `reimbursements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursements` ADD CONSTRAINT `reimbursements_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_nodes` ADD CONSTRAINT `approval_nodes_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_approval_records` ADD CONSTRAINT `leave_approval_records_leave_id_fkey` FOREIGN KEY (`leave_id`) REFERENCES `leave_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursement_approvals` ADD CONSTRAINT `reimbursement_approvals_reimbursement_id_fkey` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vacation_balances` ADD CONSTRAINT `vacation_balances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vacation_balances` ADD CONSTRAINT `vacation_balances_vacation_type_id_fkey` FOREIGN KEY (`vacation_type_id`) REFERENCES `vacation_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_changes` ADD CONSTRAINT `employee_changes_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_lifecycle_events` ADD CONSTRAINT `employee_lifecycle_events_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_lifecycle_events` ADD CONSTRAINT `employee_lifecycle_events_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_tasks` ADD CONSTRAINT `onboarding_tasks_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_tasks` ADD CONSTRAINT `onboarding_tasks_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_tasks` ADD CONSTRAINT `onboarding_tasks_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offboarding_tasks` ADD CONSTRAINT `offboarding_tasks_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offboarding_tasks` ADD CONSTRAINT `offboarding_tasks_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offboarding_tasks` ADD CONSTRAINT `offboarding_tasks_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_items` ADD CONSTRAINT `asset_items_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_items` ADD CONSTRAINT `asset_items_current_employee_id_fkey` FOREIGN KEY (`current_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `asset_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `helpdesk_tickets` ADD CONSTRAINT `helpdesk_tickets_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `helpdesk_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `helpdesk_tickets` ADD CONSTRAINT `helpdesk_tickets_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `helpdesk_tickets` ADD CONSTRAINT `helpdesk_tickets_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `helpdesk_tickets` ADD CONSTRAINT `helpdesk_tickets_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `helpdesk_ticket_comments` ADD CONSTRAINT `helpdesk_ticket_comments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `helpdesk_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `helpdesk_ticket_comments` ADD CONSTRAINT `helpdesk_ticket_comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruitment_requests` ADD CONSTRAINT `recruitment_requests_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruitment_requests` ADD CONSTRAINT `recruitment_requests_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruitment_requests` ADD CONSTRAINT `recruitment_requests_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_openings` ADD CONSTRAINT `job_openings_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `recruitment_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_openings` ADD CONSTRAINT `job_openings_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_openings` ADD CONSTRAINT `job_openings_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_openings` ADD CONSTRAINT `job_openings_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidates` ADD CONSTRAINT `candidates_job_opening_id_fkey` FOREIGN KEY (`job_opening_id`) REFERENCES `job_openings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidates` ADD CONSTRAINT `candidates_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_rounds` ADD CONSTRAINT `interview_rounds_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_rounds` ADD CONSTRAINT `interview_rounds_interviewer_id_fkey` FOREIGN KEY (`interviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_cycles` ADD CONSTRAINT `performance_cycles_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_goals` ADD CONSTRAINT `performance_goals_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `performance_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_goals` ADD CONSTRAINT `performance_goals_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_goals` ADD CONSTRAINT `performance_goals_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `performance_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_review_items` ADD CONSTRAINT `performance_review_items_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `performance_reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_courses` ADD CONSTRAINT `training_courses_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_sessions` ADD CONSTRAINT `training_sessions_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `training_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_sessions` ADD CONSTRAINT `training_sessions_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_sessions` ADD CONSTRAINT `training_sessions_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_enrollments` ADD CONSTRAINT `training_enrollments_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `training_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_enrollments` ADD CONSTRAINT `training_enrollments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_structure_items` ADD CONSTRAINT `salary_structure_items_salary_structure_id_fkey` FOREIGN KEY (`salary_structure_id`) REFERENCES `salary_structures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_structure_items` ADD CONSTRAINT `salary_structure_items_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_assignments` ADD CONSTRAINT `salary_assignments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_assignments` ADD CONSTRAINT `salary_assignments_salary_structure_id_fkey` FOREIGN KEY (`salary_structure_id`) REFERENCES `salary_structures`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_payroll_period_id_fkey` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_payroll_run_id_fkey` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_disputes` ADD CONSTRAINT `payslip_disputes_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_disputes` ADD CONSTRAINT `payslip_disputes_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_disputes` ADD CONSTRAINT `payslip_disputes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_disputes` ADD CONSTRAINT `payslip_disputes_handler_id_fkey` FOREIGN KEY (`handler_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_items` ADD CONSTRAINT `payslip_items_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_items` ADD CONSTRAINT `payslip_items_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

