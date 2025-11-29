// 质检标签管理 API 路由
// 支持无限极分类的标签系统

module.exports = async function (fastify, opts) {
    const pool = fastify.mysql;

    // ==================== 标签分类管理 ====================

    // GET /api/quality/tag-categories - 获取所有标签分类（树形结构）
    fastify.get('/api/quality/tag-categories', async (request, reply) => {
        try {
            const { parent_id, include_inactive } = request.query;

            let query = 'SELECT * FROM tag_categories WHERE 1=1';
            const params = [];

            if (parent_id !== undefined) {
                if (parent_id === 'null' || parent_id === '') {
                    query += ' AND parent_id IS NULL';
                } else {
                    query += ' AND parent_id = ?';
                    params.push(parent_id);
                }
            }

            if (!include_inactive) {
                query += ' AND is_active = 1';
            }

            query += ' ORDER BY sort_order ASC, id ASC';

            const [rows] = await pool.query(query, params);

            // 构建树形结构
            const buildTree = (items, parentId = null) => {
                return items
                    .filter(item => item.parent_id === parentId)
                    .map(item => ({
                        ...item,
                        children: buildTree(items, item.id)
                    }));
            };

            const tree = buildTree(rows);

            return { success: true, data: tree };
        } catch (error) {
            console.error('Error fetching tag categories:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch tag categories.' });
        }
    });

    // GET /api/quality/tag-categories/:id - 获取单个分类详情
    fastify.get('/api/quality/tag-categories/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query('SELECT * FROM tag_categories WHERE id = ?', [id]);
            if (rows.length === 0) {
                return reply.code(404).send({ success: false, message: 'Tag category not found.' });
            }
            return { success: true, data: rows[0] };
        } catch (error) {
            console.error('Error fetching tag category:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch tag category.' });
        }
    });

    // POST /api/quality/tag-categories - 创建标签分类
    fastify.post('/api/quality/tag-categories', async (request, reply) => {
        const { name, description, color, parent_id, sort_order } = request.body;

        if (!name) {
            return reply.code(400).send({ success: false, message: 'Category name is required.' });
        }

        try {
            let level = 0;
            let path = '';

            // 如果有父分类，获取父分类信息
            if (parent_id) {
                const [parentRows] = await pool.query('SELECT level, path FROM tag_categories WHERE id = ?', [parent_id]);
                if (parentRows.length === 0) {
                    return reply.code(400).send({ success: false, message: 'Parent category not found.' });
                }
                level = parentRows[0].level + 1;
            }

            // 插入分类
            const [result] = await pool.query(
                `INSERT INTO tag_categories (name, description, color, parent_id, level, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [name, description, color, parent_id, level, sort_order || 0]
            );

            const newId = result.insertId;

            // 更新路径
            if (parent_id) {
                const [parentRows] = await pool.query('SELECT path FROM tag_categories WHERE id = ?', [parent_id]);
                path = `${parentRows[0].path}/${newId}`;
            } else {
                path = `${newId}`;
            }

            await pool.query('UPDATE tag_categories SET path = ? WHERE id = ?', [path, newId]);

            return { success: true, id: newId, message: 'Tag category created successfully.' };
        } catch (error) {
            console.error('Error creating tag category:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                return reply.code(400).send({ success: false, message: 'Category name already exists.' });
            }
            reply.code(500).send({ success: false, message: 'Failed to create tag category.' });
        }
    });

    // PUT /api/quality/tag-categories/:id - 更新标签分类
    fastify.put('/api/quality/tag-categories/:id', async (request, reply) => {
        const { id } = request.params;
        const { name, description, color, parent_id, sort_order, is_active } = request.body;

        try {
            // 检查分类是否存在
            const [existingRows] = await pool.query('SELECT * FROM tag_categories WHERE id = ?', [id]);
            if (existingRows.length === 0) {
                return reply.code(404).send({ success: false, message: 'Tag category not found.' });
            }

            // 如果修改了父分类，需要重新计算层级和路径
            if (parent_id !== undefined && parent_id !== existingRows[0].parent_id) {
                // 防止将分类设置为自己的子分类
                if (parent_id == id) {
                    return reply.code(400).send({ success: false, message: 'Cannot set category as its own parent.' });
                }

                // 检查是否会形成循环引用
                if (parent_id) {
                    const [parentRows] = await pool.query('SELECT path FROM tag_categories WHERE id = ?', [parent_id]);
                    if (parentRows.length === 0) {
                        return reply.code(400).send({ success: false, message: 'Parent category not found.' });
                    }
                    if (parentRows[0].path && parentRows[0].path.includes(`/${id}/`)) {
                        return reply.code(400).send({ success: false, message: 'Cannot create circular reference.' });
                    }
                }
            }

            // 更新分类
            const [result] = await pool.query(
                `UPDATE tag_categories
                 SET name = ?, description = ?, color = ?, parent_id = ?, sort_order = ?, is_active = ?
                 WHERE id = ?`,
                [name, description, color, parent_id, sort_order, is_active, id]
            );

            // 重新计算层级和路径
            await updateCategoryHierarchy(pool, id);

            return { success: true, message: 'Tag category updated successfully.' };
        } catch (error) {
            console.error('Error updating tag category:', error);
            reply.code(500).send({ success: false, message: 'Failed to update tag category.' });
        }
    });

    // DELETE /api/quality/tag-categories/:id - 删除标签分类
    fastify.delete('/api/quality/tag-categories/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            // 检查是否有子分类
            const [childRows] = await pool.query('SELECT COUNT(*) as count FROM tag_categories WHERE parent_id = ?', [id]);
            if (childRows[0].count > 0) {
                return reply.code(400).send({ success: false, message: 'Cannot delete category with subcategories.' });
            }

            // 检查是否有关联的标签
            const [tagRows] = await pool.query('SELECT COUNT(*) as count FROM tags WHERE category_id = ?', [id]);
            if (tagRows[0].count > 0) {
                return reply.code(400).send({ success: false, message: 'Cannot delete category with associated tags.' });
            }

            const [result] = await pool.query('DELETE FROM tag_categories WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Tag category not found.' });
            }

            return { success: true, message: 'Tag category deleted successfully.' };
        } catch (error) {
            console.error('Error deleting tag category:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete tag category.' });
        }
    });

    // ==================== 标签管理 ====================

    // GET /api/quality/tags - 获取所有标签（支持筛选）
    fastify.get('/api/quality/tags', async (request, reply) => {
        try {
            const { category_id, tag_type, parent_id, include_inactive, search } = request.query;

            let query = `
                SELECT t.*, tc.name as category_name
                FROM tags t
                LEFT JOIN tag_categories tc ON t.category_id = tc.id
                WHERE 1=1
            `;
            const params = [];

            if (category_id) {
                query += ' AND t.category_id = ?';
                params.push(category_id);
            }

            if (tag_type) {
                query += ' AND t.tag_type = ?';
                params.push(tag_type);
            } else {
                // 默认只返回质检标签
                query += ' AND t.tag_type = ?';
                params.push('quality');
            }

            if (parent_id !== undefined) {
                if (parent_id === 'null' || parent_id === '') {
                    query += ' AND t.parent_id IS NULL';
                } else {
                    query += ' AND t.parent_id = ?';
                    params.push(parent_id);
                }
            }

            if (!include_inactive) {
                query += ' AND t.is_active = 1';
            }

            if (search) {
                query += ' AND (t.name LIKE ? OR t.description LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }

            query += ' ORDER BY t.category_id, t.id ASC';

            const [rows] = await pool.query(query, params);

            // 构建树形结构
            const buildTree = (items, parentId = null) => {
                return items
                    .filter(item => item.parent_id === parentId)
                    .map(item => ({
                        ...item,
                        children: buildTree(items, item.id)
                    }));
            };

            const tree = buildTree(rows);

            return { success: true, data: tree };
        } catch (error) {
            console.error('Error fetching tags:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch tags.' });
        }
    });

    // GET /api/quality/tags/:id - 获取单个标签详情
    fastify.get('/api/quality/tags/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query(
                `SELECT t.*, tc.name as category_name
                 FROM tags t
                 LEFT JOIN tag_categories tc ON t.category_id = tc.id
                 WHERE t.id = ?`,
                [id]
            );
            if (rows.length === 0) {
                return reply.code(404).send({ success: false, message: 'Tag not found.' });
            }
            return { success: true, data: rows[0] };
        } catch (error) {
            console.error('Error fetching tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch tag.' });
        }
    });

    // POST /api/quality/tags - 创建标签
    fastify.post('/api/quality/tags', async (request, reply) => {
        const { name, tag_type, category_id, color, description, parent_id } = request.body;

        if (!name) {
            return reply.code(400).send({ success: false, message: 'Tag name is required.' });
        }

        try {
            let level = 0;
            let path = '';
            let finalColor = color;

            // 如果没有提供颜色，自动生成
            if (!finalColor) {
                finalColor = generateDistinctColor();
            }

            // 如果有父标签，获取父标签信息
            if (parent_id) {
                const [parentRows] = await pool.query('SELECT level, path FROM tags WHERE id = ?', [parent_id]);
                if (parentRows.length === 0) {
                    return reply.code(400).send({ success: false, message: 'Parent tag not found.' });
                }
                level = parentRows[0].level + 1;
            }

            // 插入标签
            const [result] = await pool.query(
                `INSERT INTO tags (name, tag_type, category_id, color, description, parent_id, level)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, tag_type || 'quality', category_id, finalColor, description, parent_id, level]
            );

            const newId = result.insertId;

            // 更新路径
            if (parent_id) {
                const [parentRows] = await pool.query('SELECT path FROM tags WHERE id = ?', [parent_id]);
                path = `${parentRows[0].path}/${newId}`;
            } else {
                path = `${newId}`;
            }

            await pool.query('UPDATE tags SET path = ? WHERE id = ?', [path, newId]);

            return { success: true, id: newId, color: finalColor, message: 'Tag created successfully.' };
        } catch (error) {
            console.error('Error creating tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to create tag.' });
        }
    });

    // PUT /api/quality/tags/:id - 更新标签
    fastify.put('/api/quality/tags/:id', async (request, reply) => {
        const { id } = request.params;
        const { name, tag_type, category_id, color, description, parent_id, is_active } = request.body;

        try {
            const [existingRows] = await pool.query('SELECT * FROM tags WHERE id = ?', [id]);
            if (existingRows.length === 0) {
                return reply.code(404).send({ success: false, message: 'Tag not found.' });
            }

            // 如果修改了父标签，检查循环引用
            if (parent_id !== undefined && parent_id !== existingRows[0].parent_id) {
                if (parent_id == id) {
                    return reply.code(400).send({ success: false, message: 'Cannot set tag as its own parent.' });
                }

                if (parent_id) {
                    const [parentRows] = await pool.query('SELECT path FROM tags WHERE id = ?', [parent_id]);
                    if (parentRows.length === 0) {
                        return reply.code(400).send({ success: false, message: 'Parent tag not found.' });
                    }
                    if (parentRows[0].path && parentRows[0].path.includes(`/${id}/`)) {
                        return reply.code(400).send({ success: false, message: 'Cannot create circular reference.' });
                    }
                }
            }

            const [result] = await pool.query(
                `UPDATE tags
                 SET name = ?, tag_type = ?, category_id = ?, color = ?, description = ?, parent_id = ?, is_active = ?
                 WHERE id = ?`,
                [name, tag_type, category_id, color, description, parent_id, is_active, id]
            );

            // 重新计算层级和路径
            await updateTagHierarchy(pool, id);

            return { success: true, message: 'Tag updated successfully.' };
        } catch (error) {
            console.error('Error updating tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to update tag.' });
        }
    });

    // DELETE /api/quality/tags/:id - 删除标签
    fastify.delete('/api/quality/tags/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            // 检查是否有子标签
            const [childRows] = await pool.query('SELECT COUNT(*) as count FROM tags WHERE parent_id = ?', [id]);
            if (childRows[0].count > 0) {
                return reply.code(400).send({ success: false, message: 'Cannot delete tag with sub-tags.' });
            }

            const [result] = await pool.query('DELETE FROM tags WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Tag not found.' });
            }

            return { success: true, message: 'Tag deleted successfully.' };
        } catch (error) {
            console.error('Error deleting tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete tag.' });
        }
    });

    // ==================== 会话标签关联 ====================

    // GET /api/quality/sessions/:id/tags - 获取会话的所有标签
    fastify.get('/api/quality/sessions/:id/tags', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query(
                `SELECT t.*, qst.created_at as associated_at, qst.created_by
                 FROM quality_session_tags qst
                 JOIN tags t ON qst.tag_id = t.id
                 WHERE qst.session_id = ?
                 ORDER BY qst.created_at DESC`,
                [id]
            );
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching session tags:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch session tags.' });
        }
    });

    // POST /api/quality/sessions/:id/tags - 为会话添加标签
    fastify.post('/api/quality/sessions/:id/tags', async (request, reply) => {
        const { id } = request.params;
        const { tag_id, created_by } = request.body;

        if (!tag_id) {
            return reply.code(400).send({ success: false, message: 'Tag ID is required.' });
        }

        try {
            await pool.query(
                `INSERT INTO quality_session_tags (session_id, tag_id, created_by)
                 VALUES (?, ?, ?)`,
                [id, tag_id, created_by]
            );

            // 更新标签使用次数
            await pool.query('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?', [tag_id]);

            return { success: true, message: 'Tag added to session successfully.' };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return reply.code(400).send({ success: false, message: 'Tag already associated with this session.' });
            }
            console.error('Error adding session tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to add session tag.' });
        }
    });

    // DELETE /api/quality/sessions/:id/tags/:tagId - 删除会话标签
    fastify.delete('/api/quality/sessions/:id/tags/:tagId', async (request, reply) => {
        const { id, tagId } = request.params;
        try {
            const [result] = await pool.query(
                'DELETE FROM quality_session_tags WHERE session_id = ? AND tag_id = ?',
                [id, tagId]
            );

            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Tag association not found.' });
            }

            // 更新标签使用次数
            await pool.query('UPDATE tags SET usage_count = usage_count - 1 WHERE id = ? AND usage_count > 0', [tagId]);

            return { success: true, message: 'Tag removed from session successfully.' };
        } catch (error) {
            console.error('Error removing session tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to remove session tag.' });
        }
    });

    // ==================== 消息标签关联 ====================

    // GET /api/quality/messages/:id/tags - 获取消息的所有标签
    fastify.get('/api/quality/messages/:id/tags', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query(
                `SELECT t.*, qmt.created_at as associated_at, qmt.created_by
                 FROM quality_message_tags qmt
                 JOIN tags t ON qmt.tag_id = t.id
                 WHERE qmt.message_id = ?
                 ORDER BY qmt.created_at DESC`,
                [id]
            );
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching message tags:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch message tags.' });
        }
    });

    // POST /api/quality/messages/:id/tags - 为消息添加标签
    fastify.post('/api/quality/messages/:id/tags', async (request, reply) => {
        const { id } = request.params;
        const { tag_id, created_by } = request.body;

        if (!tag_id) {
            return reply.code(400).send({ success: false, message: 'Tag ID is required.' });
        }

        try {
            await pool.query(
                `INSERT INTO quality_message_tags (message_id, tag_id, created_by)
                 VALUES (?, ?, ?)`,
                [id, tag_id, created_by]
            );

            // 更新标签使用次数
            await pool.query('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?', [tag_id]);

            return { success: true, message: 'Tag added to message successfully.' };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return reply.code(400).send({ success: false, message: 'Tag already associated with this message.' });
            }
            console.error('Error adding message tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to add message tag.' });
        }
    });

    // DELETE /api/quality/messages/:id/tags/:tagId - 删除消息标签
    fastify.delete('/api/quality/messages/:id/tags/:tagId', async (request, reply) => {
        const { id, tagId } = request.params;
        try {
            const [result] = await pool.query(
                'DELETE FROM quality_message_tags WHERE message_id = ? AND tag_id = ?',
                [id, tagId]
            );

            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Tag association not found.' });
            }

            // 更新标签使用次数
            await pool.query('UPDATE tags SET usage_count = usage_count - 1 WHERE id = ? AND usage_count > 0', [tagId]);

            return { success: true, message: 'Tag removed from message successfully.' };
        } catch (error) {
            console.error('Error removing message tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to remove message tag.' });
        }
    });
};

// ==================== 辅助函数 ====================

// 更新分类层级和路径
async function updateCategoryHierarchy(pool, categoryId) {
    const [rows] = await pool.query('SELECT parent_id FROM tag_categories WHERE id = ?', [categoryId]);
    if (rows.length === 0) return;

    const parentId = rows[0].parent_id;
    let level = 0;
    let path = '';

    if (parentId) {
        const [parentRows] = await pool.query('SELECT level, path FROM tag_categories WHERE id = ?', [parentId]);
        if (parentRows.length > 0) {
            level = parentRows[0].level + 1;
            path = `${parentRows[0].path}/${categoryId}`;
        }
    } else {
        path = `${categoryId}`;
    }

    await pool.query('UPDATE tag_categories SET level = ?, path = ? WHERE id = ?', [level, path, categoryId]);

    // 递归更新所有子分类
    const [children] = await pool.query('SELECT id FROM tag_categories WHERE parent_id = ?', [categoryId]);
    for (const child of children) {
        await updateCategoryHierarchy(pool, child.id);
    }
}

// 更新标签层级和路径
async function updateTagHierarchy(pool, tagId) {
    const [rows] = await pool.query('SELECT parent_id FROM tags WHERE id = ?', [tagId]);
    if (rows.length === 0) return;

    const parentId = rows[0].parent_id;
    let level = 0;
    let path = '';

    if (parentId) {
        const [parentRows] = await pool.query('SELECT level, path FROM tags WHERE id = ?', [parentId]);
        if (parentRows.length > 0) {
            level = parentRows[0].level + 1;
            path = `${parentRows[0].path}/${tagId}`;
        }
    } else {
        path = `${tagId}`;
    }

    await pool.query('UPDATE tags SET level = ?, path = ? WHERE id = ?', [level, path, tagId]);

    // 递归更新所有子标签
    const [children] = await pool.query('SELECT id FROM tags WHERE parent_id = ?', [tagId]);
    for (const child of children) {
        await updateTagHierarchy(pool, child.id);
    }
}

// 生成区分度高的颜色（HSL色彩空间）
function generateDistinctColor() {
    const goldenRatio = 0.618033988749895;
    const hue = (Math.random() + goldenRatio) % 1;
    const saturation = 0.6 + Math.random() * 0.2; // 60-80%
    const lightness = 0.5 + Math.random() * 0.15; // 50-65%

    return hslToHex(hue * 360, saturation * 100, lightness * 100);
}

// HSL转HEX
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}
