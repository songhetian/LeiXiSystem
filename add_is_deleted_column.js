
const mysql = require('mysql2/promise');
const dbConfig = require('./config/db-config.json');

async function migrate() {
  const connection = await mysql.createConnection({
    host: dbConfig.database.host,
    user: dbConfig.database.user,
    password: dbConfig.database.password,
    database: dbConfig.database.database
  });

  try {
    console.log('Checking if is_deleted column exists...');
    const [columns] = await connection.query(`SHOW COLUMNS FROM assessment_plans LIKE 'is_deleted'`);

    if (columns.length === 0) {
      console.log('Adding is_deleted column...');
      await connection.query(`ALTER TABLE assessment_plans ADD COLUMN is_deleted TINYINT(1) DEFAULT 0`);
      console.log('Column added successfully.');
    } else {
      console.log('Column already exists.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
