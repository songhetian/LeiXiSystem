module.exports = async function (fastify, opts) {
    const pool = fastify.mysql;

    // POST /api/quality/sessions - Create quality session
    fastify.post('/api/quality/sessions', async (request, reply) => {
        const { session_code, customer_service_id, customer_info, communication_channel, duration, message_count } = request.body;
        try {
            if (!session_code || !customer_service_id) {
                return reply.code(400).send({ success: false, message: 'Session code and customer service ID are required.' });
            }

            const [result] = await pool.query(
                `INSERT INTO quality_sessions (session_code, customer_service_id, customer_info, communication_channel, duration, message_count)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [session_code, customer_service_id, JSON.stringify(customer_info), communication_channel, duration, message_count]
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
                `INSERT INTO quality_rules (rule_name, category, JSON_UNQUOTE(scoring_standard), weight, is_enabled)
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
            console.error('Error deleting quality rule:', error);
            reply.code(500).send({ success: false, message: 'Failed to delete quality rule.' });
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
};
