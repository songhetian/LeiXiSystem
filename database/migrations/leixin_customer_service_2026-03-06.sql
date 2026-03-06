# ************************************************************
# Sequel Ace SQL dump
# 版本号： 20096
#
# https://sequel-ace.com/
# https://github.com/Sequel-Ace/Sequel-Ace
#
# 主机: localhost (MySQL 9.6.0)
# 数据库: leixin_customer_service
# 生成时间: 2026-03-06 04:43:02 +0000
# ************************************************************


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
SET NAMES utf8mb4;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE='NO_AUTO_VALUE_ON_ZERO', SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


# 转储表 answer_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `answer_records`;

CREATE TABLE `answer_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '答题记录唯一标识ID',
  `result_id` int NOT NULL COMMENT '考核结果ID，关联assessment_results表，级联删除',
  `question_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题目ID，支持临时ID(temp_前缀)和正式ID',
  `user_answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '用户答案，根据题型格式不同',
  `is_correct` tinyint(1) DEFAULT NULL COMMENT '是否正确：1-正确，0-错误，NULL-未评分',
  `score` decimal(5,2) DEFAULT NULL COMMENT '该题得分',
  `time_spent` int DEFAULT NULL COMMENT '答题用时，单位秒',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_result_question` (`result_id`,`question_id`) USING BTREE,
  KEY `idx_result_id` (`result_id`) USING BTREE,
  KEY `idx_is_correct` (`is_correct`) USING BTREE,
  KEY `idx_score` (`score`) USING BTREE,
  KEY `idx_time_spent` (`time_spent`) USING BTREE,
  KEY `idx_question_id` (`question_id`) USING BTREE,
  CONSTRAINT `fk_answer_records_result_id` FOREIGN KEY (`result_id`) REFERENCES `assessment_results` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='答题记录表-存储用户的具体答题记录';



# 转储表 approval_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `approval_records`;

CREATE TABLE `approval_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `reimbursement_id` int NOT NULL COMMENT '报销单ID',
  `node_id` int NOT NULL COMMENT '审批节点ID',
  `node_order` int NOT NULL COMMENT '节点顺序(冗余存储)',
  `approver_id` int NOT NULL COMMENT '审批人ID',
  `action` enum('approve','reject','return','delegate') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'approve-通过, reject-驳回, return-退回修改, delegate-转交',
  `opinion` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '审批意见',
  `delegate_to_id` int DEFAULT NULL COMMENT '转交给(当action=delegate时)',
  `approved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '审批时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_reimbursement_id` (`reimbursement_id`) USING BTREE,
  KEY `idx_node_id` (`node_id`) USING BTREE,
  KEY `idx_approver_id` (`approver_id`) USING BTREE,
  KEY `idx_approved_at` (`approved_at`) USING BTREE,
  CONSTRAINT `fk_records_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_records_reimbursement` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='审批记录表';

LOCK TABLES `approval_records` WRITE;
/*!40000 ALTER TABLE `approval_records` DISABLE KEYS */;

INSERT INTO `approval_records` (`id`, `reimbursement_id`, `node_id`, `node_order`, `approver_id`, `action`, `opinion`, `delegate_to_id`, `approved_at`)
VALUES
	(3,10,58,1,37,'approve','1234',NULL,'2026-02-28 16:50:56'),
	(4,10,59,2,37,'approve','',NULL,'2026-02-28 16:52:21'),
	(5,10,60,3,37,'approve','',NULL,'2026-02-28 16:52:29');

/*!40000 ALTER TABLE `approval_records` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 approval_workflow_nodes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `approval_workflow_nodes`;

CREATE TABLE `approval_workflow_nodes` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '节点ID',
  `workflow_id` int NOT NULL COMMENT '所属流程ID',
  `node_order` int NOT NULL DEFAULT '1' COMMENT '节点顺序(从1开始)',
  `node_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '节点名称(如:部门主管审批)',
  `approver_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '审批人类型',
  `approver_id` int DEFAULT NULL COMMENT '具体审批人用户ID(type=user时)',
  `role_id` int DEFAULT NULL COMMENT '角色ID(type=role时)',
  `special_group_id` int DEFAULT NULL,
  `custom_type_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '自定义审批人类型名称',
  `approval_mode` enum('serial','parallel') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'serial' COMMENT 'serial-串行(逐个审批), parallel-并行(多人同时,任一通过)',
  `can_skip` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否可跳过',
  `skip_conditions` json DEFAULT NULL COMMENT '跳过条件(如:{"amount_less_than":1000})',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_workflow_order` (`workflow_id`,`node_order`) USING BTREE,
  KEY `fk_nodes_approver` (`approver_id`) USING BTREE,
  KEY `fk_nodes_role` (`role_id`) USING BTREE,
  CONSTRAINT `fk_nodes_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_nodes_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_nodes_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='审批流程节点表';

LOCK TABLES `approval_workflow_nodes` WRITE;
/*!40000 ALTER TABLE `approval_workflow_nodes` DISABLE KEYS */;

INSERT INTO `approval_workflow_nodes` (`id`, `workflow_id`, `node_order`, `node_name`, `approver_type`, `approver_id`, `role_id`, `special_group_id`, `custom_type_name`, `approval_mode`, `can_skip`, `skip_conditions`, `created_at`)
VALUES
	(61,24,1,'部门主管审批','custom_group',NULL,NULL,NULL,'部门主管','serial',0,NULL,'2026-01-12 02:17:07'),
	(62,24,2,'老板审批','custom_group',NULL,NULL,NULL,'老板','serial',0,NULL,'2026-01-12 02:17:07'),
	(63,24,3,'财务审核','custom_group',NULL,NULL,NULL,'财务','serial',0,NULL,'2026-01-12 02:17:07'),
	(64,24,4,'申请人确认','initiator',NULL,NULL,NULL,NULL,'serial',0,NULL,'2026-01-12 02:17:07'),
	(73,26,1,'部门主管审核','department_manager',NULL,NULL,NULL,NULL,'serial',0,NULL,'2026-01-13 05:07:02'),
	(74,26,2,'资产中心审核','custom_group',NULL,NULL,NULL,'finance','serial',0,NULL,'2026-01-13 05:07:02'),
	(77,22,1,'部门主管审批','role',NULL,33,NULL,NULL,'serial',0,NULL,'2026-03-02 08:14:00'),
	(78,22,2,'申请人确认','initiator',NULL,NULL,NULL,NULL,'serial',0,NULL,'2026-03-02 08:14:00'),
	(79,23,1,'老板审批','custom_group',NULL,NULL,NULL,'财务 123','serial',0,NULL,'2026-03-02 08:14:21'),
	(80,23,2,'申请人确认','initiator',NULL,NULL,NULL,NULL,'serial',0,NULL,'2026-03-02 08:14:21'),
	(83,27,1,'部门主管审批','dept_manager',NULL,NULL,NULL,NULL,'serial',0,NULL,'2026-03-03 16:33:32'),
	(84,27,2,'行政总监审核','role',NULL,NULL,NULL,NULL,'serial',0,NULL,'2026-03-03 16:33:32');

/*!40000 ALTER TABLE `approval_workflow_nodes` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 approval_workflows
# ------------------------------------------------------------

DROP TABLE IF EXISTS `approval_workflows`;

CREATE TABLE `approval_workflows` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '流程ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '流程名称',
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reimbursement' COMMENT '适用业务类型',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '流程描述',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否默认流程',
  `conditions` json DEFAULT NULL COMMENT '触发条件(金额范围、部门、报销类型等)',
  `status` enum('active','inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_type` (`type`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_is_default` (`is_default`) USING BTREE,
  KEY `fk_workflows_created_by` (`created_by`) USING BTREE,
  CONSTRAINT `fk_workflows_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='审批流程配置表';

LOCK TABLES `approval_workflows` WRITE;
/*!40000 ALTER TABLE `approval_workflows` DISABLE KEYS */;

INSERT INTO `approval_workflows` (`id`, `name`, `type`, `description`, `is_default`, `conditions`, `status`, `created_by`, `created_at`, `updated_at`)
VALUES
	(22,'标准报销审批流程','reimbursement','适用于普通员工的标准报销审批流程',1,NULL,'active',NULL,'2026-01-12 02:17:07','2026-01-12 02:17:07'),
	(23,'管理层报销流程','reimbursement','适用于部门主管的报销流程，跳过部门主管审批',0,'{\"is_department_manager\": true}','active',NULL,'2026-01-12 02:17:07','2026-01-12 02:17:07'),
	(24,'大额报销审批流程','reimbursement','适用于金额超过5000元的报销申请',0,'{\"amount_greater_than\": 5000}','active',NULL,'2026-01-12 02:17:07','2026-01-12 02:17:07'),
	(25,'发的撒','reimbursement','111',0,'{\"role_ids\": []}','active',NULL,'2026-01-12 02:17:25','2026-01-12 02:17:25'),
	(26,'默认资产审批流程','asset_request','所有资产申请默认进入此流程',0,NULL,'active',NULL,'2026-01-13 05:07:02','2026-01-13 06:37:01'),
	(27,'默认资产申请流程 1','asset_request','系统自动创建的固定资产申请/升级审批流程',1,NULL,'active',1,'2026-01-13 05:57:41','2026-03-01 10:18:52');

/*!40000 ALTER TABLE `approval_workflows` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 approvers
# ------------------------------------------------------------

DROP TABLE IF EXISTS `approvers`;

CREATE TABLE `approvers` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `user_id` int NOT NULL COMMENT '审批人用户ID',
  `approver_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '审批人类型: Boss/Finance/自定义名称',
  `custom_type_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '自定义审批人类型名称',
  `department_scope` json DEFAULT NULL COMMENT '负责部门范围(部门ID数组,空表示全部)',
  `amount_limit` decimal(12,2) DEFAULT NULL COMMENT '审批金额上限(空表示无限制)',
  `amount_min` decimal(12,2) DEFAULT '0.00',
  `business_types` json DEFAULT NULL COMMENT '可审批的业务类型(空表示全部)',
  `delegate_user_id` int DEFAULT NULL COMMENT '代理审批人ID',
  `delegate_start_date` date DEFAULT NULL COMMENT '代理开始日期',
  `delegate_end_date` date DEFAULT NULL COMMENT '代理结束日期',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_type` (`user_id`,`approver_type`) USING BTREE,
  KEY `idx_approver_type` (`approver_type`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE,
  KEY `fk_approvers_delegate` (`delegate_user_id`) USING BTREE,
  CONSTRAINT `fk_approvers_delegate` FOREIGN KEY (`delegate_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_approvers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='审批人配置表';

LOCK TABLES `approvers` WRITE;
/*!40000 ALTER TABLE `approvers` DISABLE KEYS */;

INSERT INTO `approvers` (`id`, `user_id`, `approver_type`, `custom_type_name`, `department_scope`, `amount_limit`, `amount_min`, `business_types`, `delegate_user_id`, `delegate_start_date`, `delegate_end_date`, `is_active`, `created_at`, `updated_at`)
VALUES
	(5,37,'财务 123',NULL,'[24]',100000.00,0.00,NULL,NULL,NULL,NULL,1,'2026-03-01 08:58:47','2026-03-01 08:58:47');

/*!40000 ALTER TABLE `approvers` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 article_comments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `article_comments`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_article_id` (`article_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_parent_id` (`parent_id`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  CONSTRAINT `article_comments_ibfk_1` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `article_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `article_comments_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `article_comments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 article_likes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `article_likes`;

CREATE TABLE `article_likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `article_id` int NOT NULL,
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `unique_like` (`article_id`,`user_id`) USING BTREE,
  KEY `idx_article` (`article_id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 assessment_plans
# ------------------------------------------------------------

DROP TABLE IF EXISTS `assessment_plans`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_title` (`title`) USING BTREE,
  KEY `idx_exam_id` (`exam_id`) USING BTREE,
  KEY `idx_start_time` (`start_time`) USING BTREE,
  KEY `idx_end_time` (`end_time`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE,
  KEY `idx_time_range` (`start_time`,`end_time`) USING BTREE,
  CONSTRAINT `fk_assessment_plans_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_assessment_plans_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='考核计划表-存储考核计划的安排和配置信息';

LOCK TABLES `assessment_plans` WRITE;
/*!40000 ALTER TABLE `assessment_plans` DISABLE KEYS */;

INSERT INTO `assessment_plans` (`id`, `title`, `description`, `exam_id`, `target_users`, `target_departments`, `start_time`, `end_time`, `max_attempts`, `status`, `created_by`, `created_at`, `updated_at`, `is_deleted`)
VALUES
	(13,'沟通技巧考核',NULL,25,NULL,'[24]','2026-02-25 09:00:00','2026-02-26 09:00:00',1,'draft',37,'2026-02-25 16:52:49','2026-02-25 16:52:49',0);

/*!40000 ALTER TABLE `assessment_plans` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 assessment_results
# ------------------------------------------------------------

DROP TABLE IF EXISTS `assessment_results`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_plan_id` (`plan_id`) USING BTREE,
  KEY `idx_exam_id` (`exam_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_attempt_number` (`attempt_number`) USING BTREE,
  KEY `idx_start_time` (`start_time`) USING BTREE,
  KEY `idx_submit_time` (`submit_time`) USING BTREE,
  KEY `idx_duration` (`duration`) USING BTREE,
  KEY `idx_score` (`score`) USING BTREE,
  KEY `idx_is_passed` (`is_passed`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  CONSTRAINT `fk_assessment_results_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_assessment_results_plan_id` FOREIGN KEY (`plan_id`) REFERENCES `assessment_plans` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_assessment_results_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='考核结果表-存储用户的考试结果和成绩信息';

LOCK TABLES `assessment_results` WRITE;
/*!40000 ALTER TABLE `assessment_results` DISABLE KEYS */;

INSERT INTO `assessment_results` (`id`, `plan_id`, `exam_id`, `user_id`, `attempt_number`, `start_time`, `submit_time`, `duration`, `score`, `is_passed`, `status`, `answers`, `created_at`, `updated_at`)
VALUES
	(39,13,25,37,1,'2026-02-25 16:53:04',NULL,NULL,NULL,0,'in_progress',NULL,'2026-02-25 16:53:04','2026-02-25 16:53:04');

/*!40000 ALTER TABLE `assessment_results` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 asset_assignments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `asset_assignments`;

CREATE TABLE `asset_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `user_id` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `returned_at` timestamp NULL DEFAULT NULL,
  `expected_return_date` date DEFAULT NULL,
  `condition_on_assign` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `condition_on_return` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `assigned_by` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `asset_id` (`asset_id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `assigned_by` (`assigned_by`) USING BTREE,
  CONSTRAINT `asset_assignments_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `asset_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `asset_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 asset_categories
# ------------------------------------------------------------

DROP TABLE IF EXISTS `asset_categories`;

CREATE TABLE `asset_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `asset_categories` WRITE;
/*!40000 ALTER TABLE `asset_categories` DISABLE KEYS */;

INSERT INTO `asset_categories` (`id`, `name`, `code`, `description`, `created_at`, `status`)
VALUES
	(1,'电脑设备','COMPUTER','笔记本、台式机、显示器','2026-01-12 17:13:51','active'),
	(2,'办公外设','PERIPHERAL','键盘、鼠标、耳机、打印机','2026-01-12 17:13:51','active'),
	(3,'办公家具','FURNITURE','桌椅、柜子','2026-01-12 17:13:51','active'),
	(4,'移动设备','MOBILE','测试手机、平板','2026-01-12 17:13:51','active'),
	(5,'发的撒','发的',NULL,'2026-01-13 17:26:10','deleted');

/*!40000 ALTER TABLE `asset_categories` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 asset_component_types
# ------------------------------------------------------------

DROP TABLE IF EXISTS `asset_component_types`;

CREATE TABLE `asset_component_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `asset_component_types` WRITE;
/*!40000 ALTER TABLE `asset_component_types` DISABLE KEYS */;

INSERT INTO `asset_component_types` (`id`, `name`, `icon`, `sort_order`, `created_at`, `status`)
VALUES
	(1,'处理器 (CPU)','cpu',1,'2026-01-13 06:26:51','deleted'),
	(2,'主板 (Mainboard)','circuit-board',2,'2026-01-13 06:26:51','deleted'),
	(3,'内存 (RAM)','layers',3,'2026-01-13 06:26:51','deleted'),
	(4,'硬盘 (Storage)','hard-drive',4,'2026-01-13 06:26:51','active'),
	(5,'显卡 (GPU)','monitor-play',5,'2026-01-13 06:26:51','active'),
	(6,'显示器 (Monitor)','monitor',6,'2026-01-13 06:26:51','deleted'),
	(7,'外设 (Peripherals)','keyboard',7,'2026-01-13 06:26:51','deleted'),
	(8,'处理器 (CPU)','cpu',1,'2026-01-13 06:40:16','active'),
	(9,'主板 (Mainboard)','circuit-board',2,'2026-01-13 06:40:16','active'),
	(10,'内存 (RAM)','layers',3,'2026-01-13 06:40:16','active'),
	(11,'硬盘 (Storage)','hard-drive',4,'2026-01-13 06:40:16','active'),
	(12,'显卡 (GPU)','monitor-play',5,'2026-01-13 06:40:16','deleted'),
	(13,'显示器 (Monitor)','monitor',6,'2026-01-13 06:40:16','active'),
	(14,'外设 (Peripherals)','keyboard',7,'2026-01-13 06:40:16','active'),
	(15,'啊啊啊',NULL,0,'2026-01-13 17:26:32','deleted');

/*!40000 ALTER TABLE `asset_component_types` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 asset_components
# ------------------------------------------------------------

DROP TABLE IF EXISTS `asset_components`;

CREATE TABLE `asset_components` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('cpu','ram','disk','gpu','monitor','peripherals','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_id` int DEFAULT NULL,
  `model` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sn` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `purchase_date` date DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `fk_comp_type` (`type_id`) USING BTREE,
  CONSTRAINT `fk_comp_type` FOREIGN KEY (`type_id`) REFERENCES `asset_component_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `asset_components` WRITE;
/*!40000 ALTER TABLE `asset_components` DISABLE KEYS */;

INSERT INTO `asset_components` (`id`, `name`, `category`, `type_id`, `model`, `sn`, `status`, `purchase_date`, `notes`, `created_at`)
VALUES
	(204,'i5','cpu',8,'i5-10000',NULL,'active',NULL,'放到','2026-03-01 12:07:25');

/*!40000 ALTER TABLE `asset_components` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 asset_device_forms
# ------------------------------------------------------------

DROP TABLE IF EXISTS `asset_device_forms`;

CREATE TABLE `asset_device_forms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `name` (`name`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `asset_device_forms` WRITE;
/*!40000 ALTER TABLE `asset_device_forms` DISABLE KEYS */;

INSERT INTO `asset_device_forms` (`id`, `name`, `icon`, `created_at`, `status`)
VALUES
	(1,'笔记本电脑','laptop','2026-01-13 06:53:45','active'),
	(2,'台式工作站','monitor','2026-01-13 06:53:45','active'),
	(3,'机架式服务器','server','2026-01-13 06:53:45','active'),
	(4,'平板电脑','tablet','2026-01-13 06:53:45','active'),
	(5,'办公外设','keyboard','2026-01-13 06:53:45','deleted');

/*!40000 ALTER TABLE `asset_device_forms` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 asset_model_templates
# ------------------------------------------------------------

DROP TABLE IF EXISTS `asset_model_templates`;

CREATE TABLE `asset_model_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model_id` int NOT NULL,
  `component_id` int DEFAULT NULL,
  `component_category` enum('cpu','ram','disk','gpu','monitor','peripherals','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_component_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `model_id` (`model_id`) USING BTREE,
  KEY `fk_template_component` (`component_id`) USING BTREE,
  CONSTRAINT `asset_model_templates_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `asset_models` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_template_component` FOREIGN KEY (`component_id`) REFERENCES `asset_components` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 asset_models
# ------------------------------------------------------------

DROP TABLE IF EXISTS `asset_models`;

CREATE TABLE `asset_models` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int DEFAULT NULL,
  `form_id` int DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `category_id` (`category_id`) USING BTREE,
  KEY `fk_model_form` (`form_id`) USING BTREE,
  CONSTRAINT `asset_models_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `asset_categories` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_model_form` FOREIGN KEY (`form_id`) REFERENCES `asset_device_forms` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 asset_requests
# ------------------------------------------------------------

DROP TABLE IF EXISTS `asset_requests`;

CREATE TABLE `asset_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `user_id` int NOT NULL,
  `type` enum('upgrade','repair') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_component_type_id` int DEFAULT NULL,
  `workflow_id` int DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `current_node_id` int DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `admin_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `handled_by` int DEFAULT NULL,
  `handled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `asset_id` (`asset_id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `handled_by` (`handled_by`) USING BTREE,
  KEY `fk_req_comp_type` (`target_component_type_id`) USING BTREE,
  CONSTRAINT `asset_requests_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `asset_requests_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `asset_requests_ibfk_3` FOREIGN KEY (`handled_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_req_comp_type` FOREIGN KEY (`target_component_type_id`) REFERENCES `asset_component_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 asset_upgrades
# ------------------------------------------------------------

DROP TABLE IF EXISTS `asset_upgrades`;

CREATE TABLE `asset_upgrades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `component_type_id` int NOT NULL,
  `old_component_id` int DEFAULT NULL,
  `new_component_id` int NOT NULL,
  `upgrade_type` enum('initial','upgrade','repair','replace') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'upgrade',
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `cost` decimal(10,2) DEFAULT '0.00',
  `upgrade_date` date DEFAULT NULL,
  `handled_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `asset_id` (`asset_id`) USING BTREE,
  KEY `component_type_id` (`component_type_id`) USING BTREE,
  KEY `old_component_id` (`old_component_id`) USING BTREE,
  KEY `new_component_id` (`new_component_id`) USING BTREE,
  KEY `handled_by` (`handled_by`) USING BTREE,
  CONSTRAINT `asset_upgrades_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `asset_upgrades_ibfk_2` FOREIGN KEY (`component_type_id`) REFERENCES `asset_component_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `asset_upgrades_ibfk_3` FOREIGN KEY (`old_component_id`) REFERENCES `asset_components` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `asset_upgrades_ibfk_4` FOREIGN KEY (`new_component_id`) REFERENCES `asset_components` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `asset_upgrades_ibfk_5` FOREIGN KEY (`handled_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 assets
# ------------------------------------------------------------

DROP TABLE IF EXISTS `assets`;

CREATE TABLE `assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int DEFAULT NULL,
  `model_id` int DEFAULT NULL,
  `config_summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `device_type` enum('workstation','laptop','server','tablet','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'workstation',
  `model` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serial_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('idle','in_use','maintenance','lost','scrapped') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'idle',
  `purchase_date` date DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `warranty_expire_date` date DEFAULT NULL,
  `supplier` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `current_user_id` int DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `mac_address` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '主要网卡MAC地址，用于快速检索',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `asset_no` (`asset_no`) USING BTREE,
  KEY `category_id` (`category_id`) USING BTREE,
  KEY `current_user_id` (`current_user_id`) USING BTREE,
  KEY `fk_assets_model` (`model_id`) USING BTREE,
  CONSTRAINT `assets_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `asset_categories` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `assets_ibfk_2` FOREIGN KEY (`current_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_assets_model` FOREIGN KEY (`model_id`) REFERENCES `asset_models` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 async_task_logs
# ------------------------------------------------------------

DROP TABLE IF EXISTS `async_task_logs`;

CREATE TABLE `async_task_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `job_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `task_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('waiting','active','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'waiting',
  `progress` int DEFAULT '0',
  `operator_id` int DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `result` json DEFAULT NULL,
  `error_msg` text COLLATE utf8mb4_unicode_ci,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_job_id` (`job_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



# 转储表 attendance_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `attendance_records`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_date` (`user_id`,`attendance_date`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_attendance_date` (`attendance_date`) USING BTREE,
  KEY `idx_check_in_time` (`check_in_time`) USING BTREE,
  KEY `idx_check_out_time` (`check_out_time`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_user_date_status` (`user_id`,`attendance_date`,`status`) USING BTREE,
  KEY `idx_employee_date` (`employee_id`,`record_date`) USING BTREE,
  KEY `idx_emp_status_date` (`employee_id`,`status`,`record_date`),
  CONSTRAINT `fk_attendance_records_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='考勤记录表-员工考勤打卡记录表，记录每日的签到签退信息';



# 转储表 attendance_rules
# ------------------------------------------------------------

DROP TABLE IF EXISTS `attendance_rules`;

CREATE TABLE `attendance_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '规则名称',
  `rule_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '规则类型',
  `rule_value` json DEFAULT NULL COMMENT '规则值',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_rule_type` (`rule_type`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='考勤规则表';



# 转储表 attendance_settings
# ------------------------------------------------------------

DROP TABLE IF EXISTS `attendance_settings`;

CREATE TABLE `attendance_settings` (
  `id` int NOT NULL,
  `enable_location_check` tinyint(1) NOT NULL DEFAULT '0',
  `allowed_distance` int NOT NULL DEFAULT '500',
  `allowed_locations` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
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
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `attendance_settings` WRITE;
/*!40000 ALTER TABLE `attendance_settings` DISABLE KEYS */;

INSERT INTO `attendance_settings` (`id`, `enable_location_check`, `allowed_distance`, `allowed_locations`, `enable_time_check`, `early_clock_in_minutes`, `late_clock_out_minutes`, `late_minutes`, `early_leave_minutes`, `absent_hours`, `max_annual_leave_days`, `max_sick_leave_days`, `require_proof_for_sick_leave`, `require_approval_for_overtime`, `min_overtime_hours`, `max_overtime_hours_per_day`, `allow_makeup`, `makeup_deadline_days`, `require_approval_for_makeup`, `notify_on_late`, `notify_on_early_leave`, `notify_on_absent`, `created_at`, `updated_at`)
VALUES
	(1,0,500,'[]',1,60,120,30,30,4,10,15,1,1,1.0,4,1,3,1,1,1,1,'2025-12-28 11:24:17','2025-12-28 11:24:25');

/*!40000 ALTER TABLE `attendance_settings` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 broadcast_recipients
# ------------------------------------------------------------

DROP TABLE IF EXISTS `broadcast_recipients`;

CREATE TABLE `broadcast_recipients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `broadcast_id` int NOT NULL COMMENT '广播ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `is_read` tinyint(1) DEFAULT '0' COMMENT '是否已读',
  `read_at` timestamp NULL DEFAULT NULL COMMENT '阅读时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_broadcast_user` (`broadcast_id`,`user_id`) USING BTREE,
  KEY `idx_broadcast` (`broadcast_id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE,
  KEY `idx_read` (`is_read`) USING BTREE,
  CONSTRAINT `broadcast_recipients_ibfk_1` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `broadcast_recipients_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='广播接收记录表';

LOCK TABLES `broadcast_recipients` WRITE;
/*!40000 ALTER TABLE `broadcast_recipients` DISABLE KEYS */;

INSERT INTO `broadcast_recipients` (`id`, `broadcast_id`, `user_id`, `is_read`, `read_at`, `created_at`)
VALUES
	(211,41,37,1,'2026-02-19 15:51:21','2026-02-19 09:35:45'),
	(212,42,37,1,'2026-02-19 15:51:21','2026-02-19 09:46:10'),
	(213,43,37,1,'2026-02-19 15:51:21','2026-02-19 15:51:10'),
	(214,44,37,1,'2026-02-19 16:09:31','2026-02-19 16:09:22'),
	(215,45,37,1,'2026-02-19 23:41:05','2026-02-19 23:40:56'),
	(216,46,37,1,'2026-02-20 12:42:26','2026-02-20 12:42:18'),
	(217,47,37,1,'2026-02-20 15:11:44','2026-02-20 15:11:29'),
	(218,48,37,1,'2026-02-20 15:24:23','2026-02-20 15:24:14'),
	(219,49,37,1,'2026-02-20 15:29:36','2026-02-20 15:29:22'),
	(220,50,37,1,'2026-02-20 22:05:41','2026-02-20 22:05:36'),
	(221,51,37,1,'2026-02-23 17:23:57','2026-02-23 16:49:40'),
	(222,52,37,1,'2026-02-23 17:23:55','2026-02-23 16:50:02'),
	(223,53,37,1,'2026-02-23 17:23:52','2026-02-23 16:50:15'),
	(224,54,37,1,'2026-02-24 08:36:39','2026-02-24 08:22:09'),
	(225,55,37,1,'2026-02-24 08:37:09','2026-02-24 08:37:02'),
	(226,56,37,1,'2026-02-24 09:20:09','2026-02-24 09:05:27');

/*!40000 ALTER TABLE `broadcast_recipients` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 broadcasts
# ------------------------------------------------------------

DROP TABLE IF EXISTS `broadcasts`;

CREATE TABLE `broadcasts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '广播标题',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '广播内容',
  `type` enum('info','warning','success','error','announcement') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'info' COMMENT '广播类型',
  `priority` enum('low','normal','high','urgent') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'normal' COMMENT '优先级',
  `target_type` enum('all','department','role','individual') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '目标类型',
  `target_departments` json DEFAULT NULL COMMENT '目标部门ID列表',
  `target_roles` json DEFAULT NULL COMMENT '目标角色列表',
  `target_users` json DEFAULT NULL COMMENT '目标用户ID列表',
  `creator_id` int NOT NULL COMMENT '创建者ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_creator` (`creator_id`) USING BTREE,
  KEY `idx_created` (`created_at`) USING BTREE,
  CONSTRAINT `broadcasts_ibfk_1` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='系统广播表';

LOCK TABLES `broadcasts` WRITE;
/*!40000 ALTER TABLE `broadcasts` DISABLE KEYS */;

INSERT INTO `broadcasts` (`id`, `title`, `content`, `type`, `priority`, `target_type`, `target_departments`, `target_roles`, `target_users`, `creator_id`, `created_at`, `expires_at`)
VALUES
	(41,'测试','测试','info','normal','all',NULL,NULL,NULL,37,'2026-02-19 09:35:45',NULL),
	(42,'测试','测试','info','normal','all',NULL,NULL,NULL,37,'2026-02-19 09:46:10',NULL),
	(43,'123','123','info','normal','all',NULL,NULL,NULL,37,'2026-02-19 15:51:10',NULL),
	(44,'发的撒','发的撒','info','normal','all',NULL,NULL,NULL,37,'2026-02-19 16:09:22',NULL),
	(45,'测试','测试','info','normal','all',NULL,NULL,NULL,37,'2026-02-19 23:40:56',NULL),
	(46,'123','123','info','normal','all',NULL,NULL,NULL,37,'2026-02-20 12:42:18',NULL),
	(47,'发的','费水电费','info','normal','all',NULL,NULL,NULL,37,'2026-02-20 15:11:29',NULL),
	(48,'册书','123','info','urgent','all',NULL,NULL,NULL,37,'2026-02-20 15:24:14',NULL),
	(49,'打算','dadd','info','normal','all',NULL,NULL,NULL,37,'2026-02-20 15:29:22',NULL),
	(50,'123','13','info','normal','all',NULL,NULL,NULL,37,'2026-02-20 22:05:36',NULL),
	(51,'放大舒服','范德萨粉丝','info','normal','all',NULL,NULL,NULL,37,'2026-02-23 16:49:40',NULL),
	(52,'范德萨发','费水电费都是','info','urgent','all',NULL,NULL,NULL,37,'2026-02-23 16:50:02',NULL),
	(53,'发发发大发','范德萨粉丝','info','urgent','all',NULL,NULL,NULL,37,'2026-02-23 16:50:15',NULL),
	(54,'123','123','info','normal','all',NULL,NULL,NULL,37,'2026-02-24 08:22:09',NULL),
	(55,'法打','发送','info','normal','all',NULL,NULL,NULL,37,'2026-02-24 08:37:02',NULL),
	(56,'发的撒','范德萨发','info','normal','all',NULL,NULL,NULL,37,'2026-02-24 09:05:27',NULL);

/*!40000 ALTER TABLE `broadcasts` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 case_attachments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `case_attachments`;

CREATE TABLE `case_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL COMMENT '案例ID',
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名称',
  `file_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件类型 (e.g., image/jpeg, application/pdf)',
  `file_size` int DEFAULT NULL COMMENT '文件大小 (bytes)',
  `file_url` varchar(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件存储URL',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `case_id` (`case_id`) USING BTREE,
  CONSTRAINT `case_attachments_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 case_categories
# ------------------------------------------------------------

DROP TABLE IF EXISTS `case_categories`;

CREATE TABLE `case_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分类名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '分类描述',
  `parent_id` int DEFAULT NULL COMMENT '父分类ID（支持多级分类）',
  `sort_order` int DEFAULT '0' COMMENT '排序权重',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `name` (`name`) USING BTREE,
  KEY `idx_parent` (`parent_id`) USING BTREE,
  KEY `idx_active` (`is_active`) USING BTREE,
  CONSTRAINT `case_categories_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `case_categories` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='案例分类表';

LOCK TABLES `case_categories` WRITE;
/*!40000 ALTER TABLE `case_categories` DISABLE KEYS */;

INSERT INTO `case_categories` (`id`, `name`, `description`, `parent_id`, `sort_order`, `is_active`, `created_at`, `updated_at`)
VALUES
	(6,'精品案例','',NULL,0,1,'2026-02-21 09:41:00','2026-02-25 16:49:27');

/*!40000 ALTER TABLE `case_categories` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 case_comments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `case_comments`;

CREATE TABLE `case_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL COMMENT '案例ID',
  `user_id` int NOT NULL COMMENT '评论用户ID',
  `comment_content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '评论内容',
  `parent_comment_id` int DEFAULT NULL COMMENT '父评论ID (用于回复)',
  `like_count` int DEFAULT '0' COMMENT '点赞次数',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `case_id` (`case_id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `parent_comment_id` (`parent_comment_id`) USING BTREE,
  CONSTRAINT `case_comments_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `case_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `case_comments_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `case_comments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 case_learning_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `case_learning_records`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `user_id` (`user_id`,`case_id`) USING BTREE,
  KEY `case_id` (`case_id`) USING BTREE,
  CONSTRAINT `case_learning_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `case_learning_records_ibfk_2` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 case_tags
# ------------------------------------------------------------

DROP TABLE IF EXISTS `case_tags`;

CREATE TABLE `case_tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录唯一标识ID',
  `case_id` int NOT NULL COMMENT '案例ID，关联cases表，级联删除',
  `tag_id` int NOT NULL COMMENT '标签ID，关联tags表，级联删除',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '关联创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_case_tag` (`case_id`,`tag_id`) USING BTREE,
  KEY `idx_case_id` (`case_id`) USING BTREE,
  KEY `idx_tag_id` (`tag_id`) USING BTREE,
  CONSTRAINT `fk_case_tags_case_id` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_case_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例标签关联表-案例与标签的多对多关联表';



# 转储表 cases
# ------------------------------------------------------------

DROP TABLE IF EXISTS `cases`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_title` (`title`) USING BTREE,
  KEY `idx_category` (`category`) USING BTREE,
  KEY `idx_difficulty` (`difficulty`) USING BTREE,
  KEY `idx_priority` (`priority`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_view_count` (`view_count`) USING BTREE,
  KEY `idx_like_count` (`like_count`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  FULLTEXT KEY `ft_content_search` (`title`,`description`,`problem`,`solution`),
  CONSTRAINT `fk_cases_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例表-存储知识案例库的案例信息';



# 转储表 chat_group_members
# ------------------------------------------------------------

DROP TABLE IF EXISTS `chat_group_members`;

CREATE TABLE `chat_group_members` (
  `group_id` int NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `role` enum('admin','member') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'member',
  `last_read_message_id` int DEFAULT '0',
  `is_muted` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`group_id`,`user_id`) USING BTREE,
  UNIQUE KEY `unique_group_user` (`group_id`,`user_id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  CONSTRAINT `chat_group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `chat_groups` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chat_group_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `chat_group_members` WRITE;
/*!40000 ALTER TABLE `chat_group_members` DISABLE KEYS */;

INSERT INTO `chat_group_members` (`group_id`, `user_id`, `joined_at`, `role`, `last_read_message_id`, `is_muted`)
VALUES
	(10,37,'2026-02-19 16:38:32','admin',27,0),
	(11,37,'2026-02-19 16:38:32','admin',21,0),
	(12,37,'2026-02-19 16:38:32','admin',15,0),
	(13,37,'2026-02-19 16:38:32','admin',32,0),
	(14,37,'2026-02-19 16:38:32','admin',26,0);

/*!40000 ALTER TABLE `chat_group_members` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 chat_groups
# ------------------------------------------------------------

DROP TABLE IF EXISTS `chat_groups`;

CREATE TABLE `chat_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int NOT NULL,
  `type` enum('group','p2p') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'group',
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `department_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `department_id` (`department_id`) USING BTREE,
  KEY `owner_id` (`owner_id`) USING BTREE,
  CONSTRAINT `chat_groups_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chat_groups_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `chat_groups` WRITE;
/*!40000 ALTER TABLE `chat_groups` DISABLE KEYS */;

INSERT INTO `chat_groups` (`id`, `name`, `owner_id`, `type`, `avatar`, `created_at`, `updated_at`, `department_id`)
VALUES
	(10,'管理部',37,'group',NULL,'2026-02-19 16:38:32','2026-02-19 16:38:32',24),
	(11,'客服部',37,'group',NULL,'2026-02-19 16:38:32','2026-02-19 16:38:32',25),
	(12,'技术部',37,'group',NULL,'2026-02-19 16:38:32','2026-02-19 16:38:32',26),
	(13,'质检部',37,'group',NULL,'2026-02-19 16:38:32','2026-02-19 16:38:32',27),
	(14,'运营部',37,'group',NULL,'2026-02-19 16:38:32','2026-02-19 16:38:32',28);

/*!40000 ALTER TABLE `chat_groups` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 chat_messages
# ------------------------------------------------------------

DROP TABLE IF EXISTS `chat_messages`;

CREATE TABLE `chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `group_id` int DEFAULT NULL,
  `receiver_id` int DEFAULT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `msg_type` enum('text','image','file','system') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `file_url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_chat_sender` (`sender_id`) USING BTREE,
  KEY `idx_chat_receiver` (`receiver_id`) USING BTREE,
  KEY `idx_chat_group` (`group_id`) USING BTREE,
  KEY `idx_chat_time` (`created_at`) USING BTREE,
  KEY `idx_group_id_id` (`group_id`,`id`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chat_messages_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `chat_groups` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chat_messages_ibfk_3` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `chat_messages` WRITE;
/*!40000 ALTER TABLE `chat_messages` DISABLE KEYS */;

INSERT INTO `chat_messages` (`id`, `sender_id`, `group_id`, `receiver_id`, `content`, `msg_type`, `file_url`, `is_read`, `created_at`)
VALUES
	(1,37,10,NULL,'你好','text',NULL,0,'2026-02-19 16:38:50'),
	(2,37,10,NULL,'你是谁啊','text',NULL,0,'2026-02-19 16:38:56'),
	(3,37,10,NULL,'你好','text',NULL,0,'2026-02-19 18:31:05'),
	(4,37,10,NULL,'你好啊','text',NULL,0,'2026-02-19 18:31:14'),
	(5,37,11,NULL,'好','text',NULL,0,'2026-02-19 18:36:55'),
	(6,37,10,NULL,'你好啊','text',NULL,0,'2026-02-19 18:37:00'),
	(7,37,10,NULL,'真','text',NULL,0,'2026-02-19 18:37:03'),
	(13,37,10,NULL,'发大发大','text',NULL,0,'2026-02-24 09:04:50'),
	(14,37,12,NULL,'范德萨发撒','text',NULL,0,'2026-02-24 09:04:55'),
	(15,37,12,NULL,'发送','text',NULL,0,'2026-02-24 09:07:16'),
	(16,37,10,NULL,'发的撒','text',NULL,0,'2026-02-24 09:07:23'),
	(17,37,10,NULL,'发的撒','text',NULL,0,'2026-02-24 09:07:39'),
	(18,37,11,NULL,'fsd','text',NULL,0,'2026-02-24 09:07:43'),
	(19,37,10,NULL,'发的撒','text',NULL,0,'2026-02-24 09:07:46'),
	(20,37,11,NULL,'法打','text',NULL,0,'2026-02-24 09:07:53'),
	(21,37,11,NULL,'发的撒','text',NULL,0,'2026-02-24 09:14:57'),
	(23,37,14,NULL,'发送','text',NULL,0,'2026-02-24 09:20:57'),
	(24,37,14,NULL,'发送','text',NULL,0,'2026-02-24 09:25:37'),
	(25,37,14,NULL,'发的撒','text',NULL,0,'2026-02-24 10:26:58'),
	(26,37,14,NULL,'发的撒','text',NULL,0,'2026-02-24 16:49:05'),
	(27,37,10,NULL,'发大水','text',NULL,0,'2026-02-24 16:49:08'),
	(28,37,11,NULL,'你好','text',NULL,0,'2026-02-25 16:43:45'),
	(29,37,10,NULL,'你好','text',NULL,0,'2026-02-25 16:43:48'),
	(30,37,14,NULL,'你好','text',NULL,0,'2026-02-25 16:43:53'),
	(31,37,12,NULL,'你好','text',NULL,0,'2026-02-25 16:43:59'),
	(32,37,13,NULL,'你好   ','text',NULL,0,'2026-02-25 16:44:12'),
	(33,37,13,NULL,'你好啊','text',NULL,0,'2026-03-03 09:07:29');

/*!40000 ALTER TABLE `chat_messages` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 chat_room_members
# ------------------------------------------------------------

DROP TABLE IF EXISTS `chat_room_members`;

CREATE TABLE `chat_room_members` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '成员关系唯一标识ID',
  `room_id` int NOT NULL COMMENT '聊天室ID，关联chat_rooms表，级联删除',
  `user_id` int NOT NULL COMMENT '用户ID，关联users表，级联删除',
  `role` enum('owner','admin','member') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member' COMMENT '成员角色：owner-群主，admin-管理员，member-普通成员',
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `last_read_at` datetime DEFAULT NULL COMMENT '最后阅读时间，用于计算未读消息',
  `is_muted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否静音：1-静音，0-正常',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_room_user` (`room_id`,`user_id`) USING BTREE,
  KEY `idx_room_id` (`room_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_role` (`role`) USING BTREE,
  KEY `idx_joined_at` (`joined_at`) USING BTREE,
  KEY `idx_last_read_at` (`last_read_at`) USING BTREE,
  KEY `idx_is_muted` (`is_muted`) USING BTREE,
  CONSTRAINT `fk_chat_room_members_room_id` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_chat_room_members_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='聊天室成员表-聊天室成员关系表';



# 转储表 collected_messages
# ------------------------------------------------------------

DROP TABLE IF EXISTS `collected_messages`;

CREATE TABLE `collected_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `message_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_message_id` (`message_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 compensatory_leave_requests
# ------------------------------------------------------------

DROP TABLE IF EXISTS `compensatory_leave_requests`;

CREATE TABLE `compensatory_leave_requests` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `request_type` enum('schedule_change','compensatory_leave') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'compensatory_leave' COMMENT '申请类型',
  `original_schedule_date` date DEFAULT NULL COMMENT '原排班日期',
  `original_shift_id` int DEFAULT NULL COMMENT '原班次ID',
  `new_schedule_date` date DEFAULT NULL COMMENT '新排班日期',
  `new_shift_id` int DEFAULT NULL COMMENT '新班次ID',
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '申请理由',
  `status` enum('pending','approved','rejected','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'pending' COMMENT '状态',
  `approver_id` int DEFAULT NULL COMMENT '审批人ID',
  `approval_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '审批备注',
  `approved_at` timestamp NULL DEFAULT NULL COMMENT '审批时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_employee_id` (`employee_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_approver_id` (`approver_id`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='调休申请表';



# 转储表 conversation_members
# ------------------------------------------------------------

DROP TABLE IF EXISTS `conversation_members`;

CREATE TABLE `conversation_members` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('member','admin','owner') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'member',
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0',
  `is_muted` tinyint(1) NOT NULL DEFAULT '0',
  `unread_count` int unsigned NOT NULL DEFAULT '0',
  `last_read_message_id` bigint unsigned DEFAULT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `left_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_conv_member` (`conversation_id`,`user_id`) USING BTREE,
  KEY `idx_conv_member_conv` (`conversation_id`) USING BTREE,
  KEY `idx_conv_member_user` (`user_id`) USING BTREE,
  CONSTRAINT `fk_conv_members_conv` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_conv_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;



# 转储表 conversations
# ------------------------------------------------------------

DROP TABLE IF EXISTS `conversations`;

CREATE TABLE `conversations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `type` enum('single','group','room') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `creator_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_conv_type` (`type`) USING BTREE,
  KEY `idx_conv_creator` (`creator_id`) USING BTREE,
  CONSTRAINT `fk_conversations_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;



# 转储表 conversion_rules
# ------------------------------------------------------------

DROP TABLE IF EXISTS `conversion_rules`;

CREATE TABLE `conversion_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '转换规则' COMMENT '规则名称',
  `conversion_rate` decimal(10,2) NOT NULL COMMENT '转换比例（如：8小时=1天）',
  `enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '规则描述',
  `ratio` decimal(10,4) DEFAULT '0.1250' COMMENT '转换比例',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='额度转换规则表';

LOCK TABLES `conversion_rules` WRITE;
/*!40000 ALTER TABLE `conversion_rules` DISABLE KEYS */;

INSERT INTO `conversion_rules` (`id`, `name`, `conversion_rate`, `enabled`, `created_at`, `updated_at`, `description`, `ratio`)
VALUES
	(5,'默认加班转换规则',0.13,1,'2025-12-20 17:59:00','2025-12-20 17:59:00','8小时加班 = 1天假期',0.1250);

/*!40000 ALTER TABLE `conversion_rules` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 conversion_usage_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `conversion_usage_records`;

CREATE TABLE `conversion_usage_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '使用记录ID',
  `conversion_id` int NOT NULL COMMENT '转换记录ID',
  `leave_record_id` int NOT NULL COMMENT '请假记录ID',
  `used_days` decimal(10,2) NOT NULL COMMENT '使用天数',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_conversion` (`conversion_id`) USING BTREE,
  KEY `idx_leave_record` (`leave_record_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='假期转换使用记录表';



# 转储表 crm_customers
# ------------------------------------------------------------

DROP TABLE IF EXISTS `crm_customers`;

CREATE TABLE `crm_customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `level` enum('normal','vip','black') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'normal',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `phone` (`phone`) USING BTREE,
  KEY `created_by` (`created_by`) USING BTREE,
  CONSTRAINT `crm_customers_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 customers
# ------------------------------------------------------------

DROP TABLE IF EXISTS `customers`;

CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '客户ID',
  `customer_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '客户ID（外部系统）',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户姓名',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系电话',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '电子邮箱',
  `platform_id` int DEFAULT NULL COMMENT '所属平台ID',
  `shop_id` int DEFAULT NULL COMMENT '所属店铺ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_customer_platform_shop` (`customer_id`,`platform_id`,`shop_id`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_phone` (`phone`) USING BTREE,
  KEY `idx_platform_shop` (`platform_id`,`shop_id`) USING BTREE,
  KEY `fk_customers_shop` (`shop_id`) USING BTREE,
  CONSTRAINT `fk_customers_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_customers_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='客户表';



# 转储表 departments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `departments`;

CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '部门唯一标识ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '部门名称',
  `parent_id` int DEFAULT NULL COMMENT '父部门ID，支持多级部门',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '部门描述',
  `manager_id` int DEFAULT NULL COMMENT '部门经理用户ID',
  `status` enum('active','inactive','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_parent_id` (`parent_id`) USING BTREE,
  KEY `idx_manager_id` (`manager_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_sort_order` (`sort_order`) USING BTREE,
  CONSTRAINT `fk_departments_manager_id` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_departments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='部门表-存储组织架构信息';

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;

INSERT INTO `departments` (`id`, `name`, `parent_id`, `description`, `manager_id`, `status`, `sort_order`, `created_at`, `updated_at`)
VALUES
	(18,'部门2',NULL,'123',NULL,'deleted',0,'2026-01-11 17:13:09','2026-02-19 16:30:50'),
	(24,'管理部',NULL,'公司管理层部门，负责公司整体运营和战略规划',NULL,'active',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(25,'客服部',NULL,'客户服务部门，负责处理客户咨询和售后服务',NULL,'active',2,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(26,'技术部',NULL,'技术研发部门，负责系统开发和技术支持',NULL,'active',3,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(27,'质检部',NULL,'质量检查部门，负责客服质量监控和评估',NULL,'active',4,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(28,'运营部',NULL,'运营管理部门，负责业务运营和数据分析',NULL,'active',5,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(29,'发生的范德萨发多少',NULL,'发生的',NULL,'deleted',0,'2026-01-15 14:03:46','2026-02-24 09:38:43'),
	(30,'测试部门12',NULL,NULL,NULL,'deleted',0,'2026-02-19 09:47:14','2026-02-19 16:30:35'),
	(31,'测试部门 001',NULL,NULL,NULL,'deleted',0,'2026-02-19 16:31:06','2026-02-24 09:07:06');

/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 device_component_mapping
# ------------------------------------------------------------

DROP TABLE IF EXISTS `device_component_mapping`;

CREATE TABLE `device_component_mapping` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `component_id` int NOT NULL,
  `bound_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `asset_id` (`asset_id`) USING BTREE,
  KEY `component_id` (`component_id`) USING BTREE,
  CONSTRAINT `device_component_mapping_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `device_component_mapping_ibfk_2` FOREIGN KEY (`component_id`) REFERENCES `asset_components` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 device_config_details
# ------------------------------------------------------------

DROP TABLE IF EXISTS `device_config_details`;

CREATE TABLE `device_config_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `component_type_id` int NOT NULL,
  `component_id` int NOT NULL,
  `quantity` int DEFAULT '1',
  `change_type` enum('initial','upgrade','downgrade') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'initial',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `device_id` (`device_id`) USING BTREE,
  KEY `component_type_id` (`component_type_id`) USING BTREE,
  KEY `component_id` (`component_id`) USING BTREE,
  CONSTRAINT `device_config_details_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `device_config_details_ibfk_2` FOREIGN KEY (`component_type_id`) REFERENCES `asset_component_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `device_config_details_ibfk_3` FOREIGN KEY (`component_id`) REFERENCES `asset_components` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 devices
# ------------------------------------------------------------

DROP TABLE IF EXISTS `devices`;

CREATE TABLE `devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_id` int NOT NULL,
  `current_user_id` int DEFAULT NULL,
  `device_status` enum('idle','in_use','damaged','maintenance','scrapped') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'idle',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `purchase_date` date DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `asset_no` (`asset_no`) USING BTREE,
  KEY `model_id` (`model_id`) USING BTREE,
  KEY `current_user_id` (`current_user_id`) USING BTREE,
  CONSTRAINT `devices_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `asset_models` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `devices_ibfk_2` FOREIGN KEY (`current_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 employee_changes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `employee_changes`;

CREATE TABLE `employee_changes` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '变动记录ID',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `change_type` enum('hire','transfer','promotion','resign','terminate') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '变动类型',
  `change_date` date NOT NULL COMMENT '变动日期',
  `old_department_id` int DEFAULT NULL COMMENT '原部门ID',
  `new_department_id` int DEFAULT NULL COMMENT '新部门ID',
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '变动原因',
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '备注',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `old_position_id` int DEFAULT NULL COMMENT '原职位ID',
  `new_position_id` int DEFAULT NULL COMMENT '新职位ID',
  `old_position` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `new_position` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `employee_id` (`employee_id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `change_type` (`change_type`) USING BTREE,
  KEY `change_date` (`change_date`) USING BTREE,
  KEY `idx_old_position_id` (`old_position_id`) USING BTREE,
  KEY `idx_new_position_id` (`new_position_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='员工变动记录表';

LOCK TABLES `employee_changes` WRITE;
/*!40000 ALTER TABLE `employee_changes` DISABLE KEYS */;

INSERT INTO `employee_changes` (`id`, `employee_id`, `user_id`, `change_type`, `change_date`, `old_department_id`, `new_department_id`, `reason`, `remarks`, `created_by`, `created_at`, `updated_at`, `old_position_id`, `new_position_id`, `old_position`, `new_position`)
VALUES
	(64,21,37,'transfer','2026-03-03',24,24,'信息变更','',NULL,'2026-03-03 08:40:45','2026-03-03 08:40:45',51,51,'','总经理');

/*!40000 ALTER TABLE `employee_changes` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 employee_status_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `employee_status_records`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_employee_id` (`employee_id`) USING BTREE,
  KEY `idx_change_date` (`change_date`) USING BTREE,
  KEY `idx_new_status` (`new_status`) USING BTREE,
  KEY `idx_operated_by` (`operated_by`) USING BTREE,
  KEY `fk_employee_status_records_old_dept` (`old_department_id`) USING BTREE,
  KEY `fk_employee_status_records_new_dept` (`new_department_id`) USING BTREE,
  CONSTRAINT `fk_employee_status_records_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_employee_status_records_new_dept` FOREIGN KEY (`new_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_employee_status_records_old_dept` FOREIGN KEY (`old_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_employee_status_records_operated_by` FOREIGN KEY (`operated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='员工状态变更记录表-记录员工状态和部门变更历史';





# 转储表 employees
# ------------------------------------------------------------

DROP TABLE IF EXISTS `employees`;

CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '员工记录ID',
  `user_id` int NOT NULL COMMENT '关联用户ID',
  `employee_no` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '员工工号',
  `hire_date` date NOT NULL COMMENT '入职日期',
  `salary` decimal(10,2) DEFAULT NULL COMMENT '基本薪资',
  `status` enum('active','inactive','resigned','deleted') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `emergency_contact` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '紧急联系人',
  `emergency_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '紧急联系电话',
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '家庭住址',
  `education` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '学历',
  `skills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '技能特长',
  `remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `rating` tinyint(1) NOT NULL DEFAULT '1' COMMENT '员工星级评定',
  `position_id` int DEFAULT NULL COMMENT '职位ID，关联positions表',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_id` (`user_id`) USING BTREE,
  UNIQUE KEY `uk_employee_no` (`employee_no`) USING BTREE,
  KEY `idx_hire_date` (`hire_date`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_position_id` (`position_id`) USING BTREE,
  CONSTRAINT `fk_employees_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employees_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='员工信息表';

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;

INSERT INTO `employees` (`id`, `user_id`, `employee_no`, `hire_date`, `salary`, `status`, `emergency_contact`, `emergency_phone`, `address`, `education`, `skills`, `remark`, `created_at`, `updated_at`, `rating`, `position_id`)
VALUES
	(21,37,'EMP001','2023-12-14',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-01-11 17:22:43','2026-03-03 08:40:53',1,51);

/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 exam_categories
# ------------------------------------------------------------

DROP TABLE IF EXISTS `exam_categories`;

CREATE TABLE `exam_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分类名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '分类描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` datetime DEFAULT NULL COMMENT '删除时间',
  `deleted_by` int DEFAULT NULL COMMENT '删除操作用户ID',
  `status` enum('active','inactive','deleted') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'active' COMMENT '状态',
  `order_num` int NOT NULL DEFAULT '1' COMMENT '排序号',
  `path` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '/' COMMENT '路径',
  `level` int NOT NULL DEFAULT '1' COMMENT '层级',
  `weight` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '权重',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `parent_id` int DEFAULT NULL COMMENT '父级分类ID',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_deleted_at` (`deleted_at`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_parent_id` (`parent_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='试卷分类表';

LOCK TABLES `exam_categories` WRITE;
/*!40000 ALTER TABLE `exam_categories` DISABLE KEYS */;

INSERT INTO `exam_categories` (`id`, `name`, `description`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`, `status`, `order_num`, `path`, `level`, `weight`, `created_by`, `parent_id`)
VALUES
	(12,'入职培训','新员工入职培训相关试卷','2025-12-20 17:59:00','2025-12-20 17:59:00',NULL,NULL,'active',1,'/',1,0.00,1,NULL),
	(13,'岗位技能','各岗位专业技能培训试卷','2025-12-20 17:59:00','2025-12-20 17:59:00',NULL,NULL,'active',2,'/',1,0.00,1,NULL),
	(14,'安全教育','安全生产和职业健康培训试卷','2025-12-20 17:59:00','2025-12-20 17:59:00',NULL,NULL,'active',3,'/',1,0.00,1,NULL),
	(15,'法律法规','相关法律法规知识测试试卷','2025-12-20 17:59:00','2025-12-20 17:59:00',NULL,NULL,'active',4,'/',1,0.00,1,NULL),
	(16,'综合素质','员工综合素质提升测试试卷','2025-12-20 17:59:00','2025-12-20 17:59:00',NULL,NULL,'active',5,'/',1,0.00,1,NULL),
	(17,'年度考核','年度绩效考核相关试卷','2025-12-20 17:59:00','2025-12-20 17:59:00',NULL,NULL,'active',6,'/',1,0.00,1,NULL),
	(18,'专项培训','特定主题专项培训试卷','2025-12-20 17:59:00','2025-12-20 17:59:00',NULL,NULL,'active',7,'/',1,0.00,1,NULL);

/*!40000 ALTER TABLE `exam_categories` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 exam_category_audit_logs
# ------------------------------------------------------------

DROP TABLE IF EXISTS `exam_category_audit_logs`;

CREATE TABLE `exam_category_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int DEFAULT NULL,
  `operator_id` int DEFAULT NULL,
  `operation` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `detail` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;



# 转储表 exams
# ------------------------------------------------------------

DROP TABLE IF EXISTS `exams`;

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
  `questions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_title` (`title`) USING BTREE,
  KEY `idx_category` (`category`) USING BTREE,
  KEY `idx_difficulty` (`difficulty`) USING BTREE,
  KEY `idx_duration` (`duration`) USING BTREE,
  KEY `idx_total_score` (`total_score`) USING BTREE,
  KEY `idx_pass_score` (`pass_score`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE,
  KEY `fk_exams_category_id` (`category_id`) USING BTREE,
  CONSTRAINT `fk_exams_category_id` FOREIGN KEY (`category_id`) REFERENCES `exam_categories` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_exams_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='试卷表-存储考试试卷的基本信息和配置';

LOCK TABLES `exams` WRITE;
/*!40000 ALTER TABLE `exams` DISABLE KEYS */;

INSERT INTO `exams` (`id`, `title`, `description`, `category`, `category_id`, `difficulty`, `duration`, `total_score`, `pass_score`, `question_count`, `status`, `created_by`, `created_at`, `updated_at`, `questions`)
VALUES
	(25,'沟通技巧',NULL,'入职培训',12,'medium',60,30.00,20.00,3,'published',37,'2026-02-25 16:50:57','2026-02-25 16:52:30','[{\"id\":\"temp_1772009478396\",\"type\":\"multiple_choice\",\"content\":\"新题目\",\"options\":[\"选项A\",\"选项B\",\"选项C\"],\"correct_answer\":\"AB\",\"score\":10,\"explanation\":\"\",\"order_num\":1},{\"id\":\"temp_1772009544020\",\"type\":\"single_choice\",\"content\":\"新题目\",\"options\":[\"选项A\",\"选项B\"],\"correct_answer\":\"A\",\"score\":10,\"explanation\":\"\",\"order_num\":2},{\"id\":\"temp_1772009476267\",\"type\":\"single_choice\",\"content\":\"新题目\",\"options\":[\"选项A\",\"选项B\"],\"correct_answer\":\"A\",\"score\":10,\"explanation\":\"\",\"order_num\":3}]');

/*!40000 ALTER TABLE `exams` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 expense_types
# ------------------------------------------------------------

DROP TABLE IF EXISTS `expense_types`;

CREATE TABLE `expense_types` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '费用名称',
  `category_id` int unsigned DEFAULT NULL COMMENT '关联报销类型ID(可选)',
  `unit` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '单位(如: 天, 次)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_name` (`name`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='费用类型明细配置表';

LOCK TABLES `expense_types` WRITE;
/*!40000 ALTER TABLE `expense_types` DISABLE KEYS */;

INSERT INTO `expense_types` (`id`, `name`, `category_id`, `unit`, `is_active`, `sort_order`, `created_at`, `updated_at`)
VALUES
	(1,'火车/高铁票',NULL,NULL,0,1,'2026-01-11 16:39:31','2026-03-01 09:46:22'),
	(2,'飞机票',NULL,NULL,0,2,'2026-01-11 16:39:31','2026-03-01 09:46:24'),
	(3,'市内交通/打车',NULL,NULL,1,3,'2026-01-11 16:39:31','2026-01-11 16:39:31'),
	(4,'住宿费',NULL,NULL,1,4,'2026-01-11 16:39:31','2026-01-11 16:39:31'),
	(5,'餐饮费',NULL,NULL,1,5,'2026-01-11 16:39:31','2026-01-11 16:39:31'),
	(6,'通讯费',NULL,NULL,1,6,'2026-01-11 16:39:31','2026-01-11 16:39:31'),
	(7,'办公采购',NULL,NULL,1,7,'2026-01-11 16:39:31','2026-01-11 16:39:31'),
	(8,'快递物流',NULL,NULL,1,8,'2026-01-11 16:39:31','2026-01-11 16:39:31');

/*!40000 ALTER TABLE `expense_types` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 external_agents
# ------------------------------------------------------------

DROP TABLE IF EXISTS `external_agents`;

CREATE TABLE `external_agents` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '外部客服ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '客服姓名',
  `platform_id` int NOT NULL COMMENT '所属平台ID',
  `shop_id` int NOT NULL COMMENT '所属店铺ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_name_platform_shop` (`name`,`platform_id`,`shop_id`) USING BTREE,
  KEY `idx_platform_id` (`platform_id`) USING BTREE,
  KEY `idx_shop_id` (`shop_id`) USING BTREE,
  CONSTRAINT `fk_external_agents_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_external_agents_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='外部客服表-存储从Excel导入的客服信息';

LOCK TABLES `external_agents` WRITE;
/*!40000 ALTER TABLE `external_agents` DISABLE KEYS */;

INSERT INTO `external_agents` (`id`, `name`, `platform_id`, `shop_id`, `created_at`, `updated_at`)
VALUES
	(1,'张三',15,35,'2026-02-21 10:38:29','2026-02-21 10:38:29'),
	(2,'张三',13,30,'2026-02-21 10:50:36','2026-02-21 10:50:36');

/*!40000 ALTER TABLE `external_agents` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 group_members
# ------------------------------------------------------------

DROP TABLE IF EXISTS `group_members`;

CREATE TABLE `group_members` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('member','admin','owner') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'member',
  `nickname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_group_member` (`group_id`,`user_id`) USING BTREE,
  KEY `idx_group_member_group` (`group_id`) USING BTREE,
  KEY `idx_group_member_user` (`user_id`) USING BTREE,
  CONSTRAINT `fk_group_members_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_group_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;



# 转储表 groups
# ------------------------------------------------------------

DROP TABLE IF EXISTS `groups`;

CREATE TABLE `groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `announcement` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `owner_id` int NOT NULL,
  `max_members` int unsigned NOT NULL DEFAULT '200',
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `join_approval_required` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_group_owner` (`owner_id`) USING BTREE,
  CONSTRAINT `fk_groups_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;



# 转储表 holidays
# ------------------------------------------------------------

DROP TABLE IF EXISTS `holidays`;

CREATE TABLE `holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '假期名称',
  `days` int NOT NULL COMMENT '天数',
  `month` int NOT NULL COMMENT '所属月份',
  `year` int NOT NULL COMMENT '年份',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `vacation_type_id` int DEFAULT NULL COMMENT '关联的假期类型ID',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_year_month` (`year`,`month`) USING BTREE,
  KEY `idx_vacation_type` (`vacation_type_id`) USING BTREE,
  CONSTRAINT `holidays_chk_1` CHECK (((`days` >= 1) and (`days` <= 31))),
  CONSTRAINT `holidays_chk_2` CHECK (((`month` >= 1) and (`month` <= 12)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='节假日配置表';

LOCK TABLES `holidays` WRITE;
/*!40000 ALTER TABLE `holidays` DISABLE KEYS */;

INSERT INTO `holidays` (`id`, `name`, `days`, `month`, `year`, `created_at`, `updated_at`, `vacation_type_id`)
VALUES
	(18,'普通假期',4,12,2025,'2025-12-28 21:01:30','2025-12-28 21:01:30',50),
	(19,'元旦',1,1,2026,'2026-02-25 16:46:46','2026-02-25 16:46:46',68),
	(20,'春节',7,2,2026,'2026-02-25 16:46:47','2026-02-25 16:46:47',69),
	(21,'清明节',3,4,2026,'2026-02-25 16:46:48','2026-02-25 16:46:48',70),
	(22,'端午节',3,6,2026,'2026-02-25 16:46:51','2026-02-25 16:46:51',71),
	(23,'中秋节',3,9,2026,'2026-02-25 16:46:51','2026-02-25 16:46:51',72),
	(24,'国庆节',7,10,2026,'2026-02-25 16:46:52','2026-02-25 16:46:52',73);

/*!40000 ALTER TABLE `holidays` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 inventory_audits
# ------------------------------------------------------------

DROP TABLE IF EXISTS `inventory_audits`;

CREATE TABLE `inventory_audits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `expected_stock` int NOT NULL,
  `actual_stock` int NOT NULL,
  `discrepancy` int GENERATED ALWAYS AS ((`actual_stock` - `expected_stock`)) STORED,
  `result_status` enum('matched','missing','surplus') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'matched',
  `auditor_id` int DEFAULT NULL,
  `audit_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `item_id` (`item_id`) USING BTREE,
  KEY `auditor_id` (`auditor_id`) USING BTREE,
  CONSTRAINT `inventory_audits_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_audits_ibfk_2` FOREIGN KEY (`auditor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 inventory_items
# ------------------------------------------------------------

DROP TABLE IF EXISTS `inventory_items`;

CREATE TABLE `inventory_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '个',
  `current_stock` int DEFAULT '0',
  `min_stock_alert` int DEFAULT '10',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 inventory_usage
# ------------------------------------------------------------

DROP TABLE IF EXISTS `inventory_usage`;

CREATE TABLE `inventory_usage` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `quantity` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `usage_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `purpose` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `item_id` (`item_id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  CONSTRAINT `inventory_usage_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_usage_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 knowledge_article_daily_stats
# ------------------------------------------------------------

DROP TABLE IF EXISTS `knowledge_article_daily_stats`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uniq_article_date` (`article_id`,`stat_date`) USING BTREE,
  KEY `idx_article_id` (`article_id`) USING BTREE,
  CONSTRAINT `fk_daily_stats_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 knowledge_article_read_sessions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `knowledge_article_read_sessions`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uniq_session_id` (`session_id`) USING BTREE,
  KEY `idx_article_id` (`article_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_started_at` (`started_at`) USING BTREE,
  CONSTRAINT `fk_read_sessions_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_read_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 knowledge_articles
# ------------------------------------------------------------

DROP TABLE IF EXISTS `knowledge_articles`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_art_category` (`category_id`) USING BTREE,
  KEY `idx_art_owner` (`owner_id`) USING BTREE,
  KEY `idx_art_type` (`type`) USING BTREE,
  KEY `idx_art_public` (`is_public`) USING BTREE,
  KEY `idx_art_status` (`status`) USING BTREE,
  KEY `idx_art_deleted` (`is_deleted`) USING BTREE,
  KEY `idx_art_original` (`original_article_id`) USING BTREE,
  CONSTRAINT `fk_art_category` FOREIGN KEY (`category_id`) REFERENCES `knowledge_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `knowledge_articles` WRITE;
/*!40000 ALTER TABLE `knowledge_articles` DISABLE KEYS */;

INSERT INTO `knowledge_articles` (`id`, `title`, `summary`, `content`, `attachments`, `category_id`, `owner_id`, `original_article_id`, `type`, `is_public`, `status`, `is_deleted`, `view_count`, `like_count`, `notes`, `icon`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`)
VALUES
	(26,'123',NULL,'','[{\"name\":\"ScreenShot_2026-02-19_030746_951.png\",\"url\":\"/uploads/1771504607589-5xp1p7.png\",\"type\":\"image/png\",\"size\":1057}]',NULL,NULL,NULL,'common',1,'published',0,0,0,NULL,'📁',NULL,NULL,NULL,'2026-02-19 20:36:49','2026-02-23 09:48:11',NULL),
	(27,'文档',NULL,'','[{\"name\":\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.md\",\"url\":\"/uploads/1771633496709-oby3ubu.md\",\"type\":\"text/x-markdown\",\"size\":47493}]',NULL,NULL,NULL,'common',1,'published',0,0,0,NULL,'📁',NULL,NULL,NULL,'2026-02-21 08:25:01','2026-02-22 16:05:45',NULL),
	(28,'测试',NULL,'123','[{\"name\":\"ScreenShot_2026-02-19_221255_286.png\",\"url\":\"/uploads/1771750372046-du3et8.png\",\"type\":\"image/png\",\"size\":6495}]',NULL,NULL,NULL,'common',1,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-22 16:52:53','2026-02-23 10:00:07',NULL),
	(29,'测试',NULL,'pdf','\"[{\\\"name\\\":\\\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.md\\\",\\\"url\\\":\\\"/uploads/1771811311483-xinse.md\\\",\\\"type\\\":\\\"text/x-markdown\\\",\\\"size\\\":47493}]\"',NULL,NULL,NULL,'common',1,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 09:48:32','2026-02-23 09:48:32',NULL),
	(30,'测试1',NULL,'pdf','\"[{\\\"name\\\":\\\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.pdf\\\",\\\"url\\\":\\\"/uploads/1771812954756-uhgyxi.pdf\\\",\\\"type\\\":\\\"application/pdf\\\",\\\"size\\\":836165}]\"',NULL,NULL,NULL,'common',1,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 10:15:56','2026-02-23 10:15:56',NULL),
	(31,'测试 pdf',NULL,'123','\"[{\\\"name\\\":\\\"服务器.md\\\",\\\"url\\\":\\\"/uploads/1771813332778-e43gmg.md\\\",\\\"type\\\":\\\"text/x-markdown\\\",\\\"size\\\":5229}]\"',NULL,NULL,NULL,'common',1,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 10:22:13','2026-02-23 10:22:13',NULL),
	(32,'pdf',NULL,'内容','\"[{\\\"name\\\":\\\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.pdf\\\",\\\"url\\\":\\\"/uploads/1771813956698-j2g30p.pdf\\\",\\\"type\\\":\\\"application/pdf\\\",\\\"size\\\":836165}]\"',NULL,NULL,NULL,'common',1,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 10:32:38','2026-02-23 10:32:38',NULL),
	(33,'视频',NULL,'大方的','\"[{\\\"name\\\":\\\"4154b74ee29ea3e7083f3c82b486ff92.mp4\\\",\\\"url\\\":\\\"/uploads/1771813973032-1fdu0i.mp4\\\",\\\"type\\\":\\\"video/mp4\\\",\\\"size\\\":3073834}]\"',NULL,NULL,NULL,'common',1,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 10:32:53','2026-02-23 10:32:53',NULL),
	(34,'pdf',NULL,'pdf','\"[{\\\"name\\\":\\\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.pdf\\\",\\\"url\\\":\\\"/uploads/1771815744690-of8ref.pdf\\\",\\\"type\\\":\\\"application/pdf\\\",\\\"size\\\":836165}]\"',NULL,NULL,NULL,'common',1,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 11:02:26','2026-02-23 11:02:26',NULL),
	(35,'pdf',NULL,'','\"[{\\\"name\\\":\\\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.pdf\\\",\\\"url\\\":\\\"/uploads/1771821803353-z0gjwb.pdf\\\",\\\"type\\\":\\\"application/pdf\\\",\\\"size\\\":836165}]\"',1,37,NULL,'common',1,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 12:43:24','2026-02-23 13:01:56',NULL),
	(39,'pdf',NULL,'','\"\\\"[{\\\\\\\"name\\\\\\\":\\\\\\\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.pdf\\\\\\\",\\\\\\\"url\\\\\\\":\\\\\\\"/uploads/1771821803353-z0gjwb.pdf\\\\\\\",\\\\\\\"type\\\\\\\":\\\\\\\"application/pdf\\\\\\\",\\\\\\\"size\\\\\\\":836165}]\\\"\"',2,37,NULL,'personal',0,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 14:03:21','2026-02-23 14:03:21',NULL),
	(40,'pdf1',NULL,'','\"[{\\\"name\\\":\\\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.pdf\\\",\\\"url\\\":\\\"/uploads/1771833010617-e9569.pdf\\\",\\\"type\\\":\\\"application/pdf\\\",\\\"size\\\":836165}]\"',1,37,NULL,'common',1,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 15:50:11','2026-02-23 15:50:21',NULL),
	(41,'excel',NULL,'','\"[{\\\"name\\\":\\\"质检会话导入模板.xlsx\\\",\\\"url\\\":\\\"/uploads/1771833813624-h3w15k.xlsx\\\",\\\"type\\\":\\\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\\\",\\\"size\\\":7699}]\"',1,37,NULL,'common',0,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-02-23 16:03:34','2026-02-23 16:03:34',NULL),
	(42,'FSA',NULL,'','\"[{\\\"name\\\":\\\"26312000001045651861_冯宇乾（个人）.pdf\\\",\\\"url\\\":\\\"https://leixi-oss.oss-cn-beijing.aliyuncs.com/knowledge/20260302130232-khjz8wn4.pdf\\\",\\\"type\\\":\\\"application/pdf\\\",\\\"size\\\":57045}]\"',1,37,NULL,'common',0,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-03-02 13:02:33','2026-03-02 13:02:33',NULL),
	(43,'打撒分手的',NULL,'','\"[{\\\"name\\\":\\\"微信图片_20260225161540_28_265.png\\\",\\\"url\\\":\\\"https://leixi-oss.oss-cn-beijing.aliyuncs.com/knowledge/20260302131157-mwubljk2.png\\\",\\\"type\\\":\\\"image/png\\\",\\\"size\\\":59431}]\"',1,37,NULL,'common',0,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-03-02 13:11:59','2026-03-02 13:11:59',NULL),
	(44,'发顺丰',NULL,'','\"[{\\\"name\\\":\\\"4154b74ee29ea3e7083f3c82b486ff92.mp4\\\",\\\"url\\\":\\\"https://leixi-oss.oss-cn-beijing.aliyuncs.com/knowledge/20260302131214-6vy64cqd.mp4\\\",\\\"type\\\":\\\"video/mp4\\\",\\\"size\\\":3073834}]\"',1,37,NULL,'common',0,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-03-02 13:12:17','2026-03-02 13:12:17',NULL),
	(45,'发送 12344',NULL,'','\"[{\\\"name\\\":\\\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.pdf\\\",\\\"url\\\":\\\"https://leixi-oss.oss-cn-beijing.aliyuncs.com/knowledge/20260302131233-kje870sf.pdf\\\",\\\"type\\\":\\\"application/pdf\\\",\\\"size\\\":836165}]\"',1,37,NULL,'common',0,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-03-02 13:12:38','2026-03-02 13:12:38',NULL),
	(46,'pdf1',NULL,'','\"\\\"[{\\\\\\\"name\\\\\\\":\\\\\\\"Rust 每日学习计划（2026最新·零基础+桌面敏感词监测+页面爬虫版）.pdf\\\\\\\",\\\\\\\"url\\\\\\\":\\\\\\\"/uploads/1771833010617-e9569.pdf\\\\\\\",\\\\\\\"type\\\\\\\":\\\\\\\"application/pdf\\\\\\\",\\\\\\\"size\\\\\\\":836165}]\\\"\"',3,37,NULL,'personal',0,'published',0,0,0,NULL,'📄',NULL,NULL,NULL,'2026-03-02 13:18:13','2026-03-02 13:18:23',NULL);

/*!40000 ALTER TABLE `knowledge_articles` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 knowledge_attachments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `knowledge_attachments`;

CREATE TABLE `knowledge_attachments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `article_id` bigint unsigned NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_att_article` (`article_id`) USING BTREE,
  CONSTRAINT `fk_att_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 knowledge_categories
# ------------------------------------------------------------

DROP TABLE IF EXISTS `knowledge_categories`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_cat_owner` (`owner_id`) USING BTREE,
  KEY `idx_cat_type` (`type`) USING BTREE,
  KEY `idx_cat_public` (`is_public`) USING BTREE,
  KEY `idx_cat_status` (`status`) USING BTREE,
  KEY `idx_cat_deleted` (`is_deleted`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `knowledge_categories` WRITE;
/*!40000 ALTER TABLE `knowledge_categories` DISABLE KEYS */;

INSERT INTO `knowledge_categories` (`id`, `name`, `description`, `icon`, `owner_id`, `type`, `is_public`, `is_hidden`, `status`, `is_deleted`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`)
VALUES
	(1,'沟通技巧',NULL,'📁',37,'common',1,0,'published',0,'2026-02-23 12:43:03','2026-02-25 16:49:48',NULL,NULL),
	(2,'我的技能手册',NULL,'📁',37,'personal',0,0,'published',0,'2026-02-23 13:02:32','2026-02-25 16:50:26',NULL,NULL),
	(3,'我的学习手册',NULL,'📁',37,'personal',0,0,'published',0,'2026-02-23 14:03:31','2026-02-25 16:50:18',NULL,NULL);

/*!40000 ALTER TABLE `knowledge_categories` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 knowledge_learning_plan_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `knowledge_learning_plan_records`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_plan` (`user_id`,`plan_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_plan_id` (`plan_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  CONSTRAINT `knowledge_learning_plan_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `knowledge_learning_plan_records_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `learning_plans` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 knowledge_learning_plans
# ------------------------------------------------------------

DROP TABLE IF EXISTS `knowledge_learning_plans`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_start_date` (`start_date`) USING BTREE,
  KEY `idx_end_date` (`end_date`) USING BTREE,
  CONSTRAINT `fk_knowledge_learning_plans_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='学习计划表-用户的知识学习计划';



# 转储表 knowledge_learning_statistics
# ------------------------------------------------------------

DROP TABLE IF EXISTS `knowledge_learning_statistics`;

CREATE TABLE `knowledge_learning_statistics` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '统计记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '用户ID，关联users表',
  `stat_date` date NOT NULL COMMENT '统计日期',
  `articles_read` int NOT NULL DEFAULT '0' COMMENT '阅读文章数',
  `articles_completed` int NOT NULL DEFAULT '0' COMMENT '完成文章数',
  `total_duration` int NOT NULL DEFAULT '0' COMMENT '总学习时长，单位秒',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_date` (`user_id`,`stat_date`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_stat_date` (`stat_date`) USING BTREE,
  CONSTRAINT `fk_knowledge_learning_statistics_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='学习统计表-按天统计用户学习数据';



# 转储表 learning_plans
# ------------------------------------------------------------

DROP TABLE IF EXISTS `learning_plans`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE,
  KEY `idx_assigned_to` (`assigned_to`) USING BTREE,
  KEY `idx_department_id` (`department_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  CONSTRAINT `learning_plans_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `learning_plans_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `learning_plans_ibfk_3` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='学习计划表';



# 转储表 learning_statistics
# ------------------------------------------------------------

DROP TABLE IF EXISTS `learning_statistics`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_date` (`user_id`,`date`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_date` (`date`) USING BTREE,
  CONSTRAINT `learning_statistics_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='学习统计表';



# 转储表 learning_tasks
# ------------------------------------------------------------

DROP TABLE IF EXISTS `learning_tasks`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `assigned_by` (`assigned_by`) USING BTREE,
  KEY `idx_assigned_to` (`assigned_to`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_due_date` (`due_date`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  CONSTRAINT `learning_tasks_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `learning_tasks_ibfk_2` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='学习任务表';



# 转储表 leave_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `leave_records`;

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
  `attachments` text COLLATE utf8mb4_unicode_ci,
  `use_converted_leave` tinyint(1) DEFAULT '0' COMMENT '是否优先使用转换假期',
  `used_conversion_days` decimal(10,2) DEFAULT '0.00' COMMENT '使用的转换假期天数',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_leave_type` (`leave_type`) USING BTREE,
  KEY `idx_start_date` (`start_date`) USING BTREE,
  KEY `idx_end_date` (`end_date`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_approved_by` (`approver_id`) USING BTREE,
  KEY `idx_date_range` (`start_date`,`end_date`) USING BTREE,
  KEY `idx_employee` (`employee_id`) USING BTREE,
  CONSTRAINT `fk_leave_records_approved_by` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_leave_records_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='请假记录表-员工请假申请和审批记录表';

LOCK TABLES `leave_records` WRITE;
/*!40000 ALTER TABLE `leave_records` DISABLE KEYS */;

INSERT INTO `leave_records` (`id`, `user_id`, `leave_type`, `start_date`, `end_date`, `days`, `reason`, `status`, `approver_id`, `approved_at`, `approval_note`, `created_at`, `updated_at`, `employee_id`, `attachments`, `use_converted_leave`, `used_conversion_days`)
VALUES
	(15,37,'annual','2026-02-25','2026-02-25',1.00,'123','pending',NULL,NULL,NULL,'2026-02-25 15:08:24','2026-02-25 15:08:24',21,NULL,0,0.00);

/*!40000 ALTER TABLE `leave_records` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 makeup_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `makeup_records`;

CREATE TABLE `makeup_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `record_date` date NOT NULL COMMENT '补卡日期',
  `clock_type` enum('in','out') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '打卡类型',
  `clock_time` datetime NOT NULL COMMENT '打卡时间',
  `reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '补卡原因',
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'pending' COMMENT '状态',
  `approver_id` int DEFAULT NULL COMMENT '审批人ID',
  `approved_at` datetime DEFAULT NULL COMMENT '审批时间',
  `approval_note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '审批备注',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `attachments` text,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_employee` (`employee_id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_record_date` (`record_date`) USING BTREE,
  KEY `idx_approver` (`approver_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='补卡申请表';



# 转储表 meal_order_items
# ------------------------------------------------------------

DROP TABLE IF EXISTS `meal_order_items`;

CREATE TABLE `meal_order_items` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '订餐明细唯一标识ID',
  `order_id` int NOT NULL COMMENT '订单ID，关联meal_orders表，级联删除',
  `menu_item_id` int NOT NULL COMMENT '菜品ID，关联menu_items表，级联删除',
  `quantity` int NOT NULL COMMENT '订购数量',
  `unit_price` decimal(8,2) NOT NULL COMMENT '单价，记录下单时的价格',
  `subtotal` decimal(8,2) NOT NULL COMMENT '小计金额，quantity * unit_price',
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '单项备注，如"少盐"、"不要辣"',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_order_id` (`order_id`) USING BTREE,
  KEY `idx_menu_item_id` (`menu_item_id`) USING BTREE,
  KEY `idx_quantity` (`quantity`) USING BTREE,
  KEY `idx_subtotal` (`subtotal`) USING BTREE,
  CONSTRAINT `fk_meal_order_items_menu_item_id` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_meal_order_items_order_id` FOREIGN KEY (`order_id`) REFERENCES `meal_orders` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='订餐明细表-订餐记录的详细项目表';



# 转储表 meal_orders
# ------------------------------------------------------------

DROP TABLE IF EXISTS `meal_orders`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_order_no` (`order_no`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_order_date` (`order_date`) USING BTREE,
  KEY `idx_meal_type` (`meal_type`) USING BTREE,
  KEY `idx_total_amount` (`total_amount`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  CONSTRAINT `fk_meal_orders_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='订餐记录表-员工订餐记录主表';



# 转储表 memo_recipients
# ------------------------------------------------------------

DROP TABLE IF EXISTS `memo_recipients`;

CREATE TABLE `memo_recipients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `memo_id` int NOT NULL COMMENT '备忘录ID',
  `user_id` int NOT NULL COMMENT '接收者用户ID',
  `is_read` tinyint(1) DEFAULT '0' COMMENT '是否已读',
  `read_at` datetime DEFAULT NULL COMMENT '阅读时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_memo_user` (`memo_id`,`user_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_is_read` (`is_read`) USING BTREE,
  CONSTRAINT `fk_memo_recipients_memo` FOREIGN KEY (`memo_id`) REFERENCES `memos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='备忘录接收记录表';

LOCK TABLES `memo_recipients` WRITE;
/*!40000 ALTER TABLE `memo_recipients` DISABLE KEYS */;

INSERT INTO `memo_recipients` (`id`, `memo_id`, `user_id`, `is_read`, `read_at`, `created_at`)
VALUES
	(15,22,37,1,'2026-02-24 09:28:15','2026-02-24 09:27:53'),
	(16,23,37,1,'2026-02-24 16:49:46','2026-02-24 16:49:30');

/*!40000 ALTER TABLE `memo_recipients` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 memos
# ------------------------------------------------------------

DROP TABLE IF EXISTS `memos`;

CREATE TABLE `memos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '创建者用户ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '备忘录标题',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '备忘录内容（Markdown格式）',
  `type` enum('personal','department') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'personal' COMMENT '类型：personal=个人备忘录, department=部门备忘录',
  `priority` enum('low','normal','high','urgent') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'normal' COMMENT '优先级',
  `is_read` tinyint(1) DEFAULT '0' COMMENT '是否已读（仅个人备忘录使用）',
  `target_department_id` int DEFAULT NULL COMMENT '目标部门ID（部门备忘录使用）',
  `target_user_id` int DEFAULT NULL COMMENT '目标用户ID（部门备忘录指定用户时使用）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_type` (`type`) USING BTREE,
  KEY `idx_is_read` (`is_read`) USING BTREE,
  KEY `idx_target_department` (`target_department_id`) USING BTREE,
  KEY `idx_target_user` (`target_user_id`) USING BTREE,
  KEY `idx_deleted_at` (`deleted_at`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='备忘录表';

LOCK TABLES `memos` WRITE;
/*!40000 ALTER TABLE `memos` DISABLE KEYS */;

INSERT INTO `memos` (`id`, `user_id`, `title`, `content`, `type`, `priority`, `is_read`, `target_department_id`, `target_user_id`, `created_at`, `updated_at`, `deleted_at`)
VALUES
	(22,37,'防守打法','多少啊','department','normal',0,24,NULL,'2026-02-24 09:27:53','2026-02-24 09:27:53',NULL),
	(23,37,'1233','123','department','normal',0,24,NULL,'2026-02-24 16:49:30','2026-02-24 16:49:30',NULL);

/*!40000 ALTER TABLE `memos` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 menu_categories
# ------------------------------------------------------------

DROP TABLE IF EXISTS `menu_categories`;

CREATE TABLE `menu_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '菜单分类唯一标识ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称，如"主食"、"荤菜"、"素菜"',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '分类详细描述，说明该分类的特点',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号，用于菜单分类显示顺序',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_sort_order` (`sort_order`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='菜单分类表-订餐系统的菜品分类管理表';



# 转储表 menu_items
# ------------------------------------------------------------

DROP TABLE IF EXISTS `menu_items`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_category_id` (`category_id`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_price` (`price`) USING BTREE,
  KEY `idx_is_available` (`is_available`) USING BTREE,
  KEY `idx_is_recommended` (`is_recommended`) USING BTREE,
  KEY `idx_sort_order` (`sort_order`) USING BTREE,
  CONSTRAINT `fk_menu_items_category_id` FOREIGN KEY (`category_id`) REFERENCES `menu_categories` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='菜品表-订餐系统的菜品信息表';



# 转储表 message_status
# ------------------------------------------------------------

DROP TABLE IF EXISTS `message_status`;

CREATE TABLE `message_status` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `message_id` bigint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `status` enum('sent','delivered','read') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'sent',
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_msg_user` (`message_id`,`user_id`) USING BTREE,
  KEY `idx_msg_status_msg` (`message_id`) USING BTREE,
  KEY `idx_msg_status_user` (`user_id`) USING BTREE,
  KEY `idx_user_status` (`user_id`,`status`) USING BTREE,
  KEY `idx_message_id` (`message_id`) USING BTREE,
  CONSTRAINT `fk_msg_status_msg` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_msg_status_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;



# 转储表 messages
# ------------------------------------------------------------

DROP TABLE IF EXISTS `messages`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_conversation_id` (`conversation_id`) USING BTREE,
  KEY `idx_sender_id` (`sender_id`) USING BTREE,
  KEY `idx_recipient_id` (`recipient_id`) USING BTREE,
  KEY `idx_reply_to_message_id` (`reply_to_message_id`) USING BTREE,
  CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_messages_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_messages_reply_to` FOREIGN KEY (`reply_to_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 migrations_history
# ------------------------------------------------------------

DROP TABLE IF EXISTS `migrations_history`;

CREATE TABLE `migrations_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `migration_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `migration_name` (`migration_name`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 my_knowledge_articles
# ------------------------------------------------------------

DROP TABLE IF EXISTS `my_knowledge_articles`;

CREATE TABLE `my_knowledge_articles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `category_id` int DEFAULT NULL COMMENT '分类ID',
  `source_article_id` int DEFAULT NULL COMMENT '来源文章ID（如果是从公共知识库收藏的）',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '文档标题',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '文档内容',
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '文档摘要',
  `attachments` json DEFAULT NULL COMMENT '附件列表',
  `tags` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '标签',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '个人笔记',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_category_id` (`category_id`) USING BTREE,
  KEY `idx_source_article_id` (`source_article_id`) USING BTREE,
  KEY `idx_title` (`title`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='我的知识库文档表';



# 转储表 my_knowledge_categories
# ------------------------------------------------------------

DROP TABLE IF EXISTS `my_knowledge_categories`;

CREATE TABLE `my_knowledge_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分类名称',
  `icon` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '?' COMMENT '分类图标',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '分类描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='我的知识库分类表';



# 转储表 my_knowledge_saved_articles
# ------------------------------------------------------------

DROP TABLE IF EXISTS `my_knowledge_saved_articles`;

CREATE TABLE `my_knowledge_saved_articles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `article_id` bigint unsigned NOT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_article` (`user_id`,`article_id`) USING BTREE,
  KEY `idx_mk_user` (`user_id`) USING BTREE,
  KEY `idx_mk_article` (`article_id`) USING BTREE,
  CONSTRAINT `fk_mk_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 notification_recipients
# ------------------------------------------------------------

DROP TABLE IF EXISTS `notification_recipients`;

CREATE TABLE `notification_recipients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `notification_id` int NOT NULL,
  `user_id` int NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `notification_id` (`notification_id`,`user_id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  CONSTRAINT `notification_recipients_ibfk_1` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `notification_recipients_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 notification_settings
# ------------------------------------------------------------

DROP TABLE IF EXISTS `notification_settings`;

CREATE TABLE `notification_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '事件类型',
  `target_roles` json DEFAULT NULL COMMENT '接收通知的角色列表',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_event_type` (`event_type`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='通知设置表';

LOCK TABLES `notification_settings` WRITE;
/*!40000 ALTER TABLE `notification_settings` DISABLE KEYS */;

INSERT INTO `notification_settings` (`id`, `event_type`, `target_roles`, `created_at`, `updated_at`)
VALUES
	(13,'leave_apply','[\"员工本人\"]','2026-02-25 13:09:41','2026-02-25 13:09:41'),
	(14,'leave_approval','[]','2026-02-25 13:09:41','2026-02-25 13:09:41'),
	(15,'leave_rejection','[\"申请人\"]','2026-02-25 13:09:41','2026-03-03 09:02:10'),
	(16,'overtime_apply','[]','2026-02-25 13:09:41','2026-02-25 13:09:41'),
	(17,'overtime_approval','[]','2026-02-25 13:09:41','2026-02-25 13:09:41'),
	(18,'makeup_approval','[]','2026-02-25 13:09:41','2026-02-25 13:09:41'),
	(19,'makeup_apply','[]','2026-02-25 13:09:41','2026-02-25 13:09:41'),
	(20,'compensatory_leave_apply','[]','2026-02-25 13:09:41','2026-02-25 13:09:41'),
	(21,'makeup_rejection','[\"申请人\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(22,'overtime_rejection','[\"申请人\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(23,'reimbursement_pass','[\"申请人\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(24,'reimbursement_reject','[\"申请人\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(25,'reimbursement_return','[\"申请人\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(26,'reimbursement_progress','[\"申请人\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(27,'asset_apply','[\"部门主管\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(28,'asset_return','[\"部门主管\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(29,'exam_publish','[\"全体员工\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(30,'exam_result','[\"考生\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(31,'late_notify','[\"申请人\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(32,'early_leave_notify','[\"申请人\"]','2026-02-25 13:38:24','2026-02-25 13:38:24'),
	(33,'absent_notify','[\"申请人\"]','2026-02-25 13:38:24','2026-02-25 13:38:24');

/*!40000 ALTER TABLE `notification_settings` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 notifications
# ------------------------------------------------------------

DROP TABLE IF EXISTS `notifications`;

CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知类型',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知标题',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '通知内容',
  `related_id` int DEFAULT NULL COMMENT '关联记录ID',
  `is_read` tinyint(1) DEFAULT '0' COMMENT '是否已读',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `related_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '关联对象类型',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_type` (`type`) USING BTREE,
  KEY `idx_is_read` (`is_read`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  KEY `idx_related` (`related_type`,`related_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='消息通知表';

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `content`, `related_id`, `is_read`, `created_at`, `related_type`)
VALUES
	(34,37,'leave_apply','新请假申请','系统管理员 申请请假 1 天 (2026-02-25 至 2026-02-25)',15,1,'2026-02-25 15:08:24','leave'),
	(35,37,'exam_notification','新考试通知','考试《沟通技巧》已发布，考试时间：2026-02-25 17:00:00 至 2026-02-26 17:00:00',13,1,'2026-02-25 16:52:49','assessment_plan'),
	(36,37,'reimbursement_progress','新报销待处理','您有一个来自 河北雷犀 的报销申请待处理: 2026年02月报销申请',10,1,'2026-02-28 16:20:54','reimbursement'),
	(37,37,'reimbursement_progress','报销环节更新','您的报销申请 \"2026年02月报销申请\" 已通过当前审批',10,1,'2026-02-28 16:50:56','reimbursement'),
	(38,37,'reimbursement_progress','报销环节更新','您的报销申请 \"2026年02月报销申请\" 已通过当前审批',10,1,'2026-02-28 16:52:21','reimbursement'),
	(39,37,'reimbursement_pass','报销终审通过','您的报销申请 \"2026年02月报销申请\" 已通过最终审批',10,1,'2026-02-28 16:52:29','reimbursement'),
	(40,37,'payslip','工资条已发放','您的2026年2月工资条已发放，实发工资¥0.00',123,1,'2026-03-01 10:06:56','payslip'),
	(41,37,'reimbursement_progress','新报销待处理','您有一个来自 河北雷犀 的报销申请待处理: 2026年03月报销申请',12,1,'2026-03-02 08:14:39','reimbursement'),
	(42,37,'reimbursement_progress','新报销待处理','您有一个来自 河北雷犀 的报销申请待处理: 2026年03月报销申请',13,1,'2026-03-02 12:31:53','reimbursement'),
	(43,37,'reimbursement_progress','新报销待处理','您有一个来自 河北雷犀  的报销申请待处理: 2026年03月报销申请',14,0,'2026-03-03 14:17:47','reimbursement');

/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 operation_logs
# ------------------------------------------------------------

DROP TABLE IF EXISTS `operation_logs`;

CREATE TABLE `operation_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL COMMENT '执行用户ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '执行用户名',
  `real_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '执行用户真实姓名',
  `module` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '所属模块',
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '动作/描述',
  `method` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '请求方法(GET/POST等)',
  `url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '请求路径',
  `params` json DEFAULT NULL COMMENT '请求参数',
  `ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '操作IP地址',
  `user_agent` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '浏览器标识',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态(1:成功, 0:失败)',
  `error_msg` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_module` (`module`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='系统操作日志表';

LOCK TABLES `operation_logs` WRITE;
/*!40000 ALTER TABLE `operation_logs` DISABLE KEYS */;

INSERT INTO `operation_logs` (`id`, `user_id`, `username`, `real_name`, `module`, `action`, `method`, `url`, `params`, `ip`, `user_agent`, `status`, `error_msg`, `created_at`)
VALUES
	(55,NULL,'system','系统自动','organization','软删除部门 [测试部门12] 及其关联员工','DELETE','/api/departments/delete/30',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-19 16:30:35'),
	(56,NULL,'system','系统自动','organization','软删除部门 [部门2] 及其关联员工','DELETE','/api/departments/delete/18',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-19 16:30:50'),
	(57,NULL,'system','系统自动','messaging','执行一键同步部门群组：新建群组 6 个，同步成员 1 人次','POST','/api/departments/sync-all-groups',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-19 16:38:32'),
	(58,37,'admin','系统管理员','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-19 20:09:59'),
	(59,37,'admin','系统管理员','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-19 22:13:09'),
	(60,37,'admin','系统管理员','user','取消部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-23 17:16:48'),
	(61,37,'admin','系统管理员','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-23 17:16:49'),
	(62,NULL,'system','系统自动','messaging','执行一键同步部门群组：新建群组 0 个，同步成员 1 人次','POST','/api/departments/sync-all-groups',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-24 08:16:39'),
	(63,37,'admin','系统管理员','user','取消部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-24 08:19:23'),
	(64,37,'admin','系统管理员','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-24 08:19:24'),
	(65,NULL,'system','系统自动','organization','软删除部门 [测试部门 001] 及其关联员工','DELETE','/api/departments/delete/31',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-24 09:07:06'),
	(66,NULL,'system','系统自动','messaging','执行一键同步部门群组：新建群组 0 个，同步成员 1 人次','POST','/api/departments/sync-all-groups',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-24 09:07:08'),
	(67,NULL,'system','系统自动','organization','软删除部门 [发生的范德萨发多少] 及其关联员工','DELETE','/api/departments/delete/29',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-24 09:38:43'),
	(68,NULL,'system','系统自动','messaging','执行一键同步部门群组：新建群组 0 个，同步成员 1 人次','POST','/api/departments/sync-all-groups',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-24 09:38:46'),
	(69,37,'admin','河北雷犀','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-25 16:26:45'),
	(70,37,'admin','河北雷犀','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-02-25 16:27:03'),
	(71,37,'admin',NULL,'logistics','删除配件大类: 处理器 (CPU)','DELETE','/api/assets/component-types/1',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-01 11:55:02'),
	(72,37,'admin',NULL,'logistics','删除配件大类: 显卡 (GPU)','DELETE','/api/assets/component-types/12',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-01 11:55:07'),
	(73,37,'admin',NULL,'logistics','删除配件大类: 显示器 (Monitor)','DELETE','/api/assets/component-types/6',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-01 11:55:09'),
	(74,37,'admin',NULL,'logistics','删除配件大类: 外设 (Peripherals)','DELETE','/api/assets/component-types/7',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-01 11:55:12'),
	(75,37,'admin',NULL,'logistics','删除配件大类: 主板 (Mainboard)','DELETE','/api/assets/component-types/2',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-01 11:55:14'),
	(76,37,'admin',NULL,'logistics','删除配件大类: 内存 (RAM)','DELETE','/api/assets/component-types/3',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-01 11:55:16'),
	(77,37,'admin',NULL,'logistics','删除设备形态: 办公外设','DELETE','/api/assets/forms/5',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-01 11:58:28'),
	(78,37,'admin',NULL,'logistics','定义新规格: i5 (i5-10000)','POST','/api/assets/components',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-01 12:07:25'),
	(79,37,'admin','河北雷犀','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-02 10:04:22'),
	(80,37,'admin','河北雷犀 2','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-02 12:56:24'),
	(81,37,'admin','河北雷犀 ','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-02 12:56:30'),
	(82,37,'admin','河北雷犀 ','user','取消部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-03 08:29:00'),
	(83,37,'admin','河北雷犀 ','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-03 08:29:07'),
	(84,37,'admin','河北雷犀 ','permission','设置用户部门权限: 用户ID 37','PUT','/api/users/37/departments','{\"department_ids\": [18, 29, 24, 25, 26, 27]}','127.0.0.1',NULL,1,NULL,'2026-03-03 08:29:15'),
	(85,37,'admin','河北雷犀 ','permission','设置用户部门权限: 用户ID 37','PUT','/api/users/37/departments','{\"department_ids\": [18, 29, 24, 25, 26, 27, 28]}','127.0.0.1',NULL,1,NULL,'2026-03-03 08:29:19'),
	(86,37,'admin','河北雷犀 ','user','取消部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-03 08:33:12'),
	(87,37,'admin','河北雷犀 ','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-03 08:40:34'),
	(88,37,'admin','河北雷犀 ','user','取消部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-03 08:40:35'),
	(89,37,'admin','河北雷犀 ','user','取消部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-03 08:40:45'),
	(90,37,'admin','河北雷犀 ','user','取消部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-03 08:40:53'),
	(91,37,'admin','河北雷犀 ','user','设为部门主管 (目标ID: 37)','PUT','/api/users/37/department-manager',NULL,'127.0.0.1',NULL,1,NULL,'2026-03-03 08:40:56');

/*!40000 ALTER TABLE `operation_logs` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 overtime_conversions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `overtime_conversions`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `target_vacation_type_id` (`target_vacation_type_id`) USING BTREE,
  KEY `conversion_rule_id` (`conversion_rule_id`) USING BTREE,
  KEY `idx_employee` (`employee_id`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  CONSTRAINT `overtime_conversions_ibfk_1` FOREIGN KEY (`target_vacation_type_id`) REFERENCES `vacation_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `overtime_conversions_ibfk_2` FOREIGN KEY (`conversion_rule_id`) REFERENCES `conversion_rules` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 overtime_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `overtime_records`;

CREATE TABLE `overtime_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `overtime_date` date NOT NULL COMMENT '加班日期',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `hours` decimal(4,2) NOT NULL COMMENT '加班时长（小时）',
  `reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '加班原因',
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'pending' COMMENT '状态',
  `approver_id` int DEFAULT NULL COMMENT '审批人ID',
  `approved_at` datetime DEFAULT NULL COMMENT '审批时间',
  `approval_note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '审批备注',
  `is_compensated` tinyint(1) DEFAULT '0' COMMENT '是否已调休',
  `compensated_at` datetime DEFAULT NULL COMMENT '调休时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `attachments` text,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_employee` (`employee_id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_overtime_date` (`overtime_date`) USING BTREE,
  KEY `idx_approver` (`approver_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='加班记录表';



# 转储表 payslip_distribution_settings
# ------------------------------------------------------------

DROP TABLE IF EXISTS `payslip_distribution_settings`;

CREATE TABLE `payslip_distribution_settings` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `setting_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '配置名称',
  `frequency` enum('monthly','weekly','daily') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly' COMMENT '发放频率',
  `distribution_day` int DEFAULT NULL COMMENT '发放日（月中的第几天，1-31）',
  `distribution_weekday` int DEFAULT NULL COMMENT '发放周几（1-7，周一到周日）',
  `distribution_time` time DEFAULT NULL COMMENT '发放时间',
  `auto_send` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否自动发放',
  `target_departments` json DEFAULT NULL COMMENT '目标部门ID列表',
  `target_positions` json DEFAULT NULL COMMENT '目标职位列表',
  `target_employees` json DEFAULT NULL COMMENT '目标员工ID列表',
  `notify_internal` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否发送站内信',
  `notify_sms` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否发送短信',
  `notify_email` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否发送邮件',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE,
  KEY `fk_distribution_settings_created_by` (`created_by`) USING BTREE,
  CONSTRAINT `fk_distribution_settings_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='工资条发放配置表';



# 转储表 payslip_import_history
# ------------------------------------------------------------

DROP TABLE IF EXISTS `payslip_import_history`;

CREATE TABLE `payslip_import_history` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '导入记录ID',
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '导入文件名',
  `salary_month` date NOT NULL COMMENT '工资所属月份',
  `total_count` int NOT NULL DEFAULT '0' COMMENT '总记录数',
  `success_count` int NOT NULL DEFAULT '0' COMMENT '成功导入数',
  `failed_count` int NOT NULL DEFAULT '0' COMMENT '失败数',
  `error_details` json DEFAULT NULL COMMENT '错误详情',
  `import_data` json DEFAULT NULL COMMENT '导入的原始数据',
  `status` enum('processing','completed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'processing' COMMENT '导入状态',
  `imported_by` int NOT NULL COMMENT '导入人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '导入时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_salary_month` (`salary_month`) USING BTREE,
  KEY `idx_imported_by` (`imported_by`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  CONSTRAINT `fk_import_history_imported_by` FOREIGN KEY (`imported_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='工资导入历史表';



# 转储表 payslip_passwords
# ------------------------------------------------------------

DROP TABLE IF EXISTS `payslip_passwords`;

CREATE TABLE `payslip_passwords` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '二级密码哈希值',
  `is_default` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否为默认密码（首次需修改）',
  `last_changed_at` datetime DEFAULT NULL COMMENT '最后修改时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_id` (`user_id`) USING BTREE,
  CONSTRAINT `fk_payslip_passwords_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='工资条二级密码表';

LOCK TABLES `payslip_passwords` WRITE;
/*!40000 ALTER TABLE `payslip_passwords` DISABLE KEYS */;

INSERT INTO `payslip_passwords` (`id`, `user_id`, `password_hash`, `is_default`, `last_changed_at`, `created_at`, `updated_at`)
VALUES
	(2,37,'$2b$10$1EW.G5plSOp4CHOR5FwT5OPX1f7cJhTwIfsLbNJpH59F2cCVaDgNG',1,'2026-02-26 14:11:59','2026-02-26 14:11:59','2026-02-26 14:11:59');

/*!40000 ALTER TABLE `payslip_passwords` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 payslip_templates
# ------------------------------------------------------------

DROP TABLE IF EXISTS `payslip_templates`;

CREATE TABLE `payslip_templates` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '模板ID',
  `template_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模板名称',
  `template_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模板代码，唯一标识',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否默认模板',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `field_config` json NOT NULL COMMENT '字段配置，包含字段名、显示名、是否显示、排序等',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '模板描述',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_template_code` (`template_code`) USING BTREE,
  KEY `idx_is_default` (`is_default`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE,
  KEY `fk_payslip_templates_created_by` (`created_by`) USING BTREE,
  CONSTRAINT `fk_payslip_templates_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='工资条模板配置表';



# 转储表 payslips
# ------------------------------------------------------------

DROP TABLE IF EXISTS `payslips`;

CREATE TABLE `payslips` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '工资条唯一标识ID',
  `payslip_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '工资条编号，格式：PS-YYYYMM-序号',
  `employee_id` int NOT NULL COMMENT '员工ID，关联employees表',
  `user_id` int NOT NULL COMMENT '用户ID，关联users表',
  `salary_month` date NOT NULL COMMENT '工资所属月份，格式：YYYY-MM-01',
  `payment_date` date DEFAULT NULL COMMENT '发放日期',
  `attendance_days` decimal(5,2) DEFAULT '0.00' COMMENT '出勤天数',
  `late_count` int DEFAULT '0' COMMENT '迟到次数',
  `early_leave_count` int DEFAULT '0' COMMENT '早退次数',
  `leave_days` decimal(5,2) DEFAULT '0.00' COMMENT '请假天数',
  `overtime_hours` decimal(6,2) DEFAULT '0.00' COMMENT '加班时长（小时）',
  `absent_days` decimal(5,2) DEFAULT '0.00' COMMENT '缺勤天数',
  `basic_salary` decimal(10,2) DEFAULT '0.00' COMMENT '基本工资',
  `position_salary` decimal(10,2) DEFAULT '0.00' COMMENT '岗位工资',
  `performance_bonus` decimal(10,2) DEFAULT '0.00' COMMENT '绩效奖金',
  `overtime_pay` decimal(10,2) DEFAULT '0.00' COMMENT '加班费',
  `allowances` decimal(10,2) DEFAULT '0.00' COMMENT '各类补贴',
  `deductions` decimal(10,2) DEFAULT '0.00' COMMENT '各类扣款',
  `social_security` decimal(10,2) DEFAULT '0.00' COMMENT '社保扣款',
  `housing_fund` decimal(10,2) DEFAULT '0.00' COMMENT '公积金扣款',
  `tax` decimal(10,2) DEFAULT '0.00' COMMENT '个人所得税',
  `other_deductions` decimal(10,2) DEFAULT '0.00' COMMENT '其他扣款',
  `net_salary` decimal(10,2) NOT NULL COMMENT '实发工资（自动计算）',
  `status` enum('draft','sent','viewed','confirmed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '状态：草稿、已发放、已查看、已确认',
  `remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '备注信息',
  `custom_fields` json DEFAULT NULL COMMENT '自定义字段数据，存储额外的工资项目',
  `issued_by` int DEFAULT NULL COMMENT '发放人ID',
  `issued_at` datetime DEFAULT NULL COMMENT '发放时间',
  `viewed_at` datetime DEFAULT NULL COMMENT '首次查看时间',
  `confirmed_at` datetime DEFAULT NULL COMMENT '确认时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_payslip_no` (`payslip_no`) USING BTREE,
  UNIQUE KEY `uk_employee_month` (`employee_id`,`salary_month`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_salary_month` (`salary_month`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_issued_by` (`issued_by`) USING BTREE,
  KEY `idx_issued_at` (`issued_at`) USING BTREE,
  CONSTRAINT `fk_payslips_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_payslips_issued_by` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_payslips_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='工资条表-存储员工工资条信息';

LOCK TABLES `payslips` WRITE;
/*!40000 ALTER TABLE `payslips` DISABLE KEYS */;

INSERT INTO `payslips` (`id`, `payslip_no`, `employee_id`, `user_id`, `salary_month`, `payment_date`, `attendance_days`, `late_count`, `early_leave_count`, `leave_days`, `overtime_hours`, `absent_days`, `basic_salary`, `position_salary`, `performance_bonus`, `overtime_pay`, `allowances`, `deductions`, `social_security`, `housing_fund`, `tax`, `other_deductions`, `net_salary`, `status`, `remark`, `custom_fields`, `issued_by`, `issued_at`, `viewed_at`, `confirmed_at`, `created_at`, `updated_at`)
VALUES
	(123,'PS-202602-0001',21,37,'2026-02-01','2026-03-02',0.00,0,0,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,'sent',NULL,NULL,37,'2026-03-01 10:06:56',NULL,NULL,'2026-03-01 10:06:35','2026-03-01 10:06:56');

/*!40000 ALTER TABLE `payslips` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 permission_templates
# ------------------------------------------------------------

DROP TABLE IF EXISTS `permission_templates`;

CREATE TABLE `permission_templates` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '权限模板唯一标识ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模板名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '模板描述',
  `permission_ids` json DEFAULT NULL COMMENT '权限ID列表，JSON格式存储',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_name` (`name`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='权限模板表-用于存储权限组合模板';

LOCK TABLES `permission_templates` WRITE;
/*!40000 ALTER TABLE `permission_templates` DISABLE KEYS */;

INSERT INTO `permission_templates` (`id`, `name`, `description`, `permission_ids`, `created_at`, `updated_at`)
VALUES
	(14,'员工基础权限','仅包含个人业务操作：打卡、申请、聊天、阅读知识库及个人记录。','[42, 44, 22, 40, 17, 11, 12, 33]','2026-02-24 16:56:14','2026-02-24 16:56:14'),
	(15,'部门主管权限','管理赋能：拥有本部门员工名册管理、考勤/报销审核及排班权限。','[42, 44, 25, 22, 26, 40, 17, 11, 12, 35, 33]','2026-02-24 16:56:14','2026-02-24 16:56:14');

/*!40000 ALTER TABLE `permission_templates` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 permissions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `permissions`;

CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '权限唯一标识ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '权限名称',
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '权限代码',
  `resource` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '资源名称',
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '权限描述',
  `module` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '所属模块',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_code` (`code`) USING BTREE,
  KEY `idx_resource` (`resource`) USING BTREE,
  KEY `idx_action` (`action`) USING BTREE,
  KEY `idx_module` (`module`) USING BTREE,
  KEY `idx_resource_action` (`resource`,`action`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='权限表-定义系统权限';

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;

INSERT INTO `permissions` (`id`, `name`, `code`, `resource`, `action`, `description`, `module`, `created_at`, `updated_at`)
VALUES
	(1,'查看控制面板','system:dashboard:view','dashboard','view','查看系统首页工作台及统计数据','system','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(2,'查看企业看板','system:dashboard:admin','dashboard','admin','查看管理员专属的企业全局数据看板','system','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(3,'查看角色','system:role:view','role','view','查看角色列表','system','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(4,'管理角色','system:role:manage','role','manage','新增、编辑、删除角色及配置权限','system','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(5,'查看日志','system:log:view','log','view','查看系统操作日志','system','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(6,'流程设置','system:workflow:manage','workflow','manage','配置资产、报销、请假等业务的审批流程','system','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(7,'查看员工','user:employee:view','employee','view','查看员工列表及详情','user','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(8,'管理员工','user:employee:manage','employee','manage','新增、编辑、删除员工','user','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(9,'员工审核','user:audit:manage','audit','manage','审核新注册员工','user','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(10,'重置密码','user:security:reset_password','security','reset_password','重置员工密码','user','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(11,'部门备忘','user:memo:manage','memo','manage','允许创建、修改、删除个人备忘录及标记已读','user','2026-01-13 16:05:52','2026-02-25 15:10:16'),
	(12,'更新个人资料','user:profile:update','profile','update','更新个人资料','user','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(13,'查看部门','org:department:view','department','view','查看部门架构','organization','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(14,'管理部门','org:department:manage','department','manage','新增、编辑、删除部门','organization','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(15,'查看职位','org:position:view','position','view','查看职位列表','organization','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(16,'管理职位','org:position:manage','position','manage','新增、编辑、删除职位','organization','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(17,'查看广播','messaging:broadcast:view','broadcast','view','查看系统广播','messaging','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(18,'发布广播','messaging:broadcast:manage','broadcast','manage','发布、管理系统广播','messaging','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(19,'使用聊天','messaging:chat:use','chat','use','使用即时通讯系统进行单聊和群聊','messaging','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(20,'管理群组','messaging:chat:manage','group','manage','创建和管理群组','messaging','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(21,'通知设置','messaging:config:manage','config','manage','配置系统通知规则','messaging','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(22,'查看考勤','attendance:record:view','record','view','查看考勤记录','attendance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(23,'考勤统计','attendance:report:view','report','view','查看考勤统计报表','attendance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(24,'考勤设置','attendance:config:manage','config','manage','修改考勤规则、班次、排班','attendance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(25,'考勤审批','attendance:approval:manage','approval','manage','审批请假、加班、补卡申请','attendance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(26,'排班管理','attendance:schedule:manage','schedule','manage','管理员工排班','attendance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(27,'查看资产','finance:asset:view','asset','view','查看固定资产列表','finance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(28,'管理资产','finance:asset:manage','asset','manage','新增、编辑、分配、报废资产','finance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(29,'审批资产申请','finance:asset:audit','asset_request','audit','审核员工提交的设备升级或报修申请','finance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(30,'资产配置管理','finance:asset:config','asset_config','manage','管理业务分类、配件类型及设备型号模版','finance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(31,'采购管理','finance:procurement:manage','inventory','procure','创建采购单、录入物品','finance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(32,'库存盘点','finance:inventory:audit','inventory','audit','进行库存盘点和修正','finance','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(33,'查看假期','vacation:record:view','record','view','查看假期余额及记录','vacation','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(34,'假期配置','vacation:config:manage','config','manage','配置假期规则及额度','vacation','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(35,'假期审批','vacation:approval:manage','approval','manage','审批调休申请','vacation','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(36,'查看质检','quality:session:view','session','view','查看质检会话及记录','quality','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(37,'质检评分','quality:score:manage','score','manage','进行质检评分','quality','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(38,'质检配置','quality:config:manage','config','manage','配置质检规则、标签、平台店铺','quality','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(39,'案例管理','quality:case:manage','case','manage','管理质检案例库','quality','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(40,'查看知识库','knowledge:article:view','article','view','查看公共知识库','knowledge','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(41,'管理知识库','knowledge:article:manage','article','manage','发布、编辑、删除知识库文章','knowledge','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(42,'查看考核','assessment:plan:view','plan','view','查看考核计划及试卷','assessment','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(43,'管理考核','assessment:plan:manage','plan','manage','创建试卷、发布考核计划','assessment','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(44,'查看成绩','assessment:result:view','result','view','查看所有员工考试成绩','assessment','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(45,'查看工资条','payroll:payslip:view','payslip','view','查看自己的工资条','payroll','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(46,'工资条管理','payroll:payslip:manage','payslip','manage','管理所有工资条，包括新增、编辑、删除','payroll','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(47,'工资条发放','payroll:payslip:distribute','payslip','distribute','发放工资条给员工','payroll','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(48,'二级密码管理','payroll:password:manage','password','manage','管理员工工资条二级密码','payroll','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(49,'提交报销','reimbursement:apply:submit','apply','submit','提交报销申请','reimbursement','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(50,'审批报销','reimbursement:apply:approve','apply','approve','审批报销申请','reimbursement','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(51,'查看报销','reimbursement:record:view','record','view','查看报销记录','reimbursement','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(52,'报销配置','reimbursement:config:manage','config','manage','配置审批流程和审批人','reimbursement','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(53,'报销设置','reimbursement:config:settings','config','settings','管理报销类型和费用类型','reimbursement','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(54,'角色流程配置','reimbursement:config:role_workflow','config','role_workflow','为不同角色配置特定审批流程','reimbursement','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(55,'待办中心','personal:todo:view','todo','view','查看并处理个人待办任务','personal','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(56,'查看我的资产','personal:asset:view','asset','view','查看分配给自己的资产设备','personal','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(57,'申请设备升级','personal:asset:upgrade','asset','upgrade','提交设备配置升级或维修申请','personal','2026-01-13 16:05:52','2026-01-13 16:05:52'),
	(58,'一键满分','quality:session:quick_approve','quality_session','quick_approve','允许在质检详情中一键打出满分','quality','2026-02-21 08:44:20','2026-02-21 08:44:20'),
	(59,'批量分配角色','system:role:manage_batch','role_assignment','manage_batch','允许批量设置用户角色','system','2026-02-21 08:44:20','2026-02-21 08:44:20'),
	(60,'导出质检记录','quality:session:export','quality_session','export','允许导出质检会话及详情记录','quality','2026-02-22 15:22:04','2026-02-22 15:22:04'),
	(61,'批量管理文档','knowledge:article:bulk_edit','knowledge_article','bulk_edit','允许批量修改文档公开状态、移动分类及批量删除','knowledge','2026-02-22 16:19:53','2026-02-22 16:19:53'),
	(63,'管理知识分类','knowledge:category:manage','knowledge_category','manage','允许重命名、删除及切换分类公开状态','knowledge','2026-02-23 09:39:01','2026-02-23 09:39:01'),
	(64,'推送审计配置','system:notification:settings','notification_settings','manage','管理全局业务通知的分发规则与角色映射','system','2026-02-25 14:58:40','2026-02-25 14:58:40'),
	(66,'管理部门备忘录','personnel:memo:manage','department_memo','manage','允许发送部门/个人定向备忘录并查看阅读审计详情','personnel','2026-02-25 15:10:16','2026-02-25 15:10:16'),
	(67,'查看个人资料','user:profile:view','user_profile','view','允许查看个人及员工的详细档案资料','user','2026-03-02 09:25:52','2026-03-02 09:25:52');

/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 platforms
# ------------------------------------------------------------

DROP TABLE IF EXISTS `platforms`;

CREATE TABLE `platforms` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '平台ID',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台名称',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `name` (`name`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='平台表';

LOCK TABLES `platforms` WRITE;
/*!40000 ALTER TABLE `platforms` DISABLE KEYS */;

INSERT INTO `platforms` (`id`, `name`, `created_at`)
VALUES
	(13,'京东','2026-01-11 17:22:43'),
	(14,'淘宝','2026-01-11 17:22:43'),
	(15,'拼多多','2026-01-11 17:22:43');

/*!40000 ALTER TABLE `platforms` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 positions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `positions`;

CREATE TABLE `positions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '职位ID',
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
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `unique_position_dept` (`name`,`department_id`) USING BTREE,
  KEY `idx_department_id` (`department_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_level` (`level`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_sort_order` (`sort_order`) USING BTREE,
  KEY `created_by` (`created_by`) USING BTREE,
  KEY `updated_by` (`updated_by`) USING BTREE,
  CONSTRAINT `fk_positions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_positions_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_positions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='职位表';

LOCK TABLES `positions` WRITE;
/*!40000 ALTER TABLE `positions` DISABLE KEYS */;

INSERT INTO `positions` (`id`, `name`, `department_id`, `description`, `requirements`, `responsibilities`, `salary_min`, `salary_max`, `level`, `status`, `created_at`, `updated_at`, `created_by`, `updated_by`, `sort_order`)
VALUES
	(51,'总经理',24,'公司最高管理职位','10年以上管理经验，本科及以上学历','负责公司整体战略规划和运营管理',30000.00,50000.00,'expert','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,1),
	(52,'行政主管',24,'行政管理职位','5年以上行政管理经验','负责公司行政事务管理',8000.00,12000.00,'middle','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,2),
	(53,'客服部经理',25,'客服部门管理职位','5年以上客服管理经验','负责客服团队管理和业务指导',12000.00,18000.00,'senior','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,1),
	(54,'高级客服专员',25,'高级客服职位','3年以上客服经验，优秀的沟通能力','处理复杂客户问题，指导初级客服',6000.00,9000.00,'middle','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,2),
	(55,'客服专员',25,'基础客服职位','良好的沟通能力和服务意识','处理客户咨询和售后服务',4000.00,6000.00,'junior','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,3),
	(56,'技术总监',26,'技术部门最高管理职位','8年以上技术管理经验','负责技术团队管理和技术架构设计',25000.00,40000.00,'expert','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,1),
	(57,'高级工程师',26,'高级技术职位','5年以上开发经验','负责核心系统开发和技术攻关',15000.00,25000.00,'senior','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,2),
	(58,'系统工程师',26,'中级技术职位','2年以上开发经验','负责系统功能开发和维护',8000.00,15000.00,'middle','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,3),
	(59,'质检主管',27,'质检部门管理职位','3年以上质检经验','负责质检团队管理和质检标准制定',10000.00,15000.00,'senior','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,1),
	(60,'质检专员',27,'质检职位','良好的分析能力和责任心','负责客服质量检查和评估',5000.00,8000.00,'middle','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,2),
	(61,'运营经理',28,'运营部门管理职位','5年以上运营经验','负责业务运营和数据分析',12000.00,20000.00,'senior','active','2026-01-11 17:22:43','2026-01-11 17:22:43',NULL,NULL,1);

/*!40000 ALTER TABLE `positions` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 procurement_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `procurement_records`;

CREATE TABLE `procurement_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `quantity` int NOT NULL,
  `price_per_unit` decimal(10,2) DEFAULT NULL,
  `total_price` decimal(10,2) DEFAULT NULL,
  `supplier` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `batch_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchaser_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `item_id` (`item_id`) USING BTREE,
  KEY `purchaser_id` (`purchaser_id`) USING BTREE,
  CONSTRAINT `procurement_records_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `procurement_records_ibfk_2` FOREIGN KEY (`purchaser_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 quality_case_attachments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_case_attachments`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_case_id` (`case_id`) USING BTREE,
  CONSTRAINT `fk_quality_case_attachments_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例附件表';



# 转储表 quality_case_collections
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_case_collections`;

CREATE TABLE `quality_case_collections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_case_user` (`case_id`,`user_id`) USING BTREE,
  KEY `idx_case_id` (`case_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  CONSTRAINT `fk_quality_case_collections_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例收藏表';



# 转储表 quality_case_comments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_case_comments`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_case_id` (`case_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  CONSTRAINT `fk_quality_case_comments_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例评论表';



# 转储表 quality_case_favorites
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_case_favorites`;

CREATE TABLE `quality_case_favorites` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL COMMENT '案例ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `unique_user_case` (`user_id`,`case_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_case_id` (`case_id`) USING BTREE,
  CONSTRAINT `quality_case_favorites_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `quality_case_favorites_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例收藏表';



# 转储表 quality_case_learning_records
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_case_learning_records`;

CREATE TABLE `quality_case_learning_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `user_id` int NOT NULL,
  `duration` int NOT NULL DEFAULT '0',
  `is_completed` tinyint(1) NOT NULL DEFAULT '0',
  `last_position` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_case_user` (`case_id`,`user_id`) USING BTREE,
  KEY `idx_case_id` (`case_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  CONSTRAINT `fk_quality_case_learning_records_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例学习记录表';



# 转储表 quality_case_likes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_case_likes`;

CREATE TABLE `quality_case_likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL COMMENT '案例ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `unique_user_case` (`user_id`,`case_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_case_id` (`case_id`) USING BTREE,
  CONSTRAINT `quality_case_likes_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `quality_case_likes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例点赞表';



# 转储表 quality_case_tags
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_case_tags`;

CREATE TABLE `quality_case_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_case_tag` (`case_id`,`tag_id`) USING BTREE,
  KEY `idx_case_id` (`case_id`) USING BTREE,
  KEY `idx_tag_id` (`tag_id`) USING BTREE,
  CONSTRAINT `fk_quality_case_tags_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例标签关联表';



# 转储表 quality_case_views
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_case_views`;

CREATE TABLE `quality_case_views` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL COMMENT '案例ID',
  `user_id` int DEFAULT NULL COMMENT '用户ID（可为空，支持匿名浏览）',
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '用户代理',
  `viewed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '浏览时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_case_id` (`case_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_viewed_at` (`viewed_at`) USING BTREE,
  CONSTRAINT `quality_case_views_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `quality_case_views_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='案例浏览记录表';



# 转储表 quality_cases
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_cases`;

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
  `deleted_at` datetime DEFAULT NULL COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_category` (`category`) USING BTREE,
  KEY `idx_case_type` (`case_type`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_deleted_at` (`deleted_at`) USING BTREE,
  FULLTEXT KEY `ft_case_search` (`title`,`description`,`problem`,`solution`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='质检案例表';

LOCK TABLES `quality_cases` WRITE;
/*!40000 ALTER TABLE `quality_cases` DISABLE KEYS */;

INSERT INTO `quality_cases` (`id`, `title`, `category`, `description`, `problem`, `solution`, `case_type`, `difficulty`, `priority`, `status`, `session_id`, `view_count`, `like_count`, `collect_count`, `comment_count`, `is_featured`, `is_recommended`, `created_by`, `updated_by`, `published_at`, `created_at`, `updated_at`, `deleted_at`)
VALUES
	(6,'123','测试分类',NULL,'从会话详情添加','待补充','excellent','medium','medium','draft',54,0,0,0,0,0,0,1,NULL,NULL,'2026-02-22 09:45:04','2026-02-25 16:49:08','2026-02-25 16:49:08'),
	(7,'客服 - 质检案例 #QS-20260222-3859','拼多多',NULL,'对话详情：\n[客服] 你好，我想咨询一下产品信息发的撒\n[客服] 您好！很高兴为您服务，请问有什么可以帮您的','通过新版质检界面评分','excellent','medium','medium','published',NULL,0,0,0,0,0,0,1,NULL,NULL,'2026-02-23 12:07:47','2026-02-23 12:07:47',NULL);

/*!40000 ALTER TABLE `quality_cases` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 quality_message_tags
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_message_tags`;

CREATE TABLE `quality_message_tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `message_id` int NOT NULL COMMENT '消息ID',
  `tag_id` int NOT NULL COMMENT '标签ID',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_message_tag` (`message_id`,`tag_id`) USING BTREE,
  KEY `idx_message_id` (`message_id`) USING BTREE,
  KEY `idx_tag_id` (`tag_id`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE,
  CONSTRAINT `fk_quality_message_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_message_tags_message_id` FOREIGN KEY (`message_id`) REFERENCES `session_messages` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_message_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='质检消息标签关联表';



# 转储表 quality_rules
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_rules`;

CREATE TABLE `quality_rules` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '质检规则ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '规则名称',
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '规则分类',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '规则描述',
  `criteria` json NOT NULL COMMENT '评判标准',
  `score_weight` decimal(5,2) NOT NULL COMMENT '分数权重',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_category` (`category`) USING BTREE,
  KEY `idx_score_weight` (`score_weight`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE,
  CONSTRAINT `fk_quality_rules_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='质检规则表';

LOCK TABLES `quality_rules` WRITE;
/*!40000 ALTER TABLE `quality_rules` DISABLE KEYS */;

INSERT INTO `quality_rules` (`id`, `name`, `category`, `description`, `criteria`, `score_weight`, `is_active`, `created_by`, `created_at`, `updated_at`)
VALUES
	(1,'服务态度','attitude','评估客服人员的服务态度和礼貌程度','{\"negative\": [\"态度冷淡\", \"不耐烦\", \"语气生硬\"], \"positive\": [\"礼貌用语\", \"积极响应\", \"耐心解答\"]}',30.00,1,37,'2025-12-25 14:01:12','2026-01-11 17:22:43'),
	(2,'专业能力','professional','评估客服人员的专业知识和问题解决能力','{\"negative\": [\"答非所问\", \"知识欠缺\", \"无法解决问题\"], \"positive\": [\"准确解答\", \"专业术语\", \"快速定位问题\"]}',40.00,1,37,'2025-12-25 14:01:12','2026-01-11 17:22:43'),
	(3,'沟通技巧','communication','评估客服人员的沟通表达能力','{\"negative\": [\"表达混乱\", \"词不达意\", \"理解偏差\"], \"positive\": [\"表达清晰\", \"逻辑清楚\", \"善于引导\"]}',30.00,1,37,'2025-12-25 14:01:12','2026-01-11 17:22:43'),
	(4,'服务态度','服务质量','评估客服人员的服务态度','{\"good\": \"态度良好，较为耐心\", \"poor\": \"态度恶劣，需要培训\", \"average\": \"态度一般，有待改进\", \"excellent\": \"态度热情，耐心细致\"}',30.00,1,NULL,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(5,'问题解决能力','专业技能','评估客服人员解决问题的能力','{\"good\": \"能够解决问题\", \"poor\": \"无法解决问题\", \"average\": \"解决问题较慢\", \"excellent\": \"快速准确解决问题\"}',40.00,1,NULL,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(6,'沟通技巧','沟通能力','评估客服人员的沟通表达能力','{\"good\": \"表达清楚，易于理解\", \"poor\": \"表达混乱，难以理解\", \"average\": \"表达一般，偶有不清\", \"excellent\": \"表达清晰，逻辑性强\"}',30.00,1,NULL,'2025-12-25 14:01:12','2025-12-25 14:01:12');

/*!40000 ALTER TABLE `quality_rules` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 quality_scores
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_scores`;

CREATE TABLE `quality_scores` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '评分记录ID',
  `session_id` int NOT NULL COMMENT '会话ID',
  `rule_id` int NOT NULL COMMENT '规则ID',
  `score` decimal(5,2) NOT NULL COMMENT '得分',
  `max_score` decimal(5,2) DEFAULT NULL COMMENT '满分',
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '评分说明',
  `created_by` int DEFAULT NULL COMMENT '评分人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_session_rule` (`session_id`,`rule_id`) USING BTREE,
  KEY `idx_session_id` (`session_id`) USING BTREE,
  KEY `idx_rule_id` (`rule_id`) USING BTREE,
  KEY `idx_score` (`score`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE,
  CONSTRAINT `fk_quality_scores_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_scores_rule_id` FOREIGN KEY (`rule_id`) REFERENCES `quality_rules` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_scores_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='质检评分表';

LOCK TABLES `quality_scores` WRITE;
/*!40000 ALTER TABLE `quality_scores` DISABLE KEYS */;

INSERT INTO `quality_scores` (`id`, `session_id`, `rule_id`, `score`, `max_score`, `comment`, `created_by`, `created_at`)
VALUES
	(179,52,1,100.00,30.00,'服务态度',NULL,'2026-02-22 09:33:38'),
	(180,52,2,100.00,40.00,'专业能力',NULL,'2026-02-22 09:33:38'),
	(181,52,3,100.00,30.00,'沟通技巧',NULL,'2026-02-22 09:33:38'),
	(182,52,4,100.00,30.00,'服务态度',NULL,'2026-02-22 09:33:38'),
	(183,52,5,100.00,40.00,'问题解决能力',NULL,'2026-02-22 09:33:38'),
	(184,52,6,100.00,30.00,'沟通技巧',NULL,'2026-02-22 09:33:38'),
	(185,54,1,40.00,30.00,'服务态度',NULL,'2026-02-22 09:44:51'),
	(186,54,2,40.00,40.00,'专业能力',NULL,'2026-02-22 09:44:51'),
	(187,54,3,40.00,30.00,'沟通技巧',NULL,'2026-02-22 09:44:51'),
	(188,54,4,40.00,30.00,'服务态度',NULL,'2026-02-22 09:44:51'),
	(189,54,5,40.00,40.00,'问题解决能力',NULL,'2026-02-22 09:44:51'),
	(190,54,6,40.00,30.00,'沟通技巧',NULL,'2026-02-22 09:44:51');

/*!40000 ALTER TABLE `quality_scores` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 quality_session_tags
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_session_tags`;

CREATE TABLE `quality_session_tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `session_id` int NOT NULL COMMENT '质检会话ID',
  `tag_id` int NOT NULL COMMENT '标签ID',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_session_tag` (`session_id`,`tag_id`) USING BTREE,
  KEY `idx_session_id` (`session_id`) USING BTREE,
  KEY `idx_tag_id` (`tag_id`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE,
  CONSTRAINT `fk_quality_session_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_session_tags_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_session_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='质检会话标签关联表';



# 转储表 quality_sessions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_sessions`;

CREATE TABLE `quality_sessions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '质检会话ID',
  `session_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会话编号',
  `agent_id` int DEFAULT NULL COMMENT '客服人员ID（系统用户）',
  `external_agent_id` int DEFAULT NULL COMMENT '外部客服ID（导入数据）',
  `agent_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客服姓名（导入数据）',
  `customer_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户ID',
  `customer_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户姓名',
  `channel` enum('chat','phone','email','video') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'chat' COMMENT '沟通渠道',
  `start_time` datetime NOT NULL COMMENT '会话开始时间',
  `end_time` datetime NOT NULL COMMENT '会话结束时间',
  `duration` int NOT NULL COMMENT '会话时长（秒）',
  `message_count` int NOT NULL DEFAULT '0' COMMENT '消息总数',
  `status` enum('pending','in_review','completed','disputed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '质检状态',
  `inspector_id` int DEFAULT NULL COMMENT '质检员ID',
  `score` decimal(5,2) DEFAULT NULL COMMENT '质检总分',
  `grade` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '质检等级',
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '质检评语',
  `reviewed_at` datetime DEFAULT NULL COMMENT '质检完成时间',
  `platform_id` int DEFAULT NULL COMMENT '平台ID',
  `shop_id` int DEFAULT NULL COMMENT '店铺ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_session_no` (`session_no`) USING BTREE,
  KEY `idx_agent_id` (`agent_id`) USING BTREE,
  KEY `idx_external_agent_id` (`external_agent_id`) USING BTREE,
  KEY `idx_customer_id` (`customer_id`) USING BTREE,
  KEY `idx_channel` (`channel`) USING BTREE,
  KEY `idx_start_time` (`start_time`) USING BTREE,
  KEY `idx_end_time` (`end_time`) USING BTREE,
  KEY `idx_duration` (`duration`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_inspector_id` (`inspector_id`) USING BTREE,
  KEY `idx_score` (`score`) USING BTREE,
  KEY `idx_grade` (`grade`) USING BTREE,
  KEY `idx_reviewed_at` (`reviewed_at`) USING BTREE,
  KEY `idx_platform_id` (`platform_id`) USING BTREE,
  KEY `idx_shop_id` (`shop_id`) USING BTREE,
  KEY `idx_time_range` (`start_time`,`end_time`) USING BTREE,
  KEY `idx_agent_time_status` (`agent_id`,`start_time`,`status`) USING BTREE,
  KEY `idx_agent_status_time` (`agent_id`,`status`,`start_time`),
  CONSTRAINT `fk_quality_sessions_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_sessions_external_agent_id` FOREIGN KEY (`external_agent_id`) REFERENCES `external_agents` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_sessions_inspector_id` FOREIGN KEY (`inspector_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_sessions_platform_id` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_quality_sessions_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='质检会话表';

LOCK TABLES `quality_sessions` WRITE;
/*!40000 ALTER TABLE `quality_sessions` DISABLE KEYS */;

INSERT INTO `quality_sessions` (`id`, `session_no`, `agent_id`, `external_agent_id`, `agent_name`, `customer_id`, `customer_name`, `channel`, `start_time`, `end_time`, `duration`, `message_count`, `status`, `inspector_id`, `score`, `grade`, `comment`, `reviewed_at`, `platform_id`, `shop_id`, `created_at`, `updated_at`)
VALUES
	(52,'S0012',NULL,2,'张三','C001','李四','chat','2024-11-29 10:00:00','2024-11-29 10:15:00',0,2,'completed',NULL,100.00,'A','服务规范，专业度高，予以通过。','2026-02-22 09:33:38',13,30,'2026-02-21 10:50:36','2026-02-22 09:35:30'),
	(54,'QS-20260222-3859',NULL,1,'张三','C001','李四','chat','2024-11-29 10:00:00','2024-11-29 10:15:00',0,2,'completed',NULL,80.00,'B','通过新版质检界面评分','2026-02-22 13:12:51',15,35,'2026-02-22 09:44:10','2026-02-22 13:12:51');

/*!40000 ALTER TABLE `quality_sessions` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 quality_tag_categories
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_tag_categories`;

CREATE TABLE `quality_tag_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类描述',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_name` (`name`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='标签分类表';

LOCK TABLES `quality_tag_categories` WRITE;
/*!40000 ALTER TABLE `quality_tag_categories` DISABLE KEYS */;

INSERT INTO `quality_tag_categories` (`id`, `name`, `description`, `sort_order`, `created_at`, `updated_at`)
VALUES
	(17,'服务态度','关于客服服务态度的标签',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(18,'业务能力','关于客服业务知识的标签',2,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(19,'沟通技巧','关于客服沟通技巧的标签',3,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(20,'违规行为','关于客服违规行为的标签',4,'2026-01-11 17:22:43','2026-01-11 17:22:43');

/*!40000 ALTER TABLE `quality_tag_categories` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 quality_tags
# ------------------------------------------------------------

DROP TABLE IF EXISTS `quality_tags`;

CREATE TABLE `quality_tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '标签ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '标签名称',
  `category_id` int DEFAULT NULL COMMENT '分类ID',
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '#1890ff' COMMENT '标签颜色',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签描述',
  `tag_type` enum('quality','business','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'quality' COMMENT '标签类型',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_name_category` (`name`,`category_id`) USING BTREE,
  KEY `idx_category_id` (`category_id`) USING BTREE,
  KEY `idx_tag_type` (`tag_type`) USING BTREE,
  CONSTRAINT `fk_quality_tags_category_id` FOREIGN KEY (`category_id`) REFERENCES `quality_tag_categories` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='质检标签表';

LOCK TABLES `quality_tags` WRITE;
/*!40000 ALTER TABLE `quality_tags` DISABLE KEYS */;

INSERT INTO `quality_tags` (`id`, `name`, `category_id`, `color`, `description`, `tag_type`, `is_active`, `created_at`, `updated_at`)
VALUES
	(41,'态度恶劣',17,'#ff4d4f','客服态度不好，语气生硬','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(42,'热情周到',17,'#52c41a','客服态度很好，积极主动','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(43,'敷衍了事',17,'#faad14','客服回复敷衍，不解决问题','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(44,'业务不熟',18,'#ff4d4f','客服对业务知识不熟悉','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(45,'解答准确',18,'#52c41a','客服解答问题准确无误','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(46,'流程错误',18,'#faad14','客服操作流程有误','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(47,'沟通顺畅',19,'#52c41a','沟通理解能力强，表达清晰','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(48,'表达不清',19,'#faad14','表达含糊，客户难以理解','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(49,'辱骂客户',20,'#f5222d','严重违规，辱骂客户','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(50,'泄露隐私',20,'#f5222d','严重违规，泄露客户隐私','quality',1,'2026-01-11 17:22:43','2026-01-11 17:22:43');

/*!40000 ALTER TABLE `quality_tags` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 questions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `questions`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_exam_id` (`exam_id`) USING BTREE,
  KEY `idx_type` (`type`) USING BTREE,
  KEY `idx_score` (`score`) USING BTREE,
  KEY `idx_order_num` (`order_num`) USING BTREE,
  CONSTRAINT `fk_questions_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='题目表-存储试卷中的具体题目信息';



# 转储表 reimbursement_attachments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `reimbursement_attachments`;

CREATE TABLE `reimbursement_attachments` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '附件ID',
  `reimbursement_id` int NOT NULL COMMENT '报销单ID',
  `item_id` int DEFAULT NULL COMMENT '关联明细ID(可选)',
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原始文件名',
  `file_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件MIME类型',
  `file_size` int DEFAULT NULL COMMENT '文件大小(bytes)',
  `file_url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_reimbursement_id` (`reimbursement_id`) USING BTREE,
  KEY `idx_item_id` (`item_id`) USING BTREE,
  CONSTRAINT `fk_attachments_item` FOREIGN KEY (`item_id`) REFERENCES `reimbursement_items` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_attachments_reimbursement` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='报销附件表';



# 转储表 reimbursement_items
# ------------------------------------------------------------

DROP TABLE IF EXISTS `reimbursement_items`;

CREATE TABLE `reimbursement_items` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  `reimbursement_id` int NOT NULL COMMENT '报销单ID',
  `item_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '费用类型(交通/住宿/餐饮/通讯/办公用品等)',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '金额',
  `expense_date` date DEFAULT NULL COMMENT '费用发生日期',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '费用说明',
  `attachment_url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_reimbursement_id` (`reimbursement_id`) USING BTREE,
  KEY `idx_item_type` (`item_type`) USING BTREE,
  CONSTRAINT `fk_items_reimbursement` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='报销明细表';

LOCK TABLES `reimbursement_items` WRITE;
/*!40000 ALTER TABLE `reimbursement_items` DISABLE KEYS */;

INSERT INTO `reimbursement_items` (`id`, `reimbursement_id`, `item_type`, `amount`, `expense_date`, `description`, `attachment_url`, `created_at`)
VALUES
	(9,9,'通讯费',100.00,'2026-02-28','fds ','/uploads/1772266397243-eadkvh.png','2026-02-28 16:13:20'),
	(10,10,'住宿费',123.00,'2026-02-28','发的撒','/uploads/1772266849770-wrrup.png','2026-02-28 16:20:54'),
	(11,11,'住宿费',100.00,'2026-03-02','发的撒','https://leixi-oss.oss-cn-beijing.aliyuncs.com/reimbursement/1772410329944-%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20260225161532_27_265.png','2026-03-02 08:12:12'),
	(12,12,'住宿费',1.00,'2026-03-02','df ','https://leixi-oss.oss-cn-beijing.aliyuncs.com/reimbursement/1772410476882-%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20260225161540_28_265.png','2026-03-02 08:14:39'),
	(13,13,'市内交通/打车',100.00,'2026-03-02','发的撒','reimbursement/20260302123151-wa4ygtsv.png','2026-03-02 12:31:53'),
	(14,14,'市内交通/打车',100.00,'2026-03-03','123','reimbursement/20260303141745-ce0id1jh.jpeg','2026-03-03 14:17:47');

/*!40000 ALTER TABLE `reimbursement_items` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 reimbursement_types
# ------------------------------------------------------------

DROP TABLE IF EXISTS `reimbursement_types`;

CREATE TABLE `reimbursement_types` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型名称',
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '类型代码(可选)',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '描述',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_name` (`name`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='报销类型配置表';

LOCK TABLES `reimbursement_types` WRITE;
/*!40000 ALTER TABLE `reimbursement_types` DISABLE KEYS */;

INSERT INTO `reimbursement_types` (`id`, `name`, `code`, `description`, `is_active`, `sort_order`, `created_at`, `updated_at`)
VALUES
	(1,'差旅费','travel',NULL,0,1,'2026-01-11 16:39:31','2026-03-01 10:01:52'),
	(2,'业务招待费','entertainment',NULL,0,2,'2026-01-11 16:39:31','2026-03-01 09:46:18'),
	(3,'办公用品费','office',NULL,1,3,'2026-01-11 16:39:31','2026-01-11 16:39:31'),
	(4,'团建费用','team_building',NULL,1,4,'2026-01-11 16:39:31','2026-01-11 16:39:31'),
	(5,'培训费','training',NULL,1,5,'2026-01-11 16:39:31','2026-01-11 16:39:31'),
	(6,'其他费用','other',NULL,1,99,'2026-01-11 16:39:31','2026-01-11 16:39:31');

/*!40000 ALTER TABLE `reimbursement_types` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 reimbursements
# ------------------------------------------------------------

DROP TABLE IF EXISTS `reimbursements`;

CREATE TABLE `reimbursements` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '报销单ID',
  `reimbursement_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '报销单号(自动生成)',
  `user_id` int NOT NULL COMMENT '申请人用户ID',
  `employee_id` int NOT NULL COMMENT '申请人员工ID',
  `department_id` int DEFAULT NULL COMMENT '申请人部门ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '报销标题',
  `type` enum('travel','office','entertainment','training','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other' COMMENT '报销类型:差旅/办公/招待/培训/其他',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '报销总金额',
  `status` enum('draft','pending','approving','approved','rejected','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '状态:草稿/待审批/审批中/已通过/已驳回/已撤销',
  `current_node_id` int DEFAULT NULL COMMENT '当前审批节点ID',
  `workflow_id` int DEFAULT NULL COMMENT '使用的审批流程ID',
  `remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '备注说明',
  `submitted_at` datetime DEFAULT NULL COMMENT '提交时间',
  `completed_at` datetime DEFAULT NULL COMMENT '审批完成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_reimbursement_no` (`reimbursement_no`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_employee_id` (`employee_id`) USING BTREE,
  KEY `idx_department_id` (`department_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_type` (`type`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  CONSTRAINT `fk_reimbursements_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_reimbursements_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_reimbursements_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='报销申请主表';

LOCK TABLES `reimbursements` WRITE;
/*!40000 ALTER TABLE `reimbursements` DISABLE KEYS */;

INSERT INTO `reimbursements` (`id`, `reimbursement_no`, `user_id`, `employee_id`, `department_id`, `title`, `type`, `total_amount`, `status`, `current_node_id`, `workflow_id`, `remark`, `submitted_at`, `completed_at`, `created_at`, `updated_at`)
VALUES
	(9,'BX20260228161320192',37,21,24,'2026年02月报销申请','travel',100.00,'cancelled',NULL,NULL,'123',NULL,NULL,'2026-02-28 16:13:20','2026-02-28 16:34:24'),
	(10,'BX20260228162054417',37,21,24,'2026年02月报销申请','travel',123.00,'approved',NULL,23,'1234','2026-02-28 16:20:54','2026-02-28 16:52:29','2026-02-28 16:20:54','2026-02-28 16:52:29'),
	(11,'BX20260302081212987',37,21,24,'2026年03月报销申请','office',100.00,'pending',58,23,'234','2026-03-02 08:12:12',NULL,'2026-03-02 08:12:12','2026-03-02 08:12:12'),
	(12,'BX20260302081439917',37,21,24,'2026年03月报销申请','office',1.00,'pending',79,23,'12345','2026-03-02 08:14:39',NULL,'2026-03-02 08:14:39','2026-03-02 08:14:39'),
	(13,'BX20260302123153178',37,21,24,'2026年03月报销申请','office',100.00,'pending',79,23,'发的撒','2026-03-02 12:31:53',NULL,'2026-03-02 12:31:53','2026-03-02 12:31:53'),
	(14,'BX20260303141747865',37,21,24,'2026年03月报销申请','office',100.00,'cancelled',NULL,23,'但是','2026-03-03 14:17:47',NULL,'2026-03-03 14:17:47','2026-03-03 14:17:55');

/*!40000 ALTER TABLE `reimbursements` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 role_departments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `role_departments`;

CREATE TABLE `role_departments` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `role_id` int NOT NULL COMMENT '角色ID',
  `department_id` int NOT NULL COMMENT '部门ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_role_department` (`role_id`,`department_id`) USING BTREE,
  KEY `idx_role_id` (`role_id`) USING BTREE,
  KEY `idx_department_id` (`department_id`) USING BTREE,
  CONSTRAINT `fk_role_departments_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_role_departments_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='角色部门关联表';



# 转储表 role_permissions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `role_permissions`;

CREATE TABLE `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `role_id` int NOT NULL COMMENT '角色ID',
  `permission_id` int NOT NULL COMMENT '权限ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_role_permission` (`role_id`,`permission_id`) USING BTREE,
  KEY `idx_role_id` (`role_id`) USING BTREE,
  KEY `idx_permission_id` (`permission_id`) USING BTREE,
  CONSTRAINT `fk_role_permissions_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_role_permissions_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='角色权限关联表';

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;

INSERT INTO `role_permissions` (`id`, `role_id`, `permission_id`, `created_at`)
VALUES
	(1,33,43,'2026-01-13 16:05:52'),
	(2,33,42,'2026-01-13 16:05:52'),
	(3,33,44,'2026-01-13 16:05:52'),
	(4,33,25,'2026-01-13 16:05:52'),
	(5,33,24,'2026-01-13 16:05:52'),
	(6,33,22,'2026-01-13 16:05:52'),
	(7,33,23,'2026-01-13 16:05:52'),
	(8,33,26,'2026-01-13 16:05:52'),
	(9,33,29,'2026-01-13 16:05:52'),
	(10,33,30,'2026-01-13 16:05:52'),
	(11,33,28,'2026-01-13 16:05:52'),
	(12,33,27,'2026-01-13 16:05:52'),
	(13,33,32,'2026-01-13 16:05:52'),
	(14,33,31,'2026-01-13 16:05:52'),
	(15,33,41,'2026-01-13 16:05:52'),
	(16,33,40,'2026-01-13 16:05:52'),
	(17,33,18,'2026-01-13 16:05:52'),
	(18,33,17,'2026-01-13 16:05:52'),
	(19,33,20,'2026-01-13 16:05:52'),
	(20,33,19,'2026-01-13 16:05:52'),
	(21,33,21,'2026-01-13 16:05:52'),
	(22,33,14,'2026-01-13 16:05:52'),
	(23,33,13,'2026-01-13 16:05:52'),
	(24,33,16,'2026-01-13 16:05:52'),
	(25,33,15,'2026-01-13 16:05:52'),
	(26,33,48,'2026-01-13 16:05:52'),
	(27,33,47,'2026-01-13 16:05:52'),
	(28,33,46,'2026-01-13 16:05:52'),
	(29,33,45,'2026-01-13 16:05:52'),
	(30,33,57,'2026-01-13 16:05:52'),
	(31,33,56,'2026-01-13 16:05:52'),
	(32,33,55,'2026-01-13 16:05:52'),
	(33,33,39,'2026-01-13 16:05:52'),
	(34,33,38,'2026-01-13 16:05:52'),
	(35,33,37,'2026-01-13 16:05:52'),
	(36,33,36,'2026-01-13 16:05:52'),
	(37,33,50,'2026-01-13 16:05:52'),
	(38,33,49,'2026-01-13 16:05:52'),
	(39,33,52,'2026-01-13 16:05:52'),
	(40,33,54,'2026-01-13 16:05:52'),
	(41,33,53,'2026-01-13 16:05:52'),
	(42,33,51,'2026-01-13 16:05:52'),
	(43,33,2,'2026-01-13 16:05:52'),
	(44,33,1,'2026-01-13 16:05:52'),
	(45,33,5,'2026-01-13 16:05:52'),
	(46,33,4,'2026-01-13 16:05:52'),
	(47,33,3,'2026-01-13 16:05:52'),
	(48,33,6,'2026-01-13 16:05:52'),
	(49,33,9,'2026-01-13 16:05:52'),
	(50,33,8,'2026-01-13 16:05:52'),
	(51,33,7,'2026-01-13 16:05:52'),
	(52,33,11,'2026-01-13 16:05:52'),
	(53,33,12,'2026-01-13 16:05:52'),
	(54,33,10,'2026-01-13 16:05:52'),
	(55,33,35,'2026-01-13 16:05:52'),
	(56,33,34,'2026-01-13 16:05:52'),
	(57,33,33,'2026-01-13 16:05:52'),
	(127,7,1,'2026-01-15 17:15:34'),
	(128,7,7,'2026-01-15 17:15:34'),
	(129,7,12,'2026-01-15 17:15:34'),
	(130,7,13,'2026-01-15 17:15:34'),
	(131,7,15,'2026-01-15 17:15:34'),
	(132,7,17,'2026-01-15 17:15:34'),
	(133,7,19,'2026-01-15 17:15:34'),
	(134,7,20,'2026-01-15 17:15:34'),
	(135,7,22,'2026-01-15 17:15:34'),
	(136,7,27,'2026-01-15 17:15:34'),
	(137,7,31,'2026-01-15 17:15:34'),
	(138,7,33,'2026-01-15 17:15:34'),
	(139,7,40,'2026-01-15 17:15:34'),
	(140,7,42,'2026-01-15 17:15:34'),
	(141,7,45,'2026-01-15 17:15:34'),
	(142,7,56,'2026-01-15 17:15:34'),
	(143,7,57,'2026-01-15 17:15:34'),
	(144,7,43,'2026-01-15 17:15:34'),
	(145,33,58,'2026-02-21 08:44:20'),
	(146,33,59,'2026-02-21 08:44:20'),
	(148,33,60,'2026-02-22 15:22:04'),
	(149,33,61,'2026-02-22 16:19:53'),
	(150,33,63,'2026-02-23 09:39:01'),
	(151,33,64,'2026-02-25 14:58:40'),
	(152,33,66,'2026-02-25 15:10:16'),
	(153,7,11,'2026-02-25 15:10:16'),
	(154,33,67,'2026-03-02 09:25:52');

/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 role_workflows
# ------------------------------------------------------------

DROP TABLE IF EXISTS `role_workflows`;

CREATE TABLE `role_workflows` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `role_id` int NOT NULL COMMENT '角色ID',
  `workflow_id` int NOT NULL COMMENT '审批流程ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_role_workflow` (`role_id`,`workflow_id`) USING BTREE,
  KEY `idx_role_id` (`role_id`) USING BTREE,
  KEY `idx_workflow_id` (`workflow_id`) USING BTREE,
  CONSTRAINT `fk_role_workflows_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_role_workflows_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='角色审批流程配置表';



# 转储表 roles
# ------------------------------------------------------------

DROP TABLE IF EXISTS `roles`;

CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '角色唯一标识ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '角色名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '角色描述',
  `level` int NOT NULL DEFAULT '1' COMMENT '角色级别',
  `is_system` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否系统内置角色',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `can_view_all_departments` tinyint(1) DEFAULT '0' COMMENT '鏄?惁鍙?煡鐪嬫墍鏈夐儴闂ㄦ暟鎹',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_name` (`name`) USING BTREE,
  KEY `idx_level` (`level`) USING BTREE,
  KEY `idx_is_system` (`is_system`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='角色表-定义系统角色';

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;

INSERT INTO `roles` (`id`, `name`, `description`, `level`, `is_system`, `created_at`, `updated_at`, `can_view_all_departments`)
VALUES
	(7,'普通员工','系统默认基础角色，拥有基本查看权限',1,1,'2025-12-20 09:58:59','2025-12-20 09:58:59',0),
	(33,'超级管理员','系统最高权限角色，拥有所有功能的访问和管理权限',100,1,'2026-01-11 17:22:43','2026-01-11 17:22:43',0);

/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 schedules
# ------------------------------------------------------------

DROP TABLE IF EXISTS `schedules`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_date` (`user_id`,`schedule_date`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_shift_id` (`shift_id`) USING BTREE,
  KEY `idx_schedule_date` (`schedule_date`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE,
  CONSTRAINT `fk_schedules_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_schedules_shift_id` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_schedules_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='排班表-员工排班记录表，记录每个员工的具体排班安排';



# 转储表 session_messages
# ------------------------------------------------------------

DROP TABLE IF EXISTS `session_messages`;

CREATE TABLE `session_messages` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  `session_id` int NOT NULL COMMENT '所属会话ID',
  `sender_type` enum('agent','customer','system') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '发送者类型',
  `sender_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息内容',
  `content_type` enum('text','image','file','audio','video') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text' COMMENT '内容类型',
  `timestamp` datetime NOT NULL COMMENT '消息时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_session_id` (`session_id`) USING BTREE,
  KEY `idx_sender_type` (`sender_type`) USING BTREE,
  KEY `idx_sender_id` (`sender_id`) USING BTREE,
  KEY `idx_content_type` (`content_type`) USING BTREE,
  KEY `idx_timestamp` (`timestamp`) USING BTREE,
  CONSTRAINT `fk_session_messages_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='会话消息表';

LOCK TABLES `session_messages` WRITE;
/*!40000 ALTER TABLE `session_messages` DISABLE KEYS */;

INSERT INTO `session_messages` (`id`, `session_id`, `sender_type`, `sender_name`, `sender_id`, `content`, `content_type`, `timestamp`, `created_at`)
VALUES
	(256,54,'agent','李四',NULL,'你好，我想咨询一下产品信息发的撒','text','2024-11-29 10:00:05','2026-02-22 09:44:10'),
	(257,54,'agent','张三',NULL,'您好！很高兴为您服务，请问有什么可以帮您的','text','2024-11-29 10:00:10','2026-02-22 09:44:10');

/*!40000 ALTER TABLE `session_messages` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 shift_schedules
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shift_schedules`;

CREATE TABLE `shift_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_employee_date` (`employee_id`,`schedule_date`) USING BTREE,
  KEY `idx_shift_id` (`shift_id`) USING BTREE,
  KEY `idx_date` (`schedule_date`) USING BTREE,
  CONSTRAINT `fk_shift_schedules_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_shift_schedules_shift` FOREIGN KEY (`shift_id`) REFERENCES `work_shifts` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='排班表';

LOCK TABLES `shift_schedules` WRITE;
/*!40000 ALTER TABLE `shift_schedules` DISABLE KEYS */;

INSERT INTO `shift_schedules` (`id`, `employee_id`, `shift_id`, `schedule_date`, `is_rest_day`, `created_at`, `updated_at`)
VALUES
	(5,21,21,'2026-02-11',0,'2026-02-25 16:46:08','2026-02-25 16:46:08'),
	(6,21,21,'2026-03-02',0,'2026-03-03 10:23:55','2026-03-03 10:23:55'),
	(7,21,21,'2026-03-03',0,'2026-03-03 10:24:00','2026-03-03 10:24:00');

/*!40000 ALTER TABLE `shift_schedules` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 shift_schedules_backup
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shift_schedules_backup`;

CREATE TABLE `shift_schedules_backup` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期（纯日期，无时间部分）',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 shift_schedules_backup_20251113
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shift_schedules_backup_20251113`;

CREATE TABLE `shift_schedules_backup_20251113` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 shift_schedules_backup_before_date_fix
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shift_schedules_backup_before_date_fix`;

CREATE TABLE `shift_schedules_backup_before_date_fix` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 shift_schedules_backup_comprehensive
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shift_schedules_backup_comprehensive`;

CREATE TABLE `shift_schedules_backup_comprehensive` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期（纯日期，无时间部分）',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 shift_schedules_backup_simple
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shift_schedules_backup_simple`;

CREATE TABLE `shift_schedules_backup_simple` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期（纯日期，无时间部分）',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 shifts
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shifts`;

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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_start_time` (`start_time`) USING BTREE,
  KEY `idx_end_time` (`end_time`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='班次表-定义工作班次信息，用于排班管理和考勤计算';



# 转储表 shops
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shops`;

CREATE TABLE `shops` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '店铺ID',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '店铺名称',
  `platform_id` int NOT NULL COMMENT '所属平台ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `platform_id` (`platform_id`) USING BTREE,
  CONSTRAINT `fk_shops_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='店铺表';

LOCK TABLES `shops` WRITE;
/*!40000 ALTER TABLE `shops` DISABLE KEYS */;

INSERT INTO `shops` (`id`, `name`, `platform_id`, `created_at`)
VALUES
	(29,'京东旗舰店',13,'2026-01-11 17:22:43'),
	(30,'京东专营店1',13,'2026-01-11 17:22:43'),
	(31,'京东自营店',13,'2026-01-11 17:22:43'),
	(32,'淘宝旗舰店',14,'2026-01-11 17:22:43'),
	(33,'淘宝专营店',14,'2026-01-11 17:22:43'),
	(34,'拼多多旗舰店',15,'2026-01-11 17:22:43'),
	(35,'拼多多专营店',15,'2026-01-11 17:22:43');

/*!40000 ALTER TABLE `shops` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 special_approval_group_members
# ------------------------------------------------------------

DROP TABLE IF EXISTS `special_approval_group_members`;

CREATE TABLE `special_approval_group_members` (
  `group_id` int NOT NULL,
  `member_type` enum('role','user') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `member_id` int NOT NULL,
  PRIMARY KEY (`group_id`,`member_type`,`member_id`) USING BTREE,
  CONSTRAINT `special_approval_group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `special_approval_groups` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `special_approval_group_members` WRITE;
/*!40000 ALTER TABLE `special_approval_group_members` DISABLE KEYS */;

INSERT INTO `special_approval_group_members` (`group_id`, `member_type`, `member_id`)
VALUES
	(2,'user',37);

/*!40000 ALTER TABLE `special_approval_group_members` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 special_approval_groups
# ------------------------------------------------------------

DROP TABLE IF EXISTS `special_approval_groups`;

CREATE TABLE `special_approval_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `special_approval_groups` WRITE;
/*!40000 ALTER TABLE `special_approval_groups` DISABLE KEYS */;

INSERT INTO `special_approval_groups` (`id`, `name`, `description`, `created_at`, `updated_at`)
VALUES
	(2,'123','123','2026-03-01 08:59:47','2026-03-01 08:59:47');

/*!40000 ALTER TABLE `special_approval_groups` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 tag_categories
# ------------------------------------------------------------

DROP TABLE IF EXISTS `tag_categories`;

CREATE TABLE `tag_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '标签分类ID',
  `parent_id` int DEFAULT NULL COMMENT '父分类ID',
  `level` int NOT NULL DEFAULT '0' COMMENT '分类层级',
  `path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类路径',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '分类描述',
  `color` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类颜色',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_name` (`name`) USING BTREE,
  KEY `idx_parent_id` (`parent_id`) USING BTREE,
  KEY `idx_level` (`level`) USING BTREE,
  KEY `idx_path` (`path`(255)) USING BTREE,
  KEY `idx_sort_order` (`sort_order`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE,
  CONSTRAINT `fk_tag_categories_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tag_categories` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='标签分类表-支持无限极分类';

LOCK TABLES `tag_categories` WRITE;
/*!40000 ALTER TABLE `tag_categories` DISABLE KEYS */;

INSERT INTO `tag_categories` (`id`, `parent_id`, `level`, `path`, `name`, `description`, `color`, `sort_order`, `is_active`, `created_at`, `updated_at`)
VALUES
	(53,NULL,0,'1','服务质量','评估客服的服务质量相关标签','#FF6B6B',1,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(54,NULL,0,'2','沟通技巧','评估客服的沟通能力相关标签','#4ECDC4',2,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(55,NULL,0,'3','问题类型','客户问题分类相关标签','#45B7D1',3,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(56,NULL,0,'4','客户满意度','客户满意度评价相关标签','#96CEB4',4,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(57,NULL,0,'5','专业能力','客服专业能力评估相关标签','#FFEAA7',5,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(58,53,1,'1/54','服务态度','客服服务态度评估','#FF6B6B',1,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(59,53,1,'1/55','响应速度','客服响应速度评估','#FF8787',2,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(60,53,1,'1/56','服务规范','服务流程规范性评估','#FFA3A3',3,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(61,54,1,'2/55','表达能力','语言表达清晰度评估','#4ECDC4',1,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(62,54,1,'2/56','倾听能力','理解客户需求能力评估','#6FD9D1',2,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(63,55,1,'3/56','产品咨询','产品相关问题','#45B7D1',1,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(64,55,1,'3/57','售后服务','售后相关问题','#67C5DE',2,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(65,55,1,'3/58','投诉建议','客户投诉和建议','#89D3EB',3,1,'2026-01-11 17:22:43','2026-01-11 17:22:43');

/*!40000 ALTER TABLE `tag_categories` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 tags
# ------------------------------------------------------------

DROP TABLE IF EXISTS `tags`;

CREATE TABLE `tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '标签ID',
  `parent_id` int DEFAULT NULL COMMENT '父标签ID',
  `level` int NOT NULL DEFAULT '0' COMMENT '标签层级',
  `path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签路径',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '标签名称',
  `tag_type` enum('quality','case','general') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general' COMMENT '标签类型',
  `category_id` int DEFAULT NULL COMMENT '所属分类ID',
  `color` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签颜色',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '标签描述',
  `usage_count` int NOT NULL DEFAULT '0' COMMENT '使用次数',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_parent_id` (`parent_id`) USING BTREE,
  KEY `idx_level` (`level`) USING BTREE,
  KEY `idx_path` (`path`(255)) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_tag_type` (`tag_type`) USING BTREE,
  KEY `idx_category_id` (`category_id`) USING BTREE,
  KEY `idx_usage_count` (`usage_count`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE,
  CONSTRAINT `fk_tags_category_id` FOREIGN KEY (`category_id`) REFERENCES `tag_categories` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_tags_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='标签表-支持无限极分类';

LOCK TABLES `tags` WRITE;
/*!40000 ALTER TABLE `tags` DISABLE KEYS */;

INSERT INTO `tags` (`id`, `parent_id`, `level`, `path`, `name`, `tag_type`, `category_id`, `color`, `description`, `usage_count`, `is_active`, `created_at`, `updated_at`)
VALUES
	(22,NULL,0,'1','态度热情','quality',NULL,'#FF6B6B','客服态度热情友好',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(23,NULL,0,'2','态度冷淡','quality',NULL,'#FF4757','客服态度冷淡',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(24,NULL,0,'3','响应及时','quality',NULL,'#5F27CD','客服响应速度快',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(25,NULL,0,'4','响应缓慢','quality',NULL,'#341F97','客服响应速度慢',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(26,NULL,0,'5','流程规范','quality',NULL,'#00D2D3','服务流程规范',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(27,NULL,0,'6','表达清晰','quality',NULL,'#4ECDC4','语言表达清晰明了',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(28,NULL,0,'7','表达模糊','quality',NULL,'#1ABC9C','语言表达不够清晰',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(29,NULL,0,'8','善于倾听','quality',NULL,'#48C9B0','能够理解客户需求',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(30,NULL,0,'9','沟通顺畅','quality',NULL,'#16A085','沟通过程顺畅',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(31,NULL,0,'10','产品咨询','quality',NULL,'#45B7D1','客户咨询产品信息',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(32,NULL,0,'11','订单查询','quality',NULL,'#3498DB','客户查询订单状态',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(33,NULL,0,'12','退换货','quality',NULL,'#2980B9','客户申请退换货',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(34,NULL,0,'13','投诉','quality',NULL,'#E74C3C','客户投诉问题',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(35,NULL,0,'14','建议','quality',NULL,'#C0392B','客户提出建议',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(36,NULL,0,'15','非常满意','quality',NULL,'#96CEB4','客户非常满意',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(37,NULL,0,'16','满意','quality',NULL,'#88D8B0','客户满意',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(38,NULL,0,'17','一般','quality',NULL,'#FFEAA7','客户感觉一般',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(39,NULL,0,'18','不满意','quality',NULL,'#FDCB6E','客户不满意',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(40,NULL,0,'19','专业知识扎实','quality',NULL,'#FFEAA7','客服专业知识扎实',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(41,NULL,0,'20','问题解决能力强','quality',NULL,'#FDD835','能快速解决问题',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(42,NULL,0,'21','需要培训','quality',NULL,'#F9CA24','专业能力需要提升',0,1,'2025-12-25 14:01:12','2025-12-25 14:01:12'),
	(43,NULL,0,'1','态度热情','quality',NULL,'#FF6B6B','客服态度热情友好',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(44,NULL,0,'2','态度冷淡','quality',NULL,'#FF4757','客服态度冷淡',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(45,NULL,0,'3','响应及时','quality',NULL,'#5F27CD','客服响应速度快',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(46,NULL,0,'4','响应缓慢','quality',NULL,'#341F97','客服响应速度慢',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(47,NULL,0,'5','流程规范','quality',NULL,'#00D2D3','服务流程规范',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(48,NULL,0,'6','表达清晰','quality',NULL,'#4ECDC4','语言表达清晰明了',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(49,NULL,0,'7','表达模糊','quality',NULL,'#1ABC9C','语言表达不够清晰',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(50,NULL,0,'8','善于倾听','quality',NULL,'#48C9B0','能够理解客户需求',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(51,NULL,0,'9','沟通顺畅','quality',NULL,'#16A085','沟通过程顺畅',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(52,NULL,0,'10','产品咨询','quality',NULL,'#45B7D1','客户咨询产品信息',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(53,NULL,0,'11','订单查询','quality',NULL,'#3498DB','客户查询订单状态',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(54,NULL,0,'12','退换货','quality',NULL,'#2980B9','客户申请退换货',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(55,NULL,0,'13','投诉','quality',NULL,'#E74C3C','客户投诉问题',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(56,NULL,0,'14','建议','quality',NULL,'#C0392B','客户提出建议',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(57,NULL,0,'15','非常满意','quality',NULL,'#96CEB4','客户非常满意',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(58,NULL,0,'16','满意','quality',NULL,'#88D8B0','客户满意',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(59,NULL,0,'17','一般','quality',NULL,'#FFEAA7','客户感觉一般',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(60,NULL,0,'18','不满意','quality',NULL,'#FDCB6E','客户不满意',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(61,NULL,0,'19','专业知识扎实','quality',NULL,'#FFEAA7','客服专业知识扎实',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(62,NULL,0,'20','问题解决能力强','quality',NULL,'#FDD835','能快速解决问题',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(63,NULL,0,'21','需要培训','quality',NULL,'#F9CA24','专业能力需要提升',0,1,'2026-01-11 16:58:17','2026-01-11 16:58:17'),
	(64,NULL,0,'1','态度热情','quality',NULL,'#FF6B6B','客服态度热情友好',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(65,NULL,0,'2','态度冷淡','quality',NULL,'#FF4757','客服态度冷淡',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(66,NULL,0,'3','响应及时','quality',NULL,'#5F27CD','客服响应速度快',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(67,NULL,0,'4','响应缓慢','quality',NULL,'#341F97','客服响应速度慢',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(68,NULL,0,'5','流程规范','quality',NULL,'#00D2D3','服务流程规范',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(69,NULL,0,'6','表达清晰','quality',NULL,'#4ECDC4','语言表达清晰明了',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(70,NULL,0,'7','表达模糊','quality',NULL,'#1ABC9C','语言表达不够清晰',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(71,NULL,0,'8','善于倾听','quality',NULL,'#48C9B0','能够理解客户需求',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(72,NULL,0,'9','沟通顺畅','quality',NULL,'#16A085','沟通过程顺畅',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(73,NULL,0,'10','产品咨询','quality',NULL,'#45B7D1','客户咨询产品信息',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(74,NULL,0,'11','订单查询','quality',NULL,'#3498DB','客户查询订单状态',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(75,NULL,0,'12','退换货','quality',NULL,'#2980B9','客户申请退换货',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(76,NULL,0,'13','投诉','quality',NULL,'#E74C3C','客户投诉问题',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(77,NULL,0,'14','建议','quality',NULL,'#C0392B','客户提出建议',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(78,NULL,0,'15','非常满意','quality',NULL,'#96CEB4','客户非常满意',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(79,NULL,0,'16','满意','quality',NULL,'#88D8B0','客户满意',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(80,NULL,0,'17','一般','quality',NULL,'#FFEAA7','客户感觉一般',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(81,NULL,0,'18','不满意','quality',NULL,'#FDCB6E','客户不满意',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(82,NULL,0,'19','专业知识扎实','quality',NULL,'#FFEAA7','客服专业知识扎实',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(83,NULL,0,'20','问题解决能力强','quality',NULL,'#FDD835','能快速解决问题',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(84,NULL,0,'21','需要培训','quality',NULL,'#F9CA24','专业能力需要提升',0,1,'2026-01-11 17:20:41','2026-01-11 17:20:41'),
	(85,NULL,0,'1','态度热情','quality',53,'#FF6B6B','客服态度热情友好',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(86,NULL,0,'2','态度冷淡','quality',53,'#FF4757','客服态度冷淡',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(87,NULL,0,'3','响应及时','quality',53,'#5F27CD','客服响应速度快',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(88,NULL,0,'4','响应缓慢','quality',53,'#341F97','客服响应速度慢',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(89,NULL,0,'5','流程规范','quality',53,'#00D2D3','服务流程规范',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(90,NULL,0,'6','表达清晰','quality',54,'#4ECDC4','语言表达清晰明了',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(91,NULL,0,'7','表达模糊','quality',54,'#1ABC9C','语言表达不够清晰',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(92,NULL,0,'8','善于倾听','quality',54,'#48C9B0','能够理解客户需求',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(93,NULL,0,'9','沟通顺畅','quality',54,'#16A085','沟通过程顺畅',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(94,NULL,0,'10','产品咨询','quality',55,'#45B7D1','客户咨询产品信息',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(95,NULL,0,'11','订单查询','quality',55,'#3498DB','客户查询订单状态',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(96,NULL,0,'12','退换货','quality',55,'#2980B9','客户申请退换货',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(97,NULL,0,'13','投诉','quality',55,'#E74C3C','客户投诉问题',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(98,NULL,0,'14','建议','quality',55,'#C0392B','客户提出建议',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(99,NULL,0,'15','非常满意','quality',56,'#96CEB4','客户非常满意',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(100,NULL,0,'16','满意','quality',56,'#88D8B0','客户满意',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(101,NULL,0,'17','一般','quality',56,'#FFEAA7','客户感觉一般',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(102,NULL,0,'18','不满意','quality',56,'#FDCB6E','客户不满意',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(103,NULL,0,'19','专业知识扎实','quality',57,'#FFEAA7','客服专业知识扎实',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(104,NULL,0,'20','问题解决能力强','quality',57,'#FDD835','能快速解决问题',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43'),
	(105,NULL,0,'21','需要培训','quality',57,'#F9CA24','专业能力需要提升',0,1,'2026-01-11 17:22:43','2026-01-11 17:22:43');

/*!40000 ALTER TABLE `tags` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 ticket_logs
# ------------------------------------------------------------

DROP TABLE IF EXISTS `ticket_logs`;

CREATE TABLE `ticket_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `operator_id` int NOT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `ticket_id` (`ticket_id`) USING BTREE,
  KEY `operator_id` (`operator_id`) USING BTREE,
  CONSTRAINT `ticket_logs_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ticket_logs_ibfk_2` FOREIGN KEY (`operator_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 tickets
# ------------------------------------------------------------

DROP TABLE IF EXISTS `tickets`;

CREATE TABLE `tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `customer_id` int NOT NULL,
  `status` enum('open','pending','resolved','closed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `priority` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creator_id` int NOT NULL,
  `assignee_id` int DEFAULT NULL,
  `assignee_dept_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `ticket_no` (`ticket_no`) USING BTREE,
  KEY `customer_id` (`customer_id`) USING BTREE,
  KEY `creator_id` (`creator_id`) USING BTREE,
  KEY `assignee_id` (`assignee_id`) USING BTREE,
  KEY `assignee_dept_id` (`assignee_dept_id`) USING BTREE,
  CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `tickets_ibfk_2` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `tickets_ibfk_3` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `tickets_ibfk_4` FOREIGN KEY (`assignee_dept_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 user_case_favorites
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_case_favorites`;

CREATE TABLE `user_case_favorites` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `case_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `user_id` (`user_id`,`case_id`) USING BTREE,
  KEY `case_id` (`case_id`) USING BTREE,
  CONSTRAINT `user_case_favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `user_case_favorites_ibfk_2` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 user_departments
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_departments`;

CREATE TABLE `user_departments` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `department_id` int NOT NULL COMMENT '部门ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_department` (`user_id`,`department_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_department_id` (`department_id`) USING BTREE,
  CONSTRAINT `fk_user_departments_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_departments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='用户部门关联表';

LOCK TABLES `user_departments` WRITE;
/*!40000 ALTER TABLE `user_departments` DISABLE KEYS */;

INSERT INTO `user_departments` (`id`, `user_id`, `department_id`, `created_at`)
VALUES
	(204,37,18,'2026-03-03 08:29:19'),
	(205,37,29,'2026-03-03 08:29:19'),
	(206,37,24,'2026-03-03 08:29:19'),
	(207,37,25,'2026-03-03 08:29:19'),
	(208,37,26,'2026-03-03 08:29:19'),
	(209,37,27,'2026-03-03 08:29:19'),
	(210,37,28,'2026-03-03 08:29:19');

/*!40000 ALTER TABLE `user_departments` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 user_notification_settings
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_notification_settings`;

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
  PRIMARY KEY (`user_id`) USING BTREE,
  CONSTRAINT `user_notification_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;



# 转储表 user_roles
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_roles`;

CREATE TABLE `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `role_id` int NOT NULL COMMENT '角色ID',
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
  `assigned_by` int DEFAULT NULL COMMENT '分配人ID',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_role` (`user_id`,`role_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_role_id` (`role_id`) USING BTREE,
  KEY `idx_assigned_by` (`assigned_by`) USING BTREE,
  CONSTRAINT `fk_user_roles_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='用户角色关联表';

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;

INSERT INTO `user_roles` (`id`, `user_id`, `role_id`, `assigned_at`, `assigned_by`)
VALUES
	(53,37,33,'2026-01-15 15:45:37',NULL);

/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 user_settings
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_settings`;

CREATE TABLE `user_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `message_notification` tinyint(1) NOT NULL DEFAULT '1',
  `sound_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `do_not_disturb_start` time DEFAULT NULL,
  `do_not_disturb_end` time DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_id` (`user_id`) USING BTREE,
  CONSTRAINT `fk_user_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;



# 转储表 users
# ------------------------------------------------------------

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户唯一标识ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户登录名',
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '密码哈希值',
  `real_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '真实姓名',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱地址',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '手机号码',
  `avatar` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_id` int DEFAULT NULL COMMENT '所属部门ID',
  `status` enum('active','inactive','pending','resigned','deleted') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `approval_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '审批备注',
  `last_login` datetime DEFAULT NULL COMMENT '最后登录时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `session_token` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '会话token',
  `session_created_at` datetime DEFAULT NULL COMMENT '会话创建时间',
  `is_department_manager` tinyint(1) DEFAULT '0' COMMENT '是否为部门主管',
  `id_card_front_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '身份证正面图片URL',
  `id_card_back_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '身份证反面图片URL',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_username` (`username`) USING BTREE,
  UNIQUE KEY `uk_email` (`email`) USING BTREE,
  UNIQUE KEY `uk_phone` (`phone`) USING BTREE,
  KEY `idx_department_id` (`department_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  KEY `idx_dept_status` (`department_id`,`status`) USING BTREE,
  KEY `idx_session_token` (`session_token`) USING BTREE,
  KEY `idx_real_name` (`real_name`),
  CONSTRAINT `fk_users_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='用户表-存储系统用户基本信息';

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;

INSERT INTO `users` (`id`, `username`, `password_hash`, `real_name`, `email`, `phone`, `avatar`, `department_id`, `status`, `approval_note`, `last_login`, `created_at`, `updated_at`, `session_token`, `session_created_at`, `is_department_manager`, `id_card_front_url`, `id_card_back_url`)
VALUES
	(37,'admin','$2b$10$Gg7I/ImQq/BdLJpaHHVTC.ASi5QcoQg9JymoZJqfaT/O2O.Jz1tQG','河北雷犀 ','admin@leixi.com','13800000000','avatar/20260302122849-bzocro99.png',24,'active',NULL,'2026-03-02 09:38:47','2026-01-11 17:22:43','2026-03-04 09:03:58','v0g9hnvuptemm8ify07','2026-03-02 09:38:47',1,'id_cards/20260304090352-uxbckq6g.png','id_cards/20260304090356-e7p6pwni.png');

/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 vacation_audit_logs
# ------------------------------------------------------------

DROP TABLE IF EXISTS `vacation_audit_logs`;

CREATE TABLE `vacation_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `operation_type` enum('leave_apply','leave_approve','leave_reject','overtime_apply','overtime_approve','compensatory_request','compensatory_approve','balance_adjust','overtime_convert') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '操作类型',
  `operation_detail` json DEFAULT NULL COMMENT '操作详情(JSON格式)',
  `balance_before` json DEFAULT NULL COMMENT '操作前余额快照',
  `balance_after` json DEFAULT NULL COMMENT '操作后余额快照',
  `operator_id` int DEFAULT NULL COMMENT '操作人ID',
  `ip_address` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT 'IP地址',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_employee_id` (`employee_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_operation_type` (`operation_type`) USING BTREE,
  KEY `idx_operator_id` (`operator_id`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='假期操作审计日志';



# 转储表 vacation_balance_changes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `vacation_balance_changes`;

CREATE TABLE `vacation_balance_changes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL COMMENT '员工ID',
  `year` int NOT NULL COMMENT '年份',
  `change_type` enum('addition','deduction','conversion','adjustment') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '变更类型',
  `leave_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '假期类型',
  `amount` decimal(5,2) NOT NULL COMMENT '变更数量（正数为增加，负数为扣减）',
  `balance_before` decimal(5,2) DEFAULT NULL COMMENT '变更前余额',
  `balance_after` decimal(5,2) DEFAULT NULL COMMENT '变更后余额',
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '变更原因',
  `reference_id` int DEFAULT NULL COMMENT '关联ID（审批单号/转换记录ID）',
  `reference_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '关联类型（leave_request/overtime_conversion/manual_adjustment）',
  `approval_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '审批单号',
  `created_by` int DEFAULT NULL COMMENT '操作人ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_employee_year` (`employee_id`,`year`) USING BTREE,
  KEY `idx_change_type` (`change_type`) USING BTREE,
  KEY `idx_reference` (`reference_type`,`reference_id`) USING BTREE,
  KEY `idx_created_at` (`created_at`) USING BTREE,
  CONSTRAINT `vacation_balance_changes_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='假期余额变更历史表';



# 转储表 vacation_balances
# ------------------------------------------------------------

DROP TABLE IF EXISTS `vacation_balances`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `unique_employee_year` (`employee_id`,`year`) USING BTREE,
  KEY `idx_user_year` (`user_id`,`year`) USING BTREE,
  KEY `idx_year` (`year`) USING BTREE,
  KEY `idx_expiry_date` (`expiry_date`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='假期余额表';

LOCK TABLES `vacation_balances` WRITE;
/*!40000 ALTER TABLE `vacation_balances` DISABLE KEYS */;

INSERT INTO `vacation_balances` (`id`, `employee_id`, `user_id`, `year`, `annual_leave_total`, `annual_leave_used`, `sick_leave_total`, `sick_leave_used`, `compensatory_leave_total`, `compensatory_leave_used`, `overtime_leave_total`, `overtime_leave_used`, `overtime_hours_total`, `overtime_hours_converted`, `created_at`, `updated_at`, `total_days`, `last_updated`, `expiry_date`)
VALUES
	(9,21,37,2026,5.00,0.00,10.00,0.00,0.00,0.00,0.0,0.0,0.00,0.00,'2026-01-30 13:43:52','2026-01-30 13:43:52',0.00,'2026-01-30 13:43:52',NULL);

/*!40000 ALTER TABLE `vacation_balances` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 vacation_conversions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `vacation_conversions`;

CREATE TABLE `vacation_conversions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '转换记录ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `source_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'overtime' COMMENT '来源类型：overtime-加班',
  `source_hours` decimal(10,2) DEFAULT NULL COMMENT '来源小时数（如加班时长）',
  `converted_days` decimal(10,2) NOT NULL COMMENT '转换获得的天数',
  `remaining_days` decimal(10,2) NOT NULL COMMENT '剩余可用天数',
  `conversion_ratio` decimal(10,4) DEFAULT NULL COMMENT '转换比例',
  `conversion_rule_id` int DEFAULT NULL COMMENT '使用的转换规则ID',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '备注',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_employee` (`employee_id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='假期转换记录表';



# 转储表 vacation_settings
# ------------------------------------------------------------

DROP TABLE IF EXISTS `vacation_settings`;

CREATE TABLE `vacation_settings` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `setting_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '配置键',
  `setting_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '配置值',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '配置说明',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `setting_key` (`setting_key`) USING BTREE,
  KEY `idx_setting_key` (`setting_key`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='假期系统配置';



# 转储表 vacation_type_balances
# ------------------------------------------------------------

DROP TABLE IF EXISTS `vacation_type_balances`;

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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `unique_employee_year_type` (`employee_id`,`year`,`vacation_type_id`) USING BTREE,
  KEY `idx_employee_year` (`employee_id`,`year`) USING BTREE,
  KEY `idx_vacation_type` (`vacation_type_id`) USING BTREE,
  CONSTRAINT `vacation_type_balances_ibfk_1` FOREIGN KEY (`vacation_type_id`) REFERENCES `vacation_types` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

LOCK TABLES `vacation_type_balances` WRITE;
/*!40000 ALTER TABLE `vacation_type_balances` DISABLE KEYS */;

INSERT INTO `vacation_type_balances` (`id`, `employee_id`, `user_id`, `year`, `vacation_type_id`, `total_days`, `used_days`, `created_at`, `updated_at`, `conversion_date`, `remaining_carryover_days`)
VALUES
	(289,21,37,2026,60,0.00,0.00,'2026-02-25 16:46:37','2026-02-25 16:46:37','2026-02-25',0.00),
	(290,21,37,2026,66,0.00,0.00,'2026-02-25 16:46:37','2026-02-25 16:46:37','2026-02-25',0.00),
	(291,21,37,2026,67,0.00,0.00,'2026-02-25 16:46:37','2026-02-25 16:46:37','2026-02-25',0.00),
	(292,21,37,2026,63,0.00,0.00,'2026-02-25 16:46:37','2026-02-25 16:46:37','2026-02-25',0.00),
	(293,21,37,2026,64,0.00,0.00,'2026-02-25 16:46:37','2026-02-25 16:46:37','2026-02-25',0.00),
	(294,21,37,2026,68,1.00,0.00,'2026-02-25 16:46:37','2026-02-26 14:10:48','2026-02-26',0.00),
	(295,21,37,2026,65,0.00,0.00,'2026-02-25 16:46:37','2026-02-25 16:46:37','2026-02-25',0.00),
	(296,21,37,2026,62,0.00,0.00,'2026-02-25 16:46:37','2026-02-25 16:46:37','2026-02-25',0.00),
	(297,21,37,2026,61,0.00,0.00,'2026-02-25 16:46:37','2026-02-25 16:46:37','2026-02-25',0.00),
	(298,21,37,2026,71,3.00,0.00,'2026-02-26 14:10:48','2026-02-26 14:10:48','2026-02-26',0.00),
	(299,21,37,2026,72,3.00,0.00,'2026-02-26 14:10:48','2026-02-26 14:10:48','2026-02-26',0.00),
	(300,21,37,2026,73,7.00,0.00,'2026-02-26 14:10:48','2026-02-26 14:10:48','2026-02-26',0.00),
	(301,21,37,2026,70,3.00,0.00,'2026-02-26 14:10:48','2026-02-26 14:10:48','2026-02-26',0.00),
	(302,21,37,2026,69,7.00,0.00,'2026-02-26 14:10:48','2026-02-26 14:10:48','2026-02-26',0.00);

/*!40000 ALTER TABLE `vacation_type_balances` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 vacation_types
# ------------------------------------------------------------

DROP TABLE IF EXISTS `vacation_types`;

CREATE TABLE `vacation_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型代码',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型名称',
  `base_days` decimal(5,2) DEFAULT '0.00' COMMENT '基准天数',
  `included_in_total` tinyint(1) DEFAULT '1' COMMENT '是否计入总额度',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '描述',
  `enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_pinned` tinyint(1) DEFAULT '0' COMMENT '是否置顶',
  `sort_order` int DEFAULT '999' COMMENT '排序号',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE,
  KEY `idx_code` (`code`) USING BTREE,
  KEY `idx_enabled` (`enabled`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='假期类型表';

LOCK TABLES `vacation_types` WRITE;
/*!40000 ALTER TABLE `vacation_types` DISABLE KEYS */;

INSERT INTO `vacation_types` (`id`, `code`, `name`, `base_days`, `included_in_total`, `description`, `enabled`, `created_at`, `updated_at`, `is_pinned`, `sort_order`)
VALUES
	(60,'annual','年假',5.00,1,'法定年休假',1,'2025-12-28 23:29:09','2025-12-28 23:29:14',0,1),
	(61,'sick','病假',12.00,1,'因病请假',1,'2025-12-28 23:29:09','2025-12-28 23:29:09',0,2),
	(62,'personal','事假',0.00,0,'因私事请假',1,'2025-12-28 23:29:09','2025-12-28 23:29:09',0,3),
	(63,'marriage','婚假',3.00,0,'结婚请假',1,'2025-12-28 23:29:09','2025-12-28 23:29:09',0,4),
	(64,'maternity','产假',98.00,0,'生育请假',1,'2025-12-28 23:29:09','2025-12-28 23:29:09',0,5),
	(65,'paternity','陪产假',15.00,0,'陪护妻子生育',1,'2025-12-28 23:29:09','2025-12-28 23:29:09',0,6),
	(66,'bereavement','丧假',3.00,0,'直系亲属去世',1,'2025-12-28 23:29:09','2025-12-28 23:29:09',0,7),
	(67,'compensatory','调休',0.00,1,'加班调休',1,'2025-12-28 23:29:09','2025-12-28 23:29:15',0,8),
	(68,'new_year','元旦',1.00,0,'元旦假期',1,'2026-01-14 09:50:38','2026-01-14 09:50:38',0,9),
	(69,'spring_festival','春节',7.00,0,'春节假期',1,'2026-02-25 16:46:47','2026-02-25 16:46:47',0,10),
	(70,'qingming','清明节',3.00,0,'清明节假期',1,'2026-02-25 16:46:48','2026-02-25 16:46:48',0,11),
	(71,'dragon_boat','端午节',3.00,0,'端午节假期',1,'2026-02-25 16:46:51','2026-02-25 16:46:51',0,12),
	(72,'mid_autumn','中秋节',3.00,0,'中秋节假期',1,'2026-02-25 16:46:51','2026-02-25 16:46:51',0,13),
	(73,'national_day','国庆节',7.00,0,'国庆节假期',1,'2026-02-25 16:46:52','2026-02-25 16:46:52',0,14);

/*!40000 ALTER TABLE `vacation_types` ENABLE KEYS */;
UNLOCK TABLES;


# 转储表 work_shifts
# ------------------------------------------------------------

DROP TABLE IF EXISTS `work_shifts`;

CREATE TABLE `work_shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '班次名称',
  `start_time` time NOT NULL COMMENT '上班时间',
  `end_time` time NOT NULL COMMENT '下班时间',
  `work_hours` decimal(3,1) NOT NULL COMMENT '工作时长',
  `rest_duration` int DEFAULT '60' COMMENT '休息时长（分钟）',
  `late_threshold` int DEFAULT NULL COMMENT '迟到阈值（分钟）',
  `early_threshold` int DEFAULT NULL COMMENT '早退阈值（分钟）',
  `use_global_threshold` tinyint(1) DEFAULT '0' COMMENT '是否使用全局阈值',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `department_id` int DEFAULT NULL COMMENT '部门ID（NULL表示全公司通用）',
  `description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '班次描述',
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '#3B82F6',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_is_active` (`is_active`) USING BTREE,
  KEY `idx_department` (`department_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='班次表';

LOCK TABLES `work_shifts` WRITE;
/*!40000 ALTER TABLE `work_shifts` DISABLE KEYS */;

INSERT INTO `work_shifts` (`id`, `name`, `start_time`, `end_time`, `work_hours`, `rest_duration`, `late_threshold`, `early_threshold`, `use_global_threshold`, `is_active`, `created_at`, `updated_at`, `department_id`, `description`, `color`)
VALUES
	(20,'休息','00:00:00','00:00:00',0.0,60,0,0,0,1,'2025-12-25 14:02:34','2025-12-25 14:02:34',NULL,'休息日班次','#9CA3AF'),
	(21,'测试班级 1','11:00:00','12:00:00',0.8,10,30,30,0,1,'2025-12-28 11:08:16','2026-03-03 10:23:33',NULL,'发生的','#8E44AD');

/*!40000 ALTER TABLE `work_shifts` ENABLE KEYS */;
UNLOCK TABLES;


# 导出视图 employee_work_duration
# ------------------------------------------------------------

DROP TABLE IF EXISTS `employee_work_duration`; DROP VIEW IF EXISTS `employee_work_duration`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `employee_work_duration`
AS SELECT
   `u`.`id` AS `employee_id`,
   `u`.`username` AS `username`,
   `u`.`real_name` AS `real_name`,
   `e`.`hire_date` AS `hire_date`,(case when (`u`.`status` = 'active') then (to_days(curdate()) - to_days(`e`.`hire_date`)) else (select coalesce(max(`esr`.`work_duration_days`),(to_days(curdate()) - to_days(`e`.`hire_date`)))
FROM `employee_status_records` `esr` where ((`esr`.`employee_id` = `u`.`id`) and (`esr`.`new_status` in ('inactive','resigned')))) end) AS `total_work_days`,`u`.`status` AS `current_status`,`u`.`department_id` AS `current_department_id`,`d`.`name` AS `current_department_name` from ((`users` `u` left join `employees` `e` on((`u`.`id` = `e`.`user_id`))) left join `departments` `d` on((`u`.`department_id` = `d`.`id`))) where (`e`.`user_id` is not null);


/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
