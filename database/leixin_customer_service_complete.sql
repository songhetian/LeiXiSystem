-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: leixin_customer_service
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `leixin_customer_service`
--

/*!40000 DROP DATABASE IF EXISTS `leixin_customer_service`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `leixin_customer_service` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `leixin_customer_service`;

--
-- Table structure for table `answer_records`
--

DROP TABLE IF EXISTS `answer_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `answer_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '答题记录唯一标识ID',
  `result_id` int NOT NULL COMMENT '考核结果ID，关联assessment_results表，级联删除',
  `question_id` int NOT NULL COMMENT '题目ID，关联questions表，级联删除',
  `user_answer` text COLLATE utf8mb4_unicode_ci COMMENT '用户答案，根据题型格式不同',
  `is_correct` tinyint(1) DEFAULT NULL COMMENT '是否正确：1-正确，0-错误，NULL-未评分',
  `score` decimal(5,2) DEFAULT NULL COMMENT '该题得分',
  `time_spent` int DEFAULT NULL COMMENT '答题用时，单位秒',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_result_question` (`result_id`,`question_id`),
  KEY `idx_result_id` (`result_id`),
  KEY `idx_question_id` (`question_id`),
  KEY `idx_is_correct` (`is_correct`),
  KEY `idx_score` (`score`),
  KEY `idx_time_spent` (`time_spent`),
  CONSTRAINT `fk_answer_records_question_id` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_answer_records_result_id` FOREIGN KEY (`result_id`) REFERENCES `assessment_results` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='答题记录表-存储用户的具体答题记录';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `answer_records`
--

LOCK TABLES `answer_records` WRITE;
/*!40000 ALTER TABLE `answer_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `answer_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `article_comments`
--

DROP TABLE IF EXISTS `article_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `article_comments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  `article_id` bigint unsigned NOT NULL COMMENT '文章ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `parent_id` bigint unsigned DEFAULT NULL COMMENT '父评论ID',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '评论内容',
  `like_count` int NOT NULL DEFAULT '0' COMMENT '点赞数',
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否置顶',
  `status` enum('active','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '评论状态',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `article_comments`
--

LOCK TABLES `article_comments` WRITE;
/*!40000 ALTER TABLE `article_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `article_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `article_likes`
--

DROP TABLE IF EXISTS `article_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `article_likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `article_id` int NOT NULL,
  `user_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_like` (`article_id`,`user_id`),
  KEY `idx_article` (`article_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `article_likes`
--

LOCK TABLES `article_likes` WRITE;
/*!40000 ALTER TABLE `article_likes` DISABLE KEYS */;
INSERT INTO `article_likes` VALUES (1,3,'anonymous','2025-11-11 15:56:00');
/*!40000 ALTER TABLE `article_likes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_plans`
--

DROP TABLE IF EXISTS `assessment_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_plans` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '考核计划唯一标识ID',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '计划标题，如"2024年第一季度考核"',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '计划详细描述，说明考核目的和要求',
  `exam_id` int NOT NULL COMMENT '关联的试卷ID，关联exams表，级联删除',
  `target_users` json DEFAULT NULL COMMENT '目标用户列表，JSON格式存储用户ID数组',
  `start_time` datetime NOT NULL COMMENT '考核开始时间',
  `end_time` datetime NOT NULL COMMENT '考核结束时间',
  `max_attempts` int NOT NULL DEFAULT '1' COMMENT '最大尝试次数，防止无限重考',
  `status` enum('draft','published','ongoing','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '计划状态：draft-草稿，published-已发布，ongoing-进行中，completed-已完成，cancelled-已取消',
  `created_by` int DEFAULT NULL COMMENT '创建人用户ID，关联users表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
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
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='考核计划表-存储考核计划的安排和配置信息';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_plans`
--

LOCK TABLES `assessment_plans` WRITE;
/*!40000 ALTER TABLE `assessment_plans` DISABLE KEYS */;
INSERT INTO `assessment_plans` VALUES (1,'2024年第一季度新员工入职考核','针对2024年第一季度入职的新员工进行基础知识考核',2,'[1, 2, 3, 4, 5]','2024-01-01 09:00:00','2024-03-31 18:00:00',2,'completed',1,'2025-11-14 14:04:06','2025-11-14 14:04:06'),(2,'客服技能提升培训考核','针对在职客服人员的技能提升培训考核',2,'[1, 2, 3, 4, 5, 6, 7, 8]','2024-06-01 09:00:00','2024-06-30 18:00:00',3,'ongoing',1,'2025-11-14 14:04:06','2025-11-14 14:04:06'),(3,'产品知识专项考核','针对新产品上线的专项知识考核',3,'[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]','2024-11-15 09:00:00','2024-11-30 18:00:00',1,'published',1,'2025-11-14 14:04:06','2025-11-14 14:04:06'),(4,'年度综合能力考核','2024年度员工综合能力考核',5,'[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]','2024-12-01 09:00:00','2024-12-31 18:00:00',1,'draft',1,'2025-11-14 14:04:06','2025-11-14 14:04:06'),(5,'高级客服认证考试','高级客服人员资格认证考试',2,'[1, 2, 3]','2024-05-01 09:00:00','2024-05-15 18:00:00',1,'cancelled',1,'2025-11-14 14:04:06','2025-11-14 14:04:06'),(6,'2024年第一季度客服基础知识考核','测试新员工对客服基础知识的掌握情况',1,'[1, 2, 3]','2025-11-07 14:16:41','2025-11-21 14:16:41',2,'ongoing',1,'2025-11-14 14:16:41','2025-11-14 14:16:41'),(7,'产品知识月度考核','每月一次的产品知识考核',1,'[1, 2, 3, 4, 5]','2025-11-16 14:16:41','2025-11-23 14:16:41',1,'published',1,'2025-11-14 14:16:41','2025-11-14 14:16:41'),(8,'高级客服技能认证考核','针对高级客服人员的技能认证',1,'[1, 2]','2025-11-28 14:16:41','2025-12-05 14:16:41',3,'draft',1,'2025-11-14 14:16:41','2025-11-14 14:16:41'),(9,'测试忽略 exam_id','批量更新测试',2,'[1, 2, 3]','2024-12-15 09:00:00','2024-12-25 18:00:00',2,'draft',1,'2025-11-14 15:54:05','2025-11-14 15:54:05'),(10,'测试计划 - 最终更新','测试状态限制',2,'[1]','2024-12-01 09:00:00','2024-12-31 18:00:00',1,'draft',1,'2025-11-14 15:54:53','2025-11-14 15:54:53'),(11,'快速状态测试计划','用于快速测试状态转换',2,'[1]','2025-11-14 08:13:40','2025-11-14 09:14:40',1,'draft',3,'2025-11-14 16:14:40','2025-11-14 16:14:40'),(12,'状态测试_1763108836291','测试状态转换',17,'[1]','2025-11-14 08:26:16','2025-11-14 09:27:16',1,'draft',3,'2025-11-14 16:27:16','2025-11-14 16:27:16'),(13,'状态测试_1763108853677','测试状态转换',17,'[1]','2025-11-14 07:27:33','2025-11-15 08:27:33',1,'cancelled',3,'2025-11-14 16:27:33','2025-11-14 16:27:33');
/*!40000 ALTER TABLE `assessment_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_results`
--

DROP TABLE IF EXISTS `assessment_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `status` enum('in_progress','submitted','graded','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'in_progress' COMMENT '考试状态：in_progress-进行中，submitted-已提交，graded-已评分，expired-已过期',
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
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='考核结果表-存储用户的考试结果和成绩信息';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_results`
--

LOCK TABLES `assessment_results` WRITE;
/*!40000 ALTER TABLE `assessment_results` DISABLE KEYS */;
INSERT INTO `assessment_results` VALUES (1,1,2,1,1,'2024-01-01 09:00:00','2024-01-01 09:30:00',1800,84.40,1,'graded','2025-11-14 14:04:06','2025-11-14 14:04:06'),(2,1,2,2,1,'2024-01-01 09:00:00','2024-01-01 09:30:00',1800,89.98,1,'graded','2025-11-14 14:04:06','2025-11-14 14:04:06'),(3,1,2,3,1,'2024-01-01 09:00:00','2024-01-01 09:30:00',1800,73.75,1,'graded','2025-11-14 14:04:06','2025-11-14 14:04:06'),(4,2,2,1,1,'2024-06-01 09:00:00','2024-06-01 09:30:00',1800,69.79,1,'graded','2025-11-14 14:04:06','2025-11-14 14:04:06'),(5,2,2,2,1,'2024-06-01 09:00:00','2024-06-01 09:30:00',1800,76.88,1,'graded','2025-11-14 14:04:06','2025-11-14 14:04:06'),(6,2,2,3,1,'2024-06-01 09:00:00','2024-06-01 09:30:00',1800,63.34,1,'graded','2025-11-14 14:04:06','2025-11-14 14:04:06'),(7,2,2,4,1,'2024-06-01 09:00:00','2024-06-01 09:30:00',1800,84.52,1,'graded','2025-11-14 14:04:06','2025-11-14 14:04:06'),(8,6,1,1,1,'2025-11-09 14:16:41','2025-11-09 14:46:41',1800,85.50,1,'graded','2025-11-14 14:16:41','2025-11-14 14:16:41'),(9,6,1,2,1,'2025-11-11 14:16:41','2025-11-11 14:41:41',1500,55.00,0,'graded','2025-11-14 14:16:41','2025-11-14 14:16:41'),(10,6,1,3,1,'2025-11-14 16:56:09',NULL,NULL,NULL,0,'in_progress','2025-11-14 16:56:09','2025-11-14 16:56:09');
/*!40000 ALTER TABLE `assessment_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_records`
--

DROP TABLE IF EXISTS `attendance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '考勤记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '员工用户ID，关联users表，级联删除',
  `attendance_date` date NOT NULL COMMENT '考勤日期，YYYY-MM-DD格式',
  `check_in_time` datetime DEFAULT NULL COMMENT '签到时间，精确到秒',
  `check_out_time` datetime DEFAULT NULL COMMENT '签退时间，精确到秒',
  `work_hours` decimal(5,2) DEFAULT NULL COMMENT '实际工作时长，单位小时，自动计算',
  `overtime_hours` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '加班时长，单位小时',
  `status` enum('normal','late','early_leave','absent','overtime') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal' COMMENT '考勤状态：normal-正常，late-迟到，early_leave-早退，absent-缺勤，overtime-加班',
  `note` text COLLATE utf8mb4_unicode_ci COMMENT '考勤备注，异常情况说明',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `clock_out_time` datetime DEFAULT NULL,
  `clock_out_location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employee_id` int NOT NULL,
  `record_date` date NOT NULL,
  `clock_in_time` datetime DEFAULT NULL,
  `clock_in_location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_overtime` tinyint(1) DEFAULT '0',
  `remark` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='考勤记录表-员工考勤打卡记录表，记录每日的签到签退信息';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_records`
--

LOCK TABLES `attendance_records` WRITE;
/*!40000 ALTER TABLE `attendance_records` DISABLE KEYS */;
INSERT INTO `attendance_records` VALUES (1,1,'2025-11-12','2025-11-12 08:38:52','2025-11-12 16:38:52',8.00,0.00,'normal',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-12 16:38:52',NULL,1,'2025-11-12','2025-11-12 08:38:52','总部办公室',0,NULL),(2,2,'2025-11-12','2025-11-12 08:53:52','2025-11-12 17:53:52',9.00,0.00,'early_leave',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-12 17:53:52',NULL,2,'2025-11-12','2025-11-12 08:53:52','总部办公室',0,NULL),(3,3,'2025-11-12','2025-11-12 09:32:52','2025-11-12 17:32:52',8.00,0.00,'late',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-12 17:32:52',NULL,3,'2025-11-12','2025-11-12 09:32:52','总部办公室',0,NULL),(4,1,'2025-11-11','2025-11-11 08:51:52','2025-11-11 17:51:52',9.00,0.00,'early_leave',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-11 17:51:52',NULL,1,'2025-11-11','2025-11-11 08:51:52','总部办公室',0,NULL),(5,2,'2025-11-11','2025-11-11 08:06:52','2025-11-11 17:06:52',9.00,0.00,'early_leave',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-11 17:06:52',NULL,2,'2025-11-11','2025-11-11 08:06:52','总部办公室',0,NULL),(6,3,'2025-11-11','2025-11-11 08:35:52','2025-11-11 16:35:52',8.00,0.00,'normal',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-11 16:35:52',NULL,3,'2025-11-11','2025-11-11 08:35:52','总部办公室',0,NULL),(7,1,'2025-11-10','2025-11-10 09:11:52','2025-11-10 18:11:52',9.00,0.00,'normal',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-10 18:11:52',NULL,1,'2025-11-10','2025-11-10 09:11:52','总部办公室',0,NULL),(8,2,'2025-11-10','2025-11-10 09:02:52','2025-11-10 17:02:52',8.00,0.00,'late',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-10 17:02:52',NULL,2,'2025-11-10','2025-11-10 09:02:52','总部办公室',0,NULL),(9,3,'2025-11-10','2025-11-10 08:45:52','2025-11-10 16:45:52',8.00,0.00,'early_leave',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-10 16:45:52',NULL,3,'2025-11-10','2025-11-10 08:45:52','总部办公室',0,NULL),(10,1,'2025-11-09','2025-11-09 08:18:52','2025-11-09 16:18:52',8.00,0.00,'late',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-09 16:18:52',NULL,1,'2025-11-09','2025-11-09 08:18:52','总部办公室',0,NULL),(11,2,'2025-11-09','2025-11-09 09:24:52','2025-11-09 17:24:52',8.00,0.00,'normal',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-09 17:24:52',NULL,2,'2025-11-09','2025-11-09 09:24:52','总部办公室',0,NULL),(12,3,'2025-11-09','2025-11-09 09:42:52','2025-11-09 17:42:52',8.00,0.00,'late',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-09 17:42:52',NULL,3,'2025-11-09','2025-11-09 09:42:52','总部办公室',0,NULL),(13,1,'2025-11-08','2025-11-08 09:16:52','2025-11-08 17:16:52',8.00,0.00,'late',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-08 17:16:52',NULL,1,'2025-11-08','2025-11-08 09:16:52','总部办公室',0,NULL),(14,2,'2025-11-08','2025-11-08 08:53:52','2025-11-08 16:53:52',8.00,0.00,'early_leave',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-08 16:53:52',NULL,2,'2025-11-08','2025-11-08 08:53:52','总部办公室',0,NULL),(15,3,'2025-11-08','2025-11-08 09:40:52','2025-11-08 17:40:52',8.00,0.00,'normal',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-08 17:40:52',NULL,3,'2025-11-08','2025-11-08 09:40:52','总部办公室',0,NULL),(16,1,'2025-11-07','2025-11-07 09:50:52','2025-11-07 18:50:52',9.00,0.00,'early_leave',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-07 18:50:52',NULL,1,'2025-11-07','2025-11-07 09:50:52','总部办公室',0,NULL),(17,2,'2025-11-07','2025-11-07 08:56:52','2025-11-07 17:56:52',9.00,0.00,'normal',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-07 17:56:52',NULL,2,'2025-11-07','2025-11-07 08:56:52','总部办公室',0,NULL),(18,3,'2025-11-07','2025-11-07 09:00:52','2025-11-07 18:00:52',9.00,0.00,'late',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-07 18:00:52',NULL,3,'2025-11-07','2025-11-07 09:00:52','总部办公室',0,NULL),(19,1,'2025-11-06','2025-11-06 09:26:52','2025-11-06 17:26:52',8.00,0.00,'early_leave',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-06 17:26:52',NULL,1,'2025-11-06','2025-11-06 09:26:52','总部办公室',0,NULL),(20,2,'2025-11-06','2025-11-06 08:16:52','2025-11-06 17:16:52',9.00,0.00,'late',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52','2025-11-06 17:16:52',NULL,2,'2025-11-06','2025-11-06 08:16:52','总部办公室',0,NULL),(28,1,'2025-11-16','2025-11-16 11:14:56',NULL,NULL,0.00,'normal',NULL,'2025-11-16 11:14:55','2025-11-16 11:15:19',NULL,NULL,1,'2025-11-16','2025-11-16 08:00:00',NULL,0,NULL);
/*!40000 ALTER TABLE `attendance_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_rules`
--

DROP TABLE IF EXISTS `attendance_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_rules`
--

LOCK TABLES `attendance_rules` WRITE;
/*!40000 ALTER TABLE `attendance_rules` DISABLE KEYS */;
INSERT INTO `attendance_rules` VALUES (1,'工作日设置','work_days','{\"days\": [1, 2, 3, 4, 5]}',1,'2025-11-12 08:05:31','2025-11-12 08:05:31'),(2,'迟到规则','late_rule','{\"unit\": \"minutes\", \"threshold\": 30}',1,'2025-11-12 08:05:31','2025-11-12 08:05:31'),(3,'早退规则','early_rule','{\"unit\": \"minutes\", \"threshold\": 30}',1,'2025-11-12 08:05:31','2025-11-12 08:05:31'),(4,'年假额度','annual_leave','{\"days\": 5, \"unit\": \"days\"}',1,'2025-11-12 08:05:31','2025-11-12 08:05:31'),(5,'病假额度','sick_leave','{\"days\": 10, \"unit\": \"days\"}',1,'2025-11-12 08:05:31','2025-11-12 08:05:31'),(6,'工作日设置','work_days','{\"days\": [1, 2, 3, 4, 5]}',1,'2025-11-12 08:34:19','2025-11-12 08:34:19'),(7,'迟到规则','late_rule','{\"unit\": \"minutes\", \"threshold\": 30}',1,'2025-11-12 08:34:19','2025-11-12 08:34:19'),(8,'早退规则','early_rule','{\"unit\": \"minutes\", \"threshold\": 30}',1,'2025-11-12 08:34:19','2025-11-12 08:34:19'),(9,'年假额度','annual_leave','{\"days\": 5, \"unit\": \"days\"}',1,'2025-11-12 08:34:19','2025-11-12 08:34:19'),(10,'病假额度','sick_leave','{\"days\": 10, \"unit\": \"days\"}',1,'2025-11-12 08:34:19','2025-11-12 08:34:19'),(11,'工作日设置','work_days','{\"days\": [1, 2, 3, 4, 5]}',1,'2025-11-12 09:21:24','2025-11-12 09:21:24'),(12,'迟到规则','late_rule','{\"unit\": \"minutes\", \"threshold\": 30}',1,'2025-11-12 09:21:24','2025-11-12 09:21:24'),(13,'早退规则','early_rule','{\"unit\": \"minutes\", \"threshold\": 30}',1,'2025-11-12 09:21:24','2025-11-12 09:21:24'),(14,'年假额度','annual_leave','{\"days\": 5, \"unit\": \"days\"}',1,'2025-11-12 09:21:24','2025-11-12 09:21:24'),(15,'病假额度','sick_leave','{\"days\": 10, \"unit\": \"days\"}',1,'2025-11-12 09:21:24','2025-11-12 09:21:24');
/*!40000 ALTER TABLE `attendance_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_settings`
--

DROP TABLE IF EXISTS `attendance_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_settings`
--

LOCK TABLES `attendance_settings` WRITE;
/*!40000 ALTER TABLE `attendance_settings` DISABLE KEYS */;
INSERT INTO `attendance_settings` VALUES (1,0,500,'[]',1,1,120,20,30,4,10,15,1,1,1.0,4,1,3,1,1,1,1,'2025-11-15 08:56:03','2025-11-15 09:11:36');
/*!40000 ALTER TABLE `attendance_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `case_attachments`
--

DROP TABLE IF EXISTS `case_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `case_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL COMMENT '案例ID',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名称',
  `file_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件类型 (e.g., image/jpeg, application/pdf)',
  `file_size` int DEFAULT NULL COMMENT '文件大小 (bytes)',
  `file_url` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件存储URL',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `case_id` (`case_id`),
  CONSTRAINT `case_attachments_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `case_attachments`
--

LOCK TABLES `case_attachments` WRITE;
/*!40000 ALTER TABLE `case_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `case_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `case_comments`
--

DROP TABLE IF EXISTS `case_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `case_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL COMMENT '案例ID',
  `user_id` int NOT NULL COMMENT '评论用户ID',
  `comment_content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '评论内容',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `case_comments`
--

LOCK TABLES `case_comments` WRITE;
/*!40000 ALTER TABLE `case_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `case_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `case_learning_records`
--

DROP TABLE IF EXISTS `case_learning_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `case_learning_records`
--

LOCK TABLES `case_learning_records` WRITE;
/*!40000 ALTER TABLE `case_learning_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `case_learning_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `case_tags`
--

DROP TABLE IF EXISTS `case_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `case_tags`
--

LOCK TABLES `case_tags` WRITE;
/*!40000 ALTER TABLE `case_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `case_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cases`
--

DROP TABLE IF EXISTS `cases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cases` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '案例唯一标识ID',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '案例标题，简洁明了的问题描述',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '案例分类，如"技术问题"、"服务投诉"',
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '案例详细描述，问题的具体情况',
  `problem` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '问题描述，客户遇到的具体问题',
  `solution` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '解决方案，详细的处理步骤和方法',
  `difficulty` enum('easy','medium','hard') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium' COMMENT '难度等级：easy-简单，medium-中等，hard-困难',
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium' COMMENT '优先级：low-低，medium-中，high-高，urgent-紧急',
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '状态：draft-草稿，published-已发布，archived-已归档',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cases`
--

LOCK TABLES `cases` WRITE;
/*!40000 ALTER TABLE `cases` DISABLE KEYS */;
/*!40000 ALTER TABLE `cases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_room_members`
--

DROP TABLE IF EXISTS `chat_room_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_room_members` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '成员关系唯一标识ID',
  `room_id` int NOT NULL COMMENT '聊天室ID，关联chat_rooms表，级联删除',
  `user_id` int NOT NULL COMMENT '用户ID，关联users表，级联删除',
  `role` enum('owner','admin','member') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member' COMMENT '成员角色：owner-群主，admin-管理员，member-普通成员',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_room_members`
--

LOCK TABLES `chat_room_members` WRITE;
/*!40000 ALTER TABLE `chat_room_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_room_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `collected_messages`
--

DROP TABLE IF EXISTS `collected_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `collected_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `message_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_message_id` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `collected_messages`
--

LOCK TABLES `collected_messages` WRITE;
/*!40000 ALTER TABLE `collected_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `collected_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compensatory_leave_requests`
--

DROP TABLE IF EXISTS `compensatory_leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compensatory_leave_requests`
--

LOCK TABLES `compensatory_leave_requests` WRITE;
/*!40000 ALTER TABLE `compensatory_leave_requests` DISABLE KEYS */;
INSERT INTO `compensatory_leave_requests` VALUES (1,3,3,'compensatory_leave',NULL,NULL,'2025-11-19',16,'123','rejected',1,'范德萨','2025-11-19 06:59:48','2025-11-19 06:37:33','2025-11-19 06:59:48'),(2,3,3,'compensatory_leave',NULL,NULL,'2025-11-20',16,'范德萨','rejected',3,'范德萨','2025-11-19 06:59:06','2025-11-19 06:49:22','2025-11-19 06:59:06'),(3,1,1,'compensatory_leave',NULL,NULL,'2025-11-22',11,'123','pending',NULL,NULL,NULL,'2025-11-19 07:00:53','2025-11-19 07:00:53'),(4,1,1,'compensatory_leave',NULL,NULL,'2025-11-24',12,'dfsda ','pending',NULL,NULL,NULL,'2025-11-19 07:25:39','2025-11-19 07:25:39'),(5,1,1,'compensatory_leave','2025-11-29',NULL,'2025-11-27',11,'dddddd','rejected',1,'d','2025-11-19 07:31:00','2025-11-19 07:30:10','2025-11-19 07:31:00'),(6,1,1,'compensatory_leave','2025-11-25',NULL,'2025-11-26',11,'123','rejected',1,'fd','2025-11-19 07:36:24','2025-11-19 07:36:09','2025-11-19 07:36:24'),(7,1,1,'compensatory_leave','2025-11-28',NULL,'2025-11-29',7,'123','rejected',1,'f','2025-11-19 08:37:41','2025-11-19 08:37:15','2025-11-19 08:37:41'),(8,1,1,'compensatory_leave','2025-12-01',NULL,'2025-12-02',12,'123','rejected',1,'dfdddd','2025-11-19 08:47:03','2025-11-19 08:46:33','2025-11-19 08:47:03'),(9,1,1,'compensatory_leave','2025-12-02',NULL,'2025-12-03',11,'123','pending',NULL,NULL,NULL,'2025-11-19 09:45:51','2025-11-19 09:45:51'),(10,1,1,'compensatory_leave','2025-12-03',NULL,'2025-12-04',11,'gfh','pending',NULL,NULL,NULL,'2025-11-19 09:55:58','2025-11-19 09:55:58'),(11,1,1,'compensatory_leave','2025-11-20',NULL,'2025-11-21',12,'发多少多少','pending',NULL,NULL,NULL,'2025-11-20 01:11:06','2025-11-20 01:11:06');
/*!40000 ALTER TABLE `compensatory_leave_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversation_members`
--

DROP TABLE IF EXISTS `conversation_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversation_members`
--

LOCK TABLES `conversation_members` WRITE;
/*!40000 ALTER TABLE `conversation_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversation_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversion_rules`
--

DROP TABLE IF EXISTS `conversion_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversion_rules`
--

LOCK TABLES `conversion_rules` WRITE;
/*!40000 ALTER TABLE `conversion_rules` DISABLE KEYS */;
INSERT INTO `conversion_rules` VALUES (4,'overtime','overtime_leave',8.00,1,'2025-11-20 10:30:09','2025-11-20 11:02:19');
/*!40000 ALTER TABLE `conversion_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '部门唯一标识ID，自增主键',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '部门名称，如"客服部"、"技术部"',
  `parent_id` int DEFAULT NULL COMMENT '父部门ID，支持多级部门结构，NULL表示顶级部门',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '部门详细描述，包括职责和业务范围',
  `manager_id` int DEFAULT NULL COMMENT '部门经理用户ID，关联users表',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '部门状态：active-正常，inactive-停用',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,'总经理办公室',NULL,'公司最高管理层',NULL,'active',1,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(2,'人事部',NULL,'负责人力资源管理',NULL,'active',2,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(3,'客服部',NULL,'负责客户服务',NULL,'active',3,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(4,'技术部',NULL,'负责技术开发和维护',NULL,'active',4,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(5,'财务部',NULL,'负责财务管理',NULL,'active',5,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(6,'市场部',NULL,'负责市场营销',NULL,'active',6,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(7,'销售部',NULL,'负责产品销售和客户关系',NULL,'active',2,'2025-11-06 17:41:10','2025-11-06 17:41:10');
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_changes`
--

DROP TABLE IF EXISTS `employee_changes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_changes`
--

LOCK TABLES `employee_changes` WRITE;
/*!40000 ALTER TABLE `employee_changes` DISABLE KEYS */;
INSERT INTO `employee_changes` VALUES (1,1,1,'hire','2025-11-06',NULL,1,NULL,'系统管理员','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(2,2,2,'hire','2025-11-06',NULL,3,NULL,'部门经理','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(3,3,3,'hire','2025-11-06',NULL,NULL,NULL,'客服专员','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(4,4,4,'hire','2025-11-06',NULL,NULL,NULL,'高级客服专员','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(5,5,5,'hire','2025-11-06',NULL,NULL,NULL,'质检专员','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(6,6,6,'hire','2025-06-14',NULL,4,NULL,'高级工程师','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(7,7,7,'hire','2025-05-26',NULL,4,NULL,'工程师','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(8,8,8,'hire','2024-12-26',NULL,7,NULL,'销售经理','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(9,9,9,'hire','2025-02-02',NULL,7,NULL,'销售代表','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(10,10,10,'hire','2025-04-22',NULL,6,NULL,'市场经理','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(11,11,11,'hire','2025-07-08',NULL,6,NULL,'市场专员','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(12,12,12,'hire','2025-04-22',NULL,2,NULL,'人事经理','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(13,13,13,'hire','2025-02-25',NULL,2,NULL,'人事专员','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(14,14,14,'hire','2024-11-19',NULL,5,NULL,'财务经理','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(15,15,15,'hire','2025-08-20',NULL,5,NULL,'会计','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(16,16,16,'hire','2024-11-24',NULL,4,NULL,'初级工程师','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(17,17,17,'hire','2025-07-09',NULL,7,NULL,'销售代表','新员工入职',NULL,NULL,'2025-11-09 11:52:13','2025-11-09 11:52:13'),(18,12,12,'resign','2025-11-15',2,2,'人事经理','人事经理','1234',NULL,NULL,'2025-11-15 10:49:56','2025-11-15 10:49:56'),(19,12,12,'hire','2025-11-15',2,2,'人事经理','人事经理',NULL,NULL,NULL,'2025-11-15 10:54:01','2025-11-15 10:54:01'),(20,12,12,'terminate','2025-11-15',2,2,'人事经理','人事经理',NULL,NULL,NULL,'2025-11-15 10:57:41','2025-11-15 10:57:41'),(21,12,12,'hire','2025-11-15',2,2,'人事经理','人事经理',NULL,NULL,NULL,'2025-11-15 11:10:51','2025-11-15 11:10:51'),(22,12,12,'resign','2025-11-15',2,2,'人事经理','人事经理',NULL,NULL,NULL,'2025-11-15 11:17:16','2025-11-15 11:17:16'),(23,12,12,'hire','2025-11-15',2,2,'人事经理','人事经理',NULL,NULL,NULL,'2025-11-15 11:19:54','2025-11-15 11:19:54'),(24,12,12,'resign','2025-11-15',2,2,'人事经理','人事经理','123',NULL,NULL,'2025-11-15 12:42:06','2025-11-15 12:42:06');
/*!40000 ALTER TABLE `employee_changes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_status_records`
--

DROP TABLE IF EXISTS `employee_status_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_status_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '记录唯一标识ID',
  `employee_id` int NOT NULL COMMENT '员工ID，关联users表',
  `old_status` enum('active','inactive','resigned') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '原状态',
  `new_status` enum('active','inactive','resigned') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '新状态',
  `old_department_id` int DEFAULT NULL COMMENT '原部门ID',
  `new_department_id` int DEFAULT NULL COMMENT '新部门ID',
  `change_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '变更原因',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_status_records`
--

LOCK TABLES `employee_status_records` WRITE;
/*!40000 ALTER TABLE `employee_status_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_status_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `employee_work_duration`
--

DROP TABLE IF EXISTS `employee_work_duration`;
/*!50001 DROP VIEW IF EXISTS `employee_work_duration`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `employee_work_duration` AS SELECT 
 1 AS `employee_id`,
 1 AS `username`,
 1 AS `real_name`,
 1 AS `hire_date`,
 1 AS `total_work_days`,
 1 AS `current_status`,
 1 AS `current_department_id`,
 1 AS `current_department_name`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '员工记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '关联的用户ID，一对一关系，级联删除',
  `employee_no` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '员工工号，全局唯一，用于考勤等业务',
  `position` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '职位名称，如"高级客服专员"',
  `hire_date` date NOT NULL COMMENT '入职日期，用于计算工龄和权益',
  `salary` decimal(10,2) DEFAULT NULL COMMENT '基本薪资，保密字段，需要权限查看',
  `status` enum('active','inactive','resigned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '员工状态：active-在职，inactive-离职，resigned-辞职',
  `emergency_contact` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '紧急联系人',
  `emergency_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '紧急联系电话',
  `address` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '家庭住址',
  `education` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '学历',
  `skills` text COLLATE utf8mb4_unicode_ci COMMENT '技能特长',
  `remark` text COLLATE utf8mb4_unicode_ci COMMENT '备注',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,1,'EMP0001','系统管理员','2025-11-05',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 13:11:28','2025-11-16 14:50:57',3),(2,2,'EMP0002','部门经理','2025-11-06',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 13:11:28','2025-11-07 09:09:04',3),(3,3,'EMP0003','客服专员','2025-11-06',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 13:11:28','2025-11-07 09:09:04',5),(4,4,'EMP0004','高级客服专员','2025-11-06',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 13:11:28','2025-11-07 09:09:04',3),(5,5,'EMP0005','质检专员','2025-11-06',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 13:11:28','2025-11-07 09:09:04',3),(6,6,'E001','高级工程师','2025-06-14',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:32','2025-11-07 09:09:04',5),(7,7,'E002','工程师','2025-05-26',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:33','2025-11-07 09:09:04',4),(8,8,'E003','销售经理','2024-12-26',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:33','2025-11-07 09:09:04',4),(9,9,'E004','销售代表','2025-02-02',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:33','2025-11-06 17:43:33',1),(10,10,'E005','市场经理','2025-04-22',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:33','2025-11-07 09:09:04',3),(11,11,'E006','市场专员','2025-07-08',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:34','2025-11-06 17:43:34',1),(12,12,'E007','人事经理','2025-04-14',NULL,'resigned',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:34','2025-11-15 12:42:06',3),(13,13,'E008','人事专员','2025-02-25',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:34','2025-11-07 09:09:04',2),(14,14,'E009','财务经理','2024-11-19',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:34','2025-11-06 17:43:34',1),(15,15,'E010','会计','2025-08-20',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:34','2025-11-07 09:09:04',3),(16,16,'E011','初级工程师','2024-11-24',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:35','2025-11-09 11:17:50',3),(17,17,'E012','销售代表','2025-07-09',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-06 17:43:35','2025-11-07 09:09:04',4),(19,18,'EMP0018','鍛樺伐','2025-11-14',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-14 17:11:18','2025-11-14 17:11:18',1);
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exam_categories`
--

DROP TABLE IF EXISTS `exam_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exam_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '分类名称',
  `description` text COMMENT '分类描述',
  `icon` varchar(10) DEFAULT 0xF09F939A COMMENT '分类图标',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='试卷分类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exam_categories`
--

LOCK TABLES `exam_categories` WRITE;
/*!40000 ALTER TABLE `exam_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `exam_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exam_category_audit_logs`
--

DROP TABLE IF EXISTS `exam_category_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exam_category_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int DEFAULT NULL,
  `operator_id` int DEFAULT NULL,
  `operation` varchar(64) NOT NULL,
  `detail` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exam_category_audit_logs`
--

LOCK TABLES `exam_category_audit_logs` WRITE;
/*!40000 ALTER TABLE `exam_category_audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `exam_category_audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exams`
--

DROP TABLE IF EXISTS `exams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exams` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '试卷唯一标识ID',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '试卷标题，如"客服基础知识测试"',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '试卷详细描述，说明考试内容和要求',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '试卷分类，如"入职培训"、"技能考核"',
  `difficulty` enum('easy','medium','hard') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium' COMMENT '难度等级：easy-简单，medium-中等，hard-困难',
  `duration` int NOT NULL COMMENT '考试时长，单位分钟',
  `total_score` decimal(5,2) NOT NULL COMMENT '试卷总分',
  `pass_score` decimal(5,2) NOT NULL COMMENT '及格分数',
  `question_count` int NOT NULL DEFAULT '0' COMMENT '题目总数，自动计算',
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '试卷状态：draft-草稿，published-已发布，archived-已归档',
  `created_by` int DEFAULT NULL COMMENT '创建人用户ID，关联users表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
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
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='试卷表-存储考试试卷的基本信息和配置';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exams`
--

LOCK TABLES `exams` WRITE;
/*!40000 ALTER TABLE `exams` DISABLE KEYS */;
INSERT INTO `exams` VALUES (1,'111','222','123','easy',60,139.00,60.00,6,'draft',NULL,'2025-11-09 18:18:25','2025-11-14 14:00:10'),(2,'客服基础知识测试','测试客服人员的基础知识掌握情况','入职培训','easy',30,100.00,60.00,0,'published',NULL,'2025-11-12 23:35:41','2025-11-12 23:35:41'),(3,'产品知识考核','考核员工对公司产品的了解程度','技能考核','medium',45,100.00,70.00,0,'published',NULL,'2025-11-12 23:35:41','2025-11-12 23:35:41'),(4,'高级客服技能认证',NULL,'资格认证','hard',60,100.00,80.00,0,'draft',NULL,'2025-11-12 23:35:41','2025-11-19 12:59:52'),(5,'客服沟通技巧测试','测试客服沟通能力和技巧','技能考核','easy',20,50.00,30.00,0,'published',NULL,'2025-11-12 23:35:41','2025-11-12 23:35:41'),(6,'系统操作能力考核','考核员工对系统的操作熟练度','入职培训','medium',40,80.00,50.00,0,'published',NULL,'2025-11-12 23:35:41','2025-11-12 23:35:41'),(7,'客户投诉处理考试','测试处理客户投诉的能力','技能考核','hard',50,100.00,75.00,0,'archived',NULL,'2025-11-12 23:35:41','2025-11-12 23:35:41'),(12,'状态测试专用试卷','用于测试考核计划状态转换','测试','easy',30,200.00,60.00,1,'draft',3,'2025-11-14 16:17:01','2025-11-14 16:17:01'),(13,'状态测试试卷_1763108284712佛挡杀佛水电费',NULL,'测试','easy',30,200.00,60.00,1,'draft',3,'2025-11-14 16:18:04','2025-11-19 13:03:29'),(14,'状态测试试卷_1763108475969','用于测试','测试','easy',30,100.00,30.00,2,'draft',3,'2025-11-14 16:21:15','2025-11-14 16:21:15'),(15,'状态测试试卷_1763108497281范德萨福师大',NULL,'测试','easy',30,93.00,30.00,3,'draft',3,'2025-11-14 16:21:37','2025-11-20 12:30:21'),(16,'状态测试试卷_1763108537351',NULL,'测试','easy',30,220.00,60.00,4,'draft',3,'2025-11-14 16:22:17','2025-11-19 14:11:58'),(17,'API测试专用试卷',NULL,'测试','easy',30,110.00,60.00,7,'archived',3,'2025-11-14 16:27:06','2025-11-20 12:31:25'),(18,'123',NULL,'1234','medium',60,120.00,60.00,12,'published',1,'2025-11-19 16:33:11','2025-11-20 15:20:14');
/*!40000 ALTER TABLE `exams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `group_members`
--

DROP TABLE IF EXISTS `group_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `group_members`
--

LOCK TABLES `group_members` WRITE;
/*!40000 ALTER TABLE `group_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `group_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `groups`
--

DROP TABLE IF EXISTS `groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `groups`
--

LOCK TABLES `groups` WRITE;
/*!40000 ALTER TABLE `groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `holidays`
--

DROP TABLE IF EXISTS `holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='节假日配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `holidays`
--

LOCK TABLES `holidays` WRITE;
/*!40000 ALTER TABLE `holidays` DISABLE KEYS */;
INSERT INTO `holidays` VALUES (1,'基础假期',4,1,2025,'2025-11-20 06:31:28','2025-11-20 06:31:28',NULL),(2,'年假',10,1,2025,'2025-11-20 06:31:40','2025-11-20 06:31:40',NULL);
/*!40000 ALTER TABLE `holidays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_article_daily_stats`
--

DROP TABLE IF EXISTS `knowledge_article_daily_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_article_daily_stats`
--

LOCK TABLES `knowledge_article_daily_stats` WRITE;
/*!40000 ALTER TABLE `knowledge_article_daily_stats` DISABLE KEYS */;
/*!40000 ALTER TABLE `knowledge_article_daily_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_article_read_sessions`
--

DROP TABLE IF EXISTS `knowledge_article_read_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_article_read_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `department_id` int DEFAULT NULL,
  `article_id` bigint unsigned NOT NULL,
  `started_at` datetime NOT NULL,
  `ended_at` datetime DEFAULT NULL,
  `duration_seconds` int DEFAULT '0',
  `active_seconds` int DEFAULT '0',
  `scroll_depth_percent` int DEFAULT '0',
  `full_read` tinyint(1) DEFAULT '0',
  `close_type` enum('user_close','auto_close','tab_hidden') COLLATE utf8mb4_unicode_ci DEFAULT 'user_close',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_article_read_sessions`
--

LOCK TABLES `knowledge_article_read_sessions` WRITE;
/*!40000 ALTER TABLE `knowledge_article_read_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `knowledge_article_read_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_articles`
--

DROP TABLE IF EXISTS `knowledge_articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_articles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` mediumtext COLLATE utf8mb4_unicode_ci,
  `attachments` mediumtext COLLATE utf8mb4_unicode_ci,
  `category_id` bigint unsigned DEFAULT NULL,
  `owner_id` bigint unsigned DEFAULT NULL,
  `original_article_id` bigint unsigned DEFAULT NULL,
  `type` enum('common','personal') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'common',
  `is_public` tinyint(1) NOT NULL DEFAULT '1',
  `status` enum('draft','published','archived','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `view_count` int unsigned NOT NULL DEFAULT '0',
  `like_count` int unsigned NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_articles`
--

LOCK TABLES `knowledge_articles` WRITE;
/*!40000 ALTER TABLE `knowledge_articles` DISABLE KEYS */;
INSERT INTO `knowledge_articles` VALUES (1,'dsafsa',NULL,'','[{\"name\":\"28d7384557ec4aed81d016684ea130d0.png\",\"url\":\"http://localhost:3001/uploads/1763451953778-rzcz1x.png\",\"type\":\"image/png\",\"size\":687088}]',NULL,NULL,NULL,'common',0,'published',0,0,0,NULL,'📁',NULL,NULL,NULL,'2025-11-18 15:45:54','2025-11-18 15:45:54',NULL),(2,'123',NULL,'','[{\"name\":\"阿里巴巴内部电话销售教程.pdf\",\"url\":\"http://localhost:3001/uploads/1763452514731-bfv1a.pdf\",\"type\":\"application/pdf\",\"size\":544731}]',2,NULL,NULL,'personal',1,'archived',0,0,0,NULL,'📁',NULL,NULL,NULL,'2025-11-18 15:55:16','2025-11-18 16:04:15',NULL),(3,'pdf',NULL,'','[{\"name\":\"阿里巴巴内部电话销售教程.pdf\",\"url\":\"http://localhost:3001/uploads/1763452753064-j6v6wl.pdf\",\"type\":\"application/pdf\",\"size\":544731}]',3,NULL,NULL,'personal',1,'published',0,0,0,NULL,'📁',NULL,NULL,NULL,'2025-11-18 15:59:14','2025-11-18 16:04:09',NULL),(4,'pdf',NULL,'','[{\"name\":\"阿里巴巴内部电话销售教程.pdf\",\"url\":\"http://localhost:3001/uploads/1763452753064-j6v6wl.pdf\",\"type\":\"application/pdf\",\"size\":544731}]',4,NULL,3,'personal',1,'published',0,0,0,NULL,'📁',NULL,NULL,NULL,'2025-11-18 16:24:19','2025-11-18 16:24:19',NULL),(5,'pdf',NULL,'','[{\"name\":\"阿里巴巴内部电话销售教程.pdf\",\"url\":\"http://localhost:3001/uploads/1763452753064-j6v6wl.pdf\",\"type\":\"application/pdf\",\"size\":544731}]',4,NULL,4,'personal',1,'published',0,0,0,NULL,'📁',NULL,NULL,NULL,'2025-11-18 16:38:26','2025-11-18 16:38:26',NULL),(6,'pdf',NULL,'','[{\"name\":\"阿里巴巴内部电话销售教程.pdf\",\"url\":\"http://localhost:3001/uploads/1763452753064-j6v6wl.pdf\",\"type\":\"application/pdf\",\"size\":544731}]',4,NULL,5,'personal',1,'published',0,0,0,NULL,'📁',NULL,NULL,NULL,'2025-11-18 16:38:49','2025-11-18 16:38:49',NULL);
/*!40000 ALTER TABLE `knowledge_articles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_attachments`
--

DROP TABLE IF EXISTS `knowledge_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_attachments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `article_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_att_article` (`article_id`),
  CONSTRAINT `fk_att_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_attachments`
--

LOCK TABLES `knowledge_attachments` WRITE;
/*!40000 ALTER TABLE `knowledge_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `knowledge_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_categories`
--

DROP TABLE IF EXISTS `knowledge_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_id` bigint unsigned DEFAULT NULL,
  `type` enum('common','personal') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'common',
  `is_public` tinyint(1) NOT NULL DEFAULT '1',
  `is_hidden` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_categories`
--

LOCK TABLES `knowledge_categories` WRITE;
/*!40000 ALTER TABLE `knowledge_categories` DISABLE KEYS */;
INSERT INTO `knowledge_categories` VALUES (2,'123',NULL,'📁',3,'personal',1,1,'published',0,'2025-11-18 15:51:11','2025-11-18 16:08:46',NULL,NULL),(3,'测试分类',NULL,'📁',3,'personal',1,0,'published',0,'2025-11-18 15:59:00','2025-11-18 16:11:43',NULL,NULL),(4,'粉随爱豆',NULL,'📁',3,'personal',1,0,'published',0,'2025-11-18 16:24:19','2025-11-18 16:24:19',NULL,NULL);
/*!40000 ALTER TABLE `knowledge_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_learning_plan_records`
--

DROP TABLE IF EXISTS `knowledge_learning_plan_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_learning_plan_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `start_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` datetime DEFAULT NULL,
  `duration` int NOT NULL DEFAULT '0',
  `progress` int NOT NULL DEFAULT '0',
  `status` enum('in_progress','completed','abandoned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'in_progress',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_learning_plan_records`
--

LOCK TABLES `knowledge_learning_plan_records` WRITE;
/*!40000 ALTER TABLE `knowledge_learning_plan_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `knowledge_learning_plan_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_learning_plans`
--

DROP TABLE IF EXISTS `knowledge_learning_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_learning_plans` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '学习计划唯一标识ID',
  `user_id` int NOT NULL COMMENT '用户ID，关联users表',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '计划标题',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '计划描述',
  `target_articles` json DEFAULT NULL COMMENT '目标文章列表，JSON格式存储文章ID数组',
  `start_date` date NOT NULL COMMENT '计划开始日期',
  `end_date` date NOT NULL COMMENT '计划结束日期',
  `status` enum('active','completed','cancelled','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '计划状态：active-进行中，completed-已完成，cancelled-已取消，expired-已过期',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_learning_plans`
--

LOCK TABLES `knowledge_learning_plans` WRITE;
/*!40000 ALTER TABLE `knowledge_learning_plans` DISABLE KEYS */;
INSERT INTO `knowledge_learning_plans` VALUES (1,1,'新员工入职培训','完成所有入职必读文章','[1, 2, 3]','2024-11-15','2024-11-22','active',67,'2025-11-15 10:07:01','2025-11-15 10:07:01'),(2,2,'客服技能提升计划','学习客服相关技巧','[2, 3]','2024-11-15','2024-11-30','active',50,'2025-11-15 10:07:01','2025-11-15 10:07:01');
/*!40000 ALTER TABLE `knowledge_learning_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_learning_statistics`
--

DROP TABLE IF EXISTS `knowledge_learning_statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_learning_statistics`
--

LOCK TABLES `knowledge_learning_statistics` WRITE;
/*!40000 ALTER TABLE `knowledge_learning_statistics` DISABLE KEYS */;
INSERT INTO `knowledge_learning_statistics` VALUES (1,1,'2024-11-15',3,2,930,'2025-11-15 10:07:01','2025-11-15 10:07:01'),(2,2,'2024-11-15',2,1,450,'2025-11-15 10:07:01','2025-11-15 10:07:01');
/*!40000 ALTER TABLE `knowledge_learning_statistics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_plans`
--

DROP TABLE IF EXISTS `learning_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_plans` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '计划ID',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '计划标题',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '计划描述',
  `created_by` int NOT NULL COMMENT '创建者ID',
  `assigned_to` int DEFAULT NULL COMMENT '分配给用户ID',
  `department_id` int DEFAULT NULL COMMENT '分配给部门ID',
  `status` enum('draft','active','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '计划状态',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_plans`
--

LOCK TABLES `learning_plans` WRITE;
/*!40000 ALTER TABLE `learning_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `learning_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_statistics`
--

DROP TABLE IF EXISTS `learning_statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_statistics`
--

LOCK TABLES `learning_statistics` WRITE;
/*!40000 ALTER TABLE `learning_statistics` DISABLE KEYS */;
/*!40000 ALTER TABLE `learning_statistics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_tasks`
--

DROP TABLE IF EXISTS `learning_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_tasks` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '任务ID',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '任务标题',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '任务描述',
  `assigned_to` int NOT NULL COMMENT '分配给用户ID',
  `assigned_by` int DEFAULT NULL COMMENT '分配者ID',
  `status` enum('pending','in_progress','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '任务状态',
  `priority` enum('low','medium','high') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium' COMMENT '优先级',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_tasks`
--

LOCK TABLES `learning_tasks` WRITE;
/*!40000 ALTER TABLE `learning_tasks` DISABLE KEYS */;
/*!40000 ALTER TABLE `learning_tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leave_records`
--

DROP TABLE IF EXISTS `leave_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '请假记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '请假员工用户ID，关联users表，级联删除',
  `leave_type` enum('sick','annual','personal','maternity','other') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '请假类型：sick-病假，annual-年假，personal-事假，maternity-产假，other-其他',
  `start_date` date NOT NULL COMMENT '请假开始日期',
  `end_date` date NOT NULL COMMENT '请假结束日期',
  `days` decimal(5,2) NOT NULL COMMENT '请假天数，支持半天请假，如0.5天',
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '请假原因，详细说明',
  `status` enum('pending','approved','rejected','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '审批状态：pending-待审批，approved-已批准，rejected-已拒绝，cancelled-已取消',
  `approver_id` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL COMMENT '审批时间',
  `approval_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='请假记录表-员工请假申请和审批记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_records`
--

LOCK TABLES `leave_records` WRITE;
/*!40000 ALTER TABLE `leave_records` DISABLE KEYS */;
INSERT INTO `leave_records` VALUES (1,1,'sick','2025-11-15','2025-11-16',2.00,'感冒发烧，需要休息','pending',NULL,NULL,NULL,'2025-11-12 17:35:08','2025-11-12 17:35:08',1,NULL,0),(2,2,'annual','2025-11-20','2025-11-22',3.00,'年假旅游','approved',3,'2025-11-12 17:35:08',NULL,'2025-11-12 17:35:08','2025-11-12 17:35:08',2,NULL,0),(3,3,'personal','2025-11-18','2025-11-18',1.00,'家里有事','pending',NULL,NULL,NULL,'2025-11-12 17:35:08','2025-11-12 17:35:08',3,NULL,0),(4,1,'sick','2025-11-15','2025-11-16',2.00,'感冒发烧，需要休息','approved',1,'2025-11-12 18:14:57',NULL,'2025-11-12 17:35:52','2025-11-12 18:14:57',1,NULL,0),(5,2,'annual','2025-11-20','2025-11-22',3.00,'年假旅游','approved',3,'2025-11-12 17:35:52',NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52',2,NULL,0),(6,3,'personal','2025-11-18','2025-11-18',1.00,'家里有事','pending',NULL,NULL,NULL,'2025-11-12 17:35:52','2025-11-12 17:35:52',3,NULL,0),(7,1,'personal','2025-11-14','2025-11-14',1.00,'123','pending',NULL,NULL,NULL,'2025-11-13 17:19:00','2025-11-13 17:19:00',1,'[]',0),(8,1,'annual','2025-11-18','2025-11-18',1.00,'123','approved',1,'2025-11-13 20:31:34',NULL,'2025-11-13 17:19:22','2025-11-13 20:31:34',1,'[]',0),(9,1,'sick','2025-11-30','2025-11-30',1.00,'12334','rejected',1,'2025-11-13 20:31:07',NULL,'2025-11-13 20:22:15','2025-11-13 20:31:07',1,'[]',0),(10,1,'personal','2025-11-17','2025-11-17',1.00,'1234','approved',1,'2025-11-15 08:52:37',NULL,'2025-11-15 08:52:20','2025-11-15 08:52:37',1,'[]',0);
/*!40000 ALTER TABLE `leave_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `makeup_records`
--

DROP TABLE IF EXISTS `makeup_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `makeup_records`
--

LOCK TABLES `makeup_records` WRITE;
/*!40000 ALTER TABLE `makeup_records` DISABLE KEYS */;
INSERT INTO `makeup_records` VALUES (1,1,1,'2025-11-08','in','2025-11-08 08:30:00','忘记打卡','approved',1,'2025-11-14 18:11:13',NULL,'2025-11-12 09:35:08','2025-11-14 10:11:13'),(2,2,2,'2025-11-07','out','2025-11-07 18:00:00','手机没电','approved',3,'2025-11-12 17:35:08',NULL,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(3,1,1,'2025-11-08','in','2025-11-08 08:30:00','忘记打卡','rejected',1,'2025-11-14 18:11:05',NULL,'2025-11-12 09:35:52','2025-11-14 10:11:05'),(4,2,2,'2025-11-07','out','2025-11-07 18:00:00','手机没电','approved',3,'2025-11-12 17:35:52',NULL,'2025-11-12 09:35:52','2025-11-12 09:35:52'),(5,1,1,'2025-11-14','in','2025-11-14 09:00:00','1234','approved',1,'2025-11-14 18:20:41',NULL,'2025-11-14 10:20:12','2025-11-14 10:20:41'),(6,1,1,'2025-11-14','in','2025-11-14 09:00:00','fsdaf','approved',1,'2025-11-14 18:21:48',NULL,'2025-11-14 10:21:40','2025-11-14 10:21:48'),(7,1,1,'2025-11-14','in','2025-11-14 09:00:00','1234','approved',1,'2025-11-14 18:30:42',NULL,'2025-11-14 10:30:36','2025-11-14 10:30:42'),(8,1,1,'2025-11-14','in','2025-11-14 09:00:00','123','approved',1,'2025-11-14 18:37:12',NULL,'2025-11-14 10:37:04','2025-11-14 10:37:12'),(9,1,1,'2025-11-14','out','2025-11-14 18:00:00','123','approved',1,'2025-11-14 18:37:48',NULL,'2025-11-14 10:37:43','2025-11-14 10:37:48'),(10,1,1,'2025-11-15','out','2025-11-15 18:00:00','123','approved',1,'2025-11-15 15:04:32',NULL,'2025-11-15 07:04:20','2025-11-15 07:04:32'),(11,1,1,'2025-11-16','in','2025-11-16 08:00:00','56565','approved',1,'2025-11-16 11:15:19',NULL,'2025-11-16 03:15:13','2025-11-16 03:15:19');
/*!40000 ALTER TABLE `makeup_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meal_order_items`
--

DROP TABLE IF EXISTS `meal_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meal_order_items` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '订餐明细唯一标识ID',
  `order_id` int NOT NULL COMMENT '订单ID，关联meal_orders表，级联删除',
  `menu_item_id` int NOT NULL COMMENT '菜品ID，关联menu_items表，级联删除',
  `quantity` int NOT NULL COMMENT '订购数量',
  `unit_price` decimal(8,2) NOT NULL COMMENT '单价，记录下单时的价格',
  `subtotal` decimal(8,2) NOT NULL COMMENT '小计金额，quantity * unit_price',
  `note` text COLLATE utf8mb4_unicode_ci COMMENT '单项备注，如"少盐"、"不要辣"',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_menu_item_id` (`menu_item_id`),
  KEY `idx_quantity` (`quantity`),
  KEY `idx_subtotal` (`subtotal`),
  CONSTRAINT `fk_meal_order_items_menu_item_id` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_meal_order_items_order_id` FOREIGN KEY (`order_id`) REFERENCES `meal_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订餐明细表-订餐记录的详细项目表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meal_order_items`
--

LOCK TABLES `meal_order_items` WRITE;
/*!40000 ALTER TABLE `meal_order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `meal_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meal_orders`
--

DROP TABLE IF EXISTS `meal_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meal_orders` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '订单唯一标识ID',
  `order_no` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单编号，全局唯一，格式如ORD20240115001',
  `user_id` int NOT NULL COMMENT '订餐用户ID，关联users表，级联删除',
  `order_date` date NOT NULL COMMENT '订餐日期，YYYY-MM-DD格式',
  `meal_type` enum('breakfast','lunch','dinner','snack') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '餐次类型：breakfast-早餐，lunch-午餐，dinner-晚餐，snack-加餐',
  `total_amount` decimal(8,2) NOT NULL COMMENT '订单总金额，单位元',
  `status` enum('pending','confirmed','preparing','ready','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '订单状态：pending-待确认，confirmed-已确认，preparing-制作中，ready-已完成，completed-已取餐，cancelled-已取消',
  `note` text COLLATE utf8mb4_unicode_ci COMMENT '订单备注，特殊要求或说明',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meal_orders`
--

LOCK TABLES `meal_orders` WRITE;
/*!40000 ALTER TABLE `meal_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `meal_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `menu_categories`
--

DROP TABLE IF EXISTS `menu_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `menu_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '菜单分类唯一标识ID',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称，如"主食"、"荤菜"、"素菜"',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '分类详细描述，说明该分类的特点',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号，用于菜单分类显示顺序',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜单分类表-订餐系统的菜品分类管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `menu_categories`
--

LOCK TABLES `menu_categories` WRITE;
/*!40000 ALTER TABLE `menu_categories` DISABLE KEYS */;
INSERT INTO `menu_categories` VALUES (1,'主食','米饭、面条等主食类',1,1,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(2,'荤菜','肉类菜品',2,1,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(3,'素菜','蔬菜类菜品',3,1,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(4,'汤品','各类汤品',4,1,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(5,'饮品','饮料、果汁等',5,1,'2025-11-06 09:58:30','2025-11-06 09:58:30');
/*!40000 ALTER TABLE `menu_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `menu_items`
--

DROP TABLE IF EXISTS `menu_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `menu_items` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '菜品唯一标识ID',
  `category_id` int NOT NULL COMMENT '所属分类ID，关联menu_categories表，级联删除',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '菜品名称，如"宫保鸡丁"、"麻婆豆腐"',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '菜品详细描述，包括口味、特色等',
  `price` decimal(8,2) NOT NULL COMMENT '菜品价格，单位元',
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '菜品图片URL地址',
  `ingredients` text COLLATE utf8mb4_unicode_ci COMMENT '主要配料信息，用于过敏提醒',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `menu_items`
--

LOCK TABLES `menu_items` WRITE;
/*!40000 ALTER TABLE `menu_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `menu_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `message_status`
--

DROP TABLE IF EXISTS `message_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `message_status`
--

LOCK TABLES `message_status` WRITE;
/*!40000 ALTER TABLE `message_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `message_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint unsigned NOT NULL,
  `sender_id` int NOT NULL,
  `recipient_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations_history`
--

DROP TABLE IF EXISTS `migrations_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `migration_name` (`migration_name`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations_history`
--

LOCK TABLES `migrations_history` WRITE;
/*!40000 ALTER TABLE `migrations_history` DISABLE KEYS */;
INSERT INTO `migrations_history` VALUES (1,'002_add_learning_tables.sql','2025-11-18 03:48:34'),(2,'003_add_learning_center_tables.sql','2025-11-18 03:48:34'),(4,'006_create_quality_sessions_table.sql','2025-11-18 04:02:31'),(5,'007_create_session_messages_table.sql','2025-11-18 04:02:31'),(6,'008_create_quality_rules_table.sql','2025-11-18 04:02:31'),(7,'009_create_quality_scores_table.sql','2025-11-18 04:02:31'),(8,'010_create_quality_cases_table.sql','2025-11-18 04:02:31'),(9,'011_create_case_tags_table.sql','2025-11-18 04:02:31'),(10,'012_create_case_attachments_table.sql','2025-11-18 04:03:02'),(11,'013_create_case_comments_table.sql','2025-11-18 04:03:23'),(12,'014_create_notifications_table.sql','2025-11-18 04:03:23'),(13,'015_create_notification_recipients_table.sql','2025-11-18 04:03:23'),(14,'016_create_migrations_history_table.sql','2025-11-18 04:03:23'),(15,'017_create_user_case_favorites_table.sql','2025-11-18 04:03:24'),(16,'018_create_case_learning_records_table.sql','2025-11-18 04:05:49'),(17,'019_create_user_notification_settings_table.sql','2025-11-18 15:28:54'),(18,'020_create_knowledge_article_read_sessions.sql','2025-11-18 15:30:15'),(19,'021_create_knowledge_article_daily_stats.sql','2025-11-18 15:30:15'),(20,'022_add_platform_and_shop_to_quality_sessions.sql','2025-11-19 00:59:02'),(21,'023_create_message_status_table.sql','2025-11-19 00:59:02'),(22,'023_create_platforms_and_shops_tables.sql','2025-11-19 00:59:03'),(23,'024_create_messages_table.sql','2025-11-19 01:10:20'),(24,'025_create_collected_messages_table.sql','2025-11-19 01:10:20'),(25,'026_create_messages_table_if_missing.sql','2025-11-19 01:47:44'),(26,'027_create_vacation_balances_table.sql','2025-11-19 06:05:00'),(27,'028_create_compensatory_leave_requests_table.sql','2025-11-19 06:05:00'),(28,'029_create_vacation_audit_logs_table.sql','2025-11-19 06:05:00'),(29,'030_create_vacation_settings_table.sql','2025-11-19 06:05:00'),(30,'029_add_related_fields_to_notifications.sql','2025-11-20 01:21:35'),(31,'031_ensure_rest_shift.sql','2025-11-20 01:21:35'),(32,'032_vacation_optimization.sql','2025-11-20 02:30:09'),(33,'033_add_overtime_leave.sql','2025-11-20 05:00:54'),(34,'034_add_expiry_date.sql','2025-11-20 05:00:54'),(35,'035_add_vacation_permissions.sql','2025-11-20 05:02:54'),(36,'036_add_use_converted_leave.sql','2025-11-20 05:08:21'),(37,'037_create_holidays_table.sql','2025-11-20 06:10:36'),(38,'038_add_vacation_type_to_holidays.sql','2025-11-20 07:02:30');
/*!40000 ALTER TABLE `migrations_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `my_knowledge_articles`
--

DROP TABLE IF EXISTS `my_knowledge_articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `my_knowledge_articles`
--

LOCK TABLES `my_knowledge_articles` WRITE;
/*!40000 ALTER TABLE `my_knowledge_articles` DISABLE KEYS */;
INSERT INTO `my_knowledge_articles` VALUES (1,1,NULL,2,'123456','地方都是',NULL,'[{\"url\": \"http://localhost:3001/uploads/1762679107122-xo5j3j.pptx\", \"name\": \"P13拼多多客服系统及规则介绍.pptx\", \"size\": 6498028, \"type\": \"application/vnd.openxmlformats-officedocument.presentationml.presentation\"}]',NULL,NULL,'2025-11-09 11:21:16','2025-11-11 07:53:22');
/*!40000 ALTER TABLE `my_knowledge_articles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `my_knowledge_categories`
--

DROP TABLE IF EXISTS `my_knowledge_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `my_knowledge_categories`
--

LOCK TABLES `my_knowledge_categories` WRITE;
/*!40000 ALTER TABLE `my_knowledge_categories` DISABLE KEYS */;
INSERT INTO `my_knowledge_categories` VALUES (1,1,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(2,2,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(3,3,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(4,4,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(5,5,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(6,6,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(7,7,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(8,8,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(9,9,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(10,10,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(11,11,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(12,12,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(13,13,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(14,14,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(15,15,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(16,16,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(17,17,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(18,18,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(19,19,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(20,20,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(21,21,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(22,22,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(23,23,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(24,24,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(25,25,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(26,26,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(27,27,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(28,28,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(29,29,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(30,30,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(31,31,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(32,32,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(33,33,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(34,34,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(35,35,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(36,36,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(37,37,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(38,38,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(39,39,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(40,40,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(41,41,'默认分类','📁','未分类的文档','2025-11-09 11:02:32','2025-11-09 11:02:32'),(64,1,'123','📁',NULL,'2025-11-09 11:04:27','2025-11-09 11:04:27'),(66,1,'我的知识库1','📁','123','2025-11-11 07:53:31','2025-11-11 07:53:31');
/*!40000 ALTER TABLE `my_knowledge_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `my_knowledge_saved_articles`
--

DROP TABLE IF EXISTS `my_knowledge_saved_articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `my_knowledge_saved_articles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `article_id` bigint unsigned NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_article` (`user_id`,`article_id`),
  KEY `idx_mk_user` (`user_id`),
  KEY `idx_mk_article` (`article_id`),
  CONSTRAINT `fk_mk_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `my_knowledge_saved_articles`
--

LOCK TABLES `my_knowledge_saved_articles` WRITE;
/*!40000 ALTER TABLE `my_knowledge_saved_articles` DISABLE KEYS */;
/*!40000 ALTER TABLE `my_knowledge_saved_articles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_recipients`
--

DROP TABLE IF EXISTS `notification_recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_recipients`
--

LOCK TABLES `notification_recipients` WRITE;
/*!40000 ALTER TABLE `notification_recipients` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_recipients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,1,'clock_reminder','打卡提醒','您今天还未打卡，请及时打卡',NULL,1,'2025-11-12 16:56:39',NULL),(2,1,'leave_approval','请假审批通知','您的请假申请已通过审批',NULL,1,'2025-11-12 16:56:39',NULL),(3,2,'overtime_approval','加班审批通知','您的加班申请已通过审批',NULL,0,'2025-11-12 16:56:39',NULL),(4,1,'clock_reminder','打卡提醒','您今天还未打卡，请及时打卡',NULL,1,'2025-11-12 16:56:45',NULL),(5,1,'leave_approval','请假审批通知','您的请假申请已通过审批',NULL,1,'2025-11-12 16:56:45',NULL),(6,2,'overtime_approval','加班审批通知','您的加班申请已通过审批',NULL,0,'2025-11-12 16:56:45',NULL),(8,1,'leave_approval','请假审批通知','您的请假申请已通过审批',NULL,1,'2025-11-12 17:15:51',NULL),(9,2,'overtime_approval','加班审批通知','您的加班申请已通过审批',NULL,0,'2025-11-12 17:15:51',NULL),(12,2,'overtime_approval','加班审批通知','您的加班申请已通过审批',NULL,0,'2025-11-12 17:18:07',NULL),(13,1,'approval','调休申请被拒绝','dfdddd',8,0,'2025-11-19 16:47:03','compensatory_leave');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `overtime_records`
--

DROP TABLE IF EXISTS `overtime_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `overtime_records`
--

LOCK TABLES `overtime_records` WRITE;
/*!40000 ALTER TABLE `overtime_records` DISABLE KEYS */;
INSERT INTO `overtime_records` VALUES (1,1,1,'2025-11-10','2025-11-10 18:00:00','2025-11-10 21:00:00',3.00,'项目紧急上线','approved',3,'2025-11-12 17:35:08',NULL,0,NULL,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(2,2,2,'2025-11-11','2025-11-11 19:00:00','2025-11-11 22:00:00',3.00,'处理客户问题','pending',NULL,NULL,NULL,0,NULL,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(3,3,3,'2025-11-09','2025-11-09 18:30:00','2025-11-09 20:30:00',2.00,'完成报告','approved',1,'2025-11-12 17:35:08',NULL,0,NULL,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(4,1,1,'2025-11-10','2025-11-10 18:00:00','2025-11-10 21:00:00',3.00,'项目紧急上线','approved',3,'2025-11-12 17:35:52',NULL,0,NULL,'2025-11-12 09:35:52','2025-11-12 09:35:52'),(5,2,2,'2025-11-11','2025-11-11 19:00:00','2025-11-11 22:00:00',3.00,'处理客户问题','pending',NULL,NULL,NULL,0,NULL,'2025-11-12 09:35:52','2025-11-12 09:35:52'),(6,3,3,'2025-11-09','2025-11-09 18:30:00','2025-11-09 20:30:00',2.00,'完成报告','approved',1,'2025-11-12 17:35:52',NULL,0,NULL,'2025-11-12 09:35:52','2025-11-12 09:35:52'),(7,1,1,'2025-11-20','2025-11-20 09:00:00','2025-11-20 18:00:00',9.00,'是的发生的发','approved',1,'2025-11-20 08:59:08',NULL,0,NULL,'2025-11-20 00:58:51','2025-11-20 00:59:08');
/*!40000 ALTER TABLE `overtime_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '权限唯一标识ID，自增主键',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '权限显示名称，如"查看用户列表"',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '权限代码，如"user:list"，用于程序判断',
  `resource` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '资源名称，如"user"、"role"等',
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型，如"read"、"create"、"update"、"delete"',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '权限详细描述，说明权限的具体作用',
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '所属模块，如"user"、"attendance"等，用于权限分组',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_resource` (`resource`),
  KEY `idx_action` (`action`),
  KEY `idx_module` (`module`),
  KEY `idx_resource_action` (`resource`,`action`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表-定义系统中所有的权限项，采用资源+操作的方式进行权限控制';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'查看用户列表','user:list','user','read','查看用户列表','user','2025-11-06 09:58:30','2025-11-06 09:58:30'),(2,'创建用户','user:create','user','create','创建新用户','user','2025-11-06 09:58:30','2025-11-06 09:58:30'),(3,'编辑用户','user:update','user','update','编辑用户信息','user','2025-11-06 09:58:30','2025-11-06 09:58:30'),(4,'删除用户','user:delete','user','delete','删除用户','user','2025-11-06 09:58:30','2025-11-06 09:58:30'),(5,'重置密码','user:reset_password','user','update','重置用户密码','user','2025-11-06 09:58:30','2025-11-06 09:58:30'),(6,'查看角色列表','role:list','role','read','查看角色列表','role','2025-11-06 09:58:30','2025-11-06 09:58:30'),(7,'创建角色','role:create','role','create','创建新角色','role','2025-11-06 09:58:30','2025-11-06 09:58:30'),(8,'编辑角色','role:update','role','update','编辑角色信息','role','2025-11-06 09:58:30','2025-11-06 09:58:30'),(9,'删除角色','role:delete','role','delete','删除角色','role','2025-11-06 09:58:30','2025-11-06 09:58:30'),(10,'分配权限','role:assign_permission','role','update','为角色分配权限','role','2025-11-06 09:58:30','2025-11-06 09:58:30'),(11,'查看部门列表','department:list','department','read','查看部门列表','department','2025-11-06 09:58:30','2025-11-06 09:58:30'),(12,'创建部门','department:create','department','create','创建新部门','department','2025-11-06 09:58:30','2025-11-06 09:58:30'),(13,'编辑部门','department:update','department','update','编辑部门信息','department','2025-11-06 09:58:30','2025-11-06 09:58:30'),(14,'删除部门','department:delete','department','delete','删除部门','department','2025-11-06 09:58:30','2025-11-06 09:58:30'),(15,'查看考勤记录','attendance:list','attendance','read','查看考勤记录','attendance','2025-11-06 09:58:30','2025-11-06 09:58:30'),(16,'考勤打卡','attendance:checkin','attendance','create','考勤打卡','attendance','2025-11-06 09:58:30','2025-11-06 09:58:30'),(17,'编辑考勤','attendance:update','attendance','update','编辑考勤记录','attendance','2025-11-06 09:58:30','2025-11-06 09:58:30'),(18,'审批请假','leave:approve','leave','update','审批请假申请','attendance','2025-11-06 09:58:30','2025-11-06 09:58:30'),(19,'查看质检会话','quality:list','quality','read','查看质检会话','quality','2025-11-06 09:58:30','2025-11-06 09:58:30'),(20,'质检评分','quality:score','quality','create','进行质检评分','quality','2025-11-06 09:58:30','2025-11-06 09:58:30'),(21,'质检规则管理','quality:rule','quality','manage','管理质检规则','quality','2025-11-06 09:58:30','2025-11-06 09:58:30'),(22,'查看试卷列表','exam:list','exam','read','查看试卷列表','exam','2025-11-06 09:58:30','2025-11-06 09:58:30'),(23,'创建试卷','exam:create','exam','create','创建试卷','exam','2025-11-06 09:58:30','2025-11-06 09:58:30'),(24,'编辑试卷','exam:update','exam','update','编辑试卷','exam','2025-11-06 09:58:30','2025-11-06 09:58:30'),(25,'删除试卷','exam:delete','exam','delete','删除试卷','exam','2025-11-06 09:58:30','2025-11-06 09:58:30'),(26,'参加考试','exam:take','exam','take','参加考试','exam','2025-11-06 09:58:30','2025-11-06 09:58:30'),(27,'查看考试结果','exam:result','exam','read','查看考试结果','exam','2025-11-06 09:58:30','2025-11-06 09:58:30'),(28,'查看案例库','case:list','case','read','查看案例库','case','2025-11-06 09:58:30','2025-11-06 09:58:30'),(29,'创建案例','case:create','case','create','创建案例','case','2025-11-06 09:58:30','2025-11-06 09:58:30'),(30,'编辑案例','case:update','case','update','编辑案例','case','2025-11-06 09:58:30','2025-11-06 09:58:30'),(31,'删除案例','case:delete','case','delete','删除案例','case','2025-11-06 09:58:30','2025-11-06 09:58:30'),(32,'查看菜单','meal:menu','meal','read','查看菜单','meal','2025-11-06 09:58:30','2025-11-06 09:58:30'),(33,'订餐','meal:order','meal','create','订餐','meal','2025-11-06 09:58:30','2025-11-06 09:58:30'),(34,'管理菜单','meal:manage','meal','manage','管理菜单','meal','2025-11-06 09:58:30','2025-11-06 09:58:30'),(35,'发送消息','message:send','message','create','发送消息','message','2025-11-06 09:58:30','2025-11-06 09:58:30'),(36,'查看消息','message:read','message','read','查看消息','message','2025-11-06 09:58:30','2025-11-06 09:58:30'),(37,'查看知识库','knowledge:read','knowledge','read','查看知识库','knowledge','2025-11-06 09:58:30','2025-11-06 09:58:30'),(38,'创建知识','knowledge:create','knowledge','create','创建知识文章','knowledge','2025-11-06 09:58:30','2025-11-06 09:58:30'),(39,'编辑知识','knowledge:update','knowledge','update','编辑知识文章','knowledge','2025-11-06 09:58:30','2025-11-06 09:58:30'),(40,'使用聊天','chat:use','chat','use','使用聊天功能','chat','2025-11-06 09:58:30','2025-11-06 09:58:30'),(41,'管理聊天室','chat:manage','chat','manage','管理聊天室','chat','2025-11-06 09:58:30','2025-11-06 09:58:30'),(42,'查看所有假期','vacation.view_all','vacation','view_all','允许查看所有员工的假期数据','vacation','2025-11-20 13:02:54','2025-11-20 13:02:54'),(43,'编辑假期额度','vacation.edit_quota','vacation_quota','edit','允许修改员工的假期额度','vacation','2025-11-20 13:02:54','2025-11-20 13:02:54'),(44,'导出假期报表','vacation.export','vacation_report','export','允许导出假期相关报表','vacation','2025-11-20 13:02:54','2025-11-20 13:02:54'),(45,'审批假期申请','vacation.approve','vacation_request','approve','允许审批假期和调休申请','vacation','2025-11-20 13:02:54','2025-11-20 13:02:54'),(46,'假期配置管理','vacation.settings','vacation_settings','manage','允许管理假期类型和转换规则','vacation','2025-11-20 13:02:54','2025-11-20 13:02:54');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platforms`
--

DROP TABLE IF EXISTS `platforms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platforms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台名称',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platforms`
--

LOCK TABLES `platforms` WRITE;
/*!40000 ALTER TABLE `platforms` DISABLE KEYS */;
INSERT INTO `platforms` VALUES (1,'天猫','2025-11-19 00:59:03'),(2,'京东','2025-11-19 00:59:03'),(3,'拼多多','2025-11-19 00:59:03');
/*!40000 ALTER TABLE `platforms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `positions`
--

DROP TABLE IF EXISTS `positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '职位名称',
  `department_id` int NOT NULL COMMENT '所属部门ID',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '职位描述',
  `requirements` text COLLATE utf8mb4_unicode_ci COMMENT '任职要求',
  `responsibilities` text COLLATE utf8mb4_unicode_ci COMMENT '工作职责',
  `salary_min` decimal(10,2) DEFAULT NULL COMMENT '最低薪资',
  `salary_max` decimal(10,2) DEFAULT NULL COMMENT '最高薪资',
  `level` enum('junior','middle','senior','expert') COLLATE utf8mb4_unicode_ci DEFAULT 'junior' COMMENT '职位级别',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `positions`
--

LOCK TABLES `positions` WRITE;
/*!40000 ALTER TABLE `positions` DISABLE KEYS */;
INSERT INTO `positions` VALUES (1,'客服专员',1,'负责客户咨询和问题处理','大专以上学历，良好的沟通能力','接听客户电话，处理客户投诉，维护客户关系',4000.00,6000.00,'junior','active','2025-11-06 03:12:41','2025-11-06 03:12:41',NULL,NULL,0),(2,'高级客服专员',1,'负责复杂客户问题处理和团队指导','本科以上学历，3年以上客服经验','处理疑难问题，指导新员工，参与流程优化',6000.00,8000.00,'middle','active','2025-11-06 03:12:41','2025-11-06 03:12:41',NULL,NULL,0),(3,'客服主管',1,'负责客服团队管理和业务指导','本科以上学历，5年以上管理经验','团队管理，绩效考核，业务培训',8000.00,12000.00,'senior','active','2025-11-06 03:12:41','2025-11-06 03:12:41',NULL,NULL,0),(4,'系统管理员',2,'负责系统运维和技术支持','计算机相关专业，熟悉Linux系统','系统维护，故障处理，技术支持',7000.00,10000.00,'middle','active','2025-11-06 03:12:41','2025-11-06 03:12:41',NULL,NULL,0),(5,'人事专员',3,'负责人事管理和招聘工作','人力资源相关专业，熟悉劳动法','招聘管理，员工关系，薪酬福利',5000.00,7000.00,'junior','active','2025-11-06 03:12:41','2025-11-06 03:12:41',NULL,NULL,0),(6,'高级工程师',4,NULL,NULL,NULL,15000.00,25000.00,'senior','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,1),(7,'工程师',4,NULL,NULL,NULL,10000.00,18000.00,'middle','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,2),(8,'初级工程师',4,NULL,NULL,NULL,6000.00,12000.00,'junior','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,3),(9,'销售经理',7,NULL,NULL,NULL,12000.00,20000.00,'senior','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,1),(10,'销售代表',7,NULL,NULL,NULL,8000.00,15000.00,'middle','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,2),(11,'市场经理',6,NULL,NULL,NULL,12000.00,18000.00,'senior','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,1),(12,'市场专员',6,NULL,NULL,NULL,7000.00,12000.00,'middle','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,2),(13,'人事经理',2,NULL,NULL,NULL,10000.00,16000.00,'senior','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,1),(14,'人事专员',2,NULL,NULL,NULL,6000.00,10000.00,'middle','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,2),(15,'财务经理',5,NULL,NULL,NULL,12000.00,20000.00,'senior','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,1),(16,'会计',5,NULL,NULL,NULL,6000.00,12000.00,'middle','active','2025-11-06 09:43:32','2025-11-06 09:43:32',NULL,NULL,2),(17,'Software Engineer',1,'Software Development',NULL,NULL,NULL,NULL,'junior','active','2025-11-15 03:05:08','2025-11-15 03:05:08',NULL,NULL,1),(18,'Product Manager',1,'Product Planning',NULL,NULL,NULL,NULL,'junior','active','2025-11-15 03:05:08','2025-11-15 03:05:08',NULL,NULL,2),(19,'Designer',1,'UI/UX Design',NULL,NULL,NULL,NULL,'junior','active','2025-11-15 03:05:08','2025-11-15 03:05:08',NULL,NULL,3);
/*!40000 ALTER TABLE `positions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_case_attachments`
--

DROP TABLE IF EXISTS `quality_case_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quality_case_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int NOT NULL,
  `file_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `thumbnail_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_case_id` (`case_id`),
  CONSTRAINT `fk_quality_case_attachments_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例附件表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_case_attachments`
--

LOCK TABLES `quality_case_attachments` WRITE;
/*!40000 ALTER TABLE `quality_case_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `quality_case_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_case_collections`
--

DROP TABLE IF EXISTS `quality_case_collections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_case_collections`
--

LOCK TABLES `quality_case_collections` WRITE;
/*!40000 ALTER TABLE `quality_case_collections` DISABLE KEYS */;
/*!40000 ALTER TABLE `quality_case_collections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_case_comments`
--

DROP TABLE IF EXISTS `quality_case_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quality_case_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `like_count` int NOT NULL DEFAULT '0',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_case_id` (`case_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_quality_case_comments_case_id` FOREIGN KEY (`case_id`) REFERENCES `quality_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例评论表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_case_comments`
--

LOCK TABLES `quality_case_comments` WRITE;
/*!40000 ALTER TABLE `quality_case_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `quality_case_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_case_learning_records`
--

DROP TABLE IF EXISTS `quality_case_learning_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_case_learning_records`
--

LOCK TABLES `quality_case_learning_records` WRITE;
/*!40000 ALTER TABLE `quality_case_learning_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `quality_case_learning_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_case_tags`
--

DROP TABLE IF EXISTS `quality_case_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_case_tags`
--

LOCK TABLES `quality_case_tags` WRITE;
/*!40000 ALTER TABLE `quality_case_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `quality_case_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_cases`
--

DROP TABLE IF EXISTS `quality_cases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quality_cases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `problem` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `solution` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `case_type` enum('excellent','good','poor','warning') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'excellent',
  `difficulty` enum('easy','medium','hard') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_cases`
--

LOCK TABLES `quality_cases` WRITE;
/*!40000 ALTER TABLE `quality_cases` DISABLE KEYS */;
INSERT INTO `quality_cases` VALUES (1,'客户投诉产品质量问题的优秀处理案例','服务投诉','客户反馈产品存在质量问题，客服通过专业的沟通和快速的解决方案，成功化解客户不满','客户购买的产品在使用过程中出现故障，情绪比较激动，要求退款并投诉产品质量。','1. 首先向客户表示歉意，安抚客户情绪\r\n2. 详细了解产品故障情况，记录问题细节\r\n3. 立即联系技术部门确认问题原因\r\n4. 向客户说明问题原因和解决方案\r\n5. 提供免费维修或更换新品的选择\r\n6. 承诺加快处理速度，并提供补偿\r\n7. 后续跟进，确保客户满意','excellent','medium','high','published',NULL,156,45,0,0,1,0,NULL,NULL,'2024-11-15 08:00:00','2025-11-15 10:01:42','2025-11-15 10:01:42'),(2,'技术问题咨询的标准处理流程','技术问题','客户咨询产品使用中的技术问题，客服通过标准流程快速解决','客户不清楚如何使用产品的某个功能，希望得到详细的操作指导。','1. 确认客户使用的产品型号和版本\r\n2. 询问客户具体遇到的问题\r\n3. 提供详细的操作步骤说明\r\n4. 必要时通过远程协助演示操作\r\n5. 确认客户已经掌握操作方法\r\n6. 提供相关文档链接供客户参考','good','easy','medium','published',NULL,89,23,0,0,0,0,NULL,NULL,'2024-11-15 09:00:00','2025-11-15 10:01:42','2025-11-15 10:01:42'),(3,'处理客户情绪激动的警示案例','服务投诉','客服在处理投诉时态度不当，导致客户情绪更加激动，最终升级为严重投诉','客户因为订单延迟配送而投诉，情绪比较激动。客服在沟通中态度冷淡，没有及时安抚客户情绪。','【错误做法】\r\n1. 直接告诉客户这不是我们的问题\r\n2. 态度冷淡，缺乏同理心\r\n3. 没有提供解决方案\r\n\r\n【正确做法】\r\n1. 首先向客户表示歉意和理解\r\n2. 耐心倾听客户的诉求\r\n3. 立即查询订单状态\r\n4. 提供具体的解决方案和时间表\r\n5. 提供适当的补偿措施\r\n6. 后续跟进确保问题解决','warning','medium','high','published',NULL,234,67,0,0,1,0,NULL,NULL,'2024-11-15 10:00:00','2025-11-15 10:01:42','2025-11-15 10:01:42'),(4,'退款申请的快速处理方法','业务咨询','客户申请退款，客服按照标准流程快速处理','客户因个人原因需要退款，产品未使用且在退款期限内。','1. 核实订单信息和退款条件\r\n2. 确认产品状态（未使用、包装完好）\r\n3. 说明退款流程和时间\r\n4. 指导客户填写退款申请\r\n5. 提交退款审核\r\n6. 跟进退款进度并及时通知客户','good','easy','medium','published',NULL,67,18,0,0,0,0,NULL,NULL,'2024-11-15 11:00:00','2025-11-15 10:01:42','2025-11-15 10:01:42'),(5,'复杂技术问题的协同处理案例','技术问题','遇到复杂技术问题时，客服如何协调技术团队共同解决','客户遇到系统报错，问题较为复杂，需要技术团队介入分析。','1. 详细记录客户描述的问题现象\r\n2. 收集相关日志和截图\r\n3. 初步判断问题类型\r\n4. 创建技术工单并标注优先级\r\n5. 联系技术团队说明情况\r\n6. 向客户说明处理流程和预计时间\r\n7. 持续跟进技术团队进度\r\n8. 问题解决后回访客户确认','excellent','hard','high','published',NULL,145,38,0,0,1,0,NULL,NULL,'2024-11-15 12:00:00','2025-11-15 10:01:42','2025-11-15 10:01:42');
/*!40000 ALTER TABLE `quality_cases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_rules`
--

DROP TABLE IF EXISTS `quality_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quality_rules` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '质检规则唯一标识ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '规则名称，如"服务态度"、"专业能力"',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '规则分类，如"服务质量"、"沟通技巧"',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '规则详细描述，说明评分标准',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_rules`
--

LOCK TABLES `quality_rules` WRITE;
/*!40000 ALTER TABLE `quality_rules` DISABLE KEYS */;
INSERT INTO `quality_rules` VALUES (1,'服务态度','服务质量','评估客服人员的服务态度是否热情、耐心、友好','{\"good\": \"态度良好，基本满足要求\", \"poor\": \"态度冷淡或不耐烦\", \"average\": \"态度一般，有待提升\", \"excellent\": \"态度热情，耐心细致\"}',20.00,1,NULL,'2025-11-15 10:01:18','2025-11-15 10:01:18'),(2,'专业能力','业务能力','评估客服人员对业务知识的掌握程度和问题解决能力','{\"good\": \"专业知识较好，能解决大部分问题\", \"poor\": \"专业知识不足，无法解决问题\", \"average\": \"专业知识一般，需要查询资料\", \"excellent\": \"专业知识扎实，解决问题高效\"}',30.00,1,NULL,'2025-11-15 10:01:18','2025-11-15 10:01:18'),(3,'沟通技巧','沟通技巧','评估客服人员的表达能力和沟通效果','{\"good\": \"表达较好，沟通基本顺畅\", \"poor\": \"表达不清，沟通困难\", \"average\": \"表达一般，沟通有些障碍\", \"excellent\": \"表达清晰，沟通顺畅\"}',20.00,1,NULL,'2025-11-15 10:01:18','2025-11-15 10:01:18'),(4,'响应速度','服务效率','评估客服人员的响应速度和处理效率','{\"good\": \"响应较快，处理效率较高\", \"poor\": \"响应慢，处理效率低\", \"average\": \"响应一般，处理效率一般\", \"excellent\": \"响应及时，处理高效\"}',15.00,1,NULL,'2025-11-15 10:01:18','2025-11-15 10:01:18'),(5,'问题解决','服务效果','评估问题是否得到有效解决，客户是否满意','{\"good\": \"问题基本解决，客户满意\", \"poor\": \"问题未解决，客户不满意\", \"average\": \"问题部分解决，客户基本满意\", \"excellent\": \"问题完美解决，客户非常满意\"}',15.00,1,NULL,'2025-11-15 10:01:18','2025-11-15 10:01:18'),(6,'服务态度','服务质量','评估客服人员的服务态度是否热情、耐心、友好','{\"good\": \"态度良好，基本满足要求\", \"poor\": \"态度冷淡或不耐烦\", \"average\": \"态度一般，有待提升\", \"excellent\": \"态度热情，耐心细致\"}',20.00,1,NULL,'2025-11-15 10:01:42','2025-11-15 10:01:42'),(7,'专业能力','业务能力','评估客服人员对业务知识的掌握程度和问题解决能力','{\"good\": \"专业知识较好，能解决大部分问题\", \"poor\": \"专业知识不足，无法解决问题\", \"average\": \"专业知识一般，需要查询资料\", \"excellent\": \"专业知识扎实，解决问题高效\"}',30.00,1,NULL,'2025-11-15 10:01:42','2025-11-15 10:01:42'),(8,'沟通技巧','沟通技巧','评估客服人员的表达能力和沟通效果','{\"good\": \"表达较好，沟通基本顺畅\", \"poor\": \"表达不清，沟通困难\", \"average\": \"表达一般，沟通有些障碍\", \"excellent\": \"表达清晰，沟通顺畅\"}',20.00,1,NULL,'2025-11-15 10:01:42','2025-11-15 10:01:42'),(9,'响应速度','服务效率','评估客服人员的响应速度和处理效率','{\"good\": \"响应较快，处理效率较高\", \"poor\": \"响应慢，处理效率低\", \"average\": \"响应一般，处理效率一般\", \"excellent\": \"响应及时，处理高效\"}',15.00,1,NULL,'2025-11-15 10:01:42','2025-11-15 10:01:42'),(10,'问题解决','服务效果','评估问题是否得到有效解决，客户是否满意','{\"good\": \"问题基本解决，客户满意\", \"poor\": \"问题未解决，客户不满意\", \"average\": \"问题部分解决，客户基本满意\", \"excellent\": \"问题完美解决，客户非常满意\"}',15.00,1,NULL,'2025-11-15 10:01:42','2025-11-15 10:01:42');
/*!40000 ALTER TABLE `quality_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_scores`
--

DROP TABLE IF EXISTS `quality_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quality_scores` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '评分记录唯一标识ID',
  `session_id` int NOT NULL COMMENT '会话ID，关联quality_sessions表，级联删除',
  `rule_id` int NOT NULL COMMENT '规则ID，关联quality_rules表，级联删除',
  `score` decimal(5,2) NOT NULL COMMENT '该规则的得分',
  `max_score` decimal(5,2) NOT NULL COMMENT '该规则的满分',
  `comment` text COLLATE utf8mb4_unicode_ci COMMENT '该项评分的具体说明',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_scores`
--

LOCK TABLES `quality_scores` WRITE;
/*!40000 ALTER TABLE `quality_scores` DISABLE KEYS */;
/*!40000 ALTER TABLE `quality_scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_sessions`
--

DROP TABLE IF EXISTS `quality_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quality_sessions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '质检会话唯一标识ID',
  `session_no` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会话编号，全局唯一，用于业务查询',
  `agent_id` int NOT NULL COMMENT '客服人员用户ID，关联users表，级联删除',
  `customer_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户ID，可能来自外部系统',
  `channel` enum('chat','phone','email','video') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'chat' COMMENT '沟通渠道：chat-在线聊天，phone-电话，email-邮件，video-视频',
  `start_time` datetime NOT NULL COMMENT '会话开始时间',
  `end_time` datetime NOT NULL COMMENT '会话结束时间',
  `duration` int NOT NULL COMMENT '会话时长，单位秒',
  `message_count` int NOT NULL DEFAULT '0' COMMENT '消息总数，用于统计分析',
  `status` enum('pending','in_review','completed','disputed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '质检状态：pending-待质检，in_review-质检中，completed-已完成，disputed-有争议',
  `inspector_id` int DEFAULT NULL COMMENT '质检员用户ID，关联users表',
  `score` decimal(5,2) DEFAULT NULL COMMENT '质检总分，0-100分',
  `grade` enum('excellent','good','average','poor') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '质检等级：excellent-优秀，good-良好，average-一般，poor-较差',
  `comment` text COLLATE utf8mb4_unicode_ci COMMENT '质检总评语',
  `reviewed_at` datetime DEFAULT NULL COMMENT '质检完成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `platform` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台来源',
  `shop` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '店铺名称',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_sessions`
--

LOCK TABLES `quality_sessions` WRITE;
/*!40000 ALTER TABLE `quality_sessions` DISABLE KEYS */;
INSERT INTO `quality_sessions` VALUES (1,'QS20241115001',1,'CUST001','chat','2024-11-15 09:00:00','2024-11-15 09:15:00',900,25,'pending',NULL,NULL,NULL,NULL,NULL,'2025-11-15 10:01:42','2025-11-15 10:01:42','',''),(2,'QS20241115002',1,'CUST002','phone','2024-11-15 10:30:00','2024-11-15 10:45:00',900,0,'pending',NULL,NULL,NULL,NULL,NULL,'2025-11-15 10:01:42','2025-11-15 10:01:42','',''),(3,'QS20241115003',2,'CUST003','chat','2024-11-15 14:00:00','2024-11-15 14:20:00',1200,35,'pending',NULL,NULL,NULL,NULL,NULL,'2025-11-15 10:01:42','2025-11-15 10:01:42','','');
/*!40000 ALTER TABLE `quality_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questions`
--

DROP TABLE IF EXISTS `questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '题目唯一标识ID',
  `exam_id` int NOT NULL COMMENT '所属试卷ID，关联exams表，级联删除',
  `type` enum('single_choice','multiple_choice','true_false','fill_blank','essay') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题型：single_choice-单选，multiple_choice-多选，true_false-判断，fill_blank-填空，essay-问答',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题目内容，支持富文本格式',
  `options` json DEFAULT NULL COMMENT '选项内容，JSON格式存储，适用于选择题',
  `correct_answer` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '正确答案，根据题型格式不同',
  `score` decimal(5,2) NOT NULL COMMENT '题目分值',
  `explanation` text COLLATE utf8mb4_unicode_ci COMMENT '答案解析，帮助学习理解',
  `order_num` int NOT NULL DEFAULT '0' COMMENT '题目排序号，用于试卷中的显示顺序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_exam_id` (`exam_id`),
  KEY `idx_type` (`type`),
  KEY `idx_score` (`score`),
  KEY `idx_order_num` (`order_num`),
  CONSTRAINT `fk_questions_exam_id` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='题目表-存储试卷中的具体题目信息';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
INSERT INTO `questions` VALUES (1,1,'single_choice','分手的方式阿迪','[\"1\", \"1\", \"1\", \"1\", \"1\"]','A',10.00,'123',1,'2025-11-09 18:19:19','2025-11-14 14:00:10'),(2,1,'single_choice','以下哪个是JavaScript的数据类型？','[\"String\", \"Integer\", \"Float\", \"Character\"]','A',5.00,'JavaScript有String类型，但没有Integer、Float、Character这些类型',2,'2025-11-14 13:26:42','2025-11-14 14:00:10'),(3,1,'multiple_choice','以下哪些是前端框架？','[\"React\", \"Vue\", \"Angular\", \"Django\"]','ABC',10.00,'React、Vue、Angular都是前端框架，Django是Python后端框架',3,'2025-11-14 13:26:42','2025-11-14 14:00:10'),(4,1,'true_false','JavaScript是一种编译型语言','[\"正确\", \"错误\"]','B',3.00,'JavaScript是解释型语言，不是编译型语言',4,'2025-11-14 13:26:42','2025-11-14 14:00:10'),(5,1,'fill_blank','JavaScript中声明变量使用的关键字有 ___、___、___ 三种',NULL,'var,let,const',6.00,'JavaScript中可以使用var、let、const三种关键字声明变量',5,'2025-11-14 13:26:42','2025-11-14 14:00:10'),(6,1,'essay','请简述JavaScript中闭包的概念和应用场景',NULL,'闭包是指函数可以访问其外部作用域的变量。应用场景包括：数据封装、模块化、回调函数等。',15.00,'闭包是JavaScript的重要特性，理解闭包对于编写高质量代码很重要',6,'2025-11-14 13:26:42','2025-11-14 14:00:10'),(23,12,'single_choice','这是一道测试题','[\"选项A\", \"选项B\", \"选项C\", \"选项D\"]','A',100.00,'测试题目',1,'2025-11-14 16:17:01','2025-11-14 16:17:01'),(24,13,'single_choice','测试题目','[\"A\", \"B\", \"C\", \"D\"]','A',100.00,NULL,1,'2025-11-14 16:18:04','2025-11-14 16:18:04'),(25,14,'single_choice','测试题1','[\"A\", \"B\", \"C\", \"D\"]','A',25.00,NULL,1,'2025-11-14 16:21:15','2025-11-14 16:21:15'),(26,14,'single_choice','测试题2','[\"A\", \"B\", \"C\", \"D\"]','B',25.00,NULL,2,'2025-11-14 16:21:15','2025-11-14 16:21:15'),(27,15,'single_choice','测试题1','[\"A\", \"B\", \"C\", \"D\"]','A',1.00,NULL,1,'2025-11-14 16:21:37','2025-11-20 12:29:50'),(28,15,'single_choice','测试题2','[\"A\", \"B\", \"C\", \"D\"]','B',25.00,NULL,2,'2025-11-14 16:21:37','2025-11-14 16:21:37'),(29,16,'single_choice','测试题1','[\"A\", \"B\", \"C\", \"D\"]','A',50.00,NULL,1,'2025-11-14 16:22:17','2025-11-14 16:22:17'),(30,16,'single_choice','测试题2','[\"A\", \"B\", \"C\", \"D\"]','B',50.00,NULL,2,'2025-11-14 16:22:17','2025-11-14 16:22:17'),(33,16,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,3,'2025-11-19 14:11:45','2025-11-19 14:11:45'),(34,16,'true_false','新题目','[\"正确\", \"错误\"]','A',10.00,NULL,4,'2025-11-19 14:11:58','2025-11-19 14:11:58'),(35,17,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,1,'2025-11-19 14:31:07','2025-11-19 16:14:11'),(36,17,'multiple_choice','请作答1111','[\"选项A\", \"选项B\", \"选项C\"]','AB',10.00,NULL,2,'2025-11-19 14:31:18','2025-11-20 12:31:25'),(37,17,'true_false','新题目','[\"正确\", \"错误\"]','A',10.00,NULL,4,'2025-11-19 14:31:20','2025-11-19 16:14:11'),(38,17,'single_choice','大丰收啊','[\"1\", \"1\", \"1\", \"2\"]','A',10.00,'大发大',3,'2025-11-19 14:32:15','2025-11-19 16:14:11'),(40,17,'fill_blank','请填写答案',NULL,'',10.00,NULL,5,'2025-11-19 14:45:42','2025-11-19 16:14:11'),(41,17,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,6,'2025-11-19 16:13:48','2025-11-19 16:14:11'),(42,17,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,7,'2025-11-19 16:24:52','2025-11-19 16:24:52'),(43,18,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,1,'2025-11-19 16:33:14','2025-11-20 12:28:19'),(44,18,'multiple_choice','新题目','[\"选项A\", \"选项B\", \"选项C\"]','AB',10.00,NULL,2,'2025-11-19 16:33:16','2025-11-20 12:28:19'),(45,18,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,3,'2025-11-20 12:27:07','2025-11-20 12:28:19'),(46,18,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,4,'2025-11-20 12:27:11','2025-11-20 12:28:19'),(47,18,'essay','请作答',NULL,'',10.00,NULL,5,'2025-11-20 12:27:14','2025-11-20 12:28:19'),(48,18,'multiple_choice','新题目','[\"选项A\", \"选项B\", \"选项C\"]','AB',10.00,NULL,6,'2025-11-20 12:27:56','2025-11-20 12:28:19'),(49,18,'true_false','新题目','[\"正确\", \"错误\"]','A',10.00,NULL,7,'2025-11-20 12:27:57','2025-11-20 12:28:19'),(50,18,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,8,'2025-11-20 12:28:01','2025-11-20 12:28:19'),(51,18,'fill_blank','请填写答案',NULL,'',10.00,NULL,9,'2025-11-20 12:28:08','2025-11-20 12:28:19'),(52,18,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,10,'2025-11-20 12:28:10','2025-11-20 12:28:19'),(53,18,'true_false','新题目','[\"正确\", \"错误\"]','A',10.00,NULL,11,'2025-11-20 12:28:12','2025-11-20 12:28:19'),(54,18,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',10.00,NULL,12,'2025-11-20 12:28:13','2025-11-20 12:28:19'),(55,15,'single_choice','新题目','[\"选项A\", \"选项B\"]','A',17.00,NULL,3,'2025-11-20 12:30:01','2025-11-20 12:30:21');
/*!40000 ALTER TABLE `questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_departments`
--

DROP TABLE IF EXISTS `role_departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=138 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色部门关联表 - 定义每个角色可以查看哪些部门';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_departments`
--

LOCK TABLES `role_departments` WRITE;
/*!40000 ALTER TABLE `role_departments` DISABLE KEYS */;
INSERT INTO `role_departments` VALUES (8,2,1,'2025-11-13 01:15:58'),(9,2,2,'2025-11-13 01:15:58'),(10,2,3,'2025-11-13 01:15:58'),(11,2,4,'2025-11-13 01:15:58'),(12,2,5,'2025-11-13 01:15:58'),(13,2,6,'2025-11-13 01:15:58'),(14,2,7,'2025-11-13 01:15:58'),(68,7,2,'2025-11-13 03:31:47'),(69,7,3,'2025-11-13 03:31:47'),(70,7,4,'2025-11-13 03:31:47'),(71,7,1,'2025-11-13 03:31:47'),(72,7,7,'2025-11-13 03:31:47'),(136,1,1,'2025-11-13 17:36:06'),(137,1,2,'2025-11-13 17:36:06');
/*!40000 ALTER TABLE `role_departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (4,1,29,'2025-11-06 09:58:30'),(5,1,31,'2025-11-06 09:58:30'),(6,1,28,'2025-11-06 09:58:30'),(7,1,30,'2025-11-06 09:58:30'),(8,1,41,'2025-11-06 09:58:30'),(9,1,40,'2025-11-06 09:58:30'),(10,1,12,'2025-11-06 09:58:30'),(11,1,14,'2025-11-06 09:58:30'),(12,1,11,'2025-11-06 09:58:30'),(13,1,13,'2025-11-06 09:58:30'),(14,1,23,'2025-11-06 09:58:30'),(15,1,25,'2025-11-06 09:58:30'),(16,1,22,'2025-11-06 09:58:30'),(17,1,27,'2025-11-06 09:58:30'),(18,1,26,'2025-11-06 09:58:30'),(19,1,24,'2025-11-06 09:58:30'),(20,1,38,'2025-11-06 09:58:30'),(21,1,37,'2025-11-06 09:58:30'),(22,1,39,'2025-11-06 09:58:30'),(24,1,34,'2025-11-06 09:58:30'),(25,1,32,'2025-11-06 09:58:30'),(26,1,33,'2025-11-06 09:58:30'),(27,1,36,'2025-11-06 09:58:30'),(28,1,35,'2025-11-06 09:58:30'),(29,1,19,'2025-11-06 09:58:30'),(30,1,21,'2025-11-06 09:58:30'),(31,1,20,'2025-11-06 09:58:30'),(32,1,10,'2025-11-06 09:58:30'),(33,1,7,'2025-11-06 09:58:30'),(34,1,9,'2025-11-06 09:58:30'),(35,1,6,'2025-11-06 09:58:30'),(36,1,8,'2025-11-06 09:58:30'),(37,1,2,'2025-11-06 09:58:30'),(38,1,4,'2025-11-06 09:58:30'),(39,1,1,'2025-11-06 09:58:30'),(40,1,5,'2025-11-06 09:58:30'),(41,1,3,'2025-11-06 09:58:30'),(64,2,15,'2025-11-06 09:58:30'),(65,2,28,'2025-11-06 09:58:30'),(66,2,40,'2025-11-06 09:58:30'),(67,2,12,'2025-11-06 09:58:30'),(68,2,11,'2025-11-06 09:58:30'),(69,2,13,'2025-11-06 09:58:30'),(70,2,22,'2025-11-06 09:58:30'),(71,2,37,'2025-11-06 09:58:30'),(72,2,36,'2025-11-06 09:58:30'),(73,2,35,'2025-11-06 09:58:30'),(74,2,19,'2025-11-06 09:58:30'),(75,2,6,'2025-11-06 09:58:30'),(76,2,2,'2025-11-06 09:58:30'),(77,2,1,'2025-11-06 09:58:30'),(78,2,5,'2025-11-06 09:58:30'),(79,2,3,'2025-11-06 09:58:30'),(96,1,15,'2025-11-09 13:26:51'),(97,1,16,'2025-11-09 13:26:51'),(98,1,17,'2025-11-09 13:26:51'),(99,1,18,'2025-11-09 13:26:51'),(115,7,15,'2025-11-12 22:49:18'),(116,7,16,'2025-11-12 22:49:18'),(117,7,17,'2025-11-12 22:49:18'),(118,7,18,'2025-11-12 22:49:18');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '角色唯一标识ID，自增主键',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '角色名称，如"超级管理员"、"客服专员"等',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '角色详细描述，说明角色职责和权限范围',
  `level` int NOT NULL DEFAULT '1' COMMENT '角色级别，数字越大权限越高，用于权限继承',
  `is_system` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否为系统内置角色，1-是，0-否，系统角色不可删除',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_level` (`level`),
  KEY `idx_is_system` (`is_system`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表-定义系统中的各种角色类型，用于权限管理和用户分类';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'超级管理员','系统超级管理员，拥有所有权限',10,1,'2025-11-06 09:58:30','2025-11-13 03:33:13'),(2,'系统管理员','系统管理员，负责系统配置和用户管理',8,1,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(3,'部门经理','部门经理，负责部门管理和员工考核',6,0,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(4,'质检员','质检员，负责客服质量检查',5,0,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(5,'客服主管','客服主管，负责客服团队管理',5,0,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(6,'客服专员','客服专员，处理客户咨询',3,0,'2025-11-06 09:58:30','2025-11-06 09:58:30'),(7,'普通员工','普通员工，基础权限',1,0,'2025-11-06 09:58:30','2025-11-06 09:58:30');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedules`
--

DROP TABLE IF EXISTS `schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedules` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '排班记录唯一标识ID',
  `user_id` int NOT NULL COMMENT '员工用户ID，关联users表，级联删除',
  `shift_id` int NOT NULL COMMENT '班次ID，关联shifts表，级联删除',
  `schedule_date` date NOT NULL COMMENT '排班日期，YYYY-MM-DD格式',
  `status` enum('normal','leave','holiday','overtime') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal' COMMENT '排班状态：normal-正常，leave-请假，holiday-节假日，overtime-加班',
  `note` text COLLATE utf8mb4_unicode_ci COMMENT '排班备注，特殊说明或调班原因',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedules`
--

LOCK TABLES `schedules` WRITE;
/*!40000 ALTER TABLE `schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_messages`
--

DROP TABLE IF EXISTS `session_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_messages` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '消息唯一标识ID',
  `session_id` int NOT NULL COMMENT '所属会话ID，关联quality_sessions表，级联删除',
  `sender_type` enum('agent','customer','system') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '发送者类型：agent-客服，customer-客户，system-系统',
  `sender_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '发送者ID，客服为用户ID，客户为客户ID',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息内容，支持文本、表情等',
  `content_type` enum('text','image','file','audio','video') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text' COMMENT '内容类型：text-文本，image-图片，file-文件，audio-音频，video-视频',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_messages`
--

LOCK TABLES `session_messages` WRITE;
/*!40000 ALTER TABLE `session_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_schedules`
--

DROP TABLE IF EXISTS `shift_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=256 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='排班表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_schedules`
--

LOCK TABLES `shift_schedules` WRITE;
/*!40000 ALTER TABLE `shift_schedules` DISABLE KEYS */;
INSERT INTO `shift_schedules` VALUES (2,2,2,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(3,3,3,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(5,2,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(6,3,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(8,2,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(9,3,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(11,2,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(12,3,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(14,2,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(15,3,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(17,2,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(18,3,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(20,2,3,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(21,3,2,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(23,2,1,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(24,3,2,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(26,2,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(27,3,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(29,2,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(30,3,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(32,2,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(33,3,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(35,2,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(36,3,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(38,2,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(39,3,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(41,2,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(42,3,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(90,17,NULL,'2025-11-01',1,'2025-11-12 11:46:29','2025-11-12 11:46:29'),(91,8,NULL,'2025-11-01',1,'2025-11-12 11:46:32','2025-11-12 11:46:32'),(96,11,NULL,'2025-11-01',1,'2025-11-12 11:51:56','2025-11-12 11:51:56'),(98,10,NULL,'2025-11-01',1,'2025-11-12 11:52:53','2025-11-12 11:52:53'),(101,10,NULL,'2025-11-02',1,'2025-11-12 11:57:06','2025-11-12 11:57:06'),(102,10,NULL,'2025-11-03',1,'2025-11-12 11:57:24','2025-11-12 11:57:24'),(103,10,NULL,'2025-11-04',1,'2025-11-12 11:57:28','2025-11-12 11:57:28'),(106,11,NULL,'2025-11-05',1,'2025-11-12 12:00:32','2025-11-12 12:00:32'),(107,11,NULL,'2025-11-11',1,'2025-11-12 12:00:37','2025-11-12 12:00:37'),(111,7,NULL,'2025-11-01',1,'2025-11-12 12:04:36','2025-11-12 12:04:36'),(112,15,4,'2025-11-02',0,'2025-11-12 12:09:35','2025-11-12 13:48:00'),(113,1,NULL,'2025-10-31',1,'2025-11-12 12:29:02','2025-11-12 12:32:27'),(115,1,2,'2025-10-28',0,'2025-11-12 12:29:21','2025-11-12 12:29:21'),(141,1,NULL,'2025-11-30',1,'2025-11-12 13:18:28','2025-11-13 09:48:21'),(152,12,NULL,'2025-11-05',1,'2025-11-12 13:28:26','2025-11-12 13:28:26'),(153,16,NULL,'2025-11-01',1,'2025-11-12 13:34:20','2025-11-12 13:34:20'),(156,16,NULL,'2025-11-03',1,'2025-11-12 13:37:54','2025-11-12 13:37:54'),(157,15,NULL,'2025-11-10',1,'2025-11-12 13:37:59','2025-11-12 13:37:59'),(159,17,4,'2025-11-04',0,'2025-11-12 13:47:48','2025-11-12 13:47:48'),(161,14,4,'2025-11-11',0,'2025-11-12 13:48:09','2025-11-12 13:48:13'),(215,1,NULL,'2025-11-22',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(216,1,NULL,'2025-11-23',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(219,1,NULL,'2025-11-27',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(223,12,NULL,'2025-11-01',1,'2025-11-13 09:17:18','2025-11-13 09:17:18'),(225,13,NULL,'2025-11-05',1,'2025-11-13 09:48:56','2025-11-13 09:48:56'),(233,1,11,'2025-11-01',0,'2025-11-13 11:19:46','2025-11-13 12:18:58'),(236,1,19,'2025-11-08',0,'2025-11-13 12:00:13','2025-11-20 01:50:40'),(237,1,NULL,'2025-11-10',1,'2025-11-13 12:00:16','2025-11-13 12:00:16'),(238,1,12,'2025-11-06',0,'2025-11-13 12:00:22','2025-11-13 12:00:22'),(239,1,9,'2025-11-02',0,'2025-11-13 12:00:30','2025-11-13 12:00:30'),(240,1,NULL,'2025-11-13',1,'2025-11-13 12:05:46','2025-11-13 12:05:46'),(241,1,NULL,'2025-11-15',1,'2025-11-13 12:05:50','2025-11-15 09:22:46'),(242,1,12,'2025-11-18',0,'2025-11-13 12:05:54','2025-11-13 12:05:54'),(243,1,12,'2025-11-20',0,'2025-11-13 12:08:53','2025-11-13 12:08:53'),(244,1,11,'2025-11-04',0,'2025-11-13 12:10:06','2025-11-13 12:18:48'),(245,1,NULL,'2025-11-24',1,'2025-11-13 12:12:22','2025-11-13 12:12:22'),(246,1,NULL,'2025-11-17',1,'2025-11-13 12:18:34','2025-11-13 12:18:34'),(247,1,19,'2025-11-05',0,'2025-11-13 12:18:52','2025-11-20 01:56:59'),(248,13,NULL,'2025-11-01',1,'2025-11-13 12:19:02','2025-11-13 12:19:02'),(249,1,9,'2025-11-09',0,'2025-11-14 08:02:02','2025-11-14 08:02:02'),(250,1,NULL,'2025-11-11',1,'2025-11-14 08:02:07','2025-11-14 08:02:07'),(251,1,11,'2025-11-07',0,'2025-11-14 08:02:15','2025-11-14 08:02:15'),(252,1,12,'2025-11-14',0,'2025-11-14 09:19:40','2025-11-14 09:27:00'),(253,1,9,'2025-11-16',0,'2025-11-16 03:14:48','2025-11-16 03:14:48'),(254,1,11,'2025-12-10',0,'2025-11-20 01:23:33','2025-11-20 01:23:33'),(255,1,10,'2025-11-03',0,'2025-11-20 01:26:07','2025-11-20 01:26:13');
/*!40000 ALTER TABLE `shift_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_schedules_backup`
--

DROP TABLE IF EXISTS `shift_schedules_backup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_schedules_backup` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期（纯日期，无时间部分）',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_schedules_backup`
--

LOCK TABLES `shift_schedules_backup` WRITE;
/*!40000 ALTER TABLE `shift_schedules_backup` DISABLE KEYS */;
INSERT INTO `shift_schedules_backup` VALUES (2,2,2,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(3,3,3,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(5,2,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(6,3,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(8,2,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(9,3,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(11,2,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(12,3,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(14,2,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(15,3,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(17,2,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(18,3,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(20,2,3,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(21,3,2,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(23,2,1,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(24,3,2,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(26,2,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(27,3,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(29,2,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(30,3,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(32,2,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(33,3,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(35,2,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(36,3,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(38,2,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(39,3,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(41,2,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(42,3,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(90,17,NULL,'2025-11-01',1,'2025-11-12 11:46:29','2025-11-12 11:46:29'),(91,8,NULL,'2025-11-01',1,'2025-11-12 11:46:32','2025-11-12 11:46:32'),(96,11,NULL,'2025-11-01',1,'2025-11-12 11:51:56','2025-11-12 11:51:56'),(98,10,NULL,'2025-11-01',1,'2025-11-12 11:52:53','2025-11-12 11:52:53'),(101,10,NULL,'2025-11-02',1,'2025-11-12 11:57:06','2025-11-12 11:57:06'),(102,10,NULL,'2025-11-03',1,'2025-11-12 11:57:24','2025-11-12 11:57:24'),(103,10,NULL,'2025-11-04',1,'2025-11-12 11:57:28','2025-11-12 11:57:28'),(106,11,NULL,'2025-11-05',1,'2025-11-12 12:00:32','2025-11-12 12:00:32'),(107,11,NULL,'2025-11-11',1,'2025-11-12 12:00:37','2025-11-12 12:00:37'),(111,7,NULL,'2025-11-01',1,'2025-11-12 12:04:36','2025-11-12 12:04:36'),(112,15,4,'2025-11-02',0,'2025-11-12 12:09:35','2025-11-12 13:48:00'),(113,1,NULL,'2025-10-31',1,'2025-11-12 12:29:02','2025-11-12 12:32:27'),(115,1,2,'2025-10-28',0,'2025-11-12 12:29:21','2025-11-12 12:29:21'),(141,1,NULL,'2025-11-30',1,'2025-11-12 13:18:28','2025-11-13 09:48:21'),(152,12,NULL,'2025-11-05',1,'2025-11-12 13:28:26','2025-11-12 13:28:26'),(153,16,NULL,'2025-11-01',1,'2025-11-12 13:34:20','2025-11-12 13:34:20'),(156,16,NULL,'2025-11-03',1,'2025-11-12 13:37:54','2025-11-12 13:37:54'),(157,15,NULL,'2025-11-10',1,'2025-11-12 13:37:59','2025-11-12 13:37:59'),(159,17,4,'2025-11-04',0,'2025-11-12 13:47:48','2025-11-12 13:47:48'),(161,14,4,'2025-11-11',0,'2025-11-12 13:48:09','2025-11-12 13:48:13'),(215,1,NULL,'2025-11-22',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(216,1,NULL,'2025-11-23',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(219,1,NULL,'2025-11-27',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(223,12,NULL,'2025-11-01',1,'2025-11-13 09:17:18','2025-11-13 09:17:18'),(225,13,NULL,'2025-11-05',1,'2025-11-13 09:48:56','2025-11-13 09:48:56'),(233,1,NULL,'2025-11-01',1,'2025-11-13 11:19:46','2025-11-13 11:19:46');
/*!40000 ALTER TABLE `shift_schedules_backup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_schedules_backup_20251113`
--

DROP TABLE IF EXISTS `shift_schedules_backup_20251113`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_schedules_backup_20251113` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_schedules_backup_20251113`
--

LOCK TABLES `shift_schedules_backup_20251113` WRITE;
/*!40000 ALTER TABLE `shift_schedules_backup_20251113` DISABLE KEYS */;
INSERT INTO `shift_schedules_backup_20251113` VALUES (2,2,2,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(3,3,3,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(5,2,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(6,3,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(8,2,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(9,3,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(11,2,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(12,3,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(14,2,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(15,3,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(17,2,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(18,3,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(20,2,3,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(21,3,2,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(23,2,1,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(24,3,2,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(26,2,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(27,3,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(29,2,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(30,3,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(32,2,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(33,3,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(35,2,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(36,3,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(38,2,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(39,3,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(41,2,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(42,3,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(90,17,NULL,'2025-11-01',1,'2025-11-12 11:46:29','2025-11-12 11:46:29'),(91,8,NULL,'2025-11-01',1,'2025-11-12 11:46:32','2025-11-12 11:46:32'),(92,17,11,'2025-11-02',0,'2025-11-12 11:46:36','2025-11-12 11:46:36'),(93,8,8,'2025-11-02',0,'2025-11-12 11:46:42','2025-11-12 11:46:42'),(94,9,11,'2025-11-02',0,'2025-11-12 11:46:46','2025-11-12 11:46:46'),(95,9,7,'2025-11-05',0,'2025-11-12 11:46:50','2025-11-12 11:46:50'),(96,11,NULL,'2025-11-01',1,'2025-11-12 11:51:56','2025-11-12 11:51:56'),(98,10,NULL,'2025-11-01',1,'2025-11-12 11:52:53','2025-11-12 11:52:53'),(99,14,11,'2025-11-01',0,'2025-11-12 11:56:19','2025-11-12 12:30:53'),(100,11,12,'2025-11-02',0,'2025-11-12 11:56:42','2025-11-12 12:09:20'),(101,10,NULL,'2025-11-02',1,'2025-11-12 11:57:06','2025-11-12 11:57:06'),(102,10,NULL,'2025-11-03',1,'2025-11-12 11:57:24','2025-11-12 11:57:24'),(103,10,NULL,'2025-11-04',1,'2025-11-12 11:57:28','2025-11-12 11:57:28'),(104,11,12,'2025-11-03',0,'2025-11-12 12:00:07','2025-11-12 12:09:24'),(105,11,5,'2025-11-04',0,'2025-11-12 12:00:11','2025-11-12 12:00:21'),(106,11,NULL,'2025-11-05',1,'2025-11-12 12:00:32','2025-11-12 12:00:32'),(107,11,NULL,'2025-11-11',1,'2025-11-12 12:00:37','2025-11-12 12:00:37'),(108,11,11,'2025-11-12',0,'2025-11-12 12:00:41','2025-11-12 12:00:44'),(111,7,NULL,'2025-11-01',1,'2025-11-12 12:04:36','2025-11-12 12:04:36'),(112,15,4,'2025-11-02',0,'2025-11-12 12:09:35','2025-11-12 13:48:00'),(113,1,NULL,'2025-10-31',1,'2025-11-12 12:29:02','2025-11-12 12:32:27'),(114,1,10,'2025-10-30',0,'2025-11-12 12:29:05','2025-11-12 12:32:32'),(115,1,2,'2025-10-28',0,'2025-11-12 12:29:21','2025-11-12 12:29:21'),(116,1,12,'2025-10-26',0,'2025-11-12 12:29:25','2025-11-12 12:29:25'),(117,1,12,'2025-10-01',0,'2025-11-12 12:29:29','2025-11-12 12:29:29'),(118,1,10,'2025-10-02',0,'2025-11-12 12:29:33','2025-11-12 12:29:33'),(141,1,NULL,'2025-11-30',1,'2025-11-12 13:18:28','2025-11-13 09:48:21'),(150,12,7,'2025-11-03',0,'2025-11-12 13:28:17','2025-11-12 13:28:17'),(151,12,14,'2025-11-04',0,'2025-11-12 13:28:22','2025-11-12 13:28:22'),(152,12,NULL,'2025-11-05',1,'2025-11-12 13:28:26','2025-11-12 13:28:26'),(153,16,NULL,'2025-11-01',1,'2025-11-12 13:34:20','2025-11-12 13:34:20'),(154,16,11,'2025-11-02',0,'2025-11-12 13:34:24','2025-11-12 13:34:24'),(156,16,NULL,'2025-11-03',1,'2025-11-12 13:37:54','2025-11-12 13:37:54'),(157,15,NULL,'2025-11-10',1,'2025-11-12 13:37:59','2025-11-12 13:37:59'),(158,17,5,'2025-11-03',0,'2025-11-12 13:47:37','2025-11-12 13:47:44'),(159,17,4,'2025-11-04',0,'2025-11-12 13:47:48','2025-11-12 13:47:48'),(160,14,9,'2025-11-10',0,'2025-11-12 13:48:05','2025-11-12 13:48:05'),(161,14,4,'2025-11-11',0,'2025-11-12 13:48:09','2025-11-12 13:48:13'),(194,1,11,'2025-11-01',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(195,1,5,'2025-11-02',0,'2025-11-12 14:03:51','2025-11-13 09:46:55'),(196,1,12,'2025-11-03',0,'2025-11-12 14:03:51','2025-11-13 10:07:34'),(197,1,12,'2025-11-04',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(198,1,11,'2025-11-05',0,'2025-11-12 14:03:51','2025-11-13 10:07:40'),(199,1,5,'2025-11-06',0,'2025-11-12 14:03:51','2025-11-13 09:48:49'),(200,1,9,'2025-11-07',0,'2025-11-12 14:03:51','2025-11-13 10:07:43'),(201,1,11,'2025-11-08',0,'2025-11-12 14:03:51','2025-11-13 10:07:48'),(202,1,11,'2025-11-09',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(203,1,7,'2025-11-10',0,'2025-11-12 14:03:51','2025-11-13 10:01:01'),(204,1,NULL,'2025-11-11',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(205,1,10,'2025-11-12',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(206,1,NULL,'2025-11-13',1,'2025-11-12 14:03:51','2025-11-12 19:53:46'),(207,1,12,'2025-11-14',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(208,1,6,'2025-11-15',0,'2025-11-12 14:03:51','2025-11-13 09:47:17'),(209,1,10,'2025-11-16',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(210,1,9,'2025-11-17',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(211,1,11,'2025-11-18',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(212,1,9,'2025-11-19',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(213,1,10,'2025-11-20',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(214,1,9,'2025-11-21',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(215,1,NULL,'2025-11-22',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(216,1,NULL,'2025-11-23',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(217,1,10,'2025-11-24',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(218,1,12,'2025-11-25',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(219,1,NULL,'2025-11-27',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(220,1,12,'2025-11-28',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(221,1,11,'2025-11-29',0,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(222,1,3,'2025-11-26',0,'2025-11-12 15:25:21','2025-11-12 15:25:21'),(223,12,NULL,'2025-11-01',1,'2025-11-13 09:17:18','2025-11-13 09:17:18'),(224,17,11,'2025-11-11',0,'2025-11-13 09:23:01','2025-11-13 09:23:01'),(225,13,NULL,'2025-11-05',1,'2025-11-13 09:48:56','2025-11-13 09:48:56');
/*!40000 ALTER TABLE `shift_schedules_backup_20251113` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_schedules_backup_before_date_fix`
--

DROP TABLE IF EXISTS `shift_schedules_backup_before_date_fix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_schedules_backup_before_date_fix` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_schedules_backup_before_date_fix`
--

LOCK TABLES `shift_schedules_backup_before_date_fix` WRITE;
/*!40000 ALTER TABLE `shift_schedules_backup_before_date_fix` DISABLE KEYS */;
INSERT INTO `shift_schedules_backup_before_date_fix` VALUES (2,2,2,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(3,3,3,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(5,2,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(6,3,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(8,2,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(9,3,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(11,2,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(12,3,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(14,2,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(15,3,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(17,2,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(18,3,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(20,2,3,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(21,3,2,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(23,2,1,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(24,3,2,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(26,2,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(27,3,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(29,2,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(30,3,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(32,2,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(33,3,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(35,2,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(36,3,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(38,2,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(39,3,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(41,2,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(42,3,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(90,17,NULL,'2025-11-01',1,'2025-11-12 11:46:29','2025-11-12 11:46:29'),(91,8,NULL,'2025-11-01',1,'2025-11-12 11:46:32','2025-11-12 11:46:32'),(96,11,NULL,'2025-11-01',1,'2025-11-12 11:51:56','2025-11-12 11:51:56'),(98,10,NULL,'2025-11-01',1,'2025-11-12 11:52:53','2025-11-12 11:52:53'),(101,10,NULL,'2025-11-02',1,'2025-11-12 11:57:06','2025-11-12 11:57:06'),(102,10,NULL,'2025-11-03',1,'2025-11-12 11:57:24','2025-11-12 11:57:24'),(103,10,NULL,'2025-11-04',1,'2025-11-12 11:57:28','2025-11-12 11:57:28'),(106,11,NULL,'2025-11-05',1,'2025-11-12 12:00:32','2025-11-12 12:00:32'),(107,11,NULL,'2025-11-11',1,'2025-11-12 12:00:37','2025-11-12 12:00:37'),(111,7,NULL,'2025-11-01',1,'2025-11-12 12:04:36','2025-11-12 12:04:36'),(112,15,4,'2025-11-02',0,'2025-11-12 12:09:35','2025-11-12 13:48:00'),(113,1,NULL,'2025-10-31',1,'2025-11-12 12:29:02','2025-11-12 12:32:27'),(115,1,2,'2025-10-28',0,'2025-11-12 12:29:21','2025-11-12 12:29:21'),(141,1,NULL,'2025-11-30',1,'2025-11-12 13:18:28','2025-11-13 09:48:21'),(152,12,NULL,'2025-11-05',1,'2025-11-12 13:28:26','2025-11-12 13:28:26'),(153,16,NULL,'2025-11-01',1,'2025-11-12 13:34:20','2025-11-12 13:34:20'),(156,16,NULL,'2025-11-03',1,'2025-11-12 13:37:54','2025-11-12 13:37:54'),(157,15,NULL,'2025-11-10',1,'2025-11-12 13:37:59','2025-11-12 13:37:59'),(159,17,4,'2025-11-04',0,'2025-11-12 13:47:48','2025-11-12 13:47:48'),(161,14,4,'2025-11-11',0,'2025-11-12 13:48:09','2025-11-12 13:48:13'),(204,1,NULL,'2025-11-11',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(206,1,11,'2025-11-13',0,'2025-11-12 14:03:51','2025-11-13 10:16:04'),(215,1,NULL,'2025-11-22',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(216,1,NULL,'2025-11-23',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(219,1,NULL,'2025-11-27',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(222,1,3,'2025-11-26',0,'2025-11-12 15:25:21','2025-11-12 15:25:21'),(223,12,NULL,'2025-11-01',1,'2025-11-13 09:17:18','2025-11-13 09:17:18'),(225,13,NULL,'2025-11-05',1,'2025-11-13 09:48:56','2025-11-13 09:48:56'),(226,1,12,'2025-11-06',0,'2025-11-13 10:15:13','2025-11-13 10:15:17'),(227,1,NULL,'2025-11-04',1,'2025-11-13 10:15:23','2025-11-13 10:15:23'),(228,1,12,'2025-11-08',0,'2025-11-13 10:15:52','2025-11-13 10:15:55');
/*!40000 ALTER TABLE `shift_schedules_backup_before_date_fix` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_schedules_backup_comprehensive`
--

DROP TABLE IF EXISTS `shift_schedules_backup_comprehensive`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_schedules_backup_comprehensive` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期（纯日期，无时间部分）',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_schedules_backup_comprehensive`
--

LOCK TABLES `shift_schedules_backup_comprehensive` WRITE;
/*!40000 ALTER TABLE `shift_schedules_backup_comprehensive` DISABLE KEYS */;
INSERT INTO `shift_schedules_backup_comprehensive` VALUES (2,2,2,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(3,3,3,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(5,2,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(6,3,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(8,2,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(9,3,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(11,2,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(12,3,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(14,2,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(15,3,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(17,2,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(18,3,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(20,2,3,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(21,3,2,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(23,2,1,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(24,3,2,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(26,2,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(27,3,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(29,2,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(30,3,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(32,2,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(33,3,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(35,2,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(36,3,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(38,2,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(39,3,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(41,2,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(42,3,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(90,17,NULL,'2025-11-01',1,'2025-11-12 11:46:29','2025-11-12 11:46:29'),(91,8,NULL,'2025-11-01',1,'2025-11-12 11:46:32','2025-11-12 11:46:32'),(96,11,NULL,'2025-11-01',1,'2025-11-12 11:51:56','2025-11-12 11:51:56'),(98,10,NULL,'2025-11-01',1,'2025-11-12 11:52:53','2025-11-12 11:52:53'),(101,10,NULL,'2025-11-02',1,'2025-11-12 11:57:06','2025-11-12 11:57:06'),(102,10,NULL,'2025-11-03',1,'2025-11-12 11:57:24','2025-11-12 11:57:24'),(103,10,NULL,'2025-11-04',1,'2025-11-12 11:57:28','2025-11-12 11:57:28'),(106,11,NULL,'2025-11-05',1,'2025-11-12 12:00:32','2025-11-12 12:00:32'),(107,11,NULL,'2025-11-11',1,'2025-11-12 12:00:37','2025-11-12 12:00:37'),(111,7,NULL,'2025-11-01',1,'2025-11-12 12:04:36','2025-11-12 12:04:36'),(112,15,4,'2025-11-02',0,'2025-11-12 12:09:35','2025-11-12 13:48:00'),(113,1,NULL,'2025-10-31',1,'2025-11-12 12:29:02','2025-11-12 12:32:27'),(115,1,2,'2025-10-28',0,'2025-11-12 12:29:21','2025-11-12 12:29:21'),(141,1,NULL,'2025-11-30',1,'2025-11-12 13:18:28','2025-11-13 09:48:21'),(152,12,NULL,'2025-11-05',1,'2025-11-12 13:28:26','2025-11-12 13:28:26'),(153,16,NULL,'2025-11-01',1,'2025-11-12 13:34:20','2025-11-12 13:34:20'),(156,16,NULL,'2025-11-03',1,'2025-11-12 13:37:54','2025-11-12 13:37:54'),(157,15,NULL,'2025-11-10',1,'2025-11-12 13:37:59','2025-11-12 13:37:59'),(159,17,4,'2025-11-04',0,'2025-11-12 13:47:48','2025-11-12 13:47:48'),(161,14,4,'2025-11-11',0,'2025-11-12 13:48:09','2025-11-12 13:48:13'),(204,1,12,'2025-11-11',0,'2025-11-12 14:03:51','2025-11-13 11:43:51'),(215,1,NULL,'2025-11-22',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(216,1,NULL,'2025-11-23',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(219,1,NULL,'2025-11-27',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(223,12,NULL,'2025-11-01',1,'2025-11-13 09:17:18','2025-11-13 09:17:18'),(225,13,NULL,'2025-11-05',1,'2025-11-13 09:48:56','2025-11-13 09:48:56'),(233,1,NULL,'2025-11-01',1,'2025-11-13 11:19:46','2025-11-13 11:19:46'),(235,1,9,'2025-11-12',0,'2025-11-13 11:43:58','2025-11-13 11:43:58');
/*!40000 ALTER TABLE `shift_schedules_backup_comprehensive` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_schedules_backup_simple`
--

DROP TABLE IF EXISTS `shift_schedules_backup_simple`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_schedules_backup_simple` (
  `id` int NOT NULL DEFAULT '0',
  `employee_id` int NOT NULL COMMENT '员工ID',
  `shift_id` int DEFAULT NULL COMMENT '班次ID',
  `schedule_date` date NOT NULL COMMENT '排班日期（纯日期，无时间部分）',
  `is_rest_day` tinyint(1) DEFAULT '0' COMMENT '是否休息日',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_schedules_backup_simple`
--

LOCK TABLES `shift_schedules_backup_simple` WRITE;
/*!40000 ALTER TABLE `shift_schedules_backup_simple` DISABLE KEYS */;
INSERT INTO `shift_schedules_backup_simple` VALUES (2,2,2,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(3,3,3,'2025-11-12',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(5,2,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(6,3,3,'2025-11-13',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(8,2,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(9,3,2,'2025-11-14',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(11,2,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(12,3,NULL,'2025-11-15',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(14,2,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(15,3,NULL,'2025-11-16',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(17,2,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(18,3,3,'2025-11-17',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(20,2,3,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(21,3,2,'2025-11-18',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(23,2,1,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(24,3,2,'2025-11-19',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(26,2,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(27,3,2,'2025-11-20',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(29,2,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(30,3,1,'2025-11-21',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(32,2,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(33,3,NULL,'2025-11-22',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(35,2,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(36,3,NULL,'2025-11-23',1,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(38,2,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(39,3,3,'2025-11-24',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(41,2,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(42,3,1,'2025-11-25',0,'2025-11-12 09:35:08','2025-11-12 09:35:08'),(90,17,NULL,'2025-11-01',1,'2025-11-12 11:46:29','2025-11-12 11:46:29'),(91,8,NULL,'2025-11-01',1,'2025-11-12 11:46:32','2025-11-12 11:46:32'),(96,11,NULL,'2025-11-01',1,'2025-11-12 11:51:56','2025-11-12 11:51:56'),(98,10,NULL,'2025-11-01',1,'2025-11-12 11:52:53','2025-11-12 11:52:53'),(101,10,NULL,'2025-11-02',1,'2025-11-12 11:57:06','2025-11-12 11:57:06'),(102,10,NULL,'2025-11-03',1,'2025-11-12 11:57:24','2025-11-12 11:57:24'),(103,10,NULL,'2025-11-04',1,'2025-11-12 11:57:28','2025-11-12 11:57:28'),(106,11,NULL,'2025-11-05',1,'2025-11-12 12:00:32','2025-11-12 12:00:32'),(107,11,NULL,'2025-11-11',1,'2025-11-12 12:00:37','2025-11-12 12:00:37'),(111,7,NULL,'2025-11-01',1,'2025-11-12 12:04:36','2025-11-12 12:04:36'),(112,15,4,'2025-11-02',0,'2025-11-12 12:09:35','2025-11-12 13:48:00'),(113,1,NULL,'2025-10-31',1,'2025-11-12 12:29:02','2025-11-12 12:32:27'),(115,1,2,'2025-10-28',0,'2025-11-12 12:29:21','2025-11-12 12:29:21'),(141,1,NULL,'2025-11-30',1,'2025-11-12 13:18:28','2025-11-13 09:48:21'),(152,12,NULL,'2025-11-05',1,'2025-11-12 13:28:26','2025-11-12 13:28:26'),(153,16,NULL,'2025-11-01',1,'2025-11-12 13:34:20','2025-11-12 13:34:20'),(156,16,NULL,'2025-11-03',1,'2025-11-12 13:37:54','2025-11-12 13:37:54'),(157,15,NULL,'2025-11-10',1,'2025-11-12 13:37:59','2025-11-12 13:37:59'),(159,17,4,'2025-11-04',0,'2025-11-12 13:47:48','2025-11-12 13:47:48'),(161,14,4,'2025-11-11',0,'2025-11-12 13:48:09','2025-11-12 13:48:13'),(215,1,NULL,'2025-11-22',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(216,1,NULL,'2025-11-23',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(219,1,NULL,'2025-11-27',1,'2025-11-12 14:03:51','2025-11-12 14:03:51'),(223,12,NULL,'2025-11-01',1,'2025-11-13 09:17:18','2025-11-13 09:17:18'),(225,13,NULL,'2025-11-05',1,'2025-11-13 09:48:56','2025-11-13 09:48:56'),(233,1,NULL,'2025-11-01',1,'2025-11-13 11:19:46','2025-11-13 11:19:46');
/*!40000 ALTER TABLE `shift_schedules_backup_simple` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '班次唯一标识ID，自增主键',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '班次名称，如"早班"、"中班"、"夜班"',
  `start_time` time NOT NULL COMMENT '班次开始时间，格式HH:MM:SS',
  `end_time` time NOT NULL COMMENT '班次结束时间，格式HH:MM:SS',
  `break_duration` int NOT NULL DEFAULT '0' COMMENT '休息时长，单位分钟，用于计算实际工作时间',
  `color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '班次显示颜色，十六进制颜色代码，用于排班表显示',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '班次详细描述，包括工作内容和要求',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_end_time` (`end_time`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='班次表-定义工作班次信息，用于排班管理和考勤计算';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shifts`
--

LOCK TABLES `shifts` WRITE;
/*!40000 ALTER TABLE `shifts` DISABLE KEYS */;
INSERT INTO `shifts` VALUES (5,'早班','08:00:00','16:00:00',0,NULL,NULL,1,'2025-11-13 19:52:07','2025-11-13 19:52:07'),(6,'中班','16:00:00','00:00:00',0,NULL,NULL,1,'2025-11-13 19:52:07','2025-11-13 19:52:07'),(7,'夜班','00:00:00','08:00:00',0,NULL,NULL,1,'2025-11-13 19:52:07','2025-11-13 19:52:07');
/*!40000 ALTER TABLE `shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shops`
--

DROP TABLE IF EXISTS `shops`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shops` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '店铺名称',
  `platform_id` int NOT NULL COMMENT '所属平台ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `platform_id` (`platform_id`),
  CONSTRAINT `shops_ibfk_1` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shops`
--

LOCK TABLES `shops` WRITE;
/*!40000 ALTER TABLE `shops` DISABLE KEYS */;
INSERT INTO `shops` VALUES (1,'官方旗舰店',1,'2025-11-19 00:59:03'),(2,'品牌专卖店',1,'2025-11-19 00:59:03'),(3,'京东自营',2,'2025-11-19 00:59:03'),(4,'POP店铺',2,'2025-11-19 00:59:03'),(5,'品牌官方店',3,'2025-11-19 00:59:03');
/*!40000 ALTER TABLE `shops` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tag_categories`
--

DROP TABLE IF EXISTS `tag_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tag_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '标签分类唯一标识ID',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称，如"产品类型"、"问题类型"',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '分类详细描述，说明该分类的用途',
  `color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类显示颜色，十六进制颜色代码',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序号，用于分类列表排序显示',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签分类表-标签分类管理表，用于组织标签的层次结构';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tag_categories`
--

LOCK TABLES `tag_categories` WRITE;
/*!40000 ALTER TABLE `tag_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `tag_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '标签唯一标识ID',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '标签名称，如"退款"、"技术故障"',
  `category_id` int DEFAULT NULL COMMENT '所属分类ID，关联tag_categories表',
  `color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签显示颜色，十六进制颜色代码',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '标签详细描述，说明标签的含义',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tags`
--

LOCK TABLES `tags` WRITE;
/*!40000 ALTER TABLE `tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_case_favorites`
--

DROP TABLE IF EXISTS `user_case_favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_case_favorites`
--

LOCK TABLES `user_case_favorites` WRITE;
/*!40000 ALTER TABLE `user_case_favorites` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_case_favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_notification_settings`
--

DROP TABLE IF EXISTS `user_notification_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_notification_settings` (
  `user_id` int NOT NULL,
  `receive_system` tinyint(1) DEFAULT '1',
  `receive_department` tinyint(1) DEFAULT '1',
  `sound_on` tinyint(1) DEFAULT '1',
  `dnd_start` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dnd_end` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toast_duration` int DEFAULT '5000',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_notification_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_notification_settings`
--

LOCK TABLES `user_notification_settings` WRITE;
/*!40000 ALTER TABLE `user_notification_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_notification_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表-用户与角色的多对多关联表，一个用户可以有多个角色';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (2,2,3,'2025-11-06 09:58:30',1),(4,6,2,'2025-11-13 02:25:51',NULL),(5,3,7,'2025-11-13 03:17:05',NULL),(6,12,7,'2025-11-15 10:42:28',NULL),(7,1,1,'2025-11-16 14:50:57',NULL);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_settings`
--

DROP TABLE IF EXISTS `user_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_settings`
--

LOCK TABLES `user_settings` WRITE;
/*!40000 ALTER TABLE `user_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户唯一标识ID，自增主键',
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户登录名，全局唯一，3-50个字符',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户密码的哈希值，使用bcrypt加密',
  `real_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户真实姓名，用于显示和身份识别',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户邮箱地址，可用于找回密码和通知',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户手机号码，支持国内外格式',
  `avatar` text COLLATE utf8mb4_unicode_ci COMMENT '头像(Base64或URL)',
  `department_id` int DEFAULT NULL COMMENT '所属部门ID，关联departments表',
  `status` enum('active','inactive','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '用户状态：active-激活，inactive-禁用，pending-待审核',
  `last_login` datetime DEFAULT NULL COMMENT '最后一次登录时间，用于统计活跃度',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间，用于统计和排序',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
  `session_token` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '当前会话token，用于单设备登录',
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','$2b$10$4WLt4umCNsO/Wcr71VchGeyL4h8VAcTH2OjUzFQSWylC14V533xhS','系统管理员1','admin@leixin.com',NULL,NULL,1,'active','2025-11-20 14:28:45','2025-11-06 09:58:30','2025-11-20 14:28:45','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInNlc3Npb25JZCI6IjFfMTc2MzYyMDEyNTcwNV8xOXZwZzgiLCJpYXQiOjE3NjM2MjAxMjUsImV4cCI6MTc2NDIyNDkyNX0.N9LG8vPgDWND_EkPghxsC4Mlqttas-U2v0xEWpMUnp8','2025-11-20 14:28:45'),(2,'manager','$2b$10$rQZ8vQZ8vQZ8vQZ8vQZ8vOZ8vQZ8vQZ8vQZ8vQZ8vQZ8vQZ8vQZ8v','部门经理','manager@leixin.com',NULL,NULL,3,'active',NULL,'2025-11-06 09:58:30','2025-11-06 09:58:30',NULL,NULL),(3,'zhangsan','$2b$12$cJLjrQ92GAJ6pAsKLbdS8OmO0BoBIbqcAJTsZhppV1KITO0A9pNVq','张三',NULL,NULL,NULL,3,'active','2025-11-15 16:59:23','2025-11-06 10:26:59','2025-11-15 16:59:23','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywidXNlcm5hbWUiOiJ6aGFuZ3NhbiIsInNlc3Npb25JZCI6IjNfMTc2MzE5NzE2Mzk4M19vemMxbHgiLCJpYXQiOjE3NjMxOTcxNjMsImV4cCI6MTc2MzgwMTk2M30.ubtOZ4F1e8y1PJ3J3lhSzROpjX8Exa5P0n2ydMw__D8','2025-11-15 16:59:23'),(4,'lisi','$2b$12$cJLjrQ92GAJ6pAsKLbdS8OmO0BoBIbqcAJTsZhppV1KITO0A9pNVq','李四',NULL,NULL,NULL,NULL,'active','2025-11-14 12:28:03','2025-11-06 10:26:59','2025-11-14 12:28:03',NULL,NULL),(5,'wangwu','$2b$12$cJLjrQ92GAJ6pAsKLbdS8OmO0BoBIbqcAJTsZhppV1KITO0A9pNVq','王五',NULL,NULL,NULL,NULL,'active',NULL,'2025-11-06 10:26:59','2025-11-06 10:26:59',NULL,NULL),(6,'E001','$2b$12$mpZvg7VAG7/HFgNwXPrfiusmwq9QJu9n.0agtw7MSYpgYYv6GPdGW','张三','zhangsan@company.com','13800138001',NULL,4,'active',NULL,'2025-11-06 17:43:32','2025-11-06 17:43:32',NULL,NULL),(7,'E002','$2b$12$FC2TrX2UGNWCcxEUBh4dNOjTI567dgaHgBVeJH8G/r6jVZi51o6.K','李四','lisi@company.com','13800138002',NULL,4,'active',NULL,'2025-11-06 17:43:33','2025-11-06 17:43:33',NULL,NULL),(8,'E003','$2b$12$63HVVwhxOJaqWDq6PTZLMe.3nhPC9L217.0Mxg7zwYifogVI6fm5S','王五','wangwu@company.com','13800138003',NULL,7,'active',NULL,'2025-11-06 17:43:33','2025-11-06 17:43:33',NULL,NULL),(9,'E004','$2b$12$Dxadi1CmUZDZqlZYgqNETepp05t3VmCjB3p/tCsnI7mfo1oW/IbyO','赵六','zhaoliu@company.com','13800138004',NULL,7,'active',NULL,'2025-11-06 17:43:33','2025-11-06 17:43:33',NULL,NULL),(10,'E005','$2b$12$5xTEisrURQRJHBeaoGaku.RuXVYukuYFviRB12DGOY9YWBYreT0Fe','钱七','qianqi@company.com','13800138005',NULL,6,'active',NULL,'2025-11-06 17:43:33','2025-11-06 17:43:33',NULL,NULL),(11,'E006','$2b$12$SUgEsAGByRaMUiWwoxFuk.oe0b6ge8V9qgSSVVsiYUUCJE/8lqiXe','孙八','sunba@company.com','13800138006',NULL,6,'active',NULL,'2025-11-06 17:43:34','2025-11-06 17:43:34',NULL,NULL),(12,'E007','$2b$12$atYi2tV2XRoaI223bTf9DOIPZW7zfcdf4I1dMwyzOkPwag7TQy0PK','周九1','zhoujiu@company.com','13800138007',NULL,2,'active','2025-11-12 23:07:34','2025-11-06 17:43:34','2025-11-15 10:42:28',NULL,NULL),(13,'E008','$2b$12$Wrlrc8N2AeIcrn54JpwIb.ggbGGN1NRZjFuvSFD7FEbR8/aIWq0M.','吴十','wushi@company.com','13800138008',NULL,2,'active',NULL,'2025-11-06 17:43:34','2025-11-06 17:43:34',NULL,NULL),(14,'E009','$2b$12$DAr1aQGGcTcYAAkk/0YYTeABeG0duT8TmdfKmi7hv8ln0BUC6kfMy','郑十一','zhengshiyi@company.com','13800138009',NULL,5,'active',NULL,'2025-11-06 17:43:34','2025-11-06 17:43:34',NULL,NULL),(15,'E010','$2b$12$Kp6vYpDpj4x8XiMzrGVibOP8HtawSm/Czgsfr8SE1dkkUkhPjU/k6','王十二','wangshier@company.com','13800138010',NULL,5,'active',NULL,'2025-11-06 17:43:34','2025-11-06 17:43:34',NULL,NULL),(16,'E011','$2b$12$ewU3Q/R9B4Eu2JMXHSQlue/spA3dAJLvPEZ7QnooEy1ZDZhs0MuiC','刘十三','liushisan@company.com','13800138011','data:image/png;base64,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',4,'active',NULL,'2025-11-06 17:43:35','2025-11-09 11:17:50',NULL,NULL),(17,'E012','$2b$12$DwPPws3QIDpoEvkvMS0nZO//HSg2rsekmQ8sWDNKFjPd6NPFIX9u6','陈十四','chenshisi@company.com','13800138012',NULL,7,'active',NULL,'2025-11-06 17:43:35','2025-11-06 17:43:35',NULL,NULL),(18,'是啊发生的','$2b$12$9yHJkKCTwZMO42ivtFm8/e7jS90vlWVA7YsQlYFbRgg0oS1kUtWEi','12345','419097924@qq.com','18500643805',NULL,4,'active',NULL,'2025-11-08 14:36:32','2025-11-09 10:59:22',NULL,NULL),(19,'pending_cs001','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','张小美','zhangxm@test.com','13800001001',NULL,3,'pending',NULL,'2025-11-08 06:38:01','2025-11-08 06:38:01',NULL,NULL),(20,'pending_cs002','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','李小丽','lixl@test.com','13800001002',NULL,3,'pending',NULL,'2025-11-07 06:38:01','2025-11-07 06:38:01',NULL,NULL),(21,'pending_cs003','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','王小芳','wangxf@test.com','13800001003',NULL,3,'pending',NULL,'2025-11-06 06:38:01','2025-11-06 06:38:01',NULL,NULL),(22,'pending_cs004','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','刘小红','liuxh@test.com','13800001004',NULL,3,'pending',NULL,'2025-11-04 06:38:01','2025-11-04 06:38:01',NULL,NULL),(23,'pending_cs005','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','陈小静','chenxj@test.com','13800001005',NULL,3,'pending',NULL,'2025-11-02 06:38:01','2025-11-02 06:38:01',NULL,NULL),(24,'pending_tech001','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','赵小明','zhaoxm@test.com','13800002001',NULL,4,'pending',NULL,'2025-11-08 06:38:01','2025-11-08 06:38:01',NULL,NULL),(25,'pending_tech002','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','孙小强','sunxq@test.com','13800002002',NULL,4,'pending',NULL,'2025-11-06 06:38:01','2025-11-06 06:38:01',NULL,NULL),(26,'pending_tech003','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','周小伟','zhouxw@test.com','13800002003',NULL,4,'pending',NULL,'2025-11-05 06:38:01','2025-11-05 06:38:01',NULL,NULL),(27,'pending_tech004','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','吴小军','wuxj@test.com','13800002004',NULL,4,'pending',NULL,'2025-11-03 06:38:01','2025-11-03 06:38:01',NULL,NULL),(28,'pending_mkt001','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','郑小娟','zhengxj@test.com','13800003001',NULL,6,'pending',NULL,'2025-11-07 06:38:01','2025-11-07 06:38:01',NULL,NULL),(29,'pending_mkt002','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','冯小华','fengxh@test.com','13800003002',NULL,6,'pending',NULL,'2025-11-05 06:38:01','2025-11-05 06:38:01',NULL,NULL),(30,'pending_mkt003','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','钱小龙','qianxl@test.com','13800003003',NULL,6,'pending',NULL,'2025-11-04 06:38:01','2025-11-04 06:38:01',NULL,NULL),(31,'pending_hr001','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','蒋小敏','jiangxm@test.com','13800004001',NULL,2,'pending',NULL,'2025-11-08 06:38:01','2025-11-08 06:38:01',NULL,NULL),(32,'pending_hr002','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','沈小玲','shenxl@test.com','13800004002',NULL,2,'pending',NULL,'2025-11-06 06:38:01','2025-11-06 06:38:01',NULL,NULL),(33,'pending_hr003','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','韩小雪','hanxx@test.com','13800004003',NULL,2,'pending',NULL,'2025-11-01 06:38:01','2025-11-01 06:38:01',NULL,NULL),(34,'pending_fin001','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','杨小慧','yangxh@test.com','13800005001',NULL,5,'pending',NULL,'2025-11-07 06:38:01','2025-11-07 06:38:01',NULL,NULL),(35,'pending_fin002','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','朱小婷','zhuxt@test.com','13800005002',NULL,5,'pending',NULL,'2025-11-03 06:38:01','2025-11-03 06:38:01',NULL,NULL),(36,'pending_ops001','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','秦小峰','qinxf@test.com','13800006001',NULL,NULL,'pending',NULL,'2025-11-08 06:38:01','2025-11-08 06:38:01',NULL,NULL),(37,'pending_ops002','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','尤小涛','youxt@test.com','13800006002',NULL,NULL,'pending',NULL,'2025-11-05 06:38:01','2025-11-05 06:38:01',NULL,NULL),(38,'pending_ops003','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','许小刚','xuxg@test.com','13800006003',NULL,NULL,'pending',NULL,'2025-11-02 06:38:01','2025-11-02 06:38:01',NULL,NULL),(39,'pending_qa001','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','何小兰','hexl@test.com','13800007001',NULL,NULL,'pending',NULL,'2025-11-07 06:38:01','2025-11-07 06:38:01',NULL,NULL),(40,'pending_qa002','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','吕小梅','lvxm@test.com','13800007002',NULL,NULL,'pending',NULL,'2025-11-04 06:38:01','2025-11-04 06:38:01',NULL,NULL),(41,'pending_qa003','$2b$10$k.tPpvH7d5s93WS8LBarg.vHnNuSP/zgZIztgMyI4fUEtjP4HDKlS','施小云','shixy@test.com','13800007003',NULL,NULL,'pending',NULL,'2025-10-31 06:38:01','2025-10-31 06:38:01',NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vacation_audit_logs`
--

DROP TABLE IF EXISTS `vacation_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vacation_audit_logs`
--

LOCK TABLES `vacation_audit_logs` WRITE;
/*!40000 ALTER TABLE `vacation_audit_logs` DISABLE KEYS */;
INSERT INTO `vacation_audit_logs` VALUES (1,3,3,'balance_adjust','{\"reason\": \"管理员手动调整额度\", \"adjustments\": {\"sick_leave_total\": \"10.00\", \"annual_leave_total\": \"5.00\", \"compensatory_leave_total\": \"0.00\"}}','{\"id\": 1, \"year\": 2025, \"user_id\": 3, \"created_at\": \"2025-11-19T06:28:20.000Z\", \"updated_at\": \"2025-11-19T06:28:20.000Z\", \"employee_id\": 3, \"sick_leave_used\": \"0.00\", \"sick_leave_total\": \"10.00\", \"annual_leave_used\": \"0.00\", \"annual_leave_total\": \"5.00\", \"overtime_hours_total\": \"0.00\", \"compensatory_leave_used\": \"0.00\", \"compensatory_leave_total\": \"0.00\", \"overtime_hours_converted\": \"0.00\"}','{\"id\": 1, \"year\": 2025, \"user_id\": 3, \"created_at\": \"2025-11-19T06:28:20.000Z\", \"updated_at\": \"2025-11-19T06:28:20.000Z\", \"employee_id\": 3, \"sick_leave_used\": \"0.00\", \"sick_leave_total\": \"10.00\", \"annual_leave_used\": \"0.00\", \"annual_leave_total\": \"5.00\", \"overtime_hours_total\": \"0.00\", \"compensatory_leave_used\": \"0.00\", \"compensatory_leave_total\": \"0.00\", \"overtime_hours_converted\": \"0.00\"}',1,'127.0.0.1','2025-11-19 08:10:40'),(2,1,1,'balance_adjust','{\"reason\": \"管理员手动调整额度\", \"adjustments\": {\"sick_leave_total\": \"10.00\", \"annual_leave_total\": 100, \"compensatory_leave_total\": \"0.00\"}}','{\"id\": 6, \"year\": 2025, \"user_id\": 1, \"created_at\": \"2025-11-19T07:00:34.000Z\", \"updated_at\": \"2025-11-19T07:00:34.000Z\", \"employee_id\": 1, \"sick_leave_used\": \"0.00\", \"sick_leave_total\": \"10.00\", \"annual_leave_used\": \"0.00\", \"annual_leave_total\": \"5.00\", \"overtime_hours_total\": \"0.00\", \"compensatory_leave_used\": \"0.00\", \"compensatory_leave_total\": \"0.00\", \"overtime_hours_converted\": \"0.00\"}','{\"id\": 6, \"year\": 2025, \"user_id\": 1, \"created_at\": \"2025-11-19T07:00:34.000Z\", \"updated_at\": \"2025-11-19T08:10:59.000Z\", \"employee_id\": 1, \"sick_leave_used\": \"0.00\", \"sick_leave_total\": \"10.00\", \"annual_leave_used\": \"0.00\", \"annual_leave_total\": \"100.00\", \"overtime_hours_total\": \"0.00\", \"compensatory_leave_used\": \"0.00\", \"compensatory_leave_total\": \"0.00\", \"overtime_hours_converted\": \"0.00\"}',1,'127.0.0.1','2025-11-19 08:10:59');
/*!40000 ALTER TABLE `vacation_audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vacation_balance_changes`
--

DROP TABLE IF EXISTS `vacation_balance_changes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vacation_balance_changes`
--

LOCK TABLES `vacation_balance_changes` WRITE;
/*!40000 ALTER TABLE `vacation_balance_changes` DISABLE KEYS */;
/*!40000 ALTER TABLE `vacation_balance_changes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vacation_balances`
--

DROP TABLE IF EXISTS `vacation_balances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vacation_balances`
--

LOCK TABLES `vacation_balances` WRITE;
/*!40000 ALTER TABLE `vacation_balances` DISABLE KEYS */;
INSERT INTO `vacation_balances` VALUES (1,3,3,2025,5.00,0.00,10.00,0.00,0.00,0.00,0.0,0.0,0.00,0.00,'2025-11-19 06:28:20','2025-11-20 05:00:54',5.00,'2025-11-20 13:00:54','2025-12-31'),(2,3,3,2024,5.00,0.00,10.00,0.00,0.00,0.00,0.0,0.0,0.00,0.00,'2025-11-19 06:36:37','2025-11-20 05:00:54',5.00,'2025-11-20 13:00:54','2024-12-31'),(3,3,3,2023,5.00,0.00,10.00,0.00,0.00,0.00,0.0,0.0,0.00,0.00,'2025-11-19 06:36:38','2025-11-20 05:00:54',5.00,'2025-11-20 13:00:54','2023-12-31'),(4,3,3,2027,5.00,0.00,10.00,0.00,0.00,0.00,0.0,0.0,0.00,0.00,'2025-11-19 06:36:39','2025-11-20 05:00:54',5.00,'2025-11-20 13:00:54','2027-12-31'),(5,3,3,2026,5.00,0.00,10.00,0.00,0.00,0.00,0.0,0.0,0.00,0.00,'2025-11-19 06:36:41','2025-11-20 05:00:54',5.00,'2025-11-20 13:00:54','2026-12-31'),(6,1,1,2025,100.00,0.00,10.00,0.00,0.00,0.00,0.0,0.0,0.00,0.00,'2025-11-19 07:00:34','2025-11-20 05:00:54',100.00,'2025-11-20 13:00:54','2025-12-31'),(7,1,1,2023,5.00,0.00,10.00,0.00,0.00,0.00,0.0,0.0,0.00,0.00,'2025-11-20 00:57:10','2025-11-20 05:00:54',5.00,'2025-11-20 13:00:54','2023-12-31');
/*!40000 ALTER TABLE `vacation_balances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vacation_settings`
--

DROP TABLE IF EXISTS `vacation_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vacation_settings`
--

LOCK TABLES `vacation_settings` WRITE;
/*!40000 ALTER TABLE `vacation_settings` DISABLE KEYS */;
INSERT INTO `vacation_settings` VALUES (1,'overtime_to_leave_ratio','8','加班转调休比例(小时:天)','2025-11-19 06:05:00','2025-11-19 06:05:00'),(2,'annual_leave_default','5','默认年假天数','2025-11-19 06:05:00','2025-11-19 06:05:00'),(3,'sick_leave_default','10','默认病假天数','2025-11-19 06:05:00','2025-11-19 06:05:00'),(4,'approval_levels','1','审批级别(1=单级,2=两级,3=三级)','2025-11-19 06:05:00','2025-11-19 06:05:00');
/*!40000 ALTER TABLE `vacation_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vacation_types`
--

DROP TABLE IF EXISTS `vacation_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='假期类型表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vacation_types`
--

LOCK TABLES `vacation_types` WRITE;
/*!40000 ALTER TABLE `vacation_types` DISABLE KEYS */;
INSERT INTO `vacation_types` VALUES (1,'annual_leave','年假',10.00,1,'法定年假',1,'2025-11-20 10:25:33','2025-11-20 10:25:33'),(2,'compensatory','调休假',0.00,0,'加班调休',1,'2025-11-20 10:25:33','2025-11-20 11:02:19'),(3,'sick_leave','病假',0.00,0,'病假',1,'2025-11-20 10:25:33','2025-11-20 10:25:33'),(4,'personal_leave','事假',0.00,0,'个人事假',1,'2025-11-20 10:25:33','2025-11-20 10:25:33'),(5,'marriage_leave','婚假',3.00,0,'婚假',1,'2025-11-20 10:25:33','2025-11-20 10:25:33'),(6,'maternity_leave','产假',98.00,0,'产假',1,'2025-11-20 10:25:33','2025-11-20 10:25:33'),(7,'paternity_leave','陪产假',15.00,0,'陪产假',1,'2025-11-20 10:25:33','2025-11-20 10:25:33'),(8,'bereavement_leave','丧假',3.00,0,'丧假',1,'2025-11-20 10:25:33','2025-11-20 10:25:33'),(33,'overtime_leave','转换日期',0.00,1,'Leave converted from overtime hours',1,'2025-11-20 11:02:19','2025-11-20 14:08:51');
/*!40000 ALTER TABLE `vacation_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_shifts`
--

DROP TABLE IF EXISTS `work_shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  PRIMARY KEY (`id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_department` (`department_id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='班次表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_shifts`
--

LOCK TABLES `work_shifts` WRITE;
/*!40000 ALTER TABLE `work_shifts` DISABLE KEYS */;
INSERT INTO `work_shifts` VALUES (1,'早班','08:00:00','17:00:00',8.0,30,30,0,'2025-11-12 08:05:31','2025-11-13 10:02:31',NULL,NULL),(2,'中班','12:00:00','21:00:00',8.0,30,30,0,'2025-11-12 08:05:31','2025-11-13 10:02:27',NULL,NULL),(3,'晚班','18:00:00','03:00:00',8.0,30,30,0,'2025-11-12 08:05:31','2025-11-13 10:02:08',NULL,NULL),(4,'弹性班','09:00:00','18:00:00',8.0,60,60,0,'2025-11-12 08:05:31','2025-11-13 10:02:21',NULL,NULL),(5,'早班','08:00:00','17:00:00',8.0,30,30,0,'2025-11-12 08:34:19','2025-11-13 10:02:29',NULL,NULL),(6,'中班','12:00:00','21:00:00',8.0,30,30,0,'2025-11-12 08:34:19','2025-11-13 10:02:17',NULL,NULL),(7,'晚班','18:00:00','03:00:00',8.0,30,30,0,'2025-11-12 08:34:19','2025-11-13 10:02:16',NULL,NULL),(8,'弹性班','09:00:00','18:00:00',8.0,60,60,0,'2025-11-12 08:34:19','2025-11-13 10:02:23',NULL,NULL),(9,'早班','08:00:00','17:00:00',8.0,30,30,1,'2025-11-12 09:21:24','2025-11-13 10:02:54',NULL,NULL),(10,'中班','12:00:00','21:00:00',8.0,30,30,1,'2025-11-12 09:21:24','2025-11-13 10:02:53',NULL,NULL),(11,'晚班','18:00:00','03:00:00',8.0,30,30,1,'2025-11-12 09:21:24','2025-11-13 10:02:52',NULL,NULL),(12,'弹性班','09:00:00','18:00:00',8.0,60,60,0,'2025-11-12 09:21:24','2025-11-20 01:12:55',NULL,NULL),(13,'人事部-早班','08:30:00','17:30:00',8.0,15,15,1,'2025-11-12 10:03:44','2025-11-12 10:03:44',2,'人事部专属早班，工作时间8:30-17:30'),(14,'人事部-晚班','14:00:00','23:00:00',8.0,15,15,1,'2025-11-12 10:03:44','2025-11-12 10:03:44',2,'人事部专属晚班，工作时间14:00-23:00'),(15,'客服部-早班','08:30:00','17:30:00',8.0,15,15,1,'2025-11-12 10:03:44','2025-11-12 10:03:44',3,'客服部专属早班，工作时间8:30-17:30'),(16,'客服部-晚班','14:00:00','23:00:00',8.0,15,15,1,'2025-11-12 10:03:44','2025-11-12 10:03:44',3,'客服部专属晚班，工作时间14:00-23:00'),(17,'市场部-早班','08:30:00','17:30:00',8.0,15,15,1,'2025-11-12 10:03:44','2025-11-12 10:03:44',6,'市场部专属早班，工作时间8:30-17:30'),(18,'市场部-晚班','14:00:00','23:00:00',8.0,15,15,1,'2025-11-12 10:03:44','2025-11-12 10:03:44',6,'市场部专属晚班，工作时间14:00-23:00'),(19,'休息','00:00:00','00:00:00',0.0,0,0,1,'2025-11-20 01:21:35','2025-11-20 01:21:35',NULL,'休息日班次，用于标记员工休息');
/*!40000 ALTER TABLE `work_shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'leixin_customer_service'
--

--
-- Dumping routines for database 'leixin_customer_service'
--

--
-- Current Database: `leixin_customer_service`
--

USE `leixin_customer_service`;

--
-- Final view structure for view `employee_work_duration`
--

/*!50001 DROP VIEW IF EXISTS `employee_work_duration`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `employee_work_duration` AS select `u`.`id` AS `employee_id`,`u`.`username` AS `username`,`u`.`real_name` AS `real_name`,`e`.`hire_date` AS `hire_date`,(case when (`u`.`status` = 'active') then (to_days(curdate()) - to_days(`e`.`hire_date`)) else (select coalesce(max(`esr`.`work_duration_days`),(to_days(curdate()) - to_days(`e`.`hire_date`))) from `employee_status_records` `esr` where ((`esr`.`employee_id` = `u`.`id`) and (`esr`.`new_status` in ('inactive','resigned')))) end) AS `total_work_days`,`u`.`status` AS `current_status`,`u`.`department_id` AS `current_department_id`,`d`.`name` AS `current_department_name` from ((`users` `u` left join `employees` `e` on((`u`.`id` = `e`.`user_id`))) left join `departments` `d` on((`u`.`department_id` = `d`.`id`))) where (`e`.`user_id` is not null) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-21 10:19:06
