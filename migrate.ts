
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
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrate();
