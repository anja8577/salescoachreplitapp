import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Plus, ArrowLeft, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Assessment } from "@shared/schema";

export default function Profile() {
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ fullName: "", email: "", team: "" });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch all assessments
  const { data: assessments = [], isLoading: assessmentsLoading } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { fullName: string; email: string; team?: string }) => {
      const res = await apiRequest("POST", "/api/users", userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setNewUser({ fullName: "", email: "", team: "" });
      toast({
        title: "User Created",
        description: "New user has been created successfully.",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: User) => {
      const res = await apiRequest("PUT", `/api/users/${userData.id}`, userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({
        title: "User Updated",
        description: "User information has been updated successfully.",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully.",
      });
    },
  });

  const handleCreateUser = () => {
    if (!newUser.fullName || !newUser.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in name and email fields.",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleUpdateUser = () => {
    if (editingUser) {
      updateUserMutation.mutate(editingUser);
    }
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const calculateOverallScore = (assessment: Assessment) => {
    // This would need to be calculated from assessment scores
    // For now, return a placeholder that will be replaced with real data
    return Math.floor(Math.random() * 4) + 1; // 1-4 levels
  };

  const calculateStepScores = (assessment: Assessment) => {
    // This would need to be calculated from assessment scores  
    // For now, return placeholder scores that will be replaced with real data
    return [
      Math.floor(Math.random() * 4) + 1,
      Math.floor(Math.random() * 4) + 1,
      Math.floor(Math.random() * 4) + 1,
      Math.floor(Math.random() * 4) + 1,
      Math.floor(Math.random() * 4) + 1,
      Math.floor(Math.random() * 4) + 1,
      Math.floor(Math.random() * 4) + 1,
    ];
  };

  const downloadAssessment = async (assessmentId: number, userFullName: string, title: string) => {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/export`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${userFullName}_${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Error",
        description: "Failed to download assessment.",
        variant: "destructive",
      });
    }
  };

  // Filter assessments by selected user
  const filteredAssessments = selectedUserId 
    ? assessments.filter(assessment => assessment.userId.toString() === selectedUserId)
    : [];

  // Filter users by team
  const filteredUsers = teamFilter 
    ? users.filter(user => user.team === teamFilter)
    : users;

  // Get unique teams for filter dropdown
  const teamSet = new Set<string>();
  users.forEach(user => {
    if (user.team) teamSet.add(user.team);
  });
  const uniqueTeams = Array.from(teamSet);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/'}
              >
                <ArrowLeft className="mr-2" size={16} />
                Back to Assessment
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">User Profile Management</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">Manage Users</TabsTrigger>
            <TabsTrigger value="results">Assessment Results</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {/* Add New User */}
            <Card>
              <CardHeader>
                <CardTitle>Add New User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="newFullName">Full Name</Label>
                    <Input
                      id="newFullName"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newEmail">Email</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newTeam">Team (Optional)</Label>
                    <Input
                      id="newTeam"
                      value={newUser.team}
                      onChange={(e) => setNewUser({ ...newUser, team: e.target.value })}
                      placeholder="Enter team name"
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                  className="mt-4"
                >
                  <Plus className="mr-2" size={16} />
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </CardContent>
            </Card>

            {/* Existing Users */}
            <Card>
              <CardHeader>
                <CardTitle>Existing Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Label htmlFor="teamFilter">Filter by Team</Label>
                  <Select value={teamFilter || ""} onValueChange={(value) => setTeamFilter(value || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All teams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All teams</SelectItem>
                      {uniqueTeams.map((team) => (
                        <SelectItem key={team} value={team}>
                          {team}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {usersLoading ? (
                  <div className="text-center py-8">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No users found</div>
                ) : (
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        {editingUser?.id === user.id ? (
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 mr-4">
                            <Input
                              value={editingUser.fullName}
                              onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                              placeholder="Full name"
                            />
                            <Input
                              value={editingUser.email}
                              onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                              placeholder="Email"
                            />
                            <Input
                              value={editingUser.team || ""}
                              onChange={(e) => setEditingUser({ ...editingUser, team: e.target.value })}
                              placeholder="Team"
                            />
                          </div>
                        ) : (
                          <div className="flex-1">
                            <h3 className="font-medium">{user.fullName}</h3>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            {user.team && <p className="text-sm text-gray-500">Team: {user.team}</p>}
                          </div>
                        )}
                        
                        <div className="flex space-x-2">
                          {editingUser?.id === user.id ? (
                            <>
                              <Button size="sm" onClick={handleUpdateUser}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setEditingUser(user)}>
                                <Edit size={16} />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Results for User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <Label htmlFor="userSelect">Select User</Label>
                  <Select value={selectedUserId || ""} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user to view their assessments" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.fullName} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!selectedUserId ? (
                  <div className="text-center py-8 text-gray-500">
                    Please select a user to view their assessment results
                  </div>
                ) : assessmentsLoading ? (
                  <div className="text-center py-8">Loading assessment results...</div>
                ) : filteredAssessments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No assessment results found for this user
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAssessments.map((assessment) => {
                      const user = users.find(u => u.id === assessment.userId);
                      const overallScore = calculateOverallScore(assessment);
                      const stepScores = calculateStepScores(assessment);
                      const stepNames = [
                        "Preparation", "Opening", "Need Dialogue", 
                        "Solution Dialog", "Objection Resolution", "Asking for Commitment", "Follow up"
                      ];
                      
                      return (
                        <div key={assessment.id} className="border rounded-lg p-6 bg-white shadow-sm">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-semibold">{assessment.title}</h3>
                              <div className="flex gap-4 text-sm text-gray-600 mt-2">
                                <span>From: {new Date(assessment.createdAt || '').toLocaleDateString()}</span>
                                <span>{new Date(assessment.createdAt || '').toLocaleTimeString()}</span>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => downloadAssessment(assessment.id, user?.fullName || 'Unknown', assessment.title)}
                            >
                              <Download size={16} className="mr-2" />
                              Download Report
                            </Button>
                          </div>
                          
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">Overall Score:</span>
                              <div className="flex items-center gap-1">
                                <span className="text-lg font-bold text-blue-600">Level {overallScore}</span>
                                <span className="text-gray-500">/ 4</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {stepScores.map((score, index) => (
                              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium">{stepNames[index]}</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-blue-600">L{score}</span>
                                  <span className="text-gray-500 text-sm">/4</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}