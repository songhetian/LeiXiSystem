# 考核系统需求文档

## 系统概述

考核系统用于对客服人员进行知识和技能考核，包括考试管理、题库管理、考试记录和成绩统计等功能。

## 核心功能模块

### 1. 考试管理
- 创建考试（标题、描述、分类、难度、时长、总分、及格分）
- 编辑考试信息
- 删除考试
- 发布/下架考试
- 查看考试列表
- 考试详情查看

### 2. 题库管理
- 添加题目（单选、多选、判断、填空、简答）
- 编辑题目
- 删除题目
- 题目排序
- 题目分类
- 题目难度标记
- 批量导入题目

### 3. 考试参与
- 查看可参加的考试列表
- 开始考试
- 答题界面（倒计时、题目导航）
- 暂存答案
- 提交考试
- 查看考试结果

### 4. 成绩管理
- 查看个人考试记录
- 查看考试成绩
- 查看错题解析
- 成绩统计图表
- 导出成绩报告

### 5. 统计分析
- 考试通过率统计
- 平均分统计
- 题目正确率分析
- 考生排名
- 部门成绩对比

## 数据库设计

### 考试表 (exams)
- id: 考试ID
- title: 考试标题
- description: 考试描述
- category: 考试分类
- difficulty: 难度（easy/medium/hard）
- duration: 考试时长（分钟）
- total_score: 总分
- pass_score: 及格分
- question_count: 题目数量
- status: 状态（draft/published/archived）
- created_by: 创建人
- created_at: 创建时间
- updated_at: 更新时间

### 题目表 (questions)
- id: 题目ID
- exam_id: 所属考试ID
- type: 题目类型（single/multiple/judge/fill/essay）
- content: 题目内容
- options: 选项（JSON）
- correct_answer: 正确答案
- score: 分值
- explanation: 解析
- order_num: 排序号
- created_at: 创建时间

### 考试记录表 (exam_records)
- id: 记录ID
- exam_id: 考试ID
- user_id: 考生ID
- start_time: 开始时间
- end_time: 结束时间
- duration: 实际用时（分钟）
- total_score: 总分
- score: 得分
- pass_status: 是否通过
- status: 状态（in_progress/completed/timeout）
- created_at: 创建时间

### 答题记录表 (answer_records)
- id: 记录ID
- exam_record_id: 考试记录ID
- question_id: 题目ID
- user_answer: 用户答案
- is_correct: 是否正确
- score: 得分
- created_at: 创建时间

### 考试分类表 (exam_categories)
- id: 分类ID
- name: 分类名称
- description: 分类描述
- icon: 图标
- created_at: 创建时间

## 用户角色权限

### 管理员
- 创建/编辑/删除考试
- 管理题库
- 查看所有考试记录
- 导出统计报告

### 考生
- 查看可参加的考试
- 参加考试
- 查看个人成绩
- 查看错题解析

## 技术要点

### 前端
- React 组件化开发
- 考试倒计时功能
- 题目导航和标记
- 答案自动保存
- 成绩图表展示（Chart.js）

### 后端
- RESTful API 设计
- 考试时间控制
- 自动评分算法
- 成绩统计计算
- 数据导出功能

## 用户体验优化

1. **考试前**
   - 显示考试规则和注意事项
   - 显示考试时长和题目数量
   - 确认开始考试

2. **考试中**
   - 实时倒计时提醒
   - 题目完成进度显示
   - 答案自动保存
   - 可标记题目稍后回答
   - 时间不足提醒

3. **考试后**
   - 立即显示成绩
   - 显示正确率和排名
   - 提供错题解析
   - 可下载成绩单

## 安全性考虑

1. 防止作弊
   - 考试时间严格控制
   - 答案加密传输
   - 防止页面刷新丢失答案
   - 记录考试过程日志

2. 数据安全
   - 考试答案加密存储
   - 成绩数据权限控制
   - 操作日志记录

## 性能优化

1. 题目分页加载
2. 答案本地缓存
3. 图表懒加载
4. 数据库索引优化
5. 查询结果缓存
