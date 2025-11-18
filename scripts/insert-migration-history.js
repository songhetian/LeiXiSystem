const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'leixin_customer_service',
  port: process.env.DB_PORT || 3306,
};

async function insertMigrationHistory() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to the database.');

    const migrationName = '014_create_notifications_table.sql'; // Changed migration name
    const [rows] = await connection.execute(
      'SELECT * FROM migrations_history WHERE migration_name = ?',
      [migrationName]
    );

    if (rows.length === 0) {
      await connection.execute(
        'INSERT INTO migrations_history (migration_name) VALUES (?)',
        [migrationName]
      );
      console.log(`Successfully inserted '${migrationName}' into migrations_history.`);
    } else {
      console.log(`'${migrationName}' already exists in migrations_history. Skipping insertion.`);
    }

  } catch (error) {
    console.error('Error inserting migration history:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

insertMigrationHistory();