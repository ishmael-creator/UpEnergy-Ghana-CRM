require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runSetup() {
  try {
    console.log("Connecting to database...");
    
    // 1. Add attachments column
    await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS attachments TEXT;`);
    console.log("✅ Added 'attachments' column to tickets table.");

    // 2. Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          message TEXT NOT NULL,
          ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ Created 'notifications' table.");

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    pool.end();
  }
}

runSetup();