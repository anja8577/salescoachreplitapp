import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import type { Step, Substep, Behavior } from "@shared/schema";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

interface SpiderGraphProps {
  steps: StepWithSubsteps[];
  checkedBehaviors: Set<number>;
}

export default function SpiderGraph({ steps, checkedBehaviors }: SpiderGraphProps) {
  const calculateStepScore = (step: StepWithSubsteps) => {
    return step.substeps.reduce((total, substep) => {
      return total + substep.behaviors.reduce((substepTotal, behavior) => {
        if (checkedBehaviors.has(behavior.id)) {
          return substepTotal + behavior.proficiencyLevel;
        }
        return substepTotal;
      }, 0);
    }, 0);
  };

  const calculateTargetScore = (step: StepWithSubsteps) => {
    // Target is Level 3 (experienced) on all behaviors
    return step.substeps.reduce((total, substep) => {
      return total + (substep.behaviors.length * 3);
    }, 0);
  };

  const data = steps.map(step => {
    const actualScore = calculateStepScore(step);
    const targetScore = calculateTargetScore(step);
    
    return {
      step: step.title,
      actual: actualScore,
      target: targetScore,
      // Convert to percentage for better visualization
      actualPercent: targetScore > 0 ? Math.round((actualScore / targetScore) * 100) : 0,
      targetPercent: 100,
    };
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance vs Target (Level 3)</h2>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis 
              dataKey="step" 
              tick={{ fontSize: 12 }}
              className="text-gray-600"
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              tickCount={6}
            />
            <Radar
              name="Target (Level 3)"
              dataKey="targetPercent"
              stroke="#94a3b8"
              fill="#94a3b8"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <Radar
              name="Actual Performance"
              dataKey="actualPercent"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {data.map((item, index) => (
          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span className="font-medium">{item.step}:</span>
            <span className="text-blue-600">{item.actual}/{item.target} pts ({item.actualPercent}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}