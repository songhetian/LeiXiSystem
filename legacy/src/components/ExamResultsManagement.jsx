import logger from '@/utils/logger';
import React, { useState, useEffect, useMemo } from 'react';
import { Table, Select, Modal, Tag } from 'antd';
import { toast } from 'sonner';
import api from '../api';
import './ExamResultsManagement.css';

const { Option } = Select;

const ExamResultsManagement = ({ onNavigate }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterExam, setFilterExam] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEmployeeResults, setSelectedEmployeeResults] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  useEffect(() => {
    fetchResults();
  }, []);

  // 监听页面缩放变化，强制重新渲染Select组件
  useEffect(() => {
    const handleResize = () => {
      // 触发重新渲染
      setFilterExam(prev => prev);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await api.get('/assessment-results');
      const resultsData = response.data?.data?.results || response.data?.data || [];
      setResults(Array.isArray(resultsData) ? resultsData : []);
      setPagination(prev => ({ ...prev, total: resultsData.length }));
    } catch (error) {
      logger.error('获取考试结果失败:', error);
      toast.error('获取考试结果列表失败');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and group results - show only highest score per employee+exam
  const filteredResults = useMemo(() => {
    if (!Array.isArray(results)) return [];

    // First filter by criteria
    const filtered = results.filter(result => {
      const matchesExam = filterExam === '' || result.exam_title === filterExam;
      const matchesDepartment = filterDepartment === '' || result.user_department === filterDepartment;
      const matchesEmployee = filterEmployee === '' || result.user_real_name === filterEmployee;
      const matchesStatus = filterStatus === '' ||
        (filterStatus === 'passed' && result.passed) ||
        (filterStatus === 'failed' && !result.passed);

      return matchesExam && matchesDepartment && matchesEmployee && matchesStatus;
    });

    // Group by employee + exam, keep only highest score
    const grouped = {};
    filtered.forEach(result => {
      const key = `${result.user_id}-${result.exam_id}`;
      if (!grouped[key]) {
        grouped[key] = result;
      } else {
        // Keep the one with highest score
        if ((result.score || 0) > (grouped[key].score || 0)) {
          grouped[key] = result;
        }
      }
    });

    // Convert to array and sort by submit time descending
    return Object.values(grouped).sort((a, b) =>
      new Date(b.submitted_at) - new Date(a.submitted_at)
    );
  }, [results, filterExam, filterDepartment, filterEmployee, filterStatus]);

  // Get unique values for dropdowns
  const examOptions = useMemo(() =>
    [...new Set(results.map(r => r.exam_title))].filter(Boolean),
    [results]
  );

  const departmentOptions = useMemo(() =>
    [...new Set(results.map(r => r.user_department))].filter(Boolean),
    [results]
  );

  const employeeOptions = useMemo(() =>
    [...new Set(results.map(r => r.user_real_name))].filter(Boolean),
    [results]
  );

  const showDetailModal = (userId, examId) => {
    const employeeExamResults = results.filter(result =>
      result.user_id === userId && result.exam_id === examId
    ).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    setSelectedEmployeeResults(employeeExamResults);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedEmployeeResults([]);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  const handleViewAnswers = (resultId) => {
    closeModal();
    // Navigate to exam result detail page
    if (onNavigate) {
      onNavigate('exam-result', { resultId });
    }
  };

  const columns = [
    {
      title: '员工姓名',
      dataIndex: 'user_real_name',
      key: 'user_real_name',
      width: 120,
      fixed: 'left'
    },
    {
      title: '所属部门',
      dataIndex: 'user_department',
      key: 'user_department',
      width: 150
    },
    {
      title: '试卷名称',
      dataIndex: 'exam_title',
      key: 'exam_title',
      width: 200
    },
    {
      title: '得分',
      key: 'score',
      width: 120,
      render: (_, record) => (
        <span>
          <span className="score-number">{record.score || 0}</span>
          <span className="score-total"> / {record.total_score}</span>
        </span>
      )
    },
    {
      title: '结果',
      dataIndex: 'passed',
      key: 'passed',
      width: 100,
      align: 'center',
      render: (passed) => (
        <Tag color={passed ? 'success' : 'error'}>
          {passed ? '合格' : '不合格'}
        </Tag>
      )
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 180,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-'
    },
    {
      title: '用时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (text) => formatDuration(text)
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <button
          className="action-btn"
          onClick={() => showDetailModal(record.user_id, record.exam_id)}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          查看详情
        </button>
      )
    }
  ];

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  return (
    <div className="exam-results-management">
      <div className="exam-results-card">
        <div className="exam-results-header">
          <h2 className="exam-results-title">考试结果管理</h2>
          <p className="exam-results-subtitle">共 {filteredResults.length} 条记录</p>
        </div>

        <div className="search-filter-section">
          <div className="filter-group">
            <label className="filter-label">试卷选择</label>
            <Select
              showSearch
              allowClear
              placeholder="请选择试卷"
              value={filterExam || undefined}
              onChange={setFilterExam}
              className="filter-select-full"
              getPopupContainer={trigger => trigger.parentNode}
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {examOptions.map((title, index) => (
                <Option key={index} value={title}>{title}</Option>
              ))}
            </Select>
          </div>

          <div className="filter-group">
            <label className="filter-label">部门搜索</label>
            <Select
              showSearch
              allowClear
              placeholder="请选择部门"
              value={filterDepartment || undefined}
              onChange={setFilterDepartment}
              className="filter-select-full"
              getPopupContainer={trigger => trigger.parentNode}
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {departmentOptions.map((dept, index) => (
                <Option key={index} value={dept}>{dept}</Option>
              ))}
            </Select>
          </div>

          <div className="filter-group">
            <label className="filter-label">员工姓名</label>
            <Select
              showSearch
              allowClear
              placeholder="请选择员工"
              value={filterEmployee || undefined}
              onChange={setFilterEmployee}
              className="filter-select-full"
              getPopupContainer={trigger => trigger.parentNode}
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {employeeOptions.map((name, index) => (
                <Option key={index} value={name}>{name}</Option>
              ))}
            </Select>
          </div>

          <div className="filter-group">
            <label className="filter-label">考试状态</label>
            <Select
              allowClear
              placeholder="请选择状态"
              value={filterStatus || undefined}
              onChange={setFilterStatus}
              className="filter-select-full"
              getPopupContainer={trigger => trigger.parentNode}
            >
              <Option value="passed">合格</Option>
              <Option value="failed">不合格</Option>
            </Select>
          </div>
        </div>

        <div className="table-container">
          <Table
            columns={columns}
            dataSource={filteredResults}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
          />
        </div>
      </div>

      <Modal
        title="考试详情"
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={700}
      >
        <div className="modal-body">
          {selectedEmployeeResults.map((result, index) => (
            <div key={result.id} className="detail-record">
              <div className="detail-header">
                <span className="detail-title">第 {result.attempt_number} 次考试</span>
                <Tag color={result.passed ? 'success' : 'error'}>
                  {result.passed ? '合格' : '不合格'}
                </Tag>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">考试时间</span>
                  <div className="detail-value">{new Date(result.submitted_at).toLocaleString('zh-CN')}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">用时</span>
                  <div className="detail-value">{formatDuration(result.duration)}</div>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">得分</span>
                  <div className="score-container">
                    <span className={`score-value ${result.passed ? 'text-success' : 'text-error'}`}>
                      {result.score !== null && result.score !== undefined ? result.score : 0}
                    </span>
                    <span className="score-total">/ {result.total_score}</span>
                  </div>
                </div>
              </div>

              <div className="detail-footer">
                <button
                  className="view-answers-btn-secondary"
                  onClick={() => handleViewAnswers(result.id)}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  查看答题详情
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ExamResultsManagement;
