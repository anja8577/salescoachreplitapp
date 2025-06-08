import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import AssessmentStep from "@/components/assessment-step";
import SpiderGraph from "@/components/spider-graph";
import ExportResults from "@/components/export-results";
import UserSelectionModal from "@/components/user-selection-modal";
import AuthModal from "@/components/auth-modal";
import SalesCoachHeader from "@/components/sales-coach-header";
import AppFooter from "@/components/app-footer";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Step, Substep, Behavior, User, Assessment as AssessmentType, AssessmentScore, StepScore } from "@shared/schema";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

export default function Assessment() {
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentType | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [assessor, setAssessor] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [checkedBehaviors, setCheckedBehaviors] = useState<Set<number>>(new Set());
  const [stepScores, setStepScores] = useState<{ [stepId: number]: number }>({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [assesseeName, setAssesseeName] = useState<string>('');
  const [context, setContext] = useState<string>('');
  
  // Check if we're in readonly mode
  const urlParams = new URLSearchParams(window.location.search);
  const isReadonly = urlParams.get('readonly') === 'true';
  const isLocked = currentAssessment?.status === 'submitted';

  // Always call hooks in same order
  const { data: steps = [], isLoading: stepsLoading } = useQuery<StepWithSubsteps[]>({
    queryKey: ["/api/steps"],
  });

  const { data: scores = [] } = useQuery<AssessmentScore[]>({
    queryKey: ["/api/assessments", currentAssessment?.id, "scores"],
    enabled: !!currentAssessment,
  });

  const { data: stepScoresData = [] } = useQuery<StepScore[]>({
    queryKey: ["/api/assessments", currentAssessment?.id, "step-scores"],
    enabled: !!currentAssessment,
  });

  const duplicateBaselineFromPreviousSession = async (coacheeName: string, newAssessmentId: number) => {
    try {
      console.log("Attempting to duplicate baseline for:", coacheeName);
      
      // Get previous assessment for this coachee (excluding current one)
      const response = await fetch(`/api/coachees/${encodeURIComponent(coacheeName)}/previous-assessment/${newAssessmentId}`);
      
      if (!response.ok) {
        console.log("No previous coaching session found for", coacheeName);
        return;
      }
      
      const previousAssessment = await response.json();
      
      console.log("Found previous assessment:", previousAssessment.id);
      
      // Get scores from previous assessment
      const scoresResponse = await fetch(`/api/assessments/${previousAssessment.id}/scores`);
      if (scoresResponse.ok) {
        const previousScores = await scoresResponse.json();
        console.log("Found", previousScores.length, "previous behavior scores to duplicate");
        
        // Duplicate each score to the new assessment
        const newCheckedBehaviors = new Set<number>();
        for (const score of previousScores) {
          if (score.checked) {
            newCheckedBehaviors.add(score.behaviorId);
            
            // Save score to new assessment
            await fetch(`/api/assessments/${newAssessmentId}/scores/${score.behaviorId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ checked: true }),
            });
          }
        }
        
        // Update UI with duplicated scores
        setCheckedBehaviors(newCheckedBehaviors);
        console.log("Baseline duplication completed - duplicated", newCheckedBehaviors.size, "behavioral scores");
        
        // Invalidate queries to refresh scores
        queryClient.invalidateQueries({ queryKey: ["/api/assessments", newAssessmentId, "scores"] });
      }
      
      // Duplicate step scores from previous assessment
      const stepScoresResponse = await fetch(`/api/assessments/${previousAssessment.id}/step-scores`);
      if (stepScoresResponse.ok) {
        const previousStepScores = await stepScoresResponse.json();
        console.log("Found", previousStepScores.length, "previous step scores to duplicate");
        
        // Duplicate each step score to the new assessment
        const newStepScores: { [stepId: number]: number } = {};
        for (const stepScore of previousStepScores) {
          newStepScores[stepScore.stepId] = stepScore.level;
          
          // Save step score to new assessment
          await fetch(`/api/assessments/${newAssessmentId}/step-scores/${stepScore.stepId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ level: stepScore.level }),
          });
        }
        
        // Update UI with duplicated step scores
        setStepScores(newStepScores);
        console.log("Step score duplication completed - duplicated", Object.keys(newStepScores).length, "step evaluations");
        
        // Invalidate queries to refresh step scores
        queryClient.invalidateQueries({ queryKey: ["/api/assessments", newAssessmentId, "step-scores"] });
      }
      
    } catch (error) {
      console.log("Could not duplicate previous session as baseline:", error);
    }
  };

  const createAssessmentMutation = useMutation<AssessmentType, Error, { title: string; userId: number; assesseeName: string }>({
    mutationFn: async ({ title, userId, assesseeName }) => {
      console.log("Creating assessment with:", { title, userId, assesseeName });
      const res = await apiRequest("POST", "/api/assessments", { title, userId, assesseeName });
      const data = await res.json();
      console.log("Assessment API response:", data);
      return data;
    },
    onSuccess: async (assessment: AssessmentType) => {
      console.log("Assessment created successfully:", assessment);
      setCurrentAssessment(assessment);
      setShowUserModal(false);
      
      // Try to duplicate baseline from previous coaching session
      await duplicateBaselineFromPreviousSession(assessment.assesseeName, assessment.id);
      
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
    },
    onError: (error: Error) => {
      console.error("Error creating assessment:", error);
      alert("Failed to create assessment. Please try again.");
    },
  });

  const updateScoreMutation = useMutation({
    mutationFn: async ({ behaviorId, checked }: { behaviorId: number; checked: boolean }) => {
      if (!currentAssessment) throw new Error("No current assessment");
      
      const res = await apiRequest("PUT", `/api/assessments/${currentAssessment.id}/scores/${behaviorId}`, { checked });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", currentAssessment?.id, "scores"] });
    },
    onError: (error) => {
      console.error("Error updating score:", error);
    },
  });

  const updateStepScoreMutation = useMutation({
    mutationFn: async ({ stepId, level }: { stepId: number; level: number }) => {
      if (!currentAssessment) throw new Error("No current assessment");
      
      const res = await apiRequest("PUT", `/api/assessments/${currentAssessment.id}/step-scores/${stepId}`, { level });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", currentAssessment?.id, "step-scores"] });
    },
    onError: (error) => {
      console.error("Error updating step score:", error);
    },
  });

  // Convert step scores data to object format for compatibility
  const stepScoresMap = stepScoresData.reduce((acc, score) => {
    acc[score.stepId] = score.level;
    return acc;
  }, {} as { [stepId: number]: number });

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setShowAuthModal(true);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setAssessor(userData);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('auth_token');
          setShowAuthModal(true);
        }
      } catch {
        localStorage.removeItem('auth_token');
        setShowAuthModal(true);
      }
    };

    checkAuth();
  }, []);

  // Handle URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    const assessmentId = urlParams.get('id');
    
    if (assessmentId) {
      // Load existing assessment by ID
      loadExistingAssessment(parseInt(assessmentId));
    } else if (userId && !currentUser && !currentAssessment) {
      handleUserSelected(parseInt(userId));
    } else if (!userId && !currentUser && !showUserModal) {
      setShowUserModal(true);
    }
  }, []);

  const loadExistingAssessment = async (assessmentId: number) => {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}`);
      if (response.ok) {
        const assessment = await response.json();
        setCurrentAssessment(assessment);
        
        // Get user details
        const userResponse = await fetch(`/api/users/${assessment.userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser(userData);
        }
        
        setAssesseeName(assessment.assesseeName);
        setContext(assessment.context || '');
        
        // Load coaching observations if they exist
        if (assessment.keyObservations || assessment.whatWorkedWell || assessment.whatCanBeImproved || assessment.nextSteps) {
          // The coaching observations will be loaded by the ExportResults component
        }
        
        // Manually load scores for this assessment
        await loadScoresForAssessment(assessmentId);
        
        // Load step scores too
        await loadStepScoresForAssessment(assessmentId);
      }
    } catch (error) {
      console.error("Error loading existing assessment:", error);
    }
  };

  const loadScoresForAssessment = async (assessmentId: number) => {
    try {
      const scoresResponse = await fetch(`/api/assessments/${assessmentId}/scores`);
      if (scoresResponse.ok) {
        const scoresData = await scoresResponse.json();
        const checkedIds = scoresData.filter((score: any) => score.checked).map((score: any) => score.behaviorId);
        console.log("Manually loading scores:", checkedIds.length, "behaviors checked", checkedIds);
        
        // Force state update and trigger re-render
        setCheckedBehaviors(new Set());
        setTimeout(() => {
          setCheckedBehaviors(new Set(checkedIds));
        }, 100);
        
        // Invalidate query cache to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/assessments", assessmentId, "scores"] });
      }
    } catch (error) {
      console.error("Error loading scores:", error);
    }
  };

  const loadStepScoresForAssessment = async (assessmentId: number) => {
    try {
      const stepScoresResponse = await fetch(`/api/assessments/${assessmentId}/step-scores`);
      if (stepScoresResponse.ok) {
        const stepScoresData = await stepScoresResponse.json();
        const stepScoresMap = stepScoresData.reduce((acc: any, score: any) => {
          acc[score.stepId] = score.level;
          return acc;
        }, {});
        console.log("Manually loading step scores:", Object.keys(stepScoresMap).length, "steps scored");
        setStepScores(stepScoresMap);
        
        // Invalidate query cache to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/assessments", assessmentId, "step-scores"] });
      }
    } catch (error) {
      console.error("Error loading step scores:", error);
    }
  };

  // Simple state watcher - only update when assessment changes, like context text
  useEffect(() => {
    if (currentAssessment && scores.length > 0) {
      const checkedIds = scores.filter(score => score.checked).map(score => score.behaviorId);
      console.log("Loading saved scores:", checkedIds.length, "behaviors checked");
      setCheckedBehaviors(new Set(checkedIds));
    } else if (currentAssessment) {
      // Clear behaviors for new assessments
      setCheckedBehaviors(new Set());
    }
  }, [currentAssessment?.id]);

  const handleUserSelected = async (userId: number) => {
    console.log("User selected:", userId);
    try {
      setCurrentAssessment(null);
      setCheckedBehaviors(new Set());
      setStepScores({});
      
      console.log("Fetching user details for ID:", userId);
      const response = await fetch(`/api/users/${userId}`);
      let selectedUser;
      if (response.ok) {
        selectedUser = await response.json();
        console.log("User details fetched:", selectedUser);
      } else {
        console.log("Failed to fetch user details, using fallback");
        selectedUser = { id: userId, fullName: "User", email: "", team: null, createdAt: new Date() };
      }
      
      const assesseeName = selectedUser.fullName;
      setAssesseeName(assesseeName);
      setCurrentUser(selectedUser);
      
      const title = `Assessment for ${assesseeName} - ${new Date().toLocaleDateString()}`;
      console.log("About to create assessment with title:", title);
      
      createAssessmentMutation.mutate({ title, userId, assesseeName });
    } catch (error) {
      console.error("Error in handleUserSelected:", error);
      alert("Failed to create assessment. Please try again.");
    }
  };

  const handleBehaviorCheck = (behaviorId: number, checked: boolean) => {
    const newCheckedBehaviors = new Set(checkedBehaviors);
    if (checked) {
      newCheckedBehaviors.add(behaviorId);
    } else {
      newCheckedBehaviors.delete(behaviorId);
    }
    setCheckedBehaviors(newCheckedBehaviors);
    
    updateScoreMutation.mutate({ behaviorId, checked });
  };

  const handleStepScoreChange = (stepId: number, level: number) => {
    setStepScores(prev => ({ ...prev, [stepId]: level }));
    
    // Save to database
    updateStepScoreMutation.mutate({ stepId, level });
  };

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

  const handleAuthSuccess = (user: User, token: string) => {
    setAssessor(user);
    setIsAuthenticated(true);
    setShowAuthModal(false);
  };

  const handleNewAssessment = () => {
    setShowUserModal(true);
  };

  if (stepsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading assessment...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        {showAuthModal && (
          <AuthModal 
            onAuthSuccess={handleAuthSuccess}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </div>
    );
  }

  // Show user selection if no user is selected and no assessment exists
  if (!currentUser && !currentAssessment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <UserSelectionModal 
          open={true}
          onClose={() => window.location.href = '/'}
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header with Logo, SalesCoach left, Coaching Session title right */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo and SalesCoach */}
            <div className="flex items-center">
              <SalesCoachHeader showLogo={true} size="sm" />
            </div>

            {/* Right side - Title */}
            <div className="flex items-center">
              <h1 className="text-lg font-semibold text-gray-900">Coaching Session</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-header with Coachee name left, Date/Time right */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="text-sm font-medium text-gray-700">
            Coachee: {currentUser?.fullName}
          </div>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
      
      <UserSelectionModal 
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        onUserSelected={handleUserSelected}
      />
      
      <div className="max-w-4xl mx-auto px-4 py-4 pb-20 space-y-4">
        {/* Context Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <label htmlFor="context" className="block text-sm font-medium text-gray-700 mb-2">
            Context
          </label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Enter assessment context, background information, or specific focus areas..."
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
          />
        </div>

        {/* Assessment Steps - Mobile Optimized */}
        <div className="space-y-4">
          {steps.map((step) => (
            <AssessmentStep
              key={step.id}
              step={step}
              checkedBehaviors={checkedBehaviors}
              onBehaviorCheck={handleBehaviorCheck}
              stepScores={stepScores}
              onStepScoreChange={handleStepScoreChange}
            />
          ))}
        </div>
        
        {/* Spider Graph */}
        <SpiderGraph steps={steps} checkedBehaviors={checkedBehaviors} stepScores={stepScores} />
        
        {/* Export Results */}
        {currentUser && currentAssessment && (
          <ExportResults
            steps={steps}
            checkedBehaviors={checkedBehaviors}
            totalScore={totalScore}
            user={currentUser}
            assessmentTitle={currentAssessment.title}
            stepScores={stepScores}
            assessor={assessor}
            context={context}
            onSaveAssessment={async (coachingData) => {
              if (!currentAssessment) return;
              
              try {
                const saveData = {
                  ...coachingData,
                  context: context // Include the context field
                };
                
                const response = await fetch(`/api/assessments/${currentAssessment.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(saveData),
                });
                
                if (response.ok) {
                  alert('Coaching session saved successfully!');
                } else {
                  alert('Failed to save coaching session. Please try again.');
                }
              } catch (error) {
                console.error('Error saving coaching session:', error);
                alert('Failed to save coaching session. Please try again.');
              }
            }}
            assessmentId={currentAssessment.id}
            assessmentStatus={currentAssessment.status}
            onStatusChange={(newStatus) => {
              setCurrentAssessment(prev => prev ? { ...prev, status: newStatus } : null);
            }}
          />
        )}
      </div>

      <AppFooter />
    </div>
  );
}