// 假期统计与导出 API
const ExcelJS = require('exceljs')
const { getBeijingNow } = require('../utils/time')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 部门假期统计
  fastify.get('/api/vacation/stats/department', async (request, reply) => {
    const { department_id, year = parseInt(getBeijingNow().substring(0, 4)) } = request.query

    try {
      let query = `
        SELECT
          d.id as department_id,
          d.name as department_name,
          COUNT(DISTINCT vb.employee_id) as employee_count,
          SUM(vb.annual_leave_used) as total_annual_used,
          SUM(vb.sick_leave_used) as total_sick_used,
          SUM(vb.compensatory_leave_used) as total_compensatory_used,
          SUM(vb.overtime_hours_total) as total_overtime_hours,
          AVG(vb.annual_leave_used) as avg_annual_used,
          AVG(vb.sick_leave_used) as avg_sick_used
        FROM departments d
        LEFT JOIN users u ON d.id = u.department_id
        LEFT JOIN vacation_balances vb ON u.id = vb.user_id AND vb.year = ?
        WHERE d.status != 'deleted'
      `
      const params = [year]

      if (department_id) {
        query += ' AND d.id = ?'
        params.push(department_id)
      }

      query += ' GROUP BY d.id, d.name ORDER BY d.name'

      const [stats] = await pool.query(query, params)

      return { success: true, data: stats }
    } catch (error) {
      console.error('获取部门假期统计失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 月度假期统计
  fastify.get('/api/vacation/stats/monthly', async (request, reply) => {
    const { year = parseInt(getBeijingNow().substring(0, 4)), month } = request.query

    try {
      let dateFilter = ''
      const params = []

      if (month) {
        dateFilter = 'AND YEAR(lr.start_date) = ? AND MONTH(lr.start_date) = ?'
        params.push(year, month)
      } else {
        dateFilter = 'AND YEAR(lr.start_date) = ?'
        params.push(year)
      }

      // 请假统计
      const [leaveStats] = await pool.query(
        `SELECT
           DATE_FORMAT(lr.start_date, '%Y-%m') as month,
           lr.leave_type,
           COUNT(*) as count,
           SUM(lr.days) as total_days
         FROM leave_records lr
         WHERE lr.status = 'approved' ${dateFilter}
         GROUP BY month, lr.leave_type
         ORDER BY month`,
        params
      )

      // 加班统计
      const overtimeParams = month ? [year, month] : [year]
      const [overtimeStats] = await pool.query(
        `SELECT
           DATE_FORMAT(orec.overtime_date, '%Y-%m') as month,
           COUNT(*) as count,
           SUM(orec.hours) as total_hours
         FROM overtime_records orec
         WHERE orec.status = 'approved' ${dateFilter.replace('lr.start_date', 'orec.overtime_date')}
         GROUP BY month
         ORDER BY month`,
        overtimeParams
      )

      return {
        success: true,
        data: {
          leave: leaveStats,
          overtime: overtimeStats
        }
      }
    } catch (error) {
      console.error('获取月度假期统计失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 导出假期汇总Excel
  fastify.post('/api/vacation/export/excel', async (request, reply) => {
    const { year = parseInt(getBeijingNow().substring(0, 4)), department_id, search } = request.body

    try {
      // 查询数据
      let query = `
        SELECT
          e.employee_no as '工号',
          u.real_name as '姓名',
          d.name as '部门',
          vb.year as '年度',
          vb.annual_leave_total as '年假总额',
          vb.annual_leave_used as '年假已用',
          (vb.annual_leave_total - vb.annual_leave_used) as '年假余额',
          vb.sick_leave_total as '病假总额',
          vb.sick_leave_used as '病假已用',
          (vb.sick_leave_total - vb.sick_leave_used) as '病假余额',
          vb.compensatory_leave_total as '调休总额',
          vb.compensatory_leave_used as '调休已用',
          (vb.compensatory_leave_total - vb.compensatory_leave_used) as '调休余额',
          vb.overtime_hours_total as '加班总时长',
          vb.overtime_hours_converted as '已转调休时长',
          (vb.overtime_hours_total - vb.overtime_hours_converted) as '剩余加班时长'
        FROM vacation_balances vb
        LEFT JOIN employees e ON vb.employee_id = e.id
        LEFT JOIN users u ON vb.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE vb.year = ?
      `
      const params = [year]

      if (department_id) {
        query += ' AND u.department_id = ?'
        params.push(department_id)
      }

      if (search) {
        query += ' AND (u.real_name LIKE ? OR u.username LIKE ? OR e.employee_no LIKE ?)'
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern, searchPattern)
      }

      query += ' ORDER BY d.name, e.employee_no'

      const [records] = await pool.query(query, params)

      // 创建 Excel 工作簿
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('假期汇总')

      // 设置列
      worksheet.columns = [
        { header: '工号', key: '工号', width: 15 },
        { header: '姓名', key: '姓名', width: 15 },
        { header: '部门', key: '部门', width: 20 },
        { header: '年度', key: '年度', width: 10 },
        { header: '年假总额', key: '年假总额', width: 12 },
        { header: '年假已用', key: '年假已用', width: 12 },
        { header: '年假余额', key: '年假余额', width: 12 },
        { header: '病假总额', key: '病假总额', width: 12 },
        { header: '病假已用', key: '病假已用', width: 12 },
        { header: '病假余额', key: '病假余额', width: 12 },
        { header: '调休总额', key: '调休总额', width: 12 },
        { header: '调休已用', key: '调休已用', width: 12 },
        { header: '调休余额', key: '调休余额', width: 12 },
        { header: '加班总时长', key: '加班总时长', width: 15 },
        { header: '已转调休时长', key: '已转调休时长', width: 15 },
        { header: '剩余加班时长', key: '剩余加班时长', width: 15 }
      ]

      // 添加数据
      records.forEach(record => {
        worksheet.addRow(record)
      })

      // 设置标题行样式
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }

      // 生成 Buffer
      const buffer = await workbook.xlsx.writeBuffer()

      // 设置响应头
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      reply.header('Content-Disposition', `attachment; filename=vacation_summary_${year}.xlsx`)

      return reply.send(buffer)
    } catch (error) {
      console.error('导出Excel失败:', error)
      return reply.code(500).send({ success: false, message: '导出失败' })
    }
  })
}
