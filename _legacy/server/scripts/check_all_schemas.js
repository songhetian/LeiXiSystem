const mysql = require('mysql2/promise');
const path = require('path');
const { loadConfig } = require('../utils/config-crypto');

async function checkSchemas() {
    try {
        const dbConfigPath = path.join(__dirname, '../../config/db-config.json');
        const dbConfigJson = loadConfig(dbConfigPath);

        const dbConfig = {
            host: dbConfigJson.database.host,
            user: dbConfigJson.database.user,
            password: dbConfigJson.database.password,
            database: dbConfigJson.database.database,
            port: dbConfigJson.database.port
        };

        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database');

        // Check session_messages table
        const [messageRows] = await connection.query('DESCRIBE session_messages');
        const fs = require('fs');
        fs.writeFileSync(path.join(__dirname, 'session_messages_schema.json'), JSON.stringify(messageRows, null, 2));
        console.log('session_messages schema written');

        // Check for existing tag tables
        const [tables] = await connection.query("SHOW TABLES LIKE '%tag%'");
        fs.writeFileSync(path.join(__dirname, 'tag_tables.json'), JSON.stringify(tables, null, 2));
        console.log('Tag tables written');

        // Check all tables
        const [allTables] = await connection.query('SHOW TABLES');
        fs.writeFileSync(path.join(__dirname, 'all_tables.json'), JSON.stringify(allTables, null, 2));
        console.log('All tables written');

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSchemas();
