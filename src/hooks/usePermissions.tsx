import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ALL_FALSE,
  ALL_TRUE,
  PERMISSION_ITEMS,
  type PermissionKey,
  type PermissionMap,
  type RoleKey,
} from "@/lib/permissions";

const STORAGE_EVENT = "permissions:updated";

let cachedRows: Record<RoleKey, PermissionMap> | null = null;
let pending: Promise<Record<RoleKey, PermissionMap>> | null = null;

async function loadPermissions(): Promise<Record<RoleKey, PermissionMap>> {
  if (cachedRows) return cachedRows;
  if (pending) return pending;

  pending = (async () => {
    const { data } = await supabase.from("role_permissions").select("role_key, permissions");
    const result: Record<RoleKey, PermissionMap> = {
      admin: { ...ALL_TRUE },
      user: { ...ALL_TRUE, settings: false },
      customer_basic: { ...ALL_FALSE, all_reports: true, subscription_plans: true, data_loggers: false },
      customer_pro: {
        ...ALL_FALSE,
        ai_agent: true,
        all_reports: true,
        seasonality_insights: true,
        exception_report: true,
        trials_dashboard: true,
        subscription_plans: true,
      },
    };
    for (const row of data || []) {
      const key = row.role_key as RoleKey;
      if (!result[key]) continue;
      const stored = (row.permissions || {}) as Partial<PermissionMap>;
      const merged: PermissionMap = { ...ALL_FALSE };
      for (const item of PERMISSION_ITEMS) {
        merged[item.key] = stored[item.key] === true;
      }
      result[key] = merged;
    }
    cachedRows = result;
    return result;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}

export function invalidatePermissionsCache() {
  cachedRows = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }
}

/** Returns the permission map for the current user's role. */
export function usePermissions() {
  const { roleKey } = useAuth();
  const [rows, setRows] = useState<Record<RoleKey, PermissionMap> | null>(cachedRows);

  useEffect(() => {
    let cancelled = false;
    loadPermissions().then((res) => {
      if (!cancelled) setRows(res);
    });
    const onChange = () => {
      loadPermissions().then((res) => {
        if (!cancelled) setRows(res);
      });
    };
    window.addEventListener(STORAGE_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(STORAGE_EVENT, onChange);
    };
  }, []);

  const map = useMemo<PermissionMap>(() => {
    if (!rows || !roleKey) return ALL_FALSE;
    return rows[roleKey] || ALL_FALSE;
  }, [rows, roleKey]);

  const can = (key: PermissionKey) => map[key] === true;

  return { can, map, loaded: rows !== null };
}

/** Admin-only: load full matrix for editing. */
export async function fetchFullPermissionsMatrix(): Promise<Record<RoleKey, PermissionMap>> {
  cachedRows = null;
  return loadPermissions();
}

/** Admin-only: persist the matrix back to the database. */
export async function saveRolePermissions(roleKey: RoleKey, permissions: PermissionMap): Promise<void> {
  await supabase
    .from("role_permissions")
    .upsert({ role_key: roleKey, permissions, updated_at: new Date().toISOString() }, { onConflict: "role_key" });
  invalidatePermissionsCache();
}
