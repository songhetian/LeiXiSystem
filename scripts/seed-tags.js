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

async function seedTags() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        // Insert categories
        const categories = [
            { name: '服务态度', description: '关于客服服务态度的标签', sort_order: 1 },
            { name: '业务能力', description: '关于客服业务知识的标签', sort_order: 2 },
            { name: '沟通技巧', description: '关于客服沟通技巧的标签', sort_order: 3 },
            { name: '违规行为', description: '关于客服违规行为的标签', sort_order: 4 }
        ];

        for (const cat of categories) {
            await connection.query(
                'INSERT IGNORE INTO quality_tag_categories (name, description, sort_order) VALUES (?, ?, ?)',
                [cat.name, cat.description, cat.sort_order]
            );
        }
        console.log('✓ 已插入标签分类');

        // Get category IDs
        const [cats] = await connection.query('SELECT id, name FROM quality_tag_categories');
        const catMap = {};
        cats.forEach(c => catMap[c.name] = c.id);

        // Insert tags
        const tags = [
            { name: '态度恶劣', category: '服务态度', color: '#ff4d4f', type: 'quality' },
            { name: '热情周到', category: '服务态度', color: '#52c41a', type: 'quality' },
            { name: '敷衍了事', category: '服务态度', color: '#faad14', type: 'quality' },
            { name: '业务不熟', category: '业务能力', color: '#ff4d4f', type: 'quality' },
            { name: '解答准确', category: '业务能力', color: '#52c41a', type: 'quality' },
            { name: '流程错误', category: '业务能力', color: '#faad14', type: 'quality' },
            { name: '沟通顺畅', category: '沟通技巧', color: '#52c41a', type: 'quality' },
            { name: '表达不清', category: '沟通技巧', color: '#faad14', type: 'quality' },
            { name: '辱骂客户', category: '违规行为', color: '#f5222d', type: 'quality' },
            { name: '泄露隐私', category: '违规行为', color: '#f5222d', type: 'quality' }
        ];

        for (const tag of tags) {
            const catId = catMap[tag.category];
            if (catId) {
                await connection.query(
                    'INSERT IGNORE INTO quality_tags (name, category_id, color, tag_type) VALUES (?, ?, ?, ?)',
                    [tag.name, catId, tag.color, tag.type]
                );
            }
        }
        console.log('✓ 已插入初始标签');

    } catch (error) {
        console.error('❌ 插入数据失败:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

seedTags();
