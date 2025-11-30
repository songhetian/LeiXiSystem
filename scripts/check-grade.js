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

async function checkGradeColumn() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        const [columns] = await connection.query("DESCRIBE quality_sessions");
        const gradeColumn = columns.find(c => c.Field === 'grade');

        if (gradeColumn) {
            console.log(`✅ grade 字段类型: ${gradeColumn.Type}`);
            if (gradeColumn.Type.includes('varchar')) {
                console.log('✅ 类型验证通过 (VARCHAR)');
            } else {
                console.error('❌ 类型验证失败 (期望 VARCHAR)');
            }
        } else {
            console.error('❌ grade 字段不存在');
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

checkGradeColumn();
