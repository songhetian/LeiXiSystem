/**
 * 待办中心 (统一审批入口)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Tag, Space, Card, Typography, Empty, Badge, Radio, Divider } from 'antd';
import {
  RocketOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  ContainerOutlined,
  UserAddOutlined,
  CalendarOutlined,
  WalletOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import api from '../../api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const TodoCenter = ({ onNavigate }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = userData.id;
      const response = await api.get('/todo/list', {
        params: { user_id: userId }
      });
      if (response.data.success) {
        setTasks(response.data.data);
      }
    } catch (error) {
      console.error('加载待办失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 分类统计
  const stats = useMemo(() => {
    return {
      reimbursement: tasks.filter(t => t.task_type === 'reimbursement').length,
      attendance: tasks.filter(t => ['leave', 'overtime', 'makeup'].includes(t.task_type)).length,
      audit: tasks.filter(t => t.task_type === 'user_audit').length
    };
  }, [tasks]);

  // 过滤数据
  const filteredTasks = useMemo(() => {
    if (filterType === 'all') return tasks;
    if (filterType === 'reimbursement') return tasks.filter(t => t.task_type === 'reimbursement');
    if (filterType === 'attendance') return tasks.filter(t => ['leave', 'overtime', 'makeup'].includes(t.task_type));
    if (filterType === 'audit') return tasks.filter(t => t.task_type === 'user_audit');
    return tasks;
  }, [tasks, filterType]);

  const columns = [
    {
      title: '类型',
      dataIndex: 'type_label',
      key: 'type_label',
      width: 120,
      render: (text, record) => <Tag color={record.color} style={{ borderRadius: 4, border: 0 }}>{text}</Tag>
    },
    {
      title: '事项摘要',
      key: 'summary',
      render: (_, record) => (
        <div className="flex flex-col">
          <Text strong style={{ fontSize: 15 }}>{record.summary}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.no === 'USER_AUDIT' ? '新用户注册' : record.no}</Text>
        </div>
      )
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 120,
      align: 'center',
      render: (text) => <Space><UserOutlined style={{ color: '#bfbfbf' }} />{text}</Space>
    },
    {
      title: '金额/明细',
      dataIndex: 'extra_info',
      key: 'extra_info',
      width: 180,
      align: 'right',
      render: (val, record) => {
        if (record.task_type === 'reimbursement') {
          return <Text strong style={{ color: '#cf1322', fontSize: 16 }}>¥{parseFloat(val).toFixed(2)}</Text>;
        }
        return <Text type="secondary">{val}</Text>;
      }
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      align: 'center',
      render: (date) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <Text type="secondary">{dayjs(date).fromNow()}</Text>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          size="middle"
          icon={<ArrowRightOutlined />}
          onClick={() => onNavigate(record.tab)}
          style={{ borderRadius: 8, backgroundColor: '#667eea', border: 0 }}
        >
          处理
        </Button>
      )
    }
  ];

  return (
    <div className="p-8">
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>待办中心</Title>
          <Text type="secondary">您有 <strong style={{ color: '#f5222d' }}>{tasks.length}</strong> 项任务等待处理</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchTasks}
          loading={loading}
          style={{ borderRadius: 8 }}
        >
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card hoverable onClick={() => setFilterType('all')} bordered={filterType === 'all'} style={{ borderRadius: 16, border: filterType === 'all' ? '2px solid #667eea' : 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <Space direction="vertical" size={4}>
            <Text type="secondary"><ContainerOutlined /> 全部待办</Text>
            <div className="text-3xl font-bold">{tasks.length}</div>
          </Space>
        </Card>
        <Card hoverable onClick={() => setFilterType('reimbursement')} bordered={filterType === 'reimbursement'} style={{ borderRadius: 16, border: filterType === 'reimbursement' ? '2px solid #1890ff' : 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <Space direction="vertical" size={4}>
            <Text type="secondary"><WalletOutlined /> 报销申请</Text>
            <div className="text-3xl font-bold text-blue-600">{stats.reimbursement}</div>
          </Space>
        </Card>
        <Card hoverable onClick={() => setFilterType('attendance')} bordered={filterType === 'attendance'} style={{ borderRadius: 16, border: filterType === 'attendance' ? '2px solid #fa8c16' : 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <Space direction="vertical" size={4}>
            <Text type="secondary"><CalendarOutlined /> 考勤审批</Text>
            <div className="text-3xl font-bold text-orange-500">{stats.attendance}</div>
          </Space>
        </Card>
        <Card hoverable onClick={() => setFilterType('audit')} bordered={filterType === 'audit'} style={{ borderRadius: 16, border: filterType === 'audit' ? '2px solid #52c41a' : 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <Space direction="vertical" size={4}>
            <Text type="secondary"><UserAddOutlined /> 注册审核</Text>
            <div className="text-3xl font-bold text-green-600">{stats.audit}</div>
          </Space>
        </Card>
      </div>

      <div style={{ background: 'white', borderRadius: 20, padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <div className="flex justify-between items-center mb-6">
          <Radio.Group value={filterType} onChange={e => setFilterType(e.target.value)} buttonStyle="solid">
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="reimbursement">报销</Radio.Button>
            <Radio.Button value="attendance">考勤</Radio.Button>
            <Radio.Button value="audit">审核</Radio.Button>
          </Radio.Group>
        </div>

        <Table
          columns={columns}
          dataSource={filteredTasks}
          rowKey={(record) => `${record.task_type}-${record.id}`}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 项待处理` }}
          locale={{ emptyText: <Empty description="当前没有待办事项，休息一下吧" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </div>
    </div>
  );
};

export default TodoCenter;
