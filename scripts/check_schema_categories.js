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
    console.log('--- exams table ---');
    const [examsRows] = await pool.query('DESCRIBE exams');
    examsRows.forEach(row => console.log(`${row.Field}: ${row.Type}`));

    console.log('\n--- exam_categories table ---');
    // Assuming the table name is exam_categories based on previous context (CategoryManagement.jsx uses /exam-categories API)
    // But I should check if it exists.
    const [tables] = await pool.query("SHOW TABLES LIKE 'exam_categories'");
    if (tables.length > 0) {
        const [catRows] = await pool.query('DESCRIBE exam_categories');
        catRows.forEach(row => console.log(`${row.Field}: ${row.Type}`));
    } else {
        console.log('exam_categories table does not exist. Checking for similar names...');
        const [allTables] = await pool.query("SHOW TABLES");
        allTables.forEach(row => {
            const tableName = Object.values(row)[0];
            if (tableName.includes('category')) console.log(`Found table: ${tableName}`);
        });
    }

  } catch (error) {
    console.error('Failed to describe tables:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
