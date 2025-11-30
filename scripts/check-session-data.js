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

async function checkSessionData() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        const [rows] = await connection.query(`
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
      LIMIT 1
    `);

        if (rows.length > 0) {
            console.log('第一条记录的字段：');
            console.log(JSON.stringify(rows[0], null, 2));
        } else {
            console.log('❌ 没有找到任何质检会话记录');
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkSessionData();
