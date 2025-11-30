const mysql = require('mysql2/promise');
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

async function createTagTables() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库\n');

        const sql = `
      -- 表: quality_tag_categories (标签分类表)
      CREATE TABLE IF NOT EXISTS \`quality_tag_categories\` (
        \`id\` INT NOT NULL AUTO_INCREMENT COMMENT '分类ID',
        \`name\` VARCHAR(50) NOT NULL COMMENT '分类名称',
        \`description\` VARCHAR(255) DEFAULT NULL COMMENT '分类描述',
        \`sort_order\` INT NOT NULL DEFAULT 0 COMMENT '排序',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_name\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签分类表';

      -- 表: quality_tags (质检标签表)
      CREATE TABLE IF NOT EXISTS \`quality_tags\` (
        \`id\` INT NOT NULL AUTO_INCREMENT COMMENT '标签ID',
        \`name\` VARCHAR(50) NOT NULL COMMENT '标签名称',
        \`category_id\` INT DEFAULT NULL COMMENT '分类ID',
        \`color\` VARCHAR(20) DEFAULT '#1890ff' COMMENT '标签颜色',
        \`description\` VARCHAR(255) DEFAULT NULL COMMENT '标签描述',
        \`tag_type\` ENUM('quality', 'business', 'other') NOT NULL DEFAULT 'quality' COMMENT '标签类型',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_name_category\` (\`name\`,\`category_id\`),
        KEY \`idx_category_id\` (\`category_id\`),
        KEY \`idx_tag_type\` (\`tag_type\`),
        CONSTRAINT \`fk_quality_tags_category_id\` FOREIGN KEY (\`category_id\`) REFERENCES \`quality_tag_categories\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检标签表';

      -- 表: quality_session_tags (会话标签关联表)
      CREATE TABLE IF NOT EXISTS \`quality_session_tags\` (
        \`id\` INT NOT NULL AUTO_INCREMENT COMMENT '关联ID',
        \`session_id\` INT NOT NULL COMMENT '会话ID',
        \`tag_id\` INT NOT NULL COMMENT '标签ID',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_session_tag\` (\`session_id\`, \`tag_id\`),
        KEY \`idx_session_id\` (\`session_id\`),
        KEY \`idx_tag_id\` (\`tag_id\`),
        CONSTRAINT \`fk_session_tags_session_id\` FOREIGN KEY (\`session_id\`) REFERENCES \`quality_sessions\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_session_tags_tag_id\` FOREIGN KEY (\`tag_id\`) REFERENCES \`quality_tags\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话标签关联表';

      -- 表: quality_message_tags (消息标签关联表)
      CREATE TABLE IF NOT EXISTS \`quality_message_tags\` (
        \`id\` INT NOT NULL AUTO_INCREMENT COMMENT '关联ID',
        \`message_id\` INT NOT NULL COMMENT '消息ID',
        \`tag_id\` INT NOT NULL COMMENT '标签ID',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_message_tag\` (\`message_id\`, \`tag_id\`),
        KEY \`idx_message_id\` (\`message_id\`),
        KEY \`idx_tag_id\` (\`tag_id\`),
        CONSTRAINT \`fk_message_tags_message_id\` FOREIGN KEY (\`message_id\`) REFERENCES \`session_messages\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_message_tags_tag_id\` FOREIGN KEY (\`tag_id\`) REFERENCES \`quality_tags\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息标签关联表';
    `;

        await connection.query(sql);
        console.log('✓ 成功创建标签相关表');

    } catch (error) {
        console.error('❌ 创建表失败:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

createTagTables();
