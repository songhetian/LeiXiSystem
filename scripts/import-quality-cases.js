const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function importData() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_NAME || 'leixi_system',
        multipleStatements: true
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected to database');

        const sqlFile = path.join(__dirname, '../database/test-data/11_insert_quality_cases.sql');
        const sql = await fs.readFile(sqlFile, 'utf8');

        console.log('Importing quality cases...');
        await connection.query(sql);
        console.log('✓ Quality cases imported successfully!');

        await connection.end();
    } catch (error) {
        console.error('Import failed:', error.message);
        process.exit(1);
    }
}

importData();
