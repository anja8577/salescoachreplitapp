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
  
  // Calculate cumulative point thresholds
  const level1Max = level1Count * 1;
  const level2Max = level1Max + (level2Count * 2);
  const level3Max = level2Max + (level3Count * 3);
  const level4Max = level3Max + (level4Count * 4);
  
  if (score === 0) {
    return { level: "Not Assessed", className: "bg-gray-100 text-gray-700" };
  }
  
  if (score > level3Max) {
    return { level: "Master", className: "bg-purple-100 text-purple-700" };
  } else if (score > level2Max) {
    return { level: "Experienced", className: "bg-blue-100 text-blue-700" };
  } else if (score > level1Max) {
    return { level: "Qualified", className: "bg-green-100 text-green-700" };
  } else {
    return { level: "Learner", className: "bg-orange-100 text-orange-700" };
  }
}

export function calculateOverallProficiency(totalScore: number, steps: any[]): { level: string; className: string } {
  if (totalScore === 0) {
    return { level: "Not Assessed", className: "bg-gray-100 text-gray-700" };
  }

  // Count all behaviors across all steps by level
  let level1Count = 0, level2Count = 0, level3Count = 0, level4Count = 0;
  
  steps.forEach(step => {
    step.substeps.forEach((substep: any) => {
      substep.behaviors.forEach((behavior: any) => {
        if (behavior.proficiencyLevel === 1) level1Count++;
        else if (behavior.proficiencyLevel === 2) level2Count++;
        else if (behavior.proficiencyLevel === 3) level3Count++;
        else if (behavior.proficiencyLevel === 4) level4Count++;
      });
    });
  });
  
  // Calculate cumulative point thresholds for overall assessment
  const level1Max = level1Count * 1;
  const level2Max = level1Max + (level2Count * 2);
  const level3Max = level2Max + (level3Count * 3);
  const level4Max = level3Max + (level4Count * 4);
  
  if (totalScore > level3Max) {
    return { level: "Master", className: "bg-purple-100 text-purple-700" };
  } else if (totalScore > level2Max) {
    return { level: "Experienced", className: "bg-blue-100 text-blue-700" };
  } else if (totalScore > level1Max) {
    return { level: "Qualified", className: "bg-green-100 text-green-700" };
  } else {
    return { level: "Learner", className: "bg-orange-100 text-orange-700" };
  }
}
