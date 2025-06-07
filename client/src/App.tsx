import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import Login from "@/pages/login";
import Landing from "@/pages/landing";
import Assessment from "@/pages/assessment";
import CoachingHistory from "@/pages/coaching-history";
import Profile from "@/pages/profile";
import ResetPassword from "@/pages/reset-password";

function Router() {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on app load
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const user = localStorage.getItem("current_user");
    
    if (token && user) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      // Redirect to login if not authenticated and not already on public pages
      if (location !== "/login" && location !== "/reset-password") {
        setLocation("/login");
      }
    }
    setIsLoading(false);
  }, [location, setLocation]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show login screen if not authenticated (except for public pages)
  if (!isAuthenticated && location !== "/reset-password") {
    return <Login />;
  }

  // Handle reset password page (public access)
  if (location === "/reset-password") {
    return <ResetPassword />;
  }

  // Show authenticated routes
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/assessment" component={Assessment} />
      <Route path="/coaching-history" component={CoachingHistory} />
      <Route path="/profile" component={Profile} />
      <Route>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
            <p className="text-gray-600">The page you're looking for doesn't exist.</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
