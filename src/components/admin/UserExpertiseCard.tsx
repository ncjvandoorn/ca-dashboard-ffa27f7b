import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Save, Loader2 } from "lucide-react";
import { useUsers } from "@/hooks/useQualityData";
import { getCrmVisibleUserIds } from "@/lib/crmUserFilter";
import { getUserExpertiseMap, setUserExpertise } from "@/lib/userExpertise";
import { useToast } from "@/hooks/use-toast";

export const UserExpertiseCard = () => {
  const { data: allUsers } = useUsers();
  const { toast } = useToast();
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [expertise, setExpertise] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const ids = await getCrmVisibleUserIds();
      setVisibleIds(ids || []);
      const map = await getUserExpertiseMap();
      setExpertise(map);
      setLoaded(true);
    })();
  }, []);

  const visibleUsers = useMemo(() => {
    if (!allUsers) return [];
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    return visibleIds
      .map((id) => userMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name)) as typeof allUsers;
  }, [allUsers, visibleIds]);

  const handleSave = async (userId: string) => {
    setSaving(userId);
    try {
      await setUserExpertise(userId, expertise[userId] || "");
      toast({ title: "Saved", description: "Expertise updated." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Try again", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">User Expertise (for AI Planner)</CardTitle>
            <CardDescription>
              Describe what each Technical Consultant can/cannot do. Used by the AI Planner to assign visits to the right user.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading users...</p>
        ) : visibleUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Select users in "CRM Report Users" above first.
          </p>
        ) : (
          <div className="space-y-4">
            {visibleUsers.map((u) => (
              <div key={u.id} className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3 items-start">
                <Label className="md:pt-2 font-medium">{u.name}</Label>
                <Textarea
                  value={expertise[u.id] || ""}
                  onChange={(e) => setExpertise((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  placeholder='e.g. "All products except Gatten, Danisaraba and Biostimulants"'
                  rows={2}
                  className="resize-y"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSave(u.id)}
                  disabled={saving === u.id}
                  className="md:mt-1 gap-1.5"
                >
                  {saving === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
