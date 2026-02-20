const dayjs = require('dayjs');
const { sendNotificationToUser } = require('../websocket');

/**
 * 考勤异常自动化处理器
 * 负责智能对冲请假数据、自动标记缺勤以及发送异常提醒
 */
class AttendanceAutoProcessor {
  constructor(pool, redis, io) {
    this.pool = pool;
    this.redis = redis;
    this.io = io;
  }

  /**
   * 执行指定日期的考勤终盘
   * @param {string} date YYYY-MM-DD
   */
  async processDaily(date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')) {
    console.log(`🕒 [AttendanceAutoProcessor] 开始终盘日期: ${date}`);
    
    try {
      // 0. 检查是否为节假日
      const [holiday] = await this.pool.query(
        'SELECT id FROM holidays WHERE ? BETWEEN start_date AND end_date',
        [date]
      );
      if (holiday.length > 0) {
        console.log(`   - [跳过] ${date} 为法定节假日/休息日`);
        return;
      }

      // 1. 获取该日所有排班员工
      const [schedules] = await this.pool.query(`
        SELECT ss.employee_id, e.user_id, u.real_name, ws.name as shift_name, ws.start_time, ws.end_time
        FROM shift_schedules ss
        JOIN employees e ON ss.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        JOIN work_shifts ws ON ss.shift_id = ws.id
        WHERE ss.schedule_date = ? AND ss.is_rest_day = 0
      `, [date]);

      for (const sch of schedules) {
        // 2. 检查现有的打卡记录
        const [records] = await this.pool.query(
          'SELECT id, status, clock_in_time, clock_out_time FROM attendance_records WHERE employee_id = ? AND record_date = ?',
          [sch.employee_id, date]
        );

        // 场景 A: 完全未打卡
        if (records.length === 0) {
          const [leave] = await this.pool.query(`
            SELECT id, leave_type FROM leave_records 
            WHERE employee_id = ? AND status = 'approved'
            AND ? BETWEEN start_date AND end_date
          `, [sch.employee_id, date]);

          if (leave.length > 0) {
            await this.pool.query(`
              INSERT IGNORE INTO attendance_records (employee_id, user_id, record_date, status, remark)
              VALUES (?, ?, ?, 'leave', ?)
            `, [sch.employee_id, sch.user_id, date, `系统自动对冲: ${leave[0].leave_type}`]);
          } else {
            await this.pool.query(`
              INSERT IGNORE INTO attendance_records (employee_id, user_id, record_date, status, remark)
              VALUES (?, ?, ?, 'absent', '系统判定: 未打卡且无请假记录')
            `, [sch.employee_id, sch.user_id, date]);
            this.notifyAnomaly(sch.user_id, date, '缺勤');
          }
        } 
        // 场景 B: 有打卡记录，但状态可能未标记（例如某些外部同步进来的原始打卡）
        else if (records[0].status === 'normal' || !records[0].status) {
          const { clock_in_time, clock_out_time } = records[0];
          let finalStatus = 'normal';
          let anomalies = [];

          if (clock_in_time && dayjs(`${date} ${clock_in_time}`).isAfter(dayjs(`${date} ${sch.start_time}`).add(1, 'minute'))) {
            finalStatus = 'late';
            anomalies.push('迟到');
          }
          
          if (clock_out_time && dayjs(`${date} ${clock_out_time}`).isBefore(dayjs(`${date} ${sch.end_time}`).subtract(1, 'minute'))) {
            finalStatus = finalStatus === 'late' ? 'late_early' : 'early';
            anomalies.push('早退');
          }

          if (finalStatus !== 'normal') {
            await this.pool.query(
              'UPDATE attendance_records SET status = ? WHERE id = ?',
              [finalStatus, records[0].id]
            );
            this.notifyAnomaly(sch.user_id, date, anomalies.join('及'));
          }
        }
      }
      console.log('✅ [AttendanceAutoProcessor] 终盘任务完成');
    } catch (err) {
      console.error('❌ [AttendanceAutoProcessor] 终盘失败:', err);
    }
  }

  /**
   * 发送异常通知
   */
  async notifyAnomaly(userId, date, type) {
    const title = '考勤异常提醒';
    const content = `系统检测到您在 ${date} 存在 [${type}] 记录，如有异议请及时提交补卡申请。`;
    
    try {
      // 写入通知表
      const [res] = await this.pool.query(
        'INSERT INTO notifications (user_id, type, title, content, related_type) VALUES (?, "attendance_anomaly", ?, ?, "attendance")',
        [userId, title, content]
      );

      // WebSocket 推送
      if (this.io) {
        sendNotificationToUser(this.io, userId, {
          id: res.insertId,
          type: 'attendance_anomaly',
          title,
          content,
          created_at: new Date()
        });
      }
    } catch (e) {
      console.error('推送考勤异常失败:', e);
    }
  }
}

module.exports = AttendanceAutoProcessor;