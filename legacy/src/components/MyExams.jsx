import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Table, Button, Segmented, Tag, Tooltip, Space } from 'antd';
import { AppstoreOutlined, BarsOutlined, PlayCircleOutlined, CheckCircleOutlined, SyncOutlined, ClockCircleOutlined } from '@ant-design/icons';
import api from '../api';
import './MyExams.css';

const MyExams = ({ onNavigate }) => {
  // Generate a random ID for this instance to track mounts
  const [instanceId] = useState(() => Math.random().toString(36).substr(2, 9));

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  logger.debug(`[MyExams ${instanceId}] Rendering. Loading: ${loading}, Exams: ${exams.length}`);

  // 状态筛选和分页
  const [statusFilter, setStatusFilter] = useState('all'); // all, ongoing, not_started, ended
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const itemsPerPage = 6;

  useEffect(() => {
    logger.debug(`[MyExams ${instanceId}] Mounted`);
    fetchMyExams();
    return () => logger.debug(`[MyExams ${instanceId}] Unmounted`);
  }, []);

  const fetchMyExams = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = api.defaults.baseURL + '/my-exams';
      logger.debug('Fetching my exams using FETCH from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      logger.debug('✅ FETCH 收到响应 status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      logger.debug('✅ FETCH 响应数据:', responseData);

      const data = responseData.data;
      if (data && Array.isArray(data.exams)) {
        logger.debug('✅ 设置考试列表，数量:', data.exams.length);
        setExams(data.exams);
      } else {
        logger.warn('API 返回的数据格式不正确:', data);
        setExams([]);
      }
    } catch (error) {
      logger.error('❌ 获取我的考试失败 (FETCH):', error);
      toast.error('获取我的考试失败');
      setExams([]);
    } finally {
      setLoading(false);
      logger.debug('✅ Loading 设置为 false');
    }
  };

  // 筛选逻辑
  const filteredExams = exams.filter(exam => {
    if (statusFilter === 'all') return true;
    return exam.exam_status === statusFilter;
  });

  // 分页逻辑
  const totalPages = Math.ceil(filteredExams.length / itemsPerPage);
  const currentExams = filteredExams.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusBadge = (exam) => {
    const statusConfig = {
      not_started: { label: '未开始', className: 'status-badge-not-started' },
      ongoing: { label: '进行中', className: 'status-badge-ongoing' },
      ended: { label: '已结束', className: 'status-badge-ended' }
    };

    const config = statusConfig[exam.exam_status] || statusConfig.ended;
    return (
      <span className={`status-badge ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const handleStartExam = async (planId, sourceType) => {
    logger.debug(`[MyExams] handleStartExam called for plan: ${planId}`);
    try {
      setLoading(true);
      // 使用 fetch 调用开始考试 API
      const token = localStorage.getItem('token');
      const response = await fetch(`${api.defaults.baseURL}/assessment-results/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan_id: planId })
      });

      const data = await response.json();
      logger.debug('[MyExams] Start exam response:', data);

      if (response.ok && data.success) {
        const resultId = data.data.result_id;
        logger.debug(`[MyExams] Exam started, navigating to resultId: ${resultId}`);
        onNavigate('exam-taking', { resultId, sourceType });
      } else {
        toast.error(data.message || '开始考试失败');
      }
    } catch (error) {
      logger.error('Failed to start exam:', error);
      toast.error('开始考试失败');
    } finally {
      setLoading(false);
    }
  };

  const getActionButton = (exam) => {
    logger.debug(`[MyExams] getActionButton called for exam: ${exam.plan_id}, status: ${exam.exam_status}`);

    // 优先级1: 有进行中的考试且有答案 - 显示"继续答题"
    if (exam.has_in_progress) {
      return (
        <button
          onClick={(e) => {
            logger.debug('[MyExams] Continue button clicked', e);
            onNavigate('exam-taking', { resultId: exam.in_progress_result_id, sourceType: exam.source_type });
          }}
          className="btn-primary"
        >
          <span>✏️</span>
          继续答题
        </button>
      );
    }

    // 优先级2: 有进行中的考试但没答案,或有剩余次数 - 显示"开始答题"
    if (exam.has_not_started || (exam.remaining_attempts > 0 && exam.exam_status === 'ongoing')) {
      return (
        <button
          onClick={(e) => {
            logger.debug('[MyExams] Start button clicked', e);
            handleStartExam(exam.plan_id, exam.source_type);
          }}
          className="btn-primary"
        >
          <span>▶️</span>
          开始答题
        </button>
      );
    }

    // 优先级3: 有成绩记录 - 显示"查看成绩"
    if (exam.best_score !== null) {
      const resultIdToView = exam.all_attempts.find(r => r.status === 'submitted' || r.status === 'graded' || r.status === 'completed')?.result_id;
      if (resultIdToView) {
        return (
          <button onClick={() => onNavigate('exam-result', { resultId: resultIdToView, sourceType: exam.source_type })} className="btn-secondary">
            <span>📊</span>
            查看成绩
          </button>
        );
      }
    }

    if (exam.exam_status === 'not_started') {
      return (
        <div className="exam-tip">
          <span>⏱️</span>
          考试未开始
        </div>
      );
    }

    if (exam.exam_status === 'ended') {
      return (
        <div className="exam-tip">
          <span>✅</span>
          考试已结束
        </div>
      );
    }
  };

  // 获取卡片样式类名
  const getCardClassName = (status) => {
    switch (status) {
      case 'ongoing': return 'exam-card-modern card-ongoing';
      case 'not_started': return 'exam-card-modern card-not-started';
      case 'ended': return 'exam-card-modern card-ended';
      default: return 'exam-card-modern';
    }
  };

  // 获取时间信息样式类名
  const getTimeInfoClassName = (status) => {
    switch (status) {
      case 'ongoing': return 'time-info time-ongoing';
      case 'not_started': return 'time-info time-not-started';
      case 'ended': return 'time-info time-ended';
      default: return 'time-info';
    }
  };

  return (
    <div className="my-exams-container">
      <div className="my-exams-header">
        <div>
          <h2 className="my-exams-title">我的考试</h2>
          <p className="my-exams-subtitle">共 {exams.length} 场考试</p>
        </div>

        {/* 状态筛选器 */}
        <div className="status-filter">
          <Segmented
            options={[
              { label: '全部', value: 'all' },
              { label: '进行中', value: 'ongoing' },
              { label: '未开始', value: 'not_started' },
              { label: '已结束', value: 'ended' },
            ]}
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
            className="mr-4"
          />
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

      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      )}

      {!loading && filteredExams.length === 0 && (
        <div className="empty-state-modern">
          <div className="empty-icon">📝</div>
          <p className="empty-title">暂无相关考试</p>
          <p className="empty-subtitle">当前筛选条件下没有找到考试</p>
        </div>
      )}

      {viewMode === 'list' ? (
        <Table
          dataSource={filteredExams}
          rowKey="plan_id"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '试卷名称',
              dataIndex: 'exam_title',
              key: 'exam_title',
              render: (text) => <span className="font-medium text-gray-800">{text}</span>
            },
            {
              title: '分类',
              dataIndex: 'category_name', // Assuming this field exists, if not need to fetch or use placeholder
              key: 'category',
              render: (text) => <Tag>{text || '通用'}</Tag>
            },
            {
              title: '状态',
              key: 'status',
              render: (_, record) => {
                 const statusMap = {
                   not_started: { color: 'default', text: '未开始', icon: <ClockCircleOutlined /> },
                   ongoing: { color: 'processing', text: '进行中', icon: <SyncOutlined spin /> },
                   ended: { color: 'error', text: '已结束', icon: <CheckCircleOutlined /> },
                 };
                 const config = statusMap[record.exam_status] || statusMap.ended;
                 return <Tag icon={config.icon} color={config.color}>{config.text}</Tag>;
              }
            },
            {
              title: '考试时长',
              dataIndex: 'exam_duration',
              key: 'duration',
              render: (text) => `${text} 分钟`
            },
            {
              title: '总分/及格',
              key: 'score',
              render: (_, record) => `${record.exam_total_score} / ${record.exam_pass_score}`
            },
            {
              title: '有效时间',
              key: 'time',
              width: 250,
              render: (_, record) => (
                <div className="text-xs text-gray-500">
                  <div>起：{new Date(record.start_time).toLocaleString('zh-CN')}</div>
                  <div>止：{new Date(record.end_time).toLocaleString('zh-CN')}</div>
                </div>
              )
            },
             {
              title: '最佳成绩',
              key: 'best_score',
              render: (_, record) => record.best_score !== null ? (
                <span className={record.is_passed ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                  {record.best_score}分
                </span>
              ) : '-'
            },
            {
              title: '操作',
              key: 'action',
              render: (_, record) => (
                 <div className="list-view-action">
                    {/* Reuse logic but styling for table */}
                    {getActionButton(record)}
                 </div>
              )
            }
          ]}
        />
      ) : (
        <>
          <div className="exams-grid">
            {currentExams.map(exam => (
              <div key={exam.plan_id} className={getCardClassName(exam.exam_status)}>
                {/* 卡片头部 */}
                <div className="card-header">
                  <h3 className="card-title">{exam.plan_title || exam.exam_title}</h3>
                  {getStatusBadge(exam)}
                </div>

                {/* 计划描述 */}
                {exam.plan_description && (
                  <p className="card-description">{exam.plan_description}</p>
                )}

                {/* 试卷信息 */}
                <div className="exam-details-grid">
                  <div className="detail-item">
                    <span className="detail-icon">📝</span>
                    <div className="detail-content">
                      <span className="detail-label">试卷名称</span>
                      <span className="detail-value">{exam.exam_title}</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">⏱️</span>
                    <div className="detail-content">
                      <span className="detail-label">考试时长</span>
                      <span className="detail-value">{exam.exam_duration} 分钟</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">💯</span>
                    <div className="detail-content">
                      <span className="detail-label">总分</span>
                      <span className="detail-value">{exam.exam_total_score} 分</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">✅</span>
                    <div className="detail-content">
                      <span className="detail-label">及格分</span>
                      <span className="detail-value">{exam.exam_pass_score} 分</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">📋</span>
                    <div className="detail-content">
                      <span className="detail-label">题目数量</span>
                      <span className="detail-value">{exam.exam_question_count} 题</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">🔄</span>
                    <div className="detail-content">
                      <span className="detail-label">尝试次数</span>
                      <span className="detail-value">{exam.attempt_count} / {exam.max_attempts}</span>
                    </div>
                  </div>
                </div>

                {/* 时间信息 */}
                <div className={getTimeInfoClassName(exam.exam_status)}>
                  <div className="time-item">
                    <span className="time-label">开始时间</span>
                    <span className="time-value">{new Date(exam.start_time).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="time-item">
                    <span className="time-label">结束时间</span>
                    <span className="time-value">{new Date(exam.end_time).toLocaleString('zh-CN')}</span>
                  </div>
                </div>

                {/* 成绩显示 */}
                {exam.best_score !== null && (
                  <div className={`score-display ${exam.is_passed ? 'score-pass' : 'score-fail'}`}>
                    <span className="score-label">最佳成绩</span>
                    <span className="score-value">{exam.best_score} 分</span>
                    {exam.is_passed && <span className="pass-badge">✓ 已通过</span>}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="card-actions">
                  {getActionButton(exam)}
                </div>
              </div>
            ))}
          </div>

          {/* 分页控件 */}
          {!loading && totalPages > 1 && (
            <div className="pagination-container">
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                上一页
              </button>
              <span className="pagination-info">
                第 {currentPage} 页 / 共 {totalPages} 页
              </span>
              <button
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyExams;
