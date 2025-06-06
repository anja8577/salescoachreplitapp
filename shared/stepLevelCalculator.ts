import type { Step, Substep, Behavior, AssessmentScore, StepScore } from "./schema";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

export interface UnifiedStepLevel {
  stepId: number;
  level: number;
  source: 'manual' | 'calculated';
  percentage?: number;
}

export class StepLevelCalculator {
  /**
   * Calculate step level from behavior completion percentage
   */
  static calculateLevelFromBehaviors(checkedCount: number, totalCount: number): number {
    if (totalCount === 0) return 1;
    
    const percentage = (checkedCount / totalCount) * 100;
    
    if (percentage >= 90) return 4; // Master
    if (percentage >= 70) return 3; // Experienced
    if (percentage >= 50) return 2; // Qualified
    return 1; // Learner
  }

  /**
   * Get unified step levels - prioritizes manual scoring but falls back to calculated levels
   */
  static getUnifiedStepLevels(
    steps: StepWithSubsteps[],
    assessmentScores: AssessmentScore[],
    stepScores: StepScore[]
  ): UnifiedStepLevel[] {
    const checkedBehaviorIds = new Set(
      assessmentScores.filter(score => score.checked).map(score => score.behaviorId)
    );

    const manualStepScores = stepScores.reduce((acc, score) => {
      acc[score.stepId] = score.level;
      return acc;
    }, {} as { [stepId: number]: number });

    return steps.map(step => {
      // Check if there's a manual score
      if (manualStepScores[step.id]) {
        return {
          stepId: step.id,
          level: manualStepScores[step.id],
          source: 'manual' as const
        };
      }

      // Calculate from behaviors
      const stepBehaviors = step.substeps.flatMap(substep => substep.behaviors);
      const checkedCount = stepBehaviors.filter(behavior => 
        checkedBehaviorIds.has(behavior.id)
      ).length;
      
      const percentage = stepBehaviors.length > 0 ? 
        (checkedCount / stepBehaviors.length) * 100 : 0;
      
      const calculatedLevel = this.calculateLevelFromBehaviors(checkedCount, stepBehaviors.length);

      return {
        stepId: step.id,
        level: calculatedLevel,
        source: 'calculated' as const,
        percentage: Math.round(percentage)
      };
    });
  }

  /**
   * Get overall proficiency level from unified step levels
   */
  static getOverallProficiencyLevel(unifiedStepLevels: UnifiedStepLevel[]): {
    level: number;
    text: string;
  } {
    if (unifiedStepLevels.length === 0) {
      return { level: 1, text: 'Not Evaluated' };
    }

    const avgLevel = unifiedStepLevels.reduce((sum, step) => sum + step.level, 0) / unifiedStepLevels.length;
    
    let level: number;
    let text: string;
    
    if (avgLevel >= 3.5) {
      level = 4;
      text = 'Master';
    } else if (avgLevel >= 2.5) {
      level = 3;
      text = 'Experienced';
    } else if (avgLevel >= 1.5) {
      level = 2;
      text = 'Qualified';
    } else {
      level = 1;
      text = 'Learner';
    }

    return { level, text };
  }

  /**
   * Get level text for display
   */
  static getLevelText(level: number): string {
    switch (level) {
      case 4: return 'Master';
      case 3: return 'Experienced';
      case 2: return 'Qualified';
      case 1: return 'Learner';
      default: return 'Not Evaluated';
    }
  }

  /**
   * Get level short code for badges
   */
  static getLevelShortCode(level: number): string {
    switch (level) {
      case 4: return 'M';
      case 3: return 'E';
      case 2: return 'Q';
      case 1: return 'L';
      default: return '-';
    }
  }

  /**
   * Get CSS classes for level badges
   */
  static getLevelBadgeClass(level: number): string {
    switch (level) {
      case 4: return 'bg-purple-100 text-purple-800 border-purple-300';
      case 3: return 'bg-green-100 text-green-800 border-green-300';
      case 2: return 'bg-blue-100 text-blue-800 border-blue-300';
      case 1: return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }
}