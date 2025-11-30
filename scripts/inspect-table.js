const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function inspectTable() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_NAME || 'leixi_system'
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected to database');

        const [rows] = await connection.query('SELECT id, username, real_name FROM users LIMIT 10');
        console.log('Users data:');
        console.table(rows);

        await connection.end();
    } catch (error) {
        console.error('Inspection failed:', error.message);
    }
}

inspectTable();
