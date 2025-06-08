import type { Step, Substep, Behavior } from "@shared/schema";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

interface ProgressOverviewProps {
  steps: StepWithSubsteps[];
  checkedBehaviors: Set<number>;
}

export default function ProgressOverview({ steps, checkedBehaviors }: ProgressOverviewProps) {
  const calculateStepProgress = (step: StepWithSubsteps) => {
    const totalBehaviors = step.substeps.reduce((total, substep) => total + substep.behaviors.length, 0);
    const checkedCount = step.substeps.reduce((total, substep) => {
      return total + substep.behaviors.filter(behavior => checkedBehaviors.has(behavior.id)).length;
    }, 0);
    
    return totalBehaviors > 0 ? Math.round((checkedCount / totalBehaviors) * 100) : 0;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Assessment Progress</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {steps.map((step, index) => {
          const progress = calculateStepProgress(step);
          // Emotion responsive progress colors
          const getProgressColors = (progress: number) => {
            if (progress >= 80) return { border: "border-green-500", text: "emotion-success", bg: "emotion-success-light-bg" };
            if (progress >= 50) return { border: "border-blue-500", text: "emotion-trust", bg: "emotion-trust-light-bg" };
            if (progress >= 25) return { border: "border-amber-500", text: "emotion-energy", bg: "emotion-energy-light-bg" };
            return { border: "border-gray-300", text: "text-gray-500", bg: "bg-gray-50" };
          };
          
          const colors = getProgressColors(progress);
          
          return (
            <div key={step.id} className="text-center">
              <div className={`w-16 h-16 mx-auto mb-2 rounded-full border-4 ${colors.border} ${colors.bg} flex items-center justify-center transition-colors`}>
                <span className={`text-sm font-medium ${colors.text}`}>{progress}%</span>
              </div>
              <div className="text-xs text-gray-500">Step {index + 1}</div>
              <div className="text-xs font-medium text-gray-700">{step.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
