import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import Modal from './Modal'; // Assuming a generic Modal component exists
import useAutoSave from '../hooks/useAutoSave'; // Import the useAutoSave hook

const ExamTaking = ({ resultId, onExamEnd, sourceType }) => {
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { questionId: answer }
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [examEnded, setExamEnded] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [visibilityChangeCount, setVisibilityChangeCount] = useState(0);

  const timerRef = useRef(null);
  const fiveMinWarningShown = useRef(false);
  const oneMinWarningShown = useRef(false);

  // Define save function for the hook
  const saveAnswersToBackend = async (id, answers) => {
    const endpoint = sourceType === 'assessment_plan'
      ? `/assessment-results/${id}/answer`
      : `/exam-records/${id}/answer`;
    await api.put(endpoint, { answers });
  };

  // Initialize auto-save hook
  const { debouncedSave, saveToLocalStorage, loadFromLocalStorage } = useAutoSave(
    saveAnswersToBackend,
    resultId,
    1000 // 1 second debounce
  );

  useEffect(() => {
    if (resultId) {
      fetchExamDetails();
    }
  }, [resultId]);

  useEffect(() => {
    if (examStarted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            handleSubmitExam(true); // Auto-submit on timeout
            return 0;
          }

          // Time reminders
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
    } else if (timeLeft === 0 && examStarted) {
      handleSubmitExam(true);
    }

    return () => clearInterval(timerRef.current);
  }, [examStarted, timeLeft]);

  // Page visibility change detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setVisibilityChangeCount((prev) => prev + 1);
        toast.warn('检测到页面切换！请勿离开考试页面，否则可能被记录为作弊行为。');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchExamDetails = async () => {
    setLoading(true);
    try {
      const endpoint = sourceType === 'assessment_plan'
        ? `/assessment-results/${resultId}`
        : `/exam-records/${resultId}`;

      const response = await api.get(endpoint);
      const record = response.data.data;

      setExam({
        title: record.exam_title,
        description: record.plan_title,
        total_score: record.exam_total_score || record.total_score,
        pass_score: record.pass_score,
        duration: record.duration,
      });
      setQuestions(record.questions || []);

      // Restore saved answers from backend first
      let savedAnswers = {};

      // Handle different answer formats
      if (sourceType === 'assessment_plan') {
         savedAnswers = record.saved_answers || {};
      } else {
         if (record.answers) {
            try {
              savedAnswers = typeof record.answers === 'string' ? JSON.parse(record.answers) : record.answers;
            } catch (e) {
              console.error('Failed to parse saved answers', e);
            }
         }
      }

      setUserAnswers(savedAnswers);
      // Initialize local storage with fetched answers
      saveToLocalStorage(savedAnswers);

      // Calculate time left
      const startTime = new Date(record.start_time);
      const now = new Date();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const totalSeconds = record.duration * 60;
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);

      setTimeLeft(remaining);

      if (record.status !== 'in_progress') {
        setExamEnded(true);
        toast.info('该考试已结束');
        onExamEnd(resultId);
        return;
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
      const endpoint = sourceType === 'assessment_plan'
        ? `/assessment-results/${resultId}/submit`
        : `/exam-records/${resultId}/submit`;

      await api.post(endpoint, { isTimeout });
      toast.success(isTimeout ? '考试时间到，已自动提交！' : '考试提交成功！');
      setExamEnded(true);
      onExamEnd(resultId);
    } catch (error) {
      console.error('提交考试失败:', error);
      toast.error('提交考试失败');
      setIsSubmitting(false); // Only reset if failed, otherwise we are done
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

  return (
    <div className="p-6 h-full flex flex-col">
      {showInstructions && (
        <Modal
          isOpen={showInstructions}
          onClose={() => {}} // Instructions modal should not be closable by clicking outside
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
          {/* 顶部考试信息和计时器 */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">{exam.title}</h2>
            <div className="flex items-center gap-4">
              <div className={`text-2xl font-bold ${timeLeft <= 300 ? 'text-red-500 animate-pulse' : 'text-primary-600'}`}>
                剩余时间: {formatTime(timeLeft)}
              </div>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                 {/* Auto-save indicator could be added here if exposed from hook */}
                 答案自动保存中
              </span>
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
            {/* 左侧题目导航 */}
            <div className="w-1/4 bg-white rounded-xl shadow-md p-4 mr-4 overflow-y-auto">
              <h3 className="text-lg font-bold text-gray-800 mb-4">题目导航</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, index) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    disabled={examEnded}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                      ${currentQuestionIndex === index ? 'bg-primary-500 text-white' :
                        userAnswers[q.id] ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* 右侧题目内容 */}
            <div className="flex-1 bg-white rounded-xl shadow-md p-6 overflow-y-auto">
              {examEnded && (
                <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center font-medium">
                  考试已结束，无法继续作答。
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {currentQuestionIndex + 1}. {currentQuestion.content}
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                    {currentQuestion.type === 'single_choice' && '单选题'}
                    {currentQuestion.type === 'multiple_choice' && '多选题'}
                    {currentQuestion.type === 'true_false' && '判断题'}
                    {currentQuestion.type === 'fill_blank' && '填空题'}
                    {currentQuestion.type === 'short_answer' && '简答题'}
                  </span>
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                    {currentQuestion.score}分
                  </span>
                </h3>
                {currentQuestion.description && (
                  <p className="text-gray-600 text-sm mb-4">{currentQuestion.description}</p>
                )}
              </div>

              {/* 答案区域 */}
              <div className="space-y-4">
                {currentQuestion.type === 'single_choice' && (
                  <div className="space-y-2">
                    {JSON.parse(currentQuestion.options).map((option, index) => (
                      <label key={index} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          value={String.fromCharCode(65 + index)}
                          checked={userAnswers[currentQuestion.id] === String.fromCharCode(65 + index)}
                          onChange={() => handleAnswerChange(currentQuestion.id, String.fromCharCode(65 + index))}
                          className="form-radio h-4 w-4 text-primary-600"
                          disabled={examEnded}
                        />
                        <span className="ml-3 text-gray-700">
                          {String.fromCharCode(65 + index)}. {option}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'multiple_choice' && (
                  <div className="space-y-2">
                    {JSON.parse(currentQuestion.options).map((option, index) => (
                      <label key={index} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          name={`question-${currentQuestion.id}`}
                          value={String.fromCharCode(65 + index)}
                          checked={userAnswers[currentQuestion.id]?.includes(String.fromCharCode(65 + index)) || false}
                          onChange={(e) => {
                            const currentSelection = userAnswers[currentQuestion.id] || '';
                            let newSelection;
                            if (e.target.checked) {
                              newSelection = (currentSelection + e.target.value).split('').sort().join('');
                            } else {
                              newSelection = currentSelection.replace(e.target.value, '');
                            }
                            handleAnswerChange(currentQuestion.id, newSelection);
                          }}
                          className="form-checkbox h-4 w-4 text-primary-600"
                          disabled={examEnded}
                        />
                        <span className="ml-3 text-gray-700">
                          {String.fromCharCode(65 + index)}. {option}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'true_false' && (
                  <div className="space-y-2">
                    <label key="true" className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value="A"
                        checked={userAnswers[currentQuestion.id] === 'A'}
                        onChange={() => handleAnswerChange(currentQuestion.id, 'A')}
                        className="form-radio h-4 w-4 text-primary-600"
                        disabled={examEnded}
                      />
                      <span className="ml-3 text-gray-700">A. 正确</span>
                    </label>
                    <label key="false" className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value="B"
                        checked={userAnswers[currentQuestion.id] === 'B'}
                        onChange={() => handleAnswerChange(currentQuestion.id, 'B')}
                        className="form-radio h-4 w-4 text-primary-600"
                        disabled={examEnded}
                      />
                      <span className="ml-3 text-gray-700">B. 错误</span>
                    </label>
                  </div>
                )}

                {currentQuestion.type === 'fill_blank' && (
                  <div>
                    <textarea
                      rows="3"
                      value={userAnswers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="请输入答案"
                      disabled={examEnded}
                    />
                  </div>
                )}

                {currentQuestion.type === 'short_answer' && (
                  <div>
                    <textarea
                      rows="5"
                      value={userAnswers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="请输入答案"
                      disabled={examEnded}
                    />
                  </div>
                )}
              </div>

              {/* 题目切换按钮 */}
              <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0 || examEnded}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  上一题
                </button>
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentQuestionIndex === questions.length - 1 || examEnded}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  下一题
                </button>
              </div>
            </div>
          </div>

          {/* 提交确认Modal */}
          <Modal
            isOpen={showConfirmSubmit}
            onClose={() => setShowConfirmSubmit(false)}
            title="确认提交试卷"
          >
            <div className="space-y-4">
              <p className="text-gray-700">您确定要提交试卷吗？提交后将无法修改。</p>
              <p className="text-sm text-gray-500">
                您还有 {questions.length - Object.keys(userAnswers).length} 道题未作答。
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConfirmSubmit(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitExam(false)}
                  disabled={isSubmitting || examEnded}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {isSubmitting ? '提交中...' : '确认提交'}
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};

export default ExamTaking;
