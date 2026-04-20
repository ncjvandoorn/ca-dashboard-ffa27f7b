import { PageHeaderActions } from "@/components/PageHeaderActions";
import { ChangePasswordCard } from "@/components/admin/ChangePasswordCard";
import { PermissionsMatrixCard } from "@/components/admin/PermissionsMatrixCard";
import { AIInstructionsCard } from "@/components/admin/AIInstructionsCard";
import { AILearningsCard } from "@/components/admin/AILearningsCard";
import { CrmUserFilterCard } from "@/components/admin/CrmUserFilterCard";
import { DataFilesCard } from "@/components/admin/DataFilesCard";
import { CustomerAccountsCard } from "@/components/admin/CustomerAccountsCard";
import { InvitationsCard } from "@/components/admin/InvitationsCard";
import { PendingApprovalsCard } from "@/components/admin/PendingApprovalsCard";
import { LoginLogsCard } from "@/components/admin/LoginLogsCard";
import { QuestionLogsCard } from "@/components/admin/QuestionLogsCard";

const Admin = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="chrysal-gradient h-1.5" />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
          <PageHeaderActions />
        </div>

        <ChangePasswordCard />
        <PermissionsMatrixCard />
        <AIInstructionsCard />
        <AILearningsCard />
        <CrmUserFilterCard />
        <DataFilesCard />
        <PendingApprovalsCard />
        <InvitationsCard />
        <CustomerAccountsCard />
        <LoginLogsCard />
        <QuestionLogsCard />
      </div>
    </div>
  );
};

export default Admin;
