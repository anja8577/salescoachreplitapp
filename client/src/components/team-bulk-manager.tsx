import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Users, Plus, Edit, Trash2 } from "lucide-react";
import type { User } from "@shared/schema";

interface TeamBulkManagerProps {
  onClose: () => void;
  editingTeam?: string;
}

export default function TeamBulkManager({ onClose, editingTeam }: TeamBulkManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState(editingTeam || "");
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: true,
  });

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

  const handleSave = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a team name.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Prepare bulk update data
      const updates = users.map((user: User) => ({
        userId: user.id,
        team: selectedUsers.has(user.id) ? teamName : (user.team === editingTeam ? null : user.team)
      }));

      const response = await apiRequest("POST", "/api/teams/bulk-update", {
        teamName,
        updates,
        isEdit: !!editingTeam,
        originalTeamName: editingTeam
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: editingTeam ? "Team updated" : "Team created",
          description: `Successfully ${editingTeam ? 'updated' : 'created'} team "${teamName}" with ${result.affectedUsers} users.`,
        });
        
        // Invalidate caches
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
        
        onClose();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error: any) {
      toast({
        title: "Operation failed",
        description: error.message || "Failed to save team.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (usersLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading users...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {editingTeam ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          {editingTeam ? `Edit Team: ${editingTeam}` : "Create New Team"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!editingTeam && (
          <div>
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name..."
              className="mt-1"
            />
          </div>
        )}

        <div>
          <Label className="text-base font-medium flex items-center gap-2 mb-4">
            <Users className="h-4 w-4" />
            Select Team Members ({selectedUsers.size} selected)
          </Label>
          
          <div className="border rounded-lg max-h-96 overflow-y-auto">
            {users.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No users available
              </div>
            ) : (
              <div className="divide-y">
                {users.map((user: User) => (
                  <div key={user.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50">
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={(checked) => handleUserToggle(user.id, checked === true)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`user-${user.id}`} className="font-medium cursor-pointer">
                        {user.fullName}
                      </Label>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      {user.team && user.team !== editingTeam && (
                        <div className="text-xs text-blue-600">Current team: {user.team}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                {editingTeam ? "Update Team" : "Create Team"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}