import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Button, Space, Tag, message, Spin, Table } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { EditOutlined, ArrowLeftOutlined, ExportOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const AssessmentPlanDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoreDistributionData, setScoreDistributionData] = useState({});

  useEffect(() => {
    fetchAssessmentPlanDetails();
    fetchParticipants();
    fetchScoreDistribution();
  }, [id]);

  const fetchAssessmentPlanDetails = async () => {
    try {
      const response = await axios.get(`/api/assessment-plans/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setPlan(response.data.data);
    } catch (error) {
      message.error('获取考核计划详情失败');
      console.error('Failed to fetch assessment plan details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await axios.get(`/api/assessment-plans/${id}/participants`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setParticipants(response.data.data.participants);
    } catch (error) {
      message.error('获取参与者列表失败');
      console.error('Failed to fetch participants:', error);
    }
  };

  const fetchScoreDistribution = async () => {
    // Assuming a statistics API for score distribution per plan or exam
    // For now, we'll simulate or use a generic exam statistics if available
    try {
      // This would ideally be a specific API for plan score distribution
      // For demonstration, let's use exam statistics if plan.exam_id is available
      // Or, if the backend provides a dedicated endpoint for plan score distribution
      // For now, let's use a placeholder or derive from participants if possible
      // This part needs a dedicated backend API for score distribution by plan
      const response = await axios.get(`/api/statistics/exam/${plan?.exam_id}`, { // Placeholder
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const distribution = response.data.data.score_distribution;
      setScoreDistributionData({
        labels: Object.keys(distribution),
        datasets: [
          {
            label: '分数分布',
            data: Object.values(distribution),
            backgroundColor: 'rgba(53, 162, 235, 0.5)',
          },
        ],
      });
    } catch (error) {
      console.warn('获取分数分布失败，可能后端API未实现或数据不足:', error);
      // Fallback to empty data
      setScoreDistributionData({
        labels: ['0-60', '60-70', '70-80', '80-90', '90-100'],
        datasets: [
          {
            label: '分数分布',
            data: [0, 0, 0, 0, 0],
            backgroundColor: 'rgba(53, 162, 235, 0.5)',
          },
        ],
      });
    }
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

  const participantColumns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => record.real_name || text,
    },
    {
      title: '完成状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        switch (status) {
          case 'in_progress': return <Tag color="blue">进行中</Tag>;
          case 'submitted': return <Tag color="warning">待评分</Tag>;
          case 'graded': return <Tag color="success">已评分</Tag>;
          case 'expired': return <Tag color="error">已过期</Tag>;
          default: return <Tag>{status}</Tag>;
        }
      },
    },
    {
      title: '考试成绩',
      dataIndex: 'score',
      key: 'score',
      render: (score) => score !== null ? score.toFixed(2) : '-',
    },
    {
      title: '通过',
      dataIndex: 'is_passed',
      key: 'is_passed',
      render: (isPassed) => isPassed ? <Tag color="success">是</Tag> : <Tag color="error">否</Tag>,
    },
    {
      title: '尝试次数',
      dataIndex: 'attempt_number',
      key: 'attempt_number',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/assessment/results/${record.result_id}/result`)}>查看结果</Button>
          {record.status === 'submitted' && (
            <Button icon={<EditOutlined />} onClick={() => message.info('人工评分功能待实现')}>人工评分</Button>
          )}
        </Space>
      ),
    },
  ];

  const handleExport = () => {
    message.info('导出功能待实现');
    // Implement Excel export logic here
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="考核计划详情">
          <p>考核计划不存在或加载失败。</p>
          <Button type="primary" onClick={() => navigate('/assessment/plans')} icon={<ArrowLeftOutlined />}>
            返回计划列表
          </Button>
        </Card>
      </div>
    );
  }

  const totalParticipants = plan.participant_stats?.total_participants || 0;
  const completedCount = plan.participant_stats?.completed_count || 0;
  const passRate = plan.pass_rate !== undefined ? (plan.pass_rate * 100).toFixed(2) : 'N/A';
  const averageScore = plan.average_score !== undefined ? plan.average_score.toFixed(2) : 'N/A';

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button type="default" onClick={() => navigate('/assessment/plans')} icon={<ArrowLeftOutlined />}>
          返回计划列表
        </Button>
        <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/assessment/plans/${id}/edit`)}>
          编辑计划
        </Button>
        <Button icon={<ExportOutlined />} onClick={handleExport}>
          导出数据
        </Button>
      </Space>

      <Card title="计划基本信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xxl: 3, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
          <Descriptions.Item label="标题">{plan.title}</Descriptions.Item>
          <Descriptions.Item label="试卷">{plan.exam_title}</Descriptions.Item>
          <Descriptions.Item label="状态">{getStatusTag(plan.status)}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{dayjs(plan.start_time).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="结束时间">{dayjs(plan.end_time).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="最大尝试次数">{plan.max_attempts}</Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>{plan.description || '无'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="完成情况统计" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xxl: 3, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
          <Descriptions.Item label="总人数">{totalParticipants}</Descriptions.Item>
          <Descriptions.Item label="已完成">{completedCount}</Descriptions.Item>
          <Descriptions.Item label="未完成">{totalParticipants - completedCount}</Descriptions.Item>
          <Descriptions.Item label="通过率">{passRate}%</Descriptions.Item>
          <Descriptions.Item label="平均分">{averageScore}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="参与者列表" style={{ marginBottom: 16 }}>
        <Table
          columns={participantColumns}
          dataSource={participants}
          rowKey="result_id"
          pagination={{ pageSize: 5 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Card title="成绩分布图表">
        {scoreDistributionData.labels ? (
          <Bar data={scoreDistributionData} options={{ responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: '成绩分布' } } }} />
        ) : (
          <p>暂无成绩分布数据。</p>
        )}
      </Card>
    </div>
  );
};

export default AssessmentPlanDetail;
