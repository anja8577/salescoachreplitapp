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

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name").notNull(),
  email: varchar("email").notNull().unique(),
  team: varchar("team"), // Keep for backward compatibility during migration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").default(false),
  provider: text("provider").$type<"email" | "google" | "apple">(),
  providerId: text("provider_id"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
});

export const userTeams = pgTable("user_teams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserTeam: unique().on(table.userId, table.teamId),
}));

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(), // Coach (person doing the assessment)
  assesseeName: text("assessee_name").notNull(), // Coachee being assessed
  context: text("context"), // Assessment context/notes
  keyObservations: text("key_observations"),
  whatWorkedWell: text("what_worked_well"),
  whatCanBeImproved: text("what_can_be_improved"),
  nextSteps: text("next_steps"),
  pdfFilePath: text("pdf_file_path"), // Path to generated PDF report
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

export const stepScores = pgTable("step_scores", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull().references(() => assessments.id),
  stepId: integer("step_id").notNull().references(() => steps.id),
  level: integer("level").notNull(), // 1=Learner, 2=Qualified, 3=Experienced, 4=Master
}, (table) => ({
  uniqueAssessmentStep: unique().on(table.assessmentId, table.stepId),
}));

export const stepsRelations = relations(steps, ({ many }) => ({
  substeps: many(substeps),
  stepScores: many(stepScores),
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

export const teamsRelations = relations(teams, ({ many }) => ({
  userTeams: many(userTeams),
}));

export const usersRelations = relations(users, ({ many }) => ({
  assessments: many(assessments),
  userTeams: many(userTeams),
}));

export const userTeamsRelations = relations(userTeams, ({ one }) => ({
  user: one(users, {
    fields: [userTeams.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [userTeams.teamId],
    references: [teams.id],
  }),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  user: one(users, {
    fields: [assessments.userId],
    references: [users.id],
  }),
  scores: many(assessmentScores),
  stepScores: many(stepScores),
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

export const stepScoresRelations = relations(stepScores, ({ one }) => ({
  assessment: one(assessments, {
    fields: [stepScores.assessmentId],
    references: [assessments.id],
  }),
  step: one(steps, {
    fields: [stepScores.stepId],
    references: [steps.id],
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

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const insertStepScoreSchema = createInsertSchema(stepScores).omit({
  id: true,
});

export const insertUserTeamSchema = createInsertSchema(userTeams).omit({
  id: true,
  createdAt: true,
});

export type Step = typeof steps.$inferSelect;
export type Substep = typeof substeps.$inferSelect;
export type Behavior = typeof behaviors.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type User = typeof users.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type AssessmentScore = typeof assessmentScores.$inferSelect;
export type StepScore = typeof stepScores.$inferSelect;
export type UserTeam = typeof userTeams.$inferSelect;

export type InsertStep = z.infer<typeof insertStepSchema>;
export type InsertSubstep = z.infer<typeof insertSubstepSchema>;
export type InsertBehavior = z.infer<typeof insertBehaviorSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type InsertAssessmentScore = z.infer<typeof insertAssessmentScoreSchema>;
export type InsertStepScore = z.infer<typeof insertStepScoreSchema>;
export type InsertUserTeam = z.infer<typeof insertUserTeamSchema>;

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