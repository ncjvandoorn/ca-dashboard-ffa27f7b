import { FlaskConical } from "lucide-react";
import { PageHeaderActions } from "@/components/PageHeaderActions";

export default function TrialsDashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          Trials Dashboard
        </h1>
        <PageHeaderActions />
      </header>

      <main className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <FlaskConical className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
        <p className="text-muted-foreground max-w-md">
          The Trials Dashboard is under construction. A new dashboard for trial insights and analytics will be available here soon.
        </p>
      </main>
    </div>
  );
}
