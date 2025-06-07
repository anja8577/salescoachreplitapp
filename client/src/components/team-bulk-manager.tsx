import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Users, X } from "lucide-react";
import type { User } from "@shared/schema";

interface TeamBulkManagerProps {
  users: User[];
  teams: string[];
  onComplete: () => void;
  onCancel: () => void;
  editingTeam?: string;
}

export default function TeamBulkManager({ 
  users, 
  teams, 
  onComplete, 
  onCancel, 
  editingTeam 
}: TeamBulkManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState(editingTeam || "");
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Initialize selected users for editing mode
  useEffect(() => {
    if (editingTeam && users.length > 0) {
      const teamMembers = users
        .filter((user: User) => user.team === editingTeam)
        .map((user: User) => user.id);
      setSelectedUsers(new Set(teamMembers));
    }
  }, [editingTeam, users]);

  const handleUserToggle = (userId: number, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: {
      teamName: string;
      updates: Array<{ userId: number; team: string | null; currentTeam: string | null }>;
      isEdit: boolean;
      originalTeamName?: string;
    }) => {
      return await apiRequest("POST", "/api/teams/bulk-update", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Team ${editingTeam ? 'updated' : 'created'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update team",
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Error",
        description: "Team name is required",
        variant: "destructive",
      });
      return;
    }

    if (!editingTeam && teams.includes(teamName.trim())) {
      toast({
        title: "Error",
        description: "Team name already exists",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create updates array only for users whose team assignment is changing
      const updates = users
        .filter(user => {
          const isSelected = selectedUsers.has(user.id);
          const newTeam = isSelected ? teamName.trim() : user.team;
          return newTeam !== user.team;
        })
        .map(user => ({
          userId: user.id,
          team: selectedUsers.has(user.id) ? teamName.trim() : user.team,
          currentTeam: user.team,
        }));

      await bulkUpdateMutation.mutateAsync({
        teamName: teamName.trim(),
        updates,
        isEdit: !!editingTeam,
        originalTeamName: editingTeam,
      });
    } catch (error) {
      console.error("Bulk update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users size={20} />
              {editingTeam ? `Edit Team: ${editingTeam}` : "Create New Team"}
            </span>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X size={16} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Select Team Members</Label>
            <div className="mt-2 space-y-2 max-h-96 overflow-y-auto border rounded-md p-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded"
                >
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={selectedUsers.has(user.id)}
                    onCheckedChange={(checked) => handleUserToggle(user.id, !!checked)}
                    disabled={isLoading}
                  />
                  <Label 
                    htmlFor={`user-${user.id}`} 
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium">{user.fullName}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                    {user.team && (
                      <div className="text-xs text-blue-600">Current: {user.team}</div>
                    )}
                  </Label>
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {selectedUsers.size} of {users.length} users selected
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSave}
              disabled={isLoading || !teamName.trim()}
              className="flex-1"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTeam ? "Update Team" : "Create Team"}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}