import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, History } from "lucide-react";
import SalesCoachHeader from "@/components/sales-coach-header";
import AppFooter from "@/components/app-footer";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* No header as requested */}
      
      <div className="max-w-md mx-auto px-4 pt-12">
        {/* Logo and Title Box */}
        <Card className="mb-8">
          <CardContent className="pt-8 pb-8 text-center">
            <SalesCoachHeader showLogo={true} size="lg" className="justify-center mb-2" />
          </CardContent>
        </Card>

        {/* Side by side buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => setLocation("/assessment")}
            className="h-24 flex flex-col items-center justify-center space-y-2 bg-[#11339b] hover:bg-blue-700"
            size="lg"
          >
            <Calendar size={24} />
            <span className="text-sm font-medium">New Session</span>
          </Button>
          
          <Button
            onClick={() => setLocation("/coaching-history")}
            variant="outline"
            className="h-24 flex flex-col items-center justify-center space-y-2 border-[#11339b] text-[#11339b] hover:bg-[#11339b] hover:text-white"
            size="lg"
          >
            <History size={24} />
            <span className="text-sm font-medium">History</span>
          </Button>
        </div>
      </div>
      
      <AppFooter />
    </div>
  );
}