import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Select, Space, Tag, message, DatePicker } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const MyResults = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
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
  const [sorter, setSorter] = useState({});

  const fetchMyResults = async (params = {}) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/my-results', {
        params: {
          page: params.pagination?.current || pagination.current,
          pageSize: params.pagination?.pageSize || pagination.pageSize,
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
      message.error('获取我的考试记录失败');
      console.error('Failed to fetch my results:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyResults();
  }, [pagination.current, pagination.pageSize, filters, sorter]);

  const handleTableChange = (newPagination, _, newSorter) => {
    setPagination(newPagination);
    setSorter({ field: newSorter.field, order: newSorter.order });
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
      title: '考试时间',
      dataIndex: 'submit_time',
      key: 'submit_time',
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-',
      sorter: true,
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
      title: '用时',
      dataIndex: 'time_taken',
      key: 'time_taken',
      render: (time) => time !== null ? `${Math.floor(time / 60)}分${time % 60}秒` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/assessment/results/${record.id}/result`)}>查看详情</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="我的成绩">
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-start' }}>
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

        <Table
          columns={columns}
          dataSource={results}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>
    </div>
  );
};

export default MyResults;
