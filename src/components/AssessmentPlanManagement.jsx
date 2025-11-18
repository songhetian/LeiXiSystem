import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import Modal from './Modal';
import { getApiUrl } from '../utils/apiConfig';

const AssessmentPlanManagement = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableExams, setAvailableExams] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]); // New state for available employees

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    exam_id: '',
    start_time: '',
    end_time: '',
    target_users: [], // Array of user IDs
    max_attempts: 1,
    status: 'draft',
  });

  useEffect(() => {
    fetchPlans();
    fetchAvailableExams();
    fetchAvailableEmployees(); // Fetch available employees on mount
  }, []);

  useEffect(() => {
    if (filteredPlans) {
      setTotalPages(Math.ceil(filteredPlans.length / pageSize));
    }
  }, [filteredPlans, pageSize]);

  const fetchAvailableExams = async () => {
    try {
      const response = await api.get('/exams');
      setAvailableExams(response.data.filter(exam => exam.status === 'published') || []);
    } catch (error) {
      console.error('获取可用试卷失败:', error);
      toast.error('获取可用试卷列表失败');
      setAvailableExams([]);
    }
  };

  const fetchAvailableEmployees = async () => {
    try {
      const response = await api.get('/employees'); // Assuming this endpoint returns all employees
      setAvailableEmployees(response.data || []);
    } catch (error) {
      console.error('获取可用员工失败:', error);
      toast.error('获取可用员工列表失败');
      setAvailableEmployees([]);
    }
  };

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await api.get('/assessment-plans');
      setPlans(response.data || []);
    } catch (error) {
      console.error('获取考核计划失败:', error);
      toast.error('获取考核计划列表失败');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingPlan) {
        await api.put(`/assessment-plans/${editingPlan.id}`, formData);
        toast.success('考核计划更新成功');
      } else {
        await api.post('/assessment-plans', formData);
        toast.success('考核计划创建成功');
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

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('确定要删除这份考核计划吗？')) return;

    try {
      await api.delete(`/assessment-plans/${planId}`);
      toast.success('考核计划删除成功');
      fetchPlans();
    } catch (error) {
      console.error('删除考核计划失败:', error);
      toast.error('删除考核计划失败');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      exam_id: '',
      start_time: '',
      end_time: '',
      target_users: [],
      max_attempts: 1,
      status: 'draft',
    });
    setEditingPlan(null);
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-700',
      published: 'bg-green-100 text-green-700',
      ongoing: 'bg-blue-100 text-blue-700',
      completed: 'bg-purple-100 text-purple-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const labels = {
      draft: '草稿',
      published: '已发布',
      ongoing: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const filteredPlans = useMemo(() => {
    setCurrentPage(1); // Reset page when filters change
    return plans.filter(plan =>
      plan.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [plans, searchTerm]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredPlans.slice(startIndex, endIndex);
  };

  return (
    <div className="p-0">
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">考核计划管理</h2>
            <p className="text-gray-500 text-sm mt-1">共 {filteredPlans.length} 份考核计划</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              <span>新建计划</span>
            </button>
          </div>
        </div>

        {/* 搜索筛选区 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <input
            type="text"
            placeholder="按计划标题、描述搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider rounded-tl-lg">计划标题</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">关联试卷</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">开始时间</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">结束时间</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider rounded-tr-lg">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <p className="mt-2 text-gray-600">加载中...</p>
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    暂无考核计划
                  </td>
                </tr>
              ) : (
                getCurrentPageData().map((plan, index) => (
                  <tr key={plan.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'} hover:bg-primary-100/50 transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{plan.title}</div>
                      <div className="text-xs text-gray-500">{plan.description}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{plan.exam_title || '-'}</td> {/* Assuming exam_title is available */}
                    <td className="px-4 py-3 text-center text-gray-600">{new Date(plan.start_time).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{new Date(plan.end_time).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(plan.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingPlan(plan);
                            setFormData({
                              title: plan.title,
                              description: plan.description || '',
                              exam_id: plan.exam_id,
                              start_time: plan.start_time.split('.')[0], // Format for datetime-local input
                              end_time: plan.end_time.split('.')[0],     // Format for datetime-local input
                              target_users: plan.target_users || [],
                              max_attempts: plan.max_attempts,
                              status: plan.status,
                            });
                            setShowModal(true);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id)}
                          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 分页组件 */}
        {filteredPlans.length > 0 && (
          <div className="mt-4 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">每页显示</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-gray-600">条</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                第 {currentPage} / {totalPages} 页
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 创建/编辑考核计划Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingPlan ? '编辑考核计划' : '新建考核计划'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">计划标题 *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="输入考核计划标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">计划描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="输入考核计划描述"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">关联试卷 *</label>
            <select
              required
              value={formData.exam_id}
              onChange={(e) => setFormData({ ...formData, exam_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">请选择试卷</option>
              {availableExams.map(exam => (
                <option key={exam.id} value={exam.id}>{exam.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">开始时间 *</label>
              <input
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">结束时间 *</label>
              <input
                type="datetime-local"
                required
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">目标用户 *</label>
            <select
              multiple
              required
              value={formData.target_users.map(String)} // Convert numbers to strings for select value
              onChange={(e) =>
                setFormData({
                  ...formData,
                  target_users: Array.from(e.target.selectedOptions, (option) =>
                    parseInt(option.value)
                  ),
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 h-32 overflow-y-auto"
            >
              {availableEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.real_name} ({employee.employee_no})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">按住 Ctrl (Windows) / Command (Mac) 可多选</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">最大尝试次数 *</label>
            <input
              type="number"
              required
              min="1"
              value={formData.max_attempts}
              onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">状态 *</label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="ongoing">进行中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AssessmentPlanManagement;
