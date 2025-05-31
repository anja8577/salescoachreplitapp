import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Substep, Behavior } from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateSubstepScore(substep: Substep & { behaviors: Behavior[] }, checkedBehaviors: Set<number>): number {
  return substep.behaviors.reduce((total, behavior) => {
    if (checkedBehaviors.has(behavior.id)) {
      return total + behavior.proficiencyLevel;
    }
    return total;
  }, 0);
}

export function calculateSubstepProficiency(substep: Substep & { behaviors: Behavior[] }, checkedBehaviors: Set<number>): { level: string; className: string } {
  const score = calculateSubstepScore(substep, checkedBehaviors);
  
  // Count behaviors at each level in this substep
  const level1Count = substep.behaviors.filter(b => b.proficiencyLevel === 1).length;
  const level2Count = substep.behaviors.filter(b => b.proficiencyLevel === 2).length;
  const level3Count = substep.behaviors.filter(b => b.proficiencyLevel === 3).length;
  const level4Count = substep.behaviors.filter(b => b.proficiencyLevel === 4).length;
  
  // Calculate point thresholds based on your logic:
  // Qualified >3 points, Experienced >9 points, Master >15 points
  // Logic: if points > max points in learner -> qualified
  // if points > max points in learner + qualified -> experienced
  // if points > max points in learner + qualified + experienced -> master
  
  const learnerMax = level1Count * 1; // Max points from level 1 behaviors
  const qualifiedThreshold = learnerMax; // More than learner max
  const experiencedThreshold = learnerMax + (level2Count * 2); // More than learner + qualified max
  const masterThreshold = learnerMax + (level2Count * 2) + (level3Count * 3); // More than learner + qualified + experienced max
  
  if (score === 0) {
    return { level: "Not Assessed", className: "bg-gray-100 text-gray-700" };
  }
  
  if (score > masterThreshold) {
    return { level: "Master", className: "bg-purple-100 text-purple-700" };
  } else if (score > experiencedThreshold) {
    return { level: "Experienced", className: "bg-blue-100 text-blue-700" };
  } else if (score > qualifiedThreshold) {
    return { level: "Qualified", className: "bg-green-100 text-green-700" };
  } else {
    return { level: "Learner", className: "bg-orange-100 text-orange-700" };
  }
}

export function calculateStepLevel(step: any, checkedBehaviors: Set<number>): number {
  // Calculate the level for a single step based on substep levels
  const substepLevels = step.substeps.map((substep: any) => {
    const checkedCount = substep.behaviors.filter((b: any) => checkedBehaviors.has(b.id)).length;
    const totalBehaviors = substep.behaviors.length;
    
    if (totalBehaviors === 0) return 1;
    
    const percentage = checkedCount / totalBehaviors;
    if (percentage >= 1.0) return 4; // Master
    if (percentage >= 0.75) return 3; // Experienced  
    if (percentage >= 0.5) return 2; // Qualified
    return 1; // Learner
  });
  
  // Average the substep levels for this step
  return substepLevels.reduce((sum: number, level: number) => sum + level, 0) / substepLevels.length;
}

export function calculateOverallProficiency(steps: any[], checkedBehaviors: Set<number>, stepScores: { [stepId: number]: number } = {}): { level: string; className: string; score: number } {
  // Calculate level for each step using same logic as PDF
  const stepLevels = steps.map(step => {
    // Use manual step score if set, otherwise calculate from behaviors
    const manualScore = stepScores[step.id];
    if (manualScore && manualScore > 0) {
      return manualScore; // Return the actual level (1-4)
    }
    
    // Calculate automatic level based on behaviors
    const stepScore = step.substeps.reduce((total: number, substep: any) => {
      return total + substep.behaviors.reduce((substepTotal: number, behavior: any) => {
        if (checkedBehaviors.has(behavior.id)) {
          return substepTotal + behavior.proficiencyLevel;
        }
        return substepTotal;
      }, 0);
    }, 0);

    if (stepScore === 0) return 0;

    // Use same threshold logic as assessment-step.tsx
    const stepTitle = step.title.toLowerCase();
    const customThresholds: { [key: string]: { qualified: number; experienced: number; master: number } } = {
      "analyzing results": { qualified: 2, experienced: 3, master: 4 },
      "maintaining rapport": { qualified: 3, experienced: 4, master: 5 },
      "asking for commitment": { qualified: 2, experienced: 3, master: 2 },
      "summarizing": { qualified: 2, experienced: 3, master: 2 },
      "objection handling": { qualified: 2, experienced: 3, master: 4 },
      "active listening": { qualified: 2, experienced: 2, master: 3 }
    };

    const customKey = Object.keys(customThresholds).find(key => stepTitle.includes(key));
    if (customKey) {
      const thresholds = customThresholds[customKey];
      if (stepScore >= thresholds.master) return 4;
      if (stepScore >= thresholds.experienced) return 3;
      if (stepScore >= thresholds.qualified) return 2;
      return 1;
    }

    // Default calculation
    let stepLevel1Count = 0, stepLevel2Count = 0, stepLevel3Count = 0, stepLevel4Count = 0;
    step.substeps.forEach((substep: any) => {
      substep.behaviors.forEach((behavior: any) => {
        if (behavior.proficiencyLevel === 1) stepLevel1Count++;
        else if (behavior.proficiencyLevel === 2) stepLevel2Count++;
        else if (behavior.proficiencyLevel === 3) stepLevel3Count++;
        else if (behavior.proficiencyLevel === 4) stepLevel4Count++;
      });
    });

    const stepLevel1Max = stepLevel1Count * 1;
    const stepLevel2Max = stepLevel1Max + (stepLevel2Count * 2);
    const stepLevel3Max = stepLevel2Max + (stepLevel3Count * 3);

    if (stepScore > stepLevel3Max) return 4;
    if (stepScore > stepLevel2Max) return 3;
    if (stepScore > stepLevel1Max) return 2;
    return 1;
  });

  const currentScore = stepLevels.reduce((sum, level) => sum + level, 0) / steps.length;

  let level: string;
  let className: string;
  
  if (currentScore >= 3.5) {
    level = "Master";
    className = "bg-purple-100 text-purple-700";
  } else if (currentScore >= 2.5) {
    level = "Experienced";
    className = "bg-blue-100 text-blue-700";
  } else if (currentScore >= 1.5) {
    level = "Qualified";
    className = "bg-green-100 text-green-700";
  } else {
    level = "Learner";
    className = "bg-orange-100 text-orange-700";
  }
  
  return { level, className, score: currentScore };
}
