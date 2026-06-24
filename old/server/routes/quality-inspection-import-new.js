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

            // --- 核心工具：智能表头匹配器 ---
            const getColValue = (rowData, possibleNames) => {
                const foundName = possibleNames.find(name => rowData[name] !== undefined);
                return foundName ? rowData[foundName] : null;
            };

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
                    messageHeaders[colNumber] = cell.value?.toString().trim();
                });

                // Parse all messages
                messageSheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return; // Skip header

                    const rowData = {};
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        const header = messageHeaders[colNumber];
                        if (header) rowData[header] = cell.value;
                    });

                    const sessionNo = getColValue(rowData, ['会话编号', '会话ID', 'SessionNo', 'SessionID']);
                    const senderType = getColValue(rowData, ['发送者类型', '角色', 'SenderType', 'Role']);
                    const senderName = getColValue(rowData, ['发送者姓名', '昵称', 'SenderName', 'Nickname']);
                    const content = getColValue(rowData, ['消息内容', '内容', 'Message', 'Content', 'Text']);
                    const timestamp = getColValue(rowData, ['发送时间', '时间', 'Time', 'Timestamp']);

                    if (sessionNo && content) {
                        const normalizedSessionNo = sessionNo.toString().trim();
                        if (!messagesMap.has(normalizedSessionNo)) {
                            messagesMap.set(normalizedSessionNo, []);
                        }
                        messagesMap.get(normalizedSessionNo).push({
                            sender_type: (senderType?.toString() || '').includes('客') ? 'customer' : 'agent',
                            sender_name: senderName?.toString() || '',
                            content: content.toString(),
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

                // Collect all rows first
                const sessionRows = [];
                sessionSheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;

                    const rowData = {};
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        const header = sessionHeaders[colNumber]?.toString().trim();
                        if (header) rowData[header] = cell.value;
                    });

                    sessionRows.push({ rowNumber, rowData });
                });

                // Process each session sequentially
                for (const { rowNumber, rowData } of sessionRows) {
                    try {
                        const originalSessionNo = getColValue(rowData, ['会话编号', '会话ID', 'SessionNo'])?.toString().trim();
                        const agentName = getColValue(rowData, ['客服姓名', '客服', 'AgentName', 'Agent'])?.toString().trim();
                        const customerName = getColValue(rowData, ['客户姓名', '客户', 'CustomerName', 'Customer'])?.toString().trim();
                        const customerId = getColValue(rowData, ['客户ID', 'CustomerID', 'Uid'])?.toString().trim();
                        const channel = (getColValue(rowData, ['沟通渠道', '渠道', 'Channel']) || '聊天').toString().trim();
                        const startTime = getColValue(rowData, ['开始时间', 'Start']);
                        const endTime = getColValue(rowData, ['结束时间', 'End']);
                        const duration = parseInt(getColValue(rowData, ['时长', 'Duration']) || 0);

                        // --- 核心优化 1：自动生成规范化编号 ---
                        const now = new Date();
                        const datePart = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
                        const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                        const autoSessionNo = `QS-${datePart}-${randomPart}`;

                        // --- 核心优化 2：智能身份识别 ---
                        let agentId = null;
                        let externalAgentId = null;

                        if (agentName) {
                            const [internalUser] = await connection.query(
                                'SELECT id FROM users WHERE real_name = ? AND status = "active" LIMIT 1',
                                [agentName]
                            );
                            if (internalUser.length > 0) {
                                agentId = internalUser[0].id;
                            } else {
                                externalAgentId = await getOrCreateExternalAgent(agentName, platformId, shopId, connection);
                            }
                        }

                        // --- 核心优化 3：关联聊天记录 (增加容错) ---
                        // 寻找对应消息：优先用原始编号，若无则跳过消息（不影响会话主表创建）
                        const messages = originalSessionNo ? (messagesMap.get(originalSessionNo) || []) : [];

                        // Insert session with both ID fields
                        const [sessionResult] = await connection.query(
                            `INSERT INTO quality_sessions
                             (session_no, agent_id, external_agent_id, agent_name, customer_id, customer_name,
                              channel, start_time, end_time, duration, message_count,
                              platform_id, shop_id, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                            [autoSessionNo, agentId, externalAgentId, agentName, customerId, customerName,
                             channel, startTime, endTime, duration, messages.length,
                             platformId, shopId]
                        );

                        const sessionId = sessionResult.insertId;

                        // --- 核心优化 4：强制插入消息明细 ---
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
                        errors.push(`第 ${rowNumber} 行：${err.message}`);
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
