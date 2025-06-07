import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Edit, Edit2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import TeamInput from "@/components/team-input";
import TeamBulkManager from "@/components/team-bulk-manager";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get current user from localStorage
  const currentUser = JSON.parse(localStorage.getItem("current_user") || "{}");
  
  // Form states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserTeam, setNewUserTeam] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({ fullName: "", email: "", team: "" });
  const [showBulkTeamManager, setShowBulkTeamManager] = useState(false);
  const [bulkEditTeam, setBulkEditTeam] = useState<string | undefined>(undefined);

  // Fetch all users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch teams
  const { data: teams = [] } = useQuery<string[]>({
    queryKey: ["/api/teams"],
  });

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("PUT", "/api/auth/change-password", passwordData);
      if (!response.ok) throw new Error("Failed to change password");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Password change failed",
        description: error.message || "Unable to change password",
        variant: "destructive",
      });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { fullName: string; email: string; team?: string }) => {
      const response = await apiRequest("POST", "/api/users", userData);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          throw new Error("Email address is already registered in the system");
        }
        throw new Error(errorData.message || errorData.error || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "New user has been added successfully.",
      });
      setNewUserName("");
      setNewUserEmail("");
      setNewUserTeam("");
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      let errorMessage = "Unable to create user";
      if (error.message?.includes("Email address is already registered")) {
        errorMessage = "This email address is already registered in the system";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "User creation failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      if (!response.ok) throw new Error("Failed to delete user");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "User has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "User deletion failed",
        description: error.message || "Unable to delete user",
        variant: "destructive",
      });
    },
  });

  // Team management mutations
  const createTeamMutation = useMutation({
    mutationFn: async (teamName: string) => {
      const response = await apiRequest("POST", "/api/teams", { name: teamName });
      if (!response.ok) throw new Error("Failed to create team");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team created",
        description: "Team has been created successfully.",
      });
      setNewTeamName("");
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Team creation failed",
        description: error.message || "Unable to create team",
        variant: "destructive",
      });
    },
  });

  const renameTeamMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const response = await apiRequest("PUT", `/api/teams/${encodeURIComponent(oldName)}`, { newName });
      if (!response.ok) throw new Error("Failed to rename team");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team renamed",
        description: "Team has been renamed successfully.",
      });
      setEditingTeam(null);
      setEditTeamName("");
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Team rename failed",
        description: error.message || "Unable to rename team",
        variant: "destructive",
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamName: string) => {
      const response = await apiRequest("DELETE", `/api/teams/${encodeURIComponent(teamName)}`);
      if (!response.ok) throw new Error("Failed to delete team");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team deleted",
        description: "Team has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Team deletion failed",
        description: error.message || "Unable to delete team",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: number; userData: any }) => {
      console.log(`\n🚀 FRONTEND: Starting user update for ${userId}`);
      console.log(`📝 Data to update:`, userData);
      const totalStartTime = Date.now();
      
      // Track network request timing
      console.log(`🌐 Making API request...`);
      const networkStartTime = Date.now();
      const response = await apiRequest("PUT", `/api/users/${userId}`, userData);
      console.log(`🌐 Network request completed in ${Date.now() - networkStartTime}ms`);
      
      if (!response.ok) throw new Error("Failed to update user");
      
      console.log(`📊 Parsing response...`);
      const parseStartTime = Date.now();
      const result = await response.json();
      console.log(`📊 Response parsed in ${Date.now() - parseStartTime}ms`);
      
      console.log(`✅ Total frontend operation: ${Date.now() - totalStartTime}ms\n`);
      return result;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "User updated",
        description: "User has been updated successfully.",
      });
      setEditingUser(null);
      setEditUserForm({ fullName: "", email: "", team: "" });
      
      // Optimistic update - update cache immediately without waiting for invalidation
      queryClient.setQueryData(["/api/users"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((user: any) => 
          user.id === variables.userId ? { ...user, ...variables.userData } : user
        );
      });
      
      // Only invalidate teams if team changed
      if (variables.userData.team !== undefined) {
        queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "User update failed",
        description: error.message || "Unable to update user",
        variant: "destructive",
      });
    },
  });

  const handleBack = () => {
    window.history.back();
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_user");
    setLocation("/login");
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation don't match",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: "", // Would need current password in real implementation
      newPassword,
    });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate({
      fullName: newUserName,
      email: newUserEmail,
      team: newUserTeam || undefined,
    });
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      fullName: user.fullName,
      email: user.email,
      team: user.team || ""
    });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        userData: {
          fullName: editUserForm.fullName,
          email: editUserForm.email,
          team: editUserForm.team || null
        }
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditUserForm({ fullName: "", email: "", team: "" });
  };

  const handleDeleteTeam = async (teamName: string) => {
    if (!confirm(`Are you sure you want to delete team "${teamName}"? This will remove all users from this team.`)) {
      return;
    }

    try {
      // Get team ID by name
      const response = await apiRequest("GET", "/api/teams/all");
      const allTeams = await response.json();
      const team = allTeams.find((t: any) => t.name === teamName);
      
      if (!team) {
        toast({
          title: "Error",
          description: "Team not found",
          variant: "destructive",
        });
        return;
      }

      deleteTeamMutation.mutate(team.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive",
      });
    }
  };

  // Group users by team
  const usersByTeam = users.reduce((acc, user) => {
    const team = user.team || "No Team";
    if (!acc[team]) acc[team] = [];
    acc[team].push(user);
    return acc;
  }, {} as Record<string, User[]>);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <AppHeader 
        title="Profile Management" 
        showBack={true} 
        onBack={handleBack}
      />
      
      <div className="max-w-4xl mx-auto px-4 pt-20">
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account">My Account</TabsTrigger>
            <TabsTrigger value="users">Manage my Coachees</TabsTrigger>
            <TabsTrigger value="teams">Manage Teams</TabsTrigger>
          </TabsList>

          {/* My Account Tab */}
          <TabsContent value="account">
            <div className="space-y-6">
              {/* Account Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={currentUser.fullName || ""} disabled />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={currentUser.email || ""} disabled />
                  </div>
                  <div>
                    <Label>Team</Label>
                    <Input value={currentUser.team || "No Team"} disabled />
                  </div>
                </CardContent>
              </Card>

              {/* Change Password */}
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={changePasswordMutation.isPending}
                    >
                      {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Logout */}
              <Card>
                <CardContent className="pt-6">
                  <Button
                    onClick={handleLogout}
                    variant="destructive"
                    className="w-full"
                  >
                    <LogOut className="mr-2" size={16} />
                    Logout
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Manage Users Tab */}
          <TabsContent value="users">
            <div className="space-y-6">
              {/* Add New User */}
              <Card>
                <CardHeader>
                  <CardTitle>Add New Coachee</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <Label htmlFor="user-name">Full Name</Label>
                      <Input
                        id="user-name"
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="user-email">Email</Label>
                      <Input
                        id="user-email"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="user-team">Team (optional)</Label>
                      <Input
                        id="user-team"
                        type="text"
                        value={newUserTeam}
                        onChange={(e) => setNewUserTeam(e.target.value)}
                        list="existing-teams"
                        placeholder="Enter team name"
                      />
                      <datalist id="existing-teams">
                        {teams.map((team) => (
                          <option key={team} value={team} />
                        ))}
                      </datalist>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={createUserMutation.isPending}
                      className="w-full"
                    >
                      <Plus className="mr-2" size={16} />
                      {createUserMutation.isPending ? "Creating..." : "Add Coachee"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Users List */}
              <Card>
                <CardHeader>
                  <CardTitle>All Users ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        {editingUser?.id === user.id ? (
                          // Edit form
                          <form onSubmit={handleUpdateUser} className="flex-1 space-y-2">
                            <Input
                              value={editUserForm.fullName}
                              onChange={(e) => setEditUserForm({...editUserForm, fullName: e.target.value})}
                              placeholder="Full name"
                              required
                            />
                            <Input
                              value={editUserForm.email}
                              onChange={(e) => setEditUserForm({...editUserForm, email: e.target.value})}
                              placeholder="Email"
                              type="email"
                              required
                            />
                            <TeamInput
                              value={editUserForm.team}
                              onChange={(team) => setEditUserForm({...editUserForm, team})}
                              placeholder="Team (optional)"
                            />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={updateUserMutation.isPending}>
                                Save
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          // Display mode
                          <>
                            <div>
                              <div className="font-medium">{user.fullName}</div>
                              <div className="text-sm text-gray-600">{user.email}</div>
                              {user.team && (
                                <div className="text-xs text-blue-600">{user.team}</div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                                disabled={user.id === currentUser?.id}
                              >
                                <Edit size={14} />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={user.id === currentUser?.id}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Manage Teams Tab */}
          <TabsContent value="teams">
            {showBulkTeamManager ? (
              <TeamBulkManager
                users={users}
                teams={teams}
                onComplete={() => {
                  setShowBulkTeamManager(false);
                  setBulkEditTeam(undefined);
                  queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
                }}
                onCancel={() => {
                  setShowBulkTeamManager(false);
                  setBulkEditTeam(undefined);
                }}
                editingTeam={bulkEditTeam}
              />
            ) : (
              <div className="space-y-6">
                {/* Create New Team */}
                <Card>
                  <CardHeader>
                    <CardTitle>Create New Team</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => {
                        setShowBulkTeamManager(true);
                        setBulkEditTeam(undefined);
                      }}
                      className="w-full"
                    >
                      <Plus size={16} className="mr-2" />
                      Create Team with Member Assignment
                    </Button>
                  </CardContent>
                </Card>

                {/* Teams List */}
                <div className="space-y-4">
                  {teams.map((teamName) => {
                    const teamUsers = users.filter((user: any) => 
                      user.teams && user.teams.some((team: any) => team.name === teamName)
                    );
                    return (
                      <Card key={teamName}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span>{teamName} ({teamUsers.length} members)</span>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowBulkTeamManager(true);
                                  setBulkEditTeam(teamName);
                                }}
                              >
                                <Edit2 size={14} className="mr-1" />
                                Edit Team
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteTeam(teamName)}
                              >
                                <Trash2 size={14} className="mr-1" />
                                Delete
                              </Button>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {teamUsers.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                              >
                                <div>
                                  <div className="font-medium">{user.fullName}</div>
                                  <div className="text-gray-600">{user.email}</div>
                                </div>
                              </div>
                            ))}
                            {teamUsers.length === 0 && (
                              <div className="text-sm text-gray-500 italic">No members assigned</div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      <AppFooter />
    </div>
  );
}