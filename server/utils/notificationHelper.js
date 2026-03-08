const getNotificationTargets = async (pool, eventType, context = {}) => {
  try {
    // 1. 物理查询通知配置
    const [settings] = await pool.query(
      'SELECT target_roles FROM notification_settings WHERE event_type = ?',
      [eventType]
    )

    let targetRoles = []
    if (settings.length > 0 && settings[0].target_roles) {
      targetRoles = typeof settings[0].target_roles === 'string'
        ? JSON.parse(settings[0].target_roles)
        : settings[0].target_roles
    }

    if (!targetRoles || targetRoles.length === 0) return [];

    let targetUserIds = new Set()

    // 2. 动态虚拟角色处理 (物理驱动)
    
    // A. 业务发起人 (本人)
    if (targetRoles.some(r => ['申请人', '业务发起人 (本人)'].includes(r)) && context.applicantId) {
      targetUserIds.add(context.applicantId)
    }

    // B. 其所属部门主管 (隔离逻辑)
    if (targetRoles.some(r => ['部门主管', '其所属部门主管'].includes(r)) && context.departmentId) {
      const [managers] = await pool.query(
        `SELECT DISTINCT u.id FROM users u WHERE u.department_id = ? AND u.is_department_manager = 1 AND u.status = 'active'`,
        [context.departmentId]
      );
      managers.forEach(m => targetUserIds.add(m.id));
    }

    // C. 审批流下一环节待办人 (新规：基于 workflow 上下文)
    if (targetRoles.includes('next_approver') && context.nextApproverId) {
      // 支持单个 ID 或数组
      if (Array.isArray(context.nextApproverId)) {
        context.nextApproverId.forEach(id => targetUserIds.add(id));
      } else {
        targetUserIds.add(context.nextApproverId);
      }
    }

    // D. 任务指派受众 (新规：基于任务分发上下文)
    if (targetRoles.includes('task_audience') && context.targetAudienceIds) {
      if (Array.isArray(context.targetAudienceIds)) {
        context.targetAudienceIds.forEach(id => targetUserIds.add(id));
      }
    }

    // 3. 处理静态角色 (如: 超级管理员)
    const staticRoles = targetRoles.filter(r => ![
      '申请人', '业务发起人 (本人)', 
      '部门主管', '其所属部门主管', 
      'next_approver', 'task_audience',
      '考生'
    ].includes(r));

    if (staticRoles.length > 0) {
      const placeholders = staticRoles.map(() => '?').join(',')
      const [users] = await pool.query(
        `SELECT DISTINCT u.id FROM users u 
         JOIN user_roles ur ON u.id = ur.user_id 
         JOIN roles r ON ur.role_id = r.id 
         WHERE r.name IN (${placeholders}) AND u.status = 'active'`,
        staticRoles
      )
      users.forEach(u => targetUserIds.add(u.id));
    }

    return Array.from(targetUserIds)
  } catch (error) {
    console.error('[通知引擎] 分发审计失败:', error)
    return []
  }
}

async function createNotification(pool, redis, io, { userId, type, title, content, relatedId, relatedType }) {
  try {
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, type, title, content, relatedId || null, relatedType || null]
    );
    
    // 🔴 关键增强：同步推送最新的全量未读计数到前端
    if (io) {
      const { sendNotificationToUser } = require('../websocket');
      
      // 1. 发送通知正文
      sendNotificationToUser(io, userId, { 
        id: result.insertId, 
        type, 
        title, 
        content, 
        related_id: relatedId, 
        related_type: relatedType, 
        created_at: new Date() 
      });

      // 2. 物理统计全量未读数 (通知 + 广播)
      const [[notifResult]] = await pool.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );
      const [[broadcastResult]] = await pool.query(
        `SELECT COUNT(*) as count 
         FROM broadcast_recipients br
         INNER JOIN broadcasts b ON br.broadcast_id = b.id
         WHERE br.user_id = ? AND br.is_read = FALSE
         AND (b.expires_at IS NULL OR b.expires_at > NOW())`,
        [userId]
      );
      const totalCount = (notifResult.count || 0) + (broadcastResult.count || 0);
      
      // 3. 实时推送绝对值
      io.to(`user_${userId}`).emit('unread_count', { count: totalCount });

      // 4. 同步更新 Redis 缓存 (如果启用)
      if (redis) {
        await redis.set(`user:unread_count:${userId}`, totalCount, 'EX', 3600);
      }
    }
    
    return result.insertId;
  } catch (error) {
    console.error('[通知引擎] 物理存证失败:', error);
    throw error;
  }
}

module.exports = { getNotificationTargets, createNotification }
