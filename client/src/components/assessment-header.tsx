import { calculateOverallProficiency } from "@/lib/utils";

interface AssessmentHeaderProps {
  totalScore: number;
  totalBehaviors: number;
}

export default function AssessmentHeader({ totalScore, totalBehaviors }: AssessmentHeaderProps) {
  const { level, className } = calculateOverallProficiency(totalScore, totalBehaviors);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SSA Behavior Assessment</h1>
            <p className="text-sm text-gray-600">Sales Skills Assessment Scoring Tool</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-gray-500">Overall Score</div>
              <div className="text-2xl font-bold text-blue-600">{totalScore}</div>
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
      </div>
    </header>
  );
}
