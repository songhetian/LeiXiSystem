import api from '../api';

// 客服管理相关API
const customerAPI = {
  // 获取所有客服
  getAll: () => api.get('/api/customers'),

  // 获取客服详情
  getById: (id) => api.get(`/api/customers/${id}`),

  // 创建客服
  create: (data) => api.post('/api/customers', data),

  // 更新客服
  update: (id, data) => api.put(`/api/customers/${id}`, data),

  // 删除客服
  delete: (id) => api.delete(`/api/customers/${id}`),

  // 获取客服统计
  getStatistics: () => api.get('/api/customers/statistics'),
};

export default customerAPI;
