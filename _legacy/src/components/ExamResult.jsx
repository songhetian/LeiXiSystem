import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import api from '../api';
import './ExamResult.css';

const ExamResult = ({ resultId, onBackToMyExams, sourceType = 'assessment_plan' }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (resultId) {
      fetchExamResult();
    }
  }, [resultId]);

  const fetchExamResult = async () => {
    setLoading(true);
    try {
      const endpoint = sourceType === 'assessment_plan'
        ? `/assessment-results/${resultId}/result`
        : `/exam-records/${resultId}`;

      const response = await api.get(endpoint);
      const data = response.data.data;
      logger.debug('ExamResult接收到的数据:', data);
      if (data.detailed_questions && data.detailed_questions.length > 0) {
        logger.debug('第一道题目详情(前端):', data.detailed_questions[0]);
      }

      let processedQuestions = [];
      let passed = false;
      let score = 0;
      let totalScore = 0;
      let examTitle = '';
      let planTitle = '';

      if (sourceType === 'assessment_plan') {
        // Assessment plan result structure
        const summary = data.result_summary;
        processedQuestions = data.detailed_questions.map(q => ({
          ...q,
          userAnswer: q.user_answer,
          isCorrect: q.is_correct === 1 // Ensure boolean
        }));
        passed = summary.is_passed;
        score = summary.user_score;
        totalScore = summary.exam_total_score;
        examTitle = summary.exam_title;
        // planTitle might be missing in summary, check data root or summary
        planTitle = summary.plan_title || ''; // API might need to return this in summary
      } else {
        // Exam plan result structure
        // Parse answers if needed
        let userAnswers = {};
        if (data.answers) {
          try {
            userAnswers = typeof data.answers === 'string' ? JSON.parse(data.answers) : data.answers;
          } catch (e) {
            logger.error('Failed to parse answers', e);
          }
        }

        // Process questions to add user answer and correctness
        processedQuestions = data.questions.map(q => {
          const userAns = userAnswers[q.id];
          let isCorrect = false;

          if (q.type === 'single_choice' || q.type === 'true_false') {
            isCorrect = userAns === q.correct_answer;
          } else if (q.type === 'multiple_choice') {
            const correct = q.correct_answer ? q.correct_answer.split('').sort().join('') : '';
            const user = userAns ? userAns.split('').sort().join('') : '';
            isCorrect = user === correct;
          } else if (q.type === 'fill_blank') {
            isCorrect = userAns && q.correct_answer && userAns.trim() === q.correct_answer.trim();
          }

          return {
            ...q,
            userAnswer: userAns,
            isCorrect
          };
        });

        passed = data.score >= data.pass_score;
        score = data.score;
        totalScore = data.total_score || data.exam_total_score;
        examTitle = data.exam_title;
        planTitle = data.plan_title;
      }

      setResult({
        ...data,
        exam_title: examTitle,
        plan_title: planTitle,
        score: score,
        exam_total_score: totalScore,
        questions: processedQuestions,
        passed: passed
      });
    } catch (error) {
      logger.error('获取考试结果失败:', error);
      toast.error('获取考试结果失败');
      onBackToMyExams();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="exam-result-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-primary-600 text-xl">加载中...</div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="exam-result-container">
        <div className="p-6 text-center text-gray-500">
          无法加载考试结果。
        </div>
      </div>
    );
  }

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'single_choice': return '单选题';
      case 'multiple_choice': return '多选题';
      case 'true_false': return '判断题';
      case 'fill_blank': return '填空题';
      case 'short_answer': return '简答题';
      default: return '';
    }
  };

  const renderAnswer = (question, userAnswer) => {
    if (!userAnswer) return '未作答';

    // 调试日志
    if (question.type === 'multiple_choice') {
      logger.debug('多选题答案:', {
        questionId: question.id,
        userAnswer: userAnswer,
        type: typeof userAnswer,
        raw: JSON.stringify(userAnswer)
      });
    }

    switch (question.type) {
      case 'multiple_choice':
        try {
          // 尝试解析JSON数组 ["A", "B"]
          const parsed = JSON.parse(userAnswer);
          if (Array.isArray(parsed)) {
            return parsed.sort().join('');
          }
          // 如果解析成功但不是数组,直接返回
          return String(parsed);
        } catch (e) {
          // 如果不是JSON,可能是已经格式化的字符串如 "AB"
          // 直接返回,不要再split
          return userAnswer;
        }
      default:
        return userAnswer;
    }
  };

  const renderCorrectAnswer = (question) => {
    if (!question.correct_answer) return '无';

    switch (question.type) {
      case 'multiple_choice':
        return question.correct_answer.split('').sort().join('');
      default:
        return question.correct_answer;
    }
  };

  return (
    <div className="exam-result-container">
      <div className="exam-result-card">
        {/* 头部 */}
        <div className="exam-result-header">
          <div>
            <h2 className="exam-result-title">考试结果: {result.exam_title}</h2>
            <p className="exam-result-subtitle">考核计划: {result.plan_title}</p>
          </div>
          <button
            onClick={onBackToMyExams}
            className="back-button"
          >
            返回我的考试
          </button>
        </div>

        {/* 结果概览 */}
        <div className="result-overview">
          <div className="overview-card total">
            <p className="overview-label">总分</p>
            <p className="overview-value total">{result.exam_total_score}</p>
          </div>
          <div className="overview-card score">
            <p className="overview-label">我的得分</p>
            <p className="overview-value score">{result.score}</p>
          </div>
          <div className="overview-card result">
            <p className="overview-label">结果</p>
            <p className={`overview-status ${result.passed ? 'passed' : 'failed'}`}>
              {result.passed ? '通过' : '未通过'}
            </p>
          </div>
        </div>

        {/* 题目详情 */}
        <div className="questions-section">
          <h3 className="questions-title">题目详情</h3>
          <div className="space-y-8">
            {result.questions.map((question, index) => {
              const isCorrect = question.isCorrect;

              return (
                <div key={question.id} className="question-card">
                  <div className="question-header">
                    <h4 className="question-title">
                      {index + 1}. {question.content}
                    </h4>
                    <div className="question-meta">
                      <span className="meta-tag type">
                        {getQuestionTypeLabel(question.type)}
                      </span>
                      <span className="meta-tag score">
                        {question.score}分
                      </span>
                      <span className={`question-status ${isCorrect ? 'correct' : 'incorrect'}`}>
                        {isCorrect ? '正确' : '错误'}
                      </span>
                    </div>
                  </div>

                  {question.description && (
                    <p className="question-description">{question.description}</p>
                  )}

                  {/* 用户答案 */}
                  <div className="answer-section">
                    <p className="answer-label">你的答案:</p>
                    <p className={`answer-content ${isCorrect ? 'correct' : 'incorrect'}`}>
                      {renderAnswer(question, question.userAnswer)}
                    </p>
                  </div>

                  {/* 正确答案 */}
                  {/* 已隐藏正确答案
                  <div className="answer-section">
                    <p className="answer-label">正确答案:</p>
                    <p className="answer-content">
                      {renderCorrectAnswer(question)}
                    </p>
                  </div>
                  */}

                  {/* 选项（如果适用） */}
                  {(question.type === 'single_choice' || question.type === 'multiple_choice') && question.options && (
                    <div className="options-section">
                      <p className="options-label">选项:</p>
                      <ul className="options-list">
                        {question.options.map((option, optIndex) => (
                          <li key={optIndex} className="option-item">
                            {String.fromCharCode(65 + optIndex)}. {option}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 解析 */}
                  {question.explanation && (
                    <div className="explanation-section">
                      <p className="explanation-label">解析:</p>
                      <p className="explanation-content">{question.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamResult;
