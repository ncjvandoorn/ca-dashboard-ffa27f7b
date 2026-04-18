import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AILearningsCard = () => {
  const [aiLearnings, setAiLearnings] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ai_learnings")
        .select("learnings")
        .limit(1)
        .maybeSingle();
      setAiLearnings(data?.learnings || "");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("ai_learnings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ai_learnings")
          .update({ learnings: aiLearnings, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_learnings").insert({ learnings: aiLearnings });
      }
      toast({ title: "Saved", description: "AI learnings updated successfully." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
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
      toast({
        title: "Learnings Generated",
        description: "AI learnings have been generated from past conversations. Review and save.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
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
        {loading ? (
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
                  onClick={generate}
                  disabled={generating}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                  {generating ? "Analyzing…" : "Generate from Conversations"}
                </Button>
                <Button onClick={save} disabled={saving} size="sm" className="gap-2">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save Learnings
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
