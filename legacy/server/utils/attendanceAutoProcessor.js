const dayjs = require('dayjs');
const { sendNotificationToUser } = require('../websocket');
const { getNotificationTargets } = require('./notificationHelper');

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
      const d = dayjs(date);
      const year = d.year();
      const month = d.month() + 1; // dayjs month is 0-indexed
      const day = d.date();

      const [holiday] = await this.pool.query(
        'SELECT id FROM holidays WHERE year = ? AND month = ? AND days = ?',
        [year, month, day]
      );
      if (holiday.length > 0) {
        console.log(`   - [跳过] ${date} 为法定节假日/休息日`);
        return;
      }

      // 1. 获取该日所有排班员工
      const [schedules] = await this.pool.query(`
        SELECT ss.employee_id, e.user_id, u.real_name, u.department_id, ws.name as shift_name, ws.start_time, ws.end_time
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
            this.notifyAnomaly(sch.user_id, sch.department_id, sch.real_name, date, 'absent_notify');
          }
        } 
        // 场景 B: 有打卡记录，但状态可能未标记
        else if (records[0].status === 'normal' || !records[0].status) {
          const { clock_in_time, clock_out_time } = records[0];
          let finalStatus = 'normal';
          let eventType = null;

          if (clock_in_time && dayjs(`${date} ${clock_in_time}`).isAfter(dayjs(`${date} ${sch.start_time}`).add(1, 'minute'))) {
            finalStatus = 'late';
            eventType = 'late_notify';
          }
          
          if (clock_out_time && dayjs(`${date} ${clock_out_time}`).isBefore(dayjs(`${date} ${sch.end_time}`).subtract(1, 'minute'))) {
            finalStatus = finalStatus === 'late' ? 'late_early' : 'early';
            eventType = eventType ? 'late_early_notify' : 'early_leave_notify'; 
          }

          if (finalStatus !== 'normal') {
            await this.pool.query(
              'UPDATE attendance_records SET status = ? WHERE id = ?',
              [finalStatus, records[0].id]
            );
            // 这里我们分开推送不同的事件，或者统一推送
            if (eventType === 'late_early_notify') {
                await this.notifyAnomaly(sch.user_id, sch.department_id, sch.real_name, date, 'late_notify');
                await this.notifyAnomaly(sch.user_id, sch.department_id, sch.real_name, date, 'early_leave_notify');
            } else {
                await this.notifyAnomaly(sch.user_id, sch.department_id, sch.real_name, date, eventType);
            }
          }
        }
      }
      console.log('✅ [AttendanceAutoProcessor] 终盘任务完成');
    } catch (err) {
      console.error('❌ [AttendanceAutoProcessor] 终盘失败:', err);
    }
  }

  /**
   * 发送异常通知 (接入配置中心)
   */
  async notifyAnomaly(userId, departmentId, realName, date, eventType) {
    if (!eventType) return;

    const eventLabels = {
        'late_notify': '迟到',
        'early_leave_notify': '早退',
        'absent_notify': '缺勤'
    };

    const typeLabel = eventLabels[eventType] || '考勤异常';
    const title = `考勤异常告警: ${typeLabel}`;
    const content = `[系统审计] 员工 ${realName} 在 ${date} 存在 [${typeLabel}] 行为，请及时核实并处理。`;
    
    try {
      // 核心：物理调用引擎获取目标
      const targetUserIds = await getNotificationTargets(this.pool, eventType, {
        applicantId: userId,
        departmentId: departmentId
      });

      // 如果没有任何配置，默认至少发给本人
      if (targetUserIds.length === 0) targetUserIds.push(userId);

      // 批量存证
      const values = targetUserIds.map(tid => [
        tid, 'attendance_anomaly', title, content, null, 'attendance'
      ]);

      await this.pool.query(
        'INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES ?',
        [values]
      );

      // WebSocket 推送
      if (this.io) {
        targetUserIds.forEach(tid => {
          sendNotificationToUser(this.io, tid, {
            type: 'attendance_anomaly',
            title,
            content,
            created_at: new Date()
          });
        });
      }
    } catch (e) {
      console.error(`推送考勤异常 [${eventType}] 失败:`, e);
    }
  }
}

module.exports = AttendanceAutoProcessor;