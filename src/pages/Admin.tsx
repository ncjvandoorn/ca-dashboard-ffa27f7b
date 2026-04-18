import { useState, useEffect, useRef, useMemo } from "react";
import Papa from "papaparse";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, KeyRound, Check, BookOpen, MapPin, Globe, RefreshCw, MessageCircleQuestion, Upload, FileSpreadsheet, FileText, Bot, Users, Plus, Trash2, ClipboardList, ChevronsUpDown, Brain } from "lucide-react";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { useAccounts, useCustomerFarms, useUsers, useActivities } from "@/hooks/useQualityData";
import { getCrmVisibleUserIds, setCrmVisibleUserIds } from "@/lib/crmUserFilter";

interface LoginLog {
  id: string;
  username: string;
  email: string;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  logged_in_at: string;
}

interface QuestionLog {
  id: string;
  question: string;
  username: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  asked_at: string;
}

const DATA_FILES = [
  { key: "trials.xlsx", label: "Trials Data", accept: ".xlsx", icon: FileSpreadsheet },
  { key: "qualityReport.csv", label: "Quality Report", accept: ".csv", icon: FileText },
  { key: "account.csv", label: "ALL Accounts", accept: ".csv", icon: FileText },
  { key: "activity.csv", label: "Activity Data", accept: ".csv", icon: FileText },
  { key: "user.csv", label: "ALL Users", accept: ".csv", icon: FileText },
  { key: "customerFarm.csv", label: "Customer-Farm Links", accept: ".csv", icon: FileText },
  { key: "container.csv", label: "Containers", accept: ".csv", icon: FileText },
  { key: "servicesOrder.csv", label: "Services Orders", accept: ".csv", icon: FileText },
  { key: "servicesOrderDatalogdevice.csv", label: "Order ↔ Datalogger Links", accept: ".csv", icon: FileText },
  { key: "shipperArrival.csv", label: "Shipper Arrivals", accept: ".csv", icon: FileText },
  { key: "shipperReport.csv", label: "Shipper Reports", accept: ".csv", icon: FileText },
  { key: "shippingLine.csv", label: "Shipping Lines", accept: ".csv", icon: FileText },
] as const;

const ALLOWED_FILENAMES = new Set(DATA_FILES.map((f) => f.key));

const Admin = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionLog[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiInstructionsLoading, setAiInstructionsLoading] = useState(true);
  const [aiInstructionsSaving, setAiInstructionsSaving] = useState(false);
  const [aiLearnings, setAiLearnings] = useState("");
  const [aiLearningsLoading, setAiLearningsLoading] = useState(true);
  const [aiLearningsSaving, setAiLearningsSaving] = useState(false);
  const [aiLearningsGenerating, setAiLearningsGenerating] = useState(false);
  const [customerAccounts, setCustomerAccounts] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [newCustUsername, setNewCustUsername] = useState("");
  const [newCustPassword, setNewCustPassword] = useState("CA@2026");
  const [newCustAccountId, setNewCustAccountId] = useState("");
  const [newCustTrials, setNewCustTrials] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [crmSelectedUserIds, setCrmSelectedUserIds] = useState<Set<string>>(new Set());
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allAccounts } = useAccounts();
  const { data: allUsers } = useUsers();
  const { data: allActivities } = useActivities();
  const { data: customerFarms } = useCustomerFarms();

  // Map filenames to react-query cache keys so we can invalidate after upload
  const fileQueryKeyMap: Record<string, string> = {
    "qualityReport.csv": "qualityReports",
    "account.csv": "accounts",
    "activity.csv": "activities",
    "user.csv": "users",
    "customerFarm.csv": "customerFarms",
    "container.csv": "containers",
    "servicesOrder.csv": "servicesOrders",
    "servicesOrderDatalogdevice.csv": "servicesOrderDatalogdevices",
    "shipperArrival.csv": "shipperArrivals",
    "shipperReport.csv": "shipperReports",
    "shippingLine.csv": "shippingLines",
  };

  // Map CSV filenames to the columns that contain Unix-ms timestamps
  const timestampColumns: Record<string, string[]> = {
    "activity.csv": ["startsAt", "completedAt", "createdAt"],
    "qualityReport.csv": ["createdAt", "submittedAt"],
    "customerFarm.csv": ["createdAt", "deletedAt"],
    "container.csv": ["dropoffDate", "shippingDate"],
    "servicesOrder.csv": ["dippingDate", "openedAt", "closedAt", "approvedCsAt", "approvedMtAt", "cancelledAt", "createdAt", "updatedAt", "deletedAt"],
    "shipperArrival.csv": ["arrivalDate", "createdAt", "updatedAt", "deletedAt"],
    "shipperReport.csv": ["stuffingDate", "approvedMtAt", "createdAt", "updatedAt", "deletedAt", "closedAt"],
  };

  /** Convert Unix-ms timestamp columns in a CSV file to ISO date strings before uploading */
  const convertTimestampsInCsv = async (filename: string, file: File): Promise<File> => {
    const cols = timestampColumns[filename];
    if (!cols) return file; // no timestamp columns to convert (e.g. account.csv, user.csv)

    const text = await file.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h: string) => h.trim(),
    });

    const rows = parsed.data as Record<string, string>[];
    for (const row of rows) {
      for (const col of cols) {
        const val = row[col];
        if (!val || val.trim() === "") continue;
        // Only convert if value looks like a Unix timestamp (all digits, > year 2000 in ms)
        const num = Number(val);
        if (!isNaN(num) && num > 946684800000) {
          row[col] = new Date(num).toISOString();
        }
      }
    }

    const csv = Papa.unparse(rows);
    return new File([csv], filename, { type: "text/csv" });
  };

  const handleFileUpload = async (filename: string, file: File) => {
    setUploading(filename);
    try {
      // Convert Unix timestamps to ISO dates for CSV files before storing
      const processedFile = filename.endsWith(".csv")
        ? await convertTimestampsInCsv(filename, file)
        : file;

      const { error } = await supabase.storage
        .from("data-files")
        .upload(filename, processedFile, { upsert: true, cacheControl: "0" });
      if (error) throw error;
      // Invalidate the relevant react-query cache so the dashboard refreshes automatically
      const queryKey = fileQueryKeyMap[filename];
      if (queryKey) {
        await queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
      toast({ title: "Uploaded", description: `${filename} updated successfully. Timestamps converted to readable dates.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  /** Upload many files in one go, auto-routing each by filename to the correct slot. */
  const handleBulkUpload = async (files: File[]) => {
    const recognized: File[] = [];
    const unknown: string[] = [];
    for (const f of files) {
      if (ALLOWED_FILENAMES.has(f.name as any)) recognized.push(f);
      else unknown.push(f.name);
    }
    if (unknown.length > 0) {
      toast({
        title: `${unknown.length} file(s) skipped`,
        description: `Unrecognized: ${unknown.join(", ")}. Filename must match exactly (e.g. container.csv).`,
        variant: "destructive",
      });
    }
    if (recognized.length === 0) return;
    setBulkUploading(true);
    let success = 0;
    const failed: string[] = [];
    for (const file of recognized) {
      try {
        const processed = file.name.endsWith(".csv")
          ? await convertTimestampsInCsv(file.name, file)
          : file;
        const { error } = await supabase.storage
          .from("data-files")
          .upload(file.name, processed, { upsert: true, cacheControl: "0" });
        if (error) throw error;
        const queryKey = fileQueryKeyMap[file.name];
        if (queryKey) await queryClient.invalidateQueries({ queryKey: [queryKey] });
        success++;
      } catch (err: any) {
        failed.push(`${file.name} (${err.message})`);
      }
    }
    setBulkUploading(false);
    if (success > 0) {
      toast({ title: `${success} file(s) uploaded`, description: failed.length ? `Failed: ${failed.join(", ")}` : "All recognized files updated." });
    } else if (failed.length > 0) {
      toast({ title: "All uploads failed", description: failed.join(", "), variant: "destructive" });
    }
  };

  const fetchAiInstructions = async () => {
    setAiInstructionsLoading(true);
    const { data } = await supabase
      .from("ai_instructions" as any)
      .select("instructions")
      .limit(1)
      .maybeSingle();
    setAiInstructions((data as any)?.instructions || "");
    setAiInstructionsLoading(false);
  };

  const saveAiInstructions = async () => {
    setAiInstructionsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("ai_instructions" as any)
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ai_instructions" as any)
          .update({ instructions: aiInstructions, updated_at: new Date().toISOString() } as any)
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("ai_instructions" as any)
          .insert({ instructions: aiInstructions } as any);
      }
      toast({ title: "Saved", description: "AI instructions updated successfully." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setAiInstructionsSaving(false);
    }
  };

  const fetchAiLearnings = async () => {
    setAiLearningsLoading(true);
    const { data } = await supabase
      .from("ai_learnings" as any)
      .select("learnings")
      .limit(1)
      .maybeSingle();
    setAiLearnings((data as any)?.learnings || "");
    setAiLearningsLoading(false);
  };

  const saveAiLearnings = async () => {
    setAiLearningsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("ai_learnings" as any)
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ai_learnings" as any)
          .update({ learnings: aiLearnings, updated_at: new Date().toISOString() } as any)
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("ai_learnings" as any)
          .insert({ learnings: aiLearnings } as any);
      }
      toast({ title: "Saved", description: "AI learnings updated successfully." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setAiLearningsSaving(false);
    }
  };

  const generateLearnings = async () => {
    setAiLearningsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-learnings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiLearnings(data.learnings || "");
      toast({ title: "Learnings Generated", description: "AI learnings have been generated from past conversations. Review and save." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setAiLearningsGenerating(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    const { data } = await (supabase as any)
      .from("login_logs")
      .select("*")
      .order("logged_in_at", { ascending: false })
      .limit(50);
    setLogs((data as LoginLog[]) || []);
    setLogsLoading(false);
  };

  const fetchQuestions = async () => {
    setQuestionsLoading(true);
    const { data } = await (supabase as any)
      .from("question_logs")
      .select("*")
      .order("asked_at", { ascending: false })
      .limit(100);
    setQuestions((data as QuestionLog[]) || []);
    setQuestionsLoading(false);
  };

  const manageCustomerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-customers`;

  const fetchCustomerAccounts = async () => {
    setCustomersLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "list" }),
      });
      const data = await res.json();
      setCustomerAccounts(data.accounts || []);
    } catch {
      setCustomerAccounts([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const createCustomerAccount = async () => {
    if (!newCustUsername || !newCustAccountId) {
      toast({ title: "Error", description: "Username and customer account are required", variant: "destructive" });
      return;
    }
    setCreatingCustomer(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "create",
          username: newCustUsername,
          password: newCustPassword,
          customerAccountId: newCustAccountId,
          canSeeTrials: newCustTrials,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "Created", description: `Customer account ${newCustUsername} created successfully.` });
      setNewCustUsername("");
      setNewCustPassword("CA@2026");
      setNewCustAccountId("");
      setNewCustTrials(false);
      fetchCustomerAccounts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingCustomer(false);
    }
  };

  const updateCustomerAccount = async (id: string, updates: Record<string, any>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "update", id, ...updates }),
      });
      fetchCustomerAccounts();
    } catch {}
  };

  const deleteCustomerAccount = async (id: string, userId: string, username: string) => {
    if (!confirm(`Delete customer account "${username}"? This cannot be undone.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "delete", id, userId }),
      });
      toast({ title: "Deleted", description: `Customer account ${username} deleted.` });
      fetchCustomerAccounts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Build customer name lookup from accounts
  const customerNameMap = new Map(
    (allAccounts || []).map((a) => [a.id, a.name])
  );

  // Build list of unique customer account IDs from customerFarms
  const availableCustomerAccountIds = [...new Set((customerFarms || []).map((cf) => cf.customerAccountId))]
    .map((id) => ({ id, name: customerNameMap.get(id) || id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // CRM active users — users that have activities assigned to them
  const crmActiveUsers = useMemo(() => {
    if (!allUsers || !allActivities) return [];
    const assignedIds = new Set<string>();
    for (const a of allActivities) {
      if (a.assignedUserId) assignedIds.add(a.assignedUserId);
    }
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    return [...assignedIds]
      .map((id) => userMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name)) as typeof allUsers;
  }, [allUsers, allActivities]);

  const toggleCrmUser = (userId: string) => {
    setCrmSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      setCrmVisibleUserIds([...next]);
      return next;
    });
  };

  const clearCrmSelection = () => {
    setCrmSelectedUserIds(new Set());
    setCrmVisibleUserIds([]);
    toast({ title: "Selection cleared", description: "No users selected — all users will be shown in CRM Report." });
  };

  const selectAllCrmUsers = () => {
    const allIds = crmActiveUsers.map((u) => u.id);
    setCrmSelectedUserIds(new Set(allIds));
    setCrmVisibleUserIds(allIds);
    toast({ title: "All users selected", description: `${allIds.length} users selected for CRM Report.` });
  };

  useEffect(() => {
    fetchLogs();
    fetchQuestions();
    fetchAiInstructions();
    fetchAiLearnings();
    fetchCustomerAccounts();
    getCrmVisibleUserIds().then((ids) => {
      if (ids) setCrmSelectedUserIds(new Set(ids));
    });
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await changePassword(newPassword);
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Password updated successfully" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatLocation = (log: { city?: string | null; region?: string | null; country?: string | null }) => {
    const parts = [log.city, log.region, log.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "—";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="chrysal-gradient h-1.5" />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
          <PageHeaderActions />
        </div>

        {/* Change Password */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Change Password</CardTitle>
                <CardDescription>Update your admin password</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Data File Uploads */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Instructions</CardTitle>
                <CardDescription>
                  Custom instructions applied to all AI features (Exception Report, Seasonality Insights, AI Agent).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {aiInstructionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  placeholder="e.g. Focus on pH and temperature issues. Always mention recommended Chrysal products. Ignore farms with fewer than 3 reports..."
                  className="min-h-[160px] text-sm"
                  maxLength={4000}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{aiInstructions.length} / 4000 characters</p>
                  <Button onClick={saveAiInstructions} disabled={aiInstructionsSaving} size="sm" className="gap-2">
                    {aiInstructionsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save Instructions
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Learnings */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Learnings</CardTitle>
                <CardDescription>
                  Auto-generated insights from past AI Agent conversations. These are fed into the AI Agent to improve future responses. You can edit them manually or regenerate from recent conversations.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {aiLearningsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={aiLearnings}
                  onChange={(e) => setAiLearnings(e.target.value)}
                  placeholder="No learnings generated yet. Click 'Generate from Conversations' to analyze past AI Agent interactions and extract actionable insights..."
                  className="min-h-[200px] text-sm"
                  maxLength={6000}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{aiLearnings.length} / 6000 characters</p>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={generateLearnings}
                      disabled={aiLearningsGenerating}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      {aiLearningsGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                      {aiLearningsGenerating ? "Analyzing…" : "Generate from Conversations"}
                    </Button>
                    <Button onClick={saveAiLearnings} disabled={aiLearningsSaving} size="sm" className="gap-2">
                      {aiLearningsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save Learnings
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CRM User Filter */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">CRM Report Users</CardTitle>
                <CardDescription>
                  Select which users to show in the CRM Report. Uncheck users you don't need to see.
                  {crmSelectedUserIds.size > 0 && (
                    <span className="text-primary font-medium"> ({crmSelectedUserIds.size} selected)</span>
                  )}
                  {crmSelectedUserIds.size === 0 && (
                    <span className="text-muted-foreground"> (showing all)</span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {crmActiveUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading users...</p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[220px] justify-between gap-2">
                      <span className="truncate text-sm">
                        {crmSelectedUserIds.size === 0
                          ? "All users"
                          : `${crmSelectedUserIds.size} of ${crmActiveUsers.length} selected`}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search users..." />
                      <CommandList>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandItem
                          onSelect={selectAllCrmUsers}
                          className="font-medium"
                        >
                          <Check className={`mr-2 h-3.5 w-3.5 ${crmSelectedUserIds.size === crmActiveUsers.length ? "opacity-100" : "opacity-0"}`} />
                          Select All
                        </CommandItem>
                        <CommandItem
                          onSelect={clearCrmSelection}
                          className="font-medium"
                        >
                          <Check className={`mr-2 h-3.5 w-3.5 ${crmSelectedUserIds.size === 0 ? "opacity-100" : "opacity-0"}`} />
                          Clear Selection
                        </CommandItem>
                        {crmActiveUsers.map((u) => {
                          const isChecked = crmSelectedUserIds.has(u.id);
                          return (
                            <CommandItem
                              key={u.id}
                              onSelect={() => toggleCrmUser(u.id)}
                            >
                              <Check className={`mr-2 h-3.5 w-3.5 ${isChecked ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{u.name}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Data Files</CardTitle>
                <CardDescription>Drop multiple files at once — each is auto-routed by filename. Recognized: {DATA_FILES.map(f => f.key).join(", ")}.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Multi-file drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const files = Array.from(e.dataTransfer.files);
                if (files.length) handleBulkUpload(files);
              }}
              className={`mb-6 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"
              }`}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                {bulkUploading ? "Uploading…" : "Drop multiple files here"}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Files are matched by exact filename (e.g. <span className="font-mono">container.csv</span>, <span className="font-mono">servicesOrder.csv</span>). Unrecognized files are skipped.
              </p>
              <label>
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx"
                  className="hidden"
                  disabled={bulkUploading}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) handleBulkUpload(files);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" disabled={bulkUploading} asChild>
                  <span className="cursor-pointer gap-2 inline-flex items-center">
                    {bulkUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Select Files
                  </span>
                </Button>
              </label>
            </div>

          </CardContent>
        </Card>

        {/* Customer Account Management */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Customer Accounts</CardTitle>
                  <CardDescription>Create and manage customer login accounts linked to customer entities</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchCustomerAccounts} disabled={customersLoading}>
                <RefreshCw className={`h-4 w-4 ${customersLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Create new customer */}
            <div className="border border-border rounded-lg p-4 mb-6 space-y-4">
              <p className="text-sm font-medium">Create New Customer Account</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Username</Label>
                  <Input
                    placeholder="e.g. floraholland"
                    value={newCustUsername}
                    onChange={(e) => setNewCustUsername(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{newCustUsername ? `${newCustUsername}@chrysal.app` : "Will become username@chrysal.app"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input
                    value={newCustPassword}
                    onChange={(e) => setNewCustPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link to Customer Account</Label>
                <select
                  value={newCustAccountId}
                  onChange={(e) => setNewCustAccountId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a customer account…</option>
                  {availableCustomerAccountIds.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={newCustTrials} onCheckedChange={setNewCustTrials} />
                  <Label className="text-sm">Can see Trials Dashboard</Label>
                </div>
                <Button onClick={createCustomerAccount} disabled={creatingCustomer} size="sm" className="gap-2">
                  {creatingCustomer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create Account
                </Button>
              </div>
            </div>

            {/* Existing customer accounts */}
            {customersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : customerAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No customer accounts created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Linked Customer</TableHead>
                      <TableHead>Trials Access</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerAccounts.map((ca: any) => (
                      <TableRow key={ca.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-accent" />
                            <span className="font-medium text-sm">{ca.username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {customerNameMap.get(ca.customer_account_id) || ca.customer_account_id}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={ca.can_see_trials}
                            onCheckedChange={(checked) => updateCustomerAccount(ca.id, { canSeeTrials: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCustomerAccount(ca.id, ca.user_id, ca.username)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Login Logbook */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Login Logbook</CardTitle>
                  <CardDescription>Recent login activity (last 50 entries)</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={logsLoading}>
                <RefreshCw className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No login events recorded yet. Logins will appear here after the next sign-in.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          IP Address
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Location
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                log.username === "admin" ? "bg-primary" : "bg-accent"
                              }`}
                            />
                            <span className="font-medium text-sm">{log.username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(log.logged_in_at)}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {log.ip_address || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatLocation(log)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Questions Log */}
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircleQuestion className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">AI Agent Questions</CardTitle>
                  <CardDescription>Questions asked to the AI Agent (last 100)</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchQuestions} disabled={questionsLoading}>
                <RefreshCw className={`h-4 w-4 ${questionsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {questionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No questions asked yet. Questions will appear here after users interact with the AI Agent.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Location
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>
                          <span className="font-medium text-sm">{q.username || "—"}</span>
                        </TableCell>
                        <TableCell className="text-sm text-foreground max-w-md">
                          <p className="line-clamp-2">{q.question}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(q.asked_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatLocation(q)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
