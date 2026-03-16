import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, KeyRound, Check, BookOpen, MapPin, Globe, RefreshCw, MessageCircleQuestion } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

const Admin = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionLog[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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

  useEffect(() => {
    fetchLogs();
    fetchQuestions();
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
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <h1 className="text-2xl font-bold text-foreground mb-6">Admin Settings</h1>

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
