import api from '../api';

// 会话管理相关API
const sessionAPI = {
  // 获取所有会话
  getAll: () => api.get('/api/sessions'),

  // 获取会话详情
  getById: (id) => api.get(`/api/sessions/${id}`),

  // 创建会话
  create: (data) => api.post('/api/sessions', data),

  // 更新会话
  update: (id, data) => api.put(`/api/sessions/${id}`, data),

  // 删除会话
  delete: (id) => api.delete(`/api/sessions/${id}`),

  // 结束会话
  endSession: (id) => api.post(`/api/sessions/${id}/end`),

  // 获取会话统计
  getStatistics: () => api.get('/api/sessions/statistics'),
};

export default sessionAPI;
