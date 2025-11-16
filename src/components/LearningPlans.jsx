import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import LearningPlanDetails from './LearningPlanDetails';

const LearningPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [viewingPlanDetails, setViewingPlanDetails] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: ''
  });

  // 获取学习计划列表
  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await api.get('/learning-plans');
      setPlans(response.data || []);
    } catch (error) {
      console.error('获取学习计划列表失败:', error);
      toast.error('获取学习计划列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingPlan) {
        await api.put(`/learning-plans/${editingPlan.id}`, formData);
        toast.success('学习计划更新成功');
      } else {
        await api.post('/learning-plans', formData);
        toast.success('学习计划创建成功');
      }
      setShowModal(false);
      resetForm();
      fetchPlans();
    } catch (error) {
      console.error('提交失败:', error);
      toast.error(editingPlan ? '更新失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除学习计划
  const deletePlan = async (planId) => {
    if (!window.confirm('确定要删除这个学习计划吗？')) return;
    try {
      await api.delete(`/learning-plans/${planId}`);
      toast.success('学习计划已删除');
      fetchPlans();
    } catch (error) {
      console.error('删除学习计划失败:', error);
      toast.error('删除学习计划失败');
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      start_date: '',
      end_date: ''
    });
    setEditingPlan(null);
  };

  // 添加查看详情函数
  const viewPlanDetails = (plan) => {
    setViewingPlanDetails(plan);
  };

  // 返回计划列表
  const backToPlans = () => {
    setViewingPlanDetails(null);
    fetchPlans(); // 重新获取计划列表以更新状态
  };

  // 编辑学习计划
  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      title: plan.title,
      description: plan.description || '',
      start_date: plan.start_date ? plan.start_date.split('T')[0] : '',
      end_date: plan.end_date ? plan.end_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // 如果正在查看计划详情，显示详情组件
  if (viewingPlanDetails) {
    return <LearningPlanDetails planId={viewingPlanDetails.id} onBack={backToPlans} />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">学习计划</h1>
            <p className="text-gray-600 mt-1">制定和管理您的个人学习计划</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <span>+</span>
            <span>创建计划</span>
          </button>
        </div>
      </div>

      {/* 学习计划列表 */}
      <div className="bg-white rounded-lg shadow-sm">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📅</div>
            <p>暂无学习计划</p>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              创建第一个学习计划
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {plans.map((plan) => (
              <div key={plan.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className={`font-medium ${plan.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {plan.title}
                      </h3>
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
                    {plan.description && (
                      <p className="text-gray-600 mt-2 text-sm">{plan.description}</p>
                    )}
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <span>创建时间: {new Date(plan.created_at).toLocaleDateString()}</span>
                      {plan.start_date && (
                        <span className="ml-4">
                          开始时间: {new Date(plan.start_date).toLocaleDateString()}
                        </span>
                      )}
                      {plan.end_date && (
                        <span className="ml-4">
                          结束时间: {new Date(plan.end_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => viewPlanDetails(plan)}
                      className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                    >
                      详情
                    </button>
                    <button
                      onClick={() => handleEdit(plan)}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => deletePlan(plan.id)}
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

      {/* 创建/编辑学习计划 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingPlan ? '编辑学习计划' : '创建学习计划'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  计划标题 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入计划标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  计划描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="请输入计划描述"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  开始日期
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  结束日期
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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
                  {loading ? '提交中...' : (editingPlan ? '更新' : '创建')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningPlans;
