-- ==========================================
-- 客服管理系统 - 纯净数据库初始化脚本
-- 生成时间: 2025/11/25 16:43:59
-- 说明: 仅包含表结构和一个超级管理员账号
-- ==========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS leixin_customer_service DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE leixin_customer_service;

-- 删除所有表（如果存在）
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `answer_records`;
DROP TABLE IF EXISTS `article_comments`;
DROP TABLE IF EXISTS `article_likes`;
DROP TABLE IF EXISTS `assessment_plans`;
DROP TABLE IF EXISTS `assessment_results`;
DROP TABLE IF EXISTS `attendance_records`;
DROP TABLE IF EXISTS `attendance_rules`;
DROP TABLE IF EXISTS `attendance_settings`;
DROP TABLE IF EXISTS `case_attachments`;
DROP TABLE IF EXISTS `case_comments`;
DROP TABLE IF EXISTS `case_learning_records`;
DROP TABLE IF EXISTS `case_tags`;
DROP TABLE IF EXISTS `cases`;
DROP TABLE IF EXISTS `chat_room_members`;
DROP TABLE IF EXISTS `collected_messages`;
DROP TABLE IF EXISTS `compensatory_leave_requests`;
DROP TABLE IF EXISTS `conversation_members`;
DROP TABLE IF EXISTS `conversations`;
DROP TABLE IF EXISTS `conversion_rules`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `employee_changes`;
DROP TABLE IF EXISTS `employee_status_records`;
DROP TABLE IF EXISTS `employee_work_duration`;
DROP TABLE IF EXISTS `employees`;
DROP TABLE IF EXISTS `exam_categories`;
DROP TABLE IF EXISTS `exam_category_audit_logs`;
DROP TABLE IF EXISTS `exams`;
DROP TABLE IF EXISTS `group_members`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `holidays`;
DROP TABLE IF EXISTS `knowledge_article_daily_stats`;
DROP TABLE IF EXISTS `knowledge_article_read_sessions`;
DROP TABLE IF EXISTS `knowledge_articles`;
DROP TABLE IF EXISTS `knowledge_attachments`;
DROP TABLE IF EXISTS `knowledge_categories`;
DROP TABLE IF EXISTS `knowledge_learning_plan_records`;
DROP TABLE IF EXISTS `knowledge_learning_plans`;
DROP TABLE IF EXISTS `knowledge_learning_statistics`;
DROP TABLE IF EXISTS `learning_plans`;
DROP TABLE IF EXISTS `learning_statistics`;
DROP TABLE IF EXISTS `learning_tasks`;
DROP TABLE IF EXISTS `leave_records`;
DROP TABLE IF EXISTS `makeup_records`;
DROP TABLE IF EXISTS `meal_order_items`;
DROP TABLE IF EXISTS `meal_orders`;
DROP TABLE IF EXISTS `menu_categories`;
DROP TABLE IF EXISTS `menu_items`;
DROP TABLE IF EXISTS `message_status`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `migrations_history`;
DROP TABLE IF EXISTS `my_knowledge_articles`;
DROP TABLE IF EXISTS `my_knowledge_categories`;
DROP TABLE IF EXISTS `my_knowledge_saved_articles`;
DROP TABLE IF EXISTS `notification_recipients`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `overtime_conversions`;
DROP TABLE IF EXISTS `overtime_records`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `platforms`;
DROP TABLE IF EXISTS `positions`;
DROP TABLE IF EXISTS `quality_case_attachments`;
DROP TABLE IF EXISTS `quality_case_collections`;
DROP TABLE IF EXISTS `quality_case_comments`;
DROP TABLE IF EXISTS `quality_case_learning_records`;
DROP TABLE IF EXISTS `quality_case_tags`;
DROP TABLE IF EXISTS `quality_cases`;
DROP TABLE IF EXISTS `quality_rules`;
DROP TABLE IF EXISTS `quality_scores`;
DROP TABLE IF EXISTS `quality_sessions`;
DROP TABLE IF EXISTS `questions`;
DROP TABLE IF EXISTS `role_departments`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `schedules`;
DROP TABLE IF EXISTS `session_messages`;
DROP TABLE IF EXISTS `shift_schedules`;
DROP TABLE IF EXISTS `shift_schedules_backup`;
DROP TABLE IF EXISTS `shift_schedules_backup_20251113`;
DROP TABLE IF EXISTS `shift_schedules_backup_before_date_fix`;
DROP TABLE IF EXISTS `shift_schedules_backup_comprehensive`;
DROP TABLE IF EXISTS `shift_schedules_backup_simple`;
DROP TABLE IF EXISTS `shifts`;
DROP TABLE IF EXISTS `shops`;
DROP TABLE IF EXISTS `tag_categories`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `user_case_favorites`;
DROP TABLE IF EXISTS `user_notification_settings`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `user_settings`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `vacation_audit_logs`;
DROP TABLE IF EXISTS `vacation_balance_changes`;
DROP TABLE IF EXISTS `vacation_balances`;
DROP TABLE IF EXISTS `vacation_settings`;
DROP TABLE IF EXISTS `vacation_type_balances`;
DROP TABLE IF EXISTS `vacation_types`;
DROP TABLE IF EXISTS `work_shifts`;

-- SET FOREIGN_KEY_CHECKS = 1; -- Will be enabled at the end


-- ==========================================
-- 创建表结构
-- ==========================================

-- 表: answer_records
CREATE TABLE `answer_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '答题记录唯一标识ID',
  `result_id` int NOT NULL COMMENT '考核结果ID，关联assessment_results表，级联删除',
  `question_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题目ID，支持临时ID(temp_前缀)和正式ID',
  `user_answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '用户答案，根据题型格式不同',
  `is_correct` tinyint(1) DEFAULT NULL COMMENT '是否正确：1-正确，0-错误，NULL-未评分',
  `score` decimal(5,2) DEFAULT NULL COMMENT '该题得分',
  `time_spent` int DEFAULT NULL COMMENT '答题用时，单位秒',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_result_question` (`result_id`,`question_id`),
  KEY `idx_result_id` (`result_id`),
  KEY `idx_is_correct` (`is_correct`),
  KEY `idx_score` (`score`),
  KEY `idx_time_spent` (`time_spent`),
  KEY `idx_question_id` (`question_id`),
  CONSTRAINT `fk_answer_records_result_id` FOREIGN KEY (`result_id`) REFERENCES `assessment_results` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=134 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='答题记录表-存储用户的具体答题记录';

-- 表: article_comments
CREATE TABLE `article_comments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  `article_id` bigint unsigned NOT NULL COMMENT '文章ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `parent_id` bigint unsigned DEFAULT NULL COMMENT '父评论ID',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '评论内容',
  `like_count` int NOT NULL DEFAULT '0' COMMENT '点赞数',
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否置顶',
  `status` enum('active','deleted') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '评论状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`),
  CONSTRAINT `article_comments_ibfk_1` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `article_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `article_comments_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `article_comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: article_likes
CREATE TABLE `article_likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `article_id` int NOT NULL,
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_like` (`article_id`,`user_id`),
  KEY `idx_article` (`article_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: assessment_plans
CREATE TABLE `assessment_plans` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '考核计划唯一标识ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '计划标题，如"2024年第一季度考核"',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '计划详细描述，说明考核目的和要求',
  `exam_id` int NOT NULL COMMENT '关联的试卷ID，关联exams表，级联删除',
  `target_users` json DEFAULT NULL COMMENT '目标用户列表，JSON格式存储用户ID数组',
  `target_departments` json DEFAULT NULL COMMENT '目标部门ID列表（JSON数组）',
  `start_time` datetime NOT NULL COMMENT '考核开始时间',
  `end_time` datetime NOT NULL COMMENT '考核结束时间',
  `max_attempts` int NOT NULL DEFAULT '1' COMMENT '最大尝试次数，防止无限重考',
  `status` enum('draft','published','ongoing','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '计划状态：draft-草稿，published-已发布，ongoing-进行中，completed-已完成，cancelled-已取消',
  `created_by` int DEFAULT NULL COMMENT '创建人用户ID，关联users表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `is_deleted` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_title` (`title`),
  KEY `idx_exam_id` (`exam_id`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_end_time` (`end_time`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_time_range` (`start_time`,`end_time`),
  CONSTRAINT `fk_assessment_plans_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assessment_plans_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='考核计划表-存储考核计划的安排和配置信息';

-- 表: assessment_results
CREATE TABLE `assessment_results` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '考核结果唯一标识ID',
  `plan_id` int NOT NULL COMMENT '考核计划ID，关联assessment_plans表，级联删除',
  `exam_id` int NOT NULL COMMENT '试卷ID，关联exams表，级联删除',
  `user_id` int NOT NULL COMMENT '考试用户ID，关联users表，级联删除',
  `attempt_number` int NOT NULL DEFAULT '1' COMMENT '尝试次数，第几次考试',
  `start_time` datetime NOT NULL COMMENT '考试开始时间',
  `submit_time` datetime DEFAULT NULL COMMENT '提交时间，NULL表示未提交',
  `duration` int DEFAULT NULL COMMENT '实际用时，单位秒',
  `score` decimal(5,2) DEFAULT NULL COMMENT '考试得分',
  `is_passed` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否通过：1-通过，0-未通过',
  `status` enum('in_progress','submitted','graded','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'in_progress' COMMENT '考试状态：in_progress-进行中，submitted-已提交，graded-已评分，expired-已过期',
  `answers` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_plan_id` (`plan_id`),
  KEY `idx_exam_id` (`exam_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_attempt_number` (`attempt_number`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_submit_time` (`submit_time`),
  KEY `idx_duration` (`duration`),
  KEY `idx_score` (`score`),
  KEY `idx_is_passed` (`is_passed`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_assessment_results_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_results_plan_id` FOREIGN KEY (`plan_id`) REFERENCES `assessment_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_results_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='考核结果表-存储用户的考试结果和成绩信息';

-- 表: attendance_records
CREATE TABLE `attendance_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '考勤记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '员工用户ID，关联users表，级联删除',
  `attendance_date` date NOT NULL COMMENT '考勤日期，YYYY-MM-DD格式',
  `check_in_time` datetime DEFAULT NULL COMMENT '签到时间，精确到秒',
  `check_out_time` datetime DEFAULT NULL COMMENT '签退时间，精确到秒',
  `work_hours` decimal(5,2) DEFAULT NULL COMMENT '实际工作时长，单位小时，自动计算',
  `overtime_hours` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '加班时长，单位小时',
  `status` enum('normal','late','early_leave','absent','overtime') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal' COMMENT '考勤状态：normal-正常，late-迟到，early_leave-早退，absent-缺勤，overtime-加班',
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '考勤备注，异常情况说明',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `clock_out_time` datetime DEFAULT NULL,
  `clock_out_location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employee_id` int NOT NULL,
  `record_date` date NOT NULL,
  `clock_in_time` datetime DEFAULT NULL,
  `clock_in_location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_overtime` tinyint(1) DEFAULT '0',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`,`attendance_date`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_attendance_date` (`attendance_date`),
  KEY `idx_check_in_time` (`check_in_time`),
  KEY `idx_check_out_time` (`check_out_time`),
  KEY `idx_status` (`status`),
  KEY `idx_user_date_status` (`user_id`,`attendance_date`,`status`),
  KEY `idx_employee_date` (`employee_id`,`record_date`),
  CONSTRAINT `fk_attendance_records_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='考勤记录表-员工考勤打卡记录表，记录每日的签到签退信息';

-- 表: attendance_rules
CREATE TABLE `attendance_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(100) NOT NULL COMMENT '规则名称',
  `rule_type` varchar(50) NOT NULL COMMENT '规则类型',
  `rule_value` json DEFAULT NULL COMMENT '规则值',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rule_type` (`rule_type`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='考勤规则表';

-- 表: attendance_settings
CREATE TABLE `attendance_settings` (
  `id` int NOT NULL,
  `enable_location_check` tinyint(1) NOT NULL DEFAULT '0',
  `allowed_distance` int NOT NULL DEFAULT '500',
  `allowed_locations` text,
  `enable_time_check` tinyint(1) NOT NULL DEFAULT '1',
  `early_clock_in_minutes` int NOT NULL DEFAULT '60',
  `late_clock_out_minutes` int NOT NULL DEFAULT '120',
  `late_minutes` int NOT NULL DEFAULT '30',
  `early_leave_minutes` int NOT NULL DEFAULT '30',
  `absent_hours` int NOT NULL DEFAULT '4',
  `max_annual_leave_days` int NOT NULL DEFAULT '10',
  `max_sick_leave_days` int NOT NULL DEFAULT '15',
  `require_proof_for_sick_leave` tinyint(1) NOT NULL DEFAULT '1',
  `require_approval_for_overtime` tinyint(1) NOT NULL DEFAULT '1',
  `min_overtime_hours` decimal(4,1) NOT NULL DEFAULT '1.0',
  `max_overtime_hours_per_day` int NOT NULL DEFAULT '4',
  `allow_makeup` tinyint(1) NOT NULL DEFAULT '1',
  `makeup_deadline_days` int NOT NULL DEFAULT '3',
  `require_approval_for_makeup` tinyint(1) NOT NULL DEFAULT '1',
  `notify_on_late` tinyint(1) NOT NULL DEFAULT '1',
  `notify_on_early_leave` tinyint(1) NOT NULL DEFAULT '1',
  `notify_on_absent` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 表: case_attachments
CREATE TABLE `case_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL COMMENT '案例ID',
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名称',
  `file_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件类型 (e.g., image/jpeg, application/pdf)',
  `file_size` int DEFAULT NULL COMMENT '文件大小 (bytes)',
  `file_url` varchar(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件存储URL',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `case_id` (`case_id`),
  CONSTRAINT `case_attachments_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: case_comments
CREATE TABLE `case_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL COMMENT '案例ID',
  `user_id` int NOT NULL COMMENT '评论用户ID',
  `comment_content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '评论内容',
  `parent_comment_id` int DEFAULT NULL COMMENT '父评论ID (用于回复)',
  `like_count` int DEFAULT '0' COMMENT '点赞次数',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `case_id` (`case_id`),
  KEY `user_id` (`user_id`),
  KEY `parent_comment_id` (`parent_comment_id`),
  CONSTRAINT `case_comments_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `case_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `case_comments_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `case_comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: case_learning_records
CREATE TABLE `case_learning_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `case_id` int NOT NULL,
  `start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration_seconds` int DEFAULT '0',
  `progress_percentage` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`case_id`),
  KEY `case_id` (`case_id`),
  CONSTRAINT `case_learning_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `case_learning_records_ibfk_2` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: case_tags
CREATE TABLE `case_tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录唯一标识ID',
  `case_id` int NOT NULL COMMENT '案例ID，关联cases表，级联删除',
  `tag_id` int NOT NULL COMMENT '标签ID，关联tags表，级联删除',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '关联创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_case_tag` (`case_id`,`tag_id`),
  KEY `idx_case_id` (`case_id`),
  KEY `idx_tag_id` (`tag_id`),
  CONSTRAINT `fk_case_tags_case_id` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例标签关联表-案例与标签的多对多关联表';

-- 表: cases
CREATE TABLE `cases` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '案例唯一标识ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '案例标题，简洁明了的问题描述',
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '案例分类，如"技术问题"、"服务投诉"',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '案例详细描述，问题的具体情况',
  `problem` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '问题描述，客户遇到的具体问题',
  `solution` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '解决方案，详细的处理步骤和方法',
  `difficulty` enum('easy','medium','hard') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium' COMMENT '难度等级：easy-简单，medium-中等，hard-困难',
  `priority` enum('low','medium','high','urgent') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium' COMMENT '优先级：low-低，medium-中，high-高，urgent-紧急',
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '状态：draft-草稿，published-已发布，archived-已归档',
  `view_count` int NOT NULL DEFAULT '0' COMMENT '浏览次数，用于统计热门案例',
  `like_count` int NOT NULL DEFAULT '0' COMMENT '点赞次数，用于评估案例质量',
  `created_by` int DEFAULT NULL COMMENT '创建人用户ID，关联users表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_title` (`title`),
  KEY `idx_category` (`category`),
  KEY `idx_difficulty` (`difficulty`),
  KEY `idx_priority` (`priority`),
  KEY `idx_status` (`status`),
  KEY `idx_view_count` (`view_count`),
  KEY `idx_like_count` (`like_count`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_created_at` (`created_at`),
  FULLTEXT KEY `ft_content_search` (`title`,`description`,`problem`,`solution`),
  CONSTRAINT `fk_cases_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例表-存储知识案例库的案例信息';

-- 表: chat_room_members
CREATE TABLE `chat_room_members` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '成员关系唯一标识ID',
  `room_id` int NOT NULL COMMENT '聊天室ID，关联chat_rooms表，级联删除',
  `user_id` int NOT NULL COMMENT '用户ID，关联users表，级联删除',
  `role` enum('owner','admin','member') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member' COMMENT '成员角色：owner-群主，admin-管理员，member-普通成员',
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `last_read_at` datetime DEFAULT NULL COMMENT '最后阅读时间，用于计算未读消息',
  `is_muted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否静音：1-静音，0-正常',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_user` (`room_id`,`user_id`),
  KEY `idx_room_id` (`room_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role` (`role`),
  KEY `idx_joined_at` (`joined_at`),
  KEY `idx_last_read_at` (`last_read_at`),
  KEY `idx_is_muted` (`is_muted`),
  CONSTRAINT `fk_chat_room_members_room_id` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_room_members_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天室成员表-聊天室成员关系表';

-- 表: collected_messages
CREATE TABLE `collected_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `message_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_message_id` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: compensatory_leave_requests
CREATE TABLE `compensatory_leave_requests` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `request_type` enum('schedule_change','compensatory_leave') DEFAULT 'compensatory_leave' COMMENT '申请类型',
  `original_schedule_date` date DEFAULT NULL COMMENT '原排班日期',
  `original_shift_id` int DEFAULT NULL COMMENT '原班次ID',
  `new_schedule_date` date DEFAULT NULL COMMENT '新排班日期',
  `new_shift_id` int DEFAULT NULL COMMENT '新班次ID',
  `reason` text COMMENT '申请理由',
  `status` enum('pending','approved','rejected','cancelled') DEFAULT 'pending' COMMENT '状态',
  `approver_id` int DEFAULT NULL COMMENT '审批人ID',
  `approval_note` text COMMENT '审批备注',
  `approved_at` timestamp NULL DEFAULT NULL COMMENT '审批时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_employee_id` (`employee_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_approver_id` (`approver_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='调休申请表';

-- 表: conversation_members
CREATE TABLE `conversation_members` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('member','admin','owner') NOT NULL DEFAULT 'member',
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0',
  `is_muted` tinyint(1) NOT NULL DEFAULT '0',
  `unread_count` int unsigned NOT NULL DEFAULT '0',
  `last_read_message_id` bigint unsigned DEFAULT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `left_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conv_member` (`conversation_id`,`user_id`),
  KEY `idx_conv_member_conv` (`conversation_id`),
  KEY `idx_conv_member_user` (`user_id`),
  CONSTRAINT `fk_conv_members_conv` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_conv_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 表: conversations
CREATE TABLE `conversations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `type` enum('single','group','room') NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `description` text,
  `creator_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conv_type` (`type`),
  KEY `idx_conv_creator` (`creator_id`),
  CONSTRAINT `fk_conversations_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 表: conversion_rules
CREATE TABLE `conversion_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_type` varchar(50) NOT NULL COMMENT '来源类型（如：overtime）',
  `target_type` varchar(50) NOT NULL COMMENT '目标类型（如：annual_leave）',
  `conversion_rate` decimal(10,2) NOT NULL COMMENT '转换比例（如：8小时=1天）',
  `enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_source_target` (`source_type`,`target_type`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='额度转换规则表';

-- 表: departments
CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '部门唯一标识ID，自增主键',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '部门名称，如"客服部"、"技术部"',
  `parent_id` int DEFAULT NULL COMMENT '父部门ID，支持多级部门结构，NULL表示顶级部门',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '部门详细描述，包括职责和业务范围',
  `manager_id` int DEFAULT NULL COMMENT '部门经理用户ID，关联users表',
  `status` enum('active','inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '部门状态：active-正常，inactive-停用',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号，用于部门列表排序显示',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_manager_id` (`manager_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_departments_manager_id` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_departments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门表-存储公司组织架构信息，支持多级部门结构';

-- 表: employee_changes
CREATE TABLE `employee_changes` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '变动记录ID',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `change_type` enum('hire','transfer','promotion','resign','terminate') NOT NULL COMMENT '变动类型',
  `change_date` date NOT NULL COMMENT '变动日期',
  `old_department_id` int DEFAULT NULL COMMENT '原部门ID',
  `new_department_id` int DEFAULT NULL COMMENT '新部门ID',
  `old_position` varchar(50) DEFAULT NULL COMMENT '原职位',
  `new_position` varchar(50) DEFAULT NULL COMMENT '新职位',
  `reason` text COMMENT '变动原因',
  `remarks` text COMMENT '备注',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `user_id` (`user_id`),
  KEY `change_type` (`change_type`),
  KEY `change_date` (`change_date`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='员工变动记录表';

-- 表: employee_status_records
CREATE TABLE `employee_status_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '记录唯一标识ID',
  `employee_id` int NOT NULL COMMENT '员工ID，关联users表',
  `old_status` enum('active','inactive','resigned') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '原状态',
  `new_status` enum('active','inactive','resigned') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '新状态',
  `old_department_id` int DEFAULT NULL COMMENT '原部门ID',
  `new_department_id` int DEFAULT NULL COMMENT '新部门ID',
  `change_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '变更原因',
  `change_date` date NOT NULL COMMENT '变更日期',
  `work_duration_days` int DEFAULT '0' COMMENT '在职天数（截至变更日期）',
  `operated_by` int DEFAULT NULL COMMENT '操作人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_employee_id` (`employee_id`),
  KEY `idx_change_date` (`change_date`),
  KEY `idx_new_status` (`new_status`),
  KEY `idx_operated_by` (`operated_by`),
  KEY `fk_employee_status_records_old_dept` (`old_department_id`),
  KEY `fk_employee_status_records_new_dept` (`new_department_id`),
  CONSTRAINT `fk_employee_status_records_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_employee_status_records_new_dept` FOREIGN KEY (`new_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_employee_status_records_old_dept` FOREIGN KEY (`old_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_employee_status_records_operated_by` FOREIGN KEY (`operated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='员工状态变更记录表-记录员工状态和部门变更历史';



-- 表: employees
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '员工记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '关联的用户ID，一对一关系，级联删除',
  `employee_no` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '员工工号，全局唯一，用于考勤等业务',
  `position` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '职位名称，如"高级客服专员"',
  `hire_date` date NOT NULL COMMENT '入职日期，用于计算工龄和权益',
  `salary` decimal(10,2) DEFAULT NULL COMMENT '基本薪资，保密字段，需要权限查看',
  `status` enum('active','inactive','resigned') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '员工状态：active-在职，inactive-离职，resigned-辞职',
  `emergency_contact` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '紧急联系人',
  `emergency_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '紧急联系电话',
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '家庭住址',
  `education` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '学历',
  `skills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '技能特长',
  `remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `rating` tinyint(1) NOT NULL DEFAULT '1' COMMENT '员工星级评定，1-5星，默认1星',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_employee_no` (`employee_no`),
  KEY `idx_position` (`position`),
  KEY `idx_hire_date` (`hire_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_employees_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='员工信息表-存储员工的详细信息，与users表一对一关联';

-- 表: exam_categories
CREATE TABLE `exam_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '分类名称',
  `description` text COMMENT '分类描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` datetime DEFAULT NULL COMMENT '删除时间',
  `deleted_by` int DEFAULT NULL COMMENT '删除操作用户ID',
  `status` enum('active','inactive','deleted') NOT NULL DEFAULT 'active' COMMENT '状态',
  `order_num` int NOT NULL DEFAULT '1' COMMENT '排序号',
  `path` varchar(1024) NOT NULL DEFAULT '/' COMMENT '路径',
  `level` int NOT NULL DEFAULT '1' COMMENT '层级',
  `weight` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '权重',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `parent_id` int DEFAULT NULL COMMENT '父级分类ID',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_status` (`status`),
  KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='试卷分类表';

-- 表: exam_category_audit_logs
CREATE TABLE `exam_category_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int DEFAULT NULL,
  `operator_id` int DEFAULT NULL,
  `operation` varchar(64) NOT NULL,
  `detail` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 表: exams
CREATE TABLE `exams` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '试卷唯一标识ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '试卷标题，如"客服基础知识测试"',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '试卷详细描述，说明考试内容和要求',
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '试卷分类，如"入职培训"、"技能考核"',
  `category_id` int DEFAULT NULL,
  `difficulty` enum('easy','medium','hard') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium' COMMENT '难度等级：easy-简单，medium-中等，hard-困难',
  `duration` int NOT NULL COMMENT '考试时长，单位分钟',
  `total_score` decimal(5,2) NOT NULL COMMENT '试卷总分',
  `pass_score` decimal(5,2) NOT NULL COMMENT '及格分数',
  `question_count` int NOT NULL DEFAULT '0' COMMENT '题目总数，自动计算',
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '试卷状态：draft-草稿，published-已发布，archived-已归档',
  `created_by` int DEFAULT NULL COMMENT '创建人用户ID，关联users表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `questions` longtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_title` (`title`),
  KEY `idx_category` (`category`),
  KEY `idx_difficulty` (`difficulty`),
  KEY `idx_duration` (`duration`),
  KEY `idx_total_score` (`total_score`),
  KEY `idx_pass_score` (`pass_score`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_exams_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='试卷表-存储考试试卷的基本信息和配置';

-- 表: group_members
CREATE TABLE `group_members` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('member','admin','owner') NOT NULL DEFAULT 'member',
  `nickname` varchar(255) DEFAULT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_member` (`group_id`,`user_id`),
  KEY `idx_group_member_group` (`group_id`),
  KEY `idx_group_member_user` (`user_id`),
  CONSTRAINT `fk_group_members_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_group_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 表: groups
CREATE TABLE `groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `description` text,
  `announcement` text,
  `owner_id` int NOT NULL,
  `max_members` int unsigned NOT NULL DEFAULT '200',
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `join_approval_required` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_group_owner` (`owner_id`),
  CONSTRAINT `fk_groups_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 表: holidays
CREATE TABLE `holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL COMMENT '假期名称',
  `days` int NOT NULL COMMENT '天数',
  `month` int NOT NULL COMMENT '所属月份',
  `year` int NOT NULL COMMENT '年份',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `vacation_type_id` int DEFAULT NULL COMMENT '关联的假期类型ID',
  PRIMARY KEY (`id`),
  KEY `idx_year_month` (`year`,`month`),
  KEY `idx_vacation_type` (`vacation_type_id`),
  CONSTRAINT `holidays_chk_1` CHECK (((`days` >= 1) and (`days` <= 31))),
  CONSTRAINT `holidays_chk_2` CHECK (((`month` >= 1) and (`month` <= 12)))
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='节假日配置表';

-- 表: knowledge_article_daily_stats
CREATE TABLE `knowledge_article_daily_stats` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `article_id` bigint unsigned NOT NULL,
  `stat_date` date NOT NULL,
  `views_count` int DEFAULT '0',
  `full_reads_count` int DEFAULT '0',
  `total_duration_seconds` bigint DEFAULT '0',
  `total_active_seconds` bigint DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_article_date` (`article_id`,`stat_date`),
  KEY `idx_article_id` (`article_id`),
  CONSTRAINT `fk_daily_stats_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: knowledge_article_read_sessions
CREATE TABLE `knowledge_article_read_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `department_id` int DEFAULT NULL,
  `article_id` bigint unsigned NOT NULL,
  `started_at` datetime NOT NULL,
  `ended_at` datetime DEFAULT NULL,
  `duration_seconds` int DEFAULT '0',
  `active_seconds` int DEFAULT '0',
  `scroll_depth_percent` int DEFAULT '0',
  `full_read` tinyint(1) DEFAULT '0',
  `close_type` enum('user_close','auto_close','tab_hidden') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'user_close',
  `heartbeats_count` int DEFAULT '0',
  `wheel_events` int DEFAULT '0',
  `mousemove_events` int DEFAULT '0',
  `keydown_events` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_session_id` (`session_id`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_started_at` (`started_at`),
  CONSTRAINT `fk_read_sessions_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_read_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: knowledge_articles
CREATE TABLE `knowledge_articles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `attachments` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `category_id` bigint unsigned DEFAULT NULL,
  `owner_id` bigint unsigned DEFAULT NULL,
  `original_article_id` bigint unsigned DEFAULT NULL,
  `type` enum('common','personal') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'common',
  `is_public` tinyint NOT NULL DEFAULT '1',
  `status` enum('draft','published','archived','deleted') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `view_count` int unsigned NOT NULL DEFAULT '0',
  `like_count` int unsigned NOT NULL DEFAULT '0',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_art_category` (`category_id`),
  KEY `idx_art_owner` (`owner_id`),
  KEY `idx_art_type` (`type`),
  KEY `idx_art_public` (`is_public`),
  KEY `idx_art_status` (`status`),
  KEY `idx_art_deleted` (`is_deleted`),
  KEY `idx_art_original` (`original_article_id`),
  CONSTRAINT `fk_art_category` FOREIGN KEY (`category_id`) REFERENCES `knowledge_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: knowledge_attachments
CREATE TABLE `knowledge_attachments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `article_id` bigint unsigned NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_att_article` (`article_id`),
  CONSTRAINT `fk_att_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: knowledge_categories
CREATE TABLE `knowledge_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_id` bigint unsigned DEFAULT NULL,
  `type` enum('common','personal') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'common',
  `is_public` tinyint NOT NULL DEFAULT '1',
  `is_hidden` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cat_owner` (`owner_id`),
  KEY `idx_cat_type` (`type`),
  KEY `idx_cat_public` (`is_public`),
  KEY `idx_cat_status` (`status`),
  KEY `idx_cat_deleted` (`is_deleted`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: knowledge_learning_plan_records
CREATE TABLE `knowledge_learning_plan_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `start_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` datetime DEFAULT NULL,
  `duration` int NOT NULL DEFAULT '0',
  `progress` int NOT NULL DEFAULT '0',
  `status` enum('in_progress','completed','abandoned') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'in_progress',
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_plan` (`user_id`,`plan_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plan_id` (`plan_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `knowledge_learning_plan_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `knowledge_learning_plan_records_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `learning_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: knowledge_learning_plans
CREATE TABLE `knowledge_learning_plans` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '学习计划唯一标识ID',
  `user_id` int NOT NULL COMMENT '用户ID，关联users表',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '计划标题',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '计划描述',
  `target_articles` json DEFAULT NULL COMMENT '目标文章列表，JSON格式存储文章ID数组',
  `start_date` date NOT NULL COMMENT '计划开始日期',
  `end_date` date NOT NULL COMMENT '计划结束日期',
  `status` enum('active','completed','cancelled','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '计划状态：active-进行中，completed-已完成，cancelled-已取消，expired-已过期',
  `progress` int NOT NULL DEFAULT '0' COMMENT '完成进度百分比，0-100',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_start_date` (`start_date`),
  KEY `idx_end_date` (`end_date`),
  CONSTRAINT `fk_knowledge_learning_plans_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习计划表-用户的知识学习计划';

-- 表: knowledge_learning_statistics
CREATE TABLE `knowledge_learning_statistics` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '统计记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '用户ID，关联users表',
  `stat_date` date NOT NULL COMMENT '统计日期',
  `articles_read` int NOT NULL DEFAULT '0' COMMENT '阅读文章数',
  `articles_completed` int NOT NULL DEFAULT '0' COMMENT '完成文章数',
  `total_duration` int NOT NULL DEFAULT '0' COMMENT '总学习时长，单位秒',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`,`stat_date`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_stat_date` (`stat_date`),
  CONSTRAINT `fk_knowledge_learning_statistics_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习统计表-按天统计用户学习数据';

-- 表: learning_plans
CREATE TABLE `learning_plans` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '计划ID',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '计划标题',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '计划描述',
  `created_by` int NOT NULL COMMENT '创建者ID',
  `assigned_to` int DEFAULT NULL COMMENT '分配给用户ID',
  `department_id` int DEFAULT NULL COMMENT '分配给部门ID',
  `status` enum('draft','active','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '计划状态',
  `start_date` datetime DEFAULT NULL COMMENT '开始日期',
  `end_date` datetime DEFAULT NULL COMMENT '结束日期',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `learning_plans_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `learning_plans_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `learning_plans_ibfk_3` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习计划表';

-- 表: learning_statistics
CREATE TABLE `learning_statistics` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '统计ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `date` date NOT NULL COMMENT '统计日期',
  `articles_read` int NOT NULL DEFAULT '0' COMMENT '阅读文章数',
  `exams_taken` int NOT NULL DEFAULT '0' COMMENT '参加考试数',
  `exams_passed` int NOT NULL DEFAULT '0' COMMENT '通过考试数',
  `total_duration` int NOT NULL DEFAULT '0' COMMENT '总学习时长(秒)',
  `completed_tasks` int NOT NULL DEFAULT '0' COMMENT '完成任务数',
  `completed_plans` int NOT NULL DEFAULT '0' COMMENT '完成计划数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`,`date`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_date` (`date`),
  CONSTRAINT `learning_statistics_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习统计表';

-- 表: learning_tasks
CREATE TABLE `learning_tasks` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '任务ID',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '任务标题',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '任务描述',
  `assigned_to` int NOT NULL COMMENT '分配给用户ID',
  `assigned_by` int DEFAULT NULL COMMENT '分配者ID',
  `status` enum('pending','in_progress','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '任务状态',
  `priority` enum('low','medium','high') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium' COMMENT '优先级',
  `due_date` datetime DEFAULT NULL COMMENT '截止日期',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_status` (`status`),
  KEY `idx_due_date` (`due_date`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `learning_tasks_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `learning_tasks_ibfk_2` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习任务表';

-- 表: leave_records
CREATE TABLE `leave_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '请假记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '请假员工用户ID，关联users表，级联删除',
  `leave_type` enum('sick','annual','personal','maternity','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '请假类型：sick-病假，annual-年假，personal-事假，maternity-产假，other-其他',
  `start_date` date NOT NULL COMMENT '请假开始日期',
  `end_date` date NOT NULL COMMENT '请假结束日期',
  `days` decimal(5,2) NOT NULL COMMENT '请假天数，支持半天请假，如0.5天',
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '请假原因，详细说明',
  `status` enum('pending','approved','rejected','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '审批状态：pending-待审批，approved-已批准，rejected-已拒绝，cancelled-已取消',
  `approver_id` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL COMMENT '审批时间',
  `approval_note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `employee_id` int NOT NULL,
  `attachments` json DEFAULT NULL,
  `use_converted_leave` tinyint(1) DEFAULT '0' COMMENT '是否优先使用转换假期',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_leave_type` (`leave_type`),
  KEY `idx_start_date` (`start_date`),
  KEY `idx_end_date` (`end_date`),
  KEY `idx_status` (`status`),
  KEY `idx_approved_by` (`approver_id`),
  KEY `idx_date_range` (`start_date`,`end_date`),
  KEY `idx_employee` (`employee_id`),
  CONSTRAINT `fk_leave_records_approved_by` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_leave_records_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='请假记录表-员工请假申请和审批记录表';

-- 表: makeup_records
CREATE TABLE `makeup_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `record_date` date NOT NULL COMMENT '补卡日期',
  `clock_type` enum('in','out') NOT NULL COMMENT '打卡类型',
  `clock_time` datetime NOT NULL COMMENT '打卡时间',
  `reason` varchar(500) NOT NULL COMMENT '补卡原因',
  `status` enum('pending','approved','rejected') DEFAULT 'pending' COMMENT '状态',
  `approver_id` int DEFAULT NULL COMMENT '审批人ID',
  `approved_at` datetime DEFAULT NULL COMMENT '审批时间',
  `approval_note` varchar(500) DEFAULT NULL COMMENT '审批备注',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_record_date` (`record_date`),
  KEY `idx_approver` (`approver_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='补卡申请表';

-- 表: meal_order_items
CREATE TABLE `meal_order_items` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '订餐明细唯一标识ID',
  `order_id` int NOT NULL COMMENT '订单ID，关联meal_orders表，级联删除',
  `menu_item_id` int NOT NULL COMMENT '菜品ID，关联menu_items表，级联删除',
  `quantity` int NOT NULL COMMENT '订购数量',
  `unit_price` decimal(8,2) NOT NULL COMMENT '单价，记录下单时的价格',
  `subtotal` decimal(8,2) NOT NULL COMMENT '小计金额，quantity * unit_price',
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '单项备注，如"少盐"、"不要辣"',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_menu_item_id` (`menu_item_id`),
  KEY `idx_quantity` (`quantity`),
  KEY `idx_subtotal` (`subtotal`),
  CONSTRAINT `fk_meal_order_items_menu_item_id` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_meal_order_items_order_id` FOREIGN KEY (`order_id`) REFERENCES `meal_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订餐明细表-订餐记录的详细项目表';

-- 表: meal_orders
CREATE TABLE `meal_orders` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '订单唯一标识ID',
  `order_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单编号，全局唯一，格式如ORD20240115001',
  `user_id` int NOT NULL COMMENT '订餐用户ID，关联users表，级联删除',
  `order_date` date NOT NULL COMMENT '订餐日期，YYYY-MM-DD格式',
  `meal_type` enum('breakfast','lunch','dinner','snack') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '餐次类型：breakfast-早餐，lunch-午餐，dinner-晚餐，snack-加餐',
  `total_amount` decimal(8,2) NOT NULL COMMENT '订单总金额，单位元',
  `status` enum('pending','confirmed','preparing','ready','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '订单状态：pending-待确认，confirmed-已确认，preparing-制作中，ready-已完成，completed-已取餐，cancelled-已取消',
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '订单备注，特殊要求或说明',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_order_date` (`order_date`),
  KEY `idx_meal_type` (`meal_type`),
  KEY `idx_total_amount` (`total_amount`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_meal_orders_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订餐记录表-员工订餐记录主表';

-- 表: menu_categories
CREATE TABLE `menu_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '菜单分类唯一标识ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称，如"主食"、"荤菜"、"素菜"',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '分类详细描述，说明该分类的特点',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号，用于菜单分类显示顺序',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜单分类表-订餐系统的菜品分类管理表';

-- 表: menu_items
CREATE TABLE `menu_items` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '菜品唯一标识ID',
  `category_id` int NOT NULL COMMENT '所属分类ID，关联menu_categories表，级联删除',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '菜品名称，如"宫保鸡丁"、"麻婆豆腐"',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '菜品详细描述，包括口味、特色等',
  `price` decimal(8,2) NOT NULL COMMENT '菜品价格，单位元',
  `image` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '菜品图片URL地址',
  `ingredients` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '主要配料信息，用于过敏提醒',
  `nutrition` json DEFAULT NULL COMMENT '营养信息，JSON格式存储卡路里、蛋白质等',
  `is_available` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否可订购：1-可订购，0-暂停供应',
  `is_recommended` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否推荐菜品：1-推荐，0-普通',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号，用于菜品显示顺序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_name` (`name`),
  KEY `idx_price` (`price`),
  KEY `idx_is_available` (`is_available`),
  KEY `idx_is_recommended` (`is_recommended`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_menu_items_category_id` FOREIGN KEY (`category_id`) REFERENCES `menu_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品表-订餐系统的菜品信息表';

-- 表: message_status
CREATE TABLE `message_status` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `message_id` bigint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `status` enum('sent','delivered','read') NOT NULL DEFAULT 'sent',
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_msg_user` (`message_id`,`user_id`),
  KEY `idx_msg_status_msg` (`message_id`),
  KEY `idx_msg_status_user` (`user_id`),
  KEY `idx_user_status` (`user_id`,`status`),
  KEY `idx_message_id` (`message_id`),
  CONSTRAINT `fk_msg_status_msg` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_msg_status_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 表: messages
CREATE TABLE `messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint unsigned NOT NULL,
  `sender_id` int NOT NULL,
  `recipient_id` int DEFAULT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `reply_to_message_id` bigint unsigned DEFAULT NULL,
  `is_recalled` tinyint(1) DEFAULT '0',
  `recalled_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_sender_id` (`sender_id`),
  KEY `idx_recipient_id` (`recipient_id`),
  KEY `idx_reply_to_message_id` (`reply_to_message_id`),
  CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_messages_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_messages_reply_to` FOREIGN KEY (`reply_to_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: migrations_history
CREATE TABLE `migrations_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `migration_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `migration_name` (`migration_name`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: my_knowledge_articles
CREATE TABLE `my_knowledge_articles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `category_id` int DEFAULT NULL COMMENT '分类ID',
  `source_article_id` int DEFAULT NULL COMMENT '来源文章ID（如果是从公共知识库收藏的）',
  `title` varchar(255) NOT NULL COMMENT '文档标题',
  `content` text COMMENT '文档内容',
  `summary` text COMMENT '文档摘要',
  `attachments` json DEFAULT NULL COMMENT '附件列表',
  `tags` varchar(500) DEFAULT NULL COMMENT '标签',
  `notes` text COMMENT '个人笔记',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_source_article_id` (`source_article_id`),
  KEY `idx_title` (`title`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='我的知识库文档表';

-- 表: my_knowledge_categories
CREATE TABLE `my_knowledge_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `name` varchar(100) NOT NULL COMMENT '分类名称',
  `icon` varchar(10) DEFAULT 0xF09F9381 COMMENT '分类图标',
  `description` text COMMENT '分类描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='我的知识库分类表';

-- 表: my_knowledge_saved_articles
CREATE TABLE `my_knowledge_saved_articles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `article_id` bigint unsigned NOT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_article` (`user_id`,`article_id`),
  KEY `idx_mk_user` (`user_id`),
  KEY `idx_mk_article` (`article_id`),
  CONSTRAINT `fk_mk_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: notification_recipients
CREATE TABLE `notification_recipients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `notification_id` int NOT NULL,
  `user_id` int NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_id` (`notification_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notification_recipients_ibfk_1` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_recipients_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: notifications
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `type` varchar(50) NOT NULL COMMENT '通知类型',
  `title` varchar(200) NOT NULL COMMENT '通知标题',
  `content` text COMMENT '通知内容',
  `related_id` int DEFAULT NULL COMMENT '关联记录ID',
  `is_read` tinyint(1) DEFAULT '0' COMMENT '是否已读',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `related_type` varchar(50) DEFAULT NULL COMMENT '关联对象类型',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_related` (`related_type`,`related_id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='消息通知表';

-- 表: overtime_conversions
CREATE TABLE `overtime_conversions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `user_id` int NOT NULL,
  `overtime_hours` decimal(5,2) NOT NULL,
  `target_vacation_type_id` int NOT NULL,
  `converted_days` decimal(5,2) NOT NULL,
  `conversion_rule_id` int DEFAULT NULL,
  `conversion_ratio` decimal(5,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `target_vacation_type_id` (`target_vacation_type_id`),
  KEY `conversion_rule_id` (`conversion_rule_id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `overtime_conversions_ibfk_1` FOREIGN KEY (`target_vacation_type_id`) REFERENCES `vacation_types` (`id`),
  CONSTRAINT `overtime_conversions_ibfk_2` FOREIGN KEY (`conversion_rule_id`) REFERENCES `conversion_rules` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: overtime_records
CREATE TABLE `overtime_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `overtime_date` date NOT NULL COMMENT '加班日期',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `hours` decimal(4,2) NOT NULL COMMENT '加班时长（小时）',
  `reason` varchar(500) DEFAULT NULL COMMENT '加班原因',
  `status` enum('pending','approved','rejected') DEFAULT 'pending' COMMENT '状态',
  `approver_id` int DEFAULT NULL COMMENT '审批人ID',
  `approved_at` datetime DEFAULT NULL COMMENT '审批时间',
  `approval_note` varchar(500) DEFAULT NULL COMMENT '审批备注',
  `is_compensated` tinyint(1) DEFAULT '0' COMMENT '是否已调休',
  `compensated_at` datetime DEFAULT NULL COMMENT '调休时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_overtime_date` (`overtime_date`),
  KEY `idx_approver` (`approver_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='加班记录表';

-- 表: permissions
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '权限唯一标识ID，自增主键',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '权限显示名称，如"查看用户列表"',
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '权限代码，如"user:list"，用于程序判断',
  `resource` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '资源名称，如"user"、"role"等',
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型，如"read"、"create"、"update"、"delete"',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '权限详细描述，说明权限的具体作用',
  `module` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '所属模块，如"user"、"attendance"等，用于权限分组',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_resource` (`resource`),
  KEY `idx_action` (`action`),
  KEY `idx_module` (`module`),
  KEY `idx_resource_action` (`resource`,`action`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表-定义系统中所有的权限项，采用资源+操作的方式进行权限控制';

-- 表: platforms
CREATE TABLE `platforms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台名称',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: positions
CREATE TABLE `positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '职位名称',
  `department_id` int NOT NULL COMMENT '所属部门ID',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '职位描述',
  `requirements` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '任职要求',
  `responsibilities` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '工作职责',
  `salary_min` decimal(10,2) DEFAULT NULL COMMENT '最低薪资',
  `salary_max` decimal(10,2) DEFAULT NULL COMMENT '最高薪资',
  `level` enum('junior','middle','senior','expert') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'junior' COMMENT '职位级别',
  `status` enum('active','inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `updated_by` int DEFAULT NULL COMMENT '更新人ID',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号，用于职位列表排序显示',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_position_dept` (`name`,`department_id`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_department` (`department_id`),
  KEY `idx_status` (`status`),
  KEY `idx_level` (`level`),
  KEY `idx_name` (`name`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `positions_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `positions_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `positions_ibfk_3` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='职位表';

-- 表: quality_case_attachments
CREATE TABLE `quality_case_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int NOT NULL,
  `file_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `thumbnail_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_case_id` (`case_id`),
  CONSTRAINT `fk_quality_case_attachments_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例附件表';

-- 表: quality_case_collections
CREATE TABLE `quality_case_collections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_case_user` (`case_id`,`user_id`),
  KEY `idx_case_id` (`case_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_quality_case_collections_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例收藏表';

-- 表: quality_case_comments
CREATE TABLE `quality_case_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `like_count` int NOT NULL DEFAULT '0',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_case_id` (`case_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_quality_case_comments_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例评论表';

-- 表: quality_case_learning_records
CREATE TABLE `quality_case_learning_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `user_id` int NOT NULL,
  `duration` int NOT NULL DEFAULT '0',
  `is_completed` tinyint(1) NOT NULL DEFAULT '0',
  `last_position` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_case_user` (`case_id`,`user_id`),
  KEY `idx_case_id` (`case_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_quality_case_learning_records_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例学习记录表';

-- 表: quality_case_tags
CREATE TABLE `quality_case_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_case_tag` (`case_id`,`tag_id`),
  KEY `idx_case_id` (`case_id`),
  KEY `idx_tag_id` (`tag_id`),
  CONSTRAINT `fk_quality_case_tags_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例标签关联表';

-- 表: quality_cases
CREATE TABLE `quality_cases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `problem` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `solution` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `case_type` enum('excellent','good','poor','warning') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'excellent',
  `difficulty` enum('easy','medium','hard') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `priority` enum('low','medium','high','urgent') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `session_id` int DEFAULT NULL,
  `view_count` int NOT NULL DEFAULT '0',
  `like_count` int NOT NULL DEFAULT '0',
  `collect_count` int NOT NULL DEFAULT '0',
  `comment_count` int NOT NULL DEFAULT '0',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `is_recommended` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_case_type` (`case_type`),
  KEY `idx_status` (`status`),
  FULLTEXT KEY `ft_case_search` (`title`,`description`,`problem`,`solution`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检案例表';

-- 表: quality_rules
CREATE TABLE `quality_rules` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '质检规则唯一标识ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '规则名称，如"服务态度"、"专业能力"',
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '规则分类，如"服务质量"、"沟通技巧"',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '规则详细描述，说明评分标准',
  `criteria` json NOT NULL COMMENT '评判标准，JSON格式存储具体的评分细则',
  `score_weight` decimal(5,2) NOT NULL COMMENT '分数权重，用于计算总分',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `created_by` int DEFAULT NULL COMMENT '创建人用户ID，关联users表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_category` (`category`),
  KEY `idx_score_weight` (`score_weight`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_quality_rules_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检规则表-定义质检评分规则和标准';

-- 表: quality_scores
CREATE TABLE `quality_scores` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '评分记录唯一标识ID',
  `session_id` int NOT NULL COMMENT '会话ID，关联quality_sessions表，级联删除',
  `rule_id` int NOT NULL COMMENT '规则ID，关联quality_rules表，级联删除',
  `score` decimal(5,2) NOT NULL COMMENT '该规则的得分',
  `max_score` decimal(5,2) NOT NULL COMMENT '该规则的满分',
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '该项评分的具体说明',
  `created_by` int DEFAULT NULL COMMENT '评分人用户ID，关联users表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_rule` (`session_id`,`rule_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_rule_id` (`rule_id`),
  KEY `idx_score` (`score`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_quality_scores_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quality_scores_rule_id` FOREIGN KEY (`rule_id`) REFERENCES `quality_rules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_scores_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检评分表-存储具体的质检评分记录';

-- 表: quality_sessions
CREATE TABLE `quality_sessions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '质检会话唯一标识ID',
  `session_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会话编号，全局唯一，用于业务查询',
  `agent_id` int NOT NULL COMMENT '客服人员用户ID，关联users表，级联删除',
  `customer_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户ID，可能来自外部系统',
  `channel` enum('chat','phone','email','video') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'chat' COMMENT '沟通渠道：chat-在线聊天，phone-电话，email-邮件，video-视频',
  `start_time` datetime NOT NULL COMMENT '会话开始时间',
  `end_time` datetime NOT NULL COMMENT '会话结束时间',
  `duration` int NOT NULL COMMENT '会话时长，单位秒',
  `message_count` int NOT NULL DEFAULT '0' COMMENT '消息总数，用于统计分析',
  `status` enum('pending','in_review','completed','disputed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '质检状态：pending-待质检，in_review-质检中，completed-已完成，disputed-有争议',
  `inspector_id` int DEFAULT NULL COMMENT '质检员用户ID，关联users表',
  `score` decimal(5,2) DEFAULT NULL COMMENT '质检总分，0-100分',
  `grade` enum('excellent','good','average','poor') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '质检等级：excellent-优秀，good-良好，average-一般，poor-较差',
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '质检总评语',
  `reviewed_at` datetime DEFAULT NULL COMMENT '质检完成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `platform` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台来源',
  `shop` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '店铺名称',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_no` (`session_no`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_channel` (`channel`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_end_time` (`end_time`),
  KEY `idx_duration` (`duration`),
  KEY `idx_status` (`status`),
  KEY `idx_inspector_id` (`inspector_id`),
  KEY `idx_score` (`score`),
  KEY `idx_grade` (`grade`),
  KEY `idx_reviewed_at` (`reviewed_at`),
  KEY `idx_time_range` (`start_time`,`end_time`),
  KEY `idx_agent_time_status` (`agent_id`,`start_time`,`status`),
  CONSTRAINT `fk_quality_sessions_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_sessions_inspector_id` FOREIGN KEY (`inspector_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检会话表-客服会话质检记录表，存储需要质检的会话基本信息';

-- 表: questions
CREATE TABLE `questions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '题目唯一标识ID',
  `exam_id` int NOT NULL COMMENT '所属试卷ID，关联exams表，级联删除',
  `type` enum('single_choice','multiple_choice','true_false','fill_blank','essay') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题型：single_choice-单选，multiple_choice-多选，true_false-判断，fill_blank-填空，essay-问答',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题目内容，支持富文本格式',
  `options` json DEFAULT NULL COMMENT '选项内容，JSON格式存储，适用于选择题',
  `correct_answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '正确答案，根据题型格式不同',
  `score` decimal(5,2) NOT NULL COMMENT '题目分值',
  `explanation` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '答案解析，帮助学习理解',
  `order_num` int NOT NULL DEFAULT '0' COMMENT '题目排序号，用于试卷中的显示顺序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_exam_id` (`exam_id`),
  KEY `idx_type` (`type`),
  KEY `idx_score` (`score`),
  KEY `idx_order_num` (`order_num`),
  CONSTRAINT `fk_questions_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='题目表-存储试卷中的具体题目信息';

-- 表: role_departments
CREATE TABLE `role_departments` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录唯一标识ID',
  `role_id` int NOT NULL COMMENT '角色ID',
  `department_id` int NOT NULL COMMENT '部门ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_department` (`role_id`,`department_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_department_id` (`department_id`),
  CONSTRAINT `fk_role_departments_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_departments_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=156 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色部门关联表 - 定义每个角色可以查看哪些部门';

-- 表: role_permissions
CREATE TABLE `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录唯一标识ID',
  `role_id` int NOT NULL COMMENT '角色ID，关联roles表，级联删除',
  `permission_id` int NOT NULL COMMENT '权限ID，关联permissions表，级联删除',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '权限分配时间，用于审计',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permission` (`role_id`,`permission_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_permission_id` (`permission_id`),
  CONSTRAINT `fk_role_permissions_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=119 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限关联表-角色与权限的多对多关联表，定义每个角色拥有哪些权限';

-- 表: roles
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '角色唯一标识ID，自增主键',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '角色名称，如"超级管理员"、"客服专员"等',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '角色详细描述，说明角色职责和权限范围',
  `level` int NOT NULL DEFAULT '1' COMMENT '角色级别，数字越大权限越高，用于权限继承',
  `is_system` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否为系统内置角色，1-是，0-否，系统角色不可删除',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_level` (`level`),
  KEY `idx_is_system` (`is_system`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表-定义系统中的各种角色类型，用于权限管理和用户分类';

-- 表: schedules
CREATE TABLE `schedules` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '排班记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '员工用户ID，关联users表，级联删除',
  `shift_id` int NOT NULL COMMENT '班次ID，关联shifts表，级联删除',
  `schedule_date` date NOT NULL COMMENT '排班日期，YYYY-MM-DD格式',
  `status` enum('normal','leave','holiday','overtime') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal' COMMENT '排班状态：normal-正常，leave-请假，holiday-节假日，overtime-加班',
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '排班备注，特殊说明或调班原因',
  `created_by` int DEFAULT NULL COMMENT '排班创建人ID，记录是谁安排的排班',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`,`schedule_date`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_shift_id` (`shift_id`),
  KEY `idx_schedule_date` (`schedule_date`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_schedules_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_schedules_shift_id` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_schedules_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='排班表-员工排班记录表，记录每个员工的具体排班安排';

-- 表: session_messages
CREATE TABLE `session_messages` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '消息唯一标识ID',
  `session_id` int NOT NULL COMMENT '所属会话ID，关联quality_sessions表，级联删除',
  `sender_type` enum('agent','customer','system') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '发送者类型：agent-客服，customer-客户，system-系统',
  `sender_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '发送者ID，客服为用户ID，客户为客户ID',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息内容，支持文本、表情等',
  `content_type` enum('text','image','file','audio','video') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text' COMMENT '内容类型：text-文本，image-图片，file-文件，audio-音频，video-视频',
  `timestamp` datetime NOT NULL COMMENT '消息发送时间，精确到秒',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_sender_type` (`sender_type`),
  KEY `idx_sender_id` (`sender_id`),
  KEY `idx_content_type` (`content_type`),
  KEY `idx_timestamp` (`timestamp`),
  CONSTRAINT `fk_session_messages_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话消息表-存储质检会话中的具体消息内容';

-- 表: shift_schedules
CREATE TABLE `shift_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL,
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_employee_date` (`employee_id`,`schedule_date`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_shift` (`shift_id`),
  KEY `idx_schedule_date` (`schedule_date`)
) ENGINE=InnoDB AUTO_INCREMENT=259 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='排班表';

-- 表: shift_schedules_backup
CREATE TABLE `shift_schedules_backup` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期（纯日期，无时间部分）',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: shift_schedules_backup_20251113
CREATE TABLE `shift_schedules_backup_20251113` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: shift_schedules_backup_before_date_fix
CREATE TABLE `shift_schedules_backup_before_date_fix` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: shift_schedules_backup_comprehensive
CREATE TABLE `shift_schedules_backup_comprehensive` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期（纯日期，无时间部分）',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: shift_schedules_backup_simple
CREATE TABLE `shift_schedules_backup_simple` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期（纯日期，无时间部分）',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: shifts
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '班次唯一标识ID，自增主键',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '班次名称，如"早班"、"中班"、"夜班"',
  `start_time` time NOT NULL COMMENT '班次开始时间，格式HH:MM:SS',
  `end_time` time NOT NULL COMMENT '班次结束时间，格式HH:MM:SS',
  `break_duration` int NOT NULL DEFAULT '0' COMMENT '休息时长，单位分钟，用于计算实际工作时间',
  `color` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '班次显示颜色，十六进制颜色代码，用于排班表显示',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '班次详细描述，包括工作内容和要求',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_end_time` (`end_time`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='班次表-定义工作班次信息，用于排班管理和考勤计算';

-- 表: shops
CREATE TABLE `shops` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '店铺名称',
  `platform_id` int NOT NULL COMMENT '所属平台ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `platform_id` (`platform_id`),
  CONSTRAINT `shops_ibfk_1` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: tag_categories
CREATE TABLE `tag_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '标签分类唯一标识ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称，如"产品类型"、"问题类型"',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '分类详细描述，说明该分类的用途',
  `color` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类显示颜色，十六进制颜色代码',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号，用于分类列表排序显示',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签分类表-标签分类管理表，用于组织标签的层次结构';

-- 表: tags
CREATE TABLE `tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '标签唯一标识ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '标签名称，如"退款"、"技术故障"',
  `category_id` int DEFAULT NULL COMMENT '所属分类ID，关联tag_categories表',
  `color` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签显示颜色，十六进制颜色代码',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '标签详细描述，说明标签的含义',
  `usage_count` int NOT NULL DEFAULT '0' COMMENT '使用次数，统计标签的使用频率',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_usage_count` (`usage_count`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_tags_category_id` FOREIGN KEY (`category_id`) REFERENCES `tag_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签表-标签信息表，用于案例的标签化管理';

-- 表: user_case_favorites
CREATE TABLE `user_case_favorites` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `case_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`case_id`),
  KEY `case_id` (`case_id`),
  CONSTRAINT `user_case_favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_case_favorites_ibfk_2` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: user_notification_settings
CREATE TABLE `user_notification_settings` (
  `user_id` int NOT NULL,
  `receive_system` tinyint(1) DEFAULT '1',
  `receive_department` tinyint(1) DEFAULT '1',
  `sound_on` tinyint(1) DEFAULT '1',
  `dnd_start` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dnd_end` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toast_duration` int DEFAULT '5000',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_notification_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: user_roles
CREATE TABLE `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '用户ID，关联users表，级联删除',
  `role_id` int NOT NULL COMMENT '角色ID，关联roles表，级联删除',
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '角色分配时间，用于审计',
  `assigned_by` int DEFAULT NULL COMMENT '分配人ID，记录是谁分配的角色',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`,`role_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_assigned_by` (`assigned_by`),
  CONSTRAINT `fk_user_roles_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表-用户与角色的多对多关联表，一个用户可以有多个角色';

-- 表: user_settings
CREATE TABLE `user_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `message_notification` tinyint(1) NOT NULL DEFAULT '1',
  `sound_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `do_not_disturb_start` time DEFAULT NULL,
  `do_not_disturb_end` time DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  CONSTRAINT `fk_user_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 表: users
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户唯一标识ID，自增主键',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户登录名，全局唯一，3-50个字符',
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户密码的哈希值，使用bcrypt加密',
  `real_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户真实姓名，用于显示和身份识别',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户邮箱地址，可用于找回密码和通知',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户手机号码，支持国内外格式',
  `avatar` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '头像(Base64或URL)',
  `department_id` int DEFAULT NULL COMMENT '所属部门ID，关联departments表',
  `status` enum('active','inactive','pending') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '用户状态：active-激活，inactive-禁用，pending-待审核',
  `last_login` datetime DEFAULT NULL COMMENT '最后一次登录时间，用于统计活跃度',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间，用于统计和排序',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `session_token` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '当前会话token，用于单设备登录',
  `session_created_at` datetime DEFAULT NULL COMMENT '会话创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_dept_status` (`department_id`,`status`),
  KEY `idx_status_created` (`status`,`created_at`),
  KEY `idx_session_token` (`session_token`),
  CONSTRAINT `fk_users_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表-存储系统所有用户的基本信息，是整个系统的用户基础表';

-- 表: vacation_audit_logs
CREATE TABLE `vacation_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `operation_type` enum('leave_apply','leave_approve','leave_reject','overtime_apply','overtime_approve','compensatory_request','compensatory_approve','balance_adjust','overtime_convert') DEFAULT NULL COMMENT '操作类型',
  `operation_detail` json DEFAULT NULL COMMENT '操作详情(JSON格式)',
  `balance_before` json DEFAULT NULL COMMENT '操作前余额快照',
  `balance_after` json DEFAULT NULL COMMENT '操作后余额快照',
  `operator_id` int DEFAULT NULL COMMENT '操作人ID',
  `ip_address` varchar(50) DEFAULT NULL COMMENT 'IP地址',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_employee_id` (`employee_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_operation_type` (`operation_type`),
  KEY `idx_operator_id` (`operator_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='假期操作审计日志';

-- 表: vacation_balance_changes
CREATE TABLE `vacation_balance_changes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL COMMENT '员工ID',
  `year` int NOT NULL COMMENT '年份',
  `change_type` enum('addition','deduction','conversion','adjustment') NOT NULL COMMENT '变更类型',
  `leave_type` varchar(50) DEFAULT NULL COMMENT '假期类型',
  `amount` decimal(5,2) NOT NULL COMMENT '变更数量（正数为增加，负数为扣减）',
  `balance_before` decimal(5,2) DEFAULT NULL COMMENT '变更前余额',
  `balance_after` decimal(5,2) DEFAULT NULL COMMENT '变更后余额',
  `reason` text COMMENT '变更原因',
  `reference_id` int DEFAULT NULL COMMENT '关联ID（审批单号/转换记录ID）',
  `reference_type` varchar(50) DEFAULT NULL COMMENT '关联类型（leave_request/overtime_conversion/manual_adjustment）',
  `approval_number` varchar(50) DEFAULT NULL COMMENT '审批单号',
  `created_by` int DEFAULT NULL COMMENT '操作人ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee_year` (`employee_id`,`year`),
  KEY `idx_change_type` (`change_type`),
  KEY `idx_reference` (`reference_type`,`reference_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `vacation_balance_changes_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='假期余额变更历史表';

-- 表: vacation_balances
CREATE TABLE `vacation_balances` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `year` int NOT NULL COMMENT '年度',
  `annual_leave_total` decimal(5,2) DEFAULT '5.00' COMMENT '年假总额度(天)',
  `annual_leave_used` decimal(5,2) DEFAULT '0.00' COMMENT '年假已用(天)',
  `sick_leave_total` decimal(5,2) DEFAULT '10.00' COMMENT '病假总额度(天)',
  `sick_leave_used` decimal(5,2) DEFAULT '0.00' COMMENT '病假已用(天)',
  `compensatory_leave_total` decimal(5,2) DEFAULT '0.00' COMMENT '调休总额度(天)',
  `compensatory_leave_used` decimal(5,2) DEFAULT '0.00' COMMENT '调休已用(天)',
  `overtime_leave_total` decimal(5,1) DEFAULT '0.0',
  `overtime_leave_used` decimal(5,1) DEFAULT '0.0',
  `overtime_hours_total` decimal(6,2) DEFAULT '0.00' COMMENT '加班总时长(小时)',
  `overtime_hours_converted` decimal(6,2) DEFAULT '0.00' COMMENT '已转调休的加班时长(小时)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `total_days` decimal(5,2) DEFAULT '0.00' COMMENT '总假期天数',
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  `expiry_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_year` (`employee_id`,`year`),
  KEY `idx_user_year` (`user_id`,`year`),
  KEY `idx_year` (`year`),
  KEY `idx_expiry_date` (`expiry_date`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='假期余额表';

-- 表: vacation_settings
CREATE TABLE `vacation_settings` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `setting_key` varchar(100) NOT NULL COMMENT '配置键',
  `setting_value` text COMMENT '配置值',
  `description` varchar(255) DEFAULT NULL COMMENT '配置说明',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `idx_setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='假期系统配置';

-- 表: vacation_type_balances
CREATE TABLE `vacation_type_balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `user_id` int NOT NULL,
  `year` int NOT NULL,
  `vacation_type_id` int NOT NULL,
  `total_days` decimal(5,2) DEFAULT '0.00',
  `used_days` decimal(5,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `conversion_date` date DEFAULT NULL,
  `remaining_carryover_days` decimal(5,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_year_type` (`employee_id`,`year`,`vacation_type_id`),
  KEY `idx_employee_year` (`employee_id`,`year`),
  KEY `idx_vacation_type` (`vacation_type_id`),
  CONSTRAINT `vacation_type_balances_ibfk_1` FOREIGN KEY (`vacation_type_id`) REFERENCES `vacation_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=289 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: vacation_types
CREATE TABLE `vacation_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL COMMENT '类型代码',
  `name` varchar(100) NOT NULL COMMENT '类型名称',
  `base_days` decimal(5,2) DEFAULT '0.00' COMMENT '基准天数',
  `included_in_total` tinyint(1) DEFAULT '1' COMMENT '是否计入总额度',
  `description` text COMMENT '描述',
  `enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_code` (`code`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='假期类型表';

-- 表: work_shifts
CREATE TABLE `work_shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT '班次名称',
  `start_time` time NOT NULL COMMENT '上班时间',
  `end_time` time NOT NULL COMMENT '下班时间',
  `work_hours` decimal(3,1) NOT NULL COMMENT '工作时长',
  `late_threshold` int DEFAULT '30' COMMENT '迟到阈值（分钟）',
  `early_threshold` int DEFAULT '30' COMMENT '早退阈值（分钟）',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `department_id` int DEFAULT NULL COMMENT '部门ID（NULL表示全公司通用）',
  `description` varchar(500) DEFAULT NULL COMMENT '班次描述',
  `color` varchar(20) DEFAULT '#3B82F6',
  PRIMARY KEY (`id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_department` (`department_id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='班次表';

-- ==========================================
-- 插入初始数据
-- ==========================================

-- 插入管理员部门
INSERT INTO `departments` (`name`, `description`, `status`, `created_at`)
VALUES ('管理员', '系统管理员部门', 'active', NOW());

-- 获取刚插入的部门ID
SET @admin_dept_id = LAST_INSERT_ID();

-- 插入超级管理员账号
-- 用户名: admin
-- 密码: admin123
INSERT INTO `users` (`username`, `password_hash`, `real_name`, `email`, `phone`, `department_id`, `status`, `created_at`)
VALUES ('admin', '$2b$10$ya3vuqq/jDVDl20Lir84N.3rjxwKgcq25aWJpaZstEkttcRApbFRm', '系统管理员', 'admin@example.com', '13800138000', @admin_dept_id, 'active', NOW());

-- 获取刚插入的用户ID
SET @admin_user_id = LAST_INSERT_ID();

-- 插入管理员员工记录
INSERT INTO `employees` (`user_id`, `employee_no`, `position`, `hire_date`, `status`, `created_at`)
VALUES (@admin_user_id, 'ADMIN001', '系统管理员', NOW(), 'active', NOW());

-- 注意：roles 和 user_roles 表不在此初始化脚本中
-- 如需角色功能，请单独创建这些表并插入数据


-- ==========================================
-- 初始化完成
-- ==========================================
-- 超级管理员账号信息:
-- 用户名: admin
-- 密码: admin123
-- 请登录后立即修改密码！
-- ==========================================


SET FOREIGN_KEY_CHECKS = 1;
