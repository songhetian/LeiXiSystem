import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import { getApiUrl } from '../utils/apiConfig';

const LearningPlanDetails = ({ planId, onBack }) => {
  const [plan, setPlan] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDetail, setEditingDetail] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    exam_id: '',
    order_num: 1
  });

  // 添加拖拽状态
  const [draggedItem, setDraggedItem] = useState(null);

  // 添加预览状态
  const [previewFile, setPreviewFile] = useState(null);

  // 获取学习计划详情
  const fetchPlanDetails = async () => {
    setLoading(true);
    try {
      // 获取计划信息
      const planResponse = await api.get(`/learning-plans/${planId}`);
      setPlan(planResponse.data);
      setDetails(planResponse.data.details || []);
    } catch (error) {
      console.error('获取学习计划详情失败:', error);
      toast.error('获取学习计划详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取知识库文章详情
  const fetchArticleDetail = async (articleId) => {
    try {
      const response = await api.get(`/knowledge/articles/${articleId}`);
      return response.data;
    } catch (error) {
      console.error('获取知识库文章详情失败:', error);
      return null;
    }
  };

  // 预览文章
  const previewArticle = async (articleId) => {
    const article = await fetchArticleDetail(articleId);
    if (article) {
      setPreviewFile(article);
    }
  };

  // 拖拽开始
  const handleDragStart = (e, detail, index) => {
    setDraggedItem({ detail, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  // 拖拽过程中
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 拖拽放置
  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.index === targetIndex) {
      setDraggedItem(null);
      return;
    }

    const newDetails = [...details];
    const [removed] = newDetails.splice(draggedItem.index, 1);
    newDetails.splice(targetIndex, 0, removed);

    // 更新排序
    const updates = newDetails.map((detail, idx) => ({
      id: detail.id,
      order_num: idx + 1
    }));

    try {
      // 更新所有项目的排序
      for (const update of updates) {
        await api.put(`/learning-plans/${planId}/details/${update.id}`, {
          order_num: update.order_num
        });
      }

      setDetails(newDetails);
      setDraggedItem(null);
      toast.success('排序已更新');
    } catch (error) {
      console.error('更新排序失败:', error);
      toast.error('更新排序失败');
      fetchPlanDetails(); // 重新获取数据
    }
  };

  // 更新项目进度
  const updateProgress = async (detailId, progress) => {
    try {
      await api.put(`/learning-plans/${planId}/details/${detailId}`, {
        progress: progress
      });
      toast.success('进度已更新');
      fetchPlanDetails();
    } catch (error) {
      console.error('更新进度失败:', error);
      toast.error('更新进度失败');
    }
  };

  // 设置项目为已完成
  const markAsCompleted = async (detailId) => {
    try {
      await api.put(`/learning-plans/${planId}/details/${detailId}`, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
      toast.success('项目已完成');
      fetchPlanDetails();
    } catch (error) {
      console.error('完成项目失败:', error);
      toast.error('完成项目失败');
    }
  };

  // 更新进度状态
  const handleProgressChange = (detailId, progress) => {
    // 确保进度在0-100之间
    const validProgress = Math.max(0, Math.min(100, parseInt(progress) || 0));
    updateProgress(detailId, validProgress);
  };

  // 增加进度
  const increaseProgress = (detailId, currentProgress) => {
    const newProgress = Math.min(100, currentProgress + 10);
    updateProgress(detailId, newProgress);
  };

  // 减少进度
  const decreaseProgress = (detailId, currentProgress) => {
    const newProgress = Math.max(0, currentProgress - 10);
    updateProgress(detailId, newProgress);
  };

  // 重置表单
  const resetFormNew = () => {
    setFormData({
      title: '',
      description: '',
      exam_id: '',
      order_num: (details.length + 1) * 10
    });
    setEditingDetail(null);
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingDetail) {
        await api.put(`/learning-plans/${planId}/details/${editingDetail.id}`, formData);
        toast.success('计划项目更新成功');
      } else {
        await api.post(`/learning-plans/${planId}/details`, formData);
        toast.success('计划项目添加成功');
      }
      setShowModal(false);
      resetFormNew();
      fetchPlanDetails();
    } catch (error) {
      console.error('提交失败:', error);
      toast.error(editingDetail ? '更新失败' : '添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除计划项目
  const deleteDetail = async (detailId) => {
    if (!window.confirm('确定要删除这个计划项目吗？')) return;
    try {
      await api.delete(`/learning-plans/${planId}/details/${detailId}`);
      toast.success('计划项目已删除');
      fetchPlanDetails();
    } catch (error) {
      console.error('删除计划项目失败:', error);
      toast.error('删除计划项目失败');
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      article_id: '',
      exam_id: '',
      order_num: 1
    });
    setEditingDetail(null);
  };

  // 编辑计划项目
  const handleEdit = (detail) => {
    setEditingDetail(detail);
    setFormData({
      title: detail.title,
      description: detail.description || '',
      exam_id: detail.exam_id || '',
      order_num: detail.order_num || 1
    });
    setShowModal(true);
  };

  // 完成计划项目
  const completeDetail = async (detailId) => {
    try {
      await api.put(`/learning-plans/${planId}/details/${detailId}`, {
        status: 'completed'
      });
      toast.success('计划项目已完成');
      fetchPlanDetails();
    } catch (error) {
      console.error('完成计划项目失败:', error);
      toast.error('完成计划项目失败');
    }
  };



  useEffect(() => {
    fetchPlanDetails();
  }, [planId]);

  if (!plan && loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">
          <p>未找到学习计划</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <button
              onClick={onBack}
              className="flex items-center text-blue-500 hover:text-blue-700 mb-2"
            >
              <span className="mr-1">←</span>
              <span>返回学习计划列表</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{plan.title}</h1>
            <p className="text-gray-600 mt-1">{plan.description || '暂无描述'}</p>
          </div>
          <button
            onClick={() => {
              resetFormNew();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <span>+</span>
            <span>添加项目</span>
          </button>
        </div>
      </div>

      {/* 计划状态信息 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center">
            <span className="text-gray-600 mr-2">状态:</span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              plan.status === 'draft' ? 'bg-gray-100 text-gray-800' :
              plan.status === 'active' ? 'bg-blue-100 text-blue-800' :
              plan.status === 'completed' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {plan.status === 'draft' ? '草稿' :
               plan.status === 'active' ? '进行中' :
               plan.status === 'completed' ? '已完成' : '已取消'}
            </span>
          </div>
          {plan.start_date && (
            <div className="flex items-center">
              <span className="text-gray-600 mr-2">开始时间:</span>
              <span>{new Date(plan.start_date).toLocaleDateString()}</span>
            </div>
          )}
          {plan.end_date && (
            <div className="flex items-center">
              <span className="text-gray-600 mr-2">结束时间:</span>
              <span>{new Date(plan.end_date).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex items-center">
            <span className="text-gray-600 mr-2">项目数:</span>
            <span>{details.length}</span>
          </div>
        </div>
      </div>

      {/* 计划项目列表 */}
      <div className="bg-white rounded-lg shadow-sm">
        {details.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📋</div>
            <p>暂无计划项目</p>
            <button
              onClick={() => {
                resetFormNew();
                setShowModal(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              添加第一个项目
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {details.map((detail, index) => (
              <div key={detail.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, detail, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className="flex items-center gap-3 cursor-move hover:bg-gray-100 p-2 rounded"
                    >
                      <span className="text-gray-400 mr-2">☰</span>
                      <span className="text-gray-400">#{index + 1}</span>
                      <h3 className={`font-medium ${detail.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {detail.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        detail.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {detail.status === 'pending' ? '待完成' : '已完成'}
                      </span>
                    </div>
                    {detail.description && (
                      <p className="text-gray-600 mt-2 text-sm">{detail.description}</p>
                    )}
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      {detail.article_id && (
                        <button
                          onClick={() => previewArticle(detail.article_id)}
                          className="mr-4 text-blue-500 hover:text-blue-700 underline"
                        >
                          预览文章
                        </button>
                      )}
                      {detail.exam_id && (
                        <span>关联考试: {detail.exam_id}</span>
                      )}
                    </div>
                    {detail.article_id && detail.status === 'pending' && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm text-gray-600">进度:</span>
                        <button
                          onClick={() => decreaseProgress(detail.id, detail.progress || 0)}
                          className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={detail.progress || 0}
                          onChange={(e) => handleProgressChange(detail.id, e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                        />
                        <button
                          onClick={() => increaseProgress(detail.id, detail.progress || 0)}
                          className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300"
                        >
                          +
                        </button>
                        <span className="text-sm text-gray-600 ml-1">%</span>
                        {detail.progress >= 100 && (
                          <button
                            onClick={() => markAsCompleted(detail.id)}
                            className="ml-2 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                          >
                            标记为完成
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {detail.status === 'pending' && !detail.article_id && (
                      <button
                        onClick={() => completeDetail(detail.id)}
                        className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                      >
                        完成
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(detail)}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => deleteDetail(detail.id)}
                      className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加/编辑计划项目 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingDetail ? '编辑计划项目' : '添加计划项目'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  项目标题 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入项目标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  项目描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="请输入项目描述"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  关联考试ID
                </label>
                <input
                  type="number"
                  value={formData.exam_id}
                  onChange={(e) => setFormData({ ...formData, exam_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入关联考试ID"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetFormNew();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={loading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  {loading ? '提交中...' : (editingDetail ? '更新' : '添加')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* 文档预览模态框 */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-gray-800 truncate">{previewFile.title}</h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                  <span>📁 {previewFile.category_name || '未分类'}</span>
                  <span>👤 {previewFile.author_name || '未知'}</span>
                  <span>📅 {new Date(previewFile.created_at).toLocaleDateString()}</span>
                  <span>👁️ {previewFile.view_count || 0} 浏览</span>
                  <span>❤️ {previewFile.like_count || 0} 点赞</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex-shrink-0 ml-4"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {previewFile.summary && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-2">📝 摘要</h3>
                  <p className="text-gray-700">{previewFile.summary}</p>
                </div>
              )}
              <div className="prose max-w-none">
                {previewFile.content ? (
                  <div
                    className="text-gray-800 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: previewFile.content.replace(/\n/g, '<br/>') }}
                  />
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    <p>暂无内容</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningPlanDetails;
