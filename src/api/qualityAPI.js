import api from '../api';

// 质检管理相关API
const qualityAPI = {
  // --- 平台与店铺 ---
  getPlatforms: () => api.get('/platforms'),
  getShopsByPlatform: (platformId) => api.get(`/platforms/${platformId}/shops`),
  createPlatform: (data) => api.post('/platforms', data),
  updatePlatform: (id, data) => api.put(`/platforms/${id}`, data),
  deletePlatform: (id) => api.delete(`/platforms/${id}`),
  createShop: (data) => api.post('/shops', data),
  updateShop: (id, data) => api.put(`/shops/${id}`, data),
  deleteShop: (id) => api.delete(`/shops/${id}`),

  // --- 质检会话 ---
  // 导入会话数据
  importSessions: (formData) => api.post('/quality/sessions/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  // 获取会话列表
  getAllSessions: (params) => api.get('/quality/sessions', { params }),
  // 获取会话详情
  getSessionDetail: (id) => api.get(`/quality/sessions/${id}`),
  // 更新会话
  updateSession: (id, data) => api.put(`/quality/sessions/${id}`, data),
  // 删除会话
  deleteSession: (id) => api.delete(`/quality/sessions/${id}`),
  // 获取会话消息
  getSessionMessages: (id) => api.get(`/quality/sessions/${id}/messages`),

  // --- 质检规则 ---
  // 获取质检规则列表
  getAllRules: (params) => api.get('/quality/rules', { params }),
  // 创建质检规则
  createRule: (data) => api.post('/quality/rules', data),
  // 更新质检规则
  updateRule: (id, data) => api.put(`/quality/rules/${id}`, data),
  // 删除质检规则
  deleteRule: (id) => api.delete(`/quality/rules/${id}`),
  // 切换规则启用状态
  toggleRule: (id, is_enabled) => api.put(`/quality/rules/${id}/toggle`, { is_enabled }),

  // --- 质检评分 ---
  // 提交质检评分 (Review)
  submitReview: (sessionId, data) => api.post(`/quality/sessions/${sessionId}/review`, data),
  // 获取质检评分列表
  getQualityScores: (params) => api.get('/quality/scores', { params }),

  // --- 统计与报表 ---
  // 获取质检统计
  getStatistics: (params) => api.get('/quality/statistics', { params }),
  // 获取质检报表摘要
  getSummaryReport: (params) => api.get('/quality/reports/summary', { params }),
  // 导出质检会话
  exportSessions: () => api.get('/quality/export/sessions', { responseType: 'blob' }),
  // 导出案例数据
  exportCases: () => api.get('/quality/export/cases', { responseType: 'blob' }),

  // --- 优秀案例 ---
  // 获取所有案例
  getAllCases: (params) => api.get('/quality/cases', { params }),
  // 获取案例详情
  getCaseDetail: (id) => api.get(`/quality/cases/${id}`),
  // 创建案例
  createCase: (data) => api.post('/quality/cases', data),
  // 更新案例
  updateCase: (id, data) => api.put(`/quality/cases/${id}`, data),
  // 删除案例
  deleteCase: (id) => api.delete(`/quality/cases/${id}`),
  // 获取热门案例
  getHotCases: (params) => api.get('/quality/cases/hot', { params }),
  // 获取推荐案例
  getRecommendedCases: (params) => api.get('/quality/cases/recommended', { params }),

  // --- 案例互动 & 收藏 ---
  // 添加收藏
  addFavoriteCase: (caseId, userId) => api.post(`/quality/cases/${caseId}/favorite`, { user_id: userId }),
  // 取消收藏
  removeFavoriteCase: (caseId, userId) => api.delete(`/quality/cases/${caseId}/favorite`, { data: { user_id: userId } }),
  // 获取用户收藏的案例
  getUserFavoriteCases: (userId, params) => api.get(`/quality/users/${userId}/favorites`, { params }),
  // 开始学习案例
  startLearningCase: (caseId, userId) => api.post(`/quality/cases/${caseId}/learn/start`, { user_id: userId }),

  // --- 标签分类管理 ---
  // 获取所有标签分类（树形结构）
  getTagCategories: (params) => api.get('/quality/tag-categories', { params }),
  // 获取单个标签分类
  getTagCategory: (id) => api.get(`/quality/tag-categories/${id}`),
  // 创建标签分类
  createTagCategory: (data) => api.post('/quality/tag-categories', data),
  // 更新标签分类
  updateTagCategory: (id, data) => api.put(`/quality/tag-categories/${id}`, data),
  // 删除标签分类
  deleteTagCategory: (id) => api.delete(`/quality/tag-categories/${id}`),

  // --- 标签管理 ---
  // 获取所有标签（树形结构）
  getTags: (params) => api.get('/quality/tags', { params }),
  // 获取单个标签
  getTag: (id) => api.get(`/quality/tags/${id}`),
  // 创建标签
  createTag: (data) => api.post('/quality/tags', data),
  // 更新标签
  updateTag: (id, data) => api.put(`/quality/tags/${id}`, data),
  // 删除标签
  deleteTag: (id) => api.delete(`/quality/tags/${id}`),

  // --- 会话标签关联 ---
  // 获取会话的所有标签
  getSessionTags: (sessionId) => api.get(`/quality/sessions/${sessionId}/tags`),
  // 为会话添加标签
  addSessionTag: (sessionId, data) => api.post(`/quality/sessions/${sessionId}/tags`, data),
  // 删除会话标签
  removeSessionTag: (sessionId, tagId) => api.delete(`/quality/sessions/${sessionId}/tags/${tagId}`),

  // --- 消息标签关联 ---
  // 获取消息的所有标签
  getMessageTags: (messageId) => api.get(`/quality/messages/${messageId}/tags`),
  // 为消息添加标签
  addMessageTag: (messageId, data) => api.post(`/quality/messages/${messageId}/tags`, data),
  // 删除消息标签
  removeMessageTag: (messageId, tagId) => api.delete(`/quality/messages/${messageId}/tags/${tagId}`),
};

export default qualityAPI;
