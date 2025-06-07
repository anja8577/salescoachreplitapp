import { db } from './db';
import { sql } from 'drizzle-orm';

export class PerformanceOptimizer {
  static async createIndexes(): Promise<void> {
    console.log('🚀 Creating performance indexes...');
    const startTime = Date.now();
    
    try {
      // Create index on users.team for fast team-based queries
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_users_team 
        ON users(team) 
        WHERE team IS NOT NULL
      `);
      
      // Create index on users.email for authentication
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_users_email 
        ON users(email)
      `);
      
      // Create composite index for team and updated_at for better sorting
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_users_team_updated 
        ON users(team, updated_at) 
        WHERE team IS NOT NULL
      `);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Performance indexes created in ${duration}ms`);
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
    }
  }
  
  static async analyzeQueryPerformance(): Promise<void> {
    console.log('📊 Analyzing query performance...');
    
    try {
      // Analyze the most common team queries
      const result = await db.execute(sql`
        EXPLAIN ANALYZE SELECT * FROM users WHERE team = 'Team North'
      `);
      
      console.log('Query plan:', result);
    } catch (error) {
      console.error('Error analyzing performance:', error);
    }
  }
  
  static async optimizeDatabase(): Promise<void> {
    console.log('🔧 Running database optimizations...');
    
    try {
      // Update table statistics for better query planning
      await db.execute(sql`ANALYZE users`);
      
      // Vacuum to reclaim space and update statistics
      await db.execute(sql`VACUUM ANALYZE users`);
      
      console.log('✅ Database optimization completed');
    } catch (error) {
      console.error('❌ Database optimization failed:', error);
    }
  }
}