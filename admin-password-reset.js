// Emergency password reset utility for blocked email addresses
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema: { users } });

async function resetPasswordDirect(email, newPassword) {
  try {
    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update user password directly
    const result = await db.update(users)
      .set({ 
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null 
      })
      .where(eq(users.email, email))
      .returning({ id: users.id, fullName: users.fullName, email: users.email });

    if (result.length === 0) {
      console.log(`No user found with email: ${email}`);
      return false;
    }

    console.log(`Password reset successfully for user: ${result[0].fullName} (${result[0].email})`);
    return true;
  } catch (error) {
    console.error('Password reset error:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Usage: node admin-password-reset.js email@domain.com newpassword
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node admin-password-reset.js <email> <new-password>');
  process.exit(1);
}

resetPasswordDirect(email, password);