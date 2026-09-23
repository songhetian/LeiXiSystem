import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { Input, Select, Button, message, Card, Modal, Table, Segmented, Tag, Tooltip } from 'antd';
import { SearchOutlined, EyeOutlined, AppstoreOutlined, BarsOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getApiUrl } from '../utils/apiConfig';
import './MyExamResults.css';

const { Option } = Select;

const MyExamResults = ({ onNavigate }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    is_passed: '' // '' for all, 'true', 'false'
  });

  // 新增状态用于模态框
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedExamResults, setSelectedExamResults] = useState([]);
  const [examTitles, setExamTitles] = useState([]); // 存储所有试卷标题
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'

  const fetchResults = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        page,
        limit: pageSize,
        search: filters.search,
        sort_by: 'submit_time',
        order: 'desc'
      });

      if (filters.is_passed) {
        queryParams.append('is_passed', filters.is_passed);
      }

      const url = getApiUrl(`/api/my-exam-results?${queryParams.toString()}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setResults(data.data.results);
        setPagination({
          current: data.data.page,
          pageSize: pageSize, // Keep current page size
          total: data.data.total
        });

        // 提取所有唯一的试卷标题
        const titles = [...new Set(data.data.results.map(result => result.exam_title))];
        setExamTitles(titles);
      } else {
        message.error(data.message || '获取考试结果失败');
      }
    } catch (error) {
      logger.error('Failed to fetch exam results:', error);
      message.error('获取考试结果失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults(pagination.current, pagination.pageSize);
  }, [pagination.current, pagination.pageSize, filters]); // Re-fetch when these change

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, search: value }));
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to page 1
  };

  const handleFilterChange = (value) => {
    setFilters(prev => ({ ...prev, is_passed: value }));
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to page 1
  };

  // 新增：根据试卷标题过滤结果
  const handleExamFilterChange = (value) => {
    setFilters(prev => ({ ...prev, search: value }));
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to page 1
  };

  const handleTableChange = (newPagination) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  // 新增：显示模态框并设置选中的考试结果
  const showModal = (examTitle) => {
    const examResults = results.filter(result => result.exam_title === examTitle);
    setSelectedExamResults(examResults);
    setModalVisible(true);
  };

  // 新增：关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setSelectedExamResults([]);
  };

  // 将结果按试卷分组
  const groupedResults = results.reduce((acc, result) => {
    const examTitle = result.exam_title;
    if (!acc[examTitle]) {
      acc[examTitle] = {
        exam_title: examTitle,
        plan_title: result.plan_title,
        attempts: [],
        highestScore: 0,
        isPassed: false
      };
    }

    acc[examTitle].attempts.push(result);

    // 更新最高分和是否通过
    if (result.score > acc[examTitle].highestScore) {
      acc[examTitle].highestScore = result.score;
      acc[examTitle].isPassed = result.is_passed;
    }

    return acc;
  }, {});

  return (
    <div className="my-exam-results-container">
      <Card title="我的考试结果" variant="borderless" className="shadow-sm">
        <div className="exam-results-controls">
          <div className="exam-results-search">
            <Input.Search
              placeholder="搜索试卷名称..."
              allowClear
              onSearch={handleSearch}
              enterButton={<Button icon={<SearchOutlined />}>搜索</Button>}
            />
          </div>
          <Select
            className="exam-results-filter"
            defaultValue=""
            onChange={handleFilterChange}
          >
            <Option value="">所有结果</Option>
            <Option value="true">合格</Option>
            <Option value="false">不合格</Option>
          </Select>
          {/* 新增：试卷选择下拉框 */}
          <Select
            className="exam-results-exam-filter"
            placeholder="选择试卷"
            allowClear
            onChange={handleExamFilterChange}
          >
            {examTitles.map((title, index) => (
              <Option key={index} value={title}>{title}</Option>
            ))}
          </Select>
          <div className="flex-1 text-right">
             <Segmented
              options={[
                { value: 'grid', icon: <AppstoreOutlined /> },
                { value: 'list', icon: <BarsOutlined /> },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
          </div>
        </div>

        {/* 视图内容 */}
        {viewMode === 'list' ? (
          <Table
            dataSource={Object.values(groupedResults)}
            rowKey="exam_title"
            pagination={false} // Use external pagination controls like grid
            columns={[
              {
                title: '试卷名称',
                dataIndex: 'exam_title',
                key: 'exam_title',
                render: (text) => <span className="font-medium text-gray-800">{text}</span>
              },
              {
                title: '考核计划',
                dataIndex: 'plan_title',
                key: 'plan_title',
              },
              {
                title: '最高得分',
                dataIndex: 'highestScore',
                key: 'score',
                render: (score, record) => (
                  <span className={record.isPassed ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                    {score} 分
                  </span>
                )
              },
              {
                title: '状态',
                key: 'status',
                render: (_, record) => (
                   <Tag icon={record.isPassed ? <CheckCircleOutlined /> : <CloseCircleOutlined />} color={record.isPassed ? 'success' : 'error'}>
                     {record.isPassed ? '合格' : '不合格'}
                   </Tag>
                )
              },
              {
                title: '操作',
                key: 'action',
                render: (_, record) => (
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => showModal(record.exam_title)}
                  >
                    查看详情
                  </Button>
                )
              }
            ]}
          />
        ) : (
        /* 卡片式布局 */
        <div className="exam-cards-container">
          {Object.keys(groupedResults).map((examTitle, index) => {
            const examData = groupedResults[examTitle];
            const isPassed = examData.isPassed;
            const highestScore = examData.highestScore;

            return (
              <div
                key={index}
                className={`exam-card ${isPassed ? 'passed' : 'failed'}`}
                onClick={() => showModal(examTitle)}
              >
                <div className="exam-card-header">
                  <h3 className="exam-card-title">{examTitle}</h3>
                  <p className="exam-card-plan">{examData.plan_title}</p>
                </div>
                <div className="exam-card-body">
                  <div className="exam-score">
                    <span className="score-label">最高分:</span>
                    <span className="score-value">{highestScore}</span>
                  </div>
                  <div className={`exam-status ${isPassed ? 'passed' : 'failed'}`}>
                    {isPassed ? '合格' : '不合格'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* 分页 */}
        <div className="exam-results-pagination">
          <Button
            disabled={pagination.current === 1}
            onClick={() => handleTableChange({ current: pagination.current - 1, pageSize: pagination.pageSize })}
          >
            上一页
          </Button>
          <span className="pagination-info">
            第 {pagination.current} 页，共 {Math.ceil(pagination.total / pagination.pageSize)} 页
          </span>
          <Button
            disabled={pagination.current === Math.ceil(pagination.total / pagination.pageSize)}
            onClick={() => handleTableChange({ current: pagination.current + 1, pageSize: pagination.pageSize })}
          >
            下一页
          </Button>
        </div>
      </Card>

      {/* 模态框：显示历次考试详情 */}
      <Modal
        title="考试详情"
        visible={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={800}
      >
        <div className="exam-details-modal">
          {selectedExamResults.map((result, index) => (
            <div key={index} className="exam-detail-card">
              <div className="detail-header">
                <span className="attempt-number">第 {result.attempt_number} 次尝试</span>
                <span className={`detail-status ${result.is_passed ? 'passed' : 'failed'}`}>
                  {result.is_passed ? '合格' : '不合格'}
                </span>
              </div>
              <div className="detail-body">
                <div className="detail-row">
                  <span className="detail-label">得分:</span>
                  <span className="detail-value">{result.score} / {result.exam_total_score}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">提交时间:</span>
                  <span className="detail-value">{new Date(result.submit_time).toLocaleString('zh-CN')}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">用时:</span>
                  <span className="detail-value">{formatDuration(result.duration)}</span>
                </div>
              </div>
              <div className="detail-actions">
                <button
                  className="view-detail-btn"
                  onClick={() => onNavigate('exam-result', { resultId: result.id })}
                >
                  <EyeOutlined />
                  查看详情
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default MyExamResults;
