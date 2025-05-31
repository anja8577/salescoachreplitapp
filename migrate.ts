
import { db } from "./server/db";

async function migrate() {
  try {
    console.log("Starting migration...");
    
    // Add missing columns to users table
    await db.execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS provider TEXT,
      ADD COLUMN IF NOT EXISTS provider_id TEXT
    `);
    
    // Add assessee_name column to assessments table
    await db.execute(`
      ALTER TABLE assessments 
      ADD COLUMN IF NOT EXISTS assessee_name TEXT
    `);
    
    // Update existing assessments with a default value if needed
    await db.execute(`
      UPDATE assessments 
      SET assessee_name = 'Unknown Assessee' 
      WHERE assessee_name IS NULL
    `);
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrate();
