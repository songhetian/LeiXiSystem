const jwt = require('jsonwebtoken')
const { toBeijingDate } = require('../utils/time')
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  const getUserIdFromToken = (request) => {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) throw new Error('未登录')
    const decoded = jwt.verify(token, JWT_SECRET)
    return decoded.id
  }

  // 1. 获取请假记录 (修复部门名称与姓名)
  fastify.get('/api/attendance/leave/records', async (request, reply) => {
    const { page = 1, limit = 10, status, start_date, end_date, department_id } = request.query
    try {
      const currentUserId = getUserIdFromToken(request)
      const offset = (parseInt(page) - 1) * parseInt(limit)
      
      let query = `
        SELECT lr.*, u.real_name as employee_name, d.name as department_name, a.real_name as approver_name
        FROM leave_records lr
        LEFT JOIN users u ON lr.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users a ON lr.approver_id = a.id
        WHERE 1=1
      `
      const params = []

      if (status && status !== 'all' && status !== '') {
        query += ' AND lr.status = ?'; params.push(status);
      }
      if (department_id) {
        query += ' AND u.department_id = ?'; params.push(department_id);
      }
      if (start_date) {
        query += ' AND lr.start_date >= ?'; params.push(start_date);
      }
      if (end_date) {
        query += ' AND lr.end_date <= ?'; params.push(end_date);
      }

      const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as t`, params);
      const total = countResult[0]?.total || 0;

      query += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const [rows] = await pool.query(query, params);
      return { success: true, data: rows, pagination: { total } };
    } catch (error) {
      return reply.code(500).send({ success: false, message: error.message });
    }
  })

  // 2. 获取加班记录 (修复部门名称与姓名)
  fastify.get('/api/attendance/overtime/records', async (request, reply) => {
    const { page = 1, limit = 10, status, start_date, end_date, department_id } = request.query
    try {
      const currentUserId = getUserIdFromToken(request)
      const offset = (parseInt(page) - 1) * parseInt(limit)
      
      let query = `
        SELECT otr.*, u.real_name as employee_name, d.name as department_name, a.real_name as approver_name
        FROM overtime_records otr
        LEFT JOIN users u ON otr.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users a ON otr.approver_id = a.id
        WHERE 1=1
      `
      const params = []

      if (status && status !== 'all' && status !== '') {
        query += ' AND otr.status = ?'; params.push(status);
      }
      if (department_id) {
        query += ' AND u.department_id = ?'; params.push(department_id);
      }
      if (start_date) {
        query += ' AND otr.overtime_date >= ?'; params.push(start_date);
      }
      if (end_date) {
        query += ' AND otr.overtime_date <= ?'; params.push(end_date);
      }

      const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as t`, params);
      const total = countResult[0]?.total || 0;

      query += ' ORDER BY otr.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const [rows] = await pool.query(query, params);
      return { success: true, data: rows, pagination: { total } };
    } catch (error) {
      return reply.code(500).send({ success: false, message: error.message });
    }
  })

  // 3. 获取补卡记录 (修复部门名称与姓名)
  fastify.get('/api/attendance/makeup/records', async (request, reply) => {
    const { page = 1, limit = 10, status, start_date, end_date, department_id } = request.query
    try {
      const currentUserId = getUserIdFromToken(request)
      const offset = (parseInt(page) - 1) * parseInt(limit)
      
      let query = `
        SELECT mr.*, u.real_name as employee_name, d.name as department_name, a.real_name as approver_name
        FROM makeup_records mr
        LEFT JOIN users u ON mr.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users a ON mr.approver_id = a.id
        WHERE 1=1
      `
      const params = []

      if (status && status !== 'all' && status !== '') {
        query += ' AND mr.status = ?'; params.push(status);
      }
      if (department_id) {
        query += ' AND u.department_id = ?'; params.push(department_id);
      }
      if (start_date) {
        query += ' AND mr.record_date >= ?'; params.push(start_date);
      }
      if (end_date) {
        query += ' AND mr.record_date <= ?'; params.push(end_date);
      }

      const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as t`, params);
      const total = countResult[0]?.total || 0;

      query += ' ORDER BY mr.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const [rows] = await pool.query(query, params);
      return { success: true, data: rows, pagination: { total } };
    } catch (error) {
      return reply.code(500).send({ success: false, message: error.message });
    }
  })

  // 审批逻辑 (通用封装)
  const executeApproval = async (table, id, approved, note, approverId) => {
    const status = approved ? 'approved' : 'rejected';
    await pool.query(
      `UPDATE ${table} SET status = ?, approver_id = ?, approved_at = NOW(), approval_note = ? WHERE id = ?`,
      [status, approverId, note || null, id]
    );
    return true;
  };

  fastify.post('/api/attendance/leave/:id/approve', async (request) => {
    const userId = getUserIdFromToken(request);
    await executeApproval('leave_records', request.params.id, request.body.approved, request.body.approval_note, userId);
    return { success: true };
  });

  fastify.post('/api/attendance/overtime/:id/approve', async (request) => {
    const userId = getUserIdFromToken(request);
    await executeApproval('overtime_records', request.params.id, request.body.approved, request.body.approval_note, userId);
    return { success: true };
  });

  fastify.post('/api/attendance/makeup/:id/approve', async (request) => {
    const userId = getUserIdFromToken(request);
    await executeApproval('makeup_records', request.params.id, request.body.approved, request.body.approval_note, userId);
    return { success: true };
  });
}
