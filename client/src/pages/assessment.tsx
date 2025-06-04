import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import AssessmentStep from "@/components/assessment-step";
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
  const [assessor, setAssessor] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [checkedBehaviors, setCheckedBehaviors] = useState<Set<number>>(new Set());
  const [stepScores, setStepScores] = useState<{ [stepId: number]: number }>({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [assesseeName, setAssesseeName] = useState<string>('');
  const [context, setContext] = useState<string>('');

  // Always call hooks in same order
  const { data: steps = [], isLoading: stepsLoading } = useQuery<StepWithSubsteps[]>({
    queryKey: ["/api/steps"],
  });

  const { data: scores = [] } = useQuery<AssessmentScore[]>({
    queryKey: ["/api/assessments", currentAssessment?.id, "scores"],
    enabled: !!currentAssessment,
  });

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
    
    if (userId && !currentUser && !currentAssessment) {
      handleUserSelected(parseInt(userId));
    } else if (!userId && !currentUser && !showUserModal) {
      setShowUserModal(true);
    }
  }, []);

  // Update checked behaviors when scores change
  useEffect(() => {
    if (scores.length > 0) {
      const checkedIds = scores.filter(score => score.checked).map(score => score.behaviorId);
      const newCheckedSet = new Set(checkedIds);
      
      if (newCheckedSet.size !== checkedBehaviors.size || 
          !Array.from(newCheckedSet).every(id => checkedBehaviors.has(id))) {
        setCheckedBehaviors(newCheckedSet);
      }
    }
  }, [scores]);

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
            onSaveAssessment={async (coachingData) => {
              if (!currentAssessment) return;
              
              try {
                const response = await fetch(`/api/assessments/${currentAssessment.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(coachingData),
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
          />
        )}
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <button
            onClick={() => window.location.href = '/'}
            className="flex flex-col items-center p-2 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs mt-1">Home</span>
          </button>

          <button
            onClick={() => setShowUserModal(true)}
            className="flex flex-col items-center p-2 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs mt-1">New Session</span>
          </button>

          <button
            onClick={() => window.location.href = '/coaching-history'}
            className="flex flex-col items-center p-2 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs mt-1">History</span>
          </button>

          <button
            onClick={() => window.location.href = '/profile'}
            className="flex flex-col items-center p-2 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs mt-1">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}