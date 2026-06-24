import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/apiConfig';
import { formatDate } from '../utils/date';

const CaseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [liked, setLiked] = useState(false);
  const [collected, setCollected] = useState(false);

  const user_id = 1; // 从认证获取

  useEffect(() => {
    loadCaseDetail();
    loadComments();
    recordView();
  }, [id]);

  const loadCaseDetail = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/quality/cases/${id}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        setCaseData(result.data);
      } else {
        toast.error('加载案例失败');
      }
    } catch (error) {
      logger.error('Error loading case:', error);
      toast.error('加载案例失败');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/quality/cases/${id}/comments`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        setComments(result.data);
      }
    } catch (error) {
      logger.error('Error loading comments:', error);
    }
  };

  const recordView = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(getApiUrl(`/api/quality/cases/${id}/view`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      logger.error('Error recording view:', error);
    }
  };

  const handleLike = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/quality/cases/${id}/like`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        setLiked(result.liked);
        toast.success(result.message);
        loadCaseDetail();
      }
    } catch (error) {
      logger.error('Error liking case:', error);
      toast.error('操作失败');
    }
  };

  const handleCollect = async () => {
    try {
      const token = localStorage.getItem('token');
      const method = collected ? 'DELETE' : 'POST';
      const response = await fetch(getApiUrl(`/api/quality/cases/${id}/collect`), {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        setCollected(!collected);
        toast.success(result.message);
        loadCaseDetail();
      }
    } catch (error) {
      logger.error('Error collecting case:', error);
      toast.error('操作失败');
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      toast.error('评论内容不能为空');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/quality/cases/${id}/comments`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newComment,
          parent_id: replyTo
        })
      });
      const result = await response.json();

      if (result.success) {
        toast.success('评论成功');
        setNewComment('');
        setReplyTo(null);
        loadComments();
        loadCaseDetail();
      }
    } catch (error) {
      logger.error('Error submitting comment:', error);
      toast.error('评论失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">案例不存在</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 返回按钮 */}
      <button
        onClick={() => navigate(-1)}
        className="business-btn business-btn-secondary mb-4"
      >
        ← 返回列表
      </button>

      {/* 案例头部 */}
      <div className="business-card mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{caseData.title}</h1>
            <div className="flex gap-3 text-sm text-gray-600">
              <span>创建者: {caseData.creator_name}</span>
              <span>•</span>
              <span>{formatDate(caseData.created_at)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLike}
              className={`business-btn ${liked ? 'business-btn-primary' : 'business-btn-secondary'}`}
            >
              👍 {caseData.like_count}
            </button>
            <button
              onClick={handleCollect}
              className={`business-btn ${collected ? 'business-btn-warning' : 'business-btn-secondary'}`}
            >
              ⭐ {collected ? '已收藏' : '收藏'}
            </button>
          </div>
        </div>

        {/* 标签 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`business-badge ${caseData.case_type === 'excellent' ? 'business-badge-success' : 'business-badge-danger'}`}>
            {caseData.case_type === 'excellent' ? '优秀案例' : '不良案例'}
          </span>
          <span className="business-badge business-badge-info">{caseData.category}</span>
          <span className="business-badge business-badge-secondary">
            难度: {caseData.difficulty_level === 'easy' ? '简单' : caseData.difficulty_level === 'medium' ? '中等' : '困难'}
          </span>
          {caseData.tags && caseData.tags.map(tag => (
            <span key={tag.id} className="business-badge business-badge-secondary">
              {tag.name}
            </span>
          ))}
        </div>

        {/* 统计信息 */}
        <div className="flex gap-6 text-sm text-gray-600 pb-4 border-b">
          <span>👁 浏览 {caseData.view_count}</span>
          <span>💬 评论 {caseData.comment_count}</span>
          <span>⭐ 收藏 {caseData.collect_count}</span>
        </div>
      </div>

      {/* 问题描述 */}
      <div className="business-card mb-6">
        <h2 className="text-xl font-semibold mb-4">问题描述</h2>
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: caseData.problem_description }} />
      </div>

      {/* 解决方案 */}
      <div className="business-card mb-6">
        <h2 className="text-xl font-semibold mb-4">解决方案</h2>
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: caseData.solution }} />
      </div>

      {/* 关键要点 */}
      {caseData.key_points && (
        <div className="business-card mb-6">
          <h2 className="text-xl font-semibold mb-4">关键要点</h2>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: caseData.key_points }} />
        </div>
      )}

      {/* 附件 */}
      {caseData.attachments && caseData.attachments.length > 0 && (
        <div className="business-card mb-6">
          <h2 className="text-xl font-semibold mb-4">附件</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {caseData.attachments.map(attachment => (
              <div key={attachment.id} className="border rounded-lg p-3">
                <div className="text-sm font-medium truncate">{attachment.file_name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {(attachment.file_size / 1024).toFixed(2)} KB
                </div>
                <a
                  href={getApiUrl(attachment.file_url)}
                  download
                  className="text-primary-600 text-xs mt-2 inline-block"
                >
                  下载
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 评论区 */}
      <div className="business-card">
        <h2 className="text-xl font-semibold mb-4">评论 ({comments.length})</h2>

        {/* 评论输入 */}
        <div className="mb-6">
          {replyTo && (
            <div className="mb-2 text-sm text-gray-600">
              回复评论
              <button onClick={() => setReplyTo(null)} className="ml-2 text-primary-600">取消</button>
            </div>
          )}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="写下你的评论..."
            className="business-textarea"
            rows="3"
          />
          <button
            onClick={handleSubmitComment}
            className="business-btn business-btn-primary mt-2"
          >
            发表评论
          </button>
        </div>

        {/* 评论列表 */}
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="border-b pb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-medium">{comment.user_name}</span>
                  <span className="text-sm text-gray-500 ml-2">{formatDate(comment.created_at)}</span>
                </div>
                <button
                  onClick={() => setReplyTo(comment.id)}
                  className="text-sm text-primary-600"
                >
                  回复
                </button>
              </div>
              <p className="text-gray-700">{comment.content}</p>

              {/* 回复列表 */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-8 mt-3 space-y-3">
                  {comment.replies.map(reply => (
                    <div key={reply.id} className="bg-gray-50 p-3 rounded">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">{reply.user_name}</span>
                        <span className="text-xs text-gray-500">{formatDate(reply.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CaseDetailPage;
