import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, ClipboardList } from "lucide-react";
import { useActivities, useUsers } from "@/hooks/useQualityData";
import { getCrmVisibleUserIds, setCrmVisibleUserIds } from "@/lib/crmUserFilter";
import { useToast } from "@/hooks/use-toast";

export const CrmUserFilterCard = () => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: allUsers } = useUsers();
  const { data: allActivities } = useActivities();
  const { toast } = useToast();

  useEffect(() => {
    getCrmVisibleUserIds().then((ids) => {
      if (ids) setSelected(new Set(ids));
    });
  }, []);

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

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      setCrmVisibleUserIds([...next]);
      return next;
    });
  };

  const clear = () => {
    setSelected(new Set());
    setCrmVisibleUserIds([]);
    toast({ title: "Selection cleared", description: "No users selected — all users will be shown in CRM Report." });
  };

  const selectAll = () => {
    const allIds = crmActiveUsers.map((u) => u.id);
    setSelected(new Set(allIds));
    setCrmVisibleUserIds(allIds);
    toast({ title: "All users selected", description: `${allIds.length} users selected for CRM Report.` });
  };

  return (
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
              {selected.size > 0 && (
                <span className="text-primary font-medium"> ({selected.size} selected)</span>
              )}
              {selected.size === 0 && (
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
                    {selected.size === 0
                      ? "All users"
                      : `${selected.size} of ${crmActiveUsers.length} selected`}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandList>
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandItem onSelect={selectAll} className="font-medium">
                      <Check className={`mr-2 h-3.5 w-3.5 ${selected.size === crmActiveUsers.length ? "opacity-100" : "opacity-0"}`} />
                      Select All
                    </CommandItem>
                    <CommandItem onSelect={clear} className="font-medium">
                      <Check className={`mr-2 h-3.5 w-3.5 ${selected.size === 0 ? "opacity-100" : "opacity-0"}`} />
                      Clear Selection
                    </CommandItem>
                    {crmActiveUsers.map((u) => {
                      const isChecked = selected.has(u.id);
                      return (
                        <CommandItem key={u.id} onSelect={() => toggle(u.id)}>
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
  );
};
