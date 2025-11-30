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

async function checkRules() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        const [rules] = await connection.query('SELECT id, name, category, score_weight, is_active FROM quality_rules ORDER BY id');

        console.log('质检规则列表:');
        console.log('ID | 名称 | 分类 | 权重 | 状态');
        console.log('---|------|------|------|------');
        rules.forEach(rule => {
            console.log(`${rule.id} | ${rule.name} | ${rule.category} | ${rule.score_weight} | ${rule.is_active ? '启用' : '禁用'}`);
        });

        console.log(`\n总计: ${rules.length} 条规则`);

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkRules();
