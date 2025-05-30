import { calculateOverallProficiency } from "@/lib/utils";
import type { Step, Substep, Behavior } from "@shared/schema";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

interface ScoringDashboardProps {
  totalScore: number;
  totalBehaviors: number;
  steps: StepWithSubsteps[];
  checkedBehaviors: Set<number>;
}

export default function ScoringDashboard({ totalScore, totalBehaviors, steps, checkedBehaviors }: ScoringDashboardProps) {
  const averageLevel = totalBehaviors > 0 ? (totalScore / totalBehaviors).toFixed(1) : "0";
  const { level: overallProficiency, className } = calculateOverallProficiency(totalScore, steps);

  return (
    <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Scoring Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{totalBehaviors}</div>
          <div className="text-sm text-gray-500">Total Behaviors Assessed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{totalScore}</div>
          <div className="text-sm text-gray-500">Total Score</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{averageLevel}</div>
          <div className="text-sm text-gray-500">Average Level</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">
            <span className={`px-3 py-1 rounded-full text-sm ${className}`}>
              {overallProficiency}
            </span>
          </div>
          <div className="text-sm text-gray-500">Overall Proficiency</div>
        </div>
      </div>
    </div>
  );
}
