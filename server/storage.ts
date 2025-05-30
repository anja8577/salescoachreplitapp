import { 
  steps, substeps, behaviors, assessments, assessmentScores,
  type Step, type Substep, type Behavior, type Assessment, type AssessmentScore,
  type InsertStep, type InsertSubstep, type InsertBehavior, type InsertAssessment, type InsertAssessmentScore
} from "@shared/schema";
import { db } from "./db";
import { eq, asc } from "drizzle-orm";

export interface IStorage {
  // Steps
  getAllSteps(): Promise<(Step & { substeps: (Substep & { behaviors: Behavior[] })[] })[]>;
  createStep(step: InsertStep): Promise<Step>;
  
  // Substeps
  createSubstep(substep: InsertSubstep): Promise<Substep>;
  
  // Behaviors
  createBehavior(behavior: InsertBehavior): Promise<Behavior>;
  
  // Assessments
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  getAssessment(id: number): Promise<Assessment | undefined>;
  
  // Assessment Scores
  getAssessmentScores(assessmentId: number): Promise<AssessmentScore[]>;
  updateAssessmentScore(assessmentId: number, behaviorId: number, checked: boolean): Promise<AssessmentScore>;
  
  // Initialize default data
  initializeDefaultData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAllSteps(): Promise<(Step & { substeps: (Substep & { behaviors: Behavior[] })[] })[]> {
    const result = await db.query.steps.findMany({
      orderBy: [asc(steps.order)],
      with: {
        substeps: {
          orderBy: [asc(substeps.order)],
          with: {
            behaviors: {
              orderBy: [asc(behaviors.proficiencyLevel), asc(behaviors.order)],
            },
          },
        },
      },
    });
    return result;
  }

  async createStep(step: InsertStep): Promise<Step> {
    const [created] = await db.insert(steps).values(step).returning();
    return created;
  }

  async createSubstep(substep: InsertSubstep): Promise<Substep> {
    const [created] = await db.insert(substeps).values(substep).returning();
    return created;
  }

  async createBehavior(behavior: InsertBehavior): Promise<Behavior> {
    const [created] = await db.insert(behaviors).values(behavior).returning();
    return created;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [created] = await db.insert(assessments).values(assessment).returning();
    return created;
  }

  async getAssessment(id: number): Promise<Assessment | undefined> {
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
    return assessment || undefined;
  }

  async getAssessmentScores(assessmentId: number): Promise<AssessmentScore[]> {
    return await db.select().from(assessmentScores).where(eq(assessmentScores.assessmentId, assessmentId));
  }

  async updateAssessmentScore(assessmentId: number, behaviorId: number, checked: boolean): Promise<AssessmentScore> {
    // Check if score already exists
    const [existing] = await db
      .select()
      .from(assessmentScores)
      .where(eq(assessmentScores.assessmentId, assessmentId))
      .where(eq(assessmentScores.behaviorId, behaviorId));

    if (existing) {
      const [updated] = await db
        .update(assessmentScores)
        .set({ checked })
        .where(eq(assessmentScores.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(assessmentScores)
        .values({ assessmentId, behaviorId, checked })
        .returning();
      return created;
    }
  }

  async initializeDefaultData(): Promise<void> {
    // Check if data already exists
    const existingSteps = await db.select().from(steps);
    if (existingSteps.length > 0) {
      return; // Data already initialized
    }

    // Step 1: Call Preparation
    const step1 = await this.createStep({
      title: "Call Preparation",
      description: "Objective setting and planning behaviors",
      order: 1,
    });

    const substep1_1 = await this.createSubstep({
      stepId: step1.id,
      title: "Objective Setting",
      order: 1,
    });

    // Level 1 behaviors
    await this.createBehavior({
      substepId: substep1_1.id,
      description: "Prepares (ad-hoc) a call objective",
      proficiencyLevel: 1,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep1_1.id,
      description: "Plans calls a week ahead",
      proficiencyLevel: 1,
      order: 2,
    });
    await this.createBehavior({
      substepId: substep1_1.id,
      description: "Formulates the open questions that should be raised within a call",
      proficiencyLevel: 1,
      order: 3,
    });

    // Level 2 behaviors
    await this.createBehavior({
      substepId: substep1_1.id,
      description: "Prepares a SMART call objective",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep1_1.id,
      description: "Prepares a call agenda",
      proficiencyLevel: 2,
      order: 2,
    });
    await this.createBehavior({
      substepId: substep1_1.id,
      description: "Defines key/directive questions that should be raised within a call",
      proficiencyLevel: 2,
      order: 3,
    });

    // Level 3 behaviors
    await this.createBehavior({
      substepId: substep1_1.id,
      description: "Has both short and long term objectives identified for that customer",
      proficiencyLevel: 3,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep1_1.id,
      description: "Uses information about the adaptation ladder",
      proficiencyLevel: 3,
      order: 2,
    });

    // Level 4 behaviors
    await this.createBehavior({
      substepId: substep1_1.id,
      description: "Focuses on genuinely meeting customer needs, demonstrating curiosity from the HCP's perspective",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 2: Call Review
    const step2 = await this.createStep({
      title: "Call Review",
      description: "Previous call analysis and preparation behaviors",
      order: 2,
    });

    const substep2_1 = await this.createSubstep({
      stepId: step2.id,
      title: "Previous Call Analysis",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Enters call with little or no review of the previous call notes/history",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Has reviewed previous call notes/sales history in CRM",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Makes assumptions about client needs",
      proficiencyLevel: 2,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Demonstrates awareness and knowledge of competitor activities",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Is always aware of the environment and collects relevant information to use in the call (observes patients, secretary)",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 3: Material Selection
    const step3 = await this.createStep({
      title: "Material Selection",
      description: "Promo material and presentation behaviors",
      order: 3,
    });

    const substep3_1 = await this.createSubstep({
      stepId: step3.id,
      title: "Material and Presentation Planning",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Chooses fitting promo materials",
      proficiencyLevel: 1,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Chooses the features and benefits to focus on",
      proficiencyLevel: 1,
      order: 2,
    });
    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Checks the iPad before the visit (presentation, charge)",
      proficiencyLevel: 1,
      order: 3,
    });

    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Prepares a hook/hinge",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Plans how to respond to objections and how to position alternatives",
      proficiencyLevel: 2,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Plans the call individually, anticipating questions which will be asked, choosing materials and solutions to position and options for closing",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Prepares individual solutions that will demonstrate added value for the customer",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 4: Introduction
    const step4 = await this.createStep({
      title: "Introduction",
      description: "Personal introduction behaviors",
      order: 4,
    });

    const substep4_1 = await this.createSubstep({
      stepId: step4.id,
      title: "Professional Introduction",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_1.id,
      description: "Introduces themself & the organisation",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_1.id,
      description: "Calls the doctor by name",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep4_1.id,
      description: "Mentions the reason for the visit",
      proficiencyLevel: 2,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep4_1.id,
      description: "Demonstrates effective presence: interest, conviction, appropriate energy (through body language)",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_1.id,
      description: "Is a recognized, trusted contact for the customer",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 5: Atmosphere
    const step5 = await this.createStep({
      title: "Atmosphere",
      description: "Creating positive environment behaviors",
      order: 5,
    });

    const substep5_1 = await this.createSubstep({
      stepId: step5.id,
      title: "Environment Creation",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Creates a positive atmosphere (friendly, smiling, well-presented, polite)",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Understands various customer personality styles (insight colors)",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Shows flexibility in own style to meet different customer personality styles",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Creates a trusting client relationship through presence, charisma and a high level of customer/technical, market knowledge",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 6: Relationship
    const step6 = await this.createStep({
      title: "Relationship",
      description: "Building trust and client relationship behaviors",
      order: 6,
    });

    const substep6_1 = await this.createSubstep({
      stepId: step6.id,
      title: "Trust Building",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_1.id,
      description: "Creates a trusting client relationship through presence, charisma and a high level of customer/technical, market knowledge",
      proficiencyLevel: 4,
      order: 1,
    });
  }
}

export const storage = new DatabaseStorage();
