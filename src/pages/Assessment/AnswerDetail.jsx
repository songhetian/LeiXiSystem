import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin, Typography, Tag, Collapse, List } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;



  const getQuestionType = (q) => q?.question_type || q?.type || '';

  const getQuestionTypeTag = (type) => {
    switch (type) {
      case 'single_choice': return <Tag color="blue">单选</Tag>;
      case 'multiple_choice': return <Tag color="green">多选</Tag>;
      case 'true_false': return <Tag color="orange">判断</Tag>;
      case 'fill_blank': return <Tag color="purple">填空</Tag>;
      case 'essay': return <Tag color="red">简答</Tag>;
      default: return <Tag>{type}</Tag>;
    }
  };

  const renderUserAnswer = (question, userAnswer) => {
    if (!userAnswer) return <Text type="secondary">未作答</Text>;

    try {
      const t = getQuestionType(question);
      let displayAnswer = userAnswer;
      if (t === 'multiple_choice' || t === 'fill_blank') {
        displayAnswer = JSON.parse(userAnswer).join(', ');
      } else if (t === 'true_false') {
        displayAnswer = userAnswer === 'true' ? '正确' : '错误';
      }
      return <Text strong style={{ color: question.is_correct === 1 ? 'green' : 'red' }}>{displayAnswer}</Text>;
    } catch (e) {
      return <Text type="danger">答案解析错误</Text>;
    }
  };

  const renderCorrectAnswer = (question) => {
    if (!question.correct_answer) return <Text type="secondary">无</Text>;

    try {
      const t = getQuestionType(question);
      let displayAnswer = question.correct_answer;
      if (t === 'multiple_choice' || t === 'fill_blank') {
        displayAnswer = JSON.parse(question.correct_answer).join(', ');
      } else if (t === 'true_false') {
        displayAnswer = question.correct_answer === 'true' ? '正确' : '错误';
      }
      return <Text strong>{displayAnswer}</Text>;
    } catch (e) {
      return <Text type="danger">答案解析错误</Text>;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
      <Spin size="large"><span className="sr-only">加载中...</span></Spin>
      </div>
    );
  }

  if (!answerDetails || !answerDetails.questions) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="答题详情">
          <p>无法加载答题详情。</p>
          <Button type="primary" onClick={() => navigate(`/assessment/results/${resultId}/result`)} icon={<ArrowLeftOutlined />}>
            返回考试结果
          </Button>
        </Card>
      </div>
    );
  }

  const { exam_title, score, total_score, is_passed, questions } = answerDetails;
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <Card
        style={{ width: '100%', position: 'fixed', top: 0, zIndex: 100, borderRadius: 0 }}
        bodyStyle={{ padding: '10px 24px' }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>答题详情 - {exam_title}</Title>
          <Space>
            <Button onClick={() => navigate(`/assessment/results/${resultId}/result`)} icon={<ArrowLeftOutlined />}>
              返回考试结果
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              打印
            </Button>
          </Space>
        </Space>
      </Card>

      <div style={{ display: 'flex', flex: 1, paddingTop: 64 }}> {/* Adjust paddingTop for fixed header */}
        {/* Side Navigation */}
        <Card style={{ width: 200, flexShrink: 0, overflowY: 'auto', borderRadius: 0 }}>
          <Title level={5}>题目导航</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {questions.map((q, index) => (
              <Button
                key={q.question_id}
                type={currentQuestionIndex === index ? 'primary' : 'default'}
                danger={q.is_correct === 0} // Incorrect answers in red
                onClick={() => setCurrentQuestionIndex(index)}
                style={{
                  backgroundColor: q.is_correct === 1 ? '#e6ffe6' : (q.is_correct === 0 ? '#ffe6e6' : undefined),
                  borderColor: q.is_correct === 1 ? 'green' : (q.is_correct === 0 ? 'red' : undefined),
                }}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        </Card>

        {/* Question Display Area */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {currentQuestion && (
            <Card
              title={
                <Space>
                  {currentQuestionIndex + 1}. {getQuestionTypeTag(getQuestionType(currentQuestion))}
                  <Text strong>分值: {currentQuestion.score}</Text>
                  {currentQuestion.user_score !== null && (
                    <Text strong style={{ color: currentQuestion.user_score > 0 ? 'green' : 'red' }}>
                      得分: {currentQuestion.user_score}
                    </Text>
                  )}
                  {currentQuestion.is_correct !== null && (
                    <Tag color={currentQuestion.is_correct === 1 ? 'success' : 'error'}>
                      {currentQuestion.is_correct === 1 ? '正确' : '错误'}
                    </Tag>
                  )}
                </Space>
              }
              style={{ marginBottom: 16, borderColor: currentQuestion.is_correct === 0 ? 'red' : undefined }}
            >
              <LazyImageRenderer htmlContent={currentQuestion.content} />

const AnswerDetail = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [answerDetails, setAnswerDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    fetchAnswerDetails();
  }, [resultId]);

  const fetchAnswerDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/assessment-results/${resultId}/answers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setAnswerDetails(response.data.data);
    } catch (error) {
      message.error(`获取答题详情失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to fetch answer details:', error);
      navigate(`/assessment/results/${resultId}/result`); // Go back to result if failed
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large"><span className="sr-only">加载中...</span></Spin>
      </div>
    );
  }

  if (!answerDetails || !answerDetails.questions) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="答题详情">
          <p>无法加载答题详情。</p>
          <Button type="primary" onClick={() => navigate(`/assessment/results/${resultId}/result`)} icon={<ArrowLeftOutlined />}>
            返回考试结果
          </Button>
        </Card>
      </div>
    );
  }

  const { exam_title, score, total_score, is_passed, questions } = answerDetails;
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <Card
        style={{ width: '100%', position: 'fixed', top: 0, zIndex: 100, borderRadius: 0 }}
        bodyStyle={{ padding: '10px 24px' }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>答题详情 - {exam_title}</Title>
          <Space>
            <Button onClick={() => navigate(`/assessment/results/${resultId}/result`)} icon={<ArrowLeftOutlined />}>
              返回考试结果
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              打印
            </Button>
          </Space>
        </Space>
      </Card>

      <div style={{ display: 'flex', flex: 1, paddingTop: 64 }}> {/* Adjust paddingTop for fixed header */}
        {/* Side Navigation */}
        <Card style={{ width: 200, flexShrink: 0, overflowY: 'auto', borderRadius: 0 }}>
          <Title level={5}>题目导航</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {questions.map((q, index) => (
              <Button
                key={q.question_id}
                type={currentQuestionIndex === index ? 'primary' : 'default'}
                danger={q.is_correct === 0} // Incorrect answers in red
                onClick={() => setCurrentQuestionIndex(index)}
                style={{
                  backgroundColor: q.is_correct === 1 ? '#e6ffe6' : (q.is_correct === 0 ? '#ffe6e6' : undefined),
                  borderColor: q.is_correct === 1 ? 'green' : (q.is_correct === 0 ? 'red' : undefined),
                }}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        </Card>

        {/* Question Display Area */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {currentQuestion && (
            <Card
              title={
                <Space>
                  {currentQuestionIndex + 1}. {getQuestionTypeTag(currentQuestion.question_type)}
                  <Text strong>分值: {currentQuestion.score}</Text>
                  {currentQuestion.user_score !== null && (
                    <Text strong style={{ color: currentQuestion.user_score > 0 ? 'green' : 'red' }}>
                      得分: {currentQuestion.user_score}
                    </Text>
                  )}
                  {currentQuestion.is_correct !== null && (
                    <Tag color={currentQuestion.is_correct === 1 ? 'success' : 'error'}>
                      {currentQuestion.is_correct === 1 ? '正确' : '错误'}
                    </Tag>
                  )}
                </Space>
              }
              style={{ marginBottom: 16, borderColor: currentQuestion.is_correct === 0 ? 'red' : undefined }}
            >
              <LazyImageRenderer htmlContent={currentQuestion.content} />

              {getQuestionType(currentQuestion) === 'single_choice' || getQuestionType(currentQuestion) === 'multiple_choice' ? (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>选项:</Text>
                  <List
                    size="small"
                    bordered
                    dataSource={(() => { try { return JSON.parse(currentQuestion.options); } catch { return []; } })()}
                    renderItem={(item, idx) => (
                      <List.Item>
                        <Text
                          style={{
                            color: (() => { try { return (currentQuestion.user_answer && JSON.parse(currentQuestion.user_answer).includes(item)) ? 'blue' : 'inherit'; } catch { return 'inherit'; } })(),
                            fontWeight: (() => { try { return (currentQuestion.correct_answer && JSON.parse(currentQuestion.correct_answer).includes(item)) ? 'bold' : 'normal'; } catch { return 'normal'; } })(),
                          }}
                        >
                          {String.fromCharCode(65 + idx)}. {item}
                        </Text>
                      </List.Item>
                    )}
                  />
                </div>
              ) : null}

              <Paragraph>
                <Text strong>您的答案:</Text> {renderUserAnswer(currentQuestion, currentQuestion.user_answer)}
              </Paragraph>
              <Paragraph>
                <Text strong>正确答案:</Text> {renderCorrectAnswer(currentQuestion)}
              </Paragraph>
              {currentQuestion.explanation && (
                <Paragraph>
                  <Text strong>解析:</Text> {currentQuestion.explanation}
                </Paragraph>
              )}
            </Card>
          )}
          <Space style={{ marginTop: 16, justifyContent: 'space-between', width: '100%' }}>
            <Button onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0}>
              上一题
            </Button>
            <Button onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))} disabled={currentQuestionIndex === questions.length - 1}>
              下一题
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default AnswerDetail;
