import api from '@/api';
import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin, Typography, Tag, Descriptions } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, RedoOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title as ChartTitle } from 'chart.js';
import './ExamResult.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, ChartTitle);

const { Title, Text, Paragraph } = Typography;

const ExamResult = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [examResult, setExamResult] = useState(null);
  const [detailedQuestions, setDetailedQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExamResult();
  }, [resultId]);

  const fetchExamResult = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/assessment-results/${resultId}/result`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const payload = response.data.data;
      setExamResult(payload.result_summary);
      setDetailedQuestions(payload.detailed_questions || []);
    } catch (error) {
      message.error(`获取考试结果失败: ${error.response?.data?.message || error.message}`);
      logger.error('Failed to fetch exam result:', error);
      navigate('/assessment/my-exams'); // Go back if failed to load result
    } finally {
      setLoading(false);
    }
  };

  const getCorrectRateByQuestionType = () => {
    const dataSource = detailedQuestions || [];
    if (dataSource.length === 0) return { labels: [], datasets: [] };

    const typeStats = {}; // { type: { correct: 0, total: 0 } }

    dataSource.forEach(detail => {
      const type = detail.type;
      if (!typeStats[type]) {
        typeStats[type] = { correct: 0, total: 0 };
      }
      typeStats[type].total++;
      if (detail.is_correct === 1) {
        typeStats[type].correct++;
      }
    });

    const labels = Object.keys(typeStats).map(type => {
      switch (type) {
        case 'single_choice': return '单选题';
        case 'multiple_choice': return '多选题';
        case 'true_false': return '判断题';
        case 'fill_blank': return '填空题';
        case 'essay': return '简答题';
        default: return type;
      }
    });
    const data = Object.values(typeStats).map(stats => (stats.correct / stats.total) * 100);

    return {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  const getScoreDistribution = () => {
    // 占位：后端单个结果暂不含分布，这里使用详细题目得分构造简单分布或留空
    return { labels: [], datasets: [] };

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

  if (loading) {
    return (
      <div className="exam-result-page">
        <div className="loading-container">
          <Spin className="loading-spinner" size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

  if (!examResult) {
    return (
      <div className="exam-result-page">
        <div className="empty-state">
          <Card title="考试结果">
            <p>无法加载考试结果。</p>
            <Button type="primary" onClick={() => navigate('/assessment/my-exams')} icon={<ArrowLeftOutlined />}>
              返回我的考试
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const { exam_title, user_score, exam_total_score, is_passed, duration, plan_id } = examResult;
  const score = user_score;
  const total_score = exam_total_score;
  const canRetake = true;

  return (
    <div className="exam-result-page">
      <Card className="exam-result-card" title={<Title level={3}>考试结果 - {exam_title}</Title>}>
        {/* 成绩卡片 */}
        <Card className="score-summary-card">
          <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
            <Title className="score-title">
              {score !== null ? score.toFixed(2) : '待评分'} / {total_score}
            </Title>
            <Tag className="score-status-tag" color={is_passed ? 'success' : 'error'}>
              {is_passed ? '通过' : '未通过'}
            </Tag>
            <Descriptions className="score-descriptions" column={2} bordered style={{ width: '100%', marginTop: 16 }}>
              <Descriptions.Item label="正确率">{correct_rate !== null ? `${(correct_rate * 100).toFixed(2)}%` : '-'}</Descriptions.Item>
              <Descriptions.Item label="用时">{time_taken !== null ? `${Math.floor(time_taken / 60)}分${time_taken % 60}秒` : '-'}</Descriptions.Item>
              <Descriptions.Item label="排名">{rank !== null ? rank : '-'}</Descriptions.Item>
              <Descriptions.Item label="尝试次数">{attempt_count} / {max_attempts}</Descriptions.Item>
            </Descriptions>
          </Space>
        </Card>

        {/* 答题统计 */}
        <div className="charts-container">
          <Card className="chart-card" title="各题型正确率">
            <div className="chart-container">
              {getCorrectRateByQuestionType().labels.length > 0 ? (
                <Pie data={getCorrectRateByQuestionType()} options={{ responsive: true, maintainAspectRatio: false }} />
              ) : (
                <Paragraph>暂无题型正确率数据。</Paragraph>
              )}
            </div>
          </Card>
          <Card className="chart-card" title="分数分布">
            <div className="chart-container">
              {getScoreDistribution().labels.length > 0 ? (
                <Bar data={getScoreDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              ) : (
                <Paragraph>暂无分数分布数据。</Paragraph>
              )}
            </div>
          </Card>
        </div>

        {/* 操作按钮 */}
        <div className="button-group">
          <Button className="result-action-btn btn-view-details" icon={<EyeOutlined />} onClick={() => navigate(`/assessment/results/${resultId}/answers`)}>
            查看答题详情
          </Button>
          <Button className="result-action-btn btn-back" onClick={() => navigate('/assessment/my-exams')} icon={<ArrowLeftOutlined />}>
            返回我的考试
          </Button>
          {canRetake && (
            <Button className="result-action-btn btn-retake" icon={<RedoOutlined />} onClick={() => navigate(`/assessment/instructions/${plan_id}`)}>
              再次考试
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ExamResult;
