import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin, Popconfirm, Collapse, Tag, InputNumber } from 'antd';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { EditOutlined, DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Panel } = Collapse;

// Helper function to reorder a list
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

const getItemStyle = (isDragging, draggableStyle) => ({
  userSelect: 'none',
  padding: 8 * 2,
  margin: `0 0 8px 0`,
  borderRadius: '4px',
  background: isDragging ? '#e6f7ff' : 'white',
  border: isDragging ? '1px solid #91d5ff' : '1px solid #d9d9d9',
  boxShadow: isDragging ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
  ...draggableStyle,
});

const getListStyle = (isDraggingOver) => ({
  background: isDraggingOver ? '#f0f2f5' : '#f5f5f5',
  padding: 8,
  minHeight: '100px',
  borderRadius: '4px',
});

const QuestionList = ({ examId, onEditQuestion, onDeleteQuestion, onQuestionsReordered }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (examId) {
      fetchExamQuestions(examId);
    }
  }, [examId]);

  const fetchExamQuestions = async (currentExamId) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/exams/${currentExamId}/questions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setQuestions(response.data.data.questions);
    } catch (error) {
      message.error('获取试卷题目失败');
      console.error('Failed to fetch exam questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) {
      return;
    }

    const reorderedQuestions = reorder(
      questions,
      result.source.index,
      result.destination.index
    );

    setQuestions(reorderedQuestions);

    // Update order_num in backend
    try {
      const questionIds = reorderedQuestions.map(q => q.id);
      await axios.put(`/api/exams/${examId}/questions/reorder`, { question_ids: questionIds }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('题目排序成功');
      if (onQuestionsReordered) {
        onQuestionsReordered(reorderedQuestions);
      }
    } catch (error) {
      message.error('题目排序失败');
      console.error('Failed to reorder questions:', error);
      // Revert to original order if API call fails
      fetchExamQuestions(examId);
    }
  };

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

  return (
    <Spin spinning={loading}>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="questions">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              style={getListStyle(snapshot.isDraggingOver)}
            >
              {questions.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 20 }}>暂无题目</p>
              ) : (
                <Collapse accordion>
                  {questions.map((question, index) => (
                    <Draggable key={question.id} draggableId={String(question.id)} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={getItemStyle(
                            snapshot.isDragging,
                            provided.draggableProps.style
                          )}
                        >
                          <Panel
                            header={
                              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <span>
                                  {index + 1}. {getQuestionTypeTag(question.type)} {question.content}
                                </span>
                                <Space onClick={(e) => e.stopPropagation()}> {/* Prevent collapse on button click */}
                                  <Button
                                    icon={<EditOutlined />}
                                    onClick={() => onEditQuestion(question.id)}
                                    size="small"
                                  >
                                    编辑
                                  </Button>
                                  <Popconfirm
                                    title="确定删除此题目吗？"
                                    onConfirm={() => onDeleteQuestion(question.id)}
                                    okText="是"
                                    cancelText="否"
                                  >
                                    <Button icon={<DeleteOutlined />} danger size="small">
                                      删除
                                    </Button>
                                  </Popconfirm>
                                </Space>
                              </Space>
                            }
                            key={question.id}
                          >
                            <p><strong>分值:</strong> {question.score}</p>
                            {question.options && (
                              <div>
                                <strong>选项:</strong>
                                <ul>
                                  {question.options.map((option, optIndex) => (
                                    <li key={optIndex}>{option}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {question.correct_answer && (
                              <p><strong>正确答案:</strong> {question.correct_answer}</p>
                            )}
                            {question.explanation && (
                              <p><strong>解析:</strong> {question.explanation}</p>
                            )}
                          </Panel>
                        </div>
                      )}
                    </Draggable>
                  ))}
                </Collapse>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </Spin>
  );
};

export default QuestionList;
