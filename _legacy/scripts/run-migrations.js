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
    const createHistoryTableSql = `
      CREATE TABLE IF NOT EXISTS migrations_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
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

      // Disable foreign key checks to allow dropping tables
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');

      // Remove comment lines first
      const cleanedSql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

      // Split SQL file into individual statements
      const statements = cleanedSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      console.log(`Executing ${statements.length} SQL statements...`);

      // Execute each statement sequentially
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement) {
          try {
            await connection.query(statement);
            if ((i + 1) % 50 === 0) {
              console.log(`  Executed ${i + 1}/${statements.length} statements...`);
            }
          } catch (err) {
            console.error(`Error executing statement ${i + 1}:`, err.message);
            console.error('Statement:', statement.substring(0, 300) + '...');
            throw err;
          }
        }
      }

      // Re-enable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');

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
