import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Space, message, Spin, Progress, Modal, Typography, Radio, Checkbox, Input, Drawer, Skeleton, Tag } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, FlagOutlined, ClockCircleOutlined, MenuOutlined, SaveOutlined, CheckCircleOutlined, ExclamationCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

const { Title, Text } = Typography;
const RadioGroup = Radio.Group;
const CheckboxGroup = Checkbox.Group;
const { TextArea } = Input;

import useExamTimer from '../../hooks/useExamTimer';
import useAutoSave from '../../hooks/useAutoSave';
import useExamLogger from '../../hooks/useExamLogger';
import QuestionNav from '../../components/QuestionNav';
import LazyImageRenderer from '../../components/LazyImageRenderer';

const ExamTaking = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [examData, setExamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { questionId: answer }
  const [markedQuestions, setMarkedQuestions] = useState({}); // { questionId: true/false }
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'success' | 'error'

  const { timeLeft, formatTime, setIsRunning, pageSwitchCount } = useExamTimer(
    examData?.remaining_time || 0,
    () => handleSubmitExam(true), // Auto-submit on timer end
    resultId
  );

  const { sendLog } = useExamLogger(resultId, () => handleSubmitExam(true));

  const saveAnswerToBackend = useCallback(async (questionId, answer) => {
    if (!resultId || !questionId) return;
    setSaveStatus('saving');
    try {
      await axios.put(`/api/assessment-results/${resultId}/answer`, {
        question_id: questionId,
        user_answer: answer,
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
      sendLog('ANSWER_SAVED', { questionId, answer });
    } catch (error) {
      setSaveStatus('error');
      console.error('Auto-save failed:', error);
      sendLog('ANSWER_SAVE_FAILED', { questionId, answer, error: error.message });
    }
  }, [resultId, sendLog]);

  const { debouncedSave, isSaving, saveError } = useAutoSave(saveAnswerToBackend, resultId, 3000, 30000);

  // Manual save function
  const handleManualSave = async () => {
    if (!resultId || Object.keys(userAnswers).length === 0) {
      message.warning('没有需要保存的答案');
      return;
    }

    setSaveStatus('saving');
    try {
      // Save all answers
      for (const [questionId, answer] of Object.entries(userAnswers)) {
        await axios.put(`/api/assessment-results/${resultId}/answer`, {
          question_id: questionId,
          user_answer: answer,
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
      }
      setSaveStatus('success');
      message.success('手动保存成功');
      setTimeout(() => setSaveStatus('idle'), 2000);
      sendLog('MANUAL_SAVE_SUCCESS');
    } catch (error) {
      setSaveStatus('error');
      message.error('手动保存失败，请重试');
      console.error('Manual save failed:', error);
      sendLog('MANUAL_SAVE_FAILED', { error: error.message });
    }
  };

  useEffect(() => {
    fetchExamProgress();
  }, [resultId]);

  useEffect(() => {
    if (examData && examData.remaining_time !== undefined) {
      setIsRunning(true);
    }
  }, [examData?.remaining_time]);

  // Responsive check
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchExamProgress = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/assessment-results/${resultId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = response.data.data;
      console.log('[ExamTaking] 接收到的 saved_answers:', data.saved_answers);
      setExamData(data);
      setUserAnswers(data.saved_answers || {});
      console.log('[ExamTaking] 设置 userAnswers 为:', data.saved_answers || {});
    } catch (error) {
      message.error(`获取考试进度失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to fetch exam progress:', error);
      navigate('/assessment/my-exams'); // Go back if failed to load exam
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    const formattedAnswer = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
    setUserAnswers((prev) => ({ ...prev, [questionId]: formattedAnswer }));
    debouncedSave(questionId, formattedAnswer);
    sendLog('ANSWER_CHANGED', { questionId, answer: formattedAnswer });
  };

  const handleNextQuestion = () => {
    const totalQuestions = examData.questions.length;
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      sendLog('QUESTION_NAVIGATED', { from: currentQuestionIndex, to: currentQuestionIndex + 1, direction: 'next' });
    } else {
      message.warning('已经是最后一题');
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      sendLog('QUESTION_NAVIGATED', { from: currentQuestionIndex, to: currentQuestionIndex - 1, direction: 'prev' });
    } else {
      message.warning('已经是第一题');
    }
  };

  const handleJumpToQuestion = (index) => {
    setCurrentQuestionIndex(index);
    if (isMobile) {
      setDrawerVisible(false); // Close drawer after jumping
    }
  };

  const handleToggleMark = (questionId) => {
    setMarkedQuestions((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const handleSubmitExam = async (isTimeout = false) => {
    setLoading(true);
    setIsRunning(false); // Stop the timer
    debouncedSave.cancel?.(); // Cancel any pending auto-saves

    try {
      // 在提交前,先保存所有答案到后端,确保验证能通过
      console.log('提交前保存所有答案:', userAnswers);
      if (Object.keys(userAnswers).length > 0) {
        await axios.put(`/api/assessment-results/${resultId}/answer`, {
          answers: userAnswers
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        console.log('所有答案已保存,开始提交');
      }

      await axios.post(`/api/assessment-results/${resultId}/submit`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success(isTimeout ? '考试时间到，已自动提交' : '考试提交成功');
      sendLog(isTimeout ? 'EXAM_AUTO_SUBMIT_TIMEOUT' : 'EXAM_SUBMITTED', { isTimeout });
      navigate(`/assessment/results/${resultId}/result`);
    } catch (error) {
      message.error(`提交考试失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to submit exam:', error);
      sendLog('EXAM_SUBMIT_FAILED', { error: error.message });
    } finally {
      setLoading(false);
      setSubmitModalVisible(false);
    }
  };

  const showSubmitConfirmModal = () => {
    const unansweredCount = examData.questions.filter(q => !userAnswers[q.id]).length;
    sendLog('SUBMIT_CONFIRM_OPENED', { unansweredCount });
    Modal.confirm({
      title: '确认提交考试？',
      content: unansweredCount > 0 ? `您还有 ${unansweredCount} 道题目未作答，确定要提交吗？` : '您已完成所有题目，确定要提交吗？',
      okText: '确定提交',
      cancelText: '取消',
      onOk: () => {
        sendLog('SUBMIT_CONFIRM_ACCEPTED');
        handleSubmitExam();
      },
      onCancel: () => {
        sendLog('SUBMIT_CONFIRM_CANCELLED');
      },
    });
  };

  // Render save status indicator
  const renderSaveStatus = () => {
    if (saveStatus === 'saving' || isSaving) {
      return (
        <Tag icon={<LoadingOutlined />} color="processing">
          保存中...
        </Tag>
      );
    }
    if (saveStatus === 'success') {
      return (
        <Tag icon={<CheckCircleOutlined />} color="success">
          已保存
        </Tag>
      );
    }
    if (saveStatus === 'error' || saveError) {
      return (
        <Tag icon={<ExclamationCircleOutlined />} color="error">
          保存失败
        </Tag>
      );
    }
    return null;
  };

  if (loading || !examData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Top Toolbar Skeleton */}
        <Card style={{ width: '100%', position: 'fixed', top: 0, zIndex: 100, borderRadius: 0 }} bodyStyle={{ padding: '10px 24px' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Skeleton.Input style={{ width: 200 }} active />
            <Space>
              <Skeleton.Avatar size="small" active />
              <Skeleton.Input style={{ width: 80 }} active />
              <Skeleton.Input style={{ width: 120 }} active />
              <Skeleton.Input style={{ width: 50 }} active />
              <Skeleton.Button active />
            </Space>
          </Space>
        </Card>

        <div style={{ display: 'flex', flex: 1, paddingTop: 64, overflow: 'hidden' }}>
          {/* Side Navigation Skeleton */}
          {!isMobile && (
            <Card style={{ width: 140, flexShrink: 0, overflowY: 'auto', borderRadius: 0 }}>
              <Skeleton active paragraph={{ rows: 10 }} />
            </Card>
          )}

          {/* Question Display Area Skeleton */}
          <div style={{ flex: 1, padding: isMobile ? 16 : 24, overflowY: 'auto' }}>
            <Card>
              <Skeleton active paragraph={{ rows: 5 }} />
              <Skeleton active paragraph={{ rows: 8 }} style={{ marginTop: 24 }} />
              <Space style={{ marginTop: 24, justifyContent: 'space-between', width: '100%' }}>
                <Skeleton.Button active />
                <Skeleton.Button active />
                <Skeleton.Button active />
              </Space>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = examData.questions[currentQuestionIndex];
  const answeredCount = Object.keys(userAnswers).filter(qId => userAnswers[qId] !== undefined && userAnswers[qId] !== null && userAnswers[qId] !== '').length;
  const totalQuestions = examData.questions.length;
  const progressPercent = (answeredCount / totalQuestions) * 100;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  const renderAnswerInput = (question) => {
    const currentAnswer = userAnswers[question.id];
    try {
      let parsedAnswer = currentAnswer;
      if (currentAnswer && (question.type === 'multiple_choice' || question.type === 'fill_blank')) {
        parsedAnswer = JSON.parse(currentAnswer);
      }

      switch (question.type) {
        case 'single_choice':
          return (
            <RadioGroup
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              value={parsedAnswer}
            >
              <Space direction="vertical">
                {question.options?.map((option, index) => {
                  const optionLetter = String.fromCharCode(65 + index); // A, B, C, D...
                  return (
                    <Radio key={index} value={optionLetter}>
                      {option}
                    </Radio>
                  );
                })}
              </Space>
            </RadioGroup>
          );
        case 'multiple_choice':
          // 将选项转换为字母索引格式
          const checkboxOptions = question.options?.map((option, index) => ({
            label: option,
            value: String.fromCharCode(65 + index) // A, B, C, D...
          }));
          return (
            <CheckboxGroup
              options={checkboxOptions}
              onChange={(checkedValues) => handleAnswerChange(question.id, checkedValues)}
              value={parsedAnswer || []}
            />
          );
        case 'true_false':
          return (
            <RadioGroup
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              value={parsedAnswer}
            >
              <Space direction="vertical">
                <Radio value="A">正确</Radio>
                <Radio value="B">错误</Radio>
              </Space>
            </RadioGroup>
          );
        case 'fill_blank':
          const blankCount = (question.content.match(/____/g) || []).length || 1;
          const currentFillBlanks = Array.isArray(parsedAnswer) ? parsedAnswer : Array(blankCount).fill('');

          return (
            <Space direction="vertical" style={{ width: '100%' }}>
              {Array.from({ length: blankCount }).map((_, index) => (
                <Input
                  key={index}
                  placeholder={`填空 ${index + 1}`}
                  value={currentFillBlanks[index]}
                  onChange={(e) => {
                    const newBlanks = [...currentFillBlanks];
                    newBlanks[index] = e.target.value;
                    handleAnswerChange(question.id, newBlanks);
                  }}
                />
              ))}
            </Space>
          );
        case 'essay':
          return (
            <TextArea
              rows={8}
              placeholder="请输入您的答案"
              value={parsedAnswer}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            />
          );
        default:
          return <Text type="danger">未知题型</Text>;
      }
    } catch (e) {
      console.error("Error rendering answer input or parsing answer:", e);
      return <Text type="danger">答案解析错误</Text>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <Card
        style={{ width: '100%', position: 'fixed', top: 0, zIndex: 100, borderRadius: 0 }}
        bodyStyle={{ padding: '10px 24px' }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            {isMobile && (
              <Button icon={<MenuOutlined />} onClick={() => setDrawerVisible(true)} />
            )}
            <Title level={4} style={{ margin: 0 }}>{examData.exam_title}</Title>
          </Space>
          <Space>
            <ClockCircleOutlined />
            <Text strong style={{ color: timeLeft <= 300 ? 'red' : 'inherit' }}>
              {formatTime(timeLeft)}
            </Text>
            {renderSaveStatus()}
            {saveStatus === 'error' && (
              <Button
                size="small"
                icon={<SaveOutlined />}
                onClick={handleManualSave}
                type="link"
              >
                手动保存
              </Button>
            )}
            <Progress percent={progressPercent} size="small" style={{ width: 120, margin: 0 }} />
            <Text>{answeredCount}/{totalQuestions}</Text>
            <Button type="primary" onClick={showSubmitConfirmModal}>提交考试</Button>
          </Space>
        </Space>
      </Card>

      <div style={{ display: 'flex', flex: 1, paddingTop: 64, overflow: 'hidden' }}>
        {/* Side Navigation - Width reduced from 200px to 140px (30% reduction) */}
        {!isMobile && (
          <Card style={{ width: 140, flexShrink: 0, overflowY: 'auto', borderRadius: 0 }}>
            <QuestionNav
              questions={examData.questions}
              currentQuestionIndex={currentQuestionIndex}
              onQuestionChange={handleJumpToQuestion}
              answeredQuestions={new Set(Object.keys(userAnswers).filter(qId => userAnswers[qId] !== undefined && userAnswers[qId] !== null && userAnswers[qId] !== ''))}
              markedQuestions={new Set(Object.keys(markedQuestions).filter(qId => markedQuestions[qId]))}
              onToggleMark={handleToggleMark}
            />
          </Card>
        )}

        {/* Question Display Area */}
        <div style={{ flex: 1, padding: isMobile ? 16 : 24, overflowY: 'auto' }}>
          <Card>
            <Title level={5}>
              {currentQuestionIndex + 1}. [{currentQuestion.type}] (分值: {currentQuestion.score})
            </Title>
            <LazyImageRenderer htmlContent={currentQuestion.content} />

            {/* Answer Input Area */}
            <div style={{ marginTop: 24 }}>
              {renderAnswerInput(currentQuestion)}
            </div>

            {/* Navigation and Control */}
            <Space style={{ marginTop: 24, justifyContent: 'space-between', width: '100%' }}>
              <Button
                onClick={handlePrevQuestion}
                disabled={isFirstQuestion}
                type={!isFirstQuestion && !isLastQuestion ? 'primary' : 'default'}
                style={{
                  backgroundColor: isFirstQuestion ? '#d9d9d9' : (!isLastQuestion ? undefined : undefined),
                  borderColor: isFirstQuestion ? '#d9d9d9' : undefined,
                  color: isFirstQuestion ? 'rgba(0, 0, 0, 0.25)' : undefined,
                  cursor: isFirstQuestion ? 'not-allowed' : 'pointer'
                }}
              >
                上一题
              </Button>
              <Button
                icon={<FlagOutlined />}
                onClick={() => handleToggleMark(currentQuestion.id)}
                type={markedQuestions[currentQuestion.id] ? 'primary' : 'default'}
              >
                {markedQuestions[currentQuestion.id] ? '取消标记' : '标记题目'}
              </Button>
              <Button
                onClick={handleNextQuestion}
                disabled={isLastQuestion}
                type={!isFirstQuestion && !isLastQuestion ? 'primary' : 'default'}
                style={{
                  backgroundColor: isLastQuestion ? '#d9d9d9' : (!isFirstQuestion ? undefined : undefined),
                  borderColor: isLastQuestion ? '#d9d9d9' : undefined,
                  color: isLastQuestion ? 'rgba(0, 0, 0, 0.25)' : undefined,
                  cursor: isLastQuestion ? 'not-allowed' : 'pointer'
                }}
              >
                下一题
              </Button>
            </Space>
          </Card>
        </div>
      </div>

      {/* Mobile Drawer for Question Navigation */}
      {isMobile && (
        <Drawer
          title="题目导航"
          placement="left"
          closable={true}
          onClose={() => setDrawerVisible(false)}
          visible={drawerVisible}
          key="question-nav-drawer"
          width="80%"
          bodyStyle={{ padding: 0 }}
        >
          <QuestionNav
            questions={examData.questions}
            currentQuestionIndex={currentQuestionIndex}
            onQuestionChange={handleJumpToQuestion}
            answeredQuestions={new Set(Object.keys(userAnswers).filter(qId => userAnswers[qId] !== undefined && userAnswers[qId] !== null && userAnswers[qId] !== ''))}
            markedQuestions={new Set(Object.keys(markedQuestions).filter(qId => markedQuestions[qId]))}
            onToggleMark={handleToggleMark}
          />
        </Drawer>
      )}
    </div>
  );
};

export default ExamTaking;
