-- Auto-generated from server/prisma/schema.prisma.
-- Run `npm run schema:generate-sql` after database structure changes.
-- Keep permission seed/data migration SQL in the preserved manual block at the bottom.

-- CreateTable
CREATE TABLE `answer_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `result_id` INTEGER NOT NULL,
    `question_id` VARCHAR(255) NOT NULL,
    `user_answer` TEXT NULL,
    `is_correct` BOOLEAN NULL,
    `score` DECIMAL(5, 2) NULL,
    `time_spent` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_is_correct`(`is_correct`),
    INDEX `idx_question_id`(`question_id`),
    INDEX `idx_result_id`(`result_id`),
    INDEX `idx_score`(`score`),
    INDEX `idx_time_spent`(`time_spent`),
    UNIQUE INDEX `uk_result_question`(`result_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_id` INTEGER NOT NULL,
    `node_id` INTEGER NOT NULL,
    `node_order` INTEGER NOT NULL,
    `approver_id` INTEGER NOT NULL,
    `action` ENUM('approve', 'reject', 'return', 'delegate') NOT NULL,
    `opinion` TEXT NULL,
    `delegate_to_id` INTEGER NULL,
    `approved_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_approved_at`(`approved_at`),
    INDEX `idx_approver_id`(`approver_id`),
    INDEX `idx_node_id`(`node_id`),
    INDEX `idx_reimbursement_id`(`reimbursement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_workflow_nodes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workflow_id` INTEGER NOT NULL,
    `node_order` INTEGER NOT NULL DEFAULT 1,
    `node_name` VARCHAR(100) NOT NULL,
    `approver_type` VARCHAR(50) NOT NULL,
    `approver_id` INTEGER NULL,
    `role_id` INTEGER NULL,
    `special_group_id` INTEGER NULL,
    `custom_type_name` VARCHAR(50) NULL,
    `approval_mode` ENUM('serial', 'parallel') NOT NULL DEFAULT 'serial',
    `can_skip` BOOLEAN NOT NULL DEFAULT false,
    `skip_conditions` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_nodes_approver`(`approver_id`),
    INDEX `fk_nodes_role`(`role_id`),
    INDEX `idx_workflow_order`(`workflow_id`, `node_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_workflows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(50) NOT NULL DEFAULT 'reimbursement',
    `description` TEXT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `conditions` JSON NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_workflows_created_by`(`created_by`),
    INDEX `idx_is_default`(`is_default`),
    INDEX `idx_status`(`status`),
    INDEX `idx_type`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approvers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `approver_type` VARCHAR(50) NOT NULL,
    `custom_type_name` VARCHAR(50) NULL,
    `department_scope` JSON NULL,
    `amount_limit` DECIMAL(12, 2) NULL,
    `amount_min` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `business_types` JSON NULL,
    `delegate_user_id` INTEGER NULL,
    `delegate_start_date` DATE NULL,
    `delegate_end_date` DATE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_approvers_delegate`(`delegate_user_id`),
    INDEX `idx_approver_type`(`approver_type`),
    INDEX `idx_is_active`(`is_active`),
    UNIQUE INDEX `uk_user_type`(`user_id`, `approver_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `article_comments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `article_id` BIGINT UNSIGNED NOT NULL,
    `user_id` INTEGER NOT NULL,
    `parent_id` BIGINT UNSIGNED NULL,
    `content` TEXT NOT NULL,
    `like_count` INTEGER NOT NULL DEFAULT 0,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('active', 'deleted') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_article_id`(`article_id`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_parent_id`(`parent_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `article_likes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `article_id` INTEGER NOT NULL,
    `user_id` VARCHAR(50) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_article`(`article_id`),
    INDEX `idx_user`(`user_id`),
    UNIQUE INDEX `unique_like`(`article_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `exam_id` INTEGER NOT NULL,
    `target_users` JSON NULL,
    `target_departments` JSON NULL,
    `start_time` DATETIME(0) NOT NULL,
    `end_time` DATETIME(0) NOT NULL,
    `max_attempts` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('draft', 'published', 'ongoing', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `is_deleted` BOOLEAN NULL DEFAULT false,

    INDEX `idx_created_by`(`created_by`),
    INDEX `idx_end_time`(`end_time`),
    INDEX `idx_exam_id`(`exam_id`),
    INDEX `idx_start_time`(`start_time`),
    INDEX `idx_status`(`status`),
    INDEX `idx_time_range`(`start_time`, `end_time`),
    INDEX `idx_title`(`title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment_results` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `exam_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `attempt_number` INTEGER NOT NULL DEFAULT 1,
    `start_time` DATETIME(0) NOT NULL,
    `submit_time` DATETIME(0) NULL,
    `duration` INTEGER NULL,
    `score` DECIMAL(5, 2) NULL,
    `is_passed` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('in_progress', 'submitted', 'graded', 'expired') NOT NULL DEFAULT 'in_progress',
    `answers` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_attempt_number`(`attempt_number`),
    INDEX `idx_duration`(`duration`),
    INDEX `idx_exam_id`(`exam_id`),
    INDEX `idx_is_passed`(`is_passed`),
    INDEX `idx_plan_id`(`plan_id`),
    INDEX `idx_score`(`score`),
    INDEX `idx_start_time`(`start_time`),
    INDEX `idx_status`(`status`),
    INDEX `idx_submit_time`(`submit_time`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `assigned_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `returned_at` TIMESTAMP(0) NULL,
    `expected_return_date` DATE NULL,
    `condition_on_assign` TEXT NULL,
    `condition_on_return` TEXT NULL,
    `assigned_by` INTEGER NULL,

    INDEX `asset_id`(`asset_id`),
    INDEX `assigned_by`(`assigned_by`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',

    UNIQUE INDEX `code`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_component_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `icon` VARCHAR(50) NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `category` ENUM('cpu', 'ram', 'disk', 'gpu', 'monitor', 'peripherals', 'other') NOT NULL,
    `type_id` INTEGER NULL,
    `model` VARCHAR(100) NULL,
    `sn` VARCHAR(100) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `purchase_date` DATE NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_comp_type`(`type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_device_forms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `icon` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',

    UNIQUE INDEX `name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_model_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `model_id` INTEGER NOT NULL,
    `component_id` INTEGER NULL,
    `component_category` ENUM('cpu', 'ram', 'disk', 'gpu', 'monitor', 'peripherals', 'other') NOT NULL,
    `default_component_name` VARCHAR(100) NULL,
    `quantity` INTEGER NULL DEFAULT 1,

    INDEX `fk_template_component`(`component_id`),
    INDEX `model_id`(`model_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_models` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `category_id` INTEGER NULL,
    `form_id` INTEGER NULL,
    `description` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `category_id`(`category_id`),
    INDEX `fk_model_form`(`form_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `type` ENUM('upgrade', 'repair') NOT NULL,
    `target_component_type_id` INTEGER NULL,
    `workflow_id` INTEGER NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NULL DEFAULT 'pending',
    `current_node_id` INTEGER NULL,
    `submitted_at` TIMESTAMP(0) NULL,
    `completed_at` TIMESTAMP(0) NULL,
    `admin_notes` TEXT NULL,
    `handled_by` INTEGER NULL,
    `handled_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `asset_id`(`asset_id`),
    INDEX `fk_req_comp_type`(`target_component_type_id`),
    INDEX `handled_by`(`handled_by`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_upgrades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `component_type_id` INTEGER NOT NULL,
    `old_component_id` INTEGER NULL,
    `new_component_id` INTEGER NOT NULL,
    `upgrade_type` ENUM('initial', 'upgrade', 'repair', 'replace') NULL DEFAULT 'upgrade',
    `reason` TEXT NULL,
    `cost` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `upgrade_date` DATE NULL,
    `handled_by` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `asset_id`(`asset_id`),
    INDEX `component_type_id`(`component_type_id`),
    INDEX `handled_by`(`handled_by`),
    INDEX `new_component_id`(`new_component_id`),
    INDEX `old_component_id`(`old_component_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_no` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `category_id` INTEGER NULL,
    `model_id` INTEGER NULL,
    `config_summary` TEXT NULL,
    `device_type` ENUM('workstation', 'laptop', 'server', 'tablet', 'other') NULL DEFAULT 'workstation',
    `model` VARCHAR(100) NULL,
    `serial_number` VARCHAR(100) NULL,
    `status` ENUM('idle', 'in_use', 'maintenance', 'lost', 'scrapped') NULL DEFAULT 'idle',
    `purchase_date` DATE NULL,
    `purchase_price` DECIMAL(10, 2) NULL,
    `warranty_expire_date` DATE NULL,
    `supplier` VARCHAR(100) NULL,
    `current_user_id` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `mac_address` VARCHAR(50) NULL,

    UNIQUE INDEX `asset_no`(`asset_no`),
    INDEX `category_id`(`category_id`),
    INDEX `current_user_id`(`current_user_id`),
    INDEX `fk_assets_model`(`model_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `attendance_date` DATE NOT NULL,
    `check_in_time` DATETIME(0) NULL,
    `check_out_time` DATETIME(0) NULL,
    `work_hours` DECIMAL(5, 2) NULL,
    `overtime_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('normal', 'late', 'early_leave', 'absent', 'overtime') NOT NULL DEFAULT 'normal',
    `note` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `clock_out_time` DATETIME(0) NULL,
    `clock_out_location` VARCHAR(255) NULL,
    `employee_id` INTEGER NOT NULL,
    `record_date` DATE NOT NULL,
    `clock_in_time` DATETIME(0) NULL,
    `clock_in_location` VARCHAR(255) NULL,
    `is_overtime` BOOLEAN NULL DEFAULT false,
    `remark` VARCHAR(500) NULL,

    INDEX `idx_attendance_date`(`attendance_date`),
    INDEX `idx_check_in_time`(`check_in_time`),
    INDEX `idx_check_out_time`(`check_out_time`),
    INDEX `idx_emp_status_date`(`employee_id`, `status`, `record_date`),
    INDEX `idx_employee_date`(`employee_id`, `record_date`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user_date_status`(`user_id`, `attendance_date`, `status`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_user_date`(`user_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rule_name` VARCHAR(100) NOT NULL,
    `rule_type` VARCHAR(50) NOT NULL,
    `rule_value` JSON NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_rule_type`(`rule_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_settings` (
    `id` INTEGER NOT NULL,
    `enable_location_check` BOOLEAN NOT NULL DEFAULT false,
    `allowed_distance` INTEGER NOT NULL DEFAULT 500,
    `allowed_locations` TEXT NULL,
    `enable_time_check` BOOLEAN NOT NULL DEFAULT true,
    `early_clock_in_minutes` INTEGER NOT NULL DEFAULT 60,
    `late_clock_out_minutes` INTEGER NOT NULL DEFAULT 120,
    `late_minutes` INTEGER NOT NULL DEFAULT 30,
    `early_leave_minutes` INTEGER NOT NULL DEFAULT 30,
    `absent_hours` INTEGER NOT NULL DEFAULT 4,
    `max_annual_leave_days` INTEGER NOT NULL DEFAULT 10,
    `max_sick_leave_days` INTEGER NOT NULL DEFAULT 15,
    `require_proof_for_sick_leave` BOOLEAN NOT NULL DEFAULT true,
    `require_approval_for_overtime` BOOLEAN NOT NULL DEFAULT true,
    `min_overtime_hours` DECIMAL(4, 1) NOT NULL DEFAULT 1.0,
    `max_overtime_hours_per_day` INTEGER NOT NULL DEFAULT 4,
    `allow_makeup` BOOLEAN NOT NULL DEFAULT true,
    `makeup_deadline_days` INTEGER NOT NULL DEFAULT 3,
    `require_approval_for_makeup` BOOLEAN NOT NULL DEFAULT true,
    `notify_on_late` BOOLEAN NOT NULL DEFAULT true,
    `notify_on_early_leave` BOOLEAN NOT NULL DEFAULT true,
    `notify_on_absent` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `broadcast_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `is_read` BOOLEAN NULL DEFAULT false,
    `read_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_broadcast`(`broadcast_id`),
    INDEX `idx_read`(`is_read`),
    INDEX `idx_user`(`user_id`),
    UNIQUE INDEX `uk_broadcast_user`(`broadcast_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcasts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `type` ENUM('info', 'warning', 'success', 'error', 'announcement') NULL DEFAULT 'info',
    `priority` ENUM('low', 'normal', 'high', 'urgent') NULL DEFAULT 'normal',
    `target_type` ENUM('all', 'department', 'role', 'individual') NOT NULL,
    `target_departments` JSON NULL,
    `target_roles` JSON NULL,
    `target_users` JSON NULL,
    `creator_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `expires_at` TIMESTAMP(0) NULL,

    INDEX `idx_created`(`created_at`),
    INDEX `idx_creator`(`creator_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` VARCHAR(100) NULL,
    `file_size` INTEGER NULL,
    `file_url` VARCHAR(2048) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `case_id`(`case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `parent_id` INTEGER NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `name`(`name`),
    INDEX `idx_active`(`is_active`),
    INDEX `idx_parent`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `comment_content` TEXT NOT NULL,
    `parent_comment_id` INTEGER NULL,
    `like_count` INTEGER NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `case_id`(`case_id`),
    INDEX `parent_comment_id`(`parent_comment_id`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_learning_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `case_id` INTEGER NOT NULL,
    `start_time` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `end_time` TIMESTAMP(0) NULL,
    `duration_seconds` INTEGER NULL DEFAULT 0,
    `progress_percentage` INTEGER NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `case_id`(`case_id`),
    UNIQUE INDEX `user_id`(`user_id`, `case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `tag_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_case_id`(`case_id`),
    INDEX `idx_tag_id`(`tag_id`),
    UNIQUE INDEX `uk_case_tag`(`case_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `category` VARCHAR(50) NULL,
    `description` TEXT NOT NULL,
    `problem` TEXT NOT NULL,
    `solution` TEXT NOT NULL,
    `difficulty` ENUM('easy', 'medium', 'hard') NOT NULL DEFAULT 'medium',
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `like_count` INTEGER NOT NULL DEFAULT 0,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_category`(`category`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_created_by`(`created_by`),
    INDEX `idx_difficulty`(`difficulty`),
    INDEX `idx_like_count`(`like_count`),
    INDEX `idx_priority`(`priority`),
    INDEX `idx_status`(`status`),
    INDEX `idx_title`(`title`),
    INDEX `idx_view_count`(`view_count`),
    FULLTEXT INDEX `ft_content_search`(`title`, `description`, `problem`, `solution`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_group_members` (
    `group_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `joined_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `role` ENUM('admin', 'member') NULL DEFAULT 'member',
    `last_read_message_id` INTEGER NULL DEFAULT 0,
    `is_muted` BOOLEAN NULL DEFAULT false,

    INDEX `user_id`(`user_id`),
    UNIQUE INDEX `unique_group_user`(`group_id`, `user_id`),
    PRIMARY KEY (`group_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `owner_id` INTEGER NOT NULL,
    `type` ENUM('group', 'p2p') NULL DEFAULT 'group',
    `avatar` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `department_id` INTEGER NULL,

    UNIQUE INDEX `department_id`(`department_id`),
    INDEX `owner_id`(`owner_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sender_id` INTEGER NOT NULL,
    `group_id` INTEGER NULL,
    `receiver_id` INTEGER NULL,
    `content` TEXT NULL,
    `msg_type` ENUM('text', 'image', 'file', 'system') NULL DEFAULT 'text',
    `file_url` VARCHAR(1024) NULL,
    `is_read` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_chat_group`(`group_id`),
    INDEX `idx_chat_receiver`(`receiver_id`),
    INDEX `idx_chat_sender`(`sender_id`),
    INDEX `idx_chat_time`(`created_at`),
    INDEX `idx_group_id_id`(`group_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_room_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
    `joined_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_read_at` DATETIME(0) NULL,
    `is_muted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `idx_is_muted`(`is_muted`),
    INDEX `idx_joined_at`(`joined_at`),
    INDEX `idx_last_read_at`(`last_read_at`),
    INDEX `idx_role`(`role`),
    INDEX `idx_room_id`(`room_id`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_room_user`(`room_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collected_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `message_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_message_id`(`message_id`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compensatory_leave_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `request_type` ENUM('schedule_change', 'compensatory_leave') NULL DEFAULT 'compensatory_leave',
    `original_schedule_date` DATE NULL,
    `original_shift_id` INTEGER NULL,
    `new_schedule_date` DATE NULL,
    `new_shift_id` INTEGER NULL,
    `reason` TEXT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NULL DEFAULT 'pending',
    `approver_id` INTEGER NULL,
    `approval_note` TEXT NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_approver_id`(`approver_id`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_employee_id`(`employee_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_members` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `conversation_id` BIGINT UNSIGNED NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` ENUM('member', 'admin', 'owner') NOT NULL DEFAULT 'member',
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `is_muted` BOOLEAN NOT NULL DEFAULT false,
    `unread_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `last_read_message_id` BIGINT UNSIGNED NULL,
    `joined_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `left_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_conv_member_conv`(`conversation_id`),
    INDEX `idx_conv_member_user`(`user_id`),
    UNIQUE INDEX `uk_conv_member`(`conversation_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` ENUM('single', 'group', 'room') NOT NULL,
    `name` VARCHAR(255) NULL,
    `avatar` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_conv_creator`(`creator_id`),
    INDEX `idx_conv_type`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversion_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NULL DEFAULT '转换规则',
    `conversion_rate` DECIMAL(10, 2) NOT NULL,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `description` TEXT NULL,
    `ratio` DECIMAL(10, 4) NULL DEFAULT 0.1250,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversion_usage_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversion_id` INTEGER NOT NULL,
    `leave_record_id` INTEGER NOT NULL,
    `used_days` DECIMAL(10, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_conversion`(`conversion_id`),
    INDEX `idx_leave_record`(`leave_record_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `company` VARCHAR(100) NULL,
    `level` ENUM('normal', 'vip', 'black') NULL DEFAULT 'normal',
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` INTEGER NULL,

    UNIQUE INDEX `phone`(`phone`),
    INDEX `created_by`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `platform_id` INTEGER NULL,
    `shop_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_customers_shop`(`shop_id`),
    INDEX `idx_name`(`name`),
    INDEX `idx_phone`(`phone`),
    INDEX `idx_platform_shop`(`platform_id`, `shop_id`),
    UNIQUE INDEX `uk_customer_platform_shop`(`customer_id`, `platform_id`, `shop_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `parent_id` INTEGER NULL,
    `description` TEXT NULL,
    `manager_id` INTEGER NULL,
    `status` ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_manager_id`(`manager_id`),
    INDEX `idx_name`(`name`),
    INDEX `idx_parent_id`(`parent_id`),
    INDEX `idx_sort_order`(`sort_order`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_component_mapping` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `component_id` INTEGER NOT NULL,
    `bound_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `asset_id`(`asset_id`),
    INDEX `component_id`(`component_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_config_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `device_id` INTEGER NOT NULL,
    `component_type_id` INTEGER NOT NULL,
    `component_id` INTEGER NOT NULL,
    `quantity` INTEGER NULL DEFAULT 1,
    `change_type` ENUM('initial', 'upgrade', 'downgrade') NULL DEFAULT 'initial',
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `component_id`(`component_id`),
    INDEX `component_type_id`(`component_type_id`),
    INDEX `device_id`(`device_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_no` VARCHAR(50) NOT NULL,
    `model_id` INTEGER NOT NULL,
    `current_user_id` INTEGER NULL,
    `device_status` ENUM('idle', 'in_use', 'damaged', 'maintenance', 'scrapped') NULL DEFAULT 'idle',
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `purchase_date` DATE NULL,
    `purchase_price` DECIMAL(10, 2) NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `asset_no`(`asset_no`),
    INDEX `current_user_id`(`current_user_id`),
    INDEX `model_id`(`model_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_changes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `change_type` ENUM('hire', 'transfer', 'promotion', 'resign', 'terminate') NOT NULL,
    `change_date` DATE NOT NULL,
    `old_department_id` INTEGER NULL,
    `new_department_id` INTEGER NULL,
    `reason` TEXT NULL,
    `remarks` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `old_position_id` INTEGER NULL,
    `new_position_id` INTEGER NULL,
    `old_position` VARCHAR(50) NULL,
    `new_position` VARCHAR(50) NULL,

    INDEX `change_date`(`change_date`),
    INDEX `change_type`(`change_type`),
    INDEX `employee_id`(`employee_id`),
    INDEX `idx_new_position_id`(`new_position_id`),
    INDEX `idx_old_position_id`(`old_position_id`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_status_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `old_status` ENUM('active', 'inactive', 'resigned') NULL,
    `new_status` ENUM('active', 'inactive', 'resigned') NOT NULL,
    `old_department_id` INTEGER NULL,
    `new_department_id` INTEGER NULL,
    `change_reason` VARCHAR(255) NULL,
    `change_date` DATE NOT NULL,
    `work_duration_days` INTEGER NULL DEFAULT 0,
    `operated_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_employee_status_records_new_dept`(`new_department_id`),
    INDEX `fk_employee_status_records_old_dept`(`old_department_id`),
    INDEX `idx_change_date`(`change_date`),
    INDEX `idx_employee_id`(`employee_id`),
    INDEX `idx_new_status`(`new_status`),
    INDEX `idx_operated_by`(`operated_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_no` VARCHAR(20) NOT NULL,
    `hire_date` DATE NOT NULL,
    `salary` DECIMAL(10, 2) NULL,
    `status` ENUM('active', 'inactive', 'resigned', 'deleted') NULL DEFAULT 'active',
    `emergency_contact` VARCHAR(50) NULL,
    `emergency_phone` VARCHAR(20) NULL,
    `address` VARCHAR(200) NULL,
    `education` VARCHAR(20) NULL,
    `skills` TEXT NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `rating` BOOLEAN NOT NULL DEFAULT true,
    `position_id` INTEGER NULL,

    UNIQUE INDEX `uk_user_id`(`user_id`),
    UNIQUE INDEX `uk_employee_no`(`employee_no`),
    INDEX `idx_hire_date`(`hire_date`),
    INDEX `idx_position_id`(`position_id`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `deleted_by` INTEGER NULL,
    `status` ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active',
    `order_num` INTEGER NOT NULL DEFAULT 1,
    `path` VARCHAR(1024) NOT NULL DEFAULT '/',
    `level` INTEGER NOT NULL DEFAULT 1,
    `weight` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `created_by` INTEGER NULL,
    `parent_id` INTEGER NULL,

    INDEX `idx_deleted_at`(`deleted_at`),
    INDEX `idx_name`(`name`),
    INDEX `idx_parent_id`(`parent_id`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_category_audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category_id` INTEGER NULL,
    `operator_id` INTEGER NULL,
    `operation` VARCHAR(64) NOT NULL,
    `detail` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(50) NULL,
    `category_id` INTEGER NULL,
    `difficulty` ENUM('easy', 'medium', 'hard') NOT NULL DEFAULT 'medium',
    `duration` INTEGER NOT NULL,
    `total_score` DECIMAL(5, 2) NOT NULL,
    `pass_score` DECIMAL(5, 2) NOT NULL,
    `question_count` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `questions` LONGTEXT NULL,

    INDEX `fk_exams_category_id`(`category_id`),
    INDEX `idx_category`(`category`),
    INDEX `idx_created_by`(`created_by`),
    INDEX `idx_difficulty`(`difficulty`),
    INDEX `idx_duration`(`duration`),
    INDEX `idx_pass_score`(`pass_score`),
    INDEX `idx_status`(`status`),
    INDEX `idx_title`(`title`),
    INDEX `idx_total_score`(`total_score`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_types` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `category_id` INTEGER UNSIGNED NULL,
    `unit` VARCHAR(20) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_agents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `platform_id` INTEGER NOT NULL,
    `shop_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_platform_id`(`platform_id`),
    INDEX `idx_shop_id`(`shop_id`),
    UNIQUE INDEX `uk_name_platform_shop`(`name`, `platform_id`, `shop_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_members` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `group_id` BIGINT UNSIGNED NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` ENUM('member', 'admin', 'owner') NOT NULL DEFAULT 'member',
    `nickname` VARCHAR(255) NULL,
    `joined_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_group_member_group`(`group_id`),
    INDEX `idx_group_member_user`(`user_id`),
    UNIQUE INDEX `uk_group_member`(`group_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `avatar` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `announcement` TEXT NULL,
    `owner_id` INTEGER NOT NULL,
    `max_members` INTEGER UNSIGNED NOT NULL DEFAULT 200,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `join_approval_required` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_group_owner`(`owner_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holidays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(20) NOT NULL,
    `days` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `vacation_type_id` INTEGER NULL,

    INDEX `idx_vacation_type`(`vacation_type_id`),
    INDEX `idx_year_month`(`year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_audits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_id` INTEGER NOT NULL,
    `expected_stock` INTEGER NOT NULL,
    `actual_stock` INTEGER NOT NULL,
    `discrepancy` INTEGER NULL,
    `result_status` ENUM('matched', 'missing', 'surplus') NULL DEFAULT 'matched',
    `auditor_id` INTEGER NULL,
    `audit_date` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `notes` TEXT NULL,

    INDEX `auditor_id`(`auditor_id`),
    INDEX `item_id`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(50) NULL,
    `unit` VARCHAR(20) NULL DEFAULT '个',
    `current_stock` INTEGER NULL DEFAULT 0,
    `min_stock_alert` INTEGER NULL DEFAULT 10,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_usage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `user_id` INTEGER NULL,
    `usage_date` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `purpose` VARCHAR(255) NULL,

    INDEX `item_id`(`item_id`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_article_daily_stats` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `article_id` BIGINT UNSIGNED NOT NULL,
    `stat_date` DATE NOT NULL,
    `views_count` INTEGER NULL DEFAULT 0,
    `full_reads_count` INTEGER NULL DEFAULT 0,
    `total_duration_seconds` BIGINT NULL DEFAULT 0,
    `total_active_seconds` BIGINT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_article_id`(`article_id`),
    UNIQUE INDEX `uniq_article_date`(`article_id`, `stat_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_article_read_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_id` VARCHAR(64) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `department_id` INTEGER NULL,
    `article_id` BIGINT UNSIGNED NOT NULL,
    `started_at` DATETIME(0) NOT NULL,
    `ended_at` DATETIME(0) NULL,
    `duration_seconds` INTEGER NULL DEFAULT 0,
    `active_seconds` INTEGER NULL DEFAULT 0,
    `scroll_depth_percent` INTEGER NULL DEFAULT 0,
    `full_read` BOOLEAN NULL DEFAULT false,
    `close_type` ENUM('user_close', 'auto_close', 'tab_hidden') NULL DEFAULT 'user_close',
    `heartbeats_count` INTEGER NULL DEFAULT 0,
    `wheel_events` INTEGER NULL DEFAULT 0,
    `mousemove_events` INTEGER NULL DEFAULT 0,
    `keydown_events` INTEGER NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uniq_session_id`(`session_id`),
    INDEX `idx_article_id`(`article_id`),
    INDEX `idx_started_at`(`started_at`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_articles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(300) NOT NULL,
    `summary` VARCHAR(1000) NULL,
    `content` MEDIUMTEXT NULL,
    `attachments` MEDIUMTEXT NULL,
    `category_id` BIGINT UNSIGNED NULL,
    `owner_id` BIGINT UNSIGNED NULL,
    `original_article_id` BIGINT UNSIGNED NULL,
    `type` ENUM('common', 'personal') NOT NULL DEFAULT 'common',
    `is_public` TINYINT NOT NULL DEFAULT 1,
    `status` ENUM('draft', 'published', 'archived', 'deleted') NOT NULL DEFAULT 'published',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `view_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `like_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `icon` VARCHAR(50) NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `deleted_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_art_category`(`category_id`),
    INDEX `idx_art_deleted`(`is_deleted`),
    INDEX `idx_art_original`(`original_article_id`),
    INDEX `idx_art_owner`(`owner_id`),
    INDEX `idx_art_public`(`is_public`),
    INDEX `idx_art_status`(`status`),
    INDEX `idx_art_type`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_attachments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `article_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `type` VARCHAR(100) NULL,
    `size` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_att_article`(`article_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `icon` VARCHAR(50) NULL,
    `owner_id` BIGINT UNSIGNED NULL,
    `type` ENUM('common', 'personal') NOT NULL DEFAULT 'common',
    `is_public` TINYINT NOT NULL DEFAULT 1,
    `is_hidden` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `deleted_by` BIGINT UNSIGNED NULL,

    INDEX `idx_cat_deleted`(`is_deleted`),
    INDEX `idx_cat_owner`(`owner_id`),
    INDEX `idx_cat_public`(`is_public`),
    INDEX `idx_cat_status`(`status`),
    INDEX `idx_cat_type`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_learning_plan_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `plan_id` INTEGER NOT NULL,
    `start_time` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `end_time` DATETIME(0) NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('in_progress', 'completed', 'abandoned') NOT NULL DEFAULT 'in_progress',
    `completed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_plan_id`(`plan_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_user_plan`(`user_id`, `plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_learning_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `target_articles` JSON NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` ENUM('active', 'completed', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_end_date`(`end_date`),
    INDEX `idx_start_date`(`start_date`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_learning_statistics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `stat_date` DATE NOT NULL,
    `articles_read` INTEGER NOT NULL DEFAULT 0,
    `articles_completed` INTEGER NOT NULL DEFAULT 0,
    `total_duration` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_stat_date`(`stat_date`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_user_date`(`user_id`, `stat_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `learning_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `assigned_to` INTEGER NULL,
    `department_id` INTEGER NULL,
    `status` ENUM('draft', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
    `start_date` DATETIME(0) NULL,
    `end_date` DATETIME(0) NULL,
    `completed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_assigned_to`(`assigned_to`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_created_by`(`created_by`),
    INDEX `idx_department_id`(`department_id`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `learning_statistics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `articles_read` INTEGER NOT NULL DEFAULT 0,
    `exams_taken` INTEGER NOT NULL DEFAULT 0,
    `exams_passed` INTEGER NOT NULL DEFAULT 0,
    `total_duration` INTEGER NOT NULL DEFAULT 0,
    `completed_tasks` INTEGER NOT NULL DEFAULT 0,
    `completed_plans` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_date`(`date`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_user_date`(`user_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `learning_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `assigned_to` INTEGER NOT NULL,
    `assigned_by` INTEGER NULL,
    `status` ENUM('pending', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    `priority` ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
    `due_date` DATETIME(0) NULL,
    `completed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `assigned_by`(`assigned_by`),
    INDEX `idx_assigned_to`(`assigned_to`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_due_date`(`due_date`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `leave_type` ENUM('sick', 'annual', 'personal', 'maternity', 'other') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `days` DECIMAL(5, 2) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `approver_id` INTEGER NULL,
    `approved_at` DATETIME(0) NULL,
    `approval_note` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `employee_id` INTEGER NOT NULL,
    `attachments` TEXT NULL,
    `use_converted_leave` BOOLEAN NULL DEFAULT false,
    `used_conversion_days` DECIMAL(10, 2) NULL DEFAULT 0.00,

    INDEX `idx_approved_by`(`approver_id`),
    INDEX `idx_date_range`(`start_date`, `end_date`),
    INDEX `idx_employee`(`employee_id`),
    INDEX `idx_end_date`(`end_date`),
    INDEX `idx_leave_type`(`leave_type`),
    INDEX `idx_start_date`(`start_date`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `makeup_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `record_date` DATE NOT NULL,
    `clock_type` ENUM('in', 'out') NOT NULL,
    `clock_time` DATETIME(0) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NULL DEFAULT 'pending',
    `approver_id` INTEGER NULL,
    `approved_at` DATETIME(0) NULL,
    `approval_note` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `attachments` TEXT NULL,

    INDEX `idx_approver`(`approver_id`),
    INDEX `idx_employee`(`employee_id`),
    INDEX `idx_record_date`(`record_date`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meal_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `menu_item_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(8, 2) NOT NULL,
    `subtotal` DECIMAL(8, 2) NOT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_menu_item_id`(`menu_item_id`),
    INDEX `idx_order_id`(`order_id`),
    INDEX `idx_quantity`(`quantity`),
    INDEX `idx_subtotal`(`subtotal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meal_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(50) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `order_date` DATE NOT NULL,
    `meal_type` ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
    `total_amount` DECIMAL(8, 2) NOT NULL,
    `status` ENUM('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    `note` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_order_no`(`order_no`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_meal_type`(`meal_type`),
    INDEX `idx_order_date`(`order_date`),
    INDEX `idx_status`(`status`),
    INDEX `idx_total_amount`(`total_amount`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `memo_recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `memo_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `is_read` BOOLEAN NULL DEFAULT false,
    `read_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_is_read`(`is_read`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_memo_user`(`memo_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `memos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `type` ENUM('personal', 'department') NULL DEFAULT 'personal',
    `priority` ENUM('low', 'normal', 'high', 'urgent') NULL DEFAULT 'normal',
    `is_read` BOOLEAN NULL DEFAULT false,
    `target_department_id` INTEGER NULL,
    `target_user_id` INTEGER NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_deleted_at`(`deleted_at`),
    INDEX `idx_is_read`(`is_read`),
    INDEX `idx_target_department`(`target_department_id`),
    INDEX `idx_target_user`(`target_user_id`),
    INDEX `idx_type`(`type`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_name`(`name`),
    INDEX `idx_sort_order`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(8, 2) NOT NULL,
    `image` VARCHAR(255) NULL,
    `ingredients` TEXT NULL,
    `nutrition` JSON NULL,
    `is_available` BOOLEAN NOT NULL DEFAULT true,
    `is_recommended` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_category_id`(`category_id`),
    INDEX `idx_is_available`(`is_available`),
    INDEX `idx_is_recommended`(`is_recommended`),
    INDEX `idx_name`(`name`),
    INDEX `idx_price`(`price`),
    INDEX `idx_sort_order`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_status` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `message_id` BIGINT UNSIGNED NOT NULL,
    `user_id` INTEGER NOT NULL,
    `status` ENUM('sent', 'delivered', 'read') NOT NULL DEFAULT 'sent',
    `read_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_message_id`(`message_id`),
    INDEX `idx_msg_status_msg`(`message_id`),
    INDEX `idx_msg_status_user`(`user_id`),
    INDEX `idx_user_status`(`user_id`, `status`),
    UNIQUE INDEX `uk_msg_user`(`message_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `conversation_id` BIGINT UNSIGNED NOT NULL,
    `sender_id` INTEGER NOT NULL,
    `recipient_id` INTEGER NULL,
    `content` TEXT NOT NULL,
    `message_type` VARCHAR(50) NOT NULL,
    `file_url` VARCHAR(255) NULL,
    `file_name` VARCHAR(255) NULL,
    `file_size` INTEGER NULL,
    `reply_to_message_id` BIGINT UNSIGNED NULL,
    `is_recalled` BOOLEAN NULL DEFAULT false,
    `recalled_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_conversation_id`(`conversation_id`),
    INDEX `idx_recipient_id`(`recipient_id`),
    INDEX `idx_reply_to_message_id`(`reply_to_message_id`),
    INDEX `idx_sender_id`(`sender_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `migrations_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `migration_name` VARCHAR(255) NOT NULL,
    `applied_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `migration_name`(`migration_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `my_knowledge_articles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `category_id` INTEGER NULL,
    `source_article_id` INTEGER NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NULL,
    `summary` TEXT NULL,
    `attachments` JSON NULL,
    `tags` VARCHAR(500) NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_category_id`(`category_id`),
    INDEX `idx_source_article_id`(`source_article_id`),
    INDEX `idx_title`(`title`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `my_knowledge_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `icon` VARCHAR(10) NULL DEFAULT '?',
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_name`(`name`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `my_knowledge_saved_articles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `article_id` BIGINT UNSIGNED NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_mk_article`(`article_id`),
    INDEX `idx_mk_user`(`user_id`),
    UNIQUE INDEX `uk_user_article`(`user_id`, `article_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `notification_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `is_read` BOOLEAN NULL DEFAULT false,
    `read_at` TIMESTAMP(0) NULL,
    `is_deleted` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `user_id`(`user_id`),
    UNIQUE INDEX `notification_id`(`notification_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_type` VARCHAR(50) NOT NULL,
    `target_roles` JSON NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_event_type`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NULL,
    `related_id` INTEGER NULL,
    `is_read` BOOLEAN NULL DEFAULT false,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `related_type` VARCHAR(50) NULL,

    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_is_read`(`is_read`),
    INDEX `idx_related`(`related_type`, `related_id`),
    INDEX `idx_type`(`type`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `username` VARCHAR(50) NULL,
    `real_name` VARCHAR(50) NULL,
    `module` VARCHAR(50) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `method` VARCHAR(10) NULL,
    `url` VARCHAR(255) NULL,
    `params` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `error_msg` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_module`(`module`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `overtime_conversions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `overtime_hours` DECIMAL(5, 2) NOT NULL,
    `target_vacation_type_id` INTEGER NOT NULL,
    `converted_days` DECIMAL(5, 2) NOT NULL,
    `conversion_rule_id` INTEGER NULL,
    `conversion_ratio` DECIMAL(5, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` INTEGER NULL,

    INDEX `conversion_rule_id`(`conversion_rule_id`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_employee`(`employee_id`),
    INDEX `target_vacation_type_id`(`target_vacation_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `overtime_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `overtime_date` DATE NOT NULL,
    `start_time` DATETIME(0) NOT NULL,
    `end_time` DATETIME(0) NOT NULL,
    `hours` DECIMAL(4, 2) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `status` ENUM('pending', 'approved', 'rejected') NULL DEFAULT 'pending',
    `approver_id` INTEGER NULL,
    `approved_at` DATETIME(0) NULL,
    `approval_note` VARCHAR(500) NULL,
    `is_compensated` BOOLEAN NULL DEFAULT false,
    `compensated_at` DATETIME(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `attachments` TEXT NULL,

    INDEX `idx_approver`(`approver_id`),
    INDEX `idx_employee`(`employee_id`),
    INDEX `idx_overtime_date`(`overtime_date`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_distribution_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setting_name` VARCHAR(100) NOT NULL,
    `frequency` ENUM('monthly', 'weekly', 'daily') NOT NULL DEFAULT 'monthly',
    `distribution_day` INTEGER NULL,
    `distribution_weekday` INTEGER NULL,
    `distribution_time` TIME(0) NULL,
    `auto_send` BOOLEAN NOT NULL DEFAULT false,
    `target_departments` JSON NULL,
    `target_positions` JSON NULL,
    `target_employees` JSON NULL,
    `notify_internal` BOOLEAN NOT NULL DEFAULT true,
    `notify_sms` BOOLEAN NOT NULL DEFAULT false,
    `notify_email` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_distribution_settings_created_by`(`created_by`),
    INDEX `idx_is_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_import_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `file_name` VARCHAR(255) NOT NULL,
    `salary_month` DATE NOT NULL,
    `total_count` INTEGER NOT NULL DEFAULT 0,
    `success_count` INTEGER NOT NULL DEFAULT 0,
    `failed_count` INTEGER NOT NULL DEFAULT 0,
    `error_details` JSON NULL,
    `import_data` JSON NULL,
    `status` ENUM('processing', 'completed', 'failed') NOT NULL DEFAULT 'processing',
    `imported_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_imported_by`(`imported_by`),
    INDEX `idx_salary_month`(`salary_month`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_passwords` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT true,
    `last_changed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `template_name` VARCHAR(100) NOT NULL,
    `template_code` VARCHAR(50) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `field_config` JSON NOT NULL,
    `description` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_template_code`(`template_code`),
    INDEX `fk_payslip_templates_created_by`(`created_by`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_is_default`(`is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payslip_no` VARCHAR(50) NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `salary_month` DATE NOT NULL,
    `payment_date` DATE NULL,
    `attendance_days` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `late_count` INTEGER NULL DEFAULT 0,
    `early_leave_count` INTEGER NULL DEFAULT 0,
    `leave_days` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `overtime_hours` DECIMAL(6, 2) NULL DEFAULT 0.00,
    `absent_days` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `basic_salary` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `position_salary` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `performance_bonus` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `overtime_pay` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `allowances` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `deductions` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `social_security` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `housing_fund` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `tax` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `other_deductions` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `net_salary` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('draft', 'sent', 'viewed', 'confirmed') NOT NULL DEFAULT 'draft',
    `remark` TEXT NULL,
    `custom_fields` JSON NULL,
    `issued_by` INTEGER NULL,
    `issued_at` DATETIME(0) NULL,
    `viewed_at` DATETIME(0) NULL,
    `confirmed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_payslip_no`(`payslip_no`),
    INDEX `idx_issued_at`(`issued_at`),
    INDEX `idx_issued_by`(`issued_by`),
    INDEX `idx_salary_month`(`salary_month`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_employee_month`(`employee_id`, `salary_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `permission_ids` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_name`(`name`),
    INDEX `idx_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `resource` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `module` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_code`(`code`),
    INDEX `idx_action`(`action`),
    INDEX `idx_module`(`module`),
    INDEX `idx_resource`(`resource`),
    INDEX `idx_resource_action`(`resource`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platforms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `positions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `department_id` INTEGER NOT NULL,
    `description` TEXT NULL,
    `requirements` TEXT NULL,
    `responsibilities` TEXT NULL,
    `salary_min` DECIMAL(10, 2) NULL,
    `salary_max` DECIMAL(10, 2) NULL,
    `level` ENUM('junior', 'middle', 'senior', 'expert') NULL DEFAULT 'junior',
    `status` ENUM('active', 'inactive') NULL DEFAULT 'active',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` INTEGER NULL,
    `updated_by` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `created_by`(`created_by`),
    INDEX `idx_department_id`(`department_id`),
    INDEX `idx_level`(`level`),
    INDEX `idx_name`(`name`),
    INDEX `idx_sort_order`(`sort_order`),
    INDEX `idx_status`(`status`),
    INDEX `updated_by`(`updated_by`),
    UNIQUE INDEX `unique_position_dept`(`name`, `department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procurement_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `price_per_unit` DECIMAL(10, 2) NULL,
    `total_price` DECIMAL(10, 2) NULL,
    `supplier` VARCHAR(100) NULL,
    `purchase_date` DATE NULL,
    `batch_no` VARCHAR(50) NULL,
    `purchaser_id` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `item_id`(`item_id`),
    INDEX `purchaser_id`(`purchaser_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_case_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` VARCHAR(50) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_case_id`(`case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_case_collections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_case_id`(`case_id`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_case_user`(`case_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_case_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `parent_id` INTEGER NULL,
    `user_id` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `like_count` INTEGER NOT NULL DEFAULT 0,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_case_id`(`case_id`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_case_favorites` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_case_id`(`case_id`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `unique_user_case`(`user_id`, `case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_case_learning_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `last_position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_case_id`(`case_id`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_case_user`(`case_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_case_likes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_case_id`(`case_id`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `unique_user_case`(`user_id`, `case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_case_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `tag_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_case_id`(`case_id`),
    INDEX `idx_tag_id`(`tag_id`),
    UNIQUE INDEX `uk_case_tag`(`case_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_case_views` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `case_id` INTEGER NOT NULL,
    `user_id` INTEGER NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `viewed_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_case_id`(`case_id`),
    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_viewed_at`(`viewed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_cases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `category` VARCHAR(50) NULL,
    `description` TEXT NULL,
    `problem` TEXT NOT NULL,
    `solution` TEXT NOT NULL,
    `case_type` ENUM('excellent', 'good', 'poor', 'warning') NOT NULL DEFAULT 'excellent',
    `difficulty` ENUM('easy', 'medium', 'hard') NOT NULL DEFAULT 'medium',
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    `session_id` INTEGER NULL,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `like_count` INTEGER NOT NULL DEFAULT 0,
    `collect_count` INTEGER NOT NULL DEFAULT 0,
    `comment_count` INTEGER NOT NULL DEFAULT 0,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `is_recommended` BOOLEAN NOT NULL DEFAULT false,
    `created_by` INTEGER NULL,
    `updated_by` INTEGER NULL,
    `published_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_case_type`(`case_type`),
    INDEX `idx_category`(`category`),
    INDEX `idx_deleted_at`(`deleted_at`),
    INDEX `idx_status`(`status`),
    FULLTEXT INDEX `ft_case_search`(`title`, `description`, `problem`, `solution`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_message_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `message_id` INTEGER NOT NULL,
    `tag_id` INTEGER NOT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created_by`(`created_by`),
    INDEX `idx_message_id`(`message_id`),
    INDEX `idx_tag_id`(`tag_id`),
    UNIQUE INDEX `uk_message_tag`(`message_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `criteria` JSON NOT NULL,
    `score_weight` DECIMAL(5, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_category`(`category`),
    INDEX `idx_created_by`(`created_by`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_name`(`name`),
    INDEX `idx_score_weight`(`score_weight`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_scores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `rule_id` INTEGER NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,
    `max_score` DECIMAL(5, 2) NULL,
    `comment` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created_by`(`created_by`),
    INDEX `idx_rule_id`(`rule_id`),
    INDEX `idx_score`(`score`),
    INDEX `idx_session_id`(`session_id`),
    UNIQUE INDEX `uk_session_rule`(`session_id`, `rule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_session_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `tag_id` INTEGER NOT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created_by`(`created_by`),
    INDEX `idx_session_id`(`session_id`),
    INDEX `idx_tag_id`(`tag_id`),
    UNIQUE INDEX `uk_session_tag`(`session_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_no` VARCHAR(50) NOT NULL,
    `agent_id` INTEGER NULL,
    `external_agent_id` INTEGER NULL,
    `agent_name` VARCHAR(100) NULL,
    `customer_id` VARCHAR(50) NULL,
    `customer_name` VARCHAR(100) NULL,
    `channel` ENUM('chat', 'phone', 'email', 'video') NOT NULL DEFAULT 'chat',
    `start_time` DATETIME(0) NOT NULL,
    `end_time` DATETIME(0) NOT NULL,
    `duration` INTEGER NOT NULL,
    `message_count` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('pending', 'in_review', 'completed', 'disputed') NOT NULL DEFAULT 'pending',
    `inspector_id` INTEGER NULL,
    `score` DECIMAL(5, 2) NULL,
    `grade` VARCHAR(20) NULL,
    `comment` TEXT NULL,
    `reviewed_at` DATETIME(0) NULL,
    `platform_id` INTEGER NULL,
    `shop_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_session_no`(`session_no`),
    INDEX `idx_agent_id`(`agent_id`),
    INDEX `idx_agent_status_time`(`agent_id`, `status`, `start_time`),
    INDEX `idx_agent_time_status`(`agent_id`, `start_time`, `status`),
    INDEX `idx_channel`(`channel`),
    INDEX `idx_customer_id`(`customer_id`),
    INDEX `idx_duration`(`duration`),
    INDEX `idx_end_time`(`end_time`),
    INDEX `idx_external_agent_id`(`external_agent_id`),
    INDEX `idx_grade`(`grade`),
    INDEX `idx_inspector_id`(`inspector_id`),
    INDEX `idx_platform_id`(`platform_id`),
    INDEX `idx_reviewed_at`(`reviewed_at`),
    INDEX `idx_score`(`score`),
    INDEX `idx_shop_id`(`shop_id`),
    INDEX `idx_start_time`(`start_time`),
    INDEX `idx_status`(`status`),
    INDEX `idx_time_range`(`start_time`, `end_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_tag_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `category_id` INTEGER NULL,
    `color` VARCHAR(20) NULL DEFAULT '#1890ff',
    `description` VARCHAR(255) NULL,
    `tag_type` ENUM('quality', 'business', 'other') NOT NULL DEFAULT 'quality',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_category_id`(`category_id`),
    INDEX `idx_tag_type`(`tag_type`),
    UNIQUE INDEX `uk_name_category`(`name`, `category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `type` ENUM('single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'essay') NOT NULL,
    `content` TEXT NOT NULL,
    `options` JSON NULL,
    `correct_answer` TEXT NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,
    `explanation` TEXT NULL,
    `order_num` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_exam_id`(`exam_id`),
    INDEX `idx_order_num`(`order_num`),
    INDEX `idx_score`(`score`),
    INDEX `idx_type`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursement_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_id` INTEGER NOT NULL,
    `item_id` INTEGER NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` VARCHAR(50) NULL,
    `file_size` INTEGER NULL,
    `file_url` VARCHAR(1024) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_item_id`(`item_id`),
    INDEX `idx_reimbursement_id`(`reimbursement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursement_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_id` INTEGER NOT NULL,
    `item_type` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `expense_date` DATE NULL,
    `description` TEXT NULL,
    `attachment_url` VARCHAR(1024) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_item_type`(`item_type`),
    INDEX `idx_reimbursement_id`(`reimbursement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursement_types` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NULL,
    `description` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimbursement_no` VARCHAR(32) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `department_id` INTEGER NULL,
    `title` VARCHAR(200) NOT NULL,
    `type` ENUM('travel', 'office', 'entertainment', 'training', 'other') NOT NULL DEFAULT 'other',
    `total_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('draft', 'pending', 'approving', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'draft',
    `current_node_id` INTEGER NULL,
    `workflow_id` INTEGER NULL,
    `remark` TEXT NULL,
    `submitted_at` DATETIME(0) NULL,
    `completed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_reimbursement_no`(`reimbursement_no`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_department_id`(`department_id`),
    INDEX `idx_employee_id`(`employee_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_type`(`type`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `department_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_department_id`(`department_id`),
    INDEX `idx_role_id`(`role_id`),
    UNIQUE INDEX `uk_role_department`(`role_id`, `department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_permission_id`(`permission_id`),
    INDEX `idx_role_id`(`role_id`),
    UNIQUE INDEX `uk_role_permission`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_workflows` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `workflow_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_role_id`(`role_id`),
    INDEX `idx_workflow_id`(`workflow_id`),
    UNIQUE INDEX `uk_role_workflow`(`role_id`, `workflow_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `can_view_all_departments` BOOLEAN NULL DEFAULT false,

    UNIQUE INDEX `uk_name`(`name`),
    INDEX `idx_is_system`(`is_system`),
    INDEX `idx_level`(`level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `shift_id` INTEGER NOT NULL,
    `schedule_date` DATE NOT NULL,
    `status` ENUM('normal', 'leave', 'holiday', 'overtime') NOT NULL DEFAULT 'normal',
    `note` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created_by`(`created_by`),
    INDEX `idx_schedule_date`(`schedule_date`),
    INDEX `idx_shift_id`(`shift_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_user_date`(`user_id`, `schedule_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `sender_type` ENUM('agent', 'customer', 'system') NOT NULL,
    `sender_name` VARCHAR(100) NULL,
    `sender_id` VARCHAR(50) NULL,
    `content` TEXT NOT NULL,
    `content_type` ENUM('text', 'image', 'file', 'audio', 'video') NOT NULL DEFAULT 'text',
    `timestamp` DATETIME(0) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_content_type`(`content_type`),
    INDEX `idx_sender_id`(`sender_id`),
    INDEX `idx_sender_type`(`sender_type`),
    INDEX `idx_session_id`(`session_id`),
    INDEX `idx_timestamp`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `shift_id` INTEGER NULL,
    `schedule_date` DATE NOT NULL,
    `is_rest_day` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_date`(`schedule_date`),
    INDEX `idx_shift_id`(`shift_id`),
    UNIQUE INDEX `uk_employee_date`(`employee_id`, `schedule_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_schedules_backup` (
    `id` INTEGER NOT NULL DEFAULT 0,
    `employee_id` INTEGER NOT NULL,
    `shift_id` INTEGER NULL,
    `schedule_date` DATE NOT NULL,
    `is_rest_day` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_schedules_backup_20251113` (
    `id` INTEGER NOT NULL DEFAULT 0,
    `employee_id` INTEGER NOT NULL,
    `shift_id` INTEGER NULL,
    `schedule_date` DATE NOT NULL,
    `is_rest_day` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_schedules_backup_before_date_fix` (
    `id` INTEGER NOT NULL DEFAULT 0,
    `employee_id` INTEGER NOT NULL,
    `shift_id` INTEGER NULL,
    `schedule_date` DATE NOT NULL,
    `is_rest_day` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_schedules_backup_comprehensive` (
    `id` INTEGER NOT NULL DEFAULT 0,
    `employee_id` INTEGER NOT NULL,
    `shift_id` INTEGER NULL,
    `schedule_date` DATE NOT NULL,
    `is_rest_day` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_schedules_backup_simple` (
    `id` INTEGER NOT NULL DEFAULT 0,
    `employee_id` INTEGER NOT NULL,
    `shift_id` INTEGER NULL,
    `schedule_date` DATE NOT NULL,
    `is_rest_day` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `start_time` TIME(0) NOT NULL,
    `end_time` TIME(0) NOT NULL,
    `break_duration` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(7) NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_end_time`(`end_time`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_name`(`name`),
    INDEX `idx_start_time`(`start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shops` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `platform_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `platform_id`(`platform_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `special_approval_group_members` (
    `group_id` INTEGER NOT NULL,
    `member_type` ENUM('role', 'user') NOT NULL,
    `member_id` INTEGER NOT NULL,

    PRIMARY KEY (`group_id`, `member_type`, `member_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `special_approval_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tag_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parent_id` INTEGER NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `path` VARCHAR(500) NULL,
    `name` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_name`(`name`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_level`(`level`),
    INDEX `idx_parent_id`(`parent_id`),
    INDEX `idx_path`(`path`(255)),
    INDEX `idx_sort_order`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parent_id` INTEGER NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `path` VARCHAR(500) NULL,
    `name` VARCHAR(50) NOT NULL,
    `tag_type` ENUM('quality', 'case', 'general') NOT NULL DEFAULT 'general',
    `category_id` INTEGER NULL,
    `color` VARCHAR(7) NULL,
    `description` TEXT NULL,
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_category_id`(`category_id`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_level`(`level`),
    INDEX `idx_name`(`name`),
    INDEX `idx_parent_id`(`parent_id`),
    INDEX `idx_path`(`path`(255)),
    INDEX `idx_tag_type`(`tag_type`),
    INDEX `idx_usage_count`(`usage_count`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticket_id` INTEGER NOT NULL,
    `operator_id` INTEGER NOT NULL,
    `action` VARCHAR(50) NULL,
    `content` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `operator_id`(`operator_id`),
    INDEX `ticket_id`(`ticket_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticket_no` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `customer_id` INTEGER NOT NULL,
    `status` ENUM('open', 'pending', 'resolved', 'closed') NULL DEFAULT 'open',
    `priority` ENUM('low', 'medium', 'high', 'critical') NULL DEFAULT 'medium',
    `category` VARCHAR(50) NULL,
    `creator_id` INTEGER NOT NULL,
    `assignee_id` INTEGER NULL,
    `assignee_dept_id` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `resolved_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `ticket_no`(`ticket_no`),
    INDEX `assignee_dept_id`(`assignee_dept_id`),
    INDEX `assignee_id`(`assignee_id`),
    INDEX `creator_id`(`creator_id`),
    INDEX `customer_id`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_case_favorites` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `case_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `case_id`(`case_id`),
    UNIQUE INDEX `user_id`(`user_id`, `case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `department_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_department_id`(`department_id`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_user_department`(`user_id`, `department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_notification_settings` (
    `user_id` INTEGER NOT NULL,
    `receive_system` BOOLEAN NULL DEFAULT true,
    `receive_department` BOOLEAN NULL DEFAULT true,
    `sound_on` BOOLEAN NULL DEFAULT true,
    `dnd_start` VARCHAR(5) NULL,
    `dnd_end` VARCHAR(5) NULL,
    `toast_duration` INTEGER NULL DEFAULT 5000,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,
    `assigned_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `assigned_by` INTEGER NULL,

    INDEX `idx_assigned_by`(`assigned_by`),
    INDEX `idx_role_id`(`role_id`),
    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_user_role`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `message_notification` BOOLEAN NOT NULL DEFAULT true,
    `sound_enabled` BOOLEAN NOT NULL DEFAULT true,
    `do_not_disturb_start` TIME(0) NULL,
    `do_not_disturb_end` TIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    `status` ENUM('active', 'inactive', 'pending', 'resigned', 'deleted') NULL DEFAULT 'pending',
    `approval_note` TEXT NULL,
    `last_login` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `session_token` VARCHAR(500) NULL,
    `session_created_at` DATETIME(0) NULL,
    `is_department_manager` BOOLEAN NULL DEFAULT false,
    `id_card_front_url` VARCHAR(500) NULL,
    `id_card_back_url` VARCHAR(500) NULL,

    UNIQUE INDEX `uk_username`(`username`),
    UNIQUE INDEX `uk_email`(`email`),
    UNIQUE INDEX `uk_phone`(`phone`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_department_id`(`department_id`),
    INDEX `idx_dept_status`(`department_id`, `status`),
    INDEX `idx_real_name`(`real_name`),
    INDEX `idx_session_token`(`session_token`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `operation_type` ENUM('leave_apply', 'leave_approve', 'leave_reject', 'overtime_apply', 'overtime_approve', 'compensatory_request', 'compensatory_approve', 'balance_adjust', 'overtime_convert') NULL,
    `operation_detail` JSON NULL,
    `balance_before` JSON NULL,
    `balance_after` JSON NULL,
    `operator_id` INTEGER NULL,
    `ip_address` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_employee_id`(`employee_id`),
    INDEX `idx_operation_type`(`operation_type`),
    INDEX `idx_operator_id`(`operator_id`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_balance_changes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `change_type` ENUM('addition', 'deduction', 'conversion', 'adjustment') NOT NULL,
    `leave_type` VARCHAR(50) NULL,
    `amount` DECIMAL(5, 2) NOT NULL,
    `balance_before` DECIMAL(5, 2) NULL,
    `balance_after` DECIMAL(5, 2) NULL,
    `reason` TEXT NULL,
    `reference_id` INTEGER NULL,
    `reference_type` VARCHAR(50) NULL,
    `approval_number` VARCHAR(50) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_change_type`(`change_type`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_employee_year`(`employee_id`, `year`),
    INDEX `idx_reference`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `annual_leave_total` DECIMAL(5, 2) NULL DEFAULT 5.00,
    `annual_leave_used` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `sick_leave_total` DECIMAL(5, 2) NULL DEFAULT 10.00,
    `sick_leave_used` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `compensatory_leave_total` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `compensatory_leave_used` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `overtime_leave_total` DECIMAL(5, 1) NULL DEFAULT 0.0,
    `overtime_leave_used` DECIMAL(5, 1) NULL DEFAULT 0.0,
    `overtime_hours_total` DECIMAL(6, 2) NULL DEFAULT 0.00,
    `overtime_hours_converted` DECIMAL(6, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `total_days` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `last_updated` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `expiry_date` DATE NULL,

    INDEX `idx_expiry_date`(`expiry_date`),
    INDEX `idx_user_year`(`user_id`, `year`),
    INDEX `idx_year`(`year`),
    UNIQUE INDEX `unique_employee_year`(`employee_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_conversions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `source_type` VARCHAR(50) NULL DEFAULT 'overtime',
    `source_hours` DECIMAL(10, 2) NULL,
    `converted_days` DECIMAL(10, 2) NOT NULL,
    `remaining_days` DECIMAL(10, 2) NOT NULL,
    `conversion_ratio` DECIMAL(10, 4) NULL,
    `conversion_rule_id` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_employee`(`employee_id`),
    INDEX `idx_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `setting_key`(`setting_key`),
    INDEX `idx_setting_key`(`setting_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_type_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `vacation_type_id` INTEGER NOT NULL,
    `total_days` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `used_days` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `conversion_date` DATE NULL,
    `remaining_carryover_days` DECIMAL(5, 2) NULL DEFAULT 0.00,

    INDEX `idx_employee_year`(`employee_id`, `year`),
    INDEX `idx_vacation_type`(`vacation_type_id`),
    UNIQUE INDEX `unique_employee_year_type`(`employee_id`, `year`, `vacation_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vacation_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `base_days` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `included_in_total` BOOLEAN NULL DEFAULT true,
    `description` TEXT NULL,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `is_pinned` BOOLEAN NULL DEFAULT false,
    `sort_order` INTEGER NULL DEFAULT 999,

    UNIQUE INDEX `code`(`code`),
    INDEX `idx_code`(`code`),
    INDEX `idx_enabled`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `start_time` TIME(0) NOT NULL,
    `end_time` TIME(0) NOT NULL,
    `work_hours` DECIMAL(3, 1) NOT NULL,
    `rest_duration` INTEGER NULL DEFAULT 60,
    `late_threshold` INTEGER NULL,
    `early_threshold` INTEGER NULL,
    `use_global_threshold` BOOLEAN NULL DEFAULT false,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `department_id` INTEGER NULL,
    `description` VARCHAR(500) NULL,
    `color` VARCHAR(20) NULL DEFAULT '#3B82F6',

    INDEX `idx_department`(`department_id`),
    INDEX `idx_is_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `async_task_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `job_id` VARCHAR(255) NOT NULL,
    `queue_name` VARCHAR(50) NOT NULL,
    `task_type` VARCHAR(100) NOT NULL,
    `status` ENUM('waiting', 'active', 'completed', 'failed') NULL DEFAULT 'waiting',
    `progress` INTEGER NULL DEFAULT 0,
    `operator_id` INTEGER NULL,
    `payload` JSON NULL,
    `result` JSON NULL,
    `error_msg` TEXT NULL,
    `started_at` DATETIME(0) NULL,
    `completed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_job_id`(`job_id`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `answer_records` ADD CONSTRAINT `fk_answer_records_result_id` FOREIGN KEY (`result_id`) REFERENCES `assessment_results`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `approval_records` ADD CONSTRAINT `fk_records_approver` FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `approval_records` ADD CONSTRAINT `fk_records_reimbursement` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `approval_workflow_nodes` ADD CONSTRAINT `fk_nodes_approver` FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `approval_workflow_nodes` ADD CONSTRAINT `fk_nodes_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `approval_workflow_nodes` ADD CONSTRAINT `fk_nodes_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `approval_workflows` ADD CONSTRAINT `fk_workflows_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `approvers` ADD CONSTRAINT `fk_approvers_delegate` FOREIGN KEY (`delegate_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `approvers` ADD CONSTRAINT `fk_approvers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `article_comments` ADD CONSTRAINT `article_comments_ibfk_1` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `article_comments` ADD CONSTRAINT `article_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `article_comments` ADD CONSTRAINT `article_comments_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `article_comments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assessment_plans` ADD CONSTRAINT `fk_assessment_plans_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assessment_plans` ADD CONSTRAINT `fk_assessment_plans_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assessment_results` ADD CONSTRAINT `fk_assessment_results_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assessment_results` ADD CONSTRAINT `fk_assessment_results_plan_id` FOREIGN KEY (`plan_id`) REFERENCES `assessment_plans`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assessment_results` ADD CONSTRAINT `fk_assessment_results_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_components` ADD CONSTRAINT `fk_comp_type` FOREIGN KEY (`type_id`) REFERENCES `asset_component_types`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_model_templates` ADD CONSTRAINT `asset_model_templates_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `asset_models`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_model_templates` ADD CONSTRAINT `fk_template_component` FOREIGN KEY (`component_id`) REFERENCES `asset_components`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_models` ADD CONSTRAINT `asset_models_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_models` ADD CONSTRAINT `fk_model_form` FOREIGN KEY (`form_id`) REFERENCES `asset_device_forms`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `asset_requests_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `asset_requests_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `asset_requests_ibfk_3` FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `fk_req_comp_type` FOREIGN KEY (`target_component_type_id`) REFERENCES `asset_component_types`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_upgrades` ADD CONSTRAINT `asset_upgrades_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_upgrades` ADD CONSTRAINT `asset_upgrades_ibfk_2` FOREIGN KEY (`component_type_id`) REFERENCES `asset_component_types`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_upgrades` ADD CONSTRAINT `asset_upgrades_ibfk_3` FOREIGN KEY (`old_component_id`) REFERENCES `asset_components`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_upgrades` ADD CONSTRAINT `asset_upgrades_ibfk_4` FOREIGN KEY (`new_component_id`) REFERENCES `asset_components`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `asset_upgrades` ADD CONSTRAINT `asset_upgrades_ibfk_5` FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_ibfk_2` FOREIGN KEY (`current_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `fk_assets_model` FOREIGN KEY (`model_id`) REFERENCES `asset_models`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `fk_attendance_records_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `broadcast_recipients` ADD CONSTRAINT `broadcast_recipients_ibfk_1` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `broadcast_recipients` ADD CONSTRAINT `broadcast_recipients_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_ibfk_1` FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `case_attachments` ADD CONSTRAINT `case_attachments_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `case_categories` ADD CONSTRAINT `case_categories_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `case_categories`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `case_comments` ADD CONSTRAINT `case_comments_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `case_comments` ADD CONSTRAINT `case_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `case_comments` ADD CONSTRAINT `case_comments_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `case_comments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `case_learning_records` ADD CONSTRAINT `case_learning_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `case_learning_records` ADD CONSTRAINT `case_learning_records_ibfk_2` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `case_tags` ADD CONSTRAINT `fk_case_tags_case_id` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `case_tags` ADD CONSTRAINT `fk_case_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `fk_cases_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_group_members` ADD CONSTRAINT `chat_group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `chat_groups`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_group_members` ADD CONSTRAINT `chat_group_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_groups` ADD CONSTRAINT `chat_groups_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_groups` ADD CONSTRAINT `chat_groups_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `chat_groups`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_ibfk_3` FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_room_members` ADD CONSTRAINT `fk_chat_room_members_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `conversation_members` ADD CONSTRAINT `fk_conv_members_conv` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_members` ADD CONSTRAINT `fk_conv_members_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_creator` FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_customers` ADD CONSTRAINT `crm_customers_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `fk_customers_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `fk_customers_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `fk_departments_manager_id` FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `fk_departments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `device_component_mapping` ADD CONSTRAINT `device_component_mapping_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `device_component_mapping` ADD CONSTRAINT `device_component_mapping_ibfk_2` FOREIGN KEY (`component_id`) REFERENCES `asset_components`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `device_config_details` ADD CONSTRAINT `device_config_details_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `device_config_details` ADD CONSTRAINT `device_config_details_ibfk_2` FOREIGN KEY (`component_type_id`) REFERENCES `asset_component_types`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `device_config_details` ADD CONSTRAINT `device_config_details_ibfk_3` FOREIGN KEY (`component_id`) REFERENCES `asset_components`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `asset_models`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_ibfk_2` FOREIGN KEY (`current_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employee_status_records` ADD CONSTRAINT `fk_employee_status_records_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employee_status_records` ADD CONSTRAINT `fk_employee_status_records_new_dept` FOREIGN KEY (`new_department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employee_status_records` ADD CONSTRAINT `fk_employee_status_records_old_dept` FOREIGN KEY (`old_department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employee_status_records` ADD CONSTRAINT `fk_employee_status_records_operated_by` FOREIGN KEY (`operated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `fk_employees_position` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `fk_employees_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `fk_exams_category_id` FOREIGN KEY (`category_id`) REFERENCES `exam_categories`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `fk_exams_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `external_agents` ADD CONSTRAINT `fk_external_agents_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `external_agents` ADD CONSTRAINT `fk_external_agents_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `fk_group_members_group` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `fk_group_members_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `fk_groups_owner` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_audits` ADD CONSTRAINT `inventory_audits_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_audits` ADD CONSTRAINT `inventory_audits_ibfk_2` FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_usage` ADD CONSTRAINT `inventory_usage_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_usage` ADD CONSTRAINT `inventory_usage_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `knowledge_article_daily_stats` ADD CONSTRAINT `fk_daily_stats_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `knowledge_article_read_sessions` ADD CONSTRAINT `fk_read_sessions_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `knowledge_article_read_sessions` ADD CONSTRAINT `fk_read_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `fk_art_category` FOREIGN KEY (`category_id`) REFERENCES `knowledge_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_attachments` ADD CONSTRAINT `fk_att_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_learning_plan_records` ADD CONSTRAINT `knowledge_learning_plan_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `knowledge_learning_plan_records` ADD CONSTRAINT `knowledge_learning_plan_records_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `learning_plans`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `knowledge_learning_plans` ADD CONSTRAINT `fk_knowledge_learning_plans_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `knowledge_learning_statistics` ADD CONSTRAINT `fk_knowledge_learning_statistics_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `learning_plans` ADD CONSTRAINT `learning_plans_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `learning_plans` ADD CONSTRAINT `learning_plans_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `learning_plans` ADD CONSTRAINT `learning_plans_ibfk_3` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `learning_statistics` ADD CONSTRAINT `learning_statistics_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `learning_tasks` ADD CONSTRAINT `learning_tasks_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `learning_tasks` ADD CONSTRAINT `learning_tasks_ibfk_2` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `leave_records` ADD CONSTRAINT `fk_leave_records_approved_by` FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `leave_records` ADD CONSTRAINT `fk_leave_records_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `meal_order_items` ADD CONSTRAINT `fk_meal_order_items_menu_item_id` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `meal_order_items` ADD CONSTRAINT `fk_meal_order_items_order_id` FOREIGN KEY (`order_id`) REFERENCES `meal_orders`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `meal_orders` ADD CONSTRAINT `fk_meal_orders_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `memo_recipients` ADD CONSTRAINT `fk_memo_recipients_memo` FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `fk_menu_items_category_id` FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `message_status` ADD CONSTRAINT `fk_msg_status_msg` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_status` ADD CONSTRAINT `fk_msg_status_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_reply_to` FOREIGN KEY (`reply_to_message_id`) REFERENCES `messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `my_knowledge_saved_articles` ADD CONSTRAINT `fk_mk_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_ibfk_1` FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `overtime_conversions` ADD CONSTRAINT `overtime_conversions_ibfk_1` FOREIGN KEY (`target_vacation_type_id`) REFERENCES `vacation_types`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `overtime_conversions` ADD CONSTRAINT `overtime_conversions_ibfk_2` FOREIGN KEY (`conversion_rule_id`) REFERENCES `conversion_rules`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payslip_distribution_settings` ADD CONSTRAINT `fk_distribution_settings_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payslip_import_history` ADD CONSTRAINT `fk_import_history_imported_by` FOREIGN KEY (`imported_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payslip_passwords` ADD CONSTRAINT `fk_payslip_passwords_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payslip_templates` ADD CONSTRAINT `fk_payslip_templates_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `fk_payslips_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `fk_payslips_issued_by` FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `fk_payslips_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `positions` ADD CONSTRAINT `fk_positions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `positions` ADD CONSTRAINT `fk_positions_department` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `positions` ADD CONSTRAINT `fk_positions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `procurement_records` ADD CONSTRAINT `procurement_records_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `procurement_records` ADD CONSTRAINT `procurement_records_ibfk_2` FOREIGN KEY (`purchaser_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_attachments` ADD CONSTRAINT `fk_quality_case_attachments_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_collections` ADD CONSTRAINT `fk_quality_case_collections_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_comments` ADD CONSTRAINT `fk_quality_case_comments_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_favorites` ADD CONSTRAINT `quality_case_favorites_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_favorites` ADD CONSTRAINT `quality_case_favorites_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_learning_records` ADD CONSTRAINT `fk_quality_case_learning_records_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_likes` ADD CONSTRAINT `quality_case_likes_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_likes` ADD CONSTRAINT `quality_case_likes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_tags` ADD CONSTRAINT `fk_quality_case_tags_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_views` ADD CONSTRAINT `quality_case_views_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_case_views` ADD CONSTRAINT `quality_case_views_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_message_tags` ADD CONSTRAINT `fk_quality_message_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_message_tags` ADD CONSTRAINT `fk_quality_message_tags_message_id` FOREIGN KEY (`message_id`) REFERENCES `session_messages`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_message_tags` ADD CONSTRAINT `fk_quality_message_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_rules` ADD CONSTRAINT `fk_quality_rules_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_scores` ADD CONSTRAINT `fk_quality_scores_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_scores` ADD CONSTRAINT `fk_quality_scores_rule_id` FOREIGN KEY (`rule_id`) REFERENCES `quality_rules`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_scores` ADD CONSTRAINT `fk_quality_scores_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_session_tags` ADD CONSTRAINT `fk_quality_session_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_session_tags` ADD CONSTRAINT `fk_quality_session_tags_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_session_tags` ADD CONSTRAINT `fk_quality_session_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_sessions` ADD CONSTRAINT `fk_quality_sessions_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_sessions` ADD CONSTRAINT `fk_quality_sessions_external_agent_id` FOREIGN KEY (`external_agent_id`) REFERENCES `external_agents`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_sessions` ADD CONSTRAINT `fk_quality_sessions_inspector_id` FOREIGN KEY (`inspector_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_sessions` ADD CONSTRAINT `fk_quality_sessions_platform_id` FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_sessions` ADD CONSTRAINT `fk_quality_sessions_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quality_tags` ADD CONSTRAINT `fk_quality_tags_category_id` FOREIGN KEY (`category_id`) REFERENCES `quality_tag_categories`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `fk_questions_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reimbursement_attachments` ADD CONSTRAINT `fk_attachments_item` FOREIGN KEY (`item_id`) REFERENCES `reimbursement_items`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reimbursement_attachments` ADD CONSTRAINT `fk_attachments_reimbursement` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reimbursement_items` ADD CONSTRAINT `fk_items_reimbursement` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reimbursements` ADD CONSTRAINT `fk_reimbursements_department` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reimbursements` ADD CONSTRAINT `fk_reimbursements_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reimbursements` ADD CONSTRAINT `fk_reimbursements_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_departments` ADD CONSTRAINT `fk_role_departments_department` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_departments` ADD CONSTRAINT `fk_role_departments_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `fk_role_permissions_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `fk_role_permissions_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_workflows` ADD CONSTRAINT `fk_role_workflows_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_workflows` ADD CONSTRAINT `fk_role_workflows_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `fk_schedules_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `fk_schedules_shift_id` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `fk_schedules_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `session_messages` ADD CONSTRAINT `fk_session_messages_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `shift_schedules` ADD CONSTRAINT `fk_shift_schedules_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `shift_schedules` ADD CONSTRAINT `fk_shift_schedules_shift` FOREIGN KEY (`shift_id`) REFERENCES `work_shifts`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `shops` ADD CONSTRAINT `fk_shops_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `special_approval_group_members` ADD CONSTRAINT `special_approval_group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `special_approval_groups`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tag_categories` ADD CONSTRAINT `fk_tag_categories_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tag_categories`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `fk_tags_category_id` FOREIGN KEY (`category_id`) REFERENCES `tag_categories`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `fk_tags_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ticket_logs` ADD CONSTRAINT `ticket_logs_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ticket_logs` ADD CONSTRAINT `ticket_logs_ibfk_2` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_ibfk_2` FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_ibfk_3` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_ibfk_4` FOREIGN KEY (`assignee_dept_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_case_favorites` ADD CONSTRAINT `user_case_favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_case_favorites` ADD CONSTRAINT `user_case_favorites_ibfk_2` FOREIGN KEY (`case_id`) REFERENCES `quality_cases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_departments` ADD CONSTRAINT `fk_user_departments_department` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_departments` ADD CONSTRAINT `fk_user_departments_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_notification_settings` ADD CONSTRAINT `user_notification_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `fk_user_roles_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `fk_user_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `fk_user_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `fk_user_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `fk_users_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `vacation_balance_changes` ADD CONSTRAINT `vacation_balance_changes_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `vacation_type_balances` ADD CONSTRAINT `vacation_type_balances_ibfk_1` FOREIGN KEY (`vacation_type_id`) REFERENCES `vacation_types`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- >>> MANUAL_PERMISSION_AND_DATA_CHANGES_START
-- Add permission seed SQL, role-permission mappings, or other manual data migration statements here.
-- This block is preserved when `npm run schema:generate-sql` regenerates the DDL above.
-- Example:
-- INSERT INTO `permissions` (`name`, `code`, `module`, `resource`, `action`) VALUES ('角色查看', 'system:role:view', 'system', 'role', 'view');
-- >>> MANUAL_PERMISSION_AND_DATA_CHANGES_END
