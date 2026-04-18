import { Loader2 } from "lucide-react";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { CRMReport } from "@/components/dashboard/CRMReport";
import {
  useActivities,
  useUsers,
  useAccounts,
  useQualityReports,
} from "@/hooks/useQualityData";
import chrysalLogo from "@/assets/chrysal-logo.png";

export default function CRM() {
  const { data: activities, isLoading: la } = useActivities();
  const { data: users, isLoading: lu } = useUsers();
  const { data: accounts, isLoading: lac } = useAccounts();
  const { data: reports, isLoading: lr } = useQualityReports();

  const loading = la || lu || lac || lr;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-card border border-border rounded-md p-1.5 flex items-center justify-center">
                <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  CRM Activities
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Activity board, analysis, and weekly planner
                </p>
              </div>
            </div>
            <PageHeaderActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <CRMReport
            inline
            activities={activities || []}
            users={users || []}
            accounts={accounts || []}
            reports={reports || []}
          />
        )}
      </main>
    </div>
  );
}
