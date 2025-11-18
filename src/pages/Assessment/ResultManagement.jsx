import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Select, Space, Tag, message, Popconfirm, DatePicker, Modal, Form, InputNumber, Typography } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, ExportOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

const ResultManagement = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    user_id: undefined,
    exam_id: undefined,
    plan_id: undefined,
    status: undefined,
    dateRange: [],
  });
  const [sorter, setSorter] = useState({});

  const [users, setUsers] = useState([]);
  const [exams, setExams] = useState([]);
  const [plans, setPlans] = useState([]);

  const [gradingModalVisible, setGradingModalVisible] = useState(false);
  const [currentGradingRecord, setCurrentGradingRecord] = useState(null);
  const [gradingForm] = Form.useForm();

  useEffect(() => {
    fetchResults();
    fetchFilterOptions();
  }, [pagination.current, pagination.pageSize, filters, sorter]);

  const fetchResults = async (params = {}) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/assessment-results', {
        params: {
          page: params.pagination?.current || pagination.current,
          pageSize: params.pagination?.pageSize || pagination.pageSize,
          user_id: filters.user_id,
          exam_id: filters.exam_id,
          plan_id: filters.plan_id,
          status: filters.status,
          start_time: filters.dateRange[0] ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
          end_time: filters.dateRange[1] ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
          sort_field: params.sorter?.field,
          sort_order: params.sorter?.order,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setResults(response.data.data.results);
      setPagination({
        ...pagination,
        current: response.data.data.page,
        pageSize: response.data.data.pageSize,
        total: response.data.data.total,
      });
    } catch (error) {
      message.error('获取考试记录失败');
      console.error('Failed to fetch assessment results:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [usersRes, examsRes, plansRes] = await Promise.all([
        axios.get('/api/users-with-roles', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        axios.get('/api/exams', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        axios.get('/api/assessment-plans', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
      ]);
      setUsers(usersRes.data);
      setExams(examsRes.data.data.exams);
      setPlans(plansRes.data.data.plans);
    } catch (error) {
      message.error('获取筛选选项失败');
      console.error('Failed to fetch filter options:', error);
    }
  };

  const handleTableChange = (newPagination, _, newSorter) => {
    setPagination(newPagination);
    setSorter({ field: newSorter.field, order: newSorter.order });
  };

  const handleFilterChange = (key, value) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [key]: value,
    }));
    setPagination((prevPagination) => ({ ...prevPagination, current: 1 }));
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'in_progress':
        return <Tag color="blue">进行中</Tag>;
      case 'submitted':
        return <Tag color="warning">待评分</Tag>;
      case 'graded':
        return <Tag color="success">已评分</Tag>;
      case 'expired':
        return <Tag color="error">已过期</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => record.real_name || text,
    },
    {
      title: '考试名称',
      dataIndex: 'exam_title',
      key: 'exam_title',
    },
    {
      title: '考核计划',
      dataIndex: 'plan_title',
      key: 'plan_title',
    },
    {
      title: '成绩',
      dataIndex: 'score',
      key: 'score',
      render: (score) => score !== null ? score.toFixed(2) : '-',
      sorter: true,
    },
    {
      title: '通过状态',
      dataIndex: 'is_passed',
      key: 'is_passed',
      render: (isPassed) => isPassed !== null ? (isPassed ? <Tag color="success">通过</Tag> : <Tag color="error">未通过</Tag>) : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '提交时间',
      dataIndex: 'submit_time',
      key: 'submit_time',
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-',
      sorter: true,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/assessment/results/${record.id}/answers`)}>查看详情</Button>
          {record.status === 'submitted' && (
            <Button icon={<EditOutlined />} onClick={() => handleManualGrade(record)}>人工评分</Button>
          )}
          <Popconfirm
            title="确定删除此考试记录吗？"
            onConfirm={() => handleDeleteResult(record.id)}
            okText="是"
            cancelText="否"
          >
            <Button icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleManualGrade = async (record) => {
    setCurrentGradingRecord(record);
    // Fetch answer details for the record to find subjective questions
    try {
      const response = await axios.get(`/api/assessment-results/${record.id}/answers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const subjectiveQuestions = response.data.data.questions.filter(q => q.question_type === 'essay');
      if (subjectiveQuestions.length > 0) {
        // For simplicity, let's assume we grade the first subjective question found
        // In a real app, you'd list all subjective questions and allow grading each
        const firstSubjective = subjectiveQuestions[0];
        gradingForm.setFieldsValue({
          question_id: firstSubjective.question_id,
          user_answer: firstSubjective.user_answer,
          score: firstSubjective.user_score || 0,
          max_score: firstSubjective.score,
        });
        setGradingModalVisible(true);
      } else {
        message.info('此考试记录没有需要人工评分的主观题。');
      }
    } catch (error) {
      message.error('获取题目详情失败，无法进行人工评分');
      console.error('Failed to fetch answers for grading:', error);
    }
  };

  const handleGradingSubmit = async (values) => {
    setLoading(true);
    try {
      await axios.put(`/api/assessment-results/${currentGradingRecord.id}/grade`, {
        question_id: values.question_id,
        score: values.score,
        is_correct: values.score > 0 ? 1 : 0, // Simple logic: if score > 0, it's correct
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('评分成功');
      setGradingModalVisible(false);
      fetchResults(); // Refresh list
    } catch (error) {
      message.error(`评分失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to submit grade:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResult = async (id) => {
    setLoading(true);
    try {
      await axios.delete(`/api/assessment-results/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('考试记录删除成功');
      fetchResults();
    } catch (error) {
      message.error(`删除失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to delete result:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchExport = () => {
    message.info('批量导出功能待实现');
    // Implement batch export logic here
  };

  const handleBatchGrade = () => {
    message.info('批量评分功能待实现');
    // Implement batch grading logic here
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="成绩管理 (管理员)">
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Select
              placeholder="筛选用户"
              style={{ width: 150 }}
              onChange={(value) => handleFilterChange('user_id', value)}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {users.map(user => (
                <Option key={user.id} value={user.id}>{user.real_name || user.username}</Option>
              ))}
            </Select>
            <Select
              placeholder="筛选试卷"
              style={{ width: 150 }}
              onChange={(value) => handleFilterChange('exam_id', value)}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {exams.map(exam => (
                <Option key={exam.id} value={exam.id}>{exam.title}</Option>
              ))}
            </Select>
            <Select
              placeholder="筛选计划"
              style={{ width: 150 }}
              onChange={(value) => handleFilterChange('plan_id', value)}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {plans.map(plan => (
                <Option key={plan.id} value={plan.id}>{plan.title}</Option>
              ))}
            </Select>
            <Select
              placeholder="筛选状态"
              style={{ width: 120 }}
              onChange={(value) => handleFilterChange('status', value)}
              allowClear
            >
              <Option value="in_progress">进行中</Option>
              <Option value="submitted">待评分</Option>
              <Option value="graded">已评分</Option>
              <Option value="expired">已过期</Option>
            </Select>
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              onChange={(dates) => handleFilterChange('dateRange', dates)}
              value={filters.dateRange}
            />
          </Space>
          <Space>
            <Button icon={<ExportOutlined />} onClick={handleBatchExport}>批量导出</Button>
            <Button icon={<EditOutlined />} onClick={handleBatchGrade}>批量评分</Button>
          </Space>
        </Space>

        <Table
          columns={columns}
          dataSource={results}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title="人工评分"
        visible={gradingModalVisible}
        onCancel={() => setGradingModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={gradingForm} layout="vertical" onFinish={handleGradingSubmit}>
          <Form.Item label="题目内容">
            <Text>{currentGradingRecord?.question_content}</Text>
          </Form.Item>
          <Form.Item label="用户答案">
            <Text>{gradingForm.getFieldValue('user_answer') || '未作答'}</Text>
          </Form.Item>
          <Form.Item
            name="score"
            label={`评分 (满分: ${gradingForm.getFieldValue('max_score')})`}
            rules={[
              { required: true, message: '请输入分数' },
              { type: 'number', min: 0, max: gradingForm.getFieldValue('max_score'), message: `分数必须在0到${gradingForm.getFieldValue('max_score')}之间` },
            ]}
          >
            <InputNumber min={0} max={gradingForm.getFieldValue('max_score')} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="question_id" hidden>
            <Input />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存评分
            </Button>
            <Button onClick={() => setGradingModalVisible(false)}>
              取消
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default ResultManagement;
