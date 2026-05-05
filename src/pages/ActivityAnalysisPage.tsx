import { useMemo, useState, useEffect } from "react";
import { Loader2, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { ActivityAnalysis } from "@/components/dashboard/crm/ActivityAnalysis";
import { useActivities, useUsers, useAccounts } from "@/hooks/useQualityData";
import { getCrmVisibleUserIds } from "@/lib/crmUserFilter";
import chrysalLogo from "@/assets/chrysal-logo.png";

export default function ActivityAnalysisPage() {
  const { data: activities, isLoading: la } = useActivities();
  const { data: users, isLoading: lu } = useUsers();
  const { data: accounts, isLoading: lac } = useAccounts();

  const [crmVisibleIds, setCrmVisibleIds] = useState<string[] | null>(null);
  useEffect(() => {
    getCrmVisibleUserIds().then(setCrmVisibleIds);
  }, []);

  const userMap = useMemo(() => new Map((users || []).map((u) => [u.id, u.name])), [users]);

  const crmActivities = useMemo(() => {
    if (!activities) return [];
    if (!crmVisibleIds) return activities;
    return activities.filter((a) => !a.assignedUserId || crmVisibleIds.includes(a.assignedUserId));
  }, [activities, crmVisibleIds]);

  const activeUsers = useMemo(() => {
    let ids: string[];
    if (crmVisibleIds && crmVisibleIds.length > 0) {
      ids = crmVisibleIds;
    } else {
      const set = new Set<string>();
      for (const a of crmActivities) if (a.assignedUserId) set.add(a.assignedUserId);
      ids = [...set];
    }
    return ids
      .map((id) => ({ id, name: userMap.get(id) || id.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [crmActivities, userMap, crmVisibleIds]);

  const loading = la || lu || lac;

  return (
    <div className="min-h-screen bg-background">
      <div className="chrysal-gradient h-1.5" />
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                aria-label="Go to dashboard"
                className="bg-card border border-border rounded-md p-1.5 flex items-center justify-center hover:bg-accent/10 transition-colors"
              >
                <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Activity Analysis
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  CRM activity statistics and per-user performance
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
          <ActivityAnalysis
            allActivities={crmActivities}
            users={users || []}
            accounts={accounts || []}
            activeUsers={activeUsers}
            selectedUserId="all"
            onBack={() => window.history.back()}
          />
        )}
      </main>
    </div>
  );
}
