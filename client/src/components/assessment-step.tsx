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
  stepScores?: { [stepId: number]: number };
  onStepScoreChange?: (stepId: number, level: number) => void;
}

export default function AssessmentStep({ 
  step, 
  checkedBehaviors, 
  onBehaviorCheck, 
  stepScores = {}, 
  onStepScoreChange 
}: AssessmentStepProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const stepScore = step.substeps.reduce((total, substep) => {
    return total + calculateSubstepScore(substep, checkedBehaviors);
  }, 0);

  const stepBehaviorCount = step.substeps.reduce((total, substep) => {
    return total + substep.behaviors.filter(behavior => checkedBehaviors.has(behavior.id)).length;
  }, 0);

  const currentStepScore = stepScores[step.id] || 0;

  // Get manual step score or calculate automatic level
  const getStepLevel = () => {
    const manualLevel = currentStepScore;
    if (manualLevel > 0) {
      const levels = ["", "Learner", "Qualified", "Experienced", "Master"];
      return levels[manualLevel];
    }

    // Calculate automatic level with custom thresholds for specific steps
    const stepTitle = step.title.toLowerCase();
    
    // Custom thresholds for specific steps
    const customThresholds: { [key: string]: { qualified: number; experienced: number; master: number } } = {
      "analyzing results": { qualified: 2, experienced: 3, master: 4 },
      "maintaining rapport": { qualified: 3, experienced: 4, master: 5 },
      "asking for commitment": { qualified: 2, experienced: 3, master: 2 }, // Master threshold lowered
      "summarizing": { qualified: 2, experienced: 3, master: 2 }, // Master threshold lowered
      "objection handling": { qualified: 2, experienced: 3, master: 4 },
      "active listening": { qualified: 2, experienced: 2, master: 3 } // Experienced threshold lowered
    };

    if (stepScore === 0) return "Not Assessed";

    // Check if this step has custom thresholds
    const customKey = Object.keys(customThresholds).find(key => stepTitle.includes(key));
    
    if (customKey) {
      const thresholds = customThresholds[customKey];
      if (stepScore >= thresholds.master) return "Master";
      if (stepScore >= thresholds.experienced) return "Experienced";
      if (stepScore >= thresholds.qualified) return "Qualified";
      return "Learner";
    }

    // Default calculation for other steps
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

    if (stepScore > stepLevel3Max) return "Master";
    if (stepScore > stepLevel2Max) return "Experienced";
    if (stepScore > stepLevel1Max) return "Qualified";
    return "Learner";
  };

  const stepLevel = getStepLevel();

  const getStepLevelClass = () => {
    if (stepLevel === "Not Assessed") return "bg-gray-100 text-gray-700";
    if (stepLevel === "Master") return "bg-purple-100 text-purple-700";
    if (stepLevel === "Experienced") return "bg-blue-100 text-blue-700";
    if (stepLevel === "Qualified") return "bg-green-100 text-green-700";
    return "bg-orange-100 text-orange-700";
  };

  const stepLevelClass = getStepLevelClass();

  const getBehaviorsByLevel = (behaviors: Behavior[], level: number) => {
    return behaviors.filter(behavior => behavior.proficiencyLevel === level);
  };

  const getLevelConfig = (level: number) => {
    const configs = {
      1: { label: "Learner", className: "bg-orange-100 text-orange-700" },
      2: { label: "Qualified", className: "bg-green-100 text-green-700" },
      3: { label: "Experienced", className: "bg-blue-100 text-blue-700" },
      4: { label: "Master", className: "bg-purple-100 text-purple-700" },
    };
    return configs[level as keyof typeof configs];
  };

  const handleStepLevelChange = (level: number, checked: boolean) => {
    if (onStepScoreChange) {
      onStepScoreChange(step.id, checked ? level : 0);
    }
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
              <div className="text-sm text-gray-500">
                Score {currentStepScore > 0 && <span className="text-xs">(Auto)</span>}
              </div>
              <div className={`text-lg font-semibold ${currentStepScore > 0 ? 'text-gray-400' : 'text-blue-600'}`}>
                {stepScore}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Level</div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${stepLevelClass}`}>
                {stepLevel}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Select Level for Step</div>
              <select
                value={currentStepScore}
                onChange={(e) => handleStepLevelChange(parseInt(e.target.value), parseInt(e.target.value) > 0)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <option value={0}>Auto</option>
                <option value={1}>1 - Learner</option>
                <option value={2}>2 - Qualified</option>
                <option value={3}>3 - Experienced</option>
                <option value={4}>4 - Master</option>
              </select>
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