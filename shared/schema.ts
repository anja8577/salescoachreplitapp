import { pgTable, text, serial, integer, boolean, timestamp, varchar, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const steps = pgTable("steps", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  targetScore: integer("target_score").notNull(),
  order: integer("order").notNull(),
});

export const substeps = pgTable("substeps", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").notNull().references(() => steps.id),
  title: text("title").notNull(),
  order: integer("order").notNull(),
});

export const behaviors = pgTable("behaviors", {
  id: serial("id").primaryKey(),
  substepId: integer("substep_id").notNull().references(() => substeps.id),
  description: text("description").notNull(),
  proficiencyLevel: integer("proficiency_level").notNull(), // 1-4
  order: integer("order").notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name").notNull(),
  email: varchar("email").notNull().unique(),
  team: varchar("team"),
  createdAt: timestamp("created_at").defaultNow(),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").default(false),
  provider: text("provider").$type<"email" | "google" | "apple">(),
  providerId: text("provider_id"),
});

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(), // Assessor (person doing the assessment)
  assesseeName: text("assessee_name").notNull(), // Person being assessed
  createdAt: timestamp("created_at").defaultNow(),
});

export const assessmentScores = pgTable("assessment_scores", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull().references(() => assessments.id),
  behaviorId: integer("behavior_id").notNull().references(() => behaviors.id),
  checked: boolean("checked").notNull().default(false),
}, (table) => ({
  uniqueAssessmentBehavior: unique().on(table.assessmentId, table.behaviorId),
}));

export const stepsRelations = relations(steps, ({ many }) => ({
  substeps: many(substeps),
}));

export const substepsRelations = relations(substeps, ({ one, many }) => ({
  step: one(steps, {
    fields: [substeps.stepId],
    references: [steps.id],
  }),
  behaviors: many(behaviors),
}));

export const behaviorsRelations = relations(behaviors, ({ one, many }) => ({
  substep: one(substeps, {
    fields: [behaviors.substepId],
    references: [substeps.id],
  }),
  scores: many(assessmentScores),
}));

export const usersRelations = relations(users, ({ many }) => ({
  assessments: many(assessments),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  user: one(users, {
    fields: [assessments.userId],
    references: [users.id],
  }),
  scores: many(assessmentScores),
}));

export const assessmentScoresRelations = relations(assessmentScores, ({ one }) => ({
  assessment: one(assessments, {
    fields: [assessmentScores.assessmentId],
    references: [assessments.id],
  }),
  behavior: one(behaviors, {
    fields: [assessmentScores.behaviorId],
    references: [behaviors.id],
  }),
}));

export const insertStepSchema = createInsertSchema(steps).omit({
  id: true,
});

export const insertSubstepSchema = createInsertSchema(substeps).omit({
  id: true,
});

export const insertBehaviorSchema = createInsertSchema(behaviors).omit({
  id: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  createdAt: true,
});

export const insertAssessmentScoreSchema = createInsertSchema(assessmentScores).omit({
  id: true,
});

export type Step = typeof steps.$inferSelect;
export type Substep = typeof substeps.$inferSelect;
export type Behavior = typeof behaviors.$inferSelect;
export type User = typeof users.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type AssessmentScore = typeof assessmentScores.$inferSelect;

export type InsertStep = z.infer<typeof insertStepSchema>;
export type InsertSubstep = z.infer<typeof insertSubstepSchema>;
export type InsertBehavior = z.infer<typeof insertBehaviorSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type InsertAssessmentScore = z.infer<typeof insertAssessmentScoreSchema>;

export interface UserRegistration {
  fullName: string;
  email: string;
  password: string;
  team?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}