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
  const checkedCount = substep.behaviors.filter(behavior => checkedBehaviors.has(behavior.id)).length;
  
  if (checkedCount === 0) {
    return { level: "Not Assessed", className: "bg-gray-100 text-gray-700" };
  }

  const averageLevel = score / checkedCount;
  
  if (averageLevel >= 3.5) {
    return { level: "Expert", className: "bg-green-100 text-green-700" };
  } else if (averageLevel >= 2.5) {
    return { level: "Proficient", className: "bg-blue-100 text-blue-700" };
  } else if (averageLevel >= 1.5) {
    return { level: "Developing", className: "bg-yellow-100 text-yellow-700" };
  } else {
    return { level: "Beginner", className: "bg-red-100 text-red-700" };
  }
}

export function calculateOverallProficiency(totalScore: number, totalBehaviors: number): { level: string; className: string } {
  if (totalBehaviors === 0) {
    return { level: "Not Assessed", className: "bg-gray-100 text-gray-700" };
  }

  const averageLevel = totalScore / totalBehaviors;
  
  if (averageLevel >= 3.5) {
    return { level: "Expert", className: "bg-green-100 text-green-700" };
  } else if (averageLevel >= 2.5) {
    return { level: "Proficient", className: "bg-blue-100 text-blue-700" };
  } else if (averageLevel >= 1.5) {
    return { level: "Developing", className: "bg-yellow-100 text-yellow-700" };
  } else {
    return { level: "Beginner", className: "bg-red-100 text-red-700" };
  }
}
