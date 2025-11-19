import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Select, Space, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PublishOutlined, ArchiveOutlined, SwapOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/assessment-business.css';

const { Search } = Input;
const { Option } = Select;

const ExamList = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    category: undefined,
    difficulty: undefined,
    status: undefined,
    title: '',
  });
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'

  const fetchExams = async (params = {}) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/exams', {
        params: {
          page: params.pagination?.current || pagination.current,
          pageSize: params.pagination?.pageSize || pagination.pageSize,
          ...filters,
          ...params.filters,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`, // Assuming token is stored in localStorage
        },
      });
      setExams(response.data.data.exams);
      setPagination({
        ...pagination,
        current: response.data.data.page,
        pageSize: response.data.data.pageSize,
        total: response.data.data.total,
      });
    } catch (error) {
      message.error('获取试卷列表失败');
      console.error('Failed to fetch exams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [pagination.current, pagination.pageSize, filters]);

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [key]: value,
    }));
    setPagination((prevPagination) => ({ ...prevPagination, current: 1 })); // Reset to first page on filter change
  };

  const handleSearch = (value) => {
    handleFilterChange('title', value);
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'draft':
        return <Tag color="default">草稿</Tag>;
      case 'published':
        return <Tag color="success">已发布</Tag>;
      case 'archived':
        return <Tag color="warning">已归档</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const getDifficultyTag = (difficulty) => {
    switch (difficulty) {
      case 'easy':
        return <Tag color="green">简单</Tag>;
      case 'medium':
        return <Tag color="blue">中等</Tag>;
      case 'hard':
        return <Tag color="red">困难</Tag>;
      default:
        return <Tag>{difficulty}</Tag>;
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      render: getDifficultyTag,
    },
    {
      title: '题目数',
      dataIndex: 'question_count',
      key: 'question_count',
      sorter: true,
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
      sorter: true,
    },
    {
      title: '及格分',
      dataIndex: 'pass_score',
      key: 'pass_score',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString(),
      sorter: true,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => handleView(record.id)}>查看</Button>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record.id)}>编辑</Button>
          {record.status === 'draft' && (
            <Button icon={<PublishOutlined />} onClick={() => handlePublish(record.id)} type="primary">发布</Button>
          )}
          {record.status === 'published' && (
            <Button icon={<ArchiveOutlined />} onClick={() => handleArchive(record.id)} danger>归档</Button>
          )}
          <Popconfirm
            title="确定删除此试卷吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="是"
            cancelText="否"
          >
            <Button icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    message.info('添加试卷功能待实现');
    // navigate('/exams/new');
  };

  const handleView = (id) => {
    message.info(`查看试卷 ${id} 功能待实现`);
    // navigate(`/exams/${id}`);
  };

  const handleEdit = (id) => {
    message.info(`编辑试卷 ${id} 功能待实现`);
    // navigate(`/exams/${id}/edit`);
  };

  const handlePublish = async (id) => {
    try {
      await axios.put(`/api/exams/${id}/status`, { status: 'published' }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('试卷发布成功');
      fetchExams();
    } catch (error) {
      message.error('试卷发布失败');
      console.error('Failed to publish exam:', error);
    }
  };

  const handleArchive = async (id) => {
    try {
      await axios.put(`/api/exams/${id}/status`, { status: 'archived' }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('试卷归档成功');
      fetchExams();
    } catch (error) {
      message.error('试卷归档失败');
      console.error('Failed to archive exam:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/exams/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('试卷删除成功');
      fetchExams();
    } catch (error) {
      message.error('试卷删除失败');
      console.error('Failed to delete exam:', error);
    }
  };

  return (
    <div className="assessment-business" style={{ padding: 24 }}>
      <Card
        title="试卷列表"
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加试卷
            </Button>
            <Button icon={<SwapOutlined />} onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}>
              切换视图 ({viewMode === 'table' ? '卡片' : '表格'})
            </Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Search
            placeholder="搜索试卷标题"
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Space>
            <Select
              placeholder="筛选分类"
              style={{ width: 120 }}
              onChange={(value) => handleFilterChange('category', value)}
              allowClear
            >
              {/* Categories should be fetched from API */}
              <Option value="前端">前端</Option>
              <Option value="后端">后端</Option>
              <Option value="测试">测试</Option>
            </Select>
            <Select
              placeholder="筛选难度"
              style={{ width: 120 }}
              onChange={(value) => handleFilterChange('difficulty', value)}
              allowClear
            >
              <Option value="easy">简单</Option>
              <Option value="medium">中等</Option>
              <Option value="hard">困难</Option>
            </Select>
            <Select
              placeholder="筛选状态"
              style={{ width: 120 }}
              onChange={(value) => handleFilterChange('status', value)}
              allowClear
            >
              <Option value="draft">草稿</Option>
              <Option value="published">已发布</Option>
              <Option value="archived">已归档</Option>
            </Select>
          </Space>
        </Space>

        {viewMode === 'table' ? (
          <Table
            columns={columns}
            dataSource={exams}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {exams.map((exam) => (
              <Card
                key={exam.id}
                title={exam.title}
                extra={getStatusTag(exam.status)}
                actions={[
                  <Button icon={<EyeOutlined />} onClick={() => handleView(exam.id)} type="link">查看</Button>,
                  <Button icon={<EditOutlined />} onClick={() => handleEdit(exam.id)} type="link">编辑</Button>,
                  <Popconfirm
                    title="确定删除此试卷吗？"
                    onConfirm={() => handleDelete(exam.id)}
                    okText="是"
                    cancelText="否"
                  >
                    <Button icon={<DeleteOutlined />} danger type="link">删除</Button>
                  </Popconfirm>,
                ]}
              >
                <p><strong>分类:</strong> {exam.category}</p>
                <p><strong>难度:</strong> {getDifficultyTag(exam.difficulty)}</p>
                <p><strong>题目数:</strong> {exam.question_count}</p>
                <p><strong>总分:</strong> {exam.total_score}</p>
                <p><strong>及格分:</strong> {exam.pass_score}</p>
                <p><strong>创建时间:</strong> {new Date(exam.created_at).toLocaleString()}</p>
                <Space style={{ marginTop: 8 }}>
                  {exam.status === 'draft' && (
                    <Button icon={<PublishOutlined />} onClick={() => handlePublish(exam.id)} size="small" type="primary">发布</Button>
                  )}
                  {exam.status === 'published' && (
                    <Button icon={<ArchiveOutlined />} onClick={() => handleArchive(exam.id)} size="small" danger>归档</Button>
                  )}
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ExamList;
