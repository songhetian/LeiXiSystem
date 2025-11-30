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

async function checkTableStructure() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        // 检查 session_messages 表结构
        console.log('=== session_messages 表结构 ===');
        const [columns] = await connection.query('DESCRIBE session_messages');
        columns.forEach(col => {
            console.log(`${col.Field} (${col.Type})`);
        });

        // 查看一条示例数据
        console.log('\n=== 示例数据 ===');
        const [rows] = await connection.query('SELECT * FROM session_messages LIMIT 1');
        if (rows.length > 0) {
            console.log(JSON.stringify(rows[0], null, 2));
        }

    } catch (error) {
        console.error('错误:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkTableStructure();
