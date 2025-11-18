import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Tag, message, Spin, Select } from 'antd';
import { PlayCircleOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

const MyExamList = () => {
  const navigate = useNavigate();
  const [myExams, setMyExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: undefined,
  });

  useEffect(() => {
    fetchMyExams();
  }, [filters]);

  const fetchMyExams = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/my-exams', {
        params: {
          status: filters.status,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setMyExams(response.data.data.exams);
    } catch (error) {
      message.error('获取我的考试列表失败');
      console.error('Failed to fetch my exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [key]: value,
    }));
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

  const getExamStatus = (exam) => {
    const now = dayjs();
    const startTime = dayjs(exam.start_time);
    const endTime = dayjs(exam.end_time);

    if (exam.status === 'in_progress') {
      return { tag: <Tag color="blue">进行中</Tag>, action: 'continue' };
    }
    if (exam.status === 'graded' || exam.status === 'submitted') {
      return { tag: <Tag color="success">已完成</Tag>, action: 'view_result' };
    }
    if (now.isBefore(startTime)) {
      return { tag: <Tag color="default">未开始</Tag>, action: 'not_started' };
    }
    if (now.isAfter(endTime)) {
      return { tag: <Tag color="error">已结束</Tag>, action: 'view_result' };
    }
    return { tag: <Tag color="green">可开始</Tag>, action: 'start' };
  };

  const handleStartExam = async (planId) => {
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

  const handleViewResult = (resultId) => {
    navigate(`/assessment/results/${resultId}/result`);
  };

  const handleViewHistory = () => {
    navigate('/assessment/my-results'); // Navigate to my results page
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="我的考试"
        extra={
          <Space>
            <Button icon={<HistoryOutlined />} onClick={handleViewHistory}>
              我的成绩
            </Button>
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
          </Space>
        }
      >
        <Spin spinning={loading}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {myExams.length === 0 ? (
              <p style={{ textAlign: 'center', gridColumn: '1 / -1', padding: 20 }}>暂无考试</p>
            ) : (
              myExams.map((exam) => {
                const { tag, action } = getExamStatus(exam);
                return (
                  <Card
                    key={exam.plan_id} // Use plan_id as key for unique plans
                    title={exam.plan_title}
                    extra={tag}
                  >
                    <p><strong>试卷:</strong> {exam.exam_title}</p>
                    <p><strong>难度:</strong> {getDifficultyTag(exam.difficulty)}</p>
                    <p><strong>时长:</strong> {exam.duration} 分钟</p>
                    <p><strong>题目数:</strong> {exam.question_count}</p>
                    <p><strong>及格分:</strong> {exam.pass_score}</p>
                    <p><strong>时间范围:</strong> {dayjs(exam.start_time).format('YYYY-MM-DD HH:mm')} - {dayjs(exam.end_time).format('YYYY-MM-DD HH:mm')}</p>
                    <p><strong>剩余尝试次数:</strong> {exam.max_attempts - exam.attempt_count}</p>
                    {exam.best_score !== null && <p><strong>最佳成绩:</strong> {exam.best_score}</p>}
                    <Space style={{ marginTop: 16 }}>
                      {action === 'start' && (
                        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStartExam(exam.plan_id)}>
                          开始考试
                        </Button>
                      )}
                      {action === 'continue' && (
                        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(`/assessment/take-exam/${exam.result_id}`)}>
                          继续考试
                        </Button>
                      )}
                      {action === 'view_result' && (
                        <Button icon={<EyeOutlined />} onClick={() => handleViewResult(exam.result_id)}>
                          查看成绩
                        </Button>
                      )}
                    </Space>
                  </Card>
                );
              })
            )}
          </div>
        </Spin>
      </Card>
    </div>
  );
};

export default MyExamList;
