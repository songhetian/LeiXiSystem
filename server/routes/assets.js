const jwt = require('jsonwebtoken')
const { recordLog } = require('../utils/logger')
const { startWorkflow, processApproval, getApprovalProgress } = require('../utils/workflowEngine')
const { sendNotificationToUser } = require('../websocket')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql
  const redis = fastify.redis

  const sendSuccess = (data, message = '操作成功') => ({ success: true, data, message })

  // --- Helpers ---
  const generateDeviceNo = async () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `LX-${date}-`;
    const [rows] = await pool.query('SELECT asset_no FROM devices WHERE asset_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
    let seq = '001';
    if (rows.length > 0) {
      const parts = rows[0].asset_no.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      seq = String(lastSeq + 1).padStart(3, '0');
    }
    return `${prefix}${seq}`;
  }

  const refreshDeviceConfig = async (deviceId) => {
    try {
      const [configs] = await pool.query(`
        SELECT dcd.*, ct.name as type_name, c.name as component_name, c.model as component_model
        FROM device_config_details dcd
        JOIN asset_component_types ct ON dcd.component_type_id = ct.id
        JOIN asset_components c ON dcd.component_id = c.id
        WHERE dcd.device_id = ? AND (dcd.status = 'active' OR dcd.status IS NULL)
      `, [deviceId]);
      if (redis) await redis.set(`device:${deviceId}:config`, JSON.stringify(configs), 'EX', 86400 * 7);
      return configs;
    } catch (e) { return []; }
  }

  const getUserFromToken = (request) => {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) throw new Error('Unauthorized')
    return jwt.verify(token, JWT_SECRET)
  }

  // ==================== 1. 配置中心 (元数据) ====================
  fastify.get('/api/assets/categories', async () => {
    const [rows] = await pool.query('SELECT * FROM asset_categories WHERE status != "deleted" OR status IS NULL');
    return sendSuccess(rows);
  })
  fastify.post('/api/assets/categories', async (request) => {
    const user = getUserFromToken(request);
    const { name, code } = request.body;
    await pool.query('INSERT INTO asset_categories (name, code, status) VALUES (?, ?, "active")', [name, code || name.substring(0,2).toUpperCase()]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `新增业务分类: ${name}`, method: 'POST', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })
  fastify.delete('/api/assets/categories/:id', async (request, reply) => {
    const user = getUserFromToken(request);
    const { id } = request.params;
    const [info] = await pool.query('SELECT name FROM asset_categories WHERE id = ?', [id]);
    const [usage] = await pool.query('SELECT id FROM asset_models WHERE category_id = ? AND status != "deleted"', [id]);
    if (usage.length > 0) return reply.code(400).send({ success: false, message: '该分类下仍有设备型号，无法删除' });
    await pool.query('UPDATE asset_categories SET status = "deleted" WHERE id = ?', [id]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `删除业务分类: ${info[0]?.name}`, method: 'DELETE', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })

  fastify.get('/api/assets/forms', async () => {
    const [rows] = await pool.query('SELECT * FROM asset_device_forms WHERE status != "deleted" OR status IS NULL');
    return sendSuccess(rows);
  })
  fastify.post('/api/assets/forms', async (request) => {
    const user = getUserFromToken(request);
    await pool.query('INSERT INTO asset_device_forms (name, status) VALUES (?, "active")', [request.body.name]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `新增设备形态: ${request.body.name}`, method: 'POST', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })
  fastify.delete('/api/assets/forms/:id', async (request, reply) => {
    const user = getUserFromToken(request);
    const { id } = request.params;
    const [info] = await pool.query('SELECT name FROM asset_device_forms WHERE id = ?', [id]);
    const [usage] = await pool.query('SELECT id FROM asset_models WHERE form_id = ? AND status != "deleted"', [id]);
    if (usage.length > 0) return reply.code(400).send({ success: false, message: '该形态仍有设备型号在使用，无法删除' });
    await pool.query('UPDATE asset_device_forms SET status = "deleted" WHERE id = ?', [id]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `删除设备形态: ${info[0]?.name}`, method: 'DELETE', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })

  fastify.get('/api/assets/component-types', async () => {
    const [rows] = await pool.query('SELECT * FROM asset_component_types WHERE status != "deleted" OR status IS NULL ORDER BY sort_order');
    return sendSuccess(rows);
  })
  fastify.post('/api/assets/component-types', async (request) => {
    const user = getUserFromToken(request);
    await pool.query('INSERT INTO asset_component_types (name, status) VALUES (?, "active")', [request.body.name]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `新增配件大类: ${request.body.name}`, method: 'POST', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })
  fastify.delete('/api/assets/component-types/:id', async (request, reply) => {
    const user = getUserFromToken(request);
    const { id } = request.params;
    const [info] = await pool.query('SELECT name FROM asset_component_types WHERE id = ?', [id]);
    const [usage] = await pool.query('SELECT id FROM asset_components WHERE type_id = ? AND status != "deleted"', [id]);
    if (usage.length > 0) return reply.code(400).send({ success: false, message: '该配件大类下仍有具体规格，无法删除' });
    await pool.query('UPDATE asset_component_types SET status = "deleted" WHERE id = ?', [id]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `删除配件大类: ${info[0]?.name}`, method: 'DELETE', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })

  // ==================== 2. 规格库 ====================
  fastify.get('/api/assets/components', async (request) => {
    const { type_id } = request.query;
    let q = 'SELECT c.*, ct.name as type_name FROM asset_components c JOIN asset_component_types ct ON c.type_id = ct.id WHERE (c.status != "deleted" OR c.status IS NULL)';
    if (type_id) q += ` AND c.type_id = ${pool.escape(type_id)}`;
    const [rows] = await pool.query(q);
    return sendSuccess(rows);
  })
  fastify.post('/api/assets/components', async (request) => {
    const user = getUserFromToken(request);
    const { type_id, name, model, notes } = request.body;
    await pool.query('INSERT INTO asset_components (type_id, name, model, notes, status) VALUES (?, ?, ?, ?, "active")', [type_id, name, model, notes]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `定义新规格: ${name} (${model})`, method: 'POST', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })
  fastify.put('/api/assets/components/:id', async (request) => {
    const user = getUserFromToken(request);
    const { id } = request.params;
    const { type_id, name, model, notes } = request.body;
    await pool.query('UPDATE asset_components SET type_id=?, name=?, model=?, notes=? WHERE id=?', [type_id, name, model, notes, id]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `更新规格配置: ${name} (${model})`, method: 'PUT', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })
  fastify.delete('/api/assets/components/:id', async (request, reply) => {
    const user = getUserFromToken(request);
    const { id } = request.params;
    const [info] = await pool.query('SELECT name, model FROM asset_components WHERE id = ?', [id]);
    const [modelUsage] = await pool.query('SELECT model_id FROM asset_model_templates WHERE component_id = ?', [id]);
    if (modelUsage.length > 0) return reply.code(400).send({ success: false, message: '该规格在设备型号模板中被使用，无法删除' });
    const [instanceUsage] = await pool.query('SELECT id FROM device_config_details WHERE component_id = ? AND status = "active"', [id]);
    if (instanceUsage.length > 0) return reply.code(400).send({ success: false, message: '已有实机配置了此配件，无法删除' });
    await pool.query('UPDATE asset_components SET status = "deleted" WHERE id = ?', [id]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `删除配件规格: ${info[0]?.name} (${info[0]?.model})`, method: 'DELETE', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })

  // ==================== 3. 型号库 (SKU) ====================
  fastify.get('/api/assets/devices', async () => {
    const [rows] = await pool.query(`
      SELECT am.*, ac.name as category_name, adf.name as form_name,
             (SELECT COUNT(*) FROM devices WHERE model_id = am.id AND device_status = 'in_use' AND (status != 'deleted' OR status IS NULL)) as assigned_count
      FROM asset_models am
      LEFT JOIN asset_categories ac ON am.category_id = ac.id
      LEFT JOIN asset_device_forms adf ON am.form_id = adf.id
      WHERE am.status != 'deleted' OR am.status IS NULL
    `);
    return sendSuccess(rows);
  })
  fastify.get('/api/assets/devices/:id', async (request) => {
    const [model] = await pool.query('SELECT * FROM asset_models WHERE id = ?', [request.params.id]);
    const [template] = await pool.query(`
      SELECT amt.component_id, amt.quantity, ac.name, act.name as type_name
      FROM asset_model_templates amt
      JOIN asset_components ac ON amt.component_id = ac.id
      JOIN asset_component_types act ON ac.type_id = act.id
      WHERE amt.model_id = ?
    `, [request.params.id]);
    return sendSuccess({ ...model[0], template });
  })
  fastify.post('/api/assets/devices', async (request) => {
    const user = getUserFromToken(request);
    const { name, category_id, form_id, description, template } = request.body;
    const [res] = await pool.query('INSERT INTO asset_models (name, category_id, form_id, description, status) VALUES (?, ?, ?, ?, "active")', [name, category_id, form_id, description]);
    const mid = res.insertId;
    if (template?.length) {
      const vals = template.map(t => [mid, t.component_id, t.quantity]);
      await pool.query('INSERT INTO asset_model_templates (model_id, component_id, quantity) VALUES ?', [vals]);
    }
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `发布新设备型号: ${name}`, method: 'POST', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })
  fastify.put('/api/assets/devices/:id', async (request) => {
    const user = getUserFromToken(request);
    const { id } = request.params;
    const { name, category_id, form_id, description, template } = request.body;
    const connection = await pool.getConnection(); await connection.beginTransaction();
    try {
      await connection.query('UPDATE asset_models SET name=?, category_id=?, form_id=?, description=? WHERE id=?', [name, category_id, form_id, description, id]);
      await connection.query('DELETE FROM asset_model_templates WHERE model_id = ?', [id]);
      if (template?.length) { const vals = template.map(t => [id, t.component_id, t.quantity]); await connection.query('INSERT INTO asset_model_templates (model_id, component_id, quantity) VALUES ?', [vals]); }
      await recordLog(connection, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `修改设备型号: ${name}`, method: 'PUT', url: request.url, ip: request.ip, status: 1 });
      await connection.commit(); return sendSuccess(null);
    } catch(e) { await connection.rollback(); throw e; } finally { connection.release(); }
  })
  fastify.delete('/api/assets/devices/:id', async (request, reply) => {
    const user = getUserFromToken(request);
    const { id } = request.params;
    const [info] = await pool.query('SELECT name FROM asset_models WHERE id = ?', [id]);
    const [usage] = await pool.query('SELECT id FROM devices WHERE model_id = ? AND status != "deleted"', [id]);
    if (usage.length > 0) return reply.code(400).send({ success: false, message: '已有物理实机属于该型号，无法删除' });
    await pool.query('UPDATE asset_models SET status = "deleted" WHERE id = ?', [id]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `删除设备型号: ${info[0]?.name}`, method: 'DELETE', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })

  // ==================== 4. 实机明细 ====================
  fastify.get('/api/assets/idle', async () => {
    console.log('[Assets] Fetching idle assets...');
    const [rows] = await pool.query(`
      SELECT dev.*, am.name as model_name, adf.name as form_name
      FROM devices dev
      JOIN asset_models am ON dev.model_id = am.id
      LEFT JOIN asset_device_forms adf ON am.form_id = adf.id
      WHERE dev.device_status = 'idle' AND (dev.status != 'deleted' OR dev.status IS NULL)
    `);
    return sendSuccess(rows);
  })

  fastify.get('/api/assets/instances', async (request) => {
    const { device_status, department_id, model_id, keyword } = request.query;
    let q = `
      SELECT dev.*, am.name as model_name, adf.name as form_name, u.real_name as user_name, d.name as department_name, u.avatar as user_avatar
      FROM devices dev
      JOIN asset_models am ON dev.model_id = am.id
      LEFT JOIN asset_device_forms adf ON am.form_id = adf.id
      LEFT JOIN users u ON dev.current_user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE dev.status != 'deleted' OR dev.status IS NULL
    `;
    const params = [];
    if (device_status) { q += ' AND dev.device_status = ?'; params.push(device_status); }
    if (department_id) { q += ' AND u.department_id = ?'; params.push(department_id); }
    if (model_id) { q += ' AND dev.model_id = ?'; params.push(model_id); }
    if (keyword) { q += ' AND (dev.asset_no LIKE ? OR u.real_name LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
    const [rows] = await pool.query(q + ' ORDER BY dev.id DESC', params);
    return sendSuccess(rows);
  })

  fastify.get('/api/assets/instances/:id', async (request) => {
    const [dev] = await pool.query(`
      SELECT dev.*, am.name as model_name, adf.name as form_name, u.real_name as user_name, ac.name as category_name
      FROM devices dev
      JOIN asset_models am ON dev.model_id = am.id
      LEFT JOIN asset_device_forms adf ON am.form_id = adf.id
      LEFT JOIN asset_categories ac ON am.category_id = ac.id
      LEFT JOIN users u ON dev.current_user_id = u.id
      WHERE dev.id = ?
    `, [request.params.id]);
    const config = await refreshDeviceConfig(request.params.id);
    const [history] = await pool.query(`
      SELECT u.*, ct.name as type_name, c_old.model as old_model, c_new.model as new_model, h.real_name as handler_name
      FROM asset_upgrades u
      LEFT JOIN asset_component_types ct ON u.component_type_id = ct.id
      LEFT JOIN asset_components c_old ON u.old_component_id = c_old.id
      LEFT JOIN asset_components c_new ON u.new_component_id = c_new.id
      LEFT JOIN users h ON u.handled_by = h.id
      WHERE u.asset_id = ? ORDER BY u.id DESC
    `, [request.params.id]);
    return sendSuccess({ ...dev[0], components: config, history });
  })

  // 物理配置变更
  fastify.post('/api/assets/instances/:id/config', async (request) => {
    const connection = await pool.getConnection(); await connection.beginTransaction();
    try {
      const user = getUserFromToken(request); const { id } = request.params;
      const { component_type_id, new_component_id, old_component_id, reason, change_type } = request.body;
      if (old_component_id) {
        await connection.query('UPDATE device_config_details SET component_id = ?, change_type = ? WHERE device_id = ? AND component_id = ? AND (status = "active" OR status IS NULL)', [new_component_id, change_type, id, old_component_id]);
      } else {
        await connection.query('INSERT INTO device_config_details (device_id, component_type_id, component_id, change_type, status) VALUES (?, ?, ?, ?, "active")', [id, component_type_id, new_component_id, change_type]);
      }
      await connection.query('INSERT INTO asset_upgrades (asset_id, component_type_id, old_component_id, new_component_id, upgrade_type, reason, upgrade_date, handled_by) VALUES (?,?,?,?,?,?,NOW(),?)', [id, component_type_id, old_component_id||null, new_component_id, change_type, reason, user.id]);
      
      const [dev] = await connection.query('SELECT asset_no FROM devices WHERE id = ?', [id]);
      await recordLog(connection, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `变更设备配件 [${dev[0].asset_no}]: ${change_type === 'upgrade' ? '性能升级' : '调整/降级'}`, method: 'POST', url: request.url, ip: request.ip, status: 1 });
      
      await connection.commit(); await refreshDeviceConfig(id); return sendSuccess(null);
    } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
  })

  // 状态变更
  fastify.put('/api/assets/instances/:id/status', async (request) => {
    const user = getUserFromToken(request);
    const { device_status } = request.body;
    const [dev] = await pool.query('SELECT asset_no FROM devices WHERE id = ?', [request.params.id]);
    let sql = 'UPDATE devices SET device_status = ?';
    if (device_status === 'idle' || device_status === 'scrapped') sql += ', current_user_id = NULL';
    await pool.query(sql + ' WHERE id = ?', [device_status, request.params.id]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `变更设备状态 [${dev[0]?.asset_no}] 为: ${device_status}`, method: 'PUT', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })

  // 报废
  fastify.delete('/api/assets/instances/:id', async (request, reply) => {
    const user = getUserFromToken(request);
    const { id } = request.params;
    const [dev] = await pool.query('SELECT asset_no, device_status FROM devices WHERE id = ?', [id]);
    if (dev[0]?.device_status === 'in_use') return reply.code(400).send({ success: false, message: '使用中的设备无法直接报废' });
    await pool.query('UPDATE devices SET status = "deleted", device_status = "scrapped" WHERE id = ?', [id]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `报废/销毁物理设备: ${dev[0]?.asset_no}`, method: 'DELETE', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(null);
  })

  // 分配
  fastify.post('/api/assets/assign', async (request) => {
    const connection = await pool.getConnection(); await connection.beginTransaction();
    try {
      const user = getUserFromToken(request); const { user_id, model_id, asset_id } = request.body;
      let deviceId = asset_id; let assetNo;
      if (!deviceId) {
        assetNo = await generateDeviceNo();
        const [devRes] = await connection.query('INSERT INTO devices (asset_no, model_id, current_user_id, device_status, status) VALUES (?, ?, ?, "in_use", "active")', [assetNo, model_id, user_id]);
        deviceId = devRes.insertId;
        const [templates] = await connection.query('SELECT component_id, quantity FROM asset_model_templates WHERE model_id = ?', [model_id]);
        for (const t of templates) {
          const [comp] = await connection.query('SELECT type_id FROM asset_components WHERE id = ?', [t.component_id]);
          await connection.query('INSERT INTO device_config_details (device_id, component_type_id, component_id, quantity, status) VALUES (?,?,?,?,"active")', [deviceId, comp[0].type_id, t.component_id, t.quantity]);
        }
      } else {
        await connection.query('UPDATE devices SET current_user_id = ?, device_status = "in_use" WHERE id = ?', [user_id, deviceId]);
        const [d] = await connection.query('SELECT asset_no FROM devices WHERE id = ?', [deviceId]); assetNo = d[0].asset_no;
      }
      await recordLog(connection, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `分配设备 ${assetNo} 至用户ID ${user_id}`, method: 'POST', url: '/api/assets/assign', ip: request.ip, status: 1 });
      await connection.commit(); await refreshDeviceConfig(deviceId); return sendSuccess({ asset_no: assetNo });
    } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
  })

  fastify.post('/api/assets/return', async (request) => {
    const user = getUserFromToken(request);
    const { asset_id } = request.body;
    const [dev] = await pool.query('SELECT asset_no FROM devices WHERE id = ?', [asset_id]);
    await pool.query('UPDATE devices SET current_user_id = NULL, device_status = "idle" WHERE id = ?', [asset_id]);
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `回收设备至闲置库: ${dev[0]?.asset_no}`, method: 'POST', url: request.url, ip: request.ip, status: 1 });
    if (redis) await redis.del(`device:${asset_id}:config`);
    return sendSuccess(null);
  })

  // 员工资产统计
  fastify.get('/api/assets/employee-centric', async (request) => {
    const { department_id, keyword } = request.query;
    let q = `
      SELECT u.id as user_id, u.real_name, u.avatar, d.name as department_name, pos.name as position_name,
             (SELECT COUNT(*) FROM devices 
              WHERE current_user_id = u.id 
              AND status != 'deleted' 
              AND device_status = 'in_use') as device_count
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN employees e ON u.id = e.user_id
      LEFT JOIN positions pos ON e.position_id = pos.id
      WHERE u.status = 'active'
    `;
    const params = [];
    if (department_id) { q += ' AND u.department_id = ?'; params.push(department_id); }
    if (keyword) { q += ' AND (u.real_name LIKE ? OR u.username LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
    const [rows] = await pool.query(q + ' ORDER BY device_count DESC, u.real_name ASC', params);
    return sendSuccess(rows);
  })

  fastify.get('/api/assets/employee/:userId', async (request) => {
    const userId = request.params.userId;
    // 1. 先获取基础设备列表
    const [devices] = await pool.query(`
      SELECT dev.*, am.name as model_name, adf.name as form_name 
      FROM devices dev 
      JOIN asset_models am ON dev.model_id = am.id 
      LEFT JOIN asset_device_forms adf ON am.form_id = adf.id 
      WHERE dev.current_user_id = ? AND (dev.status != 'deleted' OR dev.status IS NULL) AND dev.device_status = 'in_use'
    `, [userId]);

    if (devices.length === 0) return sendSuccess([]);

    // 2. 性能优化：批量查询所有设备的配件配置 (消除 N+1)
    const deviceIds = devices.map(d => d.id);
    const [allConfigs] = await pool.query(`
      SELECT dcd.*, ct.name as type_name, c.name as component_name, c.model as component_model
      FROM device_config_details dcd
      JOIN asset_component_types ct ON dcd.component_type_id = ct.id
      JOIN asset_components c ON dcd.component_id = c.id
      WHERE dcd.device_id IN (?) AND (dcd.status = 'active' OR dcd.status IS NULL)
    `, [deviceIds]);

    // 3. 将配置映射回设备
    const configMap = allConfigs.reduce((acc, curr) => {
      if (!acc[curr.device_id]) acc[curr.device_id] = [];
      acc[curr.device_id].push(curr);
      return acc;
    }, {});

    const enrichedData = devices.map(dev => ({
      ...dev,
      components: configMap[dev.id] || []
    }));

    return sendSuccess(enrichedData);
  })

  // 审批
  fastify.post('/api/assets/instances/:id/request', async (request) => {
    const user = getUserFromToken(request); const { type, description } = request.body;
    const [res] = await pool.query('INSERT INTO asset_requests (asset_id, user_id, type, description, status) VALUES (?, ?, ?, ?, "pending")', [request.params.id, user.id, type, description]);
    await startWorkflow(pool, 'asset_request', res.insertId); return sendSuccess(null);
  })

  fastify.get('/api/assets/requests', async (request) => {
    const user = getUserFromToken(request); const { status } = request.query;
    let q = `SELECT ar.*, dev.asset_no, am.name as device_name, u.real_name as applicant_name, d.name as department_name FROM asset_requests ar JOIN devices dev ON ar.asset_id = dev.id JOIN asset_models am ON dev.model_id = am.id JOIN users u ON ar.user_id = u.id LEFT JOIN departments d ON u.department_id = d.id WHERE 1=1`;
    const params = [];
    const [roles] = await pool.query('SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?', [user.id]);
    if (!roles.some(r => r.name === '超级管理员')) { q += ' AND ar.user_id = ?'; params.push(user.id); }
    if (status && status !== 'all') { q += ' AND ar.status = ?'; params.push(status); }
    const [rows] = await pool.query(q + ' ORDER BY ar.id DESC', params); return sendSuccess(rows);
  })

  fastify.put('/api/assets/requests/:id/audit', async (request) => {
    const user = getUserFromToken(request); const { action, admin_notes } = request.body;
    const result = await processApproval(pool, 'asset_request', parseInt(request.params.id), user.id, action, admin_notes);
    if (action === 'approve' && result.completed) {
      const [req] = await pool.query('SELECT asset_id, type FROM asset_requests WHERE id = ?', [request.params.id]);
      if (req[0].type === 'repair') await pool.query('UPDATE devices SET device_status = "in_use" WHERE id = ?', [req[0].asset_id]);
    }
    await recordLog(pool, { user_id: user.id, username: user.username, real_name: user.real_name, module: 'logistics', action: `审批后勤申请 [ID: ${request.params.id}] -> ${action}`, method: 'PUT', url: request.url, ip: request.ip, status: 1 });
    return sendSuccess(result);
  })
}
