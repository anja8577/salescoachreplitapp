import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import AssessmentHeader from "@/components/assessment-header";
import ProgressOverview from "@/components/progress-overview";
import AssessmentStep from "@/components/assessment-step";
import ScoringDashboard from "@/components/scoring-dashboard";
import type { Step, Substep, Behavior, Assessment as AssessmentType, AssessmentScore } from "@shared/schema";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

export default function Assessment() {
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentType | null>(null);
  const [checkedBehaviors, setCheckedBehaviors] = useState<Set<number>>(new Set());

  // Fetch all steps with substeps and behaviors
  const { data: steps = [], isLoading } = useQuery<StepWithSubsteps[]>({
    queryKey: ["/api/steps"],
  });

  // Fetch assessment scores
  const { data: scores = [] } = useQuery<AssessmentScore[]>({
    queryKey: ["/api/assessments", currentAssessment?.id, "scores"],
    enabled: !!currentAssessment,
  });

  // Create assessment mutation
  const createAssessmentMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/assessments", { title });
      return response.json();
    },
    onSuccess: (assessment: AssessmentType) => {
      setCurrentAssessment(assessment);
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
    },
  });

  // Update score mutation
  const updateScoreMutation = useMutation({
    mutationFn: async ({ assessmentId, behaviorId, checked }: { assessmentId: number; behaviorId: number; checked: boolean }) => {
      const response = await apiRequest("PUT", `/api/assessments/${assessmentId}/scores/${behaviorId}`, { checked });
      return response.json();
    },
    onSuccess: () => {
      if (currentAssessment) {
        queryClient.invalidateQueries({ queryKey: ["/api/assessments", currentAssessment.id, "scores"] });
      }
    },
  });

  // Initialize assessment if not exists
  const handleStartAssessment = () => {
    createAssessmentMutation.mutate(`Assessment ${new Date().toLocaleDateString()}`);
  };

  // Handle checkbox changes
  const handleBehaviorCheck = (behaviorId: number, checked: boolean) => {
    if (!currentAssessment) return;
    
    updateScoreMutation.mutate({
      assessmentId: currentAssessment.id,
      behaviorId,
      checked,
    });

    const newCheckedBehaviors = new Set(checkedBehaviors);
    if (checked) {
      newCheckedBehaviors.add(behaviorId);
    } else {
      newCheckedBehaviors.delete(behaviorId);
    }
    setCheckedBehaviors(newCheckedBehaviors);
  };

  // Update checked behaviors when scores change
  useState(() => {
    const checkedIds = scores.filter(score => score.checked).map(score => score.behaviorId);
    setCheckedBehaviors(new Set(checkedIds));
  }, [scores]);

  // Calculate total score
  const totalScore = steps.reduce((stepTotal, step) => {
    return stepTotal + step.substeps.reduce((substepTotal, substep) => {
      return substepTotal + substep.behaviors.reduce((behaviorTotal, behavior) => {
        if (checkedBehaviors.has(behavior.id)) {
          return behaviorTotal + behavior.proficiencyLevel;
        }
        return behaviorTotal;
      }, 0);
    }, 0);
  }, 0);

  const totalBehaviors = checkedBehaviors.size;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading assessment...</div>
      </div>
    );
  }

  if (!currentAssessment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">SSA Behavior Assessment</h1>
          <p className="text-gray-600 mb-6">Start a new assessment to begin scoring behaviors</p>
          <button
            onClick={handleStartAssessment}
            disabled={createAssessmentMutation.isPending}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createAssessmentMutation.isPending ? "Creating..." : "Start Assessment"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      <AssessmentHeader totalScore={totalScore} totalBehaviors={totalBehaviors} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProgressOverview steps={steps} checkedBehaviors={checkedBehaviors} />
        
        <div className="space-y-6">
          {steps.map((step) => (
            <AssessmentStep
              key={step.id}
              step={step}
              checkedBehaviors={checkedBehaviors}
              onBehaviorCheck={handleBehaviorCheck}
            />
          ))}
        </div>

        <ScoringDashboard 
          totalScore={totalScore} 
          totalBehaviors={totalBehaviors}
          steps={steps}
          checkedBehaviors={checkedBehaviors}
        />
      </div>
    </div>
  );
}
