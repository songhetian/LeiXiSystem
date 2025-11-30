const ExcelJS = require('exceljs');
module.exports = async function (fastify, opts) {
    const pool = fastify.mysql;

    // GET /api/platforms - Get all platforms
    fastify.get('/api/platforms', async (request, reply) => {
        try {
            const [rows] = await pool.query('SELECT * FROM platforms ORDER BY name ASC');
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching platforms:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch platforms.' });
        }
    });

    // GET /api/platforms/:id/shops - Get shops for a platform
    fastify.get('/api/platforms/:id/shops', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query('SELECT * FROM shops WHERE platform_id = ? ORDER BY name ASC', [id]);
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching shops:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch shops.' });
        }
    });

    // POST /api/platforms - Create a new platform
    fastify.post('/api/platforms', async (request, reply) => {
        const { name } = request.body;
        if (!name) {
            return reply.code(400).send({ success: false, message: 'Platform name is required.' });
        }
        try {
            const [result] = await pool.query('INSERT INTO platforms (name) VALUES (?)', [name]);
            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error creating platform:', error);
            reply.code(500).send({ success: false, message: 'Failed to create platform.' });
        }
    });

    // PUT /api/platforms/:id - Update a platform
    fastify.put('/api/platforms/:id', async (request, reply) => {
        const { id } = request.params;
        const { name } = request.body;
        if (!name) {
            return reply.code(400).send({ success: false, message: 'Platform name is required.' });
        }
        try {
            const [result] = await pool.query('UPDATE platforms SET name = ? WHERE id = ?', [name, id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Platform not found.' });
            }
            return { success: true, message: 'Platform updated successfully.' };
        } catch (error) {
            console.error('Error updating platform:', error);
            reply.code(500).send({ success: false, message: 'Failed to update platform.' });
        }
    });

    // DELETE /api/platforms/:id - Delete a platform and its shops
    fastify.delete('/api/platforms/:id', async (request, reply) => {
        const { id } = request.params;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // Delete shops associated with the platform
            await connection.query('DELETE FROM shops WHERE platform_id = ?', [id]);
            // Delete the platform
            const [result] = await connection.query('DELETE FROM platforms WHERE id = ?', [id]);
            await connection.commit();

            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Platform not found.' });
            }
            return { success: true, message: 'Platform and associated shops deleted successfully.' };
        } catch (error) {
            await connection.rollback();
            console.error('Error deleting platform:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete platform.' });
        } finally {
            connection.release();
        }
    });

    // POST /api/shops - Create a new shop for a platform
    fastify.post('/api/shops', async (request, reply) => {
        const { name, platform_id } = request.body;
        if (!name || !platform_id) {
            return reply.code(400).send({ success: false, message: 'Shop name and platform ID are required.' });
        }
        try {
            const [result] = await pool.query('INSERT INTO shops (name, platform_id) VALUES (?, ?)', [name, platform_id]);
            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error creating shop:', error);
            reply.code(500).send({ success: false, message: 'Failed to create shop.' });
        }
    });

    // PUT /api/shops/:id - Update a shop
    fastify.put('/api/shops/:id', async (request, reply) => {
        const { id } = request.params;
        const { name } = request.body;
        if (!name) {
            return reply.code(400).send({ success: false, message: 'Shop name is required.' });
        }
        try {
            const [result] = await pool.query('UPDATE shops SET name = ? WHERE id = ?', [name, id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Shop not found.' });
            }
            return { success: true, message: 'Shop updated successfully.' };
        } catch (error) {
            console.error('Error updating shop:', error);
            reply.code(500).send({ success: false, message: 'Failed to update shop.' });
        }
    });

    // DELETE /api/shops/:id - Delete a shop
    fastify.delete('/api/shops/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const [result] = await pool.query('DELETE FROM shops WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Shop not found.' });
            }
            return { success: true, message: 'Shop deleted successfully.' };
        } catch (error) {
            console.error('Error deleting shop:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete shop.' });
        }
    });


    // POST /api/quality/sessions - Create quality session
    fastify.post('/api/quality/sessions', async (request, reply) => {
        const { session_no, agent_id, external_agent_id, agent_name, customer_id, customer_name, channel, platform_id, shop_id, duration, message_count } = request.body;
        try {
            if (!session_no || (!agent_id && !external_agent_id) || !platform_id || !shop_id) {
                return reply.code(400).send({ success: false, message: 'Session no, agent (internal or external), platform, and shop are required.' });
            }

            const [result] = await pool.query(
                `INSERT INTO quality_sessions (session_no, agent_id, external_agent_id, agent_name, customer_id, customer_name, channel, platform_id, shop_id, duration, message_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [session_no, agent_id, external_agent_id, agent_name, customer_id, customer_name, channel, platform_id, shop_id, duration, message_count]
            );
            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error creating quality session:', error);
            reply.code(500).send({ success: false, message: 'Failed to create quality session.' });
        }
    });

    // GET /api/quality/sessions - Get session list (with filtering)
    fastify.get('/api/quality/sessions', async (request, reply) => {
        const { page = 1, pageSize = 10, search = '', customerServiceId, status, channel, startDate, endDate } = request.query;
        const offset = (page - 1) * pageSize;

        let query = `
            SELECT
                qs.id,
                qs.session_no as session_code,
                qs.agent_id,
                qs.external_agent_id,
                qs.agent_name,
                qs.customer_id,
                qs.customer_name,
                qs.channel as communication_channel,
                qs.start_time,
                qs.end_time,
                qs.duration,
                qs.message_count,
                qs.status as quality_status,
                qs.inspector_id,
                qs.score,
                qs.grade,
                qs.comment,
                qs.reviewed_at,
                qs.platform_id,
                qs.shop_id,
                qs.created_at,
                qs.updated_at,
                u.real_name as customer_service_name,
                ea.name as external_agent_name,
                p.name as platform_name,
                s.name as shop_name
            FROM quality_sessions qs
            LEFT JOIN users u ON qs.agent_id = u.id
            LEFT JOIN external_agents ea ON qs.external_agent_id = ea.id
            LEFT JOIN platforms p ON qs.platform_id = p.id
            LEFT JOIN shops s ON qs.shop_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (qs.session_no LIKE ? OR qs.agent_name LIKE ? OR qs.customer_name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (customerServiceId) {
            query += ` AND qs.agent_id = ?`;
            params.push(customerServiceId);
        }
        if (status) {
            query += ` AND qs.status = ?`;
            params.push(status);
        }
        if (channel) {
            query += ` AND qs.channel = ?`;
            params.push(channel);
        }
        if (startDate) {
            query += ` AND qs.created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND qs.created_at <= ?`;
            params.push(endDate);
        }

        try {
            // Build count query
            let countQuery = `
                SELECT COUNT(*) as total
                FROM quality_sessions qs
                LEFT JOIN users u ON qs.agent_id = u.id
                LEFT JOIN external_agents ea ON qs.external_agent_id = ea.id
                WHERE 1=1
            `;

            // Add same filters to count query
            if (search) {
                countQuery += ` AND (qs.session_no LIKE ? OR qs.agent_name LIKE ? OR qs.customer_name LIKE ?)`;
            }
            if (customerServiceId) {
                countQuery += ` AND qs.agent_id = ?`;
            }
            if (status) {
                countQuery += ` AND qs.status = ?`;
            }
            if (channel) {
                countQuery += ` AND qs.channel = ?`;
            }
            if (startDate) {
                countQuery += ` AND qs.created_at >= ?`;
            }
            if (endDate) {
                countQuery += ` AND qs.created_at <= ?`;
            }

            // Get total count
            const [countResult] = await pool.query(countQuery, params);
            const total = countResult[0].total;

            query += ` ORDER BY qs.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(pageSize), parseInt(offset));

            const [rows] = await pool.query(query, params);
            return {
                success: true,
                data: rows,
                pagination: {
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            console.error('Error fetching quality sessions:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch quality sessions.' });
        }
    });

    // GET /api/quality/sessions/:id - Get session details
    fastify.get('/api/quality/sessions/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query(
                `SELECT
                    qs.*,
                    u.real_name as customer_service_name,
                    ea.name as external_agent_name,
                    p.name as platform_name,
                    s.name as shop_name
                FROM quality_sessions qs
                LEFT JOIN users u ON qs.agent_id = u.id
                LEFT JOIN external_agents ea ON qs.external_agent_id = ea.id
                LEFT JOIN platforms p ON qs.platform_id = p.id
                LEFT JOIN shops s ON qs.shop_id = s.id
                WHERE qs.id = ?`,
                [id]
            );
            if (rows.length === 0) {
                return reply.code(404).send({ success: false, message: 'Quality session not found.' });
            }

            // Get session tags
            const [sessionTags] = await pool.query(
                `SELECT t.*, tc.name as category_name, tc.color as category_color
                 FROM quality_session_tags qst
                 JOIN tags t ON qst.tag_id = t.id
                 LEFT JOIN tag_categories tc ON t.category_id = tc.id
                 WHERE qst.session_id = ?`,
                [id]
            );

            const sessionData = rows[0];
            sessionData.tags = sessionTags;

            return { success: true, data: sessionData };
        } catch (error) {
            console.error('Error fetching quality session details:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch quality session details.' });
        }
    });

    // PUT /api/quality/sessions/:id - Update session information
    fastify.put('/api/quality/sessions/:id', async (request, reply) => {
        const { id } = request.params;
        const updates = request.body;

        // Remove fields that shouldn't be updated directly or are undefined
        const allowedFields = [
            'session_no', 'agent_id', 'external_agent_id', 'agent_name',
            'customer_id', 'customer_name', 'channel', 'duration',
            'message_count', 'status', 'score', 'grade'
        ];

        const fieldsToUpdate = [];
        const values = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                fieldsToUpdate.push(`${field} = ?`);
                values.push(updates[field]);
            }
        }

        if (fieldsToUpdate.length === 0) {
            return reply.code(400).send({ success: false, message: 'No valid fields to update.' });
        }

        values.push(id);

        try {
            const [result] = await pool.query(
                `UPDATE quality_sessions SET ${fieldsToUpdate.join(', ')} WHERE id = ?`,
                values
            );

            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality session not found.' });
            }
            return { success: true, message: 'Quality session updated successfully.' };
        } catch (error) {
            console.error('Error updating quality session:', error);
            reply.code(500).send({ success: false, message: 'Failed to update quality session.' });
        }
    });

    // DELETE /api/quality/sessions/:id - Delete session
    fastify.delete('/api/quality/sessions/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const [result] = await pool.query('DELETE FROM quality_sessions WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality session not found.' });
            }
            return { success: true, message: 'Quality session deleted successfully.' };
        } catch (error) {
            console.error('Error deleting quality session:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete quality session.' });
        }
    });

    // GET /api/quality/sessions/:id/messages - Get session messages
    fastify.get('/api/quality/sessions/:id/messages', async (request, reply) => {
        const { id } = request.params;
        try {
            // Fetch messages
            const [messages] = await pool.query(
                'SELECT * FROM session_messages WHERE session_id = ? ORDER BY timestamp ASC',
                [id]
            );

            if (messages.length === 0) {
                return { success: true, data: [] };
            }

            // Fetch tags for these messages
            const messageIds = messages.map(m => m.id);
            if (messageIds.length > 0) {
                const [tags] = await pool.query(
                    `SELECT qmt.message_id, t.* 
                     FROM quality_message_tags qmt
                     JOIN quality_tags t ON qmt.tag_id = t.id
                     WHERE qmt.message_id IN (?)`,
                    [messageIds]
                );

                // Attach tags to messages
                const tagMap = {};
                tags.forEach(tag => {
                    if (!tagMap[tag.message_id]) {
                        tagMap[tag.message_id] = [];
                    }
                    tagMap[tag.message_id].push(tag);
                });

                messages.forEach(msg => {
                    msg.tags = tagMap[msg.id] || [];
                });
            }

            return { success: true, data: messages };
        } catch (error) {
            console.error('Error fetching session messages:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch session messages.' });
        }
    });

    // PUT /api/quality/messages/:id - Update message content
    fastify.put('/api/quality/messages/:id', async (request, reply) => {
        const { id } = request.params;
        const { content } = request.body;

        if (!content) {
            return reply.code(400).send({ success: false, message: 'Message content is required.' });
        }

        try {
            const [result] = await pool.query(
                'UPDATE session_messages SET content = ? WHERE id = ?',
                [content, id]
            );

            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Message not found.' });
            }

            return { success: true, message: 'Message updated successfully.' };
        } catch (error) {
            console.error('Error updating message:', error);
            reply.code(500).send({ success: false, message: 'Failed to update message.' });
        }
    });

    // POST /api/quality/sessions/:id/review - Submit quality review
    fastify.post('/api/quality/sessions/:id/review', async (request, reply) => {
        const { id } = request.params;
        const { score, grade, rule_scores, comment, session_tags, message_tags } = request.body;

        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // Update overall session score, grade, and comment
                const [sessionUpdateResult] = await connection.query(
                    `UPDATE quality_sessions SET
                        status = 'completed',
                        score = ?,
                        grade = ?,
                        comment = ?,
                        reviewed_at = NOW()
                     WHERE id = ?`,
                    [score, grade, comment, id]
                );

                if (sessionUpdateResult.affectedRows === 0) {
                    await connection.rollback();
                    connection.release();
                    return reply.code(404).send({ success: false, message: 'Quality session not found.' });
                }

                // Fetch all active rules to get their score weights (max_score)
                const [rules] = await connection.query('SELECT id, score_weight FROM quality_rules WHERE is_active = 1');
                const ruleMap = new Map();
                rules.forEach(rule => ruleMap.set(rule.id, rule.score_weight));

                // Insert individual rule scores
                if (rule_scores && Array.isArray(rule_scores)) {
                    // Validate that all rule_ids exist
                    const invalidRules = [];
                    for (const rs of rule_scores) {
                        if (!ruleMap.has(rs.rule_id)) {
                            invalidRules.push(rs.rule_id);
                        }
                    }

                    if (invalidRules.length > 0) {
                        await connection.rollback();
                        connection.release();
                        return reply.code(400).send({
                            success: false,
                            message: `Invalid rule IDs: ${invalidRules.join(', ')}. Available rule IDs: ${Array.from(ruleMap.keys()).join(', ')}`
                        });
                    }

                    for (const rs of rule_scores) {
                        const maxScore = ruleMap.get(rs.rule_id) || null;
                        await connection.query(
                            `INSERT INTO quality_scores (session_id, rule_id, score, max_score, comment)
                             VALUES (?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE score = VALUES(score), max_score = VALUES(max_score), comment = VALUES(comment)`,
                            [id, rs.rule_id, rs.score, maxScore, rs.comment]
                        );
                    }
                }

                // Save session tags
                if (session_tags && Array.isArray(session_tags)) {
                    // First, remove existing tags
                    await connection.query('DELETE FROM quality_session_tags WHERE session_id = ?', [id]);

                    // Insert new tags
                    for (const tag of session_tags) {
                        // Handle both full tag object and just ID
                        const tagId = tag.id || tag;
                        if (tagId) {
                            await connection.query(
                                'INSERT IGNORE INTO quality_session_tags (session_id, tag_id) VALUES (?, ?)',
                                [id, tagId]
                            );
                        }
                    }
                }

                // Save message tags
                if (message_tags && Array.isArray(message_tags)) {
                    // First, remove existing message tags for this session
                    await connection.query(
                        `DELETE qmt 
                         FROM quality_message_tags qmt 
                         JOIN session_messages sm ON qmt.message_id = sm.id 
                         WHERE sm.session_id = ?`,
                        [id]
                    );

                    // Insert new message tags
                    for (const tag of message_tags) {
                        if (tag.messageId && tag.tagId) {
                            await connection.query(
                                'INSERT IGNORE INTO quality_message_tags (message_id, tag_id) VALUES (?, ?)',
                                [tag.messageId, tag.tagId]
                            );
                        }
                    }
                }

                await connection.commit();
                connection.release();
                return { success: true, message: 'Quality review submitted successfully.' };
            } catch (error) {
                await connection.rollback();
                connection.release();
                throw error;
            }
        } catch (error) {
            console.error('Error submitting quality review:', error);
            reply.code(500).send({ success: false, message: 'Failed to submit quality review.' });
        }
    });

    // POST /api/quality/rules - Create quality rule
    fastify.post('/api/quality/rules', async (request, reply) => {
        const { rule_name, category, scoring_standard, weight, is_enabled } = request.body;
        try {
            if (!rule_name) {
                return reply.code(400).send({ success: false, message: 'Rule name is required.' });
            }

            const [result] = await pool.query(
                `INSERT INTO quality_rules (rule_name, category, scoring_standard, weight, is_enabled)
                 VALUES (?, ?, ?, ?, ?)`,
                [rule_name, category, JSON.stringify(scoring_standard), weight, is_enabled]
            );
            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error creating quality rule:', error);
            reply.code(500).send({ success: false, message: 'Failed to create quality rule.' });
        }
    });

    // GET /api/quality/rules - Get rule list
    fastify.get('/api/quality/rules', async (request, reply) => {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM quality_rules ORDER BY created_at DESC'
            );
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching quality rules:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch quality rules.' });
        }
    });

    // GET /api/quality/rules/:id - Get rule details
    fastify.get('/api/quality/rules/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query(
                'SELECT * FROM quality_rules WHERE id = ?',
                [id]
            );
            if (rows.length === 0) {
                return reply.code(404).send({ success: false, message: 'Quality rule not found.' });
            }
            return { success: true, data: rows[0] };
        } catch (error) {
            console.error('Error fetching quality rule details:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch quality rule details.' });
        }
    });

    // PUT /api/quality/rules/:id - Update rule
    fastify.put('/api/quality/rules/:id', async (request, reply) => {
        const { id } = request.params;
        const { rule_name, category, scoring_standard, weight, is_enabled } = request.body;
        try {
            const [result] = await pool.query(
                `UPDATE quality_rules SET
                    rule_name = ?,
                    category = ?,
                    scoring_standard = ?,
                    weight = ?,
                    is_enabled = ?
                 WHERE id = ?`,
                [rule_name, category, JSON.stringify(scoring_standard), weight, is_enabled, id]
            );
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality rule not found.' });
            }
            return { success: true, message: 'Quality rule updated successfully.' };
        } catch (error) {
            console.error('Error updating quality rule:', error);
            reply.code(500).send({ success: false, message: 'Failed to update quality rule.' });
        }
    });

    // DELETE /api/quality/rules/:id - Delete rule
    fastify.delete('/api/quality/rules/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const [result] = await pool.query('DELETE FROM quality_rules WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality rule not found.' });
            }
            return { success: true, message: 'Quality rule deleted successfully.' };
        } catch (error) {
            console.error('Error deleting rule:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete rule.' });
        }
    });

    // PUT /api/quality/rules/:id/toggle - Enable/disable rule
    fastify.put('/api/quality/rules/:id/toggle', async (request, reply) => {
        const { id } = request.params;
        const { is_enabled } = request.body;
        try {
            const [result] = await pool.query(
                'UPDATE quality_rules SET is_enabled = ? WHERE id = ?',
                [is_enabled, id]
            );
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality rule not found.' });
            }
            return { success: true, message: 'Quality rule status updated successfully.' };
        } catch (error) {
            console.error('Error toggling quality rule status:', error);
            reply.code(500).send({ success: false, message: 'Failed to toggle quality rule status.' });
        }
    });

    // POST /api/quality/scores - Submit score
    fastify.post('/api/quality/scores', async (request, reply) => {
        const { session_id, rule_id, score, comment } = request.body;
        try {
            if (!session_id || !rule_id || score === undefined) {
                return reply.code(400).send({ success: false, message: 'Session ID, Rule ID, and Score are required.' });
            }

            const [result] = await pool.query(
                `INSERT INTO quality_scores (session_id, rule_id, score, comment)
                 VALUES (?, ?, ?, ?)`,
                [session_id, rule_id, score, comment]
            );
            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error submitting quality score:', error);
            reply.code(500).send({ success: false, message: 'Failed to submit quality score.' });
        }
    });

    // GET /api/quality/scores - Get score list
    fastify.get('/api/quality/scores', async (request, reply) => {
        const { page = 1, pageSize = 10, session_id, rule_id } = request.query;
        const offset = (page - 1) * pageSize;

        let query = `
            SELECT
                qs.*,
                qr.rule_name,
                qsess.session_code
            FROM quality_scores qs
            LEFT JOIN quality_rules qr ON qs.rule_id = qr.id
            LEFT JOIN quality_sessions qsess ON qs.session_id = qsess.id
            WHERE 1=1
        `;
        const params = [];

        if (session_id) {
            query += ` AND qs.session_id = ?`;
            params.push(session_id);
        }
        if (rule_id) {
            query += ` AND qs.rule_id = ?`;
            params.push(rule_id);
        }

        // Get total count
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM quality_scores qs LEFT JOIN quality_rules qr ON qs.rule_id = qr.id LEFT JOIN quality_sessions qsess ON qs.session_id = qsess.id WHERE 1=1 ${query.split('WHERE 1=1')[1]}`, params);
        const total = countResult[0].total;

        query += ` ORDER BY qs.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(pageSize), parseInt(offset));

        try {
            const [rows] = await pool.query(query, params);
            return {
                success: true,
                data: rows,
                pagination: {
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            console.error('Error fetching quality scores:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch quality scores.' });
        }
    });

    // GET /api/quality/sessions/:id/scores - Get session score details
    fastify.get('/api/quality/sessions/:id/scores', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query(
                `SELECT
                    qs.*,
                    qr.rule_name
                FROM quality_scores qs
                LEFT JOIN quality_rules qr ON qs.rule_id = qr.id
                WHERE qs.session_id = ?
                ORDER BY qr.rule_name ASC`,
                [id]
            );
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching session scores:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch session scores.' });
        }
    });

    // PUT /api/quality/scores/:id - Modify score
    fastify.put('/api/quality/scores/:id', async (request, reply) => {
        const { id } = request.params;
        const { score, comment } = request.body;
        try {
            const [result] = await pool.query(
                `UPDATE quality_scores SET
                    score = ?,
                    comment = ?
                 WHERE id = ?`,
                [score, comment, id]
            );
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality score not found.' });
            }
            return { success: true, message: 'Quality score updated successfully.' };
        } catch (error) {
            console.error('Error updating quality score:', error);
            reply.code(500).send({ success: false, message: 'Failed to update quality score.' });
        }
    });

    // GET /api/quality/statistics - Quality statistics data
    fastify.get('/api/quality/statistics', async (request, reply) => {
        try {
            // Total sessions
            const [totalSessionsResult] = await pool.query('SELECT COUNT(*) as total FROM quality_sessions');
            const totalSessions = totalSessionsResult[0].total;

            // Average score
            const [avgScoreResult] = await pool.query('SELECT AVG(score) as average FROM quality_sessions WHERE score IS NOT NULL');
            const averageScore = avgScoreResult[0].average || 0;

            // Sessions by status
            const [statusDistribution] = await pool.query('SELECT status as quality_status, COUNT(*) as count FROM quality_sessions GROUP BY status');

            // Top N customer service by average score (example)
            const [topCustomerService] = await pool.query(`
                SELECT
                    COALESCE(u.real_name, ea.name, qs.agent_name) as customer_service_name,
                    AVG(qs.score) as average_score,
                    COUNT(qs.id) as total_sessions
                FROM quality_sessions qs
                LEFT JOIN users u ON qs.agent_id = u.id
                LEFT JOIN external_agents ea ON qs.external_agent_id = ea.id
                WHERE qs.score IS NOT NULL
                GROUP BY COALESCE(u.real_name, ea.name, qs.agent_name)
                ORDER BY average_score DESC
                LIMIT 5
            `);

            return {
                success: true,
                data: {
                    totalSessions,
                    averageScore,
                    statusDistribution,
                    topCustomerService
                }
            };
        } catch (error) {
            console.error('Error fetching quality statistics:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch quality statistics.' });
        }
    });

    // POST /api/quality/cases/:id/like - Like case
    fastify.post('/api/quality/cases/:id/like', async (request, reply) => {
        const { id } = request.params;
        try {
            const [result] = await pool.query(
                'UPDATE quality_cases SET likes = likes + 1 WHERE id = ?',
                [id]
            );
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality case not found.' });
            }
            return { success: true, message: 'Case liked successfully.' };
        } catch (error) {
            console.error('Error liking quality case:', error);
            reply.code(500).send({ success: false, message: 'Failed to like quality case.' });
        }
    });

    // POST /api/quality/cases/:id/view - Record view
    fastify.post('/api/quality/cases/:id/view', async (request, reply) => {
        const { id } = request.params;
        try {
            const [result] = await pool.query(
                'UPDATE quality_cases SET views = views + 1 WHERE id = ?',
                [id]
            );
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality case not found.' });
            }
            return { success: true, message: 'Case view recorded successfully.' };
        } catch (error) {
            console.error('Error recording quality case view:', error);
            reply.code(500).send({ success: false, message: 'Failed to record quality case view.' });
        }
    });


    // POST /api/quality/cases - Create case
    fastify.post('/api/quality/cases', async (request, reply) => {
        const { title, category, description, problem_description, solution, is_excellent, difficulty_level, priority, session_id } = request.body;
        try {
            if (!title || !category || !problem_description || !solution) {
                return reply.code(400).send({ success: false, message: 'Title, category, problem description, and solution are required.' });
            }

            const [result] = await pool.query(
                `INSERT INTO quality_cases (title, category, description, problem_description, solution, is_excellent, difficulty_level, priority, session_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, category, description, problem_description, solution, is_excellent, difficulty_level, priority, session_id]
            );
            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error creating quality case:', error);
            reply.code(500).send({ success: false, message: 'Failed to create quality case.' });
        }
    });


    // GET /api/quality/cases - Get case list (with filtering)
    fastify.get('/api/quality/cases', async (request, reply) => {
        const { page = 1, pageSize = 10, search = '', category, difficulty, tag, sortBy = 'created_at', sortOrder = 'desc' } = request.query;
        const offset = (page - 1) * pageSize;

        let query = `
            SELECT
                qc.*,
                qs.session_no as session_code
            FROM quality_cases qc
            LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (qc.title LIKE ? OR qc.description LIKE ? OR qc.problem_description LIKE ? OR qc.solution LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (category) {
            query += ` AND qc.category = ?`;
            params.push(category);
        }
        if (difficulty) {
            query += ` AND qc.difficulty_level = ?`;
            params.push(difficulty);
        }
        // Tag filtering would require joining with case_tags and tags tables, which is more complex.
        // For now, we'll skip direct tag filtering in the main query to keep it simpler.

        // Get total count
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM quality_cases qc LEFT JOIN quality_sessions qs ON qc.session_id = qs.id WHERE 1=1 ${query.split('WHERE 1=1')[1]}`, params);
        const total = countResult[0].total;

        query += ` ORDER BY qc.${sortBy} ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`;
        params.push(parseInt(pageSize), parseInt(offset));

        try {
            const [rows] = await pool.query(query, params);
            return {
                success: true,
                data: rows,
                pagination: {
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            console.error('Error fetching quality cases:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch quality cases.' });
        }
    });


    // GET /api/quality/cases/:id - Get case details
    fastify.get('/api/quality/cases/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query(
                `SELECT
                    qc.*,
                    qs.session_code
                FROM quality_cases qc
                LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
                WHERE qc.id = ?`,
                [id]
            );
            if (rows.length === 0) {
                return reply.code(404).send({ success: false, message: 'Quality case not found.' });
            }
            return { success: true, data: rows[0] };
        } catch (error) {
            console.error('Error fetching quality case details:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch quality case details.' });
        }
    });


    // PUT /api/quality/cases/:id - Update case
    fastify.put('/api/quality/cases/:id', async (request, reply) => {
        const { id } = request.params;
        const { title, category, description, problem_description, solution, is_excellent, difficulty_level, priority, session_id } = request.body;
        try {
            const [result] = await pool.query(
                `UPDATE quality_cases SET
                    title = ?,
                    category = ?,
                    description = ?,
                    problem_description = ?,
                    solution = ?,
                    is_excellent = ?,
                    difficulty_level = ?,
                    priority = ?,
                    session_id = ?
                 WHERE id = ?`,
                [title, category, description, problem_description, solution, is_excellent, difficulty_level, priority, session_id, id]
            );
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality case not found.' });
            }
            return { success: true, message: 'Quality case updated successfully.' };
        } catch (error) {
            console.error('Error updating quality case:', error);
            reply.code(500).send({ success: false, message: 'Failed to update quality case.' });
        }
    });


    // POST /api/quality/cases/:id/comments - Add comment
    fastify.post('/api/quality/cases/:id/comments', async (request, reply) => {
        const { id } = request.params; // case_id
        const { user_id, comment_text } = request.body;
        try {
            if (!user_id || !comment_text) {
                return reply.code(400).send({ success: false, message: 'User ID and comment text are required.' });
            }

            const [result] = await pool.query(
                `INSERT INTO case_comments (case_id, user_id, comment_text)
                 VALUES (?, ?, ?)`,
                [id, user_id, comment_text]
            );
            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error adding comment to quality case:', error);
            reply.code(500).send({ success: false, message: 'Failed to add comment to quality case.' });
        }
    });


    // GET /api/quality/cases/:id/comments - Get comment list
    fastify.get('/api/quality/cases/:id/comments', async (request, reply) => {
        const { id } = request.params; // case_id
        try {
            const [rows] = await pool.query(
                `SELECT cc.*, u.real_name as user_name
                 FROM case_comments cc
                 LEFT JOIN users u ON cc.user_id = u.id
                 WHERE cc.case_id = ?
                 ORDER BY cc.created_at DESC`,
                [id]
            );
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching comments for quality case:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch comments for quality case.' });
        }
    });


    // PUT /api/quality/comments/:id - Modify comment
    fastify.put('/api/quality/comments/:id', async (request, reply) => {
        const { id } = request.params; // comment_id
        const { comment_content } = request.body;
        try {
            const [result] = await pool.query(
                `UPDATE case_comments SET
                    comment_content = ?
                 WHERE id = ?`,
                [comment_content, id]
            );
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Comment not found.' });
            }
            return { success: true, message: 'Comment updated successfully.' };
        } catch (error) {
            console.error('Error updating comment:', error);
            reply.code(500).send({ success: false, message: 'Failed to update comment.' });
        }
    });


    // DELETE /api/quality/comments/:id - Delete comment
    fastify.delete('/api/quality/comments/:id', async (request, reply) => {
        const { id } = request.params; // comment_id
        try {
            const [result] = await pool.query('DELETE FROM case_comments WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Comment not found.' });
            }
            return { success: true, message: 'Comment deleted successfully.' };
        } catch (error) {
            console.error('Error deleting comment:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete comment.' });
        }
    });


    // POST /api/quality/comments/:id/like - Like comment
    fastify.post('/api/quality/comments/:id/like', async (request, reply) => {
        const { id } = request.params; // comment_id
        try {
            const [result] = await pool.query(
                'UPDATE case_comments SET likes = likes + 1 WHERE id = ?',
                [id]
            );
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Comment not found.' });
            }
            return { success: true, message: 'Comment liked successfully.' };
        } catch (error) {
            console.error('Error liking comment:', error);
            reply.code(500).send({ success: false, message: 'Failed to like comment.' });
        }
    });


    // POST /api/quality/cases/:id/attachments - Upload attachment
    fastify.post('/api/quality/cases/:id/attachments', async (request, reply) => {
        const { id } = request.params; // case_id
        const { file_name, file_type, file_size, file_url } = request.body; // Assuming metadata is sent in body for simplicity
        try {
            if (!file_name || !file_type || !file_url) {
                return reply.code(400).send({ success: false, message: 'File name, type, and URL are required.' });
            }

            const [result] = await pool.query(
                `INSERT INTO case_attachments (case_id, file_name, file_type, file_size, file_url)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, file_name, file_type, file_size, file_url]
            );
            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error uploading attachment:', error);
            reply.code(500).send({ success: false, message: 'Failed to upload attachment.' });
        }
    });


    // GET /api/quality/cases/:id/attachments - Get attachment list
    fastify.get('/api/quality/cases/:id/attachments', async (request, reply) => {
        const { id } = request.params; // case_id
        try {
            const [rows] = await pool.query(
                `SELECT * FROM case_attachments WHERE case_id = ? ORDER BY uploaded_at DESC`,
                [id]
            );
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching attachments for quality case:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch attachments for quality case.' });
        }
    });


    // DELETE /api/quality/attachments/:id - Delete attachment
    fastify.delete('/api/quality/attachments/:id', async (request, reply) => {
        const { id } = request.params; // attachment_id
        try {
            const [result] = await pool.query('DELETE FROM case_attachments WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Attachment not found.' });
            }
            return { success: true, message: 'Attachment deleted successfully.' };
        } catch (error) {
            console.error('Error deleting attachment:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete attachment.' });
        }
    });

    // GET /api/quality/attachments/:id/download - Download attachment
    fastify.get('/api/quality/attachments/:id/download', async (request, reply) => {
        const { id } = request.params; // attachment_id
        try {
            const [rows] = await pool.query(
                `SELECT file_url, file_name FROM case_attachments WHERE id = ?`,
                [id]
            );
            if (rows.length === 0) {
                return reply.code(404).send({ success: false, message: 'Attachment not found.' });
            }
            const attachment = rows[0];
            // In a real application, you would stream the file from storage (e.g., S3, local disk)
            // For this example, we'll just redirect to the file_url or return it.
            reply.redirect(attachment.file_url); // Or reply.send({ file_url: attachment.file_url, file_name: attachment.file_name });
        } catch (error) {
            console.error('Error downloading attachment:', error);
            reply.code(500).send({ success: false, message: 'Failed to download attachment.' });
        }
    });



    // POST /api/quality/cases/:id/favorite - Add case to favorites
    fastify.post('/api/quality/cases/:id/favorite', async (request, reply) => {
        const { id: case_id } = request.params;
        const { user_id } = request.body; // Assuming user_id is sent in body or obtained from auth
        try {
            if (!user_id) {
                return reply.code(400).send({ success: false, message: 'User ID is required.' });
            }
            const [result] = await pool.query(
                `INSERT INTO user_case_favorites (user_id, case_id)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE created_at = created_at`, // Do nothing if already exists
                [user_id, case_id]
            );
            return { success: true, message: 'Case added to favorites.' };
        } catch (error) {
            console.error('Error adding case to favorites:', error);
            reply.code(500).send({ success: false, message: 'Failed to add case to favorites.' });
        }
    });

    // DELETE /api/quality/cases/:id/favorite - Remove case from favorites
    fastify.delete('/api/quality/cases/:id/favorite', async (request, reply) => {
        const { id: case_id } = request.params;
        const { user_id } = request.body; // Assuming user_id is sent in body or obtained from auth
        try {
            if (!user_id) {
                return reply.code(400).send({ success: false, message: 'User ID is required.' });
            }
            const [result] = await pool.query(
                'DELETE FROM user_case_favorites WHERE user_id = ? AND case_id = ?',
                [user_id, case_id]
            );
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Favorite not found or already removed.' });
            }
            return { success: true, message: 'Case removed from favorites.' };
        } catch (error) {
            console.error('Error removing case from favorites:', error);
            reply.code(500).send({ success: false, message: 'Failed to remove case from favorites.' });
        }
    });

    // GET /api/quality/users/:userId/favorites - Get user's favorite cases
    fastify.get('/api/quality/users/:userId/favorites', async (request, reply) => {
        const { userId } = request.params;
        const { page = 1, pageSize = 10, search = '', category, difficulty } = request.query;
        const offset = (page - 1) * pageSize;

        let query = `
            SELECT
                qc.*,
                qs.session_no as session_code,
                ucf.created_at as favorited_at
            FROM quality_case_favorites ucf
            JOIN quality_cases qc ON ucf.case_id = qc.id
            LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
            WHERE ucf.user_id = ?
        `;
        const params = [userId];

        if (search) {
            query += ` AND (qc.title LIKE ? OR qc.description LIKE ? OR qc.problem_description LIKE ? OR qc.solution LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (category) {
            query += ` AND qc.category = ?`;
            params.push(category);
        }
        if (difficulty) {
            query += ` AND qc.difficulty_level = ?`;
            params.push(difficulty);
        }

        // Get total count
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM quality_case_favorites ucf JOIN quality_cases qc ON ucf.case_id = qc.id WHERE ucf.user_id = ? ${query.split('WHERE ucf.user_id = ?')[1]}`, params);
        const total = countResult[0].total;

        query += ` ORDER BY ucf.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(pageSize), parseInt(offset));

        try {
            const [rows] = await pool.query(query, params);
            return {
                success: true,
                data: rows,
                pagination: {
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            console.error('Error fetching user favorite cases:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch user favorite cases.' });
        }
    });

    // POST /api/quality/cases/:id/learn/start - Record start of learning for a case
    fastify.post('/api/quality/cases/:id/learn/start', async (request, reply) => {
        const { id: case_id } = request.params;
        const { user_id } = request.body;
        try {
            if (!user_id) {
                return reply.code(400).send({ success: false, message: 'User ID is required.' });
            }
            // Check if an active learning session already exists for this user and case
            const [existingRecord] = await pool.query(
                'SELECT id FROM case_learning_records WHERE user_id = ? AND case_id = ? AND end_time IS NULL',
                [user_id, case_id]
            );

            if (existingRecord.length > 0) {
                return reply.code(200).send({ success: true, message: 'Learning session already active.', id: existingRecord[0].id });
            }

            const [result] = await pool.query(
                `INSERT INTO case_learning_records (user_id, case_id, start_time)
                 VALUES (?, ?, NOW())`,
                [user_id, case_id]
            );
            return { success: true, id: result.insertId, message: 'Learning session started.' };
        } catch (error) {
            console.error('Error starting learning session:', error);
            reply.code(500).send({ success: false, message: 'Failed to start learning session.' });
        }
    });

    // PUT /api/quality/cases/:id/learn/end - Record end of learning for a case
    fastify.put('/api/quality/cases/:id/learn/end', async (request, reply) => {
        const { id: case_id } = request.params;
        const { user_id, progress_percentage } = request.body;
        try {
            if (!user_id) {
                return reply.code(400).send({ success: false, message: 'User ID is required.' });
            }

            const [record] = await pool.query(
                'SELECT id, start_time FROM case_learning_records WHERE user_id = ? AND case_id = ? AND end_time IS NULL',
                [user_id, case_id]
            );

            if (record.length === 0) {
                return reply.code(404).send({ success: false, message: 'Active learning session not found for this case and user.' });
            }

            const learningRecordId = record[0].id;
            const startTime = record[0].start_time;
            const endTime = new Date();
            const durationSeconds = Math.floor((endTime.getTime() - new Date(startTime).getTime()) / 1000);

            const [result] = await pool.query(
                `UPDATE case_learning_records SET
                    end_time = ?,
                    duration_seconds = ?,
                    progress_percentage = ?
                 WHERE id = ?`,
                [endTime, durationSeconds, progress_percentage || 100, learningRecordId]
            );
            return { success: true, message: 'Learning session ended and updated.' };
        } catch (error) {
            console.error('Error ending learning session:', error);
            reply.code(500).send({ success: false, message: 'Failed to end learning session.' });
        }
    });

    // GET /api/quality/users/:userId/learning-records - Get user's learning records
    fastify.get('/api/quality/users/:userId/learning-records', async (request, reply) => {
        const { userId } = request.params;
        const { page = 1, pageSize = 10, search = '', category, difficulty } = request.query;
        const offset = (page - 1) * pageSize;

        let query = `
            SELECT
                clr.*,
                qc.title,
                qc.category,
                qc.difficulty_level,
                qc.description
            FROM case_learning_records clr
            JOIN quality_cases qc ON clr.case_id = qc.id
            WHERE clr.user_id = ?
        `;
        const params = [userId];

        if (search) {
            query += ` AND (qc.title LIKE ? OR qc.description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (category) {
            query += ` AND qc.category = ?`;
            params.push(category);
        }
        if (difficulty) {
            query += ` AND qc.difficulty_level = ?`;
            params.push(difficulty);
        }

        // Get total count
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM case_learning_records clr JOIN quality_cases qc ON clr.case_id = qc.id WHERE clr.user_id = ? ${query.split('WHERE clr.user_id = ?')[1]}`, params);
        const total = countResult[0].total;

        query += ` ORDER BY clr.updated_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(pageSize), parseInt(offset));

        try {
            const [rows] = await pool.query(query, params);
            return {
                success: true,
                data: rows,
                pagination: {
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            console.error('Error fetching user learning records:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch user learning records.' });
        }
    });

    // Helper function to convert array of objects to CSV string
    const convertToCsv = (data) => {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','), // Header row
            ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName])).join(',')) // Data rows
        ];
        return csvRows.join('\n');
    };

    // GET /api/quality/export/sessions - Export quality session data
    fastify.get('/api/quality/export/sessions', async (request, reply) => {
        try {
            const [rows] = await pool.query(`
                SELECT
                    qs.id,
                    qs.session_no,
                    COALESCE(u.real_name, ea.name, qs.agent_name) as customer_service_name,
                    qs.customer_id,
                    qs.customer_name,
                    qs.channel,
                    qs.duration,
                    qs.message_count,
                    qs.status,
                    qs.score,
                    qs.grade,
                    qs.created_at,
                    qs.updated_at
                FROM quality_sessions qs
                LEFT JOIN users u ON qs.agent_id = u.id
                LEFT JOIN external_agents ea ON qs.external_agent_id = ea.id
                ORDER BY qs.created_at DESC
            `);

            const csv = convertToCsv(rows);
            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', 'attachment; filename="quality_sessions.csv"');
            return reply.send(csv);
        } catch (error) {
            console.error('Error exporting quality sessions:', error);
            reply.code(500).send({ success: false, message: 'Failed to export quality sessions.' });
        }
    });

    // GET /api/quality/export/cases - Export quality case data
    fastify.get('/api/quality/export/cases', async (request, reply) => {
        try {
            const [rows] = await pool.query(`
                SELECT
                    qc.id,
                    qc.title,
                    qc.category,
                    qc.description,
                    qc.problem_description,
                    qc.solution,
                    qc.is_excellent,
                    qc.difficulty_level,
                    qc.priority,
                    qc.session_id,
                    qc.views,
                    qc.likes,
                    qc.created_at,
                    qc.updated_at
                FROM quality_cases qc
                ORDER BY qc.created_at DESC
            `);

            const csv = convertToCsv(rows);
            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', 'attachment; filename="quality_cases.csv"');
            return reply.send(csv);
        } catch (error) {
            console.error('Error exporting quality cases:', error);
            reply.code(500).send({ success: false, message: 'Failed to export quality cases.' });
        }
    });

    // GET /api/quality/reports/summary - Generate summary quality report
    fastify.get('/api/quality/reports/summary', async (request, reply) => {
        try {
            // Total sessions
            const [totalSessionsResult] = await pool.query('SELECT COUNT(*) as total FROM quality_sessions');
            const totalSessions = totalSessionsResult[0].total;

            // Average score
            const [avgScoreResult] = await pool.query('SELECT AVG(score) as average FROM quality_sessions WHERE score IS NOT NULL');
            const averageScore = avgScoreResult[0].average || 0;

            // Sessions by status
            const [statusDistribution] = await pool.query('SELECT status as quality_status, COUNT(*) as count FROM quality_sessions GROUP BY status');

            // Top N customer service by average score
            const [topCustomerService] = await pool.query(`
                SELECT
                    COALESCE(u.real_name, ea.name, qs.agent_name) as customer_service_name,
                    AVG(qs.score) as average_score,
                    COUNT(qs.id) as total_sessions
                FROM quality_sessions qs
                LEFT JOIN users u ON qs.agent_id = u.id
                LEFT JOIN external_agents ea ON qs.external_agent_id = ea.id
                WHERE qs.score IS NOT NULL
                GROUP BY COALESCE(u.real_name, ea.name, qs.agent_name)
                ORDER BY average_score DESC
                LIMIT 5
            `);

            // Most viewed cases
            const [mostViewedCases] = await pool.query(`
                SELECT id, title, view_count FROM quality_cases ORDER BY view_count DESC LIMIT 5
            `);

            // Most liked cases
            const [mostLikedCases] = await pool.query(`
                SELECT id, title, like_count FROM quality_cases ORDER BY like_count DESC LIMIT 5
            `);

            // Rule compliance (example: count of sessions where a rule was scored)
            const [ruleCompliance] = await pool.query(`
                SELECT
                    qr.rule_name,
                    COUNT(DISTINCT qs.session_id) as sessions_scored,
                    AVG(qs.score) as average_rule_score
                FROM quality_scores qs
                JOIN quality_rules qr ON qs.rule_id = qr.id
                GROUP BY qr.rule_name
                ORDER BY sessions_scored DESC
            `);

            return {
                success: true,
                data: {
                    totalSessions,
                    averageScore,
                    statusDistribution,
                    topCustomerService,
                    mostViewedCases,
                    mostLikedCases,
                    ruleCompliance
                }
            };
        } catch (error) {
            console.error('Error generating summary quality report:', error);
            reply.code(500).send({ success: false, message: 'Failed to generate summary quality report.' });
        }
    });



    // DELETE /api/quality/cases/:id - Delete case with cascade
    fastify.delete('/api/quality/cases/:id', async (request, reply) => {
        const { id } = request.params;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Delete related data first (cascade)
            await connection.query('DELETE FROM case_comments WHERE case_id = ?', [id]);
            await connection.query('DELETE FROM case_attachments WHERE case_id = ?', [id]);
            await connection.query('DELETE FROM case_tags WHERE case_id = ?', [id]);

            // Delete the case itself
            const [result] = await connection.query('DELETE FROM quality_cases WHERE id = ?', [id]);

            await connection.commit();

            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality case not found.' });
            }
            return { success: true, message: 'Quality case and related data deleted successfully.' };
        } catch (error) {
            await connection.rollback();
            console.error('Error deleting quality case:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete quality case.' });
        } finally {
            connection.release();
        }
    });

    // GET /api/quality/cases/hot - Get hot/trending cases
    fastify.get('/api/quality/cases/hot', async (request, reply) => {
        const { limit = 10 } = request.query;
        try {
            // Calculate hot score based on views, likes, comments, and recency
            // Formula: (view_count * 0.3 + like_count * 0.5 + comment_count * 0.2) * recency_weight
            const [rows] = await pool.query(`
                SELECT
                    qc.*,
                    qs.session_code,
                    (SELECT COUNT(*) FROM case_comments WHERE case_id = qc.id) as comment_count,
                    (
                        (COALESCE(qc.view_count, 0) * 0.3 + COALESCE(qc.like_count, 0) * 0.5 +
                        (SELECT COUNT(*) FROM case_comments WHERE case_id = qc.id) * 0.2) *
                        (1 + GREATEST(0, (7 - DATEDIFF(NOW(), qc.created_at)) / 7))
                    ) as hot_score
                FROM quality_cases qc
                LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
                WHERE DATEDIFF(NOW(), qc.created_at) <= 30
                ORDER BY hot_score DESC
                LIMIT ?
            `, [parseInt(limit)]);

            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching hot quality cases:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch hot quality cases.' });
        }
    });

    // GET /api/quality/cases/recommended - Get recommended cases
    fastify.get('/api/quality/cases/recommended', async (request, reply) => {
        const { user_id, limit = 10 } = request.query;
        try {
            // Recommendation algorithm:
            // 1. Prioritize good cases (case_type = 'good')
            // 2. Calculate popularity score (views + likes * 2)
            // 3. Include comment count for engagement
            // 4. Order by popularity and recency
            const [rows] = await pool.query(`
                SELECT
                    qc.*,
                    qs.session_code,
                    (COALESCE(qc.view_count, 0) + COALESCE(qc.like_count, 0) * 2) as popularity_score,
                    (SELECT COUNT(*) FROM case_comments WHERE case_id = qc.id) as comment_count
                FROM quality_cases qc
                LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
                WHERE qc.case_type = 'good'
                ORDER BY popularity_score DESC, qc.created_at DESC
                LIMIT ?
            `, [parseInt(limit)]);

            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching recommended quality cases:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch recommended quality cases.' });
        }
    });

    // GET /api/quality/sessions/:id/tags - Get tags for a session
    fastify.get('/api/quality/sessions/:id/tags', async (request, reply) => {
        const { id } = request.params;
        try {
            const [rows] = await pool.query(`
                SELECT t.* 
                FROM quality_tags t
                JOIN quality_session_tags qst ON t.id = qst.tag_id
                WHERE qst.session_id = ?
            `, [id]);
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching session tags:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch session tags.' });
        }
    });

    // POST /api/quality/sessions/:id/tags - Add tag to session
    fastify.post('/api/quality/sessions/:id/tags', async (request, reply) => {
        const { id } = request.params;
        const { tag_id } = request.body;
        if (!tag_id) {
            return reply.code(400).send({ success: false, message: 'Tag ID is required.' });
        }
        try {
            await pool.query('INSERT IGNORE INTO quality_session_tags (session_id, tag_id) VALUES (?, ?)', [id, tag_id]);
            return { success: true, message: 'Tag added to session.' };
        } catch (error) {
            console.error('Error adding session tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to add session tag.' });
        }
    });

    // DELETE /api/quality/sessions/:id/tags/:tagId - Remove tag from session
    fastify.delete('/api/quality/sessions/:id/tags/:tagId', async (request, reply) => {
        const { id, tagId } = request.params;
        try {
            await pool.query('DELETE FROM quality_session_tags WHERE session_id = ? AND tag_id = ?', [id, tagId]);
            return { success: true, message: 'Tag removed from session.' };
        } catch (error) {
            console.error('Error removing session tag:', error);
            reply.code(500).send({ success: false, message: 'Failed to remove session tag.' });
        }
    });

};
