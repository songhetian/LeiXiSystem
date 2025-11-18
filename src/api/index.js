import axios from 'axios'
import { getApiBaseUrl } from '../utils/apiConfig'

const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 添加请求拦截器，自动添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 客服人员相关 API
export const customerAPI = {
  getAll: () => api.get('/customers'),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
}

// 会话相关 API
export const sessionAPI = {
  getAll: () => api.get('/sessions'),
  getById: (id) => api.get(`/sessions/${id}`),
  end: (id) => api.put(`/sessions/${id}/end`)
}

// 质检相关 API
export const qualityAPI = {
  // Platforms and Shops
  getPlatforms: () => api.get('/platforms'),
  getShopsByPlatform: (platformId) => api.get(`/platforms/${platformId}/shops`),
  createPlatform: (data) => api.post('/platforms', data),
  updatePlatform: (id, data) => api.put(`/platforms/${id}`, data),
  deletePlatform: (id) => api.delete(`/platforms/${id}`),
  createShop: (data) => api.post('/shops', data),
  updateShop: (id, data) => api.put(`/shops/${id}`, data),
  deleteShop: (id) => api.delete(`/shops/${id}`),

  // Session Management
  getAllSessions: (params) => api.get('/quality/sessions', { params }),
  getSessionById: (id) => api.get(`/quality/sessions/${id}`),
  createSession: (data) => api.post('/quality/sessions', data),
  updateSession: (id, data) => api.put(`/quality/sessions/${id}`, data),
  deleteSession: (id) => api.delete(`/quality/sessions/${id}`),
  getSessionMessages: (id) => api.get(`/quality/sessions/${id}/messages`),
  submitReview: (id, data) => api.post(`/quality/sessions/${id}/review`, data),
  importSessions: (formData) => api.post('/quality/sessions/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),

  // Rule Management
  getAllRules: () => api.get('/quality/rules'),
  getRuleById: (id) => api.get(`/quality/rules/${id}`),
  createRule: (data) => api.post('/quality/rules', data),
  updateRule: (id, data) => api.put(`/quality/rules/${id}`, data),
  deleteRule: (id) => api.delete(`/quality/rules/${id}`),
  toggleRule: (id, is_enabled) => api.put(`/quality/rules/${id}/toggle`, { is_enabled }),

  // Score Management
  submitScore: (data) => api.post('/quality/scores', data),
  getAllScores: (params) => api.get('/quality/scores', { params }),
  getSessionScores: (id) => api.get(`/quality/sessions/${id}/scores`),
  updateScore: (id, data) => api.put(`/quality/scores/${id}`, data),
  getStatistics: () => api.get('/quality/statistics'),

  // Case Management
  createCase: (data) => api.post('/quality/cases', data),
  getAllCases: (params) => api.get('/quality/cases', { params }),
  getCaseById: (id) => api.get(`/quality/cases/${id}`),
  updateCase: (id, data) => api.put(`/quality/cases/${id}`, data),
  deleteCase: (id) => api.delete(`/quality/cases/${id}`),
  likeCase: (id) => api.post(`/quality/cases/${id}/like`),
  viewCase: (id) => api.post(`/quality/cases/${id}/view`),
  getHotCases: (params) => api.get('/quality/cases/hot', { params }),
  getRecommendedCases: (params) => api.get('/quality/cases/recommended', { params }),

  // Case Favoriting
  addFavoriteCase: (caseId, userId) => api.post(`/quality/cases/${caseId}/favorite`, { user_id: userId }),
  removeFavoriteCase: (caseId, userId) => api.delete(`/quality/cases/${caseId}/favorite`, { data: { user_id: userId } }), // DELETE with body
  getUserFavoriteCases: (userId, params) => api.get(`/quality/users/${userId}/favorites`, { params }),

  // Case Learning Records
  startLearningCase: (caseId, userId) => api.post(`/quality/cases/${caseId}/learn/start`, { user_id: userId }),
  endLearningCase: (caseId, userId, progressPercentage) => api.put(`/quality/cases/${caseId}/learn/end`, { user_id: userId, progress_percentage: progressPercentage }),
  getUserLearningRecords: (userId, params) => api.get(`/quality/users/${userId}/learning-records`, { params }),

  // Data Export
  exportSessions: () => api.get('/quality/export/sessions', { responseType: 'blob' }), // responseType: 'blob' for file download
  exportCases: () => api.get('/quality/export/cases', { responseType: 'blob' }), // responseType: 'blob' for file download

  // Report Generation
  getSummaryReport: () => api.get('/quality/reports/summary'),

  // Comment Management
  addComment: (caseId, data) => api.post(`/quality/cases/${caseId}/comments`, data),
  getComments: (caseId) => api.get(`/quality/cases/${caseId}/comments`),
  updateComment: (id, data) => api.put(`/quality/comments/${id}`, data),
  deleteComment: (id) => api.delete(`/quality/comments/${id}`),
  likeComment: (id) => api.post(`/quality/comments/${id}/like`),

  // Attachment Management
  uploadAttachment: (caseId, data) => api.post(`/quality/cases/${caseId}/attachments`, data),
  getAttachments: (caseId) => api.get(`/quality/cases/${caseId}/attachments`),
  deleteAttachment: (id) => api.delete(`/quality/attachments/${id}`),
  downloadAttachment: (id) => api.get(`/quality/attachments/${id}/download`, { responseType: 'blob' })
}

export default api
