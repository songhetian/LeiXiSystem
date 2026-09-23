// 考勤设置 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // 获取考勤设置
  fastify.get('/api/attendance/settings', async (request, reply) => {
    const redis = fastify.redis;
    const cacheKey = 'config:attendance_settings';

    try {
      // 1. 尝试从 Redis 获取
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) return { success: true, data: JSON.parse(cached) };
      }

      // 从数据库获取设置
      const [settings] = await pool.query(
        'SELECT * FROM attendance_settings WHERE id = 1'
      );

      let data;
      if (settings.length === 0) {
        // 如果没有设置，返回默认值
        data = {
          enable_location_check: false,
          allowed_distance: 500,
          allowed_locations: [],
          enable_time_check: true,
          early_clock_in_minutes: 60,
          late_clock_out_minutes: 120,
          late_minutes: 30,
          early_leave_minutes: 30,
          absent_hours: 4,
          max_annual_leave_days: 10,
          max_sick_leave_days: 15,
          require_proof_for_sick_leave: true,
          require_approval_for_overtime: true,
          min_overtime_hours: 1,
          max_overtime_hours_per_day: 4,
          allow_makeup: true,
          makeup_deadline_days: 3,
          require_approval_for_makeup: true,
          notify_on_late: true,
          notify_on_early_leave: true,
          notify_on_absent: true
        };
      } else {
        // 解析 JSON 字段
        const settingsData = settings[0];
        if (settingsData.allowed_locations && typeof settingsData.allowed_locations === 'string') {
          settingsData.allowed_locations = JSON.parse(settingsData.allowed_locations);
        }
        data = settingsData;
      }

      // 写入缓存 (有效期 24 小时)
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(data), 'EX', 86400);
      }

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('获取考勤设置失败:', error);
      return reply.code(500).send({ success: false, message: '获取设置失败' });
    }
  });

  // 保存考勤设置
  fastify.post('/api/attendance/settings', async (request, reply) => {
    const redis = fastify.redis;
    try {
      const settings = request.body;

      // 将 allowed_locations 转换为 JSON 字符串
      const allowedLocations = JSON.stringify(settings.allowed_locations || []);

      // 检查是否已存在设置
      const [existing] = await pool.query(
        'SELECT id FROM attendance_settings WHERE id = 1'
      );

      if (existing.length === 0) {
        // 插入新设置
        await pool.query(
          `INSERT INTO attendance_settings (
            id,
            enable_location_check,
            allowed_distance,
            allowed_locations,
            enable_time_check,
            early_clock_in_minutes,
            late_clock_out_minutes,
            late_minutes,
            early_leave_minutes,
            absent_hours,
            max_annual_leave_days,
            max_sick_leave_days,
            require_proof_for_sick_leave,
            require_approval_for_overtime,
            min_overtime_hours,
            max_overtime_hours_per_day,
            allow_makeup,
            makeup_deadline_days,
            require_approval_for_makeup,
            notify_on_late,
            notify_on_early_leave,
            notify_on_absent
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            settings.enable_location_check || false,
            settings.allowed_distance || 500,
            allowedLocations,
            settings.enable_time_check !== false,
            settings.early_clock_in_minutes || 60,
            settings.late_clock_out_minutes || 120,
            settings.late_minutes || 30,
            settings.early_leave_minutes || 30,
            settings.absent_hours || 4,
            settings.max_annual_leave_days || 10,
            settings.max_sick_leave_days || 15,
            settings.require_proof_for_sick_leave !== false,
            settings.require_approval_for_overtime !== false,
            settings.min_overtime_hours || 1,
            settings.max_overtime_hours_per_day || 4,
            settings.allow_makeup !== false,
            settings.makeup_deadline_days || 3,
            settings.require_approval_for_makeup !== false,
            settings.notify_on_late !== false,
            settings.notify_on_early_leave !== false,
            settings.notify_on_absent !== false
          ]
        );
      } else {
        // 更新现有设置
        await pool.query(
          `UPDATE attendance_settings SET
            enable_location_check = ?,
            allowed_distance = ?,
            allowed_locations = ?,
            enable_time_check = ?,
            early_clock_in_minutes = ?,
            late_clock_out_minutes = ?,
            late_minutes = ?,
            early_leave_minutes = ?,
            absent_hours = ?,
            max_annual_leave_days = ?,
            max_sick_leave_days = ?,
            require_proof_for_sick_leave = ?,
            require_approval_for_overtime = ?,
            min_overtime_hours = ?,
            max_overtime_hours_per_day = ?,
            allow_makeup = ?,
            makeup_deadline_days = ?,
            require_approval_for_makeup = ?,
            notify_on_late = ?,
            notify_on_early_leave = ?,
            notify_on_absent = ?,
            updated_at = NOW()
          WHERE id = 1`,
          [
            settings.enable_location_check || false,
            settings.allowed_distance || 500,
            allowedLocations,
            settings.enable_time_check !== false,
            settings.early_clock_in_minutes || 60,
            settings.late_clock_out_minutes || 120,
            settings.late_minutes || 30,
            settings.early_leave_minutes || 30,
            settings.absent_hours || 4,
            settings.max_annual_leave_days || 10,
            settings.max_sick_leave_days || 15,
            settings.require_proof_for_sick_leave !== false,
            settings.require_approval_for_overtime !== false,
            settings.min_overtime_hours || 1,
            settings.max_overtime_hours_per_day || 4,
            settings.allow_makeup !== false,
            settings.makeup_deadline_days || 3,
            settings.require_approval_for_makeup !== false,
            settings.notify_on_late !== false,
            settings.notify_on_early_leave !== false,
            settings.notify_on_absent !== false
          ]
        );
      }

      // 清理缓存
      if (redis) {
        await redis.del('config:attendance_settings');
      }

      return {
        success: true,
        message: '设置保存成功'
      };
    } catch (error) {
      console.error('保存考勤设置失败:', error);
      return reply.code(500).send({ success: false, message: '保存设置失败: ' + error.message });
    }
  });
};
