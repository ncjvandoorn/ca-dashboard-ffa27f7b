/** Permission keys controllable from the admin matrix. */
export type PermissionKey =
  | "ai_agent"
  | "all_reports"
  | "reporting_check"
  | "seasonality_insights"
  | "exception_report"
  | "containers"
  | "active_sf"
  | "trial_planner"
  | "data_loggers"
  | "crm_activities"
  | "trials_dashboard"
  | "subscription_plans"
  | "customers_map"
  | "settings";

export type RoleKey = "admin" | "user" | "customer_basic" | "customer_pro";

export interface PermissionItem {
  key: PermissionKey;
  label: string;
  group: "Dashboard buttons" | "Menu items";
}

export const PERMISSION_ITEMS: PermissionItem[] = [
  { key: "ai_agent", label: "AI Agent", group: "Dashboard buttons" },
  { key: "all_reports", label: "All Reports", group: "Dashboard buttons" },
  { key: "seasonality_insights", label: "Seasonality Insights", group: "Dashboard buttons" },
  { key: "exception_report", label: "Exception Report", group: "Dashboard buttons" },
  { key: "containers", label: "Containers", group: "Menu items" },
  { key: "active_sf", label: "Active SF", group: "Menu items" },
  { key: "trial_planner", label: "Trial Planner", group: "Menu items" },
  { key: "data_loggers", label: "Data Loggers", group: "Menu items" },
  { key: "reporting_check", label: "Reporting Check", group: "Menu items" },
  { key: "crm_activities", label: "CRM Activities", group: "Menu items" },
  { key: "trials_dashboard", label: "Trials Dashboard", group: "Menu items" },
  { key: "subscription_plans", label: "Subscription Plans", group: "Menu items" },
  { key: "customers_map", label: "Customers Map", group: "Menu items" },
  { key: "settings", label: "Settings", group: "Menu items" },
];

export const ROLE_COLUMNS: { key: RoleKey; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "user", label: "Chrysal" },
  { key: "customer_basic", label: "Customer · Basic" },
  { key: "customer_pro", label: "Customer · Pro/Pro+/Heavy" },
];

export type PermissionMap = Record<PermissionKey, boolean>;

export const ALL_FALSE: PermissionMap = PERMISSION_ITEMS.reduce(
  (acc, item) => ({ ...acc, [item.key]: false }),
  {} as PermissionMap,
);

export const ALL_TRUE: PermissionMap = PERMISSION_ITEMS.reduce(
  (acc, item) => ({ ...acc, [item.key]: true }),
  {} as PermissionMap,
);
