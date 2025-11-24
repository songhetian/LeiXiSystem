require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load DB config
const dbConfigPath = path.join(__dirname, '../config/db-config.json');
const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));

async function checkSchema() {
  const pool = mysql.createPool({
    host: dbConfig.database.host,
    user: dbConfig.database.user,
    password: dbConfig.database.password,
    database: dbConfig.database.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const [rows] = await pool.query('DESCRIBE exams');
    console.log('Exams table schema:');
    rows.forEach(row => {
      console.log(`${row.Field}: ${row.Type}`);
    });
  } catch (error) {
    console.error('Failed to describe table:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
