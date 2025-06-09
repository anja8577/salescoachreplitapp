import { Home, Plus, History, User } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import UserSelectionModal from "./user-selection-modal";

export default function AppFooter() {
  const [location, setLocation] = useLocation();
  const [showUserModal, setShowUserModal] = useState(false);
  const { toast } = useToast();

  // Auto-save before navigation
  const performAutoSaveBeforeNavigation = async () => {
    // Check if we're currently in a coaching session
    if (location.includes('/assessment') && (window as any).currentAssessmentAutoSave) {
      try {
        const autoSaveSuccess = await (window as any).currentAssessmentAutoSave();
        if (autoSaveSuccess) {
          toast({
            title: "Session Auto-Saved",
            description: "Your coaching session has been saved automatically.",
          });
        }
      } catch (error) {
        console.error('Auto-save failed during navigation:', error);
      }
    }
  };

  const handleNewSession = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await performAutoSaveBeforeNavigation();
    setShowUserModal(true);
  };

  const handleUserSelected = (userId: number) => {
    setShowUserModal(false);
    // Add timestamp to force a fresh navigation and prevent caching issues
    setLocation(`/assessment?userId=${userId}&t=${Date.now()}`);
  };

  const handleNavigation = async (path: string) => {
    await performAutoSaveBeforeNavigation();
    setLocation(path);
  };

  const isActive = (path: string) => location === path;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <button
            onClick={() => setLocation("/")}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              isActive("/") ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Home size={20} />
            <span className="text-xs mt-1">Home</span>
          </button>

          <button
            onClick={handleNewSession}
            className="flex flex-col items-center p-2 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Plus size={20} />
            <span className="text-xs mt-1">New Session</span>
          </button>

          <button
            onClick={() => setLocation("/coaching-history")}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              isActive("/coaching-history") ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <History size={20} />
            <span className="text-xs mt-1">History</span>
          </button>

          <button
            onClick={() => setLocation("/profile")}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              isActive("/profile") ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <User size={20} />
            <span className="text-xs mt-1">Profile</span>
          </button>
        </div>
      </div>

      <UserSelectionModal 
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        onUserSelected={handleUserSelected}
      />
    </>
  );
}