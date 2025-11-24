-- 考试计划功能数据库迁移
-- 执行日期: 2025-11-24

-- 1. 考试计划表
CREATE TABLE IF NOT EXISTS exam_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL COMMENT '计划标题',
  description TEXT COMMENT '计划描述',

  -- 部门和分类
  department_id INT NOT NULL COMMENT '目标部门ID',
  category_id INT COMMENT '考试分类ID',

  -- 时间配置
  start_time DATETIME NOT NULL COMMENT '开始时间',
  end_time DATETIME NOT NULL COMMENT '结束时间',
  duration INT NOT NULL COMMENT '考试时长（分钟）',

  -- 状态管理
  status ENUM('draft', 'published', 'cancelled') NOT NULL DEFAULT 'draft' COMMENT '计划状态：草稿/已发布/已取消',
  exam_status ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started' COMMENT '考试状态：未开始/进行中/已完成',

  -- 试卷配置
  paper_id INT COMMENT '关联试卷ID',
  total_score DECIMAL(5,2) DEFAULT 100 COMMENT '总分',
  pass_score DECIMAL(5,2) DEFAULT 60 COMMENT '及格分',

  -- 审计字段
  created_by INT NOT NULL COMMENT '创建人',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_department (department_id),
  INDEX idx_status (status, exam_status),
  INDEX idx_time (start_time, end_time),
  INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考试计划表';

-- 2. 试卷表
CREATE TABLE IF NOT EXISTS exam_papers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_id INT NOT NULL COMMENT '考试计划ID',
  paper_code VARCHAR(50) UNIQUE NOT NULL COMMENT '试卷编号',
  title VARCHAR(200) NOT NULL COMMENT '试卷标题',

  -- 试卷内容（JSON格式）
  questions JSON NOT NULL COMMENT '题目列表',
  total_score DECIMAL(5,2) NOT NULL COMMENT '总分',

  -- 生成信息
  generated_by INT NOT NULL COMMENT '生成人',
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_plan (plan_id),
  INDEX idx_code (paper_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='试卷表';

-- 3. 考试记录表
CREATE TABLE IF NOT EXISTS exam_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_id INT NOT NULL COMMENT '考试计划ID',
  paper_id INT NOT NULL COMMENT '试卷ID',
  user_id INT NOT NULL COMMENT '考生ID',

  -- 用户信息（冗余存储）
  user_name VARCHAR(100) NOT NULL COMMENT '考生姓名',
  user_department VARCHAR(100) COMMENT '考生部门',

  -- 考试信息
  start_time DATETIME COMMENT '开始时间',
  submit_time DATETIME COMMENT '提交时间',
  duration INT COMMENT '用时（分钟）',

  -- 答题内容
  answers JSON COMMENT '答题内容',
  score DECIMAL(5,2) COMMENT '得分',

  -- 状态
  status ENUM('not_started', 'in_progress', 'submitted', 'graded') DEFAULT 'not_started' COMMENT '记录状态',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_plan_user (plan_id, user_id),
  INDEX idx_status (status),
  INDEX idx_paper (paper_id),
  UNIQUE KEY uk_plan_user (plan_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考试记录表';

-- 4. 状态变更日志表
CREATE TABLE IF NOT EXISTS exam_plan_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_id INT NOT NULL COMMENT '考试计划ID',
  operator_id INT NOT NULL COMMENT '操作人ID',
  operator_name VARCHAR(100) COMMENT '操作人姓名',
  action VARCHAR(50) NOT NULL COMMENT '操作类型',
  old_status VARCHAR(50) COMMENT '旧状态',
  new_status VARCHAR(50) COMMENT '新状态',
  remark TEXT COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_plan (plan_id),
  INDEX idx_operator (operator_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考试计划状态变更日志表';

-- 说明
-- 1. exam_plans: 考试计划主表，包含两个状态字段
--    - status: 计划状态（草稿/已发布/已取消）
--    - exam_status: 考试状态（未开始/进行中/已完成）
-- 2. exam_papers: 试卷表，存储生成的试卷内容
-- 3. exam_records: 考试记录表，记录每个用户的考试情况
-- 4. exam_plan_logs: 状态变更日志表，记录所有状态变更
