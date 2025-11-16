// 排班导入 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // Excel导入排班
  fastify.post('/api/schedules/import', async (request, reply) => {
    try {
      const data = await request.file()

      if (!data) {
        return reply.code(400).send({ success: false, message: '没有上传文件' })
      }

      // 这里简化处理，实际应该解析Excel文件
      // 需要安装 xlsx 或 exceljs 库来解析Excel

      // 示例数据格式：
      // [
      //   { employee_no: 'E001', date: '2024-11-13', shift: '早班' },
      //   { employee_no: 'E002', date: '2024-11-13', shift: '中班' }
      // ]

      const importData = request.body.data // 假设前端已解析好数据

      if (!Array.isArray(importData) || importData.length === 0) {
        return reply.code(400).send({ success: false, message: '导入数据为空' })
      }

      const connection = await pool.getConnection()
      await connection.beginTransaction()

      try {
        let successCount = 0
        let errorCount = 0
        const errors = []

        for (const row of importData) {
          try {
            // 根据工号查找员工
            const [employees] = await connection.query(
              'SELECT id FROM employees WHERE employee_no = ?',
              [row.employee_no]
            )

            if (employees.length === 0) {
              errors.push(`工号 ${row.employee_no} 不存在`)
              errorCount++
              continue
            }

            const employee_id = employees[0].id

            // 根据班次名称查找班次ID
            let shift_id = null
            let is_rest_day = false

            if (row.shift && row.shift !== '休息') {
              const [shifts] = await connection.query(
                'SELECT id FROM work_shifts WHERE name = ?',
                [row.shift]
              )

              if (shifts.length === 0) {
                errors.push(`班次 ${row.shift} 不存在`)
                errorCount++
                continue
              }

              shift_id = shifts[0].id
            } else {
              is_rest_day = true
            }

            // 检查是否已有排班
            const [existing] = await connection.query(
              'SELECT id FROM shift_schedules WHERE employee_id = ? AND DATE(CONVERT_TZ(schedule_date, "+00:00", "+08:00")) = ?',
              [employee_id, row.date]
            )

            if (existing.length > 0) {
              // 更新
              await connection.query(
                'UPDATE shift_schedules SET shift_id = ?, is_rest_day = ? WHERE id = ?',
                [shift_id, is_rest_day ? 1 : 0, existing[0].id]
              )
            } else {
              // 创建
              await connection.query(
                'INSERT INTO shift_schedules (employee_id, shift_id, schedule_date, is_rest_day) VALUES (?, ?, ?, ?)',
                [employee_id, shift_id, row.date, is_rest_day ? 1 : 0]
              )
            }

            successCount++
          } catch (rowError) {
            errors.push(`第 ${importData.indexOf(row) + 1} 行：${rowError.message}`)
            errorCount++
          }
        }

        await connection.commit()
        connection.release()

        return {
          success: true,
          message: `导入完成：成功 ${successCount} 条，失败 ${errorCount} 条`,
          data: {
            successCount,
            errorCount,
            errors: errors.slice(0, 10) // 只返回前10个错误
          }
        }
      } catch (error) {
        await connection.rollback()
        connection.release()
        throw error
      }
    } catch (error) {
      console.error('导入排班失败:', error)
      return reply.code(500).send({ success: false, message: '导入失败' })
    }
  })

  // 下载排班导入模板
  fastify.get('/api/schedules/import-template', async (request, reply) => {
    try {
      // 返回模板数据结构
      const template = {
        columns: ['工号', '日期', '班次'],
        example: [
          { employee_no: 'E001', date: '2024-11-13', shift: '早班' },
          { employee_no: 'E002', date: '2024-11-13', shift: '中班' },
          { employee_no: 'E003', date: '2024-11-13', shift: '休息' }
        ],
        instructions: [
          '1. 工号：员工工号，必填',
          '2. 日期：格式 YYYY-MM-DD，必填',
          '3. 班次：班次名称或"休息"，必填',
          '4. 请确保工号和班次名称在系统中存在',
          '5. 日期格式必须正确'
        ]
      }

      return {
        success: true,
        data: template
      }
    } catch (error) {
      console.error('获取模板失败:', error)
      return reply.code(500).send({ success: false, message: '获取模板失败' })
    }
  })
}
