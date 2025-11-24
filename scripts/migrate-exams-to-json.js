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

    // 1. Add questions column to exams table if not exists
    console.log('Checking exams table schema...');
    try {
      await pool.query('ALTER TABLE exams ADD COLUMN questions LONGTEXT');
      console.log('Added questions column to exams table.');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('questions column already exists.');
      } else {
        throw error;
      }
    }

    // 2. Fetch all exams
    const [exams] = await pool.query('SELECT id, title FROM exams');
    console.log(`Found ${exams.length} exams.`);

    // 3. For each exam, fetch questions and update questions column
    for (const exam of exams) {
      console.log(`Processing exam ${exam.id}: ${exam.title}`);

      const [questions] = await pool.query(
        'SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num ASC',
        [exam.id]
      );

      if (questions.length > 0) {
        // Format questions
        const formattedQuestions = questions.map(q => {
          let options = [];
          try {
            options = JSON.parse(q.options);
          } catch (e) {
            if (typeof q.options === 'string') {
              options = q.options.split(/,|，/).map(opt => opt.trim()).filter(Boolean);
            }
          }

          return {
            id: q.id, // Keep original ID if needed, or generate new UUIDs if we want to detach completely
            type: q.type,
            content: q.content,
            options: options,
            correct_answer: q.correct_answer,
            score: parseFloat(q.score),
            explanation: q.explanation,
            order_num: q.order_num
          };
        });

        const questionsJson = JSON.stringify(formattedQuestions);

        await pool.query(
          'UPDATE exams SET questions = ? WHERE id = ?',
          [questionsJson, exam.id]
        );
        console.log(`  Updated exam ${exam.id} with ${questions.length} questions.`);
      } else {
        // Initialize with empty array
        await pool.query(
          'UPDATE exams SET questions = ? WHERE id = ?',
          ['[]', exam.id]
        );
        console.log(`  Updated exam ${exam.id} with empty questions list.`);
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
