import api from './index';

export const customerAPI = {
  // 获取所有客服列表
  getAll: () => api.get('/customers'),
  
  // 创建新客服
  create: (data) => api.post('/customers', data),
  
  // 获取统计概况
  getStatistics: () => api.get('/customers/statistics'),
  
  // 部门考勤统计
  getAttendanceStats: (params) => api.get('/attendance/department-stats', { params })
};

export default customerAPI;
