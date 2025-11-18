import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin, Typography, Tag, Descriptions, Table, Timeline } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Line, Radar, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Filler, BarElement, Title as ChartTitle, Tooltip, Legend } from 'chart.js';
import dayjs from 'dayjs';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Filler, BarElement, ChartTitle, Tooltip, Legend);

const { Title, Text, Paragraph } = Typography;

const UserAnalysis = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [userAnalysis, setUserAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserAnalysis();
  }, [userId]);

  const fetchUserAnalysis = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/statistics/user/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setUserAnalysis(response.data.data);
    } catch (error) {
      message.error(`获取用户分析失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to fetch user analysis:', error);
      navigate('/users'); // Navigate back to user list or dashboard
    } finally {
      setLoading(false);
    }
  };

  const getScoreTrendData = () => {
    if (!userAnalysis || !userAnalysis.exam_history) return { labels: [], datasets: [] };

    const sortedHistory = [...userAnalysis.exam_history].sort((a, b) => dayjs(a.submit_time).valueOf() - dayjs(b.submit_time).valueOf());

    return {
      labels: sortedHistory.map(record => dayjs(record.submit_time).format('YYYY-MM-DD HH:mm')),
      datasets: [
        {
          label: '我的成绩',
          data: sortedHistory.map(record => record.score),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          tension: 0.1,
        },
        {
          label: '平均分',
          data: sortedHistory.map(record => record.average_score_for_exam), // Assuming backend provides this
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          tension: 0.1,
        },
      ],
    };
  };

  const getStrengthsWeaknessesData = () => {
    if (!userAnalysis || !userAnalysis.correctness_by_type) return { labels: [], datasets: [] };

    const labels = Object.keys(userAnalysis.correctness_by_type).map(type => {
      switch (type) {
        case 'single_choice': return '单选';
        case 'multiple_choice': return '多选';
        case 'true_false': return '判断';
        case 'fill_blank': return '填空';
        case 'essay': return '简答';
        default: return type;
      }
    });
    const data = Object.values(userAnalysis.correctness_by_type).map(stats => (stats.correct / stats.total) * 100);

    return {
      labels: labels,
      datasets: [
        {
          label: '正确率 (%)',
          data: data,
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  const getComparisonWithAverageData = () => {
    if (!userAnalysis || !userAnalysis.exam_history) return { labels: [], datasets: [] };

    const labels = userAnalysis.exam_history.map(record => record.exam_title);
    const userScores = userAnalysis.exam_history.map(record => record.score);
    const averageScores = userAnalysis.exam_history.map(record => record.average_score_for_exam);

    return {
      labels: labels,
      datasets: [
        {
          label: '我的成绩',
          data: userScores,
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
        },
        {
          label: '平均分',
          data: averageScores,
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        },
      ],
    };
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!userAnalysis) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="用户成绩分析">
          <p>无法加载用户成绩分析数据。</p>
          <Button type="primary" onClick={() => navigate('/users')} icon={<ArrowLeftOutlined />}>
            返回用户列表
          </Button>
        </Card>
      </div>
    );
  }

  const { user_info, overall_stats, exam_history } = userAnalysis;

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button type="default" onClick={() => navigate('/users')} icon={<ArrowLeftOutlined />}>
          返回用户列表
        </Button>
      </Space>

      <Card title={`用户成绩分析 - ${user_info.real_name || user_info.username}`} style={{ marginBottom: 16 }}>
        {/* 个人成绩概览卡片 */}
        <Card title="个人成绩概览" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={{ xxl: 3, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
            <Descriptions.Item label="参加考试次数">{overall_stats.total_exams}</Descriptions.Item>
            <Descriptions.Item label="平均分">{overall_stats.average_score?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="通过率">{`${(overall_stats.pass_rate * 100).toFixed(2)}%`}</Descriptions.Item>
            <Descriptions.Item label="最佳成绩">{overall_stats.best_score?.toFixed(2)}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 成绩趋势图 */}
        <Card title="成绩趋势" style={{ marginBottom: 16 }}>
          <div style={{ height: '300px' }}>
            {getScoreTrendData().labels.length > 0 ? (
              <Line data={getScoreTrendData()} options={{ responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: '成绩趋势' } } }} />
            ) : (
              <Paragraph>暂无成绩趋势数据。</Paragraph>
            )}
          </div>
        </Card>

        {/* 强弱项分析（雷达图） */}
        <Card title="强弱项分析 (按题型)" style={{ marginBottom: 16 }}>
          <div style={{ height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {getStrengthsWeaknessesData().labels.length > 0 ? (
              <Radar data={getStrengthsWeaknessesData()} options={{ responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: '题型正确率' } }, scales: { r: { beginAtZero: true, min: 0, max: 100 } } }} />
            ) : (
              <Paragraph>暂无强弱项分析数据。</Paragraph>
            )}
          </div>
        </Card>

        {/* 与平均分对比（柱状图） */}
        <Card title="与平均分对比" style={{ marginBottom: 16 }}>
          <div style={{ height: '300px' }}>
            {getComparisonWithAverageData().labels.length > 0 ? (
              <Bar data={getComparisonWithAverageData()} options={{ responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: '我的成绩与平均分对比' } } }} />
            ) : (
              <Paragraph>暂无对比数据。</Paragraph>
            )}
          </div>
        </Card>

        {/* 考试历史记录（时间轴） */}
        <Card title="考试历史记录">
          {exam_history.length > 0 ? (
            <Timeline mode="left">
              {exam_history.map((record, index) => (
                <Timeline.Item key={index} color={record.is_passed ? 'green' : 'red'}>
                  <Paragraph>
                    <Text strong>{dayjs(record.submit_time).format('YYYY-MM-DD HH:mm')}</Text> - {record.exam_title}
                  </Paragraph>
                  <Paragraph>
                    成绩: <Text strong>{record.score?.toFixed(2)}</Text> / {record.total_score}
                    <Tag color={record.is_passed ? 'success' : 'error'} style={{ marginLeft: 8 }}>
                      {record.is_passed ? '通过' : '未通过'}
                    </Tag>
                  </Paragraph>
                  <Button size="small" onClick={() => navigate(`/assessment/results/${record.result_id}/result`)}>
                    查看详情
                  </Button>
                </Timeline.Item>
              ))}
            </Timeline>
          ) : (
            <Paragraph>暂无考试历史记录。</Paragraph>
          )}
        </Card>
      </Card>
    </div>
  );
};

export default UserAnalysis;
