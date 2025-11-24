require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load DB config
const dbConfigPath = path.join(__dirname, '../config/db-config.json');
const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));

async function migrate() {
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
    console.log('Starting migration...');

    // 1. Check if category_id column exists
    const [columns] = await pool.query("SHOW COLUMNS FROM exams LIKE 'category_id'");
    if (columns.length === 0) {
      console.log('Adding category_id column to exams table...');
      await pool.query('ALTER TABLE exams ADD COLUMN category_id INT DEFAULT NULL AFTER category');
    } else {
      console.log('category_id column already exists.');
    }

    // 2. Migrate data: Update category_id based on category name
    console.log('Migrating data...');
    const [exams] = await pool.query('SELECT id, category FROM exams WHERE category IS NOT NULL AND category != ""');

    for (const exam of exams) {
      // Find matching category in exam_categories
      const [categories] = await pool.query('SELECT id FROM exam_categories WHERE name = ?', [exam.category]);

      if (categories.length > 0) {
        const categoryId = categories[0].id;
        await pool.query('UPDATE exams SET category_id = ? WHERE id = ?', [categoryId, exam.id]);
        console.log(`Updated exam ${exam.id}: category '${exam.category}' -> category_id ${categoryId}`);
      } else {
        console.log(`Warning: No matching category found for exam ${exam.id} with category '${exam.category}'`);
      }
    }

    console.log('Migration completed successfully.');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrate();
