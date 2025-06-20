import { 
  type Step, type Substep, type Behavior, type Team, type User, type Assessment, type AssessmentScore, type StepScore, type UserTeam, type UserWithTeams,
  type InsertStep, type InsertSubstep, type InsertBehavior, type InsertTeam, type InsertUser, type InsertAssessment, type InsertAssessmentScore, type InsertStepScore, type InsertUserTeam,
  steps, substeps, behaviors, teams, users, assessments, assessmentScores, stepScores, userTeams
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ne, isNotNull, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Steps
  getAllSteps(): Promise<(Step & { substeps: (Substep & { behaviors: Behavior[] })[] })[]>;
  createStep(step: InsertStep): Promise<Step>;

  // Substeps
  createSubstep(substep: InsertSubstep): Promise<Substep>;

  // Behaviors
  createBehavior(behavior: InsertBehavior): Promise<Behavior>;

  // Teams
  getAllTeams(): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  deleteTeam(teamId: number): Promise<void>;
  getUniqueTeams(): Promise<string[]>;

  // Users
  getAllUsers(): Promise<UserWithTeams[]>;
  createUser(user: InsertUser): Promise<User>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: number, user: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  bulkUpdateUsersTeam(teamName: string, newTeamName: string | null): Promise<number>;
  bulkUpdateUserTeams(updates: { userId: number; team: string | null }[]): Promise<number>;

  // User-Team Relationships
  getUserTeams(userId: number): Promise<Team[]>;
  getTeamUsers(teamId: number): Promise<User[]>;
  addUserToTeam(userId: number, teamId: number): Promise<UserTeam>;
  removeUserFromTeam(userId: number, teamId: number): Promise<void>;
  bulkUpdateTeamMembership(teamId: number, userIds: number[]): Promise<void>;

  // Assessments
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  updateAssessment(id: number, assessment: Partial<Assessment>): Promise<Assessment>;
  getAssessment(id: number): Promise<Assessment | undefined>;
  getAssessmentWithUser(id: number): Promise<(Assessment & { user: User }) | undefined>;
  getAllAssessments(): Promise<Assessment[]>;
  getLatestAssessmentForUser(userId: number): Promise<Assessment | undefined>;
  getLatestAssessmentForCoachee(coacheeName: string): Promise<Assessment | undefined>;
  getPreviousAssessmentForCoachee(coacheeName: string, excludeId: number): Promise<Assessment | undefined>;

  // Assessment Scores
  getAssessmentScores(assessmentId: number): Promise<AssessmentScore[]>;
  updateAssessmentScore(assessmentId: number, behaviorId: number, checked: boolean): Promise<AssessmentScore>;

  // Step Scores
  getStepScores(assessmentId: number): Promise<StepScore[]>;
  updateStepScore(assessmentId: number, stepId: number, level: number): Promise<StepScore>;

  // Initialize default data
  initializeDefaultData(): Promise<void>;
}

export class MemStorage implements IStorage {
  private steps: Map<number, Step> = new Map();
  private substeps: Map<number, Substep> = new Map();
  private behaviors: Map<number, Behavior> = new Map();
  private users: Map<number, User> = new Map();
  private assessments: Map<number, Assessment> = new Map();
  private assessmentScores: Map<string, AssessmentScore> = new Map();
  private stepScores: Map<string, StepScore> = new Map();
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

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = { 
      id: this.nextId++,
      fullName: user.fullName,
      email: user.email,
      team: user.team || null,
      createdAt: new Date() 
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      throw new Error('User not found');
    }
    const updatedUser = { ...existingUser, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    this.users.delete(id);
  }

  async getUniqueTeams(): Promise<string[]> {
    const teams = new Set<string>();
    const userList = Array.from(this.users.values());
    for (const user of userList) {
      if (user.team) {
        teams.add(user.team);
      }
    }
    return Array.from(teams);
  }

  async bulkUpdateUsersTeam(teamName: string, newTeamName: string | null): Promise<number> {
    console.log(`MemStorage: Bulk updating users from team "${teamName}" to "${newTeamName}"`);
    let count = 0;
    
    for (const user of this.users.values()) {
      if (user.team === teamName) {
        user.team = newTeamName;
        count++;
      }
    }
    
    console.log(`MemStorage: Bulk updated ${count} users`);
    return count;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const newAssessment: Assessment = { 
      id: this.nextId++,
      title: assessment.title,
      userId: assessment.userId,
      assesseeName: assessment.assesseeName,
      context: assessment.context ?? null,
      keyObservations: assessment.keyObservations ?? null,
      whatWorkedWell: assessment.whatWorkedWell ?? null,
      whatCanBeImproved: assessment.whatCanBeImproved ?? null,
      nextSteps: assessment.nextSteps ?? null,
      pdfFilePath: null,
      status: assessment.status ?? 'draft',
      createdAt: new Date() 
    };
    this.assessments.set(newAssessment.id, newAssessment);
    return newAssessment;
  }

  async updateAssessment(id: number, assessmentUpdate: Partial<Assessment>): Promise<Assessment> {
    const existingAssessment = this.assessments.get(id);
    if (!existingAssessment) {
      throw new Error(`Assessment with id ${id} not found`);
    }
    
    const updatedAssessment: Assessment = {
      ...existingAssessment,
      ...assessmentUpdate,
      id: existingAssessment.id,
      createdAt: existingAssessment.createdAt
    };
    
    this.assessments.set(id, updatedAssessment);
    return updatedAssessment;
  }

  async getAssessment(id: number): Promise<Assessment | undefined> {
    return this.assessments.get(id);
  }

  async getAssessmentWithUser(id: number): Promise<(Assessment & { user: User }) | undefined> {
    const assessment = this.assessments.get(id);
    if (!assessment) return undefined;

    const user = this.users.get(assessment.userId);
    if (!user) return undefined;

    return { ...assessment, user };
  }

  async getAllAssessments(): Promise<Assessment[]> {
    return Array.from(this.assessments.values()).sort((a, b) => 
      new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
    );
  }

  async getLatestAssessmentForUser(userId: number): Promise<Assessment | undefined> {
    const userAssessments = Array.from(this.assessments.values())
      .filter(assessment => assessment.userId === userId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    
    return userAssessments[0];
  }

  async getLatestAssessmentForCoachee(coacheeName: string): Promise<Assessment | undefined> {
    const coacheeAssessments = Array.from(this.assessments.values())
      .filter(assessment => assessment.assesseeName === coacheeName)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    
    return coacheeAssessments[0];
  }

  async getPreviousAssessmentForCoachee(coacheeName: string, excludeId: number): Promise<Assessment | undefined> {
    const coacheeAssessments = Array.from(this.assessments.values())
      .filter(assessment => assessment.assesseeName === coacheeName && assessment.id !== excludeId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    
    return coacheeAssessments[0];
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

  async getStepScores(assessmentId: number): Promise<StepScore[]> {
    return Array.from(this.stepScores.values()).filter(score => score.assessmentId === assessmentId);
  }

  async updateStepScore(assessmentId: number, stepId: number, level: number): Promise<StepScore> {
    const key = `${assessmentId}-${stepId}`;
    const existingScore = this.stepScores.get(key);
    
    if (existingScore) {
      existingScore.level = level;
      return existingScore;
    } else {
      const newScore: StepScore = {
        id: this.nextId++,
        assessmentId,
        stepId,
        level,
      };
      this.stepScores.set(key, newScore);
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
      targetScore: 3,
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
      targetScore: 3,
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

    // Add Summary & Hinge substep to Step 2 (Opening)
    const substep2_3 = await this.createSubstep({
      stepId: step2.id,
      title: "Summary & hinge",
      order: 3,
    });

    await this.createBehavior({
      substepId: substep2_3.id,
      description: "Summarises by recapping the last agenda",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_3.id,
      description: "Creates interest with a catchy hook/hinge",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_3.id,
      description: "Positions the purpose of the visit and the benefits for the customer to create interest through the opening statement",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_3.id,
      description: "Raises an issue\\challenge which is relevant for the customer (and for which we have a solution), the potential impact on him\\her and the needs that it creates",
      proficiencyLevel: 4,
      order: 1,
    });

    // Add Agenda Introduction substep to Step 2 (Opening)
    const substep2_4 = await this.createSubstep({
      stepId: step2.id,
      title: "Agenda introduction",
      order: 4,
    });

    await this.createBehavior({
      substepId: substep2_4.id,
      description: "Takes cues from the customer for timing and checks it",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_4.id,
      description: "Checks the relevance of the agenda and asks the customers for input to the meeting agenda",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_4.id,
      description: "Builds credibility and provides content",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep2_4.id,
      description: "Positions the wish to ask questions to help focus on the client's needs",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 3: Need Dialog
    const step3 = await this.createStep({
      title: "Need Dialog",
      description: "Questioning and active listening behaviors",
      targetScore: 3,
      order: 3,
    });

    const substep3_1 = await this.createSubstep({
      stepId: step3.id,
      title: "Questioning",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Asks questions to gather information about current situation (HCP's potential)",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Explores HCP's satisfaction with the current situation (what is going well, what should change)",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Asks questions about the level of commitment",
      proficiencyLevel: 2,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Uses questioning techniques (prefacing/drilling down/trading) to create a need dialogue",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep3_1.id,
      description: "Uses a combination of different question types and techniques to appropriately expand the dialogue, uncovers and understands the hidden needs",
      proficiencyLevel: 4,
      order: 1,
    });

    const substep3_2 = await this.createSubstep({
      stepId: step3.id,
      title: "Active listening",
      order: 2,
    });

    await this.createBehavior({
      substepId: substep3_2.id,
      description: "Listens attentively",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep3_2.id,
      description: "Uses verbal and non-verbal reinforcement",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep3_2.id,
      description: "Paces questions effectively (keeps silent after asking a question, avoids multiple-choice questions, asks one question at time); uses the answer as a hinge",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep3_2.id,
      description: "Listens to the needs in detail, to understand, not to respond (effective listening)",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 4: Solution Dialog
    const step4 = await this.createStep({
      title: "Solution Dialog",
      description: "Structuring, positioning, and checking solution behaviors",
      targetScore: 3,
      order: 4,
    });

    const substep4_1 = await this.createSubstep({
      stepId: step4.id,
      title: "Structuring",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_1.id,
      description: "Provides an overview of what is about to be said",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_1.id,
      description: "Introduces the solution without giving details or checking",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_1.id,
      description: "Shares a relevant key message for the solution",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_1.id,
      description: "Delivers a well-thought-out individually tailored message and a solution for the specific HCP's challenge",
      proficiencyLevel: 4,
      order: 1,
    });

    const substep4_2 = await this.createSubstep({
      stepId: step4.id,
      title: "Positioning solution",
      order: 2,
    });

    await this.createBehavior({
      substepId: substep4_2.id,
      description: "Links to needs using features and benefits",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_2.id,
      description: "Offers a solution as a reaction to the prior conversation",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep4_2.id,
      description: "Uses promotional materials in line with the brand strategy",
      proficiencyLevel: 2,
      order: 2,
    });
    await this.createBehavior({
      substepId: substep4_2.id,
      description: "Supports the presentation by using iPAD content",
      proficiencyLevel: 2,
      order: 3,
    });

    await this.createBehavior({
      substepId: substep4_2.id,
      description: "Offers a solution by including value adding features and benefits (added value could be expertise, service, network etc)",
      proficiencyLevel: 3,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep4_2.id,
      description: "Uses visual aids appropriately and selectively",
      proficiencyLevel: 3,
      order: 2,
    });
    await this.createBehavior({
      substepId: substep4_2.id,
      description: "Easily navigates the iPAD content",
      proficiencyLevel: 3,
      order: 3,
    });

    await this.createBehavior({
      substepId: substep4_2.id,
      description: "Delivers a win-win solution that makes the HCP view them as a trusted advisor",
      proficiencyLevel: 4,
      order: 1,
    });

    const substep4_3 = await this.createSubstep({
      stepId: step4.id,
      title: "Checking",
      order: 3,
    });

    await this.createBehavior({
      substepId: substep4_3.id,
      description: "Asks a basic checking question only once",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_3.id,
      description: "Asks basic checking questions throughout the dialogue: how does it sound? What do you think about it?",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep4_3.id,
      description: "Summarises client benefits",
      proficiencyLevel: 3,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep4_3.id,
      description: "Actively uses silence",
      proficiencyLevel: 3,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep4_3.id,
      description: "Concisely summarises and checks for agreement",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 5: Objection Resolution (no substeps)
    const step5 = await this.createStep({
      title: "Objection Resolution",
      description: "Handling objections and maintaining dialogue",
      targetScore: 3,
      order: 5,
    });

    const substep5_1 = await this.createSubstep({
      stepId: step5.id,
      title: "Objection handling",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Knows the objection handling model and partly uses it",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Acknowledges to reduce any customer negativity",
      proficiencyLevel: 2,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Handles common objections",
      proficiencyLevel: 2,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Has prepared for multiple possible objections and uses the objection handling model consistently",
      proficiencyLevel: 3,
      order: 1,
    });
    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Probes to identify the underlying need",
      proficiencyLevel: 3,
      order: 2,
    });

    await this.createBehavior({
      substepId: substep5_1.id,
      description: "Remains calm even with difficult objections; Keeps the dialogue interactive, even if the objection is not resolved; Anticipates most objections; If an objection was not solved, guarantees to give the answer to the client in the next call",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 6: Asking for Commitment
    const step6 = await this.createStep({
      title: "Asking for Commitment",
      description: "Summarizing and securing commitment behaviors",
      targetScore: 3,
      order: 6,
    });

    const substep6_1 = await this.createSubstep({
      stepId: step6.id,
      title: "Summarizing",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_1.id,
      description: "Summarises the focus product information",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_1.id,
      description: "Positions the closing summary by reinforcing key benefits and value",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_1.id,
      description: "Acknowledges the value of the discussion",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_1.id,
      description: "Links the close to the adapted call objective; Summary takes into account the individualized value proposition",
      proficiencyLevel: 4,
      order: 1,
    });

    const substep6_2 = await this.createSubstep({
      stepId: step6.id,
      title: "Asking for commitment",
      order: 2,
    });

    await this.createBehavior({
      substepId: substep6_2.id,
      description: "Is aware of buying signals (both verbal & non verbal), which indicate that it is time to 'ask for commitment'",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_2.id,
      description: "Does a final check for feedback on what has been positioned",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_2.id,
      description: "Gets the commitment on the concrete next steps (for specific patients)",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_2.id,
      description: "Has convinced the HCP with our solution and has agreed on the concrete next steps (by asking implementation questions: who, what, where, when); The HCP commits to try the solution with a number of patients",
      proficiencyLevel: 4,
      order: 1,
    });

    const substep6_3 = await this.createSubstep({
      stepId: step6.id,
      title: "Maintaining rapport",
      order: 3,
    });

    await this.createBehavior({
      substepId: substep6_3.id,
      description: "Continues with a positive atmosphere",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_3.id,
      description: "Demonstrates appreciation for the client's business; Personalises the Close; Is genuine",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_3.id,
      description: "Creates a favourable last impression",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep6_3.id,
      description: "Summarises feelings and attitudes as well as facts and arguments",
      proficiencyLevel: 4,
      order: 1,
    });

    // Step 7: Follow up
    const step7 = await this.createStep({
      title: "Follow up",
      description: "Post-call analysis and planning behaviors",
      targetScore: 3,
      order: 7,
    });

    const substep7_1 = await this.createSubstep({
      stepId: step7.id,
      title: "Analyzing results",
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_1.id,
      description: "Analyses the call results (was the call objective reached?) under manager's guidance",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_1.id,
      description: "Self-critically analyses the call results (what went well?, what should be improved?); Execute on agreements (all action steps)",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_1.id,
      description: "Adjusts/Sets a SMART call objective for the next call",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_1.id,
      description: "Develops a plan to improve/enhance the outcome of the visits",
      proficiencyLevel: 4,
      order: 1,
    });

    const substep7_2 = await this.createSubstep({
      stepId: step7.id,
      title: "Self-analyzing",
      order: 2,
    });

    await this.createBehavior({
      substepId: substep7_2.id,
      description: "Analyses the call for strong points and areas for improvement under manager's guidance",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_2.id,
      description: "Self-critically analyses the call for strong points and areas for improvement",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_2.id,
      description: "Gives suggestions for improvement in selling skills",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_2.id,
      description: "Develops a plan to improve selling skills",
      proficiencyLevel: 4,
      order: 1,
    });

    const substep7_3 = await this.createSubstep({
      stepId: step7.id,
      title: "Reporting",
      order: 3,
    });

    await this.createBehavior({
      substepId: substep7_3.id,
      description: "Makes notes to record the most important information (during or after a call), uses CRM",
      proficiencyLevel: 1,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_3.id,
      description: "Keeps a record of all commitments in one place",
      proficiencyLevel: 2,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_3.id,
      description: "Keeps a record of all commitments in one place and checks it on a regular basis",
      proficiencyLevel: 3,
      order: 1,
    });

    await this.createBehavior({
      substepId: substep7_3.id,
      description: "Uses the call notes to update planning documentation and customer database",
      proficiencyLevel: 4,
      order: 1,
    });
  }
}

export class DatabaseStorage implements IStorage {
  async getAllSteps(): Promise<(Step & { substeps: (Substep & { behaviors: Behavior[] })[] })[]> {
    const stepsWithSubsteps = await db.query.steps.findMany({
      with: {
        substeps: {
          with: {
            behaviors: true
          }
        }
      }
    });
    return stepsWithSubsteps;
  }

  async createStep(step: InsertStep): Promise<Step> {
    const [newStep] = await db.insert(steps).values(step).returning();
    return newStep;
  }

  async createSubstep(substep: InsertSubstep): Promise<Substep> {
    const [newSubstep] = await db.insert(substeps).values(substep).returning();
    return newSubstep;
  }

  async createBehavior(behavior: InsertBehavior): Promise<Behavior> {
    const [newBehavior] = await db.insert(behaviors).values(behavior).returning();
    return newBehavior;
  }

  async getAllUsers(): Promise<UserWithTeams[]> {
    const allUsers = await db.query.users.findMany({
      with: {
        userTeams: {
          with: {
            team: true
          }
        }
      },
      orderBy: (users, { asc }) => [asc(users.fullName)]
    });
    
    // Transform the data to include teams array
    return allUsers.map(user => ({
      ...user,
      teams: user.userTeams.map(ut => ut.team)
    })) as UserWithTeams[];
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values({
      ...user,
      passwordHash: user.passwordHash || null,
      emailVerified: user.emailVerified || false,
      provider: user.provider || null,
      providerId: user.providerId || null
    }).returning();
    return newUser;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    console.log(`DatabaseStorage: Updating user ${id} with data:`, userData);
    const startTime = Date.now();
    
    // Track team assignment operations
    if (userData.team !== undefined) {
      console.log(`DatabaseStorage: Team assignment - user ${id} moving to team "${userData.team}"`);
    }
    
    try {
      const connectionStart = Date.now();
      const updateData = {
        ...userData,
        updatedAt: new Date()
      };
      
      // Use transaction for consistency and better performance
      const [updatedUser] = await db.transaction(async (tx) => {
        return await tx.update(users)
          .set(updateData)
          .where(eq(users.id, id))
          .returning();
      });
      
      const connectionTime = Date.now() - connectionStart;
      console.log(`DatabaseStorage: Connection + query time: ${connectionTime}ms`);
      
      if (connectionTime > 30) {
        console.warn(`⚠️  Slow database operation detected: ${connectionTime}ms for user ${id}`);
      }
      
      console.log(`DatabaseStorage: User ${id} update completed in ${Date.now() - startTime}ms`);
      return updatedUser;
    } catch (error) {
      console.error(`❌ Database error for user ${id}:`, error);
      throw error;
    }
  }

  async bulkUpdateUsersTeam(teamName: string, newTeamName: string | null): Promise<number> {
    console.log(`DatabaseStorage: Bulk updating users from team "${teamName}" to "${newTeamName}"`);
    const startTime = Date.now();
    
    try {
      const result = await db.update(users)
        .set({ 
          team: newTeamName,
          updatedAt: new Date()
        })
        .where(eq(users.team, teamName))
        .returning({ id: users.id });
      
      const affectedRows = result.length;
      const duration = Date.now() - startTime;
      
      console.log(`DatabaseStorage: Bulk updated ${affectedRows} users in ${duration}ms`);
      return affectedRows;
    } catch (error) {
      console.error(`❌ Bulk update error:`, error);
      throw error;
    }
  }

  async bulkUpdateUserTeams(updates: { userId: number; team: string | null }[]): Promise<number> {
    console.log(`DatabaseStorage: Bulk updating ${updates.length} user team assignments`);
    const startTime = Date.now();
    
    try {
      let totalUpdated = 0;
      
      // Group updates by team assignment for efficiency
      const groupedUpdates = new Map<string | null, number[]>();
      for (const update of updates) {
        const key = update.team;
        if (!groupedUpdates.has(key)) {
          groupedUpdates.set(key, []);
        }
        groupedUpdates.get(key)!.push(update.userId);
      }
      
      // Execute bulk updates for each team
      for (const [teamName, userIds] of groupedUpdates) {
        if (userIds.length === 0) continue;
        
        const result = await db.update(users)
          .set({ 
            team: teamName,
            updatedAt: new Date()
          })
          .where(inArray(users.id, userIds))
          .returning({ id: users.id });
          
        totalUpdated += result.length;
        console.log(`DatabaseStorage: Updated ${result.length} users to team "${teamName}"`);
      }
      
      const duration = Date.now() - startTime;
      console.log(`DatabaseStorage: Bulk updated ${totalUpdated} users in ${duration}ms`);
      return totalUpdated;
    } catch (error) {
      console.error(`❌ Bulk update error:`, error);
      throw error;
    }
  }

  async getAllTeams(): Promise<Team[]> {
    console.log("DatabaseStorage: Getting all teams - start");
    const startTime = Date.now();
    
    const result = await db.select().from(teams);
    console.log(`DatabaseStorage: Got ${result.length} teams in ${Date.now() - startTime}ms`);
    return result;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    console.log(`DatabaseStorage: Creating team "${team.name}"`);
    const result = await db.insert(teams).values(team).returning();
    return result[0];
  }

  async deleteTeam(teamId: number): Promise<void> {
    console.log(`DatabaseStorage: Deleting team ${teamId}`);
    // Delete all user-team relationships first (CASCADE should handle this but being explicit)
    await db.delete(userTeams).where(eq(userTeams.teamId, teamId));
    // Delete the team
    await db.delete(teams).where(eq(teams.id, teamId));
  }

  async getUniqueTeams(): Promise<string[]> {
    console.log("DatabaseStorage: Getting unique teams - start");
    const startTime = Date.now();
    
    const result = await db.select({ name: teams.name }).from(teams);
    const teamNames = result.map(r => r.name);
    console.log(`DatabaseStorage: Got ${teamNames.length} unique teams in ${Date.now() - startTime}ms`);
    return teamNames;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // User-Team Relationships
  async getUserTeams(userId: number): Promise<Team[]> {
    console.log(`DatabaseStorage: Getting teams for user ${userId}`);
    const result = await db
      .select({
        id: teams.id,
        name: teams.name,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
      })
      .from(userTeams)
      .innerJoin(teams, eq(userTeams.teamId, teams.id))
      .where(eq(userTeams.userId, userId));
    
    return result;
  }

  async getTeamUsers(teamId: number): Promise<User[]> {
    console.log(`DatabaseStorage: Getting users for team ${teamId}`);
    const result = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        team: users.team,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        passwordHash: users.passwordHash,
        emailVerified: users.emailVerified,
        provider: users.provider,
        providerId: users.providerId,
        resetToken: users.resetToken,
        resetTokenExpiry: users.resetTokenExpiry,
      })
      .from(userTeams)
      .innerJoin(users, eq(userTeams.userId, users.id))
      .where(eq(userTeams.teamId, teamId));
    
    return result;
  }

  async addUserToTeam(userId: number, teamId: number): Promise<UserTeam> {
    console.log(`DatabaseStorage: Adding user ${userId} to team ${teamId}`);
    const result = await db.insert(userTeams).values({
      userId,
      teamId
    }).returning();
    return result[0];
  }

  async removeUserFromTeam(userId: number, teamId: number): Promise<void> {
    console.log(`DatabaseStorage: Removing user ${userId} from team ${teamId}`);
    await db.delete(userTeams)
      .where(and(eq(userTeams.userId, userId), eq(userTeams.teamId, teamId)));
  }

  async bulkUpdateTeamMembership(teamId: number, userIds: number[]): Promise<void> {
    console.log(`DatabaseStorage: Bulk updating team ${teamId} membership with ${userIds.length} users`);
    
    // Get current team members
    const currentMembers = await db.select({ userId: userTeams.userId })
      .from(userTeams)
      .where(eq(userTeams.teamId, teamId));
    
    const currentUserIds = new Set(currentMembers.map(m => m.userId));
    const newUserIds = new Set(userIds);
    
    // Find users to add (in new list but not in current)
    const usersToAdd = userIds.filter(userId => !currentUserIds.has(userId));
    
    // Find users to remove (in current but not in new list)
    const usersToRemove = Array.from(currentUserIds).filter(userId => !newUserIds.has(userId));
    
    console.log(`Adding ${usersToAdd.length} users, removing ${usersToRemove.length} users`);
    
    // Remove users who should no longer be in this team
    if (usersToRemove.length > 0) {
      await db.delete(userTeams)
        .where(and(
          eq(userTeams.teamId, teamId),
          inArray(userTeams.userId, usersToRemove)
        ));
    }
    
    // Add new users to the team
    if (usersToAdd.length > 0) {
      const insertValues = usersToAdd.map(userId => ({
        userId,
        teamId
      }));
      await db.insert(userTeams).values(insertValues);
    }
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [newAssessment] = await db.insert(assessments).values(assessment).returning();
    return newAssessment;
  }

  async updateAssessment(id: number, assessmentUpdate: Partial<Assessment>): Promise<Assessment> {
    console.log(`DatabaseStorage: Updating assessment ${id} with data:`, assessmentUpdate);
    const startTime = Date.now();
    
    const [updatedAssessment] = await db.update(assessments)
      .set(assessmentUpdate)
      .where(eq(assessments.id, id))
      .returning();
    
    console.log(`DatabaseStorage: Assessment ${id} updated in ${Date.now() - startTime}ms`);
    return updatedAssessment;
  }

  async getAssessment(id: number): Promise<Assessment | undefined> {
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
    return assessment;
  }

  async getAssessmentWithUser(id: number): Promise<(Assessment & { user: User }) | undefined> {
    const result = await db.query.assessments.findFirst({
      where: eq(assessments.id, id),
      with: {
        user: true
      }
    });
    return result;
  }

  async getAllAssessments(): Promise<Assessment[]> {
    const allAssessments = await db.select().from(assessments);
    return allAssessments.sort((a, b) => 
      new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
    );
  }

  async getLatestAssessmentForUser(userId: number): Promise<Assessment | undefined> {
    const [latestAssessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.userId, userId))
      .orderBy(desc(assessments.createdAt))
      .limit(1);
    
    return latestAssessment;
  }

  async getLatestAssessmentForCoachee(coacheeName: string): Promise<Assessment | undefined> {
    const [latestAssessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.assesseeName, coacheeName))
      .orderBy(desc(assessments.createdAt))
      .limit(1);
    
    return latestAssessment;
  }

  async getPreviousAssessmentForCoachee(coacheeName: string, excludeId: number): Promise<Assessment | undefined> {
    const [previousAssessment] = await db
      .select()
      .from(assessments)
      .where(and(eq(assessments.assesseeName, coacheeName), ne(assessments.id, excludeId)))
      .orderBy(desc(assessments.createdAt))
      .limit(1);
    
    return previousAssessment;
  }

  async getAssessmentScores(assessmentId: number): Promise<AssessmentScore[]> {
    const scores = await db.select().from(assessmentScores).where(eq(assessmentScores.assessmentId, assessmentId));
    return scores;
  }

  async updateAssessmentScore(assessmentId: number, behaviorId: number, checked: boolean): Promise<AssessmentScore> {
    console.log(`DatabaseStorage: Updating assessment score - assessment ${assessmentId}, behavior ${behaviorId}, checked: ${checked}`);
    const startTime = Date.now();
    
    // Use upsert for better performance - no need to check first
    const [score] = await db
      .insert(assessmentScores)
      .values({ assessmentId, behaviorId, checked })
      .onConflictDoUpdate({
        target: [assessmentScores.assessmentId, assessmentScores.behaviorId],
        set: { checked }
      })
      .returning();
    
    console.log(`DatabaseStorage: Assessment score updated in ${Date.now() - startTime}ms`);
    return score;
  }

  async getStepScores(assessmentId: number): Promise<StepScore[]> {
    const scores = await db.select().from(stepScores).where(eq(stepScores.assessmentId, assessmentId));
    return scores;
  }

  async updateStepScore(assessmentId: number, stepId: number, level: number): Promise<StepScore> {
    const [score] = await db
      .insert(stepScores)
      .values({ assessmentId, stepId, level })
      .onConflictDoUpdate({
        target: [stepScores.assessmentId, stepScores.stepId],
        set: { level }
      })
      .returning();
    return score;
  }

  async initializeDefaultData(): Promise<void> {
    // Check if data already exists
    const existingSteps = await this.getAllSteps();
    if (existingSteps.length > 0) {
      console.log("Database already initialized, skipping default data creation");
      return;
    }

    // Add some sample users
    await this.createUser({
      fullName: "John Doe",
      email: "john.doe@example.com",
      team: "Sales Team A"
    });

    await this.createUser({
      fullName: "Jane Smith", 
      email: "jane.smith@example.com",
      team: "Sales Team B"
    });

    await this.createUser({
      fullName: "Mike Johnson",
      email: "mike.johnson@example.com", 
      team: "Sales Team A"
    });

    // Use MemStorage to initialize data properly in database
    const memStorage = new MemStorage();
    await memStorage.initializeDefaultData();

    // Get all data from MemStorage and insert into database
    const allSteps = await memStorage.getAllSteps();

    for (let stepIndex = 0; stepIndex < allSteps.length; stepIndex++) {
      const step = allSteps[stepIndex];
      const insertedStep = await this.createStep({
        title: step.title,
        description: step.description,
        targetScore: step.targetScore,
        order: stepIndex + 1
      });

      for (let substepIndex = 0; substepIndex < step.substeps.length; substepIndex++) {
        const substep = step.substeps[substepIndex];
        const insertedSubstep = await this.createSubstep({
          title: substep.title,
          stepId: insertedStep.id,
          order: substepIndex + 1
        });

        let behaviorOrder = 1;
        for (const behavior of substep.behaviors) {
          // Split behaviors that contain semicolons into separate behaviors
          const behaviorTexts = behavior.description.split(';').map(text => text.trim()).filter(text => text.length > 0);

          for (const behaviorText of behaviorTexts) {
            await this.createBehavior({
              description: behaviorText,
              proficiencyLevel: behavior.proficiencyLevel,
              substepId: insertedSubstep.id,
              order: behaviorOrder++
            });
          }
        }
      }
    }

    console.log("Database initialized with separated behaviors");
  }
}

export const storage = new DatabaseStorage();