-- ==========================================
-- 客服管理系统 - 数据库初始化脚本
-- 生成时间: 2025-11-30
-- 说明: 完整的数据库表结构定义
-- ==========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS leixin_customer_service DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE leixin_customer_service;

-- 设置SQL模式
SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION';

-- 禁用外键检查
SET FOREIGN_KEY_CHECKS = 0;

-- ==========================================
-- 删除所有表（如果存在）
-- ==========================================
DROP TABLE IF EXISTS `quality_message_tags`;
DROP TABLE IF EXISTS `quality_session_tags`;
DROP TABLE IF EXISTS `session_messages`;
DROP TABLE IF EXISTS `quality_scores`;
DROP TABLE IF EXISTS `quality_sessions`;
DROP TABLE IF EXISTS `quality_rules`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `shops`;
DROP TABLE IF EXISTS `platforms`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `tag_categories`;
DROP TABLE IF EXISTS `positions`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `role_departments`;
DROP TABLE IF EXISTS `employees`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `departments`;

-- ==========================================
-- 基础表结构
-- ==========================================

-- 表: departments (部门表)
CREATE TABLE `departments` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '部门唯一标识ID',
  `name` VARCHAR(50) NOT NULL COMMENT '部门名称',
  `parent_id` INT DEFAULT NULL COMMENT '父部门ID，支持多级部门',
  `description` TEXT COMMENT '部门描述',
  `manager_id` INT DEFAULT NULL COMMENT '部门经理用户ID',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '部门状态',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序号',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_manager_id` (`manager_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门表-存储组织架构信息';

-- 表: users (用户表)
CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '用户唯一标识ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户登录名',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希值',
  `real_name` VARCHAR(50) NOT NULL COMMENT '真实姓名',
  `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱地址',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号码',
  `avatar` TEXT COMMENT '头像(Base64或URL)',
  `department_id` INT DEFAULT NULL COMMENT '所属部门ID',
  `status` ENUM('active', 'inactive', 'pending') NOT NULL DEFAULT 'pending' COMMENT '用户状态',
  `last_login` DATETIME DEFAULT NULL COMMENT '最后登录时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `session_token` VARCHAR(500) DEFAULT NULL COMMENT '会话token',
  `session_created_at` DATETIME DEFAULT NULL COMMENT '会话创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_dept_status` (`department_id`, `status`),
  KEY `idx_session_token` (`session_token`),
  CONSTRAINT `fk_users_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表-存储系统用户基本信息';

-- 添加部门表的manager_id外键约束
ALTER TABLE `departments`
ADD CONSTRAINT `fk_departments_manager_id` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
ADD CONSTRAINT `fk_departments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;

-- 表: roles (角色表)
CREATE TABLE `roles` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '角色唯一标识ID',
  `name` VARCHAR(50) NOT NULL COMMENT '角色名称',
  `description` TEXT COMMENT '角色描述',
  `level` INT NOT NULL DEFAULT 1 COMMENT '角色级别',
  `is_system` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否系统内置角色',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_level` (`level`),
  KEY `idx_is_system` (`is_system`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表-定义系统角色';

-- 表: permissions (权限表)
CREATE TABLE `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '权限唯一标识ID',
  `name` VARCHAR(50) NOT NULL COMMENT '权限名称',
  `code` VARCHAR(50) NOT NULL COMMENT '权限代码',
  `resource` VARCHAR(50) NOT NULL COMMENT '资源名称',
  `action` VARCHAR(50) NOT NULL COMMENT '操作类型',
  `description` TEXT COMMENT '权限描述',
  `module` VARCHAR(50) NOT NULL COMMENT '所属模块',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_resource` (`resource`),
  KEY `idx_action` (`action`),
  KEY `idx_module` (`module`),
  KEY `idx_resource_action` (`resource`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表-定义系统权限';

-- 表: user_roles (用户角色关联表)
CREATE TABLE `user_roles` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `role_id` INT NOT NULL COMMENT '角色ID',
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
  `assigned_by` INT DEFAULT NULL COMMENT '分配人ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`, `role_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_assigned_by` (`assigned_by`),
  CONSTRAINT `fk_user_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

-- 表: role_permissions (角色权限关联表)
CREATE TABLE `role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `role_id` INT NOT NULL COMMENT '角色ID',
  `permission_id` INT NOT NULL COMMENT '权限ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permission` (`role_id`, `permission_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_permission_id` (`permission_id`),
  CONSTRAINT `fk_role_permissions_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限关联表';

-- 表: role_departments (角色部门关联表)
CREATE TABLE `role_departments` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `role_id` INT NOT NULL COMMENT '角色ID',
  `department_id` INT NOT NULL COMMENT '部门ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_department` (`role_id`, `department_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_department_id` (`department_id`),
  CONSTRAINT `fk_role_departments_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_departments_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色部门关联表';

-- 表: employees (员工表)
CREATE TABLE `employees` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '员工记录ID',
  `user_id` INT NOT NULL COMMENT '关联用户ID',
  `employee_no` VARCHAR(20) NOT NULL COMMENT '员工工号',
  `position` VARCHAR(50) DEFAULT NULL COMMENT '职位名称',
  `hire_date` DATE NOT NULL COMMENT '入职日期',
  `salary` DECIMAL(10,2) DEFAULT NULL COMMENT '基本薪资',
  `status` ENUM('active', 'inactive', 'resigned') NOT NULL DEFAULT 'active' COMMENT '员工状态',
  `emergency_contact` VARCHAR(50) DEFAULT NULL COMMENT '紧急联系人',
  `emergency_phone` VARCHAR(20) DEFAULT NULL COMMENT '紧急联系电话',
  `address` VARCHAR(200) DEFAULT NULL COMMENT '家庭住址',
  `education` VARCHAR(20) DEFAULT NULL COMMENT '学历',
  `skills` TEXT COMMENT '技能特长',
  `remark` TEXT COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `rating` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '员工星级评定',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_employee_no` (`employee_no`),
  KEY `idx_position` (`position`),
  KEY `idx_hire_date` (`hire_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_employees_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='员工信息表';

-- 表: positions (职位表)
CREATE TABLE `positions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '职位ID',
  `name` VARCHAR(100) NOT NULL COMMENT '职位名称',
  `department_id` INT NOT NULL COMMENT '所属部门ID',
  `description` TEXT COMMENT '职位描述',
  `requirements` TEXT COMMENT '任职要求',
  `responsibilities` TEXT COMMENT '工作职责',
  `salary_min` DECIMAL(10,2) DEFAULT NULL COMMENT '最低薪资',
  `salary_max` DECIMAL(10,2) DEFAULT NULL COMMENT '最高薪资',
  `level` ENUM('junior', 'middle', 'senior', 'expert') DEFAULT 'junior' COMMENT '职位级别',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` INT DEFAULT NULL COMMENT '创建人ID',
  `updated_by` INT DEFAULT NULL COMMENT '更新人ID',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序号',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_position_dept` (`name`, `department_id`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_status` (`status`),
  KEY `idx_level` (`level`),
  KEY `idx_name` (`name`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `fk_positions_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_positions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_positions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='职位表';

-- ==========================================
-- 平台和店铺相关表
-- ==========================================

-- 表: platforms (平台表)
CREATE TABLE `platforms` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '平台ID',
  `name` VARCHAR(255) NOT NULL COMMENT '平台名称',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台表';

-- 表: shops (店铺表)
CREATE TABLE `shops` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '店铺ID',
  `name` VARCHAR(255) NOT NULL COMMENT '店铺名称',
  `platform_id` INT NOT NULL COMMENT '所属平台ID',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `platform_id` (`platform_id`),
  CONSTRAINT `fk_shops_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店铺表';

-- 表: customers (客户表)
CREATE TABLE `customers` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '客户ID',
  `customer_id` VARCHAR(50) NOT NULL COMMENT '客户ID（外部系统）',
  `name` VARCHAR(100) DEFAULT NULL COMMENT '客户姓名',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
  `email` VARCHAR(100) DEFAULT NULL COMMENT '电子邮箱',
  `platform_id` INT DEFAULT NULL COMMENT '所属平台ID',
  `shop_id` INT DEFAULT NULL COMMENT '所属店铺ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_platform_shop` (`customer_id`, `platform_id`, `shop_id`),
  KEY `idx_name` (`name`),
  KEY `idx_phone` (`phone`),
  KEY `idx_platform_shop` (`platform_id`, `shop_id`),
  CONSTRAINT `fk_customers_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customers_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户表';

-- ==========================================
-- 质检标签相关表
-- ==========================================

-- 表: tag_categories (标签分类表)
CREATE TABLE `tag_categories` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '标签分类ID',
  `parent_id` INT DEFAULT NULL COMMENT '父分类ID',
  `level` INT NOT NULL DEFAULT 0 COMMENT '分类层级',
  `path` VARCHAR(500) DEFAULT NULL COMMENT '分类路径',
  `name` VARCHAR(50) NOT NULL COMMENT '分类名称',
  `description` TEXT COMMENT '分类描述',
  `color` VARCHAR(7) DEFAULT NULL COMMENT '分类颜色',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序号',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_level` (`level`),
  KEY `idx_path` (`path`(255)),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_tag_categories_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tag_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签分类表-支持无限极分类';

-- 表: tags (标签表)
CREATE TABLE `tags` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '标签ID',
  `parent_id` INT DEFAULT NULL COMMENT '父标签ID',
  `level` INT NOT NULL DEFAULT 0 COMMENT '标签层级',
  `path` VARCHAR(500) DEFAULT NULL COMMENT '标签路径',
  `name` VARCHAR(50) NOT NULL COMMENT '标签名称',
  `tag_type` ENUM('quality', 'case', 'general') NOT NULL DEFAULT 'general' COMMENT '标签类型',
  `category_id` INT DEFAULT NULL COMMENT '所属分类ID',
  `color` VARCHAR(7) DEFAULT NULL COMMENT '标签颜色',
  `description` TEXT COMMENT '标签描述',
  `usage_count` INT NOT NULL DEFAULT 0 COMMENT '使用次数',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_level` (`level`),
  KEY `idx_path` (`path`(255)),
  KEY `idx_name` (`name`),
  KEY `idx_tag_type` (`tag_type`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_usage_count` (`usage_count`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_tags_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tags_category_id` FOREIGN KEY (`category_id`) REFERENCES `tag_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签表-支持无限极分类';

-- ==========================================
-- 质检相关表
-- ==========================================

-- 表: quality_rules (质检规则表)
CREATE TABLE `quality_rules` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '质检规则ID',
  `name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `category` VARCHAR(50) NOT NULL COMMENT '规则分类',
  `description` TEXT COMMENT '规则描述',
  `criteria` JSON NOT NULL COMMENT '评判标准',
  `score_weight` DECIMAL(5,2) NOT NULL COMMENT '分数权重',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_by` INT DEFAULT NULL COMMENT '创建人ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_category` (`category`),
  KEY `idx_score_weight` (`score_weight`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_quality_rules_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检规则表';

-- 表: quality_sessions (质检会话表)
CREATE TABLE `quality_sessions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '质检会话ID',
  `session_no` VARCHAR(50) NOT NULL COMMENT '会话编号',
  `agent_id` INT DEFAULT NULL COMMENT '客服人员ID（系统用户）',
  `agent_name` VARCHAR(100) DEFAULT NULL COMMENT '客服姓名（导入数据）',
  `customer_id` VARCHAR(50) DEFAULT NULL COMMENT '客户ID',
  `customer_name` VARCHAR(100) DEFAULT NULL COMMENT '客户姓名',
  `channel` ENUM('chat', 'phone', 'email', 'video') NOT NULL DEFAULT 'chat' COMMENT '沟通渠道',
  `start_time` DATETIME NOT NULL COMMENT '会话开始时间',
  `end_time` DATETIME NOT NULL COMMENT '会话结束时间',
  `duration` INT NOT NULL COMMENT '会话时长（秒）',
  `message_count` INT NOT NULL DEFAULT 0 COMMENT '消息总数',
  `status` ENUM('pending', 'in_review', 'completed', 'disputed') NOT NULL DEFAULT 'pending' COMMENT '质检状态',
  `inspector_id` INT DEFAULT NULL COMMENT '质检员ID',
  `score` DECIMAL(5,2) DEFAULT NULL COMMENT '质检总分',
  `grade` ENUM('excellent', 'good', 'average', 'poor') DEFAULT NULL COMMENT '质检等级',
  `comment` TEXT COMMENT '质检评语',
  `reviewed_at` DATETIME DEFAULT NULL COMMENT '质检完成时间',
  `platform_id` INT DEFAULT NULL COMMENT '平台ID',
  `shop_id` INT DEFAULT NULL COMMENT '店铺ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
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
  KEY `idx_platform_id` (`platform_id`),
  KEY `idx_shop_id` (`shop_id`),
  KEY `idx_time_range` (`start_time`, `end_time`),
  KEY `idx_agent_time_status` (`agent_id`, `start_time`, `status`),
  CONSTRAINT `fk_quality_sessions_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quality_sessions_inspector_id` FOREIGN KEY (`inspector_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quality_sessions_platform_id` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quality_sessions_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检会话表';

-- 表: quality_scores (质检评分表)
CREATE TABLE `quality_scores` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '评分记录ID',
  `session_id` INT NOT NULL COMMENT '会话ID',
  `rule_id` INT NOT NULL COMMENT '规则ID',
  `score` DECIMAL(5,2) NOT NULL COMMENT '得分',
  `max_score` DECIMAL(5,2) NOT NULL COMMENT '满分',
  `comment` TEXT COMMENT '评分说明',
  `created_by` INT DEFAULT NULL COMMENT '评分人ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_rule` (`session_id`, `rule_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_rule_id` (`rule_id`),
  KEY `idx_score` (`score`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_quality_scores_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_scores_rule_id` FOREIGN KEY (`rule_id`) REFERENCES `quality_rules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_scores_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检评分表';

-- 表: session_messages (会话消息表)
CREATE TABLE `session_messages` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  `session_id` INT NOT NULL COMMENT '所属会话ID',
  `sender_type` ENUM('agent', 'customer', 'system') NOT NULL COMMENT '发送者类型',
  `sender_id` VARCHAR(50) NOT NULL COMMENT '发送者ID',
  `content` TEXT NOT NULL COMMENT '消息内容',
  `content_type` ENUM('text', 'image', 'file', 'audio', 'video') NOT NULL DEFAULT 'text' COMMENT '内容类型',
  `timestamp` DATETIME NOT NULL COMMENT '消息时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_sender_type` (`sender_type`),
  KEY `idx_sender_id` (`sender_id`),
  KEY `idx_content_type` (`content_type`),
  KEY `idx_timestamp` (`timestamp`),
  CONSTRAINT `fk_session_messages_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话消息表';

-- 表: quality_session_tags (质检会话标签关联表)
CREATE TABLE `quality_session_tags` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `session_id` INT NOT NULL COMMENT '质检会话ID',
  `tag_id` INT NOT NULL COMMENT '标签ID',
  `created_by` INT DEFAULT NULL COMMENT '创建人ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_tag` (`session_id`, `tag_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_tag_id` (`tag_id`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_quality_session_tags_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_session_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_session_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检会话标签关联表';

-- 表: quality_message_tags (质检消息标签关联表)
CREATE TABLE `quality_message_tags` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联记录ID',
  `message_id` INT NOT NULL COMMENT '消息ID',
  `tag_id` INT NOT NULL COMMENT '标签ID',
  `created_by` INT DEFAULT NULL COMMENT '创建人ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_tag` (`message_id`, `tag_id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_tag_id` (`tag_id`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_quality_message_tags_message_id` FOREIGN KEY (`message_id`) REFERENCES `session_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_message_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_message_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检消息标签关联表';

-- 启用外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- 插入系统必需的初始数据
-- ==========================================

-- 1. 插入管理部门
INSERT INTO `departments` (`name`, `parent_id`, `description`, `status`, `sort_order`, `created_at`) VALUES
('管理部', NULL, '系统管理部门，负责系统管理和维护', 'active', 1, NOW());

-- 获取管理部门ID
SET @admin_dept_id = LAST_INSERT_ID();

-- 2. 插入超级管理员角色
INSERT INTO `roles` (`name`, `description`, `level`, `is_system`, `created_at`) VALUES
('超级管理员', '系统最高权限角色，拥有所有功能的访问和管理权限', 100, 1, NOW());

-- 获取超级管理员角色ID
SET @admin_role_id = LAST_INSERT_ID();

-- 3. 插入管理员用户
-- 密码: admin123 (使用bcrypt加密)
INSERT INTO `users` (`username`, `password_hash`, `real_name`, `email`, `phone`, `department_id`, `status`, `created_at`) VALUES
('admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员', 'admin@leixi.com', '13800138000', @admin_dept_id, 'active', NOW());

-- 获取管理员用户ID
SET @admin_user_id = LAST_INSERT_ID();

-- 4. 关联管理员用户和角色
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES
(@admin_user_id, @admin_role_id, NOW());

-- 5. 插入管理员员工信息
INSERT INTO `employees` (`user_id`, `employee_no`, `position`, `hire_date`, `status`, `created_at`) VALUES
(@admin_user_id, 'ADMIN001', '系统管理员', CURDATE(), 'active', NOW());

-- 6. 插入系统管理员职位
INSERT INTO `positions` (`name`, `department_id`, `description`, `requirements`, `responsibilities`, `salary_min`, `salary_max`, `level`, `status`, `sort_order`, `created_at`) VALUES
('系统管理员', @admin_dept_id, '系统最高管理职位，负责系统维护和管理', '熟悉系统管理，具备技术背景', '系统维护、用户管理、权限配置', 15000.00, 30000.00, 'expert', 'active', 1, NOW());

-- 输出确认信息
SELECT '数据库初始化完成' AS 'Status';
SELECT '默认管理员账号: admin' AS 'Username', 'admin123' AS 'Password';
