import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionKey } from "@/lib/permissions";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Profile from "./pages/Profile.tsx";
import Admin from "./pages/Admin.tsx";
import Planner from "./pages/Planner.tsx";
import DataLoggers from "./pages/DataLoggers.tsx";
import TrialsDashboard from "./pages/TrialsDashboard.tsx";
import AllReports from "./pages/AllReports.tsx";
import ActiveSF from "./pages/ActiveSF.tsx";
import Containers from "./pages/Containers.tsx";
import Subscriptions from "./pages/Subscriptions.tsx";
import CRM from "./pages/CRM.tsx";
import Customers from "./pages/Customers.tsx";
import NotFound from "./pages/NotFound.tsx";
import SharedPage from "./pages/SharedPage.tsx";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PermissionRoute({ permission, children }: { permission: PermissionKey; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { can, loaded } = usePermissions();
  if (loading || !loaded) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!can(permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/share/:token" element={<SharedPage />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/planner" element={<PermissionRoute permission="trial_planner"><Planner /></PermissionRoute>} />
            <Route path="/data-loggers" element={<PermissionRoute permission="data_loggers"><DataLoggers /></PermissionRoute>} />
            <Route path="/trials" element={<PermissionRoute permission="trials_dashboard"><TrialsDashboard /></PermissionRoute>} />
            <Route path="/report" element={<PermissionRoute permission="all_reports"><AllReports /></PermissionRoute>} />
            <Route path="/active-sf" element={<PermissionRoute permission="active_sf"><ActiveSF /></PermissionRoute>} />
            <Route path="/containers" element={<PermissionRoute permission="containers"><Containers /></PermissionRoute>} />
            <Route path="/crm" element={<PermissionRoute permission="crm_activities"><CRM /></PermissionRoute>} />
            <Route path="/customers" element={<PermissionRoute permission="customers_map"><Customers /></PermissionRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
