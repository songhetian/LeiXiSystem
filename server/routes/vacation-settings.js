module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取所有假期设置
  fastify.get('/api/vacation/settings', async (request, reply) => {
    try {
      const [rows] = await pool.query('SELECT setting_key, setting_value FROM vacation_settings')
      const settings = {}
      rows.forEach(row => {
        settings[row.setting_key] = row.setting_value
      })
      return { success: true, data: settings }
    } catch (error) {
      console.error('获取假期设置失败:', error)
      return reply.code(500).send({ success: false, message: '获取设置失败' })
    }
  })

  // 更新假期设置
  fastify.post('/api/vacation/settings', async (request, reply) => {
    const { settings } = request.body

    if (!settings || typeof settings !== 'object') {
      return reply.code(400).send({ success: false, message: '参数错误' })
    }

    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      for (const [key, value] of Object.entries(settings)) {
        // 检查是否存在
        const [exists] = await connection.query(
          'SELECT id FROM vacation_settings WHERE setting_key = ?',
          [key]
        )

        if (exists.length > 0) {
          await connection.query(
            'UPDATE vacation_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
            [String(value), key]
          )
        } else {
          await connection.query(
            'INSERT INTO vacation_settings (setting_key, setting_value) VALUES (?, ?)',
            [key, String(value)]
          )
        }
      }

      await connection.commit()
      connection.release()
      return { success: true, message: '设置已更新' }
    } catch (error) {
      await connection.rollback()
      connection.release()
      console.error('更新假期设置失败:', error)
      return reply.code(500).send({ success: false, message: '更新设置失败' })
    }
  })

  // 获取节假日设置
  fastify.get('/api/vacation/holidays', async (request, reply) => {
    const { year } = request.query
    try {
      let query = 'SELECT * FROM holidays'
      const params = []

      if (year) {
        query += ' WHERE YEAR(date) = ?'
        params.push(year)
      }

      query += ' ORDER BY date ASC'

      const [rows] = await pool.query(query, params)
      return { success: true, data: rows }
    } catch (error) {
      console.error('获取节假日失败:', error)
      return reply.code(500).send({ success: false, message: '获取节假日失败' })
    }
  })

  // 更新节假日设置
  fastify.post('/api/vacation/holidays', async (request, reply) => {
    const { date, type, name, is_workday } = request.body

    if (!date || !type) {
      return reply.code(400).send({ success: false, message: '缺少必填参数' })
    }

    try {
      // 检查是否存在
      const [exists] = await pool.query('SELECT id FROM holidays WHERE date = ?', [date])

      if (exists.length > 0) {
        await pool.query(
          'UPDATE holidays SET type = ?, name = ?, is_workday = ? WHERE date = ?',
          [type, name || null, is_workday ? 1 : 0, date]
        )
      } else {
        await pool.query(
          'INSERT INTO holidays (date, type, name, is_workday) VALUES (?, ?, ?, ?)',
          [date, type, name || null, is_workday ? 1 : 0]
        )
      }

      return { success: true, message: '节假日设置已更新' }
    } catch (error) {
      console.error('更新节假日失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // 删除节假日设置
  fastify.delete('/api/vacation/holidays/:date', async (request, reply) => {
    const { date } = request.params
    try {
      await pool.query('DELETE FROM holidays WHERE date = ?', [date])
      return { success: true, message: '已删除' }
    } catch (error) {
      console.error('删除节假日失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })
}
