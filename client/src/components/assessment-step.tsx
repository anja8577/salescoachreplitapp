import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { calculateSubstepScore, calculateSubstepProficiency } from "@/lib/utils";
import type { Step, Substep, Behavior } from "@shared/schema";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

interface AssessmentStepProps {
  step: StepWithSubsteps;
  checkedBehaviors: Set<number>;
  onBehaviorCheck: (behaviorId: number, checked: boolean) => void;
}

export default function AssessmentStep({ step, checkedBehaviors, onBehaviorCheck }: AssessmentStepProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const stepScore = step.substeps.reduce((total, substep) => {
    return total + calculateSubstepScore(substep, checkedBehaviors);
  }, 0);

  const stepBehaviorCount = step.substeps.reduce((total, substep) => {
    return total + substep.behaviors.filter(behavior => checkedBehaviors.has(behavior.id)).length;
  }, 0);

  const stepLevel = stepBehaviorCount > 0 ? 
    (stepScore / stepBehaviorCount >= 3.5 ? "Expert" :
     stepScore / stepBehaviorCount >= 2.5 ? "Proficient" :
     stepScore / stepBehaviorCount >= 1.5 ? "Developing" : "Beginner") : "Not Assessed";

  const stepLevelClass = stepBehaviorCount > 0 ?
    (stepScore / stepBehaviorCount >= 3.5 ? "bg-green-100 text-green-700" :
     stepScore / stepBehaviorCount >= 2.5 ? "bg-blue-100 text-blue-700" :
     stepScore / stepBehaviorCount >= 1.5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700") : "bg-gray-100 text-gray-700";

  const getBehaviorsByLevel = (behaviors: Behavior[], level: number) => {
    return behaviors.filter(behavior => behavior.proficiencyLevel === level);
  };

  const getLevelConfig = (level: number) => {
    const configs = {
      1: { label: "Level 1", className: "bg-red-100 text-red-700" },
      2: { label: "Level 2", className: "bg-yellow-100 text-yellow-700" },
      3: { label: "Level 3", className: "bg-blue-100 text-blue-700" },
      4: { label: "Level 4", className: "bg-green-100 text-green-700" },
    };
    return configs[level as keyof typeof configs];
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div 
          className="flex items-center justify-between cursor-pointer" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-600">{step.order}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-gray-500">Score</div>
              <div className="text-lg font-semibold text-blue-600">{stepScore}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Level</div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${stepLevelClass}`}>
                {stepLevel}
              </span>
            </div>
            <ChevronDown 
              className={`text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              size={20}
            />
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-6 space-y-6">
          {step.substeps.map((substep) => (
            <div key={substep.id} className="border border-gray-100 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">{substep.title}</h4>
              
              {[1, 2, 3, 4].map((level) => {
                const levelBehaviors = getBehaviorsByLevel(substep.behaviors, level);
                if (levelBehaviors.length === 0) return null;
                
                const levelConfig = getLevelConfig(level);
                
                return (
                  <div key={level} className="mb-4">
                    <div className="flex items-center mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${levelConfig.className}`}>
                        {levelConfig.label}
                      </span>
                      <span className="ml-2 text-sm text-gray-600">({level} point{level > 1 ? 's' : ''} each)</span>
                    </div>
                    <div className="space-y-2 ml-4">
                      {levelBehaviors.map((behavior) => (
                        <label key={behavior.id} className="flex items-start space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checkedBehaviors.has(behavior.id)}
                            onChange={(e) => onBehaviorCheck(behavior.id, e.target.checked)}
                          />
                          <span className="text-sm text-gray-700">{behavior.description}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Substep Score */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Substep Score:</span>
                <div className="flex items-center space-x-4">
                  <span className="text-lg font-semibold text-blue-600">
                    {calculateSubstepScore(substep, checkedBehaviors)}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${calculateSubstepProficiency(substep, checkedBehaviors).className}`}>
                    {calculateSubstepProficiency(substep, checkedBehaviors).level}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
