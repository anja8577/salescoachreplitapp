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

export function calculateOverallProficiency(steps: any[], checkedBehaviors: Set<number>): { level: string; className: string; score: number } {
  // Calculate level for each step (1-4)
  const stepLevels = steps.map(step => calculateStepLevel(step, checkedBehaviors));
  
  // Sum all step levels and divide by 7
  const totalStepLevels = stepLevels.reduce((sum, level) => sum + level, 0);
  const averageLevel = totalStepLevels / 7;
  
  let level: string;
  let className: string;
  
  if (averageLevel < 2) {
    level = "Learner";
    className = "bg-orange-100 text-orange-700";
  } else if (averageLevel < 3) {
    level = "Qualified";
    className = "bg-green-100 text-green-700";
  } else if (averageLevel < 4) {
    level = "Experienced";
    className = "bg-blue-100 text-blue-700";
  } else {
    level = "Master";
    className = "bg-purple-100 text-purple-700";
  }
  
  return { level, className, score: averageLevel };
}
