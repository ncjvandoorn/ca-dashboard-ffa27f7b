import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AIInstructionsCard = () => {
  const [aiInstructions, setAiInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ai_instructions")
        .select("instructions")
        .limit(1)
        .maybeSingle();
      setAiInstructions(data?.instructions || "");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("ai_instructions")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ai_instructions")
          .update({ instructions: aiInstructions, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_instructions").insert({ instructions: aiInstructions });
      }
      toast({ title: "Saved", description: "AI instructions updated successfully." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
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
        {loading ? (
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
              <Button onClick={save} disabled={saving} size="sm" className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save Instructions
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
