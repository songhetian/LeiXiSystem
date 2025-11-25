import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import './MyExams.css';

const MyExams = ({ onNavigate }) => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // 状态筛选和分页
  const [statusFilter, setStatusFilter] = useState('all'); // all, ongoing, not_started, ended
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    fetchMyExams();
  }, []);

  const fetchMyExams = async () => {
    setLoading(true);
    try {
      console.log('Fetching my exams from:', api.defaults.baseURL + '/my-exams');
      const response = await api.get('/my-exams');
      const data = response.data?.data;
      if (data && Array.isArray(data.exams)) {
        setExams(data.exams);
      } else {
        console.warn('API 返回的数据格式不正确:', data);
        setExams([]);
      }
    } catch (error) {
      console.error('获取我的考试失败:', error);
      toast.error('获取我的考试失败');
      setExams([]);
    } finally {
      setLoading(false);
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

  const getActionButton = (exam) => {
    // 优先级1: 有进行中的考试且有答案 - 显示"继续答题"
    if (exam.has_in_progress) {
      return (
        <button onClick={() => onNavigate('exam-taking', { resultId: exam.in_progress_result_id, sourceType: exam.source_type })} className="btn-primary">
          <span>✏️</span>
          继续答题
        </button>
      );
    }

    // 优先级2: 有进行中的考试但没答案,或有剩余次数 - 显示"开始答题"
    if (exam.has_not_started || (exam.remaining_attempts > 0 && exam.exam_status === 'ongoing')) {
      return (
        <button onClick={() => onNavigate('exam-taking', { resultId: exam.in_progress_result_id, sourceType: exam.source_type })} className="btn-primary">
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
          <button
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
          >
            全部
          </button>
          <button
            className={`filter-btn ${statusFilter === 'ongoing' ? 'active' : ''}`}
            onClick={() => { setStatusFilter('ongoing'); setCurrentPage(1); }}
          >
            进行中
          </button>
          <button
            className={`filter-btn ${statusFilter === 'not_started' ? 'active' : ''}`}
            onClick={() => { setStatusFilter('not_started'); setCurrentPage(1); }}
          >
            未开始
          </button>
          <button
            className={`filter-btn ${statusFilter === 'ended' ? 'active' : ''}`}
            onClick={() => { setStatusFilter('ended'); setCurrentPage(1); }}
          >
            已结束
          </button>
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
    </div>
  );
};

export default MyExams;
