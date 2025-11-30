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

async function checkMaxScoreColumn() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        const [columns] = await connection.query("DESCRIBE quality_scores");
        const maxScoreColumn = columns.find(c => c.Field === 'max_score');

        if (maxScoreColumn) {
            console.log(`✅ max_score 字段: Null=${maxScoreColumn.Null}, Default=${maxScoreColumn.Default}`);
            if (maxScoreColumn.Null === 'YES') {
                console.log('✅ 验证通过 (允许为空)');
            } else {
                console.error('❌ 验证失败 (不允许为空)');
            }
        } else {
            console.error('❌ max_score 字段不存在');
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

checkMaxScoreColumn();
