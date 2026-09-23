module.exports = async function (fastify, opts) {
    const pool = fastify.mysql

    // 获取所有假期类型
    fastify.get('/api/vacation-types', async (request, reply) => {
        const redis = fastify.redis;
        const cacheKey = 'metadata:vacation_types:all';

        try {
            if (redis) {
                const cached = await redis.get(cacheKey);
                if (cached) return { success: true, data: JSON.parse(cached) };
            }

            // Updated sorting: Pinned items first, then by sort_order
            const [rows] = await pool.query('SELECT * FROM vacation_types ORDER BY is_pinned DESC, sort_order ASC, id ASC')
            
            if (redis) {
                await redis.set(cacheKey, JSON.stringify(rows), 'EX', 86400);
            }

            return { success: true, data: rows }
        } catch (error) {
            console.error('获取假期类型失败:', error)
            return reply.code(500).send({ success: false, message: '获取假期类型失败' })
        }
    })

    // 创建假期类型
    fastify.post('/api/vacation-types', async (request, reply) => {
        let { code, name, base_days, included_in_total, description, enabled, sort_order, is_pinned } = request.body
        const redis = fastify.redis;

        if (!code || !name) {
            return reply.code(400).send({ success: false, message: '代码和名称为必填项' })
        }

        try {
            // ... 原有代码逻辑 (自动生成代码等) ...
            if (!code) {
                let generatedCode = name.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, '_')
                    .replace(/^_|_$/g, '');

                if (!generatedCode) generatedCode = 'vacation_type';

                const [existing] = await pool.query('SELECT code FROM vacation_types');
                const existingCodes = existing.map(r => r.code);

                let counter = 1;
                let uniqueCode = generatedCode;
                while (existingCodes.includes(uniqueCode)) {
                    uniqueCode = `${generatedCode}_${counter}`;
                    counter++;
                }
                code = uniqueCode;
            } else {
                const [exists] = await pool.query('SELECT id FROM vacation_types WHERE code = ?', [code])
                if (exists.length > 0) {
                    return reply.code(400).send({ success: false, message: '该类型代码已存在' })
                }
            }

            if (sort_order === undefined) {
                const [maxRow] = await pool.query('SELECT MAX(sort_order) as max_sort FROM vacation_types');
                sort_order = (maxRow[0].max_sort || 0) + 1;
            }

            const [result] = await pool.query(
                `INSERT INTO vacation_types
                (code, name, base_days, included_in_total, description, enabled, sort_order, is_pinned)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    code,
                    name,
                    base_days || 0,
                    included_in_total !== undefined ? included_in_total : true,
                    description || '',
                    enabled !== undefined ? enabled : true,
                    sort_order,
                    is_pinned !== undefined ? is_pinned : 0
                ]
            )

            // 清理缓存
            if (redis) await redis.del('metadata:vacation_types:all');

            return { success: true, message: '创建成功', data: { id: result.insertId, code } }
        } catch (error) {
            console.error('创建假期类型失败:', error)
            return reply.code(500).send({ success: false, message: '创建失败' })
        }
    })

    // 更新假期类型
    fastify.put('/api/vacation-types/:id', async (request, reply) => {
        const { id } = request.params
        const { name, base_days, included_in_total, description, enabled, is_pinned, sort_order } = request.body
        const redis = fastify.redis;

        try {
            const updates = []
            const params = []

            if (name !== undefined) { updates.push('name = ?'); params.push(name); }
            if (base_days !== undefined) { updates.push('base_days = ?'); params.push(base_days); }
            if (included_in_total !== undefined) { updates.push('included_in_total = ?'); params.push(included_in_total); }
            if (description !== undefined) { updates.push('description = ?'); params.push(description); }
            if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled); }
            if (is_pinned !== undefined) { updates.push('is_pinned = ?'); params.push(is_pinned); }
            if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }

            if (updates.length === 0) return { success: true, message: '无变更' }

            params.push(id)
            await pool.query(`UPDATE vacation_types SET ${updates.join(', ')} WHERE id = ?`, params)
            
            // 清理缓存
            if (redis) await redis.del('metadata:vacation_types:all');

            return { success: true, message: '更新成功' }
        } catch (error) {
            console.error('更新假期类型失败:', error)
            return reply.code(500).send({ success: false, message: '更新失败' })
        }
    })

    // 删除假期类型
    fastify.delete('/api/vacation-types/:id', async (request, reply) => {
        const { id } = request.params
        const redis = fastify.redis;
        try {
            await pool.query('DELETE FROM vacation_types WHERE id = ?', [id])
            if (redis) await redis.del('metadata:vacation_types:all');
            return { success: true, message: '删除成功' }
        } catch (error) {
            console.error('删除假期类型失败:', error)
            return reply.code(500).send({ success: false, message: '删除失败' })
        }
    })

    // 批量删除假期类型
    fastify.post('/api/vacation-types/batch-delete', async (request, reply) => {
        const { ids } = request.body
        const redis = fastify.redis;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return reply.code(400).send({ success: false, message: '请选择要删除的类型' })
        }
        try {
            await pool.query('DELETE FROM vacation_types WHERE id IN (?)', [ids])
            if (redis) await redis.del('metadata:vacation_types:all');
            return { success: true, message: '批量删除成功' }
        } catch (error) {
            console.error('批量删除假期类型失败:', error)
            return reply.code(500).send({ success: false, message: '批量删除失败' })
        }
    })
}
