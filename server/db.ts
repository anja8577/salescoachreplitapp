import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  min: 8, // Increase minimum connections
  idleTimeoutMillis: 120000, // 2 minutes keep-alive
  connectionTimeoutMillis: 2000, // Increase timeout
});

// Pre-warm connection pool and maintain keep-alive
async function warmPool() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('🔥 Database connection pool warmed');
  } catch (error) {
    console.warn('⚠️ Failed to warm connection pool:', error);
  }
}

// Keep connections alive with periodic queries
function maintainConnections() {
  setInterval(async () => {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch (error) {
      console.warn('Connection maintenance failed:', error);
    }
  }, 30000); // Every 30 seconds
}

// Initialize on startup
warmPool().then(() => {
  maintainConnections();
});

export const db = drizzle({ client: pool, schema });