import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Download, Home, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Step, Substep, Behavior, User } from "@shared/schema";
import logoPath from "@assets/Sales Coach icon 11339b.png";

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

interface ExportResultsProps {
  steps: StepWithSubsteps[];
  checkedBehaviors: Set<number>;
  totalScore: number;
  user: User; // This is the coachee (person being coached)
  assessmentTitle: string;
  stepScores?: { [stepId: number]: number };
  onSaveAssessment?: (coachingData: { keyObservations: string; whatWorkedWell: string; whatCanBeImproved: string; nextSteps: string }) => void;
  assessor?: User; // The coach conducting the assessment
  context?: string; // Assessment context
  assessmentId?: number; // Current assessment ID
}

export default function ExportResults({ 
  steps, 
  checkedBehaviors, 
  totalScore, 
  user, 
  assessmentTitle,
  stepScores = {},
  onSaveAssessment,
  assessor,
  context = '',
  assessmentId
}: ExportResultsProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [keyObservations, setKeyObservations] = useState('');
  const [whatWorkedWell, setWhatWorkedWell] = useState('');
  const [whatCanBeImproved, setWhatCanBeImproved] = useState('');
  const [nextSteps, setNextSteps] = useState('');

  // Load current assessment data and prepopulate from previous session if available
  useEffect(() => {
    const loadAssessmentData = async () => {
      if (!assessmentId) return;
      
      try {
        // First load current assessment data
        const response = await fetch(`/api/assessments/${assessmentId}`);
        if (response.ok) {
          const currentAssessment = await response.json();
          
          // If current assessment has text, use it
          if (currentAssessment.keyObservations || currentAssessment.whatWorkedWell || 
              currentAssessment.whatCanBeImproved || currentAssessment.nextSteps) {
            if (currentAssessment.keyObservations) setKeyObservations(currentAssessment.keyObservations);
            if (currentAssessment.whatWorkedWell) setWhatWorkedWell(currentAssessment.whatWorkedWell);
            if (currentAssessment.whatCanBeImproved) setWhatCanBeImproved(currentAssessment.whatCanBeImproved);
            if (currentAssessment.nextSteps) setNextSteps(currentAssessment.nextSteps);
          } else {
            // If no text in current assessment, try to load from previous session
            try {
              const prevResponse = await fetch(`/api/coachees/${encodeURIComponent(user.fullName)}/previous-assessment/${assessmentId}`);
              if (prevResponse.ok) {
                const previousAssessment = await prevResponse.json();
                console.log("Loading previous assessment text for prepopulation:", previousAssessment);
                
                if (previousAssessment.keyObservations) setKeyObservations(previousAssessment.keyObservations);
                if (previousAssessment.whatWorkedWell) setWhatWorkedWell(previousAssessment.whatWorkedWell);
                if (previousAssessment.whatCanBeImproved) setWhatCanBeImproved(previousAssessment.whatCanBeImproved);
                if (previousAssessment.nextSteps) setNextSteps(previousAssessment.nextSteps);
              }
            } catch (prevError) {
              console.log("No previous assessment text found for prepopulation");
            }
          }
        }
      } catch (error) {
        console.log("Error loading assessment data:", error);
      }
    };

    loadAssessmentData();
  }, [assessmentId, user.fullName]);

  const generateResultsText = () => {
    const stepResults = steps.map(step => {
      const stepScore = step.substeps.reduce((total, substep) => {
        return total + substep.behaviors.reduce((substepTotal, behavior) => {
          if (checkedBehaviors.has(behavior.id)) {
            return substepTotal + behavior.proficiencyLevel;
          }
          return substepTotal;
        }, 0);
      }, 0);

      return `${step.title}: ${stepScore} points`;
    }).join('\n');

    return `SSA Behavior Assessment Results

User: ${user.fullName} (${user.email})
${user.team ? `Team: ${user.team}` : ''}
Assessment: ${assessmentTitle}
Date: ${new Date().toLocaleDateString()}

Total Score: ${totalScore} points

Step Breakdown:
${stepResults}

Detailed Assessment Summary:
${steps.map(step => {
  const manualLevel = stepScores[step.id];
  
  const checkedCount = step.substeps.reduce((total, substep) => {
    return total + substep.behaviors.reduce((substepTotal, behavior) => {
      if (checkedBehaviors.has(behavior.id)) {
        return substepTotal + 1;
      }
      return substepTotal;
    }, 0);
  }, 0);

  const totalCount = step.substeps.reduce((total, substep) => {
    return total + substep.behaviors.length;
  }, 0);

  const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  
  // Calculate unified level: manual > calculated
  const overallLevel = stepScores.reduce((sum, level) => sum + level, 0) / steps.length;
  
  return `${step.title}: ${percentage}% complete${manualLevel ? `, Manual Score: ${manualLevel}` : ''}`;
}).join('\n')}

Overall Performance Level: ${stepScores && Object.keys(stepScores).length > 0 ? 
  (Object.values(stepScores).reduce((sum, level) => sum + level, 0) / Object.keys(stepScores).length).toFixed(1) : 
  'Not scored'}`;
  };

  const shareAssessment = async () => {
    setIsSharing(true);
    
    const assessmentData = {
      user: user.fullName,
      email: user.email,
      team: user.team || '',
      totalScore,
      date: new Date().toISOString(),
      keyObservations: keyObservations || 'No observations recorded',
      whatWorkedWell: whatWorkedWell || 'No notes recorded',
      whatCanBeImproved: whatCanBeImproved || 'No notes recorded',
      nextSteps: nextSteps || 'No next steps recorded'
    };

    try {
      const response = await fetch('/api/share-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assessmentData,
          subject: `Sales Assessment Report for ${user.fullName}`,
          title: assessmentTitle,
        }),
      });

      if (response.ok) {
        toast({
          title: "✓ Assessment Shared Successfully",
          description: "Your assessment has been successfully shared.",
          className: "emotion-success-light-bg border-green-200",
        });
      } else {
        const errorData = await response.text();
        toast({
          title: "Error Sharing Assessment", 
          description: errorData || "Failed to share the assessment.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Could not connect to the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };



  const downloadResults = () => {
    const resultsText = generateResultsText();
    const blob = new Blob([resultsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-${user.fullName.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Results Downloaded",
      description: "Assessment results have been saved as a text file.",
    });
  };

  const handleSaveAndContinue = () => {
    if (onSaveAssessment) {
      onSaveAssessment({
        keyObservations,
        whatWorkedWell,
        whatCanBeImproved,
        nextSteps
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 rounded-full p-2">
            <UserIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Coaching Session Summary</h2>
            <p className="text-sm text-gray-600">Coaching notes for {user.fullName}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{totalScore}</div>
          <div className="text-sm text-gray-500">Total Points</div>
        </div>
      </div>

      {/* Context Section */}
      {context && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Session Context</h3>
          <p className="text-gray-700 text-sm">{context}</p>
        </div>
      )}

      {/* Coaching Notes Form */}
      <div className="space-y-4">
        <div>
          <label htmlFor="keyObservations" className="block text-sm font-medium text-gray-700 mb-2">
            Key Observations
          </label>
          <textarea
            id="keyObservations"
            value={keyObservations}
            onChange={(e) => setKeyObservations(e.target.value)}
            placeholder="What did you observe during this engagement?"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="whatWorkedWell" className="block text-sm font-medium text-gray-700 mb-2">
            What Worked Well
          </label>
          <textarea
            id="whatWorkedWell"
            value={whatWorkedWell}
            onChange={(e) => setWhatWorkedWell(e.target.value)}
            placeholder="Which strengths and positive behaviors were demonstrated?"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="whatCanBeImproved" className="block text-sm font-medium text-gray-700 mb-2">
            What Can Be Improved
          </label>
          <textarea
            id="whatCanBeImproved"
            value={whatCanBeImproved}
            onChange={(e) => setWhatCanBeImproved(e.target.value)}
            placeholder="Which 1-2 behaviors could be improved and how?"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="nextSteps" className="block text-sm font-medium text-gray-700 mb-2">
            Next Steps
          </label>
          <textarea
            id="nextSteps"
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
            placeholder="Action items and follow-up plans..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* Action Buttons - Centered */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 justify-center">
        <Button
          onClick={handleSaveAndContinue}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
          disabled={!assessor}
        >
          <Home className="mr-2 h-4 w-4" />
          Save Coaching Session
        </Button>

        <Button
          onClick={async () => {
            if (!assessmentId) return;
            
            // Check if session has been saved
            if (!keyObservations && !whatWorkedWell && !whatCanBeImproved && !nextSteps) {
              toast({
                title: "Session Not Saved",
                description: "Please save the coaching session first before downloading the PDF report.",
                variant: "destructive",
              });
              return;
            }
            
            try {
              // Include coach information in the request
              const authToken = localStorage.getItem('auth_token');
              const headers: HeadersInit = {};
              if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
              }
              
              const response = await fetch(`/api/assessments/${assessmentId}/pdf`, {
                headers
              });
              if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                // Use the same filename format as the server
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
                const coacheeName = user.fullName.replace(/[^a-zA-Z0-9]/g, '_');
                a.download = `SalesCoach_Report_${coacheeName}_${dateStr}_${timeStr}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
                
                toast({
                  title: "PDF Downloaded",
                  description: "Your assessment report has been downloaded successfully.",
                });
              } else {
                const errorData = await response.json();
                if (errorData.requiresSave) {
                  toast({
                    title: "Session Not Saved",
                    description: "Please save the coaching session first before downloading the PDF report.",
                    variant: "destructive",
                  });
                } else {
                  toast({
                    title: "PDF Generation Failed",
                    description: "Failed to generate PDF report. Please try again.",
                    variant: "destructive",
                  });
                }
              }
            } catch (error) {
              console.error('PDF download error:', error);
              toast({
                title: "PDF Download Failed",
                description: "There was an error downloading the PDF. Please try again.",
                variant: "destructive",
              });
            }
          }}
          variant="outline"
          className="px-6 py-2"
        >
          <Download className="mr-2 h-4 w-4" />
          Download PDF Report
        </Button>
      </div>

      {/* Assessment note */}
      {!assessor && (
        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          Note: You need to be logged in as a coach to save this assessment.
        </div>
      )}
    </div>
  );
}