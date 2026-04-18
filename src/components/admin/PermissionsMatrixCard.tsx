import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  PERMISSION_ITEMS,
  ROLE_COLUMNS,
  type PermissionMap,
  type RoleKey,
} from "@/lib/permissions";
import { fetchFullPermissionsMatrix, saveRolePermissions } from "@/hooks/usePermissions";

export const PermissionsMatrixCard = () => {
  const { toast } = useToast();
  const [matrix, setMatrix] = useState<Record<RoleKey, PermissionMap> | null>(null);
  const [original, setOriginal] = useState<Record<RoleKey, PermissionMap> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchFullPermissionsMatrix();
        setMatrix(data);
        setOriginal(JSON.parse(JSON.stringify(data)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, typeof PERMISSION_ITEMS>();
    for (const item of PERMISSION_ITEMS) {
      const arr = map.get(item.group) || [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return [...map.entries()];
  }, []);

  const dirty = useMemo(() => {
    if (!matrix || !original) return false;
    return JSON.stringify(matrix) !== JSON.stringify(original);
  }, [matrix, original]);

  const toggle = (role: RoleKey, key: string) => {
    setMatrix((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [role]: { ...prev[role], [key]: !prev[role][key as keyof PermissionMap] } };
      // Admin row is always all-true and disabled
      if (role === "admin") return prev;
      return next;
    });
  };

  const onSave = async () => {
    if (!matrix) return;
    setSaving(true);
    try {
      await Promise.all(
        ROLE_COLUMNS.filter((r) => r.key !== "admin").map((r) =>
          saveRolePermissions(r.key, matrix[r.key]),
        ),
      );
      // Always force admin to all-true
      await saveRolePermissions("admin", matrix.admin);
      setOriginal(JSON.parse(JSON.stringify(matrix)));
      toast({ title: "Saved", description: "Permissions updated successfully." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Permissions Matrix</CardTitle>
              <CardDescription>
                Toggle which dashboard buttons and menu items each role can access. Export PDF and Logout are always shown.
              </CardDescription>
            </div>
          </div>
          <Button onClick={onSave} disabled={!dirty || saving} size="sm" className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading || !matrix ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-muted-foreground py-2 pr-4 w-1/3">Feature</th>
                  {ROLE_COLUMNS.map((c) => (
                    <th key={c.key} className="text-center font-medium text-muted-foreground py-2 px-2 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([group, items]) => (
                  <>
                    <tr key={`g-${group}`}>
                      <td colSpan={ROLE_COLUMNS.length + 1} className="pt-5 pb-1 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                        {group}
                      </td>
                    </tr>
                    {items.map((item) => (
                      <tr key={item.key} className="border-b border-border/40 last:border-b-0">
                        <td className="py-2 pr-4 font-medium text-foreground">{item.label}</td>
                        {ROLE_COLUMNS.map((col) => (
                          <td key={col.key} className="text-center py-2 px-2">
                            <Switch
                              checked={matrix[col.key][item.key]}
                              disabled={col.key === "admin"}
                              onCheckedChange={() => toggle(col.key, item.key)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
