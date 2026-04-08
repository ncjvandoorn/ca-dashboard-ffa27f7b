const CRM_USERS_KEY = "crm-visible-users";

export function getCrmVisibleUserIds(): string[] | null {
  try {
    const raw = localStorage.getItem(CRM_USERS_KEY);
    if (!raw) return null; // null = show all
    const ids = JSON.parse(raw);
    return Array.isArray(ids) && ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

export function setCrmVisibleUserIds(ids: string[]): void {
  if (ids.length === 0) {
    localStorage.removeItem(CRM_USERS_KEY);
  } else {
    localStorage.setItem(CRM_USERS_KEY, JSON.stringify(ids));
  }
}
