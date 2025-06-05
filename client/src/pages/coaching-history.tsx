import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, User, Users, Eye, Download, Filter, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { StepLevelCalculator } from "@shared/stepLevelCalculator";
import type { Assessment, User as UserType, AssessmentScore, StepScore, Step, Substep, Behavior } from "@shared/schema";

export default function CoachingHistory() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterCoachee, setFilterCoachee] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [assessmentScores, setAssessmentScores] = useState<{ [assessmentId: number]: AssessmentScore[] }>({});
  const [stepScores, setStepScores] = useState<{ [assessmentId: number]: StepScore[] }>({});

  // Fetch all assessments
  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });

  // Fetch all users for filtering
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  // Fetch all steps for calculating proficiency levels
  const { data: steps = [] } = useQuery<(Step & { substeps: (Substep & { behaviors: Behavior[] })[] })[]>({
    queryKey: ["/api/steps"],
  });

  // Load assessment scores when assessments change
  useEffect(() => {
    const loadAssessmentData = async () => {
      for (const assessment of assessments) {
        if (!assessmentScores[assessment.id]) {
          try {
            const scoresResponse = await fetch(`/api/assessments/${assessment.id}/scores`);
            const stepScoresResponse = await fetch(`/api/assessments/${assessment.id}/step-scores`);
            
            if (scoresResponse.ok && stepScoresResponse.ok) {
              const scores = await scoresResponse.json();
              const stepScoreData = await stepScoresResponse.json();
              
              setAssessmentScores(prev => ({ ...prev, [assessment.id]: scores }));
              setStepScores(prev => ({ ...prev, [assessment.id]: stepScoreData }));
            }
          } catch (error) {
            console.error(`Error loading data for assessment ${assessment.id}:`, error);
          }
        }
      }
    };

    if (assessments.length > 0) {
      loadAssessmentData();
    }
  }, [assessments]);

  // Get unified step levels using the calculator
  const getUnifiedStepLevels = (assessmentId: number) => {
    const stepScoreData = stepScores[assessmentId] || [];
    const assessmentScoreData = assessmentScores[assessmentId] || [];
    
    return StepLevelCalculator.getUnifiedStepLevels(steps, assessmentScoreData, stepScoreData);
  };

  // Calculate proficiency level for an assessment
  const calculateProficiencyLevel = (assessmentId: number) => {
    const unifiedLevels = getUnifiedStepLevels(assessmentId);
    const proficiency = StepLevelCalculator.getOverallProficiencyLevel(unifiedLevels);
    return proficiency.text;
  };

  // Get step badge data using unified levels
  const getStepBadges = (assessmentId: number) => {
    const unifiedLevels = getUnifiedStepLevels(assessmentId);
    
    return unifiedLevels.map((stepLevel, index) => {
      const levelText = StepLevelCalculator.getLevelShortCode(stepLevel.level);
      const colorClass = StepLevelCalculator.getLevelBadgeClass(stepLevel.level);
      const displayText = `${index + 1}: ${levelText}`;
      
      return { stepNumber: index + 1, levelText: displayText, colorClass };
    });
  };

  // Get unique teams for filtering
  const teams = Array.from(new Set(users.map(user => user.team).filter(Boolean)));
  
  // Get unique coachees for filtering
  const coachees = Array.from(new Set(assessments.map(assessment => assessment.assesseeName)));

  // Filter assessments based on search and filters
  const filteredAssessments = assessments.filter(assessment => {
    const matchesSearch = assessment.assesseeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assessment.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeam = filterTeam === "all" || 
                       users.find(user => user.fullName === assessment.assesseeName)?.team === filterTeam;
    
    const matchesCoachee = filterCoachee === "all" || assessment.assesseeName === filterCoachee;

    return matchesSearch && matchesTeam && matchesCoachee;
  });

  // Sort assessments by date (newest first)
  const sortedAssessments = [...filteredAssessments].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const handleViewAssessment = (assessmentId: number) => {
    setLocation(`/assessment?id=${assessmentId}`);
  };



  const handleDownloadPDF = async (assessment: Assessment) => {
    try {
      // Fetch the detailed assessment data including steps, behaviors, and scores
      const [stepsResponse, scoresResponse, stepScoresResponse] = await Promise.all([
        fetch('/api/steps'),
        fetch(`/api/assessments/${assessment.id}/scores`),
        fetch(`/api/assessments/${assessment.id}/step-scores`)
      ]);

      const steps = await stepsResponse.json();
      const behaviorScores = await scoresResponse.json();
      const stepScores = await stepScoresResponse.json();

      // Create a set of checked behaviors
      const checkedBehaviors = new Set(behaviorScores.filter((score: any) => score.checked).map((score: any) => score.behaviorId));
      
      // Create step scores map
      const stepScoresMap: { [key: number]: number } = {};
      stepScores.forEach((score: any) => {
        stepScoresMap[score.stepId] = score.level;
      });

      const element = document.createElement('div');
      element.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif; line-height: 1.6; background: white;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1f2937; margin-bottom: 10px; font-size: 24px;">Sales Coaching Assessment Report</h1>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Coachee:</strong> ${assessment.assesseeName || 'Unknown'}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${assessment.createdAt ? new Date(assessment.createdAt).toLocaleDateString() : 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Title:</strong> ${assessment.title || 'Assessment Session'}</p>
            </div>
          </div>

          <div style="margin-bottom: 30px;">
            <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; font-size: 18px;">Performance Overview</h2>
            <div style="margin-top: 20px;">
              ${steps.map((step: any, stepIndex: number) => {
                const manualLevel = stepScoresMap[step.id];
                const checkedCount = step.substeps.reduce((total: number, substep: any) => {
                  return total + substep.behaviors.reduce((substepTotal: number, behavior: any) => {
                    if (checkedBehaviors.has(behavior.id)) {
                      return substepTotal + 1;
                    }
                    return substepTotal;
                  }, 0);
                }, 0);
                const totalCount = step.substeps.reduce((total: number, substep: any) => {
                  return total + substep.behaviors.length;
                }, 0);
                const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
                
                return `
                  <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 15px;">
                    <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 16px;">${stepIndex + 1}. ${step.title}</h3>
                    <div style="margin-bottom: 15px;">
                      <div style="font-size: 14px; color: #6b7280; margin-bottom: 5px;">Behaviors: ${checkedCount}/${totalCount} (${percentage}%)</div>
                      <div style="background: #e5e7eb; height: 12px; border-radius: 6px; margin: 8px 0;">
                        <div style="background: ${percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444'}; height: 100%; border-radius: 6px; width: ${percentage}%;"></div>
                      </div>
                      ${manualLevel ? `
                        <div style="font-size: 14px; color: #6b7280; margin-top: 8px;">
                          <strong>Manual Score: Level ${manualLevel}</strong>
                        </div>
                      ` : ''}
                    </div>
                    
                    <div style="margin-top: 15px;">
                      <h4 style="color: #4b5563; margin: 0 0 10px 0; font-size: 14px;">Demonstrated Behaviors:</h4>
                      ${step.substeps.map((substep: any) => {
                        const checkedBehaviorsList = substep.behaviors.filter((behavior: any) => checkedBehaviors.has(behavior.id));
                        if (checkedBehaviorsList.length === 0) return '';
                        return `
                          <div style="margin-bottom: 10px;">
                            <strong style="color: #374151; font-size: 13px;">${substep.title}:</strong>
                            <ul style="margin: 5px 0 0 20px; padding: 0;">
                              ${checkedBehaviorsList.map((behavior: any) => `
                                <li style="font-size: 12px; color: #6b7280; margin-bottom: 3px;">${behavior.description}</li>
                              `).join('')}
                            </ul>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${assessment.keyObservations ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #1f2937; margin-bottom: 10px; font-size: 16px;">Key Observations</h3>
              <p style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 0; line-height: 1.5;">${assessment.keyObservations}</p>
            </div>
          ` : ''}

          ${assessment.whatWorkedWell ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #1f2937; margin-bottom: 10px; font-size: 16px;">What Worked Well</h3>
              <p style="background: #f0fdf4; padding: 15px; border-radius: 6px; margin: 0; border-left: 4px solid #10b981; line-height: 1.5;">${assessment.whatWorkedWell}</p>
            </div>
          ` : ''}

          ${assessment.whatCanBeImproved ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #1f2937; margin-bottom: 10px; font-size: 16px;">What Can Be Improved</h3>
              <p style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 0; border-left: 4px solid #ef4444; line-height: 1.5;">${assessment.whatCanBeImproved}</p>
            </div>
          ` : ''}

          ${assessment.nextSteps ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #1f2937; margin-bottom: 10px; font-size: 16px;">Next Steps</h3>
              <p style="background: #eff6ff; padding: 15px; border-radius: 6px; margin: 0; border-left: 4px solid #3b82f6; line-height: 1.5;">${assessment.nextSteps}</p>
            </div>
          ` : ''}

          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p>Generated by SalesCoach Assessment Platform - ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      `;
      
      document.body.appendChild(element);
      
      const { jsPDF } = await import('jspdf');
      const html2canvas = await import('html2canvas');
      
      const canvas = await html2canvas.default(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF();
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`coaching-report-${assessment.assesseeName || 'assessment'}-${assessment.id}.pdf`);
      document.body.removeChild(element);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report.');
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return { date: 'N/A', time: 'N/A' };
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader title="Coaching History" />
        <div className="flex items-center justify-center pt-20">
          <div className="text-lg text-gray-600">Loading coaching history...</div>
        </div>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <AppHeader title="Coaching History" />
      
      <div className="max-w-4xl mx-auto px-4 pt-20">
        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Search by coachee name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Filters - Updated order as requested */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Filter By Coachee - First */}
          <Select value={filterCoachee} onValueChange={setFilterCoachee}>
            <SelectTrigger>
              <SelectValue placeholder="Filter By Coachee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Coachees</SelectItem>
              {coachees.map((coachee) => (
                <SelectItem key={coachee} value={coachee}>
                  {coachee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter By Team - Second */}
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger>
              <SelectValue placeholder="Filter By Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team} value={team}>
                  {team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter By Date - Third (new) */}
          <Select value={filterDate} onValueChange={setFilterDate}>
            <SelectTrigger>
              <SelectValue placeholder="Filter By Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assessment List */}
        <div className="space-y-4">
          {sortedAssessments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-500">
                  {assessments.length === 0 
                    ? "No coaching sessions found. Start your first assessment to see history here."
                    : "No sessions match your current filters."
                  }
                </div>
              </CardContent>
            </Card>
          ) : (
            sortedAssessments.map((assessment) => {
              const dateTime = formatDateTime(assessment.createdAt);
              const user = users.find(u => u.fullName === assessment.assesseeName);
              
              return (
                <Card key={assessment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {assessment.title || 'Assessment Session'}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center space-x-1">
                            <User size={16} />
                            <span>{assessment.assesseeName || 'Unknown'}</span>
                          </div>
                          {user?.team && (
                            <div className="flex items-center space-x-1">
                              <Users size={16} />
                              <span>{user.team}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Calendar size={16} />
                            <span>{dateTime.date} at {dateTime.time}</span>
                          </div>
                        </div>
                        
                        {/* Third row: Proficiency Level and Step Levels */}
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-600">Proficiency:</span>
                            {(() => {
                              const proficiencyLevel = calculateProficiencyLevel(assessment.id);
                              const unifiedLevels = getUnifiedStepLevels(assessment.id);
                              const proficiency = StepLevelCalculator.getOverallProficiencyLevel(unifiedLevels);
                              const badgeClass = StepLevelCalculator.getLevelBadgeClass(proficiency.level);
                              const shortLevel = StepLevelCalculator.getLevelShortCode(proficiency.level);
                              
                              return (
                                <Badge variant="outline" className={badgeClass}>
                                  {shortLevel} - {proficiencyLevel}
                                </Badge>
                              );
                            })()}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-600">Steps:</span>
                            <div className="flex space-x-1">
                              {getStepBadges(assessment.id).map((badge, index) => (
                                <Badge key={index} variant="outline" className={`text-xs ${badge.colorClass}`}>
                                  {badge.stepNumber}: {badge.levelText}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex flex-col space-y-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAssessment(assessment.id)}
                          className="min-w-[100px]"
                        >
                          <Eye className="mr-1" size={14} />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPDF(assessment)}
                          className="min-w-[100px]"
                        >
                          <FileText className="mr-1" size={14} />
                          PDF Report
                        </Button>

                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
      
      <AppFooter />
    </div>
  );
}