/**
 * 系统操作日志工具类
 */

/**
 * 记录操作日志
 * @param {Object} pool - 数据库连接池
 * @param {Object} logData - 日志内容
 */
async function recordLog(pool, {
  user_id,
  username,
  real_name,
  module,
  action,
  method,
  url,
  params,
  ip,
  user_agent,
  status = 1,
  error_msg = null
}) {
  try {
    console.log(`[LOG] ${real_name || username || 'Unknown'} - ${module}: ${action}`);
    await pool.query(
      `INSERT INTO operation_logs 
       (user_id, username, real_name, module, action, method, url, params, ip, user_agent, status, error_msg) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id || null,
        username || null,
        real_name || null,
        module,
        action,
        method || null,
        url || null,
        params ? JSON.stringify(params) : null,
        ip || null,
        user_agent || null,
        status,
        error_msg
      ]
    );
  } catch (error) {
    console.error('Failed to record operation log:', error);
  }
}

module.exports = {
  recordLog
};
