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

async function debugTags() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        // 1. 检查标签表
        console.log('=== 1. 检查标签数据 ===');
        const [tags] = await connection.query('SELECT id, name, color, category_id FROM quality_tags');
        console.log(`共有 ${tags.length} 个标签:`);
        tags.forEach(tag => {
            console.log(`  ID: ${tag.id}, 名称: ${tag.name}, 颜色: ${tag.color}, 分类: ${tag.category_id}`);
        });

        // 2. 检查会话
        console.log('\n=== 2. 检查会话数据 ===');
        const [sessions] = await connection.query('SELECT id, session_no, status FROM quality_sessions LIMIT 3');
        console.log(`共有 ${sessions.length} 个会话（显示前3个）:`);
        sessions.forEach(s => {
            console.log(`  会话ID: ${s.id}, 编号: ${s.session_no}, 状态: ${s.status}`);
        });

        // 3. 检查消息
        if (sessions.length > 0) {
            const sessionId = sessions[0].id;
            console.log(`\n=== 3. 检查会话 ${sessionId} 的消息 ===`);
            const [messages] = await connection.query(
                'SELECT id, sender, content FROM session_messages WHERE session_id = ? LIMIT 5',
                [sessionId]
            );
            console.log(`共有 ${messages.length} 条消息:`);
            messages.forEach(msg => {
                console.log(`  消息ID: ${msg.id}, 发送者: ${msg.sender}, 内容: ${msg.content.substring(0, 30)}...`);
            });

            // 4. 检查消息标签关联
            console.log(`\n=== 4. 检查消息标签关联 ===`);
            const [msgTags] = await connection.query(
                `SELECT qmt.*, sm.session_id 
                 FROM quality_message_tags qmt
                 JOIN session_messages sm ON qmt.message_id = sm.id
                 WHERE sm.session_id = ?`,
                [sessionId]
            );
            console.log(`会话 ${sessionId} 的消息标签数: ${msgTags.length}`);
            if (msgTags.length > 0) {
                msgTags.forEach(mt => {
                    console.log(`  消息ID: ${mt.message_id}, 标签ID: ${mt.tag_id}`);
                });
            } else {
                console.log('  ⚠️ 该会话没有任何消息标签');
            }
        }

        // 5. 检查所有消息标签关联
        console.log('\n=== 5. 检查所有消息标签关联 ===');
        const [allMsgTags] = await connection.query('SELECT * FROM quality_message_tags');
        console.log(`数据库中共有 ${allMsgTags.length} 个消息标签关联`);
        if (allMsgTags.length > 0) {
            allMsgTags.forEach(mt => {
                console.log(`  消息ID: ${mt.message_id}, 标签ID: ${mt.tag_id}, 创建时间: ${mt.created_at}`);
            });
        }

        // 6. 检查会话标签关联
        console.log('\n=== 6. 检查会话标签关联 ===');
        const [sessionTags] = await connection.query('SELECT * FROM quality_session_tags');
        console.log(`数据库中共有 ${sessionTags.length} 个会话标签关联`);
        if (sessionTags.length > 0) {
            sessionTags.forEach(st => {
                console.log(`  会话ID: ${st.session_id}, 标签ID: ${st.tag_id}, 创建时间: ${st.created_at}`);
            });
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

debugTags();
