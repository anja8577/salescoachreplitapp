import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertUserSchema } from "@shared/schema";
import type { User } from "@shared/schema";
import { z } from "zod";
import TeamInput from "@/components/team-input";
import { useToast } from "@/hooks/use-toast";

interface UserSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onUserSelected: (userId: number) => void;
}

const createUserSchema = insertUserSchema.extend({
  email: z.string().email("Please enter a valid email address"),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function UserSelectionModal({ open, onClose, onUserSelected }: UserSelectionModalProps) {
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    enabled: open,
  });

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      team: "",
    },
  });

  const createUserMutation = useMutation<User, Error, CreateUserForm>({
    mutationFn: async (userData: CreateUserForm) => {
      const res = await apiRequest("POST", "/api/users", userData);
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 409) {
          throw new Error("Email address is already registered in the system");
        }
        throw new Error(errorData.message || errorData.error || "Failed to create user");
      }
      return await res.json();
    },
    onSuccess: (newUser: User) => {
      // Invalidate and refetch users query
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      // Wait a moment for the query to update before selecting the user
      setTimeout(() => {
        onUserSelected(newUser.id);
        onClose();
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "User Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExistingUserSubmit = () => {
    if (selectedUserId) {
      onUserSelected(parseInt(selectedUserId));
      onClose();
    }
  };

  const handleNewUserSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>Select Coachee</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
            <Button
              variant={mode === "select" ? "default" : "outline"}
              onClick={() => setMode("select")}
              className="flex-1"
            >
              Select Existing Coachee
            </Button>
            <Button
              variant={mode === "create" ? "default" : "outline"}
              onClick={() => setMode("create")}
              className="flex-1"
            >
              Add New Coachee
            </Button>
          </div>

          {mode === "select" ? (
            <div className="space-y-4">
              <div>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a coachee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user: User) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {currentUser && user.id === currentUser.id 
                          ? `Self-Assessment (${user.fullName})` 
                          : `${user.fullName} (${user.email})`
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleExistingUserSubmit} 
                disabled={!selectedUserId || isLoading}
                className="w-full"
              >
                Continue with Selected User
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleNewUserSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter email address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="team"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team</FormLabel>
                      <FormControl>
                        <TeamInput 
                          value={field.value || ""} 
                          onChange={field.onChange}
                          placeholder="Enter team (optional)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  disabled={createUserMutation.isPending}
                  className="w-full"
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User & Continue"}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}