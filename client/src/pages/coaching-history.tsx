import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, User, Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import { useLocation } from "wouter";
import type { Assessment, User as UserType } from "@shared/schema";

export default function CoachingHistory() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterCoachee, setFilterCoachee] = useState<string>("all");

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
    const matchesSearch = assessment.assesseeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assessment.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeam = filterTeam === "all" || 
                       users.find(user => user.fullName === assessment.assesseeName)?.team === filterTeam;
    
    const matchesCoachee = filterCoachee === "all" || assessment.assesseeName === filterCoachee;

    return matchesSearch && matchesTeam && matchesCoachee;
  });

  // Sort assessments by date (newest first)
  const sortedAssessments = [...filteredAssessments].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const formatDateTime = (dateString: string) => {
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

  const handleViewAssessment = (assessmentId: number) => {
    setLocation(`/assessment-results/${assessmentId}`);
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
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Search by coachee name or session title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Select value={filterTeam} onValueChange={setFilterTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by team" />
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
              </div>
              
              <div>
                <Select value={filterCoachee} onValueChange={setFilterCoachee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by coachee" />
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
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {sortedAssessments.length} of {assessments.length} coaching sessions
          </p>
        </div>

        {/* Assessment List */}
        <div className="space-y-4">
          {sortedAssessments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No coaching sessions found</h3>
              <p className="text-gray-600">
                {searchTerm || filterTeam !== "all" || filterCoachee !== "all"
                  ? "Try adjusting your search or filters"
                  : "Start your first coaching session to see it here"}
              </p>
            </div>
          ) : (
            sortedAssessments.map((assessment) => {
              const { date, time } = formatDateTime(assessment.createdAt);
              const user = users.find(u => u.fullName === assessment.assesseeName);
              
              return (
                <div
                  key={assessment.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        Coaching session for {assessment.assesseeName}
                      </h3>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <div className="flex items-center space-x-1">
                          <Calendar size={14} />
                          <span>{date}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>{time}</span>
                        </div>
                        {user?.team && (
                          <div className="flex items-center space-x-1">
                            <Users size={14} />
                            <span>{user.team}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs">
                        {assessment.keyObservations && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Key Observations
                          </span>
                        )}
                        {assessment.whatWorkedWell && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            What Worked Well
                          </span>
                        )}
                        {assessment.whatCanBeImproved && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Areas for Improvement
                          </span>
                        )}
                        {assessment.nextSteps && (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            Next Steps
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewAssessment(assessment.id)}
                      className="ml-4"
                    >
                      <Eye size={16} className="mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      <AppFooter />
    </div>
  );
}