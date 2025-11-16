import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
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
    article_id: '',
    exam_id: '',
    order_num: 1
  });

  // 添加知识库文章状态
  const [articles, setArticles] = useState([]);
  const [showArticleSelector, setShowArticleSelector] = useState(false);

  // 获取学习计划详情
  const fetchPlanDetails = async () => {
    setLoading(true);
    try {
      // 获取计划信息
      const planResponse = await axios.get(getApiUrl(`/api/learning-plans/${planId}`));
      setPlan(planResponse.data);
      setDetails(planResponse.data.details || []);
    } catch (error) {
      console.error('获取学习计划详情失败:', error);
      toast.error('获取学习计划详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取知识库文章列表
  const fetchArticles = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/knowledge/articles'));
      // 只显示已发布的文档
      const publishedArticles = (response.data || []).filter(a => a.status === 'published');
      setArticles(publishedArticles);
    } catch (error) {
      console.error('获取知识库文章失败:', error);
      toast.error('获取知识库文章失败');
    }
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingDetail) {
        await axios.put(getApiUrl(`/api/learning-plans/${planId}/details/${editingDetail.id}`), formData);
        toast.success('计划项目更新成功');
      } else {
        await axios.post(getApiUrl(`/api/learning-plans/${planId}/details`), formData);
        toast.success('计划项目添加成功');
      }
      setShowModal(false);
      resetForm();
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
      await axios.delete(getApiUrl(`/api/learning-plans/${planId}/details/${detailId}`));
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
      article_id: detail.article_id || '',
      exam_id: detail.exam_id || '',
      order_num: detail.order_num || 1
    });
    setShowModal(true);
  };

  // 完成计划项目
  const completeDetail = async (detailId) => {
    try {
      await axios.put(getApiUrl(`/api/learning-plans/${planId}/details/${detailId}`), {
        status: 'completed'
      });
      toast.success('计划项目已完成');
      fetchPlanDetails();
    } catch (error) {
      console.error('完成计划项目失败:', error);
      toast.error('完成计划项目失败');
    }
  };

  // 选择文章
  const selectArticle = (article) => {
    setFormData({
      ...formData,
      article_id: article.id,
      title: formData.title || article.title,
      description: formData.description || article.summary || ''
    });
    setShowArticleSelector(false);
  };

  useEffect(() => {
    fetchPlanDetails();
    fetchArticles();
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
              resetForm();
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
                resetForm();
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
                    <div className="flex items-center gap-3">
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
                        <span className="mr-4">关联文章ID: {detail.article_id}</span>
                      )}
                      {detail.exam_id && (
                        <span>关联考试: {detail.exam_id}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {detail.status === 'pending' && (
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
                  关联知识库文章
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.article_id}
                    onChange={(e) => setFormData({ ...formData, article_id: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入文章ID或点击选择"
                  />
                  <button
                    type="button"
                    onClick={() => setShowArticleSelector(true)}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    选择
                  </button>
                </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  排序
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.order_num}
                  onChange={(e) => setFormData({ ...formData, order_num: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
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

      {/* 知识库文章选择器 Modal */}
      {showArticleSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">选择知识库文章</h2>
                <button
                  onClick={() => setShowArticleSelector(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="搜索文章..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    // 这里可以添加搜索功能
                  }}
                />
              </div>
              <div className="max-h-96 overflow-y-auto">
                {articles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    暂无文章
                  </div>
                ) : (
                  <div className="space-y-2">
                    {articles.map((article) => (
                      <div
                        key={article.id}
                        className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                        onClick={() => selectArticle(article)}
                      >
                        <h3 className="font-medium text-gray-900">{article.title}</h3>
                        {article.summary && (
                          <p className="text-sm text-gray-600 mt-1 truncate">
                            {article.summary}
                          </p>
                        )}
                        <div className="flex items-center text-xs text-gray-500 mt-2">
                          <span>浏览量: {article.view_count || 0}</span>
                          <span className="mx-2">•</span>
                          <span>点赞: {article.like_count || 0}</span>
                        </div>
                      </div>
                    ))}
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
