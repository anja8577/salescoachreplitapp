import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, User, Users, Eye, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import { useLocation } from "wouter";
import { format } from "date-fns";
import type { Assessment, User as UserType } from "@shared/schema";

export default function CoachingHistory() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterCoachee, setFilterCoachee] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");

  // Fetch all assessments
  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });

  // Fetch all users for filtering
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

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

  const handleDownloadAssessment = (assessment: Assessment) => {
    const reportData = {
      assesseeName: assessment.assesseeName || 'Unknown',
      date: assessment.createdAt ? format(new Date(assessment.createdAt), 'PPP') : 'N/A',
      title: assessment.title || 'Assessment',
      keyObservations: assessment.keyObservations || 'None recorded',
      whatWorkedWell: assessment.whatWorkedWell || 'None recorded',
      whatCanBeImproved: assessment.whatCanBeImproved || 'None recorded',
      nextSteps: assessment.nextSteps || 'None recorded'
    };
    
    const reportText = `SalesCoach Assessment Report

Coachee: ${reportData.assesseeName}
Date: ${reportData.date}
Title: ${reportData.title}

Key Observations:
${reportData.keyObservations}

What Worked Well:
${reportData.whatWorkedWell}

What Can Be Improved:
${reportData.whatCanBeImproved}

Next Steps:
${reportData.nextSteps}`;
    
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-${assessment.assesseeName}-${assessment.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              L - Learner
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-600">Steps:</span>
                            <div className="flex space-x-1">
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">1: L</Badge>
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">2: Q</Badge>
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">3: E</Badge>
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">4: M</Badge>
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">5: L</Badge>
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">6: Q</Badge>
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">7: E</Badge>
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
                          className="min-w-[90px]"
                        >
                          <Eye className="mr-1" size={14} />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadAssessment(assessment)}
                          className="min-w-[90px]"
                        >
                          <Download className="mr-1" size={14} />
                          Download
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