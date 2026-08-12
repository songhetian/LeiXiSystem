import React, { useState } from 'react';
import { Card, Button, Space, Progress, Typography, Pagination } from 'antd';
import { StarOutlined, StarFilled, LeftOutlined, RightOutlined } from '@ant-design/icons';

const { Text } = Typography;

const ITEMS_PER_PAGE = 10;

const QuestionNav = ({
  questions,
  currentQuestionIndex,
  onQuestionChange,
  answeredQuestions,
  markedQuestions,
  onToggleMark,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalQuestions = questions.length;
  const answeredCount = answeredQuestions.size;
  const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // Calculate pagination
  const totalPages = Math.ceil(totalQuestions / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalQuestions);
  const currentPageQuestions = questions.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Auto-navigate to page containing current question
  React.useEffect(() => {
    const pageContainingCurrentQuestion = Math.floor(currentQuestionIndex / ITEMS_PER_PAGE) + 1;
    if (pageContainingCurrentQuestion !== currentPage) {
      setCurrentPage(pageContainingCurrentQuestion);
    }
  }, [currentQuestionIndex]);

  return (
    <Card title="题目导航" size="small" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16 }}>
        <Progress
          percent={parseFloat(progressPercentage.toFixed(1))}
          status={progressPercentage === 100 ? 'success' : 'active'}
          format={() => `${answeredCount}/${totalQuestions}`}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          已答 {answeredCount} / 共 {totalQuestions}
        </Text>
      </div>

      {/* Question grid - showing current page only */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16, flex: 1 }}>
        {currentPageQuestions.map((q, pageIndex) => {
          const actualIndex = startIndex + pageIndex;
          const isAnswered = answeredQuestions.has(q.id);
          const isMarked = markedQuestions.has(q.id);
          const isCurrent = currentQuestionIndex === actualIndex;

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
              style={{ ...buttonStyle, padding: '4px 8px', fontSize: 12, height: 'auto' }}
              onClick={() => onQuestionChange(actualIndex)}
              size="small"
            >
              <Space size={2} style={{ fontSize: 12 }}>
                {actualIndex + 1}
                {isMarked && <StarFilled style={{ color: '#faad14', fontSize: 10 }} />}
              </Space>
            </Button>
          );
        })}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <Button
            size="small"
            icon={<LeftOutlined />}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          />
          <Space size={4}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <Button
                key={page}
                size="small"
                type={page === currentPage ? 'primary' : 'default'}
                onClick={() => handlePageChange(page)}
                style={{
                  minWidth: 24,
                  padding: '0 6px',
                  fontSize: 12,
                  fontWeight: page === currentPage ? 'bold' : 'normal'
                }}
              >
                {page}
              </Button>
            ))}
          </Space>
          <Button
            size="small"
            icon={<RightOutlined />}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          />
        </div>
      )}

      {/* Mark/Unmark current question button */}
      <div style={{ textAlign: 'center' }}>
        <Button
          icon={markedQuestions.has(questions[currentQuestionIndex]?.id) ? <StarFilled /> : <StarOutlined />}
          onClick={() => onToggleMark(questions[currentQuestionIndex]?.id)}
          disabled={!questions[currentQuestionIndex]}
          size="small"
          block
        >
          {markedQuestions.has(questions[currentQuestionIndex]?.id) ? '取消标记' : '标记题目'}
        </Button>
      </div>
    </Card>
  );
};

export default QuestionNav;
