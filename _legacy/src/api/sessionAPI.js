import api from '../api';

// 会话管理相关API
const sessionAPI = {
  // 获取所有会话
  getAll: () => api.get('/sessions'),

  // 获取会话详情
  getById: (id) => api.get(`/sessions/${id}`),

  // 创建会话
  create: (data) => api.post('/sessions', data),

  // 更新会话
  update: (id, data) => api.put(`/sessions/${id}`, data),

  // 删除会话
  delete: (id) => api.delete(`/sessions/${id}`),

  // 结束会话
  endSession: (id) => api.post(`/sessions/${id}/end`),

  // 获取会话统计
  getStatistics: () => api.get('/sessions/statistics'),
};

export default sessionAPI;
