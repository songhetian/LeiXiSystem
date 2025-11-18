import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Button, Space, Tag, message, Spin, Collapse } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { EditOutlined, PlusOutlined, UploadOutlined, SwapOutlined, EyeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Panel } = Collapse;

import { Skeleton } from 'antd';

const ExamDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExamDetails();
    fetchExamQuestions();
  }, [id]);

  const fetchExamDetails = async () => {
    try {
      const response = await axios.get(`/api/exams/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setExam(response.data.data);
    } catch (error) {
      message.error('获取试卷详情失败');
      console.error('Failed to fetch exam details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExamQuestions = async () => {
    try {
      const response = await axios.get(`/api/exams/${id}/questions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setQuestions(response.data.data.questions);
    } catch (error) {
      message.error('获取试卷题目失败');
      console.error('Failed to fetch exam questions:', error);
    }
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

  const handleEditExam = () => {
    navigate(`/assessment/exams/${id}/edit`);
  };

  const handleAddQuestion = () => {
    message.info('添加题目功能待实现');
    // navigate(`/assessment/exams/${id}/questions/new`);
  };

  const handleBatchImportQuestions = () => {
    message.info('批量导入题目功能待实现');
    // navigate(`/assessment/exams/${id}/questions/import`);
  };

  const handleReorderQuestions = () => {
    message.info('题目排序功能待实现');
    // navigate(`/assessment/exams/${id}/questions/reorder`);
  };

  const handlePreviewExam = () => {
    message.info('试卷预览功能待实现');
    // navigate(`/assessment/exams/${id}/preview`);
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="试卷详情" style={{ marginBottom: 16 }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
        <Card title="考试配置信息" style={{ marginBottom: 16 }}>
          <Skeleton active paragraph={{ rows: 2 }} />
        </Card>
        <Card title="题目列表">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  if (!exam) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="试卷详情">
          <p>试卷不存在或加载失败。</p>
          <Button type="primary" onClick={() => navigate('/assessment/exams')} icon={<ArrowLeftOutlined />}>
            返回试卷列表
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button type="default" onClick={() => navigate('/assessment/exams')} icon={<ArrowLeftOutlined />}>
          返回试卷列表
        </Button>
        <Button type="primary" icon={<EditOutlined />} onClick={handleEditExam}>
          编辑试卷
        </Button>
        <Button icon={<EyeOutlined />} onClick={handlePreviewExam}>
          预览试卷
        </Button>
      </Space>

      <Card title="试卷基本信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xxl: 3, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
          <Descriptions.Item label="标题">{exam.title}</Descriptions.Item>
          <Descriptions.Item label="分类">{exam.category}</Descriptions.Item>
          <Descriptions.Item label="难度">{getDifficultyTag(exam.difficulty)}</Descriptions.Item>
          <Descriptions.Item label="状态">{getStatusTag(exam.status)}</Descriptions.Item>
          <Descriptions.Item label="创建人">{exam.created_by_name || '未知'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(exam.created_at).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>{exam.description || '无'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="考试配置信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xxl: 3, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
          <Descriptions.Item label="考试时长">{exam.duration} 分钟</Descriptions.Item>
          <Descriptions.Item label="总分">{exam.total_score}</Descriptions.Item>
          <Descriptions.Item label="及格分">{exam.pass_score}</Descriptions.Item>
          <Descriptions.Item label="题目数量">{exam.question_count}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="题目列表"
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={handleAddQuestion}>添加题目</Button>
            <Button icon={<UploadOutlined />} onClick={handleBatchImportQuestions}>批量导入</Button>
            <Button icon={<SwapOutlined />} onClick={handleReorderQuestions}>题目排序</Button>
          </Space>
        }
      >
        {questions.length === 0 ? (
          <p>暂无题目，请添加。</p>
        ) : (
          <Collapse accordion>
            {questions.map((question, index) => (
              <Panel header={`${index + 1}. [${question.type}] ${question.content}`} key={question.id}>
                <p><strong>分值:</strong> {question.score}</p>
                {/* Further question details can be displayed here */}
                {/* For example, options for multiple choice, etc. */}
              </Panel>
            ))}
          </Collapse>
        )}
      </Card>

      {/* 统计信息 (待实现) */}
      <Card title="统计信息" style={{ marginTop: 16 }}>
        <p>使用次数: 待获取</p>
        <p>平均分: 待获取</p>
        <p>通过率: 待获取</p>
      </Card>
    </div>
  );
};

export default ExamDetail;
