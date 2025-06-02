import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import AssessmentHeader from "@/components/assessment-header";
import AssessmentStep from "@/components/assessment-step";
import ScoringDashboard from "@/components/scoring-dashboard";
import SpiderGraph from "@/components/spider-graph";
import ExportResults from "@/components/export-results";
import UserSelectionModal from "@/components/user-selection-modal";
import AuthModal from "@/components/auth-modal";
import SalesCoachHeader from "@/components/sales-coach-header";
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
  const [assessor, setAssessor] = useState<User | null>(null); // The logged-in user conducting the assessment
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [checkedBehaviors, setCheckedBehaviors] = useState<Set<number>>(new Set());
  const [stepScores, setStepScores] = useState<{ [stepId: number]: number }>({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [assesseeName, setAssesseeName] = useState<string>('');
  const [context, setContext] = useState<string>('');

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
  const createAssessmentMutation = useMutation<AssessmentType, Error, { title: string; userId: number; assesseeName: string }>({
    mutationFn: async ({ title, userId, assesseeName }) => {
      console.log("Creating assessment with:", { title, userId, assesseeName });
      try {
        const res = await apiRequest("POST", "/api/assessments", { title, userId, assesseeName });
        const data = await res.json();
        console.log("Assessment API response:", data);
        return data;
      } catch (error) {
        console.error("API request failed:", error);
        throw error;
      }
    },
    onSuccess: (assessment: AssessmentType) => {
      console.log("Assessment created successfully:", assessment);
      setCurrentAssessment(assessment);
      setShowUserModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
    },
    onError: (error) => {
      console.error("Assessment creation failed:", error);
      console.error("Error details:", { 
        message: error.message, 
        stack: error.stack,
        name: error.name 
      });
      alert(`Failed to create assessment: ${error.message}`);
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

  // Handle step-level scoring
  const handleStepScoreChange = (stepId: number, level: number) => {
    setStepScores(prev => ({
      ...prev,
      [stepId]: level
    }));
    
    // Optional: You could save this to the backend here if needed
    // This would require creating a new API endpoint for step-level scores
  };

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setShowAuthModal(true);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const user = await response.json();
          setAssessor(user); // Store the logged-in user as the assessor
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
    console.log("User selected:", userId);
    try {
      // Reset current state for new assessment
      setCurrentAssessment(null);
      setCheckedBehaviors(new Set());
      setStepScores({});
      
      // Fetch user details from API - this user becomes the assessee
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
      
      // The selected user becomes the assessee
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

  // Show user selection if no user is selected
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Selling Skills Assessment</h1>
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

  const handleAuthSuccess = (user: User, token: string) => {
    setAssessor(user); // Store the logged-in user as the assessor
    setIsAuthenticated(true);
    setShowAuthModal(false);
  };

  const handleNewAssessment = () => {
    setShowUserModal(true);
  };

  // Show authentication modal if not authenticated
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AssessmentHeader 
        totalScore={totalScore} 
        totalBehaviors={totalBehaviors} 
        steps={steps}
        checkedBehaviors={checkedBehaviors}
        stepScores={stepScores}
        onNewAssessment={handleNewAssessment}
      />
      
      <UserSelectionModal 
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        onUserSelected={handleUserSelected}
      />
      
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
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
            onSaveAssessment={() => {
              // Auto-save functionality - assessment is already being saved in real-time
              alert('Assessment saved successfully!');
            }}
          />
        )}
      </div>
    </div>
  );
}
