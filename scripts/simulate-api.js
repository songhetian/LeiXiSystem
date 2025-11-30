const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'leixin_customer_service',
    port: process.env.DB_PORT || 3306
};

async function simulateAPIResponse() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        const sessionId = 1;

        // 模拟 getSessionMessages API 的查询
        console.log('=== 模拟 GET /api/quality/sessions/1/messages ===\n');

        // 1. Fetch messages
        const [messages] = await connection.query(
            'SELECT * FROM session_messages WHERE session_id = ? ORDER BY timestamp ASC',
            [sessionId]
        );

        console.log(`找到 ${messages.length} 条消息\n`);

        if (messages.length === 0) {
            console.log('返回: { success: true, data: [] }');
            return;
        }

        // 2. Fetch tags for these messages
        const messageIds = messages.map(m => m.id);
        const [tags] = await connection.query(
            `SELECT qmt.message_id, t.* 
             FROM quality_message_tags qmt
             JOIN quality_tags t ON qmt.tag_id = t.id
             WHERE qmt.message_id IN (?)`,
            [messageIds]
        );

        console.log(`找到 ${tags.length} 个标签关联\n`);

        // 3. Attach tags to messages
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

        // 4. 显示结果
        console.log('=== API 响应数据结构 ===\n');
        console.log(JSON.stringify({ success: true, data: messages }, null, 2));

        // 5. 模拟前端处理
        console.log('\n=== 前端处理后的 tags 状态 ===\n');
        const allTags = [];
        messages.forEach(msg => {
            if (msg.tags && Array.isArray(msg.tags)) {
                msg.tags.forEach(tag => {
                    allTags.push({
                        id: tag.id,
                        tagId: tag.id,
                        messageId: msg.id,
                        text: tag.name,
                        color: tag.color
                    });
                });
            }
        });

        console.log(`提取出 ${allTags.length} 个标签对象:`);
        allTags.forEach(tag => {
            console.log(`  消息 ${tag.messageId}: ${tag.text} (颜色: ${tag.color}, tagId: ${tag.tagId})`);
        });

        // 6. 验证过滤逻辑
        console.log('\n=== 验证消息标签过滤 ===\n');
        messages.forEach(msg => {
            const msgTags = allTags.filter(t => t.messageId === msg.id);
            console.log(`消息 ${msg.id}: ${msgTags.length} 个标签`);
            msgTags.forEach(tag => {
                console.log(`  - ${tag.text} (${tag.color})`);
            });
        });

    } catch (error) {
        console.error('错误:', error.message);
        console.error(error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

simulateAPIResponse();
