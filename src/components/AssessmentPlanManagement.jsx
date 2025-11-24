import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
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
      console.error('获取部门列表失败:', error);
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
      console.error('获取可用试卷失败:', error);
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
      console.error('获取可用员工失败:', error);
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
      console.error('提交失败:', error);
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
      console.error('删除考核计划失败:', error);
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
      <div className="bg-white rounded-2xl shadow-lg p-7">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-8 pb-5 border-b border-gray-200">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">考核计划管理</h2>
            <p className="text-gray-600 mt-3 text-lg">共 {totalCount} 份考核计划</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="px-7 py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-xl hover:shadow-2xl flex items-center gap-3 font-bold text-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <span>新建计划</span>
            </button>
          </div>
        </div>

        {/* 搜索筛选区 */}
        <div className="mb-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl shadow-md border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-3">部门</label>
              <select
                value={selectedDepartment || ''}
                onChange={(e) => { setSelectedDepartment(e.target.value ? parseInt(e.target.value) : null); setCurrentPage(1); }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base shadow-sm hover:shadow transition-shadow font-medium"
              >
                <option value="">全部部门（按权限）</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-base font-semibold text-gray-800 mb-3">人员搜索（姓名/账号）</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="输入人员姓名或账号，支持模糊搜索"
                  value={keyword}
                  onChange={handleKeywordChange}
                  className="w-full px-5 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base shadow-sm hover:shadow transition-shadow font-medium"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 卡片列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-20">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500"></div>
              <p className="mt-6 text-gray-700 text-xl font-medium">加载中...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="col-span-full px-8 py-20 text-center text-gray-500 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border-2 border-dashed border-gray-300">
              <div className="text-6xl mb-6">📋</div>
              <p className="text-2xl font-bold text-gray-700 mb-2">暂无考核计划</p>
              <p className="text-gray-500 text-lg">点击右上角按钮创建新的考核计划</p>
            </div>
          ) : (
            getCurrentPageData().map((plan) => (
              <div key={plan.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col group overflow-hidden transform hover:-translate-y-1.5 hover:scale-[1.02]">
                <div className={`h-3 w-full ${
                  plan.status === 'ongoing' ? 'bg-gradient-to-r from-blue-500 to-indigo-600' :
                  plan.status === 'not_started' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                  plan.status === 'ended' ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                  plan.status === 'published' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                  'bg-gradient-to-r from-gray-200 to-gray-400'
                }`}></div>
                {/* 卡片头部 */}
                <div className="p-6 pb-4">
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="text-xl font-bold text-gray-900 line-clamp-2 flex-1" title={plan.title}>
                      {plan.title}
                    </h3>
                    <div className="flex-shrink-0">
                      {getStatusBadge(plan.status)}
                    </div>
                  </div>
                  <div className="text-base text-gray-600 mt-3 line-clamp-2 min-h-[48px]">
                    {plan.description || '暂无描述'}
                  </div>
                </div>

                {/* 卡片内容 */}
                <div className="px-6 py-4 space-y-4 flex-1 border-t border-gray-100 bg-gradient-to-br from-gray-50/80 to-white">
                  {/* 目标部门 */}
                  <div className="flex items-start">
                    <span className="text-gray-500 w-24 flex-shrink-0 text-base font-semibold">目标部门：</span>
                    <div className="flex-1 text-gray-800 font-medium break-words">
                      {plan.target_departments && plan.target_departments.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {plan.target_departments.slice(0, 3).map((dept, idx) => (
                            <span key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm">
                              {dept.name}
                            </span>
                          ))}
                          {plan.target_departments.length > 3 && (
                            <span className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm">
                              +{plan.target_departments.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-base">-</span>
                      )}
                    </div>
                  </div>

                  {/* 试卷 */}
                  <div className="flex items-center">
                    <span className="text-gray-500 w-24 flex-shrink-0 text-base font-semibold">关联试卷：</span>
                    <span className="text-gray-800 truncate flex-1 text-base font-medium" title={plan.exam_title}>
                      {plan.exam_title || '-'}
                    </span>
                  </div>

                  {/* 时间 */}
                  <div className="flex items-center">
                    <span className="text-gray-500 w-24 flex-shrink-0 text-base font-semibold">起止时间：</span>
                    <span className="text-gray-800 truncate flex-1 text-base font-medium">
                      {formatDate(plan.start_time).split(' ')[0]} ~ {formatDate(plan.end_time).split(' ')[0]}
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="px-6 py-5 border-t border-gray-100 flex justify-end gap-3 bg-gradient-to-r from-white to-gray-50 rounded-b-2xl">
                  <button
                    onClick={() => {
                      setEditingPlan(plan);
                      // 确保 target_departments 是 ID 数组
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
                        // status: plan.status, // Status is not editable manually anymore
                      });
                      setShowModal(true);
                    }}
                    className="px-5 py-2.5 text-base font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="px-5 py-2.5 text-base font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
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
          <div className="mt-8 flex items-center justify-between px-4 py-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl shadow-md border border-gray-200">
            <div className="flex items-center gap-4">
              <span className="text-gray-800 font-semibold text-base">每页显示</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white shadow-sm font-semibold text-base"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-gray-800 font-semibold text-base">条</span>
              <span className="text-gray-600 ml-3 text-base">共 {totalCount} 条记录</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-semibold text-gray-700 transition-all duration-200 hover:shadow-md"
              >
                上一页
              </button>
              <div className="flex items-center bg-white border border-gray-300 rounded-xl shadow-sm px-2">
                <span className="px-4 py-2.5 text-gray-800 font-bold text-base">
                  第 {currentPage} / {totalPages} 页
                </span>
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-semibold text-gray-700 transition-all duration-200 hover:shadow-md"
              >
                下一页
              </button>
              <div className="flex items-center ml-2">
                <input
                  type="number"
                  min="1"
                  max={totalPages || 1}
                  placeholder="跳转"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = Number(e.currentTarget.value)
                      if (val >= 1 && val <= totalPages) setCurrentPage(val)
                    }
                  }}
                  className="w-24 px-4 py-2.5 border border-gray-300 rounded-l-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium"
                />
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling;
                    const val = Number(input.value);
                    if (val >= 1 && val <= totalPages) setCurrentPage(val);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-r-xl hover:from-primary-600 hover:to-primary-700 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Go
                </button>
              </div>
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
        <form onSubmit={handleSubmit} className="space-y-7">
          <div>
            <label className="block text-lg font-bold text-gray-800 mb-3">计划标题 *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-md hover:shadow-lg transition-all text-lg font-medium"
              placeholder="输入考核计划标题"
            />
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-800 mb-3">计划描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="5"
              className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-md hover:shadow-lg transition-all text-lg font-medium"
              placeholder="输入考核计划描述"
            />
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-800 mb-3">关联试卷 *</label>
            <select
              required
              value={formData.exam_id}
              onChange={(e) => setFormData({ ...formData, exam_id: e.target.value })}
              className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-md hover:shadow-lg transition-all text-lg font-medium"
            >
              <option value="">请选择试卷</option>
              {availableExams.map(exam => (
                <option key={exam.id} value={exam.id}>{exam.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            <div>
              <label className="block text-lg font-bold text-gray-800 mb-3">开始时间 *</label>
              <input
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-md hover:shadow-lg transition-all text-lg font-medium"
              />
            </div>
            <div>
              <label className="block text-lg font-bold text-gray-800 mb-3">结束时间 *</label>
              <input
                type="datetime-local"
                required
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-md hover:shadow-lg transition-all text-lg font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-800 mb-3">目标部门 * (可多选)</label>
            <div className="border-2 border-gray-300 rounded-2xl p-5 max-h-72 overflow-y-auto bg-gradient-to-br from-gray-50 to-white shadow-md">
              {departments.length === 0 ? (
                <p className="text-gray-500 text-lg">暂无部门数据</p>
              ) : (
                <div className="space-y-4">
                  {departments.map((dept) => (
                    <label key={dept.id} className="flex items-center space-x-4 cursor-pointer hover:bg-gray-100 p-4 rounded-xl transition-all duration-200">
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
                        className="form-checkbox h-6 w-6 text-primary-600 rounded-xl border-2 border-gray-300 focus:ring-primary-500"
                      />
                      <span className="text-lg text-gray-800 font-bold">{dept.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-base text-gray-600 mt-3">
              已选择 {formData.target_departments.length} 个部门
              {formData.target_departments.length === 0 && <span className="text-red-500 font-bold"> (至少选择一个)</span>}
            </p>
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-800 mb-3">最大尝试次数 *</label>
            <input
              type="number"
              required
              min="1"
              value={formData.max_attempts}
              onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) })}
              className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-md hover:shadow-lg transition-all text-lg font-medium"
            />
          </div>

          {/* Status selection removed as it is determined by time */}

          <div className="flex justify-end gap-5 pt-7 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="px-7 py-3.5 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-100 font-bold text-lg transition-all shadow-md hover:shadow-lg"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </span>
              ) : '保存'}
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
        }}
        title="确认删除"
      >
        <div className="delete-confirm-content">
          <div className="confirm-icon">
            <span className="material-icons warning">warning</span>
          </div>
          <p className="confirm-text">
            确定要删除考核计划 "<strong>{planToDelete?.title}</strong>" 吗？
            此操作无法撤销。
          </p>
          <div className="confirm-actions">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setPlanToDelete(null);
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
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
