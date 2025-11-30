const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
    const config = {
        host: 'localhost',
        user: 'root',
        password: '123456',
        database: 'leixi_system',
        multipleStatements: true
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected to database');

        const sqlFile = path.join(__dirname, '../database/migrations/007_create_quality_cases_tables.sql');
        const sql = await fs.readFile(sqlFile, 'utf8');

        console.log('Executing migration...');
        await connection.query(sql);
        console.log('✓ Migration completed successfully!');

        await connection.end();
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
