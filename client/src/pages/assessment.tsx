import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import AssessmentHeader from "@/components/assessment-header";
import AssessmentStep from "@/components/assessment-step";
import ScoringDashboard from "@/components/scoring-dashboard";
import SpiderGraph from "@/components/spider-graph";
import ExportResults from "@/components/export-results";
import UserSelectionModal from "@/components/user-selection-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Step, Substep, Behavior, User, Assessment as AssessmentType, AssessmentScore } from "@shared/schema";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

export default function Assessment() {
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentType | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
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
    mutationFn: async ({ title, userId }: { title: string; userId: number }) => {
      return await apiRequest("/api/assessments", "POST", { title, userId });
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
  useEffect(() => {
    if (scores.length > 0) {
      const checkedIds = scores.filter(score => score.checked).map(score => score.behaviorId);
      const newCheckedSet = new Set(checkedIds);
      
      // Only update if the sets are actually different
      if (newCheckedSet.size !== checkedBehaviors.size || 
          !Array.from(newCheckedSet).every(id => checkedBehaviors.has(id))) {
        setCheckedBehaviors(newCheckedSet);
      }
    }
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

  const handleUserSelected = async (userId: number) => {
    // Fetch user details (simplified for now)
    setCurrentUser({ id: userId, fullName: "", email: "", team: null, createdAt: new Date() } as User);
    const title = `Assessment ${new Date().toLocaleDateString()}`;
    createAssessmentMutation.mutate({ title, userId });
  };

  // Show user selection if no user is selected
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">SSA Behavior Assessment</h1>
          <p className="text-gray-600 mb-6">Select or create a user to begin the assessment</p>
          <Button onClick={() => setShowUserModal(true)} className="w-full">
            <Plus className="mr-2" size={16} />
            Start Assessment
          </Button>
        </div>
        
        <UserSelectionModal 
          open={showUserModal}
          onClose={() => setShowUserModal(false)}
          onUserSelected={handleUserSelected}
        />
      </div>
    );
  }

  if (!currentAssessment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg text-gray-600">Creating assessment...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AssessmentHeader totalScore={totalScore} totalBehaviors={totalBehaviors} steps={steps} />
      
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Assessment Steps - Mobile Optimized */}
        <div className="space-y-4">
          {steps.map((step) => (
            <AssessmentStep
              key={step.id}
              step={step}
              checkedBehaviors={checkedBehaviors}
              onBehaviorCheck={handleBehaviorCheck}
            />
          ))}
        </div>
        
        {/* Spider Graph */}
        <SpiderGraph steps={steps} checkedBehaviors={checkedBehaviors} />
        
        {/* Scoring Dashboard */}
        <ScoringDashboard 
          totalScore={totalScore} 
          totalBehaviors={totalBehaviors}
          steps={steps}
          checkedBehaviors={checkedBehaviors}
        />
        
        {/* Export Results */}
        {currentUser && currentAssessment && (
          <ExportResults
            steps={steps}
            checkedBehaviors={checkedBehaviors}
            totalScore={totalScore}
            user={currentUser}
            assessmentTitle={currentAssessment.title}
          />
        )}
      </div>
    </div>
  );
}
