const mysql = require('mysql2/promise');
const fs = require('fs');
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

async function runMigrations() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to the database.');

    // Ensure migrations_history table exists
    const createHistoryTableSql = fs.readFileSync(path.join(__dirname, '../database/migrations/016_create_migrations_history_table.sql'), 'utf8');
    await connection.query(createHistoryTableSql);
    console.log('Ensured migrations_history table exists.');

    const [appliedMigrations] = await connection.query('SELECT migration_name FROM migrations_history');
    const appliedMigrationNames = new Set(appliedMigrations.map(row => row.migration_name));

    const migrationFiles = fs.readdirSync(path.join(__dirname, '../database/migrations'))
      .filter(file => file.endsWith('.sql') && /^\d{3}_/.test(file)) // Only .sql files starting with 3 digits
      .sort(); // Sort numerically

    for (const file of migrationFiles) {
      if (appliedMigrationNames.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(__dirname, '../database/migrations', file), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT INTO migrations_history (migration_name) VALUES (?)', [file]);
      console.log(`Successfully applied migration: ${file}`);
    }

    console.log('All migrations applied successfully.');

  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

runMigrations();
