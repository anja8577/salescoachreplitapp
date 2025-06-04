import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, History } from "lucide-react";
import AppHeader from "@/components/app-header";
import UserSelectionModal from "@/components/user-selection-modal";
import { useLocation } from "wouter";

export default function Landing() {
  const [showUserModal, setShowUserModal] = useState(false);
  const [, setLocation] = useLocation();

  const handleStartNewSession = () => {
    setShowUserModal(true);
  };

  const handleViewHistory = () => {
    setLocation("/coaching-history");
  };

  const handleUserSelected = (userId: number) => {
    setShowUserModal(false);
    setLocation(`/assessment?userId=${userId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      
      <div className="flex items-center justify-center p-4 pt-20">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">SalesCoach</h1>
          <p className="text-gray-600 mb-8">Choose an option to continue</p>
          
          <div className="space-y-4">
            <Button 
              onClick={handleStartNewSession} 
              className="w-full h-12 text-lg"
              size="lg"
            >
              <Plus className="mr-2" size={20} />
              Start New Session
            </Button>
            
            <Button 
              onClick={handleViewHistory} 
              variant="outline"
              className="w-full h-12 text-lg"
              size="lg"
            >
              <History className="mr-2" size={20} />
              View History
            </Button>
          </div>
        </div>
      </div>
      
      <UserSelectionModal 
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        onUserSelected={handleUserSelected}
      />
    </div>
  );
}