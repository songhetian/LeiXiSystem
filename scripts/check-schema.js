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

async function checkSchema() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        // 1. 检查 external_agents 表
        const [externalAgents] = await connection.query("SHOW TABLES LIKE 'external_agents'");
        if (externalAgents.length > 0) {
            console.log('✅ external_agents 表存在');
            const [columns] = await connection.query("DESCRIBE external_agents");
            console.log('   字段:', columns.map(c => c.Field).join(', '));
        } else {
            console.error('❌ external_agents 表不存在');
        }

        console.log('');

        // 2. 检查 quality_sessions 表的 external_agent_id 字段
        const [qsColumns] = await connection.query("DESCRIBE quality_sessions");
        const hasExternalAgentId = qsColumns.some(c => c.Field === 'external_agent_id');

        if (hasExternalAgentId) {
            console.log('✅ quality_sessions 表包含 external_agent_id 字段');
        } else {
            console.error('❌ quality_sessions 表缺少 external_agent_id 字段');
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

checkSchema();
