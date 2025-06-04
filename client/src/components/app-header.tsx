import { ArrowLeft, Home } from "lucide-react";
import { useLocation } from "wouter";
import SalesCoachHeader from "./sales-coach-header";

interface AppHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
}

export default function AppHeader({ showBack = false, onBack, title }: AppHeaderProps) {
  const [, setLocation] = useLocation();

  const handleHomeClick = () => {
    setLocation("/");
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo and SalesCoach */}
          <div className="flex items-center">
            <button onClick={handleHomeClick} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <SalesCoachHeader showLogo={true} size="sm" />
            </button>
          </div>

          {/* Right side - Title */}
          <div className="flex items-center">
            {title && (
              <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}