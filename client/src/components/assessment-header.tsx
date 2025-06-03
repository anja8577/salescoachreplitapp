import { calculateOverallProficiency } from "@/lib/utils";
import type { Step, Substep, Behavior } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import SalesCoachHeader from "@/components/sales-coach-header";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

interface AssessmentHeaderProps {
  totalScore: number;
  totalBehaviors: number;
  steps: StepWithSubsteps[];
  checkedBehaviors: Set<number>;
  stepScores?: { [stepId: number]: number };
  onNewAssessment?: () => void;
  coacheeName?: string;
}

export default function AssessmentHeader({ totalScore, totalBehaviors, steps, checkedBehaviors, stepScores = {}, onNewAssessment, coacheeName }: AssessmentHeaderProps) {
  const { level, className, score } = calculateOverallProficiency(steps, checkedBehaviors, stepScores);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center space-x-4">
            <SalesCoachHeader showLogo={true} size="md" />
            {coacheeName && (
              <span className="text-lg text-gray-700">Session for {coacheeName}</span>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Proficiency Level</div>
            <div className="text-lg font-semibold">
              <span className={`px-3 py-1 rounded-full text-sm ${className}`}>
                {level}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
