import { 
  type Step, type Substep, type Behavior, type Assessment, type AssessmentScore,
  type InsertStep, type InsertSubstep, type InsertBehavior, type InsertAssessment, type InsertAssessmentScore
} from "@shared/schema";

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

export class MemStorage implements IStorage {
  private steps: Map<number, Step> = new Map();
  private substeps: Map<number, Substep> = new Map();
  private behaviors: Map<number, Behavior> = new Map();
  private assessments: Map<number, Assessment> = new Map();
  private assessmentScores: Map<string, AssessmentScore> = new Map();
  private nextId = 1;

  async getAllSteps(): Promise<(Step & { substeps: (Substep & { behaviors: Behavior[] })[] })[]> {
    const stepsArray = Array.from(this.steps.values()).sort((a, b) => a.order - b.order);
    
    return stepsArray.map(step => ({
      ...step,
      substeps: Array.from(this.substeps.values())
        .filter(substep => substep.stepId === step.id)
        .sort((a, b) => a.order - b.order)
        .map(substep => ({
          ...substep,
          behaviors: Array.from(this.behaviors.values())
            .filter(behavior => behavior.substepId === substep.id)
            .sort((a, b) => a.proficiencyLevel - b.proficiencyLevel || a.order - b.order)
        }))
    }));
  }

  async createStep(step: InsertStep): Promise<Step> {
    const newStep: Step = { ...step, id: this.nextId++ };
    this.steps.set(newStep.id, newStep);
    return newStep;
  }

  async createSubstep(substep: InsertSubstep): Promise<Substep> {
    const newSubstep: Substep = { ...substep, id: this.nextId++ };
    this.substeps.set(newSubstep.id, newSubstep);
    return newSubstep;
  }

  async createBehavior(behavior: InsertBehavior): Promise<Behavior> {
    const newBehavior: Behavior = { ...behavior, id: this.nextId++ };
    this.behaviors.set(newBehavior.id, newBehavior);
    return newBehavior;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const newAssessment: Assessment = { 
      ...assessment, 
      id: this.nextId++, 
      createdAt: new Date() 
    };
    this.assessments.set(newAssessment.id, newAssessment);
    return newAssessment;
  }

  async getAssessment(id: number): Promise<Assessment | undefined> {
    return this.assessments.get(id);
  }

  async getAssessmentScores(assessmentId: number): Promise<AssessmentScore[]> {
    return Array.from(this.assessmentScores.values())
      .filter(score => score.assessmentId === assessmentId);
  }

  async updateAssessmentScore(assessmentId: number, behaviorId: number, checked: boolean): Promise<AssessmentScore> {
    const key = `${assessmentId}-${behaviorId}`;
    const existing = this.assessmentScores.get(key);

    if (existing) {
      const updated = { ...existing, checked };
      this.assessmentScores.set(key, updated);
      return updated;
    } else {
      const newScore: AssessmentScore = {
        id: this.nextId++,
        assessmentId,
        behaviorId,
        checked
      };
      this.assessmentScores.set(key, newScore);
      return newScore;
    }
  }

  async initializeDefaultData(): Promise<void> {
    // Check if data already exists
    if (this.steps.size > 0) {
      return; // Data already initialized
    }

    // Step 1: Preparation
    const step1 = await this.createStep({
      title: "Preparation",
      description: "Strategic preparation, client understanding, and technical preparation",
      order: 1,
    });

    const substep1_1 = await this.createSubstep({
      stepId: step1.id,
      title: "Strategic preparation",
      order: 1,
    });

    // Strategic preparation behaviors based on the images
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
      description: "Formulates the open questions, that should be raised within a call",
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
      description: "Defines key/directive questions, that should be raised within a call",
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

    // Client understanding substep
    const substep1_2 = await this.createSubstep({
      stepId: step1.id,
      title: "Client understanding",
      order: 2,
    });

    await this.createBehavior({
      substepId: substep1_2.id,
      description: "Enters call with little or no review of the previous call notes/history",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep1_2.id,
      description: "Has reviewed previous call notes/sales history in CRM",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep1_2.id,
      description: "Makes assumptions about client needs",
      proficiencyLevel: 2,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep1_2.id,
      description: "Demonstrates awareness and knowledge of competitor activities",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep1_2.id,
      description: "Is always aware of the environment and collects relevant information to use in the call (observes patients, secretary)",
      proficiencyLevel: 4,
      order: 1,
    });

    // Technical preparation substep
    const substep1_3 = await this.createSubstep({
      stepId: step1.id,
      title: "Technical preparation",
      order: 3,
    });

    await this.createBehavior({
      substepId: substep1_3.id,
      description: "Chooses fitting promo materials",
      proficiencyLevel: 1,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep1_3.id,
      description: "Chooses the features and benefits to focus on",
      proficiencyLevel: 1,
      order: 2,
    });
    await this.createBehavior({
      substepId: substep1_3.id,
      description: "Checks the iPad before the visit (presentation, charge)",
      proficiencyLevel: 1,
      order: 3,
    });

    await this.createBehavior({
      substepId: substep1_3.id,
      description: "Prepares a hook\\hinge",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep1_3.id,
      description: "Plans how to respond to objections and how to position alternatives",
      proficiencyLevel: 2,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep1_3.id,
      description: "Plans the call individually, anticipating questions which will be asked, choosing materials and solutions to position and options for closing",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep1_3.id,
      description: "Prepares individual solutions that will demonstrate added value for the customer",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 2: Opening
    const step2 = await this.createStep({
      title: "Opening",
      description: "Greeting & introduction and relating behaviors",
      order: 2,
    });

    const substep2_1 = await this.createSubstep({
      stepId: step2.id,
      title: "Greeting & introduction",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Introduces themself & the organisation",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Calls the doctor by name",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Mentions the reason for the visit",
      proficiencyLevel: 2,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Demonstrates effective presence: interest, conviction, appropriate energy (through body language)",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_1.id,
      description: "Is a recognized, trusted contact for the customer",
      proficiencyLevel: 4,
      order: 1,
    });

    // Relating substep
    const substep2_2 = await this.createSubstep({
      stepId: step2.id,
      title: "Relating",
      order: 2,
    });

    await this.createBehavior({
      substepId: substep2_2.id,
      description: "Creates a positive atmosphere (friendly, smiling, well-presented, polite)",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_2.id,
      description: "Understands various customer personality styles (insight colors)",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_2.id,
      description: "Shows flexibility in own style to meet different customer personality styles",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_2.id,
      description: "Creates a trusting client relationship through presence, charisma and a high level of customer\\technical, market knowledge",
      proficiencyLevel: 4,
      order: 1,
    });

    // Add placeholder steps 3-6 for now (you can add more behaviors later)
    await this.createStep({
      title: "Step 3",
      description: "Step 3 behaviors",
      order: 3,
    });

    await this.createStep({
      title: "Step 4", 
      description: "Step 4 behaviors",
      order: 4,
    });

    await this.createStep({
      title: "Step 5",
      description: "Step 5 behaviors", 
      order: 5,
    });

    await this.createStep({
      title: "Step 6",
      description: "Step 6 behaviors",
      order: 6,
    });
  }
}

export const storage = new MemStorage();
