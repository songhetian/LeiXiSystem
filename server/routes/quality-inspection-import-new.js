const ExcelJS = require('exceljs');

module.exports = async function (fastify, opts) {
    const pool = fastify.mysql;

    // 新的导入端点 - 支持外部客服和客户自动创建
    // POST /api/quality/sessions/import - Import sessions from Excel
    fastify.post('/api/quality/sessions/import', async (request, reply) => {
        try {
            const parts = request.parts();
            let fileBuffer;
            let platformId;
            let shopId;
            let columnMapStr;

            for await (const part of parts) {
                if (part.file) {
                    fileBuffer = await part.toBuffer();
                } else {
                    if (part.fieldname === 'platform') platformId = part.value;
                    if (part.fieldname === 'shop') shopId = part.value;
                    if (part.fieldname === 'columnMap') columnMapStr = part.value;
                }
            }

            if (!fileBuffer || !platformId || !shopId || !columnMapStr) {
                return reply.code(400).send({ success: false, message: 'Missing file, platform, shop, or column map.' });
            }

            const columnMap = JSON.parse(columnMapStr);

            // Validate platform and shop IDs
            const [platformRows] = await pool.query('SELECT id FROM platforms WHERE id = ?', [platformId]);
            const [shopRows] = await pool.query('SELECT id FROM shops WHERE id = ? AND platform_id = ?', [shopId, platformId]);

            if (platformRows.length === 0 || shopRows.length === 0) {
                return reply.code(400).send({ success: false, message: 'Invalid platform or shop ID.' });
            }

            // Parse Excel
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(fileBuffer);

            const sessionSheet = workbook.getWorksheet('会话信息') || workbook.getWorksheet(1);
            const messageSheet = workbook.getWorksheet('聊天记录') || workbook.getWorksheet(2);

            if (!sessionSheet) {
                return reply.code(400).send({ success: false, message: 'Invalid Excel file: missing session sheet.' });
            }

            // Helper function to get or create external agent
            async function getOrCreateExternalAgent(name, platformId, shopId, connection) {
                if (!name) return null;

                const [existing] = await connection.query(
                    'SELECT id FROM external_agents WHERE name = ? AND platform_id = ? AND shop_id = ?',
                    [name, platformId, shopId]
                );

                if (existing.length > 0) {
                    return existing[0].id;
                }

                const [result] = await connection.query(
                    'INSERT INTO external_agents (name, platform_id, shop_id) VALUES (?, ?, ?)',
                    [name, platformId, shopId]
                );

                return result.insertId;
            }

            // Helper function to get or create customer
            async function getOrCreateCustomer(customerId, customerName, platformId, shopId, connection) {
                if (!customerId) return null;

                const [existing] = await connection.query(
                    'SELECT id, name FROM customers WHERE customer_id = ? AND platform_id = ? AND shop_id = ?',
                    [customerId, platformId, shopId]
                );

                if (existing.length > 0) {
                    // If customer exists but name is different, update name
                    if (customerName && existing[0].name !== customerName) {
                        await connection.query(
                            'UPDATE customers SET name = ? WHERE id = ?',
                            [customerName, existing[0].id]
                        );
                    }
                    return existing[0].id;
                }

                const [result] = await connection.query(
                    'INSERT INTO customers (customer_id, name, platform_id, shop_id) VALUES (?, ?, ?, ?)',
                    [customerId, customerName, platformId, shopId]
                );

                return result.insertId;
            }

            // Parse session headers
            const sessionHeaders = [];
            sessionSheet.getRow(1).eachCell((cell, colNumber) => {
                sessionHeaders[colNumber] = cell.value;
            });

            // Parse message headers if message sheet exists
            let messageHeaders = [];
            const messagesMap = new Map(); // session_no -> messages[]

            if (messageSheet) {
                messageSheet.getRow(1).eachCell((cell, colNumber) => {
                    messageHeaders[colNumber] = cell.value;
                });

                // Parse all messages
                messageSheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return; // Skip header

                    const rowData = {};
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        rowData[messageHeaders[colNumber]] = cell.value;
                    });

                    const sessionNo = rowData['会话编号'];
                    const senderType = rowData['发送者类型'];
                    const senderName = rowData['发送者姓名'];
                    const content = rowData['消息内容'];
                    const timestamp = rowData['发送时间'];

                    if (sessionNo && content) {
                        if (!messagesMap.has(sessionNo)) {
                            messagesMap.set(sessionNo, []);
                        }
                        messagesMap.get(sessionNo).push({
                            sender_type: senderType || 'agent',
                            sender_name: senderName,
                            content,
                            timestamp: timestamp || new Date()
                        });
                    }
                });
            }

            const connection = await pool.getConnection();
            let successCount = 0;
            const errors = [];

            try {
                await connection.beginTransaction();

                // Collect all rows first (eachRow doesn't support async/await properly)
                const sessionRows = [];
                sessionSheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return; // Skip header

                    const rowData = {};
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        rowData[sessionHeaders[colNumber]] = cell.value;
                    });

                    sessionRows.push({ rowNumber, rowData });
                });

                // Process each session sequentially
                for (const { rowNumber, rowData } of sessionRows) {
                    try {
                        const sessionNo = rowData['会话编号'];
                        const agentName = rowData['客服姓名'];
                        const customerName = rowData['客户姓名'];
                        const customerId = rowData['客户ID'];
                        const channel = rowData['沟通渠道'] || 'chat';
                        const startTime = rowData['开始时间'];
                        const endTime = rowData['结束时间'];
                        const duration = rowData['时长(秒)'] || 0;
                        const messageCount = rowData['消息数量'] || 0;

                        if (!sessionNo || !agentName) {
                            errors.push(`Row ${rowNumber}: Missing session_no or agent_name`);
                            continue;
                        }

                        // Get or create external agent
                        const externalAgentId = await getOrCreateExternalAgent(agentName, platformId, shopId, connection);

                        // Get or create customer (if customerId provided)
                        const customerDbId = customerId ? await getOrCreateCustomer(customerId, customerName, platformId, shopId, connection) : null;

                        // Insert session
                        const [sessionResult] = await connection.query(
                            `INSERT INTO quality_sessions
                             (session_no, external_agent_id, agent_name, customer_id, customer_name,
                              channel, start_time, end_time, duration, message_count,
                              platform_id, shop_id, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                            [sessionNo, externalAgentId, agentName, customerId, customerName,
                             channel, startTime, endTime, duration, messageCount,
                             platformId, shopId]
                        );

                        const sessionId = sessionResult.insertId;

                        // Insert messages if available
                        const messages = messagesMap.get(sessionNo) || [];
                        for (const msg of messages) {
                            await connection.query(
                                `INSERT INTO session_messages
                                 (session_id, sender_type, sender_name, content, timestamp)
                                 VALUES (?, ?, ?, ?, ?)`,
                                [sessionId, msg.sender_type, msg.sender_name, msg.content, msg.timestamp]
                            );
                        }

                        successCount++;
                    } catch (err) {
                        console.error(`Error processing row ${rowNumber}:`, err);
                        errors.push(`Row ${rowNumber}: ${err.message}`);
                    }
                }

                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

            return {
                success: true,
                message: `Imported ${successCount} sessions successfully.`,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            console.error('Error importing sessions:', error);
            reply.code(500).send({ success: false, message: 'Failed to import sessions.' });
        }
    });
};
