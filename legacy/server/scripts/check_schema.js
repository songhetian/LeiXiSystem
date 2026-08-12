const mysql = require('mysql2/promise');
const path = require('path');
const { loadConfig } = require('../utils/config-crypto');

async function checkSchema() {
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

        const [rows] = await connection.query('DESCRIBE quality_sessions');
        const fs = require('fs');
        fs.writeFileSync(path.join(__dirname, 'schema_output.json'), JSON.stringify(rows, null, 2));
        console.log('Schema written to schema_output.json');

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSchema();
