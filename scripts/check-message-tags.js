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

async function checkMessageTags() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        // Check if quality_tags table exists and has data
        console.log('=== 检查 quality_tags 表 ===');
        const [tags] = await connection.query('SELECT * FROM quality_tags LIMIT 5');
        console.log(`找到 ${tags.length} 个标签:`);
        tags.forEach(tag => {
            console.log(`  - ID: ${tag.id}, 名称: ${tag.name}, 颜色: ${tag.color}`);
        });

        // Check if quality_message_tags table exists and has data
        console.log('\n=== 检查 quality_message_tags 表 ===');
        const [messageTags] = await connection.query('SELECT * FROM quality_message_tags LIMIT 10');
        console.log(`找到 ${messageTags.length} 个消息标签关联:`);
        messageTags.forEach(mt => {
            console.log(`  - 消息ID: ${mt.message_id}, 标签ID: ${mt.tag_id}`);
        });

        // Check a sample session's messages and their tags
        console.log('\n=== 检查会话消息及其标签 ===');
        const [sessions] = await connection.query('SELECT id FROM quality_sessions LIMIT 1');
        if (sessions.length > 0) {
            const sessionId = sessions[0].id;
            console.log(`会话 ID: ${sessionId}`);

            const [messages] = await connection.query(
                'SELECT * FROM session_messages WHERE session_id = ? LIMIT 5',
                [sessionId]
            );
            console.log(`  找到 ${messages.length} 条消息`);

            for (const msg of messages) {
                const [msgTags] = await connection.query(
                    `SELECT t.* 
                     FROM quality_message_tags qmt
                     JOIN quality_tags t ON qmt.tag_id = t.id
                     WHERE qmt.message_id = ?`,
                    [msg.id]
                );
                console.log(`  消息 ${msg.id}: ${msgTags.length} 个标签`);
                msgTags.forEach(tag => {
                    console.log(`    - ${tag.name} (${tag.color})`);
                });
            }
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkMessageTags();
