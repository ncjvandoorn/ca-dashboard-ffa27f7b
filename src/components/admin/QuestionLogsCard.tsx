import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MapPin, MessageCircleQuestion, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatAdminDate, formatAdminLocation, type QuestionLog } from "@/lib/adminUtils";

export const QuestionLogsCard = () => {
  const [questions, setQuestions] = useState<QuestionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("question_logs")
      .select("*")
      .order("asked_at", { ascending: false })
      .limit(100);
    setQuestions((data as QuestionLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, []);

  return (
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
          <Button variant="ghost" size="icon" onClick={fetchQuestions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
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
                      {formatAdminDate(q.asked_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatAdminLocation(q)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
