# 考核系统功能清单（实现与集成状态）

## 已完成功能（后端）
- 试卷管理
  - GET /api/exams（分页/筛选/搜索）
  - GET /api/exams/:id 试卷详情
  - POST /api/exams 创建
  - PUT /api/exams/:id 更新
  - DELETE /api/exams/:id 删除（含关联校验）
  - PUT /api/exams/:id/status 状态更新（发布/归档校验）
- 题目管理
  - GET /api/exams/:examId/questions 列表（管理员答案可见）
  - GET /api/questions/:id 详情
  - POST /api/exams/:examId/questions 添加（验证题型/选项/答案）
  - PUT /api/questions/:id 更新（重算总分）
  - DELETE /api/questions/:id 删除（校验答题记录/重排序号）
  - PUT /api/exams/:examId/questions/reorder 排序
- 考核计划
  - GET /api/assessment-plans 列表（分页筛选）
  - GET /api/assessment-plans/:id 详情（含参与统计）
  - POST /api/assessment-plans 创建（发布试卷校验）
  - PUT /api/assessment-plans/:id 更新
  - DELETE /api/assessment-plans/:id 删除（含级联）
  - PUT /api/assessment-plans/:id/status 状态流转
  - GET /api/assessment-plans/:id/participants 参与者列表
- 考试参与与结果
  - GET /api/my-exams 我的考试列表
  - POST /api/assessment-results/start 开始考试
  - GET /api/assessment-results/:id 考试进度
  - PUT /api/assessment-results/:id/answer 保存答案
  - POST /api/assessment-results/:id/submit 提交考试（自动评分/汇总）
  - GET /api/assessment-results/:id/result 查看考试结果（摘要+题目明细）
  - GET /api/assessment-results 管理员获取所有考试记录
  - PUT /api/assessment-results/:id/grade 人工评分
  - GET /api/assessment-results/:id/answers 答题详情
- 统计分析
  - GET /api/statistics/exam-overview 考试概览
  - GET /api/statistics/exam/:examId 单卷统计
  - GET /api/statistics/user/:userId 用户统计
  - GET /api/statistics/department 部门对比
  - GET /api/statistics/questions/:examId 题目分析
  - GET /api/statistics/ranking 排名
- 核心支持
  - GET /api/time/server 服务器时间同步

## 已完成功能（前端）
- 页面与组件已覆盖 ExamList/ExamForm/ExamDetail/DragDropExamBuilder、QuestionList/QuestionEditor/QuestionImport、AssessmentPlanList/Detail/Form、MyExamList/ExamInstructions/ExamTaking/ExamResult、MyResults/AnswerDetail/ResultManagement、ExamStatistics 等。
- 修复与适配：
  - ExamTaking 自动保存与 Hook 契约统一，正确上报 question_id 与答案值
  - MyExamList 读取 data.exams
  - ExamStatistics 映射 pass_rate→overall_pass_rate；排名读取 data.results
  - ExamResult 读取 result_summary/detailed_questions 并更新图表数据源

## 待优化/改进项
- 交互优化：操作确认对话框、Toast、快捷键、题目虚拟滚动与分页
- 统计趋势：后端 /api/statistics/score-trend 或前端占位说明
- 拖拽组卷：批量添加题目支持（UI+后端批量接口）
- 防作弊：页面切换上报、异常行为提示与日志

## 测试与覆盖率
- 建议引入 Vitest + React Testing Library（前端）与 Supertest（后端），配置 c8 覆盖率阈值≥80%
- 测试范围：API 路由（含校验与状态转换）、评分算法边界、答题保存与提交、倒计时提醒、统计页面呈现

## 变更摘要
- 新增：GET /api/exams；POST /api/assessment-results/:id/submit；GET /api/time/server
- 前端：修复 ExamTaking 自动保存；适配我的考试、统计仪表板与考试结果页面数据结构

## 验证建议
- 启动后端与前端，走通：我的考试→开始考试→答题保存→提交评分→查看结果→统计页面
- 运行测试套件并生成覆盖率报告（HTML 与文本），将报告归档到 docs/

更新时间：自动生成