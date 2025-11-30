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

async function insertTestTags() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        // 1. 获取第一个会话的前3条消息
        console.log('=== 1. 获取测试数据 ===');
        const [messages] = await connection.query(
            'SELECT id, session_id, content FROM session_messages WHERE session_id = 1 LIMIT 3'
        );
        console.log(`找到 ${messages.length} 条消息`);

        if (messages.length === 0) {
            console.log('❌ 没有找到消息，无法继续测试');
            return;
        }

        // 2. 获取可用的标签
        const [tags] = await connection.query('SELECT id, name FROM quality_tags LIMIT 3');
        console.log(`找到 ${tags.length} 个标签`);

        if (tags.length === 0) {
            console.log('❌ 没有找到标签，无法继续测试');
            return;
        }

        // 3. 清除现有的测试数据
        console.log('\n=== 2. 清除现有测试数据 ===');
        await connection.query(
            `DELETE qmt FROM quality_message_tags qmt
             JOIN session_messages sm ON qmt.message_id = sm.id
             WHERE sm.session_id = 1`
        );
        console.log('✓ 已清除会话1的消息标签');

        // 4. 插入测试标签
        console.log('\n=== 3. 插入测试标签 ===');
        for (let i = 0; i < Math.min(messages.length, tags.length); i++) {
            const messageId = messages[i].id;
            const tagId = tags[i].id;

            await connection.query(
                'INSERT INTO quality_message_tags (message_id, tag_id) VALUES (?, ?)',
                [messageId, tagId]
            );
            console.log(`✓ 为消息 ${messageId} 添加标签 ${tags[i].name} (ID: ${tagId})`);
        }

        // 5. 验证插入结果
        console.log('\n=== 4. 验证插入结果 ===');
        const [result] = await connection.query(
            `SELECT 
                sm.id as message_id,
                sm.content,
                t.id as tag_id,
                t.name as tag_name,
                t.color as tag_color
             FROM session_messages sm
             JOIN quality_message_tags qmt ON sm.id = qmt.message_id
             JOIN quality_tags t ON qmt.tag_id = t.id
             WHERE sm.session_id = 1
             ORDER BY sm.id`
        );

        console.log(`成功验证 ${result.length} 个消息标签关联:`);
        result.forEach(r => {
            console.log(`  消息 ${r.message_id}: "${r.content.substring(0, 30)}..." -> 标签: ${r.tag_name} (${r.tag_color})`);
        });

        console.log('\n✅ 测试数据插入成功！');
        console.log('现在可以打开会话1查看消息标签是否显示。');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

insertTestTags();
