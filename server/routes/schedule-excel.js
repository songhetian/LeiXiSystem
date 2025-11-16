// 排班Excel导入导出 API
const ExcelJS = require('exceljs')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 下载导入模板
  fastify.get('/api/schedules/template', async (request, reply) => {
    const { department_id, month } = request.query

    try {
      const [year, monthNum] = month.split('-')
      const daysInMonth = new Date(year, monthNum, 0).getDate()

      // 获取部门员工
      const [employees] = await pool.query(
        `SELECT e.id, e.employee_no, u.real_name, u.username
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE u.department_id = ? AND e.status = 'active'
        ORDER BY e.employee_no`,
        [department_id]
      )

      // 获取班次列表
      const [shifts] = await pool.query(
        'SELECT id, name FROM work_shifts WHERE is_active = 1 ORDER BY id'
      )

      // 创建工作簿
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('排班表')

      // 设置列
      const columns = [
        { header: '工号', key: 'employee_no', width: 12 },
        { header: '姓名', key: 'real_name', width: 15 }
      ]

      // 添加日期列
      for (let day = 1; day <= daysInMonth; day++) {
        columns.push({
          header: `${monthNum}/${day}`,
          key: `day_${day}`,
          width: 10
        })
      }

      worksheet.columns = columns

      // 设置表头样式
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

      // 添加员工数据并设置下拉列表
      const startRow = 2 // 数据从第2行开始
      employees.forEach((emp, index) => {
        const rowNum = startRow + index
        const row = {
          employee_no: emp.employee_no,
          real_name: emp.real_name
        }
        worksheet.addRow(row)

        // 为每个日期单元格添加下拉列表
        for (let day = 1; day <= daysInMonth; day++) {
          const colIndex = day + 2 // +2 因为前两列是工号和姓名
          const cellAddress = worksheet.getColumn(colIndex).letter + rowNum

          // 创建下拉列表选项：班次名称 + 休息
          const dropdownOptions = ['休', ...shifts.map(s => s.name)]

          worksheet.getCell(cellAddress).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${dropdownOptions.join(',')}"`],
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: '无效的班次',
            error: `请从下拉列表中选择班次：${dropdownOptions.join('、')}`
          }
        }
      })

      // 添加说明行
      worksheet.addRow({})
      const noteRow = worksheet.addRow({
        employee_no: '填写说明：',
        real_name: `请在日期单元格中使用下拉列表选择班次。班次列表：${shifts.map(s => s.name).join('、')}、休息`
      })
      noteRow.font = { italic: true, color: { argb: 'FF0066CC' } }

      // 添加班次对照表
      worksheet.addRow({})
      const mappingHeaderRow = worksheet.addRow({
        employee_no: '班次对照表',
        real_name: '（导入时使用）'
      })
      mappingHeaderRow.font = { bold: true, color: { argb: 'FFFF6600' } }

      shifts.forEach(shift => {
        worksheet.addRow({
          employee_no: shift.name,
          real_name: `代码: ${shift.id}`
        })
      })

      // 设置响应头
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      reply.header('Content-Disposition', `attachment; filename="schedule_template_${month}.xlsx"`)

      // 发送文件
      const buffer = await workbook.xlsx.writeBuffer()
      return reply.send(buffer)
    } catch (error) {
      console.error('生成模板失败:', error)
      return reply.code(500).send({ success: false, message: '生成模板失败' })
    }
  })

  // 导入Excel
  fastify.post('/api/schedules/import', async (request, reply) => {
    try {
      const data = await request.file()
      const { department_id, year, month } = data.fields

      // 读取Excel文件
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.read(data.file)
      const worksheet = workbook.getWorksheet(1)

      const daysInMonth = new Date(year.value, month.value, 0).getDate()
      let importCount = 0
      const errors = []

      // 获取员工ID映射
      const [employees] = await pool.query(
        `SELECT e.id, e.employee_no FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE u.department_id = ?`,
        [department_id.value]
      )
      const employeeMap = new Map(employees.map(e => [e.employee_no, e.id]))

      // 获取班次ID映射（支持ID和名称两种方式）
      const [shifts] = await pool.query('SELECT id, name FROM work_shifts')
      const shiftMapById = new Map(shifts.map(s => [s.id.toString(), s.id]))
      const shiftMapByName = new Map(shifts.map(s => [s.name, s.id]))

      // 跳过表头，从第2行开始读取
      for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum)
        const employeeNo = row.getCell(1).value

        if (!employeeNo || employeeNo === '填写说明：') continue

        const employeeId = employeeMap.get(employeeNo)
        if (!employeeId) {
          errors.push(`第${rowNum}行：找不到工号 ${employeeNo}`)
          continue
        }

        // 处理每一天的排班
        for (let day = 1; day <= daysInMonth; day++) {
          const cellValue = row.getCell(day + 2).value // +2 因为前两列是工号和姓名
          if (!cellValue) continue

          const dateStr = `${year.value}-${String(month.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          let shiftId = null
          let isRestDay = 0

          if (cellValue === '休' || cellValue === '休息') {
            isRestDay = 1
          } else {
            // 先尝试按ID查找，再尝试按名称查找
            shiftId = shiftMapById.get(cellValue.toString()) || shiftMapByName.get(cellValue.toString())
            if (!shiftId) {
              errors.push(`第${rowNum}行，${day}日：无效的班次 "${cellValue}"`)
              continue
            }
          }

          try {
            // 先删除已存在的排班
            await pool.query(
              'DELETE FROM shift_schedules WHERE employee_id = ? AND DATE(schedule_date) = ?',
              [employeeId, dateStr]
            )

            // 插入新排班
            await pool.query(
              `INSERT INTO shift_schedules (employee_id, shift_id, schedule_date, is_rest_day)
              VALUES (?, ?, ?, ?)`,
              [employeeId, shiftId, dateStr, isRestDay]
            )
            importCount++
          } catch (error) {
            errors.push(`第${rowNum}行，${day}日：保存失败 - ${error.message}`)
          }
        }
      }

      if (errors.length > 0) {
        return {
          success: true,
          count: importCount,
          message: `导入完成，成功 ${importCount} 条，失败 ${errors.length} 条`,
          errors: errors.slice(0, 10) // 只返回前10个错误
        }
      }

      return {
        success: true,
        count: importCount,
        message: `导入成功，共 ${importCount} 条排班记录`
      }
    } catch (error) {
      console.error('导入失败:', error)
      return reply.code(500).send({ success: false, message: '导入失败：' + error.message })
    }
  })

  // 导出Excel
  fastify.get('/api/schedules/export', async (request, reply) => {
    const { department_id, month } = request.query

    try {
      const [year, monthNum] = month.split('-')
      const daysInMonth = new Date(year, monthNum, 0).getDate()

      // 获取部门信息
      const [deptInfo] = await pool.query('SELECT name FROM departments WHERE id = ?', [department_id])
      const deptName = deptInfo[0]?.name || '未知部门'

      // 获取部门员工
      const [employees] = await pool.query(
        `SELECT e.id, e.employee_no, u.real_name
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE u.department_id = ? AND e.status = 'active'
        ORDER BY e.employee_no`,
        [department_id]
      )

      // 获取排班数据
      const startDate = `${year}-${monthNum}-01`
      const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]

      const [schedules] = await pool.query(
        `SELECT ss.*, ws.name as shift_name,
         DATE_FORMAT(ss.schedule_date, '%Y-%m-%d') as schedule_date_str
        FROM shift_schedules ss
        LEFT JOIN work_shifts ws ON ss.shift_id = ws.id
        WHERE DATE(ss.schedule_date) BETWEEN ? AND ?
        AND ss.employee_id IN (${employees.map(e => e.id).join(',') || '0'})`,
        [startDate, endDate]
      )

      // 创建排班映射
      const scheduleMap = new Map()
      schedules.forEach(s => {
        // 使用格式化后的日期字符串
        const dateStr = s.schedule_date_str || s.schedule_date
        const key = `${s.employee_id}_${dateStr}`
        scheduleMap.set(key, s)
      })

      // 创建工作簿
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('排班表')

      // 设置列
      const columns = [
        { header: '工号', key: 'employee_no', width: 12 },
        { header: '姓名', key: 'real_name', width: 15 }
      ]

      for (let day = 1; day <= daysInMonth; day++) {
        columns.push({
          header: `${monthNum}/${day}`,
          key: `day_${day}`,
          width: 10
        })
      }

      worksheet.columns = columns

      // 设置表头样式
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      }
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

      // 添加员工排班数据
      employees.forEach(emp => {
        const row = {
          employee_no: emp.employee_no,
          real_name: emp.real_name
        }

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${monthNum}-${String(day).padStart(2, '0')}`
          const key = `${emp.id}_${dateStr}`
          const schedule = scheduleMap.get(key)

          if (schedule) {
            row[`day_${day}`] = schedule.is_rest_day ? '休' : schedule.shift_name
          } else {
            row[`day_${day}`] = ''
          }
        }

        worksheet.addRow(row)
      })

      // 设置响应头
      // 对中文文件名进行URL编码
      const encodedDeptName = encodeURIComponent(deptName)
      const filename = `schedule_${encodedDeptName}_${month}.xlsx`

      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      reply.header('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filename}`)

      // 发送文件
      const buffer = await workbook.xlsx.writeBuffer()
      return reply.send(buffer)
    } catch (error) {
      console.error('导出失败:', error)
      return reply.code(500).send({ success: false, message: '导出失败' })
    }
  })
}
