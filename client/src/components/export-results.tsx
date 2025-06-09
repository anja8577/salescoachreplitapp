import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Download, Save, CheckCircle, User as UserIcon } from "lucide-react";
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
  assessmentStatus?: string; // "draft", "saved", "submitted"
  onStatusChange?: (newStatus: string) => void;
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
  assessmentId,
  assessmentStatus = 'draft',
  onStatusChange
}: ExportResultsProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [keyObservations, setKeyObservations] = useState('');
  const [whatWorkedWell, setWhatWorkedWell] = useState('');
  const [whatCanBeImproved, setWhatCanBeImproved] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);

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
  const stepScoreValues = Object.values(stepScores);
  const overallLevel = stepScoreValues.length > 0 ? stepScoreValues.reduce((sum: number, level: number) => sum + level, 0) / stepScoreValues.length : 0;
  
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
            className={`w-full p-3 border rounded-lg resize-none ${
              assessmentStatus === 'submitted' 
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' 
                : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            }`}
            rows={3}
            disabled={assessmentStatus === 'submitted'}
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
            className={`w-full p-3 border rounded-lg resize-none ${
              assessmentStatus === 'submitted' 
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' 
                : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            }`}
            rows={3}
            disabled={assessmentStatus === 'submitted'}
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
            className={`w-full p-3 border rounded-lg resize-none ${
              assessmentStatus === 'submitted' 
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' 
                : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            }`}
            rows={3}
            disabled={assessmentStatus === 'submitted'}
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
            className={`w-full p-3 border rounded-lg resize-none ${
              assessmentStatus === 'submitted' 
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' 
                : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            }`}
            rows={3}
            disabled={assessmentStatus === 'submitted'}
          />
        </div>
      </div>

      {/* Action Buttons - Centered */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 justify-center">
        
        {/* Save Session Button */}
        {assessor && assessmentStatus !== 'submitted' && (
          <Button
            onClick={async () => {
              setIsSaving(true);
              try {
                const coachingData = { keyObservations, whatWorkedWell, whatCanBeImproved, nextSteps };
                
                if (assessmentId && onSaveAssessment) {
                  // Update existing assessment
                  const response = await fetch(`/api/assessments/${assessmentId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      ...coachingData,
                      status: 'saved'
                    })
                  });

                  if (response.ok) {
                    onSaveAssessment(coachingData);
                    onStatusChange?.('saved');
                    toast({
                      title: "Session Saved",
                      description: "Coaching session saved successfully. You can continue editing.",
                    });
                  } else {
                    throw new Error('Failed to save assessment');
                  }
                } else {
                  // Save new assessment
                  const response = await fetch('/api/assessments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: assessmentTitle,
                      assesseeName: user.fullName,
                      context,
                      status: 'saved',
                      ...coachingData
                    })
                  });

                  if (response.ok) {
                    const newAssessment = await response.json();
                    onSaveAssessment?.(coachingData);
                    onStatusChange?.('saved');
                    toast({
                      title: "Session Saved",
                      description: "Coaching session saved successfully. You can continue editing.",
                    });
                  } else {
                    throw new Error('Failed to save assessment');
                  }
                }
              } catch (error) {
                console.error('Save error:', error);
                toast({
                  title: "Save Failed",
                  description: "Failed to save coaching session. Please try again.",
                  variant: "destructive",
                });
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="w-48 px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-200"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Session'}
          </Button>
        )}

        {/* Save and Submit Button */}
        {assessor && assessmentStatus !== 'submitted' && (
          <Button
            onClick={async () => {
              const isIncomplete = !keyObservations.trim() || !whatWorkedWell.trim() || !whatCanBeImproved.trim() || !nextSteps.trim();
              
              if (isIncomplete) {
                toast({
                  title: "Incomplete Session",
                  description: "Some fields are empty. Please complete all sections before submitting, or use 'Save Draft' to save your progress.",
                  variant: "destructive",
                });
                return;
              }
              
              setIsSubmitting(true);
              try {
                const coachingData = { keyObservations, whatWorkedWell, whatCanBeImproved, nextSteps };
                
                if (assessmentId && onSaveAssessment) {
                  // Update existing assessment and submit
                  const response = await fetch(`/api/assessments/${assessmentId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      ...coachingData,
                      status: 'submitted'
                    })
                  });

                  if (response.ok) {
                    onSaveAssessment(coachingData);
                    onStatusChange?.('submitted');
                    toast({
                      title: "Session Submitted",
                      description: "Coaching session has been submitted and locked. No further changes can be made.",
                      className: "border-green-200 bg-green-50 text-green-800",
                    });
                  } else {
                    throw new Error('Failed to submit assessment');
                  }
                } else {
                  // Save new assessment and submit
                  const response = await fetch('/api/assessments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: assessmentTitle,
                      assesseeName: user.fullName,
                      context,
                      status: 'submitted',
                      ...coachingData
                    })
                  });

                  if (response.ok) {
                    const newAssessment = await response.json();
                    onSaveAssessment?.(coachingData);
                    onStatusChange?.('submitted');
                    toast({
                      title: "Session Submitted",
                      description: "Coaching session has been submitted and locked. No further changes can be made.",
                      className: "border-green-200 bg-green-50 text-green-800",
                    });
                  } else {
                    throw new Error('Failed to submit assessment');
                  }
                }
              } catch (error) {
                console.error('Submit error:', error);
                toast({
                  title: "Submit Failed",
                  description: "Failed to submit coaching session. Please try again.",
                  variant: "destructive",
                });
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting}
            className="w-48 px-6 py-2 bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-200"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Submitting...' : 'Save & Submit'}
          </Button>
        )}

        {/* Download PDF Report Button */}
        <Button
          onClick={async () => {
            if (!assessmentId) return;
            
            // Check if assessment is submitted before allowing PDF download
            if (assessmentStatus !== 'submitted') {
              toast({
                title: "Session Not Submitted",
                description: "PDF reports can only be downloaded after the coaching session has been submitted. Please submit the session first.",
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
                toast({
                  title: "PDF Generation Failed",
                  description: "Failed to generate PDF report. Please try again.",
                  variant: "destructive",
                });
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
          className="w-48 px-6 py-2 bg-purple-600 text-white hover:bg-purple-700 focus:ring-2 focus:ring-purple-200"
        >
          <Download className="mr-2 h-4 w-4" />
          Download PDF Report
        </Button>
      </div>

      {/* Status indicator */}
      {assessor && (
        <div className={`text-sm p-3 rounded-lg ${
          assessmentStatus === 'submitted' 
            ? 'text-green-700 bg-green-50 border border-green-200' 
            : assessmentStatus === 'saved'
            ? 'text-blue-700 bg-blue-50 border border-blue-200'
            : 'text-amber-600 bg-amber-50 border border-amber-200'
        }`}>
          {assessmentStatus === 'submitted' 
            ? '✓ This session has been submitted and is locked from further editing.'
            : assessmentStatus === 'saved'
            ? '○ This session is saved as a draft and can still be edited.'
            : '○ This session is a draft. Save or submit to preserve your work.'}
        </div>
      )}

      {/* Assessment note */}
      {!assessor && (
        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          Note: You need to be logged in as a coach to save this assessment.
        </div>
      )}
    </div>
  );
}