import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin, Input, Select, Tag, Popconfirm, Form, InputNumber } from 'antd';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, FilterOutlined, SaveOutlined, PublishOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const { Search } = Input;
const { Option } = Select;

// Helper function to reorder a list
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

// Helper function to move an item from one list to another
const move = (source, destination, droppableSource, droppableDestination) => {
  const sourceClone = Array.from(source);
  const destClone = Array.from(destination);
  const [removed] = sourceClone.splice(droppableSource.index, 1);

  destClone.splice(droppableDestination.index, 0, removed);

  const result = {};
  result[droppableSource.droppableId] = sourceClone;
  result[droppableDestination.droppableId] = destClone;

  return result;
};

const getItemStyle = (isDragging, draggableStyle) => ({
  // some basic styles to make the items look a bit nicer
  userSelect: 'none',
  padding: 8 * 2,
  margin: `0 0 8px 0`,
  borderRadius: '4px',
  background: isDragging ? '#e6f7ff' : 'white',
  border: isDragging ? '1px solid #91d5ff' : '1px solid #d9d9d9',
  boxShadow: isDragging ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',

  // styles we need to apply on draggables
  ...draggableStyle,
});

const getListStyle = (isDraggingOver) => ({
  background: isDraggingOver ? '#f0f2f5' : '#f5f5f5',
  padding: 8,
  minHeight: '500px',
  borderRadius: '4px',
});

const DragDropExamBuilder = () => {
  const { id } = useParams(); // Exam ID for editing
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [questionBank, setQuestionBank] = useState([]);
  const [examQuestions, setExamQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [examDetails, setExamDetails] = useState(null);

  const [bankFilters, setBankFilters] = useState({
    type: undefined,
    search: '',
  });
  const [questionBankPagination, setQuestionBankPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    fetchQuestionBank();
    if (id) {
      fetchExamDetails(id);
      fetchExamQuestions(id);
    }
  }, [id, bankFilters, questionBankPagination.current, questionBankPagination.pageSize]);

  const fetchQuestionBank = async () => {
    setLoading(true);
    try {
      // Assuming an API endpoint to get all questions for the question bank
      // This API should support filtering and pagination
      const response = await axios.get('/api/questions', { // Placeholder API endpoint
        params: {
          page: questionBankPagination.current,
          pageSize: questionBankPagination.pageSize,
          type: bankFilters.type,
          search: bankFilters.search,
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setQuestionBank(response.data.data.questions.filter(
        (q) => !examQuestions.some((eq) => eq.id === q.id)
      )); // Filter out questions already in the exam
      setQuestionBankPagination({
        ...questionBankPagination,
        total: response.data.data.total,
      });
    } catch (error) {
      message.error('获取题库题目失败');
      console.error('Failed to fetch question bank:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExamDetails = async (examId) => {
    try {
      const response = await axios.get(`/api/exams/${examId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setExamDetails(response.data.data);
      form.setFieldsValue(response.data.data);
    } catch (error) {
      message.error('获取试卷详情失败');
      console.error('Failed to fetch exam details:', error);
    }
  };

  const fetchExamQuestions = async (examId) => {
    try {
      const response = await axios.get(`/api/exams/${examId}/questions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setExamQuestions(response.data.data.questions);
    } catch (error) {
      message.error('获取试卷题目失败');
      console.error('Failed to fetch exam questions:', error);
    }
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;

    // dropped outside the list
    if (!destination) {
      return;
    }

    if (source.droppableId === destination.droppableId) {
      // Reordering within the same list (exam questions)
      if (source.droppableId === 'examQuestions') {
        const reorderedExamQuestions = reorder(
          examQuestions,
          source.index,
          destination.index
        );
        setExamQuestions(reorderedExamQuestions);
      }
    } else {
      // Moving from question bank to exam questions
      if (source.droppableId === 'questionBank' && destination.droppableId === 'examQuestions') {
        const result = move(
          questionBank,
          examQuestions,
          source,
          destination
        );
        setQuestionBank(result.questionBank);
        setExamQuestions(result.examQuestions);
      }
    }
  };

  const handleRemoveQuestion = (questionId) => {
    setExamQuestions((prev) => prev.filter((q) => q.id !== questionId));
    fetchQuestionBank(); // Refresh question bank to show removed question
  };

  const handleUpdateQuestionScore = (questionId, newScore) => {
    setExamQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, score: newScore } : q))
    );
  };

  const handleSaveExam = async (status = 'draft') => {
    setLoading(true);
    try {
      const examValues = await form.validateFields();
      const questionPayload = examQuestions.map((q, index) => ({
        question_id: q.id,
        score: q.score,
        order_num: index + 1,
      }));

      const payload = {
        ...examValues,
        questions: questionPayload,
        status: status,
      };

      if (id) {
        await axios.put(`/api/exams/${id}`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        message.success('试卷更新成功');
      } else {
        await axios.post('/api/exams', payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        message.success('试卷创建成功');
      }
      navigate('/assessment/exams');
    } catch (error) {
      message.error(`保存试卷失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to save exam:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalExamScore = examQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
  const totalQuestionCount = examQuestions.length;

  return (
    <div style={{ padding: 24 }}>
      <Spin spinning={loading}>
        <Space style={{ marginBottom: 16 }}>
          <Button type="default" onClick={() => navigate('/assessment/exams')} icon={<ArrowLeftOutlined />}>
            返回试卷列表
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSaveExam('draft')}>
            保存草稿
          </Button>
          <Button type="primary" icon={<PublishOutlined />} onClick={() => handleSaveExam('published')}>
            发布试卷
          </Button>
        </Space>

        <Card title="试卷配置" style={{ marginBottom: 16 }}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              difficulty: 'medium',
              duration: 60,
              pass_score: 60,
            }}
          >
            <Form.Item
              name="title"
              label="试卷标题"
              rules={[{ required: true, message: '请输入试卷标题' }, { max: 200, message: '标题不能超过200字符' }]}
            >
              <Input placeholder="请输入试卷标题" />
            </Form.Item>
            <Form.Item
              name="description"
              label="试卷描述"
            >
              <TextArea rows={2} placeholder="请输入试卷描述" />
            </Form.Item>
            <Form.Item
              name="difficulty"
              label="难度"
              rules={[{ required: true, message: '请选择试卷难度' }]}
            >
              <Select placeholder="请选择难度">
                <Option value="easy">简单</Option>
                <Option value="medium">中等</Option>
                <Option value="hard">困难</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="duration"
              label="考试时长 (分钟)"
              rules={[{ required: true, message: '请输入考试时长' }, { type: 'number', min: 1, message: '时长必须大于0' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="pass_score"
              label="及格分"
              rules={[
                { required: true, message: '请输入及格分' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || totalExamScore >= value) { // Validate against calculated total score
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('及格分不能大于总分!'));
                  },
                }),
              ]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <p>当前试卷总分: <strong>{totalExamScore}</strong> (题目数量: {totalQuestionCount})</p>
          </Form>
        </Card>

        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: 'flex', gap: 16 }}>
            {/* 题库区域 */}
            <Card title="题库" style={{ flex: 1 }}>
              <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                <Search
                  placeholder="搜索题目内容"
                  onSearch={(value) => setBankFilters((prev) => ({ ...prev, search: value }))}
                  style={{ width: 200 }}
                  allowClear
                />
                <Select
                  placeholder="筛选题型"
                  style={{ width: 120 }}
                  onChange={(value) => setBankFilters((prev) => ({ ...prev, type: value }))}
                  allowClear
                >
                  <Option value="single_choice">单选</Option>
                  <Option value="multiple_choice">多选</Option>
                  <Option value="true_false">判断</Option>
                  <Option value="fill_blank">填空</Option>
                  <Option value="essay">简答</Option>
                </Select>
              </Space>
              <Droppable droppableId="questionBank">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    style={getListStyle(snapshot.isDraggingOver)}
                  >
                    {questionBank.length === 0 ? (
                      <p style={{ textAlign: 'center', padding: 20 }}>题库暂无题目</p>
                    ) : (
                      questionBank.map((question, index) => (
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
                              <p><strong>[{question.type}]</strong> {question.content}</p>
                              <p>分值: {question.score}</p>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </Card>

            {/* 试卷构建区域 */}
            <Card title={`试卷题目 (${totalQuestionCount} 题, 总分: ${totalExamScore})`} style={{ flex: 1 }}>
              <Droppable droppableId="examQuestions">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    style={getListStyle(snapshot.isDraggingOver)}
                  >
                    {examQuestions.length === 0 ? (
                      <p style={{ textAlign: 'center', padding: 20 }}>从题库拖拽题目到此处</p>
                    ) : (
                      examQuestions.map((question, index) => (
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
                              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <span><strong>{index + 1}. [{question.type}]</strong> {question.content}</span>
                                <Popconfirm
                                  title="确定从试卷中移除此题目吗？"
                                  onConfirm={() => handleRemoveQuestion(question.id)}
                                  okText="是"
                                  cancelText="否"
                                >
                                  <Button type="text" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                              <InputNumber
                                min={0}
                                value={question.score}
                                onChange={(value) => handleUpdateQuestionScore(question.id, value)}
                                style={{ width: '100%', marginTop: 8 }}
                                placeholder="分值"
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </Card>
          </div>
        </DragDropContext>
      </Spin>
    </div>
  );
};

export default DragDropExamBuilder;
