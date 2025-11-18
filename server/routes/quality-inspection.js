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
        const { session_code, customer_service_id, customer_info, communication_channel, platform, shop, duration, message_count } = request.body;
        try {
            if (!session_code || !customer_service_id || !platform || !shop) {
                return reply.code(400).send({ success: false, message: 'Session code, customer service ID, platform, and shop are required.' });
            }

            const [result] = await pool.query(
                `INSERT INTO quality_sessions (session_code, customer_service_id, customer_info, communication_channel, platform, shop, duration, message_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [session_code, customer_service_id, JSON.stringify(customer_info), communication_channel, platform, shop, duration, message_count]
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
                qs.*,
                u.real_name as customer_service_name
            FROM quality_sessions qs
            LEFT JOIN users u ON qs.customer_service_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (qs.session_code LIKE ? OR qs.customer_info LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (customerServiceId) {
            query += ` AND qs.customer_service_id = ?`;
            params.push(customerServiceId);
        }
        if (status) {
            query += ` AND qs.quality_status = ?`;
            params.push(status);
        }
        if (channel) {
            query += ` AND qs.communication_channel = ?`;
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

        // Get total count
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM quality_sessions qs LEFT JOIN users u ON qs.customer_service_id = u.id WHERE 1=1 ${query.split('WHERE 1=1')[1]}`, params);
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
                    u.real_name as customer_service_name
                FROM quality_sessions qs
                LEFT JOIN users u ON qs.customer_service_id = u.id
                WHERE qs.id = ?`,
                [id]
            );
            if (rows.length === 0) {
                return reply.code(404).send({ success: false, message: 'Quality session not found.' });
            }
            return { success: true, data: rows[0] };
        } catch (error) {
            console.error('Error fetching quality session details:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch quality session details.' });
        }
    });

    // PUT /api/quality/sessions/:id - Update session information
    fastify.put('/api/quality/sessions/:id', async (request, reply) => {
        const { id } = request.params;
        const { session_code, customer_service_id, customer_info, communication_channel, duration, message_count, quality_status, score, grade } = request.body;
        try {
            const [result] = await pool.query(
                `UPDATE quality_sessions SET
                    session_code = ?,
                    customer_service_id = ?,
                    customer_info = ?,
                    communication_channel = ?,
                    duration = ?,
                    message_count = ?,
                    quality_status = ?,
                    score = ?,
                    grade = ?
                 WHERE id = ?`,
                [session_code, customer_service_id, JSON.stringify(customer_info), communication_channel, duration, message_count, quality_status, score, grade, id]
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
            const [rows] = await pool.query(
                'SELECT * FROM session_messages WHERE session_id = ? ORDER BY sent_at ASC',
                [id]
            );
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching session messages:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch session messages.' });
        }
    });

    // POST /api/quality/sessions/:id/review - Submit quality review
    fastify.post('/api/quality/sessions/:id/review', async (request, reply) => {
        const { id } = request.params;
        const { score, grade, rule_scores } = request.body; // rule_scores is an array of { rule_id, score, comment }

        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // Update overall session score and grade
                const [sessionUpdateResult] = await connection.query(
                    `UPDATE quality_sessions SET
                        quality_status = 'completed',
                        score = ?,
                        grade = ?
                     WHERE id = ?`,
                    [score, grade, id]
                );

                if (sessionUpdateResult.affectedRows === 0) {
                    await connection.rollback();
                    connection.release();
                    return reply.code(404).send({ success: false, message: 'Quality session not found.' });
                }

                // Insert individual rule scores
                if (rule_scores && Array.isArray(rule_scores)) {
                    for (const rs of rule_scores) {
                        await connection.query(
                            `INSERT INTO quality_scores (session_id, rule_id, score, comment)
                             VALUES (?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE score = VALUES(score), comment = VALUES(comment)`,
                            [id, rs.rule_id, rs.score, rs.comment]
                        );
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
            const [statusDistribution] = await pool.query('SELECT quality_status, COUNT(*) as count FROM quality_sessions GROUP BY quality_status');

            // Top N customer service by average score (example)
            const [topCustomerService] = await pool.query(`
                SELECT
                    u.real_name as customer_service_name,
                    AVG(qs.score) as average_score,
                    COUNT(qs.id) as total_sessions
                FROM quality_sessions qs
                LEFT JOIN users u ON qs.customer_service_id = u.id
                WHERE qs.score IS NOT NULL
                GROUP BY u.real_name
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
                qs.session_code
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

    // DELETE /api/quality/cases/:id - Delete case
    fastify.delete('/api/quality/cases/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const [result] = await pool.query('DELETE FROM quality_cases WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return reply.code(404).send({ success: false, message: 'Quality case not found.' });
            }
            return { success: true, message: 'Quality case deleted successfully.' };
        } catch (error) {
            console.error('Error deleting quality case:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete quality case.' });
        }
    });

    // GET /api/quality/cases/hot - Get hot cases
    fastify.get('/api/quality/cases/hot', async (request, reply) => {
        const { limit = 10 } = request.query;
        try {
            const [rows] = await pool.query(
                `SELECT
                    qc.*,
                    qs.session_code
                FROM quality_cases qc
                LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
                ORDER BY qc.views DESC, qc.likes DESC
                LIMIT ?`,
                [parseInt(limit)]
            );
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching hot quality cases:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch hot quality cases.' });
        }
    });

    // GET /api/quality/cases/recommended - Get recommended cases
    fastify.get('/api/quality/cases/recommended', async (request, reply) => {
        const { limit = 10, user_id } = request.query; // Assuming recommendation logic might involve user preferences
        try {
            // This is a placeholder for actual recommendation logic.
            // In a real scenario, this would involve more complex algorithms
            // based on user history, case categories, popularity, etc.
            const [rows] = await pool.query(
                `SELECT
                    qc.*,
                    qs.session_code
                FROM quality_cases qc
                LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
                ORDER BY RAND()
                LIMIT ?`,
                [parseInt(limit)]
            );
            return { success: true, data: rows };
        } catch (error) {
            console.error('Error fetching recommended quality cases:', error);
            reply.code(500).send({ success: false, message: 'Failed to fetch recommended quality cases.' });
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
                qs.session_code,
                ucf.created_at as favorited_at
            FROM user_case_favorites ucf
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
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM user_case_favorites ucf JOIN quality_cases qc ON ucf.case_id = qc.id WHERE ucf.user_id = ? ${query.split('WHERE ucf.user_id = ?')[1]}`, params);
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
                    qs.session_code,
                    u.real_name as customer_service_name,
                    qs.customer_info,
                    qs.communication_channel,
                    qs.duration,
                    qs.message_count,
                    qs.quality_status,
                    qs.score,
                    qs.grade,
                    qs.created_at,
                    qs.updated_at
                FROM quality_sessions qs
                LEFT JOIN users u ON qs.customer_service_id = u.id
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
            const [statusDistribution] = await pool.query('SELECT quality_status, COUNT(*) as count FROM quality_sessions GROUP BY quality_status');

            // Top N customer service by average score
            const [topCustomerService] = await pool.query(`
                SELECT
                    u.real_name as customer_service_name,
                    AVG(qs.score) as average_score,
                    COUNT(qs.id) as total_sessions
                FROM quality_sessions qs
                LEFT JOIN users u ON qs.customer_service_id = u.id
                WHERE qs.score IS NOT NULL
                GROUP BY u.real_name
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

    // POST /api/quality/sessions/import - Import sessions from Excel
    fastify.post('/api/quality/sessions/import', async (request, reply) => {
        const data = await request.file();
        if (!data) {
            return reply.code(400).send({ success: false, message: 'No file uploaded.' });
        }

        const platform = data.fields.platform;
        const shop = data.fields.shop;
        const columnMapRaw = data.fields.columnMap; // Get the raw value, which is already an object or undefined

        console.log('Backend received data.fields:', data.fields);
        console.log('Backend received columnMapRaw:', columnMapRaw); // Log the raw columnMap

        // If columnMapRaw is an object, use it directly. Otherwise, it might be undefined or some other type.
        // We expect it to be an object due to Fastify's multipart parsing for JSON-like fields.
        let columnMap;
        if (typeof columnMapRaw === 'object' && columnMapRaw !== null) {
            columnMap = columnMapRaw;
        } else {
            console.error('columnMap received is not an object:', columnMapRaw);
            return reply.code(400).send({ success: false, message: 'Invalid column map format: Expected an object.' });
        }
        
        // Use columnMap here, and ensure platform, shop are present
        if (!platform || !shop || Object.keys(columnMap).length === 0) { // Check if columnMap is empty as well
            return reply.code(400).send({ success: false, message: 'Platform, shop, and column map are required.' });
        }

        console.log('Successfully processed columnMap:', columnMap);

        const workbook = new ExcelJS.Workbook();
        try {
            const buffer = await data.toBuffer();
            await workbook.xlsx.load(buffer);
        } catch (error) {
            console.error('Error parsing Excel file:', error);
            return reply.code(400).send({ success: false, message: 'Invalid Excel file format.' });
        }
        

        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
            return reply.code(400).send({ success: false, message: 'No worksheet found in the Excel file.' });
        }

        const headerRow = worksheet.getRow(1);
        if (!headerRow || headerRow.actualCellCount === 0) {
            throw new Error('Excel文件中缺少标题行。');
        }
        const headers = [];
        headerRow.eachCell((cell) => {
            headers.push(cell.value);
        });
        console.log('Excel file headers:', headers); // Log headers

        // Define system fields to map
        const SYSTEM_FIELDS = [
            'session_code', 'customer_service_id', 'customer_info', 
            'communication_channel', 'duration', 'message_count'
        ];

        const sessionsToInsert = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
                const sessionData = {};
                SYSTEM_FIELDS.forEach(systemField => {
                    const fileColumnName = columnMap[systemField];
                    if (fileColumnName) {
                        const cellIndex = headers.indexOf(fileColumnName);
                        if (cellIndex !== -1) {
                            // Ensure cell value is safely retrieved and handled
                            let cellValue = row.getCell(cellIndex + 1).value;
                            // Convert RichText object to string if necessary
                            if (typeof cellValue === 'object' && cellValue !== null && cellValue.richText) {
                                cellValue = cellValue.richText.map(textItem => textItem.text).join('');
                            }
                            sessionData[systemField] = cellValue;
                        }
                    }
                });
                
                // Add platform and shop from request body
                sessionData.platform = platform;
                sessionData.shop = shop;

                console.log(`Processing row ${rowNumber}:`, sessionData); // Log processed row data
                
                // Basic validation for required fields
                if (sessionData.session_code && sessionData.customer_service_id) {
                    sessionsToInsert.push(sessionData);
                } else {
                    console.warn(`Row ${rowNumber} skipped due to missing session_code or customer_service_id:`, sessionData);
                }
            }
        });

        console.log('Final sessionsToInsert length:', sessionsToInsert.length); // Log final array length
        if (sessionsToInsert.length === 0) {
            return reply.code(400).send({ success: false, message: 'No valid data found in the file based on mappings.' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            for (const session of sessionsToInsert) {
                await connection.query(
                    `INSERT INTO quality_sessions (session_code, customer_service_id, customer_info, communication_channel, platform, shop, duration, message_count)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        session.session_code,
                        session.customer_service_id,
                        JSON.stringify(session.customer_info), // Assuming customer_info might be an object
                        session.communication_channel,
                        session.platform,
                        session.shop,
                        session.duration,
                        session.message_count
                    ]
                );
            }
            await connection.commit();
            return { success: true, message: `${sessionsToInsert.length} sessions imported successfully.` };
        } catch (error) {
            await connection.rollback();
            console.error('Error importing sessions:', error);
            reply.code(500).send({ success: false, message: 'Failed to import sessions.' });
        } finally {
            connection.release();
        }
    });
};