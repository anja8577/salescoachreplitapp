
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { users, type User, type UserRegistration, type UserLogin } from '@shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const SALT_ROUNDS = 10;

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(userId: number): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  }

  static verifyToken(token: string): { userId: number } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId: number };
    } catch {
      return null;
    }
  }

  static async register(data: UserRegistration): Promise<User> {
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
    if (existingUser.length > 0) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user
    const [newUser] = await db.insert(users).values({
      fullName: data.fullName,
      email: data.email,
      team: data.team || null,
      passwordHash,
      provider: 'email'
    }).returning();

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword as User;
  }

  static async login(data: UserLogin): Promise<User | null> {
    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
    if (!user || !user.passwordHash) {
      return null;
    }

    // Verify password
    const isValid = await this.comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  static async getUserById(id: number): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) return null;

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  static async generateResetToken(email: string): Promise<string | null> {
    // Check if user exists
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return null;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiryTime = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await db.update(users)
      .set({ 
        resetToken,
        resetTokenExpiry: expiryTime
      })
      .where(eq(users.email, email));

    return resetToken;
  }

  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // Find user with valid token
    const [user] = await db.select()
      .from(users)
      .where(eq(users.resetToken, token))
      .limit(1);

    if (!user || !user.resetTokenExpiry) {
      return false;
    }

    // Check if token has expired
    if (new Date() > user.resetTokenExpiry) {
      return false;
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update password and clear reset token
    await db.update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null
      })
      .where(eq(users.id, user.id));

    return true;
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) return null;

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
}
