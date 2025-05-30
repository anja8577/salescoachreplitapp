import { 
  type Step, type Substep, type Behavior, type User, type Assessment, type AssessmentScore,
  type InsertStep, type InsertSubstep, type InsertBehavior, type InsertUser, type InsertAssessment, type InsertAssessmentScore
} from "@shared/schema";

export interface IStorage {
  // Steps
  getAllSteps(): Promise<(Step & { substeps: (Substep & { behaviors: Behavior[] })[] })[]>;
  createStep(step: InsertStep): Promise<Step>;
  
  // Substeps
  createSubstep(substep: InsertSubstep): Promise<Substep>;
  
  // Behaviors
  createBehavior(behavior: InsertBehavior): Promise<Behavior>;
  
  // Users
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  
  // Assessments
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  getAssessment(id: number): Promise<Assessment | undefined>;
  getAssessmentWithUser(id: number): Promise<(Assessment & { user: User }) | undefined>;
  
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
  private users: Map<number, User> = new Map();
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
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

  async getAssessmentWithUser(id: number): Promise<(Assessment & { user: User }) | undefined> {
    const assessment = this.assessments.get(id);
    if (!assessment) return undefined;
    
    const user = this.users.get(assessment.userId);
    if (!user) return undefined;
    
    return { ...assessment, user };
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

export const storage = new MemStorage();
