import React from 'react';
import { Card, Button, Space, Progress, Typography } from 'antd';
import { StarOutlined, StarFilled } from '@ant-design/icons';

const { Text } = Typography;

const QuestionNav = ({
  questions,
  currentQuestionIndex,
  onQuestionChange,
  answeredQuestions,
  markedQuestions,
  onToggleMark,
}) => {
  const totalQuestions = questions.length;
  const answeredCount = answeredQuestions.size;
  const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <Card title="题目导航" size="small" style={{ width: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <Progress
          percent={parseFloat(progressPercentage.toFixed(1))}
          status={progressPercentage === 100 ? 'success' : 'active'}
          format={() => `${answeredCount}/${totalQuestions}`}
        />
        <Text type="secondary">已答 {answeredCount} 题 / 共 {totalQuestions} 题</Text>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {questions.map((q, index) => {
          const isAnswered = answeredQuestions.has(q.id);
          const isMarked = markedQuestions.has(q.id);
          const isCurrent = currentQuestionIndex === index;

          let buttonType = 'default';
          let buttonStyle = {};

          if (isCurrent) {
            buttonType = 'primary';
          } else if (isAnswered) {
            buttonStyle = { backgroundColor: '#e6ffe6', borderColor: '#52c41a' }; // Greenish for answered
          } else if (isMarked) {
            buttonStyle = { borderColor: '#faad14' }; // Orange for marked
          }

          return (
            <Button
              key={q.id}
              type={buttonType}
              style={buttonStyle}
              onClick={() => onQuestionChange(index)}
            >
              <Space size={4}>
                {index + 1}
                {isMarked && <StarFilled style={{ color: '#faad14' }} />}
              </Space>
            </Button>
          );
        })}
      </div>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button
          icon={markedQuestions.has(questions[currentQuestionIndex]?.id) ? <StarFilled /> : <StarOutlined />}
          onClick={() => onToggleMark(questions[currentQuestionIndex]?.id)}
          disabled={!questions[currentQuestionIndex]}
        >
          {markedQuestions.has(questions[currentQuestionIndex]?.id) ? '取消标记' : '标记题目'}
        </Button>
      </div>
    </Card>
  );
};

export default QuestionNav;
