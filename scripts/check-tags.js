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

async function checkTags() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        // Check tag categories
        const [categories] = await connection.query('SELECT * FROM quality_tag_categories LIMIT 5');
        console.log('标签分类数量:', categories.length);
        if (categories.length > 0) {
            console.log('示例分类:', categories[0]);
        }

        // Check tags
        const [tags] = await connection.query('SELECT * FROM quality_tags LIMIT 5');
        console.log('\n标签数量:', tags.length);
        if (tags.length > 0) {
            console.log('示例标签:', tags[0]);
        }

        if (categories.length === 0 && tags.length === 0) {
            console.log('\n❌ 数据库中没有标签数据！');
            console.log('建议：运行 npm run db:seed 来添加测试数据');
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkTags();
