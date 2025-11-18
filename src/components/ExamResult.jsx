import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';

const ExamResult = ({ resultId, onBackToMyExams }) => {
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
      const response = await api.get(`/assessment-results/${resultId}`);
      setResult(response.data);
    } catch (error) {
      console.error('获取考试结果失败:', error);
      toast.error('获取考试结果失败');
      onBackToMyExams(); // Go back if failed to load
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-6 text-center text-gray-500">
        无法加载考试结果。
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
    if (!question || !userAnswer) return '未作答';

    switch (question.type) {
      case 'single_choice':
      case 'true_false':
        return userAnswer;
      case 'multiple_choice':
        return userAnswer.split('').sort().join('');
      case 'fill_blank':
      case 'short_answer':
        return userAnswer;
      default:
        return userAnswer;
    }
  };

  const renderCorrectAnswer = (question) => {
    if (!question || !question.correct_answer) return '无';

    switch (question.type) {
      case 'single_choice':
      case 'true_false':
        return question.correct_answer;
      case 'multiple_choice':
        return question.correct_answer.split('').sort().join('');
      case 'fill_blank':
      case 'short_answer':
        return question.correct_answer;
      default:
        return question.correct_answer;
    }
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">考试结果: {result.exam_title}</h2>
            <p className="text-gray-500 text-sm mt-1">考核计划: {result.plan_title}</p>
          </div>
          <button
            onClick={onBackToMyExams}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            返回我的考试
          </button>
        </div>

        {/* 结果概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-sm text-blue-700">总分</p>
            <p className="text-3xl font-bold text-blue-800">{result.total_score}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-sm text-green-700">我的得分</p>
            <p className="text-3xl font-bold text-green-800">{result.score}</p>
          </div>
          <div className={`p-4 rounded-lg text-center ${result.passed ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-sm ${result.passed ? 'text-green-700' : 'text-red-700'}`}>结果</p>
            <p className={`text-3xl font-bold ${result.passed ? 'text-green-800' : 'text-red-800'}`}>
              {result.passed ? '通过' : '未通过'}
            </p>
          </div>
        </div>

        {/* 题目详情 */}
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">题目详情</h3>
        <div className="space-y-8">
          {result.answers.map((userAnswer, index) => {
            const question = userAnswer.question; // Assuming question details are nested
            const isCorrect = userAnswer.is_correct;

            return (
              <div key={question.id} className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-lg font-semibold text-gray-800">
                    {index + 1}. {question.content}
                    <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      {getQuestionTypeLabel(question.type)}
                    </span>
                    <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      {question.score}分
                    </span>
                  </h4>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isCorrect ? '正确' : '错误'}
                  </span>
                </div>

                {question.description && (
                  <p className="text-gray-600 text-sm mb-3">{question.description}</p>
                )}

                {/* 用户答案 */}
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-700">你的答案:</p>
                  <p className={`p-2 rounded-md ${isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {renderAnswer(question, userAnswer.answer_content)}
                  </p>
                </div>

                {/* 正确答案 */}
                <div>
                  <p className="text-sm font-medium text-gray-700">正确答案:</p>
                  <p className="p-2 rounded-md bg-gray-100 text-gray-800">
                    {renderCorrectAnswer(question)}
                  </p>
                </div>

                {/* 选项（如果适用） */}
                {(question.type === 'single_choice' || question.type === 'multiple_choice') && question.options && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700">选项:</p>
                    <ul className="list-disc list-inside text-gray-600">
                      {JSON.parse(question.options).map((option, optIndex) => (
                        <li key={optIndex}>
                          {String.fromCharCode(65 + optIndex)}. {option}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 解析 */}
                {question.explanation && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-md border border-yellow-200">
                    <p className="text-sm font-medium text-yellow-800">解析:</p>
                    <p className="text-sm text-yellow-700">{question.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExamResult;
