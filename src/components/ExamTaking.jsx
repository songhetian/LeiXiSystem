import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import Modal from './Modal';
import useAutoSave from '../hooks/useAutoSave';

// 安全解析选项的辅助函数
const parseOptions = (options) => {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  if (typeof options === 'string') {
    try {
      return JSON.parse(options);
    } catch (e) {
      return options.split(/,|，/).map(opt => opt.trim()).filter(Boolean);
    }
  }
  return [];
};

const ExamTaking = ({ resultId, onExamEnd, sourceType = 'assessment_plan' }) => {
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [examEnded, setExamEnded] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [visibilityChangeCount, setVisibilityChangeCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'success' | 'error'
  const [currentPage, setCurrentPage] = useState(1);

  const timerRef = useRef(null);
  const fiveMinWarningShown = useRef(false);
  const oneMinWarningShown = useRef(false);

  // Revert to 10 for production
  const ITEMS_PER_PAGE = 10;

  // Define save function with status tracking
  const saveAnswersToBackend = async (id, answers) => {
    setSaveStatus('saving');
    try {
      // 统一使用 assessment-results 路由
      await api.put(`/assessment-results/${id}/answer`, { answers });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      console.error('Auto-save failed:', error);
      throw error;
    }
  };

  // Initialize auto-save hook with 30-second sync
  const { debouncedSave, saveToLocalStorage, loadFromLocalStorage } = useAutoSave(
    saveAnswersToBackend,
    resultId,
    3000,  // 3 second debounce
    30000  // 30 second sync interval
  );

  // Manual save function
  const handleManualSave = async () => {
    if (!resultId || Object.keys(userAnswers).length === 0) {
      toast.warning('没有需要保存的答案');
      return;
    }

    setSaveStatus('saving');
    try {
      // 统一使用 assessment-results 路由
      await api.put(`/assessment-results/${resultId}/answer`, { answers: userAnswers });
      setSaveStatus('success');
      toast.success('手动保存成功');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      toast.error('手动保存失败，请重试');
      console.error('Manual save failed:', error);
    }
  };

  useEffect(() => {
    if (resultId) {
      fetchExamDetails();
    }
  }, [resultId]);

  useEffect(() => {
    if (examStarted) {
      // Clear any existing timer
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            handleSubmitExam(true);
            return 0;
          }

          // Warnings
          if (prevTime === 300 && !fiveMinWarningShown.current) {
            toast.warn('考试剩余时间不足5分钟，请抓紧时间！');
            fiveMinWarningShown.current = true;
          }
          if (prevTime === 60 && !oneMinWarningShown.current) {
            toast.error('考试剩余时间不足1分钟，即将自动提交！');
            oneMinWarningShown.current = true;
          }

          return prevTime - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examStarted]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setVisibilityChangeCount((prev) => prev + 1);
        toast.warn('检测到页面切换！请勿离开考试页面，否则可能被记录为作弊行为。');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Auto-navigate to page containing current question
  // IMPORTANT: Do NOT include currentPage in dependency array to avoid resetting page when user manually navigates
  useEffect(() => {
    const pageContainingCurrentQuestion = Math.floor(currentQuestionIndex / ITEMS_PER_PAGE) + 1;
    // We can't easily check if page !== currentPage here without adding it to deps
    // But setting state to the same value is generally safe in React (bailout)
    // However, to be cleaner, we can use the functional update form or just set it.
    // Since we want to force navigation when question changes, we just set it.
    setCurrentPage(pageContainingCurrentQuestion);
  }, [currentQuestionIndex, ITEMS_PER_PAGE]);

  const fetchExamDetails = async () => {
    setLoading(true);
    try {
      // 统一使用 assessment-results 路由
      const response = await api.get(`/assessment-results/${resultId}`);
      const record = response.data.data;

      setExam({
        title: record.exam_title,
        description: record.plan_title,
        total_score: record.exam_total_score || record.total_score,
        pass_score: record.pass_score,
        duration: record.duration,
      });

      // 处理题目数据,保持题目ID的原始格式(包括temp_前缀)
      let formattedQuestions = [];
      if (record.questions && Array.isArray(record.questions)) {
        formattedQuestions = record.questions.map(q => {
          // 保持题目ID的原始格式,不做任何转换
          // 这样可以确保答案保存和评分时ID格式一致
          return {
            ...q,
            id: q.id  // 直接使用原始ID,无论是temp_前缀还是数字
          };
        });
      }

      setQuestions(formattedQuestions);

      // 修复：统一从 saved_answers 获取已保存的答案
      let savedAnswers = record.saved_answers || {};

      setUserAnswers(savedAnswers);
      saveToLocalStorage(savedAnswers);

      const startTime = new Date(record.start_time);
      const now = new Date();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const totalSeconds = record.duration * 60;
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);

      setTimeLeft(remaining);

      // 即使状态不是 in_progress，也允许继续考试，但需要重置状态
      if (record.status !== 'in_progress') {
        // 如果状态是 graded 或其他非 in_progress 状态，显示警告但允许继续
        if (record.status === 'graded') {
          toast.warn('检测到考试状态异常，系统将自动修复。');
        } else if (record.status !== 'in_progress') {
          toast.warn(`考试状态为 ${record.status}，请继续作答。`);
        }
        // 不设置 examEnded 为 true，允许用户继续作答
      }
    } catch (error) {
      console.error('获取考试详情失败:', error);
      toast.error('获取考试详情失败');
      onExamEnd(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    setShowInstructions(false);
    setExamStarted(true);
  };

  const handleAnswerChange = (questionId, answer) => {
    if (examEnded) return;

    const newAnswers = {
      ...userAnswers,
      [questionId]: answer,
    };

    setUserAnswers(newAnswers);
    saveToLocalStorage(newAnswers);
    debouncedSave(newAnswers);
  };

  const handleSubmitExam = async (isTimeout = false) => {
    if (isSubmitting || examEnded) return;
    setIsSubmitting(true);
    clearInterval(timerRef.current);

    try {
      // 在提交前,先保存所有答案到后端,确保验证能通过
      console.log('提交前保存所有答案:', userAnswers);
      if (Object.keys(userAnswers).length > 0) {
        await api.put(`/assessment-results/${resultId}/answer`, {
          answers: userAnswers
        });
        console.log('所有答案已保存,开始提交');
      }

      // 统一使用 assessment-results 路由
      await api.post(`/assessment-results/${resultId}/submit`, { isTimeout });
      toast.success(isTimeout ? '考试时间到，已自动提交！' : '考试提交成功！');
      setExamEnded(true);
      onExamEnd(resultId);
    } catch (error) {
      console.error('提交考试失败:', error);
      toast.error(`提交考试失败: ${error.response?.data?.message || error.message}`);
      setIsSubmitting(false);
    } finally {
      setShowConfirmSubmit(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s]
      .map((v) => (v < 10 ? '0' + v : v))
      .filter((v, i) => v !== '00' || i > 0)
      .join(':');
  };

  const handlePageChange = (page) => {
    const totalPages = Math.ceil(questions.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        无法加载考试详情或考试没有题目。
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalPages = Math.ceil(questions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, questions.length);
  const currentPageQuestions = questions.slice(startIndex, endIndex);

  return (
    <div className="p-6 h-full flex flex-col">
      {showInstructions && (
        <Modal
          isOpen={showInstructions}
          onClose={() => { }}
          title="考试须知"
        >
          <div className="space-y-4">
            <p className="text-lg font-medium text-gray-800">考试名称: {exam.title}</p>
            <p className="text-gray-600">描述: {exam.description}</p>
            <p className="text-gray-600">总分: {exam.total_score}分</p>
            <p className="text-gray-600">及格分: {exam.pass_score}分</p>
            <p className="text-gray-600">考试时长: {exam.duration}分钟</p>
            <p className="text-gray-600">题目数量: {questions.length}题</p>
            <h3 className="text-xl font-bold text-gray-800 mt-4">注意事项:</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>考试期间请勿切换页面，否则可能被记录为作弊行为。</li>
              <li>答案将自动保存，但请务必在规定时间内提交。</li>
              <li>考试时间结束后将自动提交试卷。</li>
              <li>请仔细阅读题目，诚信作答。</li>
            </ul>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={handleStartExam}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                我已阅读并开始考试
              </button>
            </div>
          </div>
        </Modal>
      )}

      {!showInstructions && (
        <>
          <div className="bg-white rounded-xl shadow-md p-4 mb-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">{exam.title}</h2>
            <div className="flex items-center gap-4">
              <div className={`text-2xl font-bold ${timeLeft <= 300 ? 'text-red-500 animate-pulse' : 'text-primary-600'}`}>
                剩余时间: {formatTime(timeLeft)}
              </div>
              {saveStatus === 'saving' && (
                <span className="text-sm text-blue-600 flex items-center gap-1">
                  <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                  保存中...
                </span>
              )}
              {saveStatus === 'success' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <span>✓</span> 已保存
                </span>
              )}
              {saveStatus === 'error' && (
                <>
                  <span className="text-sm text-red-600 flex items-center gap-1">
                    <span>✗</span> 保存失败
                  </span>
                  <button
                    onClick={handleManualSave}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    手动保存
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              disabled={isSubmitting || examEnded}
            >
              {isSubmitting ? '提交中...' : '提交试卷'}
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div style={{ width: '280px', minWidth: '280px' }} className="bg-white rounded-xl shadow-md p-4 mr-4 overflow-y-auto flex flex-col">
              <h3 className="text-base font-bold text-gray-800 mb-4">题目导航</h3>

              <div className="grid grid-cols-3 gap-2 mb-4 flex-1">
                {currentPageQuestions.map((q, pageIndex) => {
                  const actualIndex = startIndex + pageIndex;
                  const isAnswered = userAnswers[q.id];
                  const isCurrent = currentQuestionIndex === actualIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(actualIndex)}
                      disabled={examEnded}
                      className={`h-10 rounded flex items-center justify-center text-sm font-medium transition-colors
                        ${isCurrent ? 'bg-primary-500 text-white' :
                          isAnswered ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                            'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {actualIndex + 1}
                    </button>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ←
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-2 py-1 text-xs rounded ${page === currentPage
                          ? 'bg-primary-500 text-white font-bold'
                          : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      →
                    </button>
                  </div>
                  <div className="text-center text-xs text-gray-500">
                    第 {currentPage}/{totalPages} 页
                  </div>
                </div>
              )}

              <div className="mt-auto pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-500"></span>当前</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-100 border border-green-200"></span>已答</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-100 border border-gray-200"></span>未答</span>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-md p-6 overflow-y-auto">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-lg font-bold text-gray-800">{currentQuestionIndex + 1}. {currentQuestion.content}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium
                    ${currentQuestion.type === 'single_choice' ? 'bg-blue-100 text-blue-700' :
                      currentQuestion.type === 'multiple_choice' ? 'bg-purple-100 text-purple-700' :
                        currentQuestion.type === 'true_false' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                    }`}>
                    {currentQuestion.type === 'single_choice' ? '单选题' :
                      currentQuestion.type === 'multiple_choice' ? '多选题' :
                        currentQuestion.type === 'true_false' ? '判断题' :
                          currentQuestion.type === 'fill_blank' ? '填空题' : '简答题'}
                  </span>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                    {currentQuestion.score}分
                  </span>
                </div>

                <div className="space-y-3">
                  {currentQuestion.type === 'single_choice' || currentQuestion.type === 'true_false' ? (
                    parseOptions(currentQuestion.options).map((option, idx) => {
                      const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D...
                      return (
                        <label
                          key={idx}
                          className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all
                          ${userAnswers[currentQuestion.id] === optionLetter
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${currentQuestion.id}`}
                            value={optionLetter}
                            checked={userAnswers[currentQuestion.id] === optionLetter}
                            onChange={() => handleAnswerChange(currentQuestion.id, optionLetter)}
                            disabled={examEnded}
                            className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                          />
                          <span className="ml-3 text-gray-700">{option}</span>
                        </label>
                      );
                    })
                  ) : currentQuestion.type === 'multiple_choice' ? (
                    parseOptions(currentQuestion.options).map((option, idx) => {
                      const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D...
                      const currentAnswers = userAnswers[currentQuestion.id] || [];
                      const isChecked = currentAnswers.includes(optionLetter);
                      return (
                        <label
                          key={idx}
                          className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all
                            ${isChecked
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const newAnswers = e.target.checked
                                ? [...currentAnswers, optionLetter]
                                : currentAnswers.filter(a => a !== optionLetter);
                              handleAnswerChange(currentQuestion.id, newAnswers);
                            }}
                            disabled={examEnded}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                          <span className="ml-3 text-gray-700">{option}</span>
                        </label>
                      );
                    })
                  ) : (
                    <textarea
                      value={userAnswers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      disabled={examEnded}
                      rows={6}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="请输入答案..."
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    const prevIndex = currentQuestionIndex - 1;
                    if (prevIndex >= 0) {
                      setCurrentQuestionIndex(prevIndex);
                    } else {
                      toast.warning('已经是第一题');
                    }
                  }}
                  disabled={currentQuestionIndex === 0}
                  className={`px-6 py-2 rounded-lg transition-colors ${currentQuestionIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-primary-500 text-white hover:bg-primary-600 shadow-md'
                    }`}
                >
                  上一题
                </button>
                <button
                  onClick={() => {
                    const nextIndex = currentQuestionIndex + 1;
                    if (nextIndex < questions.length) {
                      setCurrentQuestionIndex(nextIndex);
                    } else {
                      toast.warning('已经是最后一题');
                    }
                  }}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className={`px-6 py-2 rounded-lg transition-colors ${currentQuestionIndex === questions.length - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-primary-500 text-white hover:bg-primary-600 shadow-md'
                    }`}
                >
                  下一题
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showConfirmSubmit && (
        <Modal
          isOpen={showConfirmSubmit}
          onClose={() => setShowConfirmSubmit(false)}
          title="确认提交"
        >
          <div className="space-y-4">
            <p className="text-gray-800">您确定要提交试卷吗？提交后将无法修改答案。</p>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                已答题目: {Object.keys(userAnswers).length} / {questions.length}
              </p>
              {Object.keys(userAnswers).length < questions.length && (
                <p className="text-sm text-red-600 font-medium mt-1">
                  还有 {questions.length - Object.keys(userAnswers).length} 道题目未作答！
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                继续答题
              </button>
              <button
                onClick={() => handleSubmitExam(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                确认提交
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ExamTaking;
