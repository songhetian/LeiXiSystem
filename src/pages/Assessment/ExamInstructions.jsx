import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin, Typography, List } from 'antd';
import { PlayCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

const ExamInstructions = () => {
  const { planId } = useParams(); // Assuming planId is passed to get instructions
  const navigate = useNavigate();
  const [planDetails, setPlanDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (planId) {
      fetchPlanDetails(planId);
    } else {
      message.error('未指定考核计划ID');
      setLoading(false);
    }
  }, [planId]);

  const fetchPlanDetails = async (id) => {
    try {
      const response = await axios.get(`/api/assessment-plans/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setPlanDetails(response.data.data);
    } catch (error) {
      message.error('获取考核计划详情失败');
      console.error('Failed to fetch plan details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/assessment-results/start', { plan_id: planId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('考试已开始');
      navigate(`/assessment/take-exam/${response.data.data.result_id}`);
    } catch (error) {
      message.error(`开始考试失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to start exam:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!planDetails) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="考试须知">
          <p>无法加载考试须知，请检查考核计划ID。</p>
          <Button type="primary" onClick={() => navigate('/assessment/my-exams')} icon={<ArrowLeftOutlined />}>
            返回我的考试
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card title={<Title level={3}>考试须知 - {planDetails.title}</Title>}>
        <Paragraph>请仔细阅读以下考试规则和注意事项：</Paragraph>

        <Title level={4}>考试规则</Title>
        <List bordered>
          <List.Item>
            <List.Item.Meta
              title="考试时长"
              description={`${planDetails.exam_duration || planDetails.duration} 分钟`}
            />
          </List.Item>
          <List.Item>
            <List.Item.Meta
              title="题目数量"
              description={`${planDetails.question_count} 题`}
            />
          </List.Item>
          <List.Item>
            <List.Item.Meta
              title="总分"
              description={`${planDetails.total_score} 分`}
            />
          </List.Item>
          <List.Item>
            <List.Item.Meta
              title="及格分"
              description={`${planDetails.pass_score} 分`}
            />
          </List.Item>
          <List.Item>
            <List.Item.Meta
              title="尝试次数"
              description={`最多可尝试 ${planDetails.max_attempts} 次`}
            />
          </List.Item>
        </List>

        <Title level={4} style={{ marginTop: 24 }}>注意事项</Title>
        <List bordered>
          <List.Item>考试期间请勿切换页面或离开考试界面，否则可能被记录为作弊行为。</List.Item>
          <List.Item>您的答案将自动保存，但仍建议您在完成答题后手动提交。</List.Item>
          <List.Item>考试时间结束后，系统将自动提交您的试卷。</List.Item>
          <List.Item>请确保网络连接稳定，避免因网络问题导致考试中断。</List.Item>
        </List>

        <Space style={{ marginTop: 24 }}>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStartExam} loading={loading}>
            确认并开始考试
          </Button>
          <Button onClick={() => navigate('/assessment/my-exams')} disabled={loading} icon={<ArrowLeftOutlined />}>
            取消并返回
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default ExamInstructions;
