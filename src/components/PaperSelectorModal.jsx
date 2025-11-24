import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import './PaperSelectorModal.css';

const PaperSelectorModal = ({ isOpen, onSelect, onClose }) => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchExams();
    }
  }, [isOpen]);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const response = await api.get('/exams?status=published&pageSize=100');
      setExams(response.data?.data?.exams || []);
    } catch (error) {
      console.error('获取试卷列表失败:', error);
      toast.error('获取试卷列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredExams = exams.filter(exam =>
    exam.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content paper-selector" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>选择试卷</h3>
          <button onClick={onClose} className="close-btn">
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="search-box">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="搜索试卷..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading && <div className="loading">加载中...</div>}

        <div className="exam-list">
          {filteredExams.length === 0 && !loading && (
            <div className="empty-state">
              <span className="material-icons">assignment</span>
              <p>暂无已发布的试卷</p>
            </div>
          )}

          {filteredExams.map(exam => (
            <div key={exam.id} className="exam-item">
              <div className="exam-info">
                <h4>{exam.title}</h4>
                <div className="exam-meta">
                  <span className="meta-item">
                    <span className="material-icons">quiz</span>
                    {exam.question_count} 题
                  </span>
                  <span className="meta-item">
                    <span className="material-icons">grade</span>
                    {exam.total_score} 分
                  </span>
                  <span className="meta-item">
                    <span className="material-icons">schedule</span>
                    {exam.duration} 分钟
                  </span>
                  {exam.difficulty && (
                    <span className={`difficulty ${exam.difficulty}`}>
                      {exam.difficulty === 'easy' ? '简单' : exam.difficulty === 'medium' ? '中等' : '困难'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  onSelect(exam);
                  onClose();
                }}
                className="btn-select"
              >
                选择
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaperSelectorModal;
