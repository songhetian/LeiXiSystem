import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin, Typography, Select, DatePicker, Table } from 'antd';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title as ChartTitle, Tooltip, Legend } from 'chart.js';
import axios from 'axios';
import dayjs from 'dayjs';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ChartTitle, Tooltip, Legend);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const ExamStatistics = () => {
  const [loading, setLoading] = useState(false);
  const [overallStats, setOverallStats] = useState(null);
  const [scoreTrendData, setScoreTrendData] = useState({});
  const [departmentComparisonData, setDepartmentComparisonData] = useState({});
  const [rankingData, setRankingData] = useState([]);
  const [filters, setFilters] = useState({
    dateRange: [],
    examId: undefined,
  });
  const [exams, setExams] = useState([]); // For exam filter

  useEffect(() => {
    fetchOverallStats();
    fetchScoreTrend();
    fetchDepartmentComparison();
    fetchRanking();
    fetchExamsForFilter();
  }, [filters]);

  const fetchOverallStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/statistics/exam-overview', {
        params: {
          start_time: filters.dateRange[0] ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
          end_time: filters.dateRange[1] ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = response.data.data;
      setOverallStats({
        ...data,
        overall_pass_rate: data.pass_rate !== undefined ? parseFloat(data.pass_rate) : undefined
      });
    } catch (error) {
      message.error('获取总体统计失败');
      console.error('Failed to fetch overall stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScoreTrend = async () => {
    try {
      // Assuming an API for score trend, e.g., /api/statistics/score-trend
      const response = await axios.get('/api/statistics/score-trend', { // Placeholder API
        params: {
          start_time: filters.dateRange[0] ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
          end_time: filters.dateRange[1] ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = response.data.data; // Expected format: { labels: [], avg_scores: [], pass_rates: [] }
      setScoreTrendData({
        labels: data.labels,
        datasets: [
          {
            label: '平均分趋势',
            data: data.avg_scores,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            tension: 0.1,
          },
          {
            label: '通过率趋势',
            data: data.pass_rates,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            tension: 0.1,
            yAxisID: 'y1', // Use a different Y-axis for pass rate (percentage)
          },
        ],
      });
    } catch (error) {
      console.warn('获取成绩趋势失败，可能后端API未实现或数据不足:', error);
      setScoreTrendData({});
    }
  };

  const fetchDepartmentComparison = async () => {
    try {
      const response = await axios.get('/api/statistics/department', {
        params: {
          start_time: filters.dateRange[0] ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
          end_time: filters.dateRange[1] ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
          exam_id: filters.examId,
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = response.data.data; // Expected format: { labels: [], avg_scores: [], pass_rates: [] }
      setDepartmentComparisonData({
        labels: data.labels,
        datasets: [
          {
            label: '平均分',
            data: data.avg_scores,
            backgroundColor: 'rgba(53, 162, 235, 0.5)',
          },
          {
            label: '通过率',
            data: data.pass_rates,
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            yAxisID: 'y1',
          },
        ],
      });
    } catch (error) {
      console.warn('获取部门对比统计失败，可能后端API未实现或数据不足:', error);
      setDepartmentComparisonData({});
    }
  };

  const fetchRanking = async () => {
    try {
      const response = await axios.get('/api/statistics/ranking', {
        params: {
          exam_id: filters.examId,
          // Add other filters if needed
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setRankingData(response.data.data.results || []);
    } catch (error) {
      console.warn('获取热门考试排行失败，可能后端API未实现或数据不足:', error);
      setRankingData([]);
    }
  };

  const fetchExamsForFilter = async () => {
    try {
      const response = await axios.get('/api/exams', {
        params: { pageSize: 9999 }, // Get all exams for filter
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setExams(response.data.data.exams);
    } catch (error) {
      console.error('Failed to fetch exams for filter:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [key]: value,
    }));
  };

  const scoreTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: '成绩趋势' },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: '平均分' },
      },
      y1: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        max: 100,
        title: { display: true, text: '通过率 (%)' },
        grid: { drawOnChartArea: false },
      },
    },
  };

  const departmentComparisonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: '部门对比' },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: '平均分' },
      },
      y1: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        max: 100,
        title: { display: true, text: '通过率 (%)' },
        grid: { drawOnChartArea: false },
      },
    },
  };

  const rankingColumns = [
    { title: '排名', dataIndex: 'rank', key: 'rank' },
    { title: '考试名称', dataIndex: 'exam_title', key: 'exam_title' },
    { title: '参与人数', dataIndex: 'participant_count', key: 'participant_count' },
    { title: '平均分', dataIndex: 'average_score', key: 'average_score', render: (score) => score?.toFixed(2) },
    { title: '通过率', dataIndex: 'pass_rate', key: 'pass_rate', render: (rate) => `${(rate * 100).toFixed(2)}%` },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Spin spinning={loading}>
        <Card title="考试统计仪表板" style={{ marginBottom: 16 }}>
          <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-start' }}>
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              onChange={(dates) => handleFilterChange('dateRange', dates)}
              value={filters.dateRange}
            />
            <Select
              placeholder="筛选试卷"
              style={{ width: 200 }}
              onChange={(value) => handleFilterChange('examId', value)}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {exams.map(exam => (
                <Option key={exam.id} value={exam.id}>{exam.title}</Option>
              ))}
            </Select>
          </Space>

          {/* 总体统计卡片 */}
          <Space style={{ width: '100%', justifyContent: 'space-around', marginBottom: 24 }}>
            <Card size="small" title="总考试次数" style={{ width: 200, textAlign: 'center' }}>
              <Title level={3}>{overallStats?.total_exams || 0}</Title>
            </Card>
            <Card size="small" title="平均分" style={{ width: 200, textAlign: 'center' }}>
              <Title level={3}>{overallStats?.average_score?.toFixed(2) || 'N/A'}</Title>
            </Card>
            <Card size="small" title="总通过率" style={{ width: 200, textAlign: 'center' }}>
              <Title level={3}>{overallStats?.overall_pass_rate !== undefined ? `${(overallStats.overall_pass_rate * 100).toFixed(2)}%` : 'N/A'}</Title>
            </Card>
            <Card size="small" title="参与人数" style={{ width: 200, textAlign: 'center' }}>
              <Title level={3}>{overallStats?.total_participants || 0}</Title>
            </Card>
          </Space>

          {/* 成绩趋势图表 */}
          <Card title="成绩趋势" style={{ marginBottom: 24 }}>
            <div style={{ height: '300px' }}>
              {scoreTrendData.labels?.length > 0 ? (
                <Line options={scoreTrendOptions} data={scoreTrendData} />
              ) : (
                <Paragraph>暂无成绩趋势数据。</Paragraph>
              )}
            </div>
          </Card>

          {/* 部门对比图表 */}
          <Card title="部门对比" style={{ marginBottom: 24 }}>
            <div style={{ height: '300px' }}>
              {departmentComparisonData.labels?.length > 0 ? (
                <Bar options={departmentComparisonOptions} data={departmentComparisonData} />
              ) : (
                <Paragraph>暂无部门对比数据。</Paragraph>
              )}
            </div>
          </Card>

          {/* 热门考试排行 */}
          <Card title="热门考试排行">
            <Table
              columns={rankingColumns}
              dataSource={rankingData}
              rowKey="exam_id"
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Card>
      </Spin>
    </div>
  );
};

export default ExamStatistics;
