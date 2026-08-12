import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import api from '../api';
import Modal from './Modal';
import { getApiUrl } from '../utils/apiConfig';
import { formatDate } from '../utils/date';
import { getCurrentUserDepartmentId } from '../utils/auth';

const AssessmentPlanManagement = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [availableExams, setAvailableExams] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(getCurrentUserDepartmentId());

  // Server pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    exam_id: '',
    start_time: '',
    end_time: '',
    target_departments: [], // Array of department IDs
    max_attempts: 1,
    status: 'draft',
  });

  useEffect(() => {
    fetchPlans();
    fetchAvailableExams();
    fetchAvailableEmployees();
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [currentPage, pageSize, selectedDepartment, keyword]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch(getApiUrl('/api/departments/list'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.success ? data.data : []);
      setDepartments(list);
      if (!selectedDepartment && list.length > 0) {
        setSelectedDepartment(getCurrentUserDepartmentId() || list[0].id);
      }
    } catch (error) {
      logger.error('获取部门列表失败:', error);
      setDepartments([]);
    }
  };

  const fetchAvailableExams = async () => {
    try {
      const response = await api.get('/exams');
      // Handle response structure: { success: true, data: { exams: [...] } }
      const exams = response.data?.data?.exams || response.data?.data || [];
      setAvailableExams(Array.isArray(exams) ? exams.filter(exam => exam.status === 'published') : []);
    } catch (error) {
      logger.error('获取可用试卷失败:', error);
      toast.error('获取可用试卷列表失败');
      setAvailableExams([]);
    }
  };

  const fetchAvailableEmployees = async () => {
    try {
      const response = await api.get('/employees');
      // Handle response structure: { success: true, data: [...] } or { success: true, data: { employees: [...] } }
      const employees = response.data?.data?.employees || response.data?.data || [];
      setAvailableEmployees(Array.isArray(employees) ? employees : []);
    } catch (error) {
      logger.error('获取可用员工失败:', error);
      toast.error('获取可用员工列表失败');
      setAvailableEmployees([]);
    }
  };

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await api.get('/assessment-plans', {
        params: {
          page: currentPage,
          limit: pageSize,
          department_id: selectedDepartment || undefined,
          keyword: keyword || undefined
        }
      });
      const plansData = response.data?.data || [];
      const pagination = response.data?.pagination || response.data?.data?.pagination;
      setPlans(Array.isArray(plansData) ? plansData : []);
      if (pagination) {
        setTotalCount(pagination.total || 0);
        setTotalPages(pagination.totalPages || 0);
      }
    } catch (error) {
      logger.error('获取考核计划失败:', error);
      toast.error('获取考核计划列表失败');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };



  const handleQuickDuration = (hours = 0, days = 0) => {
    const now = new Date();
    // Round up to next 30 minutes
    const interval = 30 * 60 * 1000;
    const start = new Date(Math.ceil(now.getTime() / interval) * interval);
    const end = new Date(start.getTime() + (hours * 60 * 60 * 1000) + (days * 24 * 60 * 60 * 1000));

    // Format for datetime-local: YYYY-MM-DDThh:mm
    const formatLocal = (d) => {
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData(prev => ({
      ...prev,
      start_time: formatLocal(start),
      end_time: formatLocal(end)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 转换数据类型
      const payload = {
        ...formData,
        exam_id: Number(formData.exam_id)
      };

      if (editingPlan) {
        await api.put(`/assessment-plans/${editingPlan.id}`, payload);
        toast.success('考核计划更新成功');
      } else {
        await api.post('/assessment-plans', payload);
        toast.success('考核计划创建成功');
      }
      setShowModal(false);
      resetForm();
      fetchPlans();
    } catch (error) {
      logger.error('提交失败:', error);
      toast.error(editingPlan ? '更新失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = (planId) => {
    const plan = plans.find(p => p.id === planId);
    setPlanToDelete(plan);
    setShowDeleteModal(true);
  };

  const confirmDeletePlan = async () => {
    if (!planToDelete) return;

    try {
      await api.delete(`/assessment-plans/${planToDelete.id}`);
      toast.success('考核计划删除成功');
      setShowDeleteModal(false);
      setPlanToDelete(null);
      fetchPlans();
    } catch (error) {
      logger.error('删除考核计划失败:', error);
      toast.error('删除考核计划失败');
      setShowDeleteModal(false);
      setPlanToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      exam_id: '',
      start_time: '',
      end_time: '',
      target_departments: [],
      max_attempts: 1,
      // status: 'draft', // Status is determined by time now
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
      not_started: '未开始',
      ongoing: '进行中',
      ended: '已结束',
      completed: '已完成',
      cancelled: '已取消',
    };
    const colors = {
      draft: 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800',
      published: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800',
      not_started: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800',
      ongoing: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800',
      ended: 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600',
      completed: 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800',
      cancelled: 'bg-gradient-to-r from-rose-100 to-pink-100 text-rose-800',
    };
    return (
      <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const getCurrentPageData = () => plans;

  // Debounced search handler
  const handleKeywordChange = (e) => {
    setKeyword(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="p-0">
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">考核计划管理</h2>
            <p className="text-gray-500 text-sm mt-1">共 {totalCount} 份考核计划</p>
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
        <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">部门</label>
              <select
                value={selectedDepartment || ''}
                onChange={(e) => { setSelectedDepartment(e.target.value ? parseInt(e.target.value) : null); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="">全部部门（按权限）</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">关键字搜索</label>
              <input
                type="text"
                placeholder="输入关键字搜索"
                value={keyword}
                onChange={handleKeywordChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        {/* 卡片列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="col-span-full px-4 py-8 text-center text-gray-500">
              暂无考核计划
            </div>
          ) : (
            getCurrentPageData().map((plan) => (
              <div key={plan.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
                {/* 卡片头部 */}
                <div className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
                      {plan.title}
                    </h3>
                    <div className="flex-shrink-0">
                      {getStatusBadge(plan.status)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mt-2 line-clamp-2">
                    {plan.description || '暂无描述'}
                  </div>
                </div>

                {/* 卡片内容 */}
                <div className="px-4 py-3 space-y-2 flex-1 border-t border-gray-100 bg-gray-50">
                  {/* 目标部门 */}
                  <div className="flex items-start">
                    <span className="text-gray-500 w-20 flex-shrink-0 text-sm">目标部门：</span>
                    <div className="flex-1 text-gray-800 text-sm">
                      {plan.target_departments && plan.target_departments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {plan.target_departments.slice(0, 2).map((dept, idx) => (
                            <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
                              {dept.name}
                            </span>
                          ))}
                          {plan.target_departments.length > 2 && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                              +{plan.target_departments.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>

                  {/* 试卷 */}
                  <div className="flex items-center">
                    <span className="text-gray-500 w-20 flex-shrink-0 text-sm">关联试卷：</span>
                    <span className="text-gray-800 truncate flex-1 text-sm" title={plan.exam_title}>
                      {plan.exam_title || '-'}
                    </span>
                  </div>

                  {/* 时间 */}
                  <div className="flex items-center">
                    <span className="text-gray-500 w-20 flex-shrink-0 text-sm">起止时间：</span>
                    <span className="text-gray-800 truncate flex-1 text-sm">
                      {formatDate(plan.start_time).split(' ')[0]} ~ {formatDate(plan.end_time).split(' ')[0]}
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingPlan(plan);
                      const targetDeptIds = plan.target_department_ids ||
                        (Array.isArray(plan.target_departments) ? plan.target_departments.map(d => d.id) : []);

                      setFormData({
                        title: plan.title,
                        description: plan.description || '',
                        exam_id: plan.exam_id,
                        start_time: plan.start_time.split('.')[0],
                        end_time: plan.end_time.split('.')[0],
                        target_departments: targetDeptIds,
                        max_attempts: plan.max_attempts,
                      });
                      setShowModal(true);
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {/* 分页组件 */}
        {totalCount > 0 && (
          <div className="mt-4 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-sm">每页显示</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-gray-600 text-sm">条</span>
              <span className="text-gray-500 ml-2 text-sm">共 {totalCount} 条记录</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                上一页
              </button>
              <span className="px-4 py-1.5 text-gray-700 text-sm">
                第 {currentPage} / {totalPages} 页
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary-500 rounded-full"></span>
                时间安排
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <label className="block text-xs font-medium text-gray-500 mb-1">开始时间</label>
                  <input
                    type="datetime-local"
                    required
                    step="1800"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full text-sm font-medium border-0 focus:ring-0 p-0 text-gray-800"
                  />
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <label className="block text-xs font-medium text-gray-500 mb-1">结束时间</label>
                  <input
                    type="datetime-local"
                    required
                    step="1800"
                    min={formData.start_time}
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full text-sm font-medium border-0 focus:ring-0 p-0 text-gray-800"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 self-center mr-1">快捷预设:</span>
                <button
                  type="button"
                  onClick={() => handleQuickDuration(2, 0)}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-colors shadow-sm"
                >
                  ⏱️ 2小时
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDuration(4, 0)}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-colors shadow-sm"
                >
                  ☀️ 4小时
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDuration(24, 0)}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-colors shadow-sm"
                >
                   1天
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDuration(72, 0)}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-colors shadow-sm"
                >
                   3天
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDuration(168, 0)}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-colors shadow-sm"
                >
                   1周
                </button>
              </div>
            </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">目标部门 * (可多选)</label>
            <div className="border border-gray-300 rounded-lg p-3 max-h-60 overflow-y-auto bg-white">
              {departments.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无部门数据</p>
              ) : (
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <label key={dept.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                      <input
                        type="checkbox"
                        value={dept.id}
                        checked={formData.target_departments.includes(dept.id)}
                        onChange={(e) => {
                          const deptId = parseInt(e.target.value);
                          setFormData({
                            ...formData,
                            target_departments: e.target.checked
                              ? [...formData.target_departments, deptId]
                              : formData.target_departments.filter(id => id !== deptId)
                          });
                        }}
                        className="form-checkbox h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-800">{dept.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              已选择 {formData.target_departments.length} 个部门
              {formData.target_departments.length === 0 && <span className="text-red-500"> (至少选择一个)</span>}
            </p>
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              最大尝试次数 *
              <span className="group relative">
                <svg className="w-5 h-5 text-gray-400 hover:text-primary-600 cursor-help transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div className="invisible group-hover:visible absolute left-0 top-8 w-72 p-4 bg-gray-900 text-white text-sm rounded-xl shadow-2xl z-50 transition-all">
                  <div className="font-semibold mb-2">💡 最大尝试次数说明</div>
                  <div className="space-y-1 text-gray-200">
                    <p>• 设置为 <span className="font-bold text-yellow-300">1</span>：用户只能参加一次</p>
                    <p>• 设置为 <span className="font-bold text-yellow-300">3</span>：用户最多可参加3次(可重考2次)</p>
                    <p>• 设置为 <span className="font-bold text-yellow-300">0</span>：不限制次数</p>
                  </div>
                  <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
                </div>
              </span>
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.max_attempts}
              onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 0 })}
              className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-md hover:shadow-lg transition-all text-lg font-medium"
              placeholder="输入最大尝试次数,0表示不限制"
            />
            <p className="text-sm text-gray-500 mt-2">限制用户参加此考核的次数。设置为0表示不限制。</p>
          </div>


          {/* Status selection removed as it is determined by time */}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 删除确认Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setPlanToDelete(null);

          const styles = `
.delete-confirm-content {
  padding: 24px;
  text-align: center;
}

.confirm-icon {
  font-size: 48px;
  margin-bottom: 20px;
  color: #f59e0b;
}

.confirm-icon .material-icons {
  font-size: 48px;
}

.confirm-text {
  margin-bottom: 24px;
  font-size: 16px;
  color: #374151;
  line-height: 1.6;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.btn-secondary {
  padding: 12px 24px;
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-secondary:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  transform: translateY(-2px);
}

.btn-danger {
  padding: 12px 24px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
}
`;

          // Inject styles into the document
          if (typeof document !== 'undefined') {
            const styleElement = document.createElement('style');
            styleElement.textContent = styles;
            document.head.appendChild(styleElement);
          }
        }}
        title="确认删除"
      >
        <div className="delete-confirm-content">
          <div className="confirm-icon">⚠️</div>
          <div className="confirm-text">
            <p className="font-semibold text-lg mb-2">确定要删除此考核计划吗？</p>
            <p className="text-gray-600">
              {planToDelete?.title}
            </p>
            <p className="text-sm text-red-600 mt-2">此操作不可撤销</p>
          </div>
          <div className="confirm-actions">
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setPlanToDelete(null);
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="button"
              onClick={confirmDeletePlan}
              className="btn-danger"
            >
              确认删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AssessmentPlanManagement;
