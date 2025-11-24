import api from '../api';

// 质检管理相关API
const qualityAPI = {
  // 获取平台列表
  getPlatforms: () => api.get('/api/platforms'),

  // 根据平台ID获取店铺列表
  getShopsByPlatform: (platformId) => api.get(`/api/platforms/${platformId}/shops`),

  // 导入会话数据
  importSessions: (formData) => api.post('/api/sessions/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),

  // 获取会话列表
  getSessions: (params) => api.get('/api/sessions', { params }),

  // 获取会话详情
  getSessionDetail: (id) => api.get(`/api/sessions/${id}`),

  // 更新会话
  updateSession: (id, data) => api.put(`/api/sessions/${id}`, data),

  // 删除会话
  deleteSession: (id) => api.delete(`/api/sessions/${id}`),

  // 获取质检规则列表
  getQualityRules: (params) => api.get('/api/quality-rules', { params }),

  // 创建质检规则
  createQualityRule: (data) => api.post('/api/quality-rules', data),

  // 更新质检规则
  updateQualityRule: (id, data) => api.put(`/api/quality-rules/${id}`, data),

  // 删除质检规则
  deleteQualityRule: (id) => api.delete(`/api/quality-rules/${id}`),

  // 获取质检评分列表
  getQualityScores: (params) => api.get('/api/quality-scores', { params }),

  // 获取质检评分详情
  getQualityScoreDetail: (id) => api.get(`/api/quality-scores/${id}`),

  // 提交质检评分
  submitQualityScore: (data) => api.post('/api/quality-scores', data),

  // 获取质检报告
  getQualityReports: (params) => api.get('/api/quality-reports', { params }),

  // 获取质检统计
  getQualityStatistics: (params) => api.get('/api/quality-statistics', { params }),
};

export default qualityAPI;
