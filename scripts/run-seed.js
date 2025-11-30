const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'leixin_customer_service',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
};

async function runSeed() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        const seedDir = path.join(__dirname, '../database/test-data');
        const seedFiles = fs.readdirSync(seedDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        console.log(`找到 ${seedFiles.length} 个种子数据文件\n`);

        for (const file of seedFiles) {
            console.log(`执行: ${file}`);
            const sql = fs.readFileSync(path.join(seedDir, file), 'utf8');

            // 分割并执行 SQL 语句
            const statements = sql
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);

            for (const statement of statements) {
                if (statement) {
                    await connection.query(statement);
                }
            }

            console.log(`✓ ${file} 执行完成`);
        }

        console.log('\n✓ 所有种子数据已成功导入');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runSeed();
