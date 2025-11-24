import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import './MyExams.css';

const MyExams = ({ onNavigate }) => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const handleStartExam = async (planId, sourceType) => {
    try {
      // MyExams 中的考试都来自考核计划，直接使用 assessment-results 端点
      const endpoint = '/assessment-results/start';

      const response = await api.post(endpoint, { plan_id: planId });
      const recordId = response.data.data.record_id || response.data.data.result_id;
      onNavigate('exam-taking', { resultId: recordId, sourceType: 'assessment_plan' });
    } catch (error) {
      console.error('开始考试失败:', error);
      toast.error(error.response?.data?.message || '开始考试失败');
    }
  };

  const getStatusBadge = (exam) => {
    const statusConfig = {
      not_started: { label: '未开始', color: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800' },
      ongoing: { label: '进行中', color: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800' },
      ended: { label: '已结束', color: 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600' }
    };

    const config = statusConfig[exam.exam_status] || statusConfig.ended;
    return (
      <span className={`px-4 py-2 rounded-full text-sm font-bold ${config.color} shadow-sm`}>
        {config.label}
      </span>
    );
  };

  const getActionButton = (exam) => {
    if (exam.can_start) {
      return (
        <button onClick={() => handleStartExam(exam.plan_id, exam.source_type)} className="btn-primary">
          <span className="material-icons">play_arrow</span>
          开始考试
        </button>
      );
    }

    if (exam.has_in_progress) {
      return (
        <button onClick={() => onNavigate('exam-taking', { resultId: exam.in_progress_result_id, sourceType: exam.source_type })} className="btn-warning">
          <span className="material-icons">edit</span>
          继续答题
        </button>
      );
    }

    if (exam.is_passed || (exam.best_score !== null)) {
      const resultIdToView = exam.all_attempts.find(r => r.status === 'submitted' || r.status === 'graded' || r.status === 'completed')?.result_id;
      if (resultIdToView) {
        return (
          <button onClick={() => onNavigate('exam-result', { resultId: resultIdToView, sourceType: exam.source_type })} className="btn-secondary">
            <span className="material-icons">assessment</span>
            查看成绩
          </button>
        );
      }
    }

    if (exam.exam_status === 'not_started') {
      return (
        <div className="exam-tip">
          <span className="material-icons">schedule</span>
          考试将于 {new Date(exam.start_time).toLocaleString('zh-CN')} 开始
        </div>
      );
    }

    if (exam.exam_status === 'ended') {
      return (
        <div className="exam-tip">
          <span className="material-icons">check_circle</span>
          考试已结束
        </div>
      );
    }
  };

  return (
    <div className="my-exams-container">
      <div className="my-exams-header">
        <div>
          <h2 className="my-exams-title">我的考试</h2>
          <p className="my-exams-subtitle">共 {exams.length} 场考试</p>
        </div>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      )}

      {!loading && exams.length === 0 && (
        <div className="empty-state-modern">
          <div className="empty-icon">📝</div>
          <p className="empty-title">暂无考试</p>
          <p className="empty-subtitle">当前没有可参加的考试</p>
        </div>
      )}

      <div className="exams-grid">
        {exams.map(exam => (
          <div key={exam.plan_id} className="exam-card-modern">
            {/* 卡片顶部状态条 */}
            <div className={`card-top-bar ${
              exam.exam_status === 'ongoing' ? 'bar-ongoing' :
              exam.exam_status === 'not_started' ? 'bar-not-started' :
              'bar-ended'
            }`}></div>

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
                <span className="material-icons detail-icon">description</span>
                <div className="detail-content">
                  <span className="detail-label">试卷名称</span>
                  <span className="detail-value">{exam.exam_title}</span>
                </div>
              </div>

              <div className="detail-item">
                <span className="material-icons detail-icon">schedule</span>
                <div className="detail-content">
                  <span className="detail-label">考试时长</span>
                  <span className="detail-value">{exam.exam_duration} 分钟</span>
                </div>
              </div>

              <div className="detail-item">
                <span className="material-icons detail-icon">grade</span>
                <div className="detail-content">
                  <span className="detail-label">总分</span>
                  <span className="detail-value">{exam.exam_total_score} 分</span>
                </div>
              </div>

              <div className="detail-item">
                <span className="material-icons detail-icon">check_circle</span>
                <div className="detail-content">
                  <span className="detail-label">及格分</span>
                  <span className="detail-value">{exam.exam_pass_score} 分</span>
                </div>
              </div>

              <div className="detail-item">
                <span className="material-icons detail-icon">quiz</span>
                <div className="detail-content">
                  <span className="detail-label">题目数量</span>
                  <span className="detail-value">{exam.exam_question_count} 题</span>
                </div>
              </div>

              <div className="detail-item">
                <span className="material-icons detail-icon">replay</span>
                <div className="detail-content">
                  <span className="detail-label">尝试次数</span>
                  <span className="detail-value">{exam.attempt_count} / {exam.max_attempts}</span>
                </div>
              </div>
            </div>

            {/* 时间信息 */}
            <div className="time-info">
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
    </div>
  );
};

export default MyExams;
