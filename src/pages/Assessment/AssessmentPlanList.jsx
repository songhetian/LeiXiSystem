import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Select, Space, Tag, message, Popconfirm, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PublishOutlined, SwapOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const AssessmentPlanList = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    status: undefined,
    dateRange: [], // [start_time, end_time]
  });

  const fetchAssessmentPlans = async (params = {}) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/assessment-plans', {
        params: {
          page: params.pagination?.current || pagination.current,
          pageSize: params.pagination?.pageSize || pagination.pageSize,
          status: filters.status,
          start_time: filters.dateRange[0] ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
          end_time: filters.dateRange[1] ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setPlans(response.data.data.plans);
      setPagination({
        ...pagination,
        current: response.data.data.page,
        pageSize: response.data.data.pageSize,
        total: response.data.data.total,
      });
    } catch (error) {
      message.error('获取考核计划列表失败');
      console.error('Failed to fetch assessment plans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessmentPlans();
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

  const getStatusTag = (status) => {
    switch (status) {
      case 'draft':
        return <Tag color="default">草稿</Tag>;
      case 'published':
        return <Tag color="processing">已发布</Tag>;
      case 'ongoing':
        return <Tag color="blue">进行中</Tag>;
      case 'completed':
        return <Tag color="success">已完成</Tag>;
      case 'cancelled':
        return <Tag color="error">已取消</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '试卷',
      dataIndex: 'exam_title',
      key: 'exam_title',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '参与情况',
      dataIndex: 'participant_stats',
      key: 'participant_stats',
      render: (stats) => `${stats.completed_count || 0} / ${stats.total_participants || 0}`,
    },
    {
      title: '通过率',
      dataIndex: 'pass_rate',
      key: 'pass_rate',
      render: (rate) => `${(rate * 100).toFixed(2)}%`,
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
          {(record.status === 'published' || record.status === 'ongoing') && (
            <Popconfirm
              title="确定取消此考核计划吗？"
              onConfirm={() => handleCancel(record.id)}
              okText="是"
              cancelText="否"
            >
              <Button danger>取消</Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="确定删除此考核计划吗？"
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
    navigate('/assessment/plans/new');
  };

  const handleView = (id) => {
    navigate(`/assessment/plans/${id}`);
  };

  const handleEdit = (id) => {
    navigate(`/assessment/plans/${id}/edit`);
  };

  const handlePublish = async (id) => {
    try {
      await axios.put(`/api/assessment-plans/${id}/status`, { status: 'published' }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('考核计划发布成功');
      fetchAssessmentPlans();
    } catch (error) {
      message.error(`发布失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to publish plan:', error);
    }
  };

  const handleCancel = async (id) => {
    try {
      await axios.put(`/api/assessment-plans/${id}/status`, { status: 'cancelled' }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('考核计划已取消');
      fetchAssessmentPlans();
    } catch (error) {
      message.error(`取消失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to cancel plan:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/assessment-plans/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('考核计划删除成功');
      fetchAssessmentPlans();
    } catch (error) {
      message.error(`删除失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to delete plan:', error);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="考核计划列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建考核计划
          </Button>
        }
      >
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-start' }}>
          <Select
            placeholder="筛选状态"
            style={{ width: 120 }}
            onChange={(value) => handleFilterChange('status', value)}
            allowClear
          >
            <Option value="draft">草稿</Option>
            <Option value="published">已发布</Option>
            <Option value="ongoing">进行中</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
          <RangePicker
            showTime
            format="YYYY-MM-DD HH:mm"
            onChange={(dates) => handleFilterChange('dateRange', dates)}
            value={filters.dateRange}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={plans}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>
    </div>
  );
};

export default AssessmentPlanList;
