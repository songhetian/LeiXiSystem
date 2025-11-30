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

async function checkMigrations() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        const [rows] = await connection.query('SELECT * FROM migrations_history ORDER BY applied_at');

        if (rows.length === 0) {
            console.log('⚠ migrations_history 表中没有记录');
        } else {
            console.log('已执行的迁移记录：\n');
            console.log('ID\t迁移文件名\t\t\t\t执行时间');
            console.log('─'.repeat(80));
            rows.forEach(row => {
                console.log(`${row.id}\t${row.migration_name.padEnd(40)}\t${row.applied_at}`);
            });
            console.log('\n总计：' + rows.length + ' 个迁移已执行');
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

checkMigrations();
