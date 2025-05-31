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
  stepScores?: { [stepId: number]: number };
}

export default function SpiderGraph({ steps, checkedBehaviors, stepScores = {} }: SpiderGraphProps) {
  const calculateStepLevel = (step: StepWithSubsteps) => {
    // Use manual step score if set, otherwise calculate from behaviors
    const manualScore = stepScores[step.id];
    if (manualScore && manualScore > 0) {
      return manualScore; // Return the actual level (1-4)
    }
    
    // Calculate level based on behaviors - use same logic as assessment-step component
    const stepScore = step.substeps.reduce((total, substep) => {
      return total + substep.behaviors.reduce((substepTotal, behavior) => {
        if (checkedBehaviors.has(behavior.id)) {
          return substepTotal + behavior.proficiencyLevel;
        }
        return substepTotal;
      }, 0);
    }, 0);

    if (stepScore === 0) return 0;

    // Calculate level thresholds based on behavior distribution
    let stepLevel1Count = 0, stepLevel2Count = 0, stepLevel3Count = 0, stepLevel4Count = 0;
    step.substeps.forEach(substep => {
      substep.behaviors.forEach(behavior => {
        if (behavior.proficiencyLevel === 1) stepLevel1Count++;
        else if (behavior.proficiencyLevel === 2) stepLevel2Count++;
        else if (behavior.proficiencyLevel === 3) stepLevel3Count++;
        else if (behavior.proficiencyLevel === 4) stepLevel4Count++;
      });
    });

    const stepLevel1Max = stepLevel1Count * 1;
    const stepLevel2Max = stepLevel1Max + (stepLevel2Count * 2);
    const stepLevel3Max = stepLevel2Max + (stepLevel3Count * 3);

    if (stepScore > stepLevel3Max) return 4; // Master
    if (stepScore > stepLevel2Max) return 3; // Experienced  
    if (stepScore > stepLevel1Max) return 2; // Qualified
    return 1; // Learner
  };

  const calculateTargetScore = (step: StepWithSubsteps) => {
    // Target is Level 3 (experienced) on all behaviors
    return step.substeps.reduce((total, substep) => {
      return total + (substep.behaviors.length * 3);
    }, 0);
  };

  const data = steps.map(step => {
    const actualLevel = calculateStepLevel(step);
    
    return {
      step: step.title,
      actual: actualLevel,
      target: 3, // Target is always Level 3 (Experienced)
      maxLevel: 4,
    };
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance vs Benchmark (Level 3)</h2>
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
              domain={[0, 4]}
              tick={{ fontSize: 10 }}
              tickCount={5}
            />
            <Radar
              name="Benchmark (Level 3)"
              dataKey="benchmark"
              stroke="#87ceeb"
              fill="#87ceeb"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <Radar
              name="Actual Performance"
              dataKey="averageActual"
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
            <span className="text-blue-600">Avg: {item.averageActual.toFixed(1)}/4 (Benchmark: 3.0)</span>
          </div>
        ))}
      </div>
    </div>
  );
}