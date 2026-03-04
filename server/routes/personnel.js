const bcrypt = require('bcryptjs');
const path = require('path');
const dayjs = require('dayjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { extractUserPermissions, applyDepartmentFilter } = require('../middleware/checkPermission');
const { recordLog } = require('../utils/logger');
const { syncUserChatGroups } = require('../utils/personnelClosure');
const { sanitizeUser, extractRelativePath, saveBase64Image } = require('../utils/pathHelper');
const { findApprover } = require('../utils/approvalHelper');

async function personnelRoutes(fastify, options) {
  const pool = fastify.mysql;
  const redis = fastify.redis;

  // 获取用户审批人 (通常为部门主管)
  fastify.get('/api/users/:userId/approver', async (request, reply) => {
    const { userId } = request.params;
    try {
      // 获取用户所在的部门ID
      const [userRows] = await pool.query('SELECT department_id FROM users WHERE id = ?', [userId]);
      if (userRows.length === 0) return reply.code(404).send({ success: false, message: '用户不存在' });
      
      const departmentId = userRows[0].department_id;
      if (!departmentId) return { success: true, data: null };

      const approver = await findApprover(pool, userId, departmentId);
      return { success: true, data: approver };
    } catch (error) {
      console.error('获取审批人失败:', error);
      return reply.code(500).send({ success: false, message: '获取审批人失败' });
    }
  });

  // ==================== 客服管理 API ====================

  // 获取客服人员列表
  fastify.get('/api/customers', async (request, reply) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          u.id,
          u.username,
          u.real_name as name,
          u.email,
          u.phone,
          d.name as department,
          u.status,
          e.rating
        FROM users u
        LEFT JOIN employees e ON u.id = e.user_id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE d.name = '客服部' OR u.department_id IN (SELECT id FROM departments WHERE name = '客服部')
        ORDER BY u.created_at DESC
      `)
      return rows
    } catch (error) {
      reply.code(500).send({ error: '获取客服列表失败' })
    }
  })

  // 新增客服人员
  fastify.post('/api/customers', async (request, reply) => {
    const { name, email, phone, department, status, rating } = request.body

    try {
      const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ?', [department])
      const departmentId = deptRows[0]?.id || 6 

      const username = `CS${Date.now()}`
      const passwordHash = '$2b$12$KIXxLQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNqYq' 

      const [userResult] = await pool.query(
        'INSERT INTO users (username, password_hash, real_name, email, phone, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, passwordHash, name, email, phone, departmentId, status]
      )

      let positionId;
      const [existingPositions] = await pool.query('SELECT id FROM positions WHERE name = ?', ['客服专员']);
      if (existingPositions.length > 0) {
        positionId = existingPositions[0].id;
      } else {
        const [positionResult] = await pool.query(
          'INSERT INTO positions (name, status, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
          ['客服专员', 'active']
        );
        positionId = positionResult.insertId;
      }

      const employeeNo = `E${String(userResult.insertId).padStart(3, '0')}`
      await pool.query(
        'INSERT INTO employees (user_id, employee_no, position, position_id, hire_date, rating, status) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
        [userResult.insertId, employeeNo, '客服专员', positionId, rating, status]
      )

      try {
          const userId = userResult.insertId;
          const [groups] = await pool.query('SELECT id FROM chat_groups WHERE department_id = ?', [departmentId]);
          if (groups.length > 0) {
              const groupId = groups[0].id;
              await pool.query(
                  'INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                  [groupId, userId, 'member']
              );

              if (redis) {
                  const sysMsg = {
                      sender_id: 0, group_id: groupId,
                      content: `欢迎新同事 ${name} 加入本部门`,
                      msg_type: 'system', created_at: new Date()
                  };
                  await redis.publish('chat_messages', JSON.stringify(sysMsg));
              }

              await recordLog(pool, {
                  user_id: 0,
                  username: 'system',
                  real_name: '系统自动',
                  module: 'messaging',
                  action: `新员工 (ID: ${userId}) 自动加入部门群组 [ID: ${groups[0].id}]`,
                  method: 'SYSTEM',
                  url: '/api/customers',
                  ip: '127.0.0.1',
                  status: 1
              });
          }
      } catch (chatErr) {
          console.error('Failed to auto-join chat group:', chatErr);
      }

      return { success: true, id: userResult.insertId }
    } catch (error) {
      console.error(error)
      reply.code(500).send({ error: '新增客服失败' })
    }
  })

  // 更新客服人员
  fastify.put('/api/customers/:id', async (request, reply) => {
    const { id } = request.params
    const { name, email, phone, department, status, rating } = request.body

    try {
      const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ?', [department])
      const departmentId = deptRows[0]?.id || 6

      const [oldUser] = await pool.query('SELECT department_id FROM users WHERE id = ?', [id]);
      const oldDepartmentId = oldUser[0]?.department_id;

      await pool.query(
        'UPDATE users SET real_name = ?, email = ?, phone = ?, department_id = ?, status = ? WHERE id = ?',
        [name, email, phone, departmentId, status, id]
      )

      if (oldDepartmentId && oldDepartmentId !== departmentId) {
          try {
              const [oldGroups] = await pool.query('SELECT id FROM chat_groups WHERE department_id = ?', [oldDepartmentId]);
              if (oldGroups.length > 0) {
                  const oldGroupId = oldGroups[0].id;
                  await pool.query('DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?', [oldGroupId, id]);

                  const [u] = await pool.query('SELECT real_name FROM users WHERE id = ?', [id]);
                  if (u.length > 0 && redis) {
                      const sysMsg = {
                          sender_id: 0, group_id: oldGroupId,
                          content: `${u[0].real_name} 已调离本部门`,
                          msg_type: 'system', created_at: new Date()
                      };
                      await redis.publish('chat_messages', JSON.stringify(sysMsg));
                  }
              }
              const [newGroups] = await pool.query('SELECT id FROM chat_groups WHERE department_id = ?', [departmentId]);
              if (newGroups.length > 0) {
                   const newGroupId = newGroups[0].id;
                   await pool.query(
                      'INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                      [newGroupId, id, 'member']
                  );

                  const [u] = await pool.query('SELECT real_name FROM users WHERE id = ?', [id]);
                  if (u.length > 0 && redis) {
                      const sysMsg = {
                          sender_id: 0, group_id: newGroupId,
                          content: `欢迎 ${u[0].real_name} 加入本群组`,
                          msg_type: 'system', created_at: new Date()
                      };
                      await redis.publish('chat_messages', JSON.stringify(sysMsg));
                  }
              }

              await recordLog(pool, {
                  user_id: 0,
                  username: 'system',
                  real_name: '系统自动',
                  module: 'messaging',
                  action: `员工 (ID: ${id}) 因调岗自动从群组 ${oldDepartmentId} 移动至 ${departmentId}`,
                  method: 'SYSTEM',
                  url: `/api/customers/${id}`,
                  ip: '127.0.0.1',
                  status: 1
              });
          } catch (chatSyncErr) {
              console.error('Chat group sync failed:', chatSyncErr);
          }
      }

      if (redis && status !== 'active') {
        await redis.del(`user:session:${id}`);
        await redis.del(`user:permissions:${id}`);

        try {
            await pool.query('DELETE FROM chat_group_members WHERE user_id = ?', [id]);

            const [userDevices] = await pool.query('SELECT id, asset_no FROM devices WHERE current_user_id = ?', [id]);
            if (userDevices.length > 0) {
                const deviceIds = userDevices.map(d => d.id);
                await pool.query('UPDATE devices SET device_status = "idle", current_user_id = NULL WHERE id IN (?)', [deviceIds]);
                const deviceNos = userDevices.map(d => d.asset_no).join(', ');
                await recordLog(pool, {
                    user_id: 0, username: 'system', real_name: '系统自动',
                    module: 'logistics', action: `员工账号状态变更 (${status})，设备自动回收: [${deviceNos}]`,
                    method: 'SYSTEM', url: `/api/customers/${id}`, ip: '127.0.0.1', status: 1
                });
            }

            await recordLog(pool, {
                user_id: 0,
                username: 'system',
                real_name: '系统自动',
                module: 'messaging',
                action: `用户 (ID: ${id}) 状态变为 ${status}，已自动移除所有群聊`,
                method: 'SYSTEM',
                url: `/api/customers/${id}`,
                ip: '127.0.0.1',
                status: 1
            });
        } catch (leaveErr) {
            console.error('Failed to handle offboarding cleanup:', leaveErr);
        }
      }

      if (redis) {
        const keys = await redis.keys('list:employees:default:*');
        if (keys.length > 0) await redis.del(...keys);
        await redis.del(`user:identity:${id}`);
      }

      await pool.query(
        'UPDATE employees SET rating = ?, status = ? WHERE user_id = ?',
        [rating, status, id]
      )

      return { success: true }
    } catch (error) {
      console.error(error)
      reply.code(500).send({ error: '更新客服失败' })
    }
  })

  // 删除客服人员
  fastify.delete('/api/customers/:id', async (request, reply) => {
    const { id } = request.params

    try {
      const [userDevices] = await pool.query('SELECT id, asset_no FROM devices WHERE current_user_id = ?', [id]);
      if (userDevices.length > 0) {
          const deviceIds = userDevices.map(d => d.id);
          await pool.query('UPDATE devices SET device_status = "idle", current_user_id = NULL WHERE id IN (?)', [deviceIds]);
      }

      await pool.query('DELETE FROM users WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error(error)
      reply.code(500).send({ error: '删除客服失败' })
    }
  })

  // ==================== 员工管理 API ====================

  // 获取员工列表
  fastify.get('/api/employees', async (request, reply) => {
    try {
      const { includeDeleted, department_id, keyword, position, status, rating, date_from, date_to } = request.query;

      const permissions = await extractUserPermissions(request, pool);

      let query = `
        SELECT
          e.id,
          e.employee_no,
          pos.name as position_name,
          e.hire_date,
          e.rating,
          e.status,
          e.emergency_contact,
          e.emergency_phone,
          e.address,
          e.education,
          e.skills,
          e.remark,
          u.id as user_id,
          u.username,
          u.real_name,
          u.email,
          u.phone,
          u.avatar,
          u.department_id,
          u.id_card_front_url,
          u.id_card_back_url,
          u.is_department_manager,
          d.name as department_name
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN positions pos ON e.position_id = pos.id
        WHERE 1=1
      `;

      const params = [];

      if (includeDeleted !== 'true') {
        query += ' AND e.status != "deleted"';
      }

      if (department_id) {
        query += ' AND u.department_id = ?';
        params.push(department_id);
      }

      if (keyword) {
        query += ' AND (';
        query += 'u.real_name LIKE ? OR u.username LIKE ? OR e.employee_no LIKE ? OR pos.name LIKE ?';
        query += ')';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
      }

      if (position) {
        query += ' AND pos.name = ?';
        params.push(position);
      }

      if (status) {
        query += ' AND e.status = ?';
        params.push(status);
      }

      if (rating) {
        query += ' AND e.rating = ?';
        params.push(rating);
      }

      if (date_from) {
        query += ' AND e.hire_date >= ?';
        params.push(date_from);
      }
      if (date_to) {
        query += ' AND e.hire_date <= ?';
        params.push(date_to);
      }

      const filtered = applyDepartmentFilter(permissions, query, [...params], 'u.department_id');
      query = filtered.query;
      const finalParams = filtered.params;

      const isDefaultQuery = !includeDeleted && !department_id && !keyword && !position && status === 'active' && !rating && !date_from && !date_to;
      const cacheKey = `list:employees:default:${permissions?.userId || 'guest'}`;

      if (redis && isDefaultQuery) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      query += ' ORDER BY e.created_at DESC';

      const [rows] = await pool.query(query, finalParams);

      let employeesWithDepts = rows;
      if (rows.length > 0) {
        const userIds = rows.map(emp => emp.user_id);
        const [allUserDepts] = await pool.query(
          `SELECT ud.user_id, d.id, d.name
           FROM departments d
           INNER JOIN user_departments ud ON d.id = ud.department_id
           WHERE ud.user_id IN (?)`,
          [userIds]
        );

        const userDeptsMap = allUserDepts.reduce((acc, curr) => {
          if (!acc[curr.user_id]) acc[curr.user_id] = [];
          acc[curr.user_id].push({ id: curr.id, name: curr.name });
          return acc;
        }, {});

        employeesWithDepts = rows.map(emp => ({
          ...sanitizeUser(emp, request),
          departments: userDeptsMap[emp.user_id] || []
        }));
      }

      if (redis && isDefaultQuery) {
        await redis.set(cacheKey, JSON.stringify(employeesWithDepts), 'EX', 600);
      }

      return employeesWithDepts;
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: '获取员工列表失败' });
    }
  });

  // 创建员工
  fastify.post('/api/employees', async (request, reply) => {
    const { 
      employee_no, real_name, email, phone, department_id, position, 
      hire_date, rating, status, username: providedUsername, avatar 
    } = request.body;
    try {
      const passwordHash = '$2b$12$KIXxLQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNqYq'; 

      // --- 路径自愈与兼容逻辑 ---
      let finalAvatar = avatar;
      if (avatar) {
        if (avatar.startsWith('data:image')) {
          finalAvatar = await saveBase64Image(avatar, 'avatar');
        } else if (avatar.startsWith('http')) {
          finalAvatar = extractRelativePath(avatar);
        }
      }

      let finalEmployeeNo = employee_no;

      if (!finalEmployeeNo) {
        const [maxEmpRows] = await pool.query('SELECT employee_no FROM employees WHERE employee_no REGEXP "^EMP[0-9]+$" ORDER BY LENGTH(employee_no) DESC, employee_no DESC LIMIT 1');

        if (maxEmpRows.length > 0) {
          const currentMax = maxEmpRows[0].employee_no;
          const numPart = parseInt(currentMax.replace(/\D/g, ''));
          finalEmployeeNo = `EMP${String(numPart + 1).padStart(4, '0')}`;
        } else {
          finalEmployeeNo = 'EMP0001';
        }
      } else {
        const [existingEmp] = await pool.query('SELECT id FROM employees WHERE employee_no = ?', [finalEmployeeNo]);
        if (existingEmp.length > 0) {
          return reply.code(400).send({ error: `工号 ${finalEmployeeNo} 已存在` });
        }
      }

      const username = providedUsername || real_name || finalEmployeeNo;

      const [existingUser] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUser.length > 0) {
        return reply.code(400).send({ error: `登录账号 ${username} 已被占用` });
      }

      let formattedHireDate = null;
      if (hire_date) {
        formattedHireDate = hire_date.split('T')[0];
      } else {
        formattedHireDate = new Date().toISOString().split('T')[0];
      }

      const [userResult] = await pool.query(
        'INSERT INTO users (username, password_hash, real_name, email, phone, department_id, avatar, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [username, passwordHash, real_name, email || null, phone || null, department_id || null, finalAvatar || null, 'active']
      );

      let positionId = null;
      if (position) {
        const [existingPositions] = await pool.query('SELECT id FROM positions WHERE name = ?', [position]);
        if (existingPositions.length > 0) {
          positionId = existingPositions[0].id;
        } else {
          const [positionResult] = await pool.query(
            'INSERT INTO positions (name, status, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
            [position, 'active']
          );
          positionId = positionResult.insertId;
        }
      }

      const [employeeResult] = await pool.query(
        'INSERT INTO employees (user_id, employee_no, position_id, hire_date, rating, status) VALUES (?, ?, ?, ?, ?, ?)',
        [userResult.insertId, finalEmployeeNo, positionId, formattedHireDate, rating || 3, status]
      );

      try {
        await pool.query(
          `INSERT INTO employee_changes
          (employee_id, user_id, change_type, change_date, old_department_id, new_department_id, old_position_id, new_position_id, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            employeeResult.insertId,
            userResult.insertId,
            'hire',
            formattedHireDate,
            null,
            department_id || null,
            null,
            positionId,
            '新员工入职'
          ]
        );
      } catch (changeError) {
        console.error('⚠️ 创建员工变动记录失败:', changeError);
      }

      if (redis) {
        const { cacheUserProfile } = require('../utils/personnelClosure');
        const keys = await redis.keys('list:employees:default:*');
        if (keys.length > 0) await redis.del(...keys);
        await cacheUserProfile(pool, redis, userResult.insertId);
      }

      try {
        if (status === 'active' && department_id) {
          await syncUserChatGroups(pool, userResult.insertId, department_id, true, redis, fastify.io);

          if (redis) {
            const [groups] = await pool.query('SELECT id FROM chat_groups WHERE department_id = ?', [department_id]);
            if (groups.length > 0) {
              const sysMsg = {
                sender_id: 0, group_id: groups[0].id,
                content: `欢迎新同事 ${real_name} 加入本部门`,
                msg_type: 'system', created_at: new Date()
              };
              await redis.publish('chat_messages', JSON.stringify(sysMsg));
            }
          }
        }
      } catch (chatErr) {
        console.error('Failed to auto-join chat group:', chatErr);
      }

      return { success: true, id: userResult.insertId };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: '创建员工失败' });
    }
  });

  // 更新员工
  fastify.put('/api/employees/:id', async (request, reply) => {
    const { id } = request.params;
    const {
      employee_no, real_name, email, phone, department_id, position,
      hire_date, rating, status, avatar, emergency_contact, emergency_phone,
      address, education, skills, remark
    } = request.body;

    try {
      const [empRows] = await pool.query(
        'SELECT e.user_id, e.status as old_status, u.department_id as old_department_id, u.real_name FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.id = ?',
        [id]
      );
      if (empRows.length === 0) {
        return reply.code(404).send({ error: '员工不存在' });
      }
      const { user_id: userId, old_status, old_department_id, real_name: empRealName } = empRows[0];

      let formattedHireDate = null;
      if (hire_date) {
        formattedHireDate = hire_date.split('T')[0];
      }

      const finalDeptId = department_id ? parseInt(department_id) : null;
      const finalStatus = status || old_status || 'active';

      // --- 路径自愈与兼容逻辑 ---
      let finalAvatar = avatar;
      if (avatar) {
        if (avatar.startsWith('data:image')) {
          // 处理 Base64 上传
          finalAvatar = await saveBase64Image(avatar, 'avatar');
        } else if (avatar.startsWith('http')) {
          // 处理全路径还原为相对路径
          finalAvatar = extractRelativePath(avatar);
        }
      }

      await pool.query(
        'UPDATE users SET real_name = ?, email = ?, phone = ?, department_id = ?, avatar = ?, status = ?, updated_at = NOW() WHERE id = ?',
        [real_name, email || null, phone || null, finalDeptId, finalAvatar || null, finalStatus, userId]
      );

      let positionId = null;
      if (position) {
        const [existingPositions] = await pool.query('SELECT id FROM positions WHERE name = ?', [position]);
        if (existingPositions.length > 0) {
          positionId = existingPositions[0].id;
        } else {
          const [positionResult] = await pool.query(
            'INSERT INTO positions (name, status, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
            [position, 'active']
          );
          positionId = positionResult.insertId;
        }
      }

      await pool.query(
        `UPDATE employees SET
          employee_no = ?,
          position_id = ?,
          hire_date = ?,
          rating = ?,
          status = ?,
          emergency_contact = ?,
          emergency_phone = ?,
          address = ?,
          education = ?,
          skills = ?,
          remark = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          employee_no,
          positionId,
          formattedHireDate,
          rating || 3,
          finalStatus,
          emergency_contact || null,
          emergency_phone || null,
          address || null,
          education || null,
          skills || null,
          remark || null,
          id
        ]
      );

      if (redis) {
        try {
          const { cacheUserProfile } = require('../utils/personnelClosure');
          await redis.del(`user:profile:${userId}`); 
          await cacheUserProfile(pool, redis, userId); 
          await redis.del(`user:identity:${userId}`); 
        } catch (cacheErr) {
          console.error('⚠️ [Cache Error] Failed to update user cache:', cacheErr);
        }
      }

      try {
        if (old_status === 'active' && finalStatus !== 'active') {
          await syncUserChatGroups(pool, userId, finalDeptId, false, redis, fastify.io);

          const { forceDisconnectUser } = require('../websocket');
          if (typeof forceDisconnectUser === 'function') {
            forceDisconnectUser(fastify.io, userId);
          }

          await pool.query('UPDATE devices SET device_status = "idle", current_user_id = NULL WHERE current_user_id = ?', [userId]);

          if (redis && old_department_id) {
            const [groups] = await pool.query('SELECT id FROM chat_groups WHERE department_id = ?', [old_department_id]);
            if (groups.length > 0) {
              const sysMsg = {
                sender_id: 0, group_id: groups[0].id,
                content: `${empRealName} 已离职/停用`,
                msg_type: 'system', created_at: new Date()
              };
              await redis.publish('chat_messages', JSON.stringify(sysMsg));
            }
          }
        }
        else if (finalStatus === 'active') {
          if (old_status !== 'active' || old_department_id !== finalDeptId) {
            await pool.query('DELETE FROM chat_group_members WHERE user_id = ?', [userId]);
            if (redis && old_department_id) {
              const [oldGroups] = await pool.query('SELECT id FROM chat_groups WHERE department_id = ?', [old_department_id]);
              if (oldGroups.length > 0) await redis.srem(`chat:group:${oldGroups[0].id}:members`, userId);
            }

            await syncUserChatGroups(pool, userId, finalDeptId, true, redis, fastify.io);

            if (redis && finalDeptId) {
              const [groups] = await pool.query('SELECT id FROM chat_groups WHERE department_id = ?', [finalDeptId]);
              if (groups.length > 0) {
                const sysMsg = {
                  sender_id: 0, group_id: groups[0].id,
                  content: `欢迎 ${empRealName} 加入本部门`,
                  msg_type: 'system', created_at: new Date()
                };
                await redis.publish('chat_messages', JSON.stringify(sysMsg));
              }
            }
          }
        }
      } catch (chatErr) {
        console.error('⚠️ [Sync Error] Chat/Asset synchronization failed:', chatErr);
      }

      return { success: true };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: '更新员工失败' });
    }
  });

  // 删除员工（软删除）
  fastify.delete('/api/employees/:id', async (request, reply) => {
    const { id } = request.params;
    const permissions = await extractUserPermissions(request, pool);

    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        const [empRows] = await connection.query(`
          SELECT e.user_id, u.real_name, e.employee_no
          FROM employees e
          LEFT JOIN users u ON e.user_id = u.id
          WHERE e.id = ?`, [id]);

        if (empRows.length === 0) {
          await connection.rollback();
          connection.release();
          return reply.code(404).send({ success: false, message: '员工不存在' });
        }

        const employee = empRows[0];

        await connection.query('UPDATE employees SET status = ? WHERE id = ?', ['deleted', id]);

        await connection.query('UPDATE devices SET device_status = "idle", current_user_id = NULL WHERE current_user_id = ?', [employee.user_id]);

        await connection.query('UPDATE users SET status = ? WHERE id = ?', ['deleted', employee.user_id]);

        try {
          await syncUserChatGroups(connection, employee.user_id, null, false, redis, fastify.io);
          const { forceDisconnectUser } = require('../websocket');
          forceDisconnectUser(fastify.io, employee.user_id);
        } catch (chatErr) {
          console.error('Failed to cleanup chat groups during deletion:', chatErr);
        }

        if (redis) {
          await redis.del(`user:session:${employee.user_id}`);
          await redis.del(`user:permissions:${employee.user_id}`);
          const keys = await redis.keys('list:employees:default:*');
          if (keys.length > 0) await redis.del(...keys);
        }

        try {
          const opId = permissions?.userId;
          let opRealName = '系统用户';
          let opUsername = 'unknown';

          if (opId) {
            const [opRows] = await connection.query('SELECT real_name, username FROM users WHERE id = ?', [opId]);
            if (opRows.length > 0) {
              opRealName = opRows[0].real_name;
              opUsername = opRows[0].username;
            }
          }

          await recordLog(connection, {
            user_id: opId,
            username: opUsername,
            real_name: opRealName,
            module: 'user',
            action: `删除员工: ${employee.real_name} (${employee.employee_no})`,
            method: 'DELETE',
            url: request.url,
            ip: request.ip,
            status: 1
          });
        } catch (logErr) {
          console.error('记录删除日志失败:', logErr);
        }

        await connection.commit();
        connection.release();
        return { success: true, message: '员工及其关联账号已成功删除' };
      } catch (err) {
        await connection.rollback();
        if (connection) connection.release();
        throw err;
      }
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: '删除员工失败' });
    }
  });

  // 恢复员工
  fastify.post('/api/employees/:id/restore', async (request, reply) => {
    const { id } = request.params;
    try {
      await pool.query('UPDATE employees SET status = ? WHERE id = ?', ['active', id]);
      return { success: true, message: '员工恢复成功' };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: '恢复员工失败' });
    }
  });

  // ==================== 员工审批 API ====================

  fastify.get('/api/users-pending', async (request, reply) => {
    try {
      const { status = 'pending', page = 1, limit = 10 } = request.query;
      const offset = (page - 1) * limit;

      const permissions = await extractUserPermissions(request, pool);

      let baseQuery = `
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.status = ?
      `;
      let params = [status];

      let tempQuery = `SELECT * ${baseQuery}`;
      const filtered = applyDepartmentFilter(permissions, tempQuery, params, 'u.department_id');

      const whereIndex = filtered.query.indexOf('WHERE');
      const whereClause = filtered.query.substring(whereIndex);
      const finalParams = filtered.params;

      const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM users u LEFT JOIN departments d ON u.department_id = d.id ${whereClause}`, finalParams);
      const total = countResult[0].total;

      const query = `
        SELECT
          u.id,
          u.username,
          u.real_name,
          u.email,
          u.phone,
          u.department_id,
          u.created_at,
          u.status,
          u.approval_note,
          d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const queryParams = [...finalParams, parseInt(limit), parseInt(offset)];

      const [rows] = await pool.query(query, queryParams);

      return {
        data: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: 'Failed to fetch users list' });
    }
  });

  fastify.post('/api/users/:id/approve', async (request, reply) => {
    const { id } = request.params;
    const { note } = request.body;

    try {
      const [users] = await pool.query(
        'SELECT username, real_name, department_id FROM users WHERE id = ?',
        [id]
      );

      if (users.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const user = users[0];

      await pool.query(
        'UPDATE users SET status = ?, approval_note = ?, updated_at = NOW() WHERE id = ?',
        ['active', note || null, id]
      );

      const [existingEmployee] = await pool.query(
        'SELECT id FROM employees WHERE user_id = ?',
        [id]
      );

      if (existingEmployee.length === 0) {
        const employeeNo = `E${String(id).padStart(3, '0')}`;
        const hireDate = new Date().toISOString().split('T')[0];

        let positionId = null;
        const [userWithPosition] = await pool.query(
          'SELECT position FROM users WHERE id = ?',
          [id]
        );
        if (userWithPosition.length > 0 && userWithPosition[0].position) {
          const [existingPositions] = await pool.query('SELECT id FROM positions WHERE name = ?', [userWithPosition[0].position]);
          if (existingPositions.length > 0) {
            positionId = existingPositions[0].id;
          } else {
            const [positionResult] = await pool.query(
              'INSERT INTO positions (name, status, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
              [userWithPosition[0].position, 'active']
            );
            positionId = positionResult.insertId;
          }
        }

        const [employeeResult] = await pool.query(
          'INSERT INTO employees (user_id, employee_no, position, position_id, hire_date, rating, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, employeeNo, userWithPosition.length > 0 && userWithPosition[0].position ? userWithPosition[0].position : null, positionId, hireDate, 3, 'active']
        );

        try {
          await pool.query(
            `INSERT INTO employee_changes
            (employee_id, user_id, change_type, change_date, old_department_id, new_department_id, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              employeeResult.insertId,
              id,
              'hire',
              hireDate,
              null,
              user.department_id || null,
              note || '注册审核通过入职'
            ]
          );
        } catch (changeError) {
          console.error('⚠️ 创建员工变动记录失败:', changeError);
        }
      }

      return { success: true, message: 'Approved successfully' };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: 'Approval failed' });
    }
  });

  fastify.post('/api/users/:id/reject', async (request, reply) => {
    const { id } = request.params;
    const { note } = request.body;

    try {
      await pool.query(
        'UPDATE users SET status = ?, approval_note = ?, updated_at = NOW() WHERE id = ?',
        ['rejected', note || null, id]
      );

      if (redis) {
        await redis.del(`user:permissions:${id}`);
      }

      return { success: true, message: 'Rejected successfully' };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: 'Rejection failed' });
    }
  });

  // ==================== 员工变动记录 API ====================

  fastify.get('/api/employee-changes', async (request, reply) => {
    const { type } = request.query;

    try {
      const permissions = await extractUserPermissions(request, pool);

      let query = `
        SELECT
          ec.*,
          u.username,
          u.real_name as real_name,
          e.employee_no,
          d1.name as old_department_name,
          d2.name as new_department_name,
          pos1.name as old_position_name,
          pos2.name as new_position_name
        FROM employee_changes ec
        LEFT JOIN users u ON ec.user_id = u.id
        LEFT JOIN employees e ON ec.employee_id = e.id
        LEFT JOIN departments d1 ON ec.old_department_id = d1.id
        LEFT JOIN departments d2 ON ec.new_department_id = d2.id
        LEFT JOIN positions pos1 ON ec.old_position_id = pos1.id
        LEFT JOIN positions pos2 ON ec.new_position_id = pos2.id
        WHERE 1=1
      `;

      let params = [];

      if (!permissions || !permissions.canViewAllDepartments) {
        if (permissions && permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
          const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',');
          query += ` AND (ec.old_department_id IN (${placeholders}) OR ec.new_department_id IN (${placeholders}))`;
          params.push(...permissions.viewableDepartmentIds, ...permissions.viewableDepartmentIds);
        } else {
          query += ` AND 1=0`;
        }
      }

      if (type && type !== 'all') {
        query += ' AND ec.change_type = ?';
        params.push(type);
      }

      query += ' ORDER BY ec.change_date DESC, ec.created_at DESC';

      const [rows] = await pool.query(query, params);

      return rows;
    } catch (error) {
      console.error('获取员工变动记录失败:', error);
      return reply.code(500).send({ error: '获取员工变动记录失败' });
    }
  });

  fastify.get('/api/employee-changes/:employeeId', async (request, reply) => {
    const { employeeId } = request.params;
    try {
      const [rows] = await pool.query(`
        SELECT
          ec.*,
          d1.name as old_department_name,
          d2.name as new_department_name,
          pos1.name as old_position_name,
          pos2.name as new_position_name
        FROM employee_changes ec
        LEFT JOIN departments d1 ON ec.old_department_id = d1.id
        LEFT JOIN departments d2 ON ec.new_department_id = d2.id
        LEFT JOIN positions pos1 ON ec.old_position_id = pos1.id
        LEFT JOIN positions pos2 ON ec.new_position_id = pos2.id
        WHERE ec.employee_id = ?
        ORDER BY ec.change_date DESC, ec.created_at DESC
      `, [employeeId]);
      return rows;
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: 'Failed to fetch employee change history' });
    }
  });

  fastify.post('/api/employee-changes/create', async (request, reply) => {
    const {
      employee_id,
      user_id,
      change_type,
      change_date,
      old_department_id,
      new_department_id,
      old_position,
      new_position,
      reason
    } = request.body;

    try {
      if (!employee_id || !user_id) {
        return reply.code(400).send({ error: '缺少关键标识符' });
      }

      const [current] = await pool.query(
        `SELECT e.position_id, u.department_id
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE e.id = ?`,
        [employee_id]
      );

      const dbOldPosId = current[0]?.position_id || null;
      const dbOldDeptId = current[0]?.department_id || null;

      let mappedNewPosId = null;
      if (new_position) {
        const [posRows] = await pool.query('SELECT id FROM positions WHERE name = ?', [new_position]);
        if (posRows.length > 0) mappedNewPosId = posRows[0].id;
      }

      let insertId = null;
      try {
        const finalDate = change_date ? change_date.split('T')[0] : dayjs().format('YYYY-MM-DD');
        const [res] = await pool.query(
          `INSERT INTO employee_changes
          (employee_id, user_id, change_type, change_date,
           old_department_id, new_department_id,
           old_position, new_position,
           old_position_id, new_position_id, reason, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            employee_id, user_id, change_type, finalDate,
            old_department_id || dbOldDeptId,
            new_department_id || old_department_id || dbOldDeptId,
            old_position || '',
            new_position || '',
            dbOldPosId,
            mappedNewPosId || dbOldPosId,
            reason || '系统自动记录',
            ''
          ]
        );
        insertId = res.insertId;
      } catch (logError) {
        console.warn('⚠️ 变动记录写入失败:', logError.message);
      }

      if (redis) {
        try {
          const keys = await redis.keys('*employees*');
          const profileKeys = await redis.keys(`*profile:${user_id}*`);
          const allKeys = [...new Set([...keys, ...profileKeys])];
          if (allKeys.length > 0) await redis.del(...allKeys);
        } catch (redisErr) {
          console.error('Redis 清理异常:', redisErr);
        }
      }

      return { success: true, id: insertId };
    } catch (error) {
      console.error('❌ 创建变动记录严重错误:', error);
      return reply.code(500).send({
        success: false,
        error: '变动记录写入失败',
        db_message: error.message,
        sql_state: error.sqlState
      });
    }
  });
}

module.exports = personnelRoutes;