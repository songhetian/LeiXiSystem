import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin, Typography, Tag, Descriptions, Table } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title as ChartTitle, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);

const { Title, Text, Paragraph } = Typography;

const ExamAnalysis = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [examAnalysis, setExamAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExamAnalysis();
  }, [examId]);

  const fetchExamAnalysis = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/statistics/exam/${examId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setExamAnalysis(response.data.data);
    } catch (error) {
      message.error(`获取试卷分析失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to fetch exam analysis:', error);
      navigate('/assessment/exams'); // Go back if failed to load
    } finally {
      setLoading(false);
    }
  };

  const getScoreDistributionData = () => {
    if (!examAnalysis || !examAnalysis.score_distribution) return { labels: [], datasets: [] };

    const labels = Object.keys(examAnalysis.score_distribution);
    const data = Object.values(examAnalysis.score_distribution);

    return {
      labels: labels,
      datasets: [
        {
          label: '分数分布',
          data: data,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  const questionCorrectnessColumns = [
    { title: '题号', dataIndex: 'question_number', key: 'question_number' },
    { title: '题型', dataIndex: 'question_type', key: 'question_type', render: (type) => <Tag>{type}</Tag> },
    { title: '题目内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '正确率', dataIndex: 'correct_rate', key: 'correct_rate', render: (rate) => `${(rate * 100).toFixed(2)}%` },
    { title: '平均得分', dataIndex: 'average_score', key: 'average_score', render: (score) => score?.toFixed(2) },
  ];

  const mistakeQuestionsColumns = [
    { title: '排名', dataIndex: 'rank', key: 'rank' },
    { title: '题型', dataIndex: 'question_type', key: 'question_type', render: (type) => <Tag>{type}</Tag> },
    { title: '题目内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '错误次数', dataIndex: 'mistake_count', key: 'mistake_count' },
  ];

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!examAnalysis) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="试卷分析">
          <p>无法加载试卷分析数据。</p>
          <Button type="primary" onClick={() => navigate('/assessment/exams')} icon={<ArrowLeftOutlined />}>
            返回试卷列表
          </Button>
        </Card>
      </div>
    );
  }

  const { exam_details, participation_stats, question_analysis, mistake_questions } = examAnalysis;

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button type="default" onClick={() => navigate('/assessment/exams')} icon={<ArrowLeftOutlined />}>
          返回试卷列表
        </Button>
      </Space>

      <Card title="试卷基本信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xxl: 3, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
          <Descriptions.Item label="标题">{exam_details.title}</Descriptions.Item>
          <Descriptions.Item label="分类">{exam_details.category}</Descriptions.Item>
          <Descriptions.Item label="难度">{exam_details.difficulty}</Descriptions.Item>
          <Descriptions.Item label="题目数">{exam_details.question_count}</Descriptions.Item>
          <Descriptions.Item label="总分">{exam_details.total_score}</Descriptions.Item>
          <Descriptions.Item label="及格分">{exam_details.pass_score}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="参与统计" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xxl: 3, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
          <Descriptions.Item label="参加人数">{participation_stats.total_participants}</Descriptions.Item>
          <Descriptions.Item label="平均分">{participation_stats.average_score?.toFixed(2)}</Descriptions.Item>
          <Descriptions.Item label="最高分">{participation_stats.highest_score?.toFixed(2)}</Descriptions.Item>
          <Descriptions.Item label="最低分">{participation_stats.lowest_score?.toFixed(2)}</Descriptions.Item>
          <Descriptions.Item label="通过率">{`${(participation_stats.pass_rate * 100).toFixed(2)}%`}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="成绩分布图" style={{ marginBottom: 16 }}>
        <div style={{ height: '300px' }}>
          {getScoreDistributionData().labels.length > 0 ? (
            <Bar data={getScoreDistributionData()} options={{ responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: '分数分布' } } }} />
          ) : (
            <Paragraph>暂无成绩分布数据。</Paragraph>
          )}
        </div>
      </Card>

      <Card title="题目正确率分析" style={{ marginBottom: 16 }}>
        <Table
          columns={questionCorrectnessColumns}
          dataSource={question_analysis}
          rowKey="question_id"
          pagination={{ pageSize: 5 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Card title="易错题排行 (TOP 10)">
        <Table
          columns={mistakeQuestionsColumns}
          dataSource={mistake_questions}
          rowKey="question_id"
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 答题时间分析 (Placeholder) */}
      <Card title="答题时间分析" style={{ marginTop: 16 }}>
        <Paragraph>答题时间分析功能待实现。</Paragraph>
      </Card>
    </div>
  );
};

export default ExamAnalysis;
